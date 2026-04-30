

// content/content.js - SilentShield v4.3 Aggressive (Working Base)
let threshold = 0.75;
let autoBlurEnabled = true;

let toxicCount = 0;
let blurCount = 0;
let inferenceCount = 0;
let detectedHistory = [];
let dailyTrends = {};

const CATEGORIES = {
  toxic: { keywords: ['fuck','shit','bitch','asshole','stupid','idiot','worthless','loser','terrible','garbage'], weight: 0.35 },
  hate: { keywords: ['hate','nigger','faggot','cunt','retard','kys','kill yourself'], weight: 0.40 },
  harassment: { keywords: ['kill','die','hurt','attack','find you','watch your back','threat','regret'], weight: 0.35 }
};

async function loadSettings() {
  const data = await chrome.storage.local.get(['threshold', 'autoBlur']);
  if (data.threshold !== undefined) threshold = data.threshold;
  if (data.autoBlur !== undefined) autoBlurEnabled = data.autoBlur;
}

const toxicKeywords = ["fuck","fucking","fucked","shit","bitch","asshole","cunt","dick","pussy","retard","faggot","kys","kill yourself","stfu","slut","whore"];

function calculateToxicityScore(text) {
  if (!text || text.length < 20) return 0;
  const lower = text.toLowerCase();
  let score = 0.15;
  let categoryScores = { toxic: 0, hate: 0, harassment: 0 };

  // Check each category
  for (const [cat, data] of Object.entries(CATEGORIES)) {
    data.keywords.forEach(word => {
      if (lower.includes(word)) {
        score += data.weight;
        categoryScores[cat] += data.weight;
      }
    });
  }

  // Additional heuristics
  if (text.length < 150 && /fuck|kys|retard|bitch/i.test(lower)) score += 0.4;
  if (text.length > 300) score *= 0.7;

  // Determine primary category
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

  // Primary targets
  document.querySelectorAll('shreddit-comment').forEach(el => candidates.push(el));

  // Shadow DOM support
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

  // Fallbacks
  document.querySelectorAll('div[id^="t1_"], faceplate-comment, article').forEach(el => {
    if (!candidates.includes(el)) candidates.push(el);
  });

  // Broad fallback
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

    // Add to history
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
    if (detectedHistory.length > 100) detectedHistory.pop(); // Keep last 100

    // Update daily trends
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

    // Persist all data
    persistData();
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
  // Get install date if not set
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

  // Load persisted counts
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

  console.log("%c🚀 SilentShield v4.3 - Aggressive Detection (Stable)", "color:#10b981; font-weight:bold");

  setTimeout(scanContent, 1500);
  setInterval(scanContent, 5000);

  new MutationObserver(scanContent).observe(document.body, { childList: true, subtree: true });
}

init();

