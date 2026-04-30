// content/content.js - SilentShield v4.3 with Firebase Sync
let threshold = 0.75;
let autoBlurEnabled = true;

let toxicCount = 0;
let blurCount = 0;
let inferenceCount = 0;
let detectedHistory = [];
let dailyTrends = {};

// Firebase state
let firebaseUID = null;
let firebaseSyncEnabled = false;
let pendingFirebaseUpdates = [];
let syncDebounceTimer = null;

const CATEGORIES = {
  toxic: { keywords: ['fuck','shit','bitch','asshole','stupid','idiot','worthless','loser','terrible','garbage'], weight: 0.35 },
  hate: { keywords: ['hate','nigger','faggot','cunt','retard','kys','kill yourself'], weight: 0.40 },
  harassment: { keywords: ['kill','die','hurt','attack','find you','watch your back','threat','regret'], weight: 0.35 }
};

// ==========================================
// Firebase Auth & Sync
// ==========================================

/**
 * Load Firebase credentials from chrome.storage (set after user logs in via popup/dashboard).
 * The dashboard writes { firebaseUID, firebaseToken, firebaseSyncEnabled } after successful login.
 */
async function loadFirebaseAuth() {
  const data = await chrome.storage.local.get([
    'firebaseUID',
    'firebaseToken',
    'firebaseSyncEnabled'
  ]);
  firebaseUID = data.firebaseUID || null;
  firebaseSyncEnabled = data.firebaseSyncEnabled === true && !!firebaseUID;
  console.log(
    firebaseSyncEnabled
      ? `🔥 SilentShield: Firebase sync enabled for UID ${firebaseUID}`
      : '📴 SilentShield: Firebase sync disabled (not logged in)'
  );
}

/**
 * Build the Firestore REST URL for the user's dashboard/summary document.
 * Path: users/{uid}/dashboard/summary
 */
function getProjectId() {
  // Firebase project ID - must match firebase-config.js
  return 'silentshield-39e11';
}

function getDashboardDocUrl() {
  const PROJECT_ID = getProjectId();
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${firebaseUID}/dashboard/summary`;
}

/**
 * Build the Firestore REST URL for a detection entry sub-collection.
 * Path: users/{uid}/detections/{detectionId}
 */
function getDetectionDocUrl(detectionId) {
  const PROJECT_ID = getProjectId();
  return `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${firebaseUID}/detections/${detectionId}`;
}

/**
 * Get the current Firebase ID token. The dashboard stores it after login.
 * Tokens expire after 1 hour — the dashboard is responsible for refreshing.
 */
async function getFirebaseToken() {
  const data = await chrome.storage.local.get(['firebaseToken']);
  return data.firebaseToken || null;
}

/**
 * Convert a plain JS object to Firestore REST field value format.
 */
function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'number') {
      fields[key] = { integerValue: String(Math.round(value)) };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    }
  }
  return fields;
}

/**
 * PATCH the dashboard/summary document with aggregated stats.
 * Uses Firestore REST PATCH with updateMask to only update specific fields.
 */
async function syncDashboardToFirebase() {
  if (!firebaseSyncEnabled || !firebaseUID) return;

  const token = await getFirebaseToken();
  if (!token) {
    console.warn('⚠️ SilentShield: No Firebase token available, skipping sync');
    return;
  }

  // Calculate safety score
  let safetyScore = 94;
  if (inferenceCount > 0) {
    const threatRatio = toxicCount / inferenceCount;
    safetyScore = Math.max(50, Math.round(100 - threatRatio * 100));
  }

  // Calculate risk level
  let riskLevel = 'low';
  if (safetyScore < 50) riskLevel = 'high';
  else if (safetyScore < 75) riskLevel = 'elevated';

  const payload = {
    fields: toFirestoreFields({
      safetyScore,
      toxicDetected: toxicCount,
      autoBlurred: blurCount,
      inferences: inferenceCount,
      activeDays: Math.max(
        1,
        Math.floor((Date.now() - (await getInstallDate())) / (1000 * 60 * 60 * 24))
      ),
      riskLevel,
      lastSyncedAt: Date.now()
    })
  };

  // Fields to update (updateMask prevents overwriting createdAt etc.)
  const updateMask =
    'safetyScore,toxicDetected,autoBlurred,inferences,activeDays,riskLevel,lastSyncedAt';

  try {
    const res = await fetch(`${getDashboardDocUrl()}?updateMask.fieldPaths=${updateMask.split(',').join('&updateMask.fieldPaths=')}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('🔥 Firestore PATCH failed:', err);
    } else {
      console.log('✅ SilentShield: Dashboard synced to Firebase');
    }
  } catch (e) {
    console.error('🔥 SilentShield Firebase sync error:', e);
  }
}

