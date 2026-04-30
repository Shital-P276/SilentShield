// content.js - SilentShield AI Pro - Merged Content Script

// ── CONFIGURATION ──
let isModalOpen = false;

// F2: Retained for scoring logic (used by persistData / dashboard only)
let threshold = 0.75;
let autoBlurEnabled = true;
let toxicCount = 0;
let blurCount = 0;
let inferenceCount = 0;
let detectedHistory = [];
let dailyTrends = {};

const CATEGORIES = {
  toxic:      { keywords: ['fuck','shit','bitch','asshole','stupid','idiot','worthless','loser','terrible','garbage'], weight: 0.35 },
  hate:       { keywords: ['hate','nigger','faggot','cunt','retard','kys','kill yourself'], weight: 0.40 },
  harassment: { keywords: ['kill','die','hurt','attack','find you','watch your back','threat','regret'], weight: 0.35 }
};

// F1: Substring list for fast synchronous blurring + media + typing detection
// Dynamically generated from CATEGORIES to prevent duplicate manual entries
const SUBSTRING_LIST = Object.values(CATEGORIES).flatMap(category => category.keywords);

// ── F1: SPEECH WARNING ──
function speak(msg) {
  if (window.speechSynthesis.speaking) return;
  const utterance = new SpeechSynthesisUtterance(msg);
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

// ── F1: WARNING MODAL ──
window.showAttractiveWarning = function() {
  if (document.getElementById('shield-warning-modal')) return;
  isModalOpen = true;
  const modal = document.createElement('div');
  modal.id = 'shield-warning-modal';
  modal.innerHTML = `
    <div class="shield-modal-content">
      <div class="shield-icon">🛡️</div>
      <div class="shield-text-wrapper">
        <h2 class="shield-title">CONTENT BLOCKED</h2>
        <p class="shield-description">
          Specific restricted elements have been obscured to protect your experience while keeping the layout intact.
        </p>
      </div>
      <button id="close-shield-modal">Dismiss Warning</button>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('close-shield-modal').onclick = (e) => {
    e.stopPropagation();
    modal.style.opacity = '0';
    setTimeout(() => { modal.remove(); isModalOpen = false; }, 300);
  };
};

// ── F1: CORE BLURRING ENGINE (surgical leaf-node targeting, zero delay) ──
function applyShield() {
  if (isModalOpen) return;

  // F1: targets leaf nodes — fast, precise, no broad container sweep
  const targets = document.querySelectorAll(
    'p, span, h1, h2, h3, li, a, b, strong, em, i, [data-testid="tweetText"]'
  );

  targets.forEach(el => {
    const textToScan = el.innerText.toLowerCase();
    const hasAbuse = SUBSTRING_LIST.some(word => textToScan.includes(word));

    if (hasAbuse && !el.classList.contains('silent-shield-blur')) {
      el.classList.add('silent-shield-blur');

      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        speak("Warning: This specific section contains restricted content.");
        window.showAttractiveWarning();
      }, true);

      // Track for dashboard
      inferenceCount++;
      toxicCount++;
      const result = calculateToxicityScore(textToScan);
      detectedHistory.unshift({
        id: Date.now() + Math.random(),
        text: el.innerText.substring(0, 200),
        category: result.category,
        confidence: Math.round(result.score * 100) + '%',
        score: result.score,
        source: window.location.hostname.replace('www.', ''),
        timestamp: Date.now(),
        action: 'Blurred',
        blurred: true
      });
      if (detectedHistory.length > 100) detectedHistory.pop();
      updateDailyTrends(result.category);
      blurCount++;
      persistData();
    }
  });

  // F1: Media analysis
  document.querySelectorAll('img:not([data-shield-checked]), video:not([data-shield-checked])').forEach(media => {
    media.dataset.shieldChecked = "pending";
    const mediaUrl = media.tagName === 'VIDEO' ? media.poster : media.src;
    const mediaInfo = (media.alt + mediaUrl).toLowerCase();
    if (SUBSTRING_LIST.some(word => mediaInfo.includes(word))) {
      media.classList.add('silent-shield-blur');
    }
    if (mediaUrl && mediaUrl.startsWith('http')) {
      chrome.runtime.sendMessage({ action: "analyzeImage", imgUrl: mediaUrl }, (res) => {
        if (res && res.isExplicit) media.classList.add('silent-shield-blur');
        media.dataset.shieldChecked = "true";
      });
    }
  });
}

// ── F2: SCORING (used for dashboard categorisation only) ──
function calculateToxicityScore(text) {
  if (!text || text.length < 5) return { score: 0.5, category: 'toxic', categoryScores: {} };
  const lower = text.toLowerCase();
  let score = 0.15;
  let categoryScores = { toxic: 0, hate: 0, harassment: 0 };
  for (const [cat, data] of Object.entries(CATEGORIES)) {
    data.keywords.forEach(word => {
      if (lower.includes(word)) { score += data.weight; categoryScores[cat] += data.weight; }
    });
  }
  let primaryCategory = 'toxic';
  let maxCatScore = categoryScores.toxic;
  for (const [cat, catScore] of Object.entries(categoryScores)) {
    if (catScore > maxCatScore) { maxCatScore = catScore; primaryCategory = cat; }
  }
  return { score: Math.min(0.96, score), category: primaryCategory, categoryScores };
}

// ── F2: DASHBOARD HELPERS ──
function updateDailyTrends(category) {
  const today = new Date().toISOString().split('T')[0];
  if (!dailyTrends[today]) dailyTrends[today] = { toxic: 0, suspicious: 0, safe: 0 };
  if (category === 'toxic' || category === 'hate') dailyTrends[today].toxic++;
  else if (category === 'harassment') dailyTrends[today].suspicious++;
  else dailyTrends[today].safe++;
}

async function persistData() {
  const data = await chrome.storage.local.get(['installDate']);
  await chrome.storage.local.set({
    toxicCount, blurCount, inferenceCount,
    detectedHistory, dailyTrends,
    installDate: data.installDate || Date.now(),
    lastUpdated: Date.now()
  });
}

// ── F1: TYPING DETECTION ──
document.addEventListener('input', (e) => {
  const text = e.target.value?.toLowerCase() || "";
  if (SUBSTRING_LIST.some(word => text.includes(word)) && text.length > 8) {
    chrome.runtime.sendMessage({ action: "typingWarning" });
  }
});

// ── F2: RESET COUNTERS ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "RESET_COUNTERS") {
    toxicCount = 0; blurCount = 0; inferenceCount = 0;
  }
});

// ── F1: MONITORING — zero delay startup, 2s interval, direct MutationObserver ──
// No async init gate — blurring starts immediately on document_start
const observer = new MutationObserver(() => applyShield());
observer.observe(document.documentElement, { childList: true, subtree: true });

setInterval(applyShield, 2000);
applyShield(); // fire immediately — no setTimeout delay