/**
 * Write a single detection event to users/{uid}/detections/{id}.
 */
async function syncDetectionToFirebase(detection) {
  if (!firebaseSyncEnabled || !firebaseUID) return;

  const token = await getFirebaseToken();
  if (!token) return;

  // Only sync the fields we want — strip locally-only fields
  const payload = {
    fields: toFirestoreFields({
      text: detection.text.substring(0, 300), // cap at 300 chars
      category: detection.category,
      confidence: detection.confidence,
      score: detection.score,
      source: detection.source,
      timestamp: detection.timestamp,
      action: detection.action,
      blurred: detection.blurred ? 1 : 0
    })
  };

  const docId = String(detection.id).replace('.', '_'); // Firestore IDs can't have dots

  try {
    const res = await fetch(getDetectionDocUrl(docId), {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const err = await res.json();
      console.error('🔥 Firestore detection write failed:', err);
    }
  } catch (e) {
    console.error('🔥 SilentShield detection sync error:', e);
  }
}

/**
 * Debounced dashboard sync — batches rapid updates into one write.
 */
function scheduleDashboardSync() {
  if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
  syncDebounceTimer = setTimeout(() => {
    syncDashboardToFirebase();
  }, 3000); // wait 3s after last detection before syncing
}

async function getInstallDate() {
  const data = await chrome.storage.local.get(['installDate']);
  return data.installDate || Date.now();
}

// ==========================================
// Settings
// ==========================================

async function loadSettings() {
  const data = await chrome.storage.local.get(['threshold', 'autoBlur']);
  if (data.threshold !== undefined) threshold = data.threshold;
  if (data.autoBlur !== undefined) autoBlurEnabled = data.autoBlur;
}

// ==========================================
// Detection Logic (unchanged from original)
// ==========================================

function calculateToxicityScore(text) {
  if (!text || text.length < 20) return 0;
  const lower = text.toLowerCase();
  let score = 0.15;
  let categoryScores = { toxic: 0, hate: 0, harassment: 0 };

  for (const [cat, data] of Object.entries(CATEGORIES)) {
    data.keywords.forEach(word => {
      if (lower.includes(word)) {
        score += data.weight;
        categoryScores[cat] += data.weight;
      }
    });
  }

  if (text.length < 150 && /fuck|kys|retard|bitch/i.test(lower)) score += 0.4;
  if (text.length > 300) score *= 0.7;

  let primaryCategory = 'toxic';
  let maxCatScore = categoryScores.toxic;
  for (const [cat, catScore] of Object.entries(categoryScores)) {
    if (catScore > maxCatScore) {
      maxCatScore = catScore;
      primaryCategory = cat;
    }
  }

  return {
    score: Math.min(0.96, score),
    category: primaryCategory,
    categoryScores
  };
}

function findComments() {
  const candidates = [];

  document.querySelectorAll('shreddit-comment').forEach(el => candidates.push(el));

  document.querySelectorAll('shreddit-comment').forEach(comment => {
    if (comment.shadowRoot) {
      const walker = document.createTreeWalker(comment.shadowRoot, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while (node = walker.nextNode()) {
        if (node.textContent.trim().length > 40) {
          candidates.push(comment);
          break;
        }
      }
    }
  });

  document.querySelectorAll('div[id^="t1_"], faceplate-comment, article').forEach(el => {
    if (!candidates.includes(el)) candidates.push(el);
  });

  document.querySelectorAll('p, div').forEach(el => {
    const text = (el.innerText || '').trim();
    if (text.length > 50 && text.length < 700) {
      if (!el.closest('header, nav, footer, button, input, form')) {
        candidates.push(el);
      }
    }
  });

  return [...new Set(candidates)];
}

function injectGlobalStyles() {
  if (document.getElementById('silentshield-styles')) return;
  const style = document.createElement('style');
  style.id = 'silentshield-styles';
  style.textContent = `
    .silentshield-toxic, .silentshield-toxic * {
      filter: blur(7px) !important;
      transition: filter 0.4s ease !important;
    }
    .silentshield-toxic {
      border: 3px solid #ef4444 !important;
      border-radius: 8px !important;
      position: relative !important;
    }
  `;
  document.head.appendChild(style);
  console.log("✅ SilentShield: Global styles injected");
}

function protectComment(element) {
  if (element.dataset.silentshieldProcessed) return;
  element.dataset.silentshieldProcessed = "true";

  let text = (element.innerText || element.textContent || '').trim();
  if (element.shadowRoot) {
    const shadowText = element.shadowRoot.innerText || '';
    if (shadowText.length > text.length) text = shadowText;
  }

  if (text.length < 30) return;

  inferenceCount++;
  const result = calculateToxicityScore(text);
  const score = result.score;

  if (score > threshold) {
    console.log(`🔴 Flagged (${score.toFixed(2)}): ${text.substring(0, 70)}...`);
    toxicCount++;

    const detection = {
      id: Date.now() + Math.random(),
      text: text.substring(0, 200),
      category: result.category,
      confidence: Math.round(score * 100) + '%',
      score: score,
      source: window.location.hostname.replace('www.', ''),
      timestamp: Date.now(),
      time: getTimeAgo(Date.now()),
      action: autoBlurEnabled ? 'Blurred' : 'Detected',
      blurred: autoBlurEnabled
    };
    detectedHistory.unshift(detection);
    if (detectedHistory.length > 100) detectedHistory.pop();

    updateDailyTrends(result.category);

    element.classList.add('silentshield-toxic');

    if (autoBlurEnabled) {
      blurCount++;
      const revealBtn = document.createElement('button');
      revealBtn.textContent = "👁️ Reveal";
      revealBtn.style.cssText = `
        position:absolute; bottom:-26px; left:50%; transform:translateX(-50%);
        background:#1f2937; color:white; border:2px solid #ef4444;
        padding:6px 16px; border-radius:9999px; font-size:13px; cursor:pointer; z-index:200;
      `;
      revealBtn.onclick = (e) => {
        e.stopPropagation();
        element.classList.remove('silentshield-toxic');
        revealBtn.remove();
      };
      element.style.position = 'relative';
      element.appendChild(revealBtn);
    }

    // Persist locally first (always)
    persistData();

    // Then sync to Firebase (debounced dashboard + immediate detection write)
    if (firebaseSyncEnabled) {
      syncDetectionToFirebase(detection);
      scheduleDashboardSync();
    }

  } else {
    updateDailyTrends('safe');
  }
}

function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function updateDailyTrends(category) {
  const today = new Date().toISOString().split('T')[0];
  if (!dailyTrends[today]) {
    dailyTrends[today] = { toxic: 0, suspicious: 0, safe: 0 };
  }
  if (category === 'toxic' || category === 'hate') {
    dailyTrends[today].toxic++;
  } else if (category === 'harassment') {
    dailyTrends[today].suspicious++;
  } else {
    dailyTrends[today].safe++;
  }
}

async function persistData() {
  const data = await chrome.storage.local.get(['installDate']);
  const installDate = data.installDate || Date.now();

  await chrome.storage.local.set({
    toxicCount,
    blurCount,
    inferenceCount,
    detectedHistory,
    dailyTrends,
    installDate,
    lastUpdated: Date.now()
  });
}

// ==========================================
// Listen for auth changes from dashboard
// ==========================================

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;

  // Re-read auth when login/logout happens from the dashboard
  if (changes.firebaseUID || changes.firebaseSyncEnabled || changes.firebaseToken) {
    loadFirebaseAuth().then(() => {
      if (firebaseSyncEnabled) {
        // Immediately push current stats on login
        syncDashboardToFirebase();
      }
    });
  }
});

// ==========================================
// Scan Loop
// ==========================================

let timeout = null;
function scanContent() {
  if (timeout) clearTimeout(timeout);
  timeout = setTimeout(() => {
    const items = findComments();
    console.log(`🔍 Scanning ${items.length} items on ${window.location.hostname}`);
    items.forEach(protectComment);
  }, 1000);
}

async function init() {
  await loadSettings();
  await loadFirebaseAuth();

  const data = await chrome.storage.local.get([
    'toxicCount', 'blurCount', 'inferenceCount',
    'detectedHistory', 'dailyTrends', 'installDate'
  ]);
  if (data.toxicCount !== undefined) toxicCount = data.toxicCount;
  if (data.blurCount !== undefined) blurCount = data.blurCount;
  if (data.inferenceCount !== undefined) inferenceCount = data.inferenceCount;
  if (data.detectedHistory) detectedHistory = data.detectedHistory;
  if (data.dailyTrends) dailyTrends = data.dailyTrends;
  if (!data.installDate) {
    await chrome.storage.local.set({ installDate: Date.now() });
  }

  injectGlobalStyles();

  console.log("%c🚀 SilentShield v4.3 - Firebase Edition", "color:#10b981; font-weight:bold");

  setTimeout(scanContent, 1500);
  setInterval(scanContent, 5000);

  // Periodic Firebase dashboard sync every 5 minutes
  setInterval(() => {
    if (firebaseSyncEnabled) syncDashboardToFirebase();
  }, 5 * 60 * 1000);

  new MutationObserver(scanContent).observe(document.body, { childList: true, subtree: true });
}

init();