// popup/popup.js - SilentShield AI Pro

// ── HELPERS ───────────────────────────────────────────────────────────────────

function countUp(el, target, ms = 600) {
  if (!el) return;
  const start = performance.now();
  const from = parseInt(el.textContent, 10) || 0;
  function tick(now) {
    const progress = Math.min((now - start) / ms, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ── STATS: read directly from storage and update UI ──────────────────────────
// FIX: use callback form (not .then()) — more reliable in extension context
// FIX: called on every open AND on every storage change
function updateOverviewUI() {
  chrome.storage.local.get(
    ['toxicCount', 'blurCount', 'inferenceCount'],
    (data) => {
      if (chrome.runtime.lastError) return;

      const toxic    = data.toxicCount     || 0;
      const blurred  = data.blurCount      || 0;
      const inferred = data.inferenceCount || 0;

      // Safety score: 100 when clean, drops as toxics accumulate
      const safetyScore = inferred === 0
        ? 100
        : Math.max(0, Math.round(100 - (toxic / (inferred + 5)) * 100));

      const scoreEl  = document.getElementById('score-display');
      const toxicEl  = document.getElementById('toxic-count');
      const blurEl   = document.getElementById('blur-count');
      const fillEl   = document.getElementById('score-fill');

      if (scoreEl) countUp(scoreEl, safetyScore);
      if (toxicEl) countUp(toxicEl, toxic);
      if (blurEl)  countUp(blurEl,  blurred);
      if (fillEl)  fillEl.style.width = safetyScore + '%';
    }
  );
}

// ── LIVE SYNC: re-render whenever content.js writes new counts ────────────────
// FIX: listen to all three keys that content.js increments
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.toxicCount || changes.blurCount || changes.inferenceCount) {
    updateOverviewUI();
  }
});

// ── TAB SWITCHING ─────────────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const panel = document.getElementById('tab-' + btn.dataset.tab);
    if (panel) panel.classList.add('active');
    // FIX: refresh stats every time user opens the Overview tab
    if (btn.dataset.tab === 'overview') updateOverviewUI();
  });
});

// ── RESET STATS ───────────────────────────────────────────────────────────────
const resetBtn = document.getElementById('reset-stats-btn');
if (resetBtn) {
  resetBtn.addEventListener('click', () => {
    chrome.storage.local.set(
      { toxicCount: 0, blurCount: 0, inferenceCount: 0 },
      () => {
        updateOverviewUI();
        // Tell content script to un-blur everything and reset its local counters
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, { type: 'RESET_COUNTERS' }, () => {
              void chrome.runtime.lastError; // suppress "no receiver" on non-content pages
            });
          }
        });
      }
    );
    // Spin animation
    resetBtn.style.transition = 'transform 0.5s ease';
    resetBtn.style.transform  = 'rotate(360deg)';
    setTimeout(() => {
      resetBtn.style.transition = 'none';
      resetBtn.style.transform  = '';
    }, 520);
  });
}

// ── ANALYZER ─────────────────────────────────────────────────────────────────
let lastAnalysisResult = null;

const runBtn     = document.getElementById('run-btn');
const testText   = document.getElementById('test-text');
const resultCard = document.getElementById('result-card');
const actionBtns = document.getElementById('action-buttons');

if (runBtn) {
  runBtn.addEventListener('click', async () => {
    const text = testText.value.trim();
    if (!text) return;

    runBtn.textContent = 'Analyzing…';
    runBtn.disabled    = true;
    if (resultCard) resultCard.classList.remove('show');
    if (actionBtns) actionBtns.style.display = 'none';

    try {
      // FIX: use callback form to avoid unhandled promise rejection on missing handler
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', text }, (res) => {
          if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
          resolve(res);
        });
      });

      if (!response || !response.result) throw new Error('No response from background');
      const result  = response.result[0];
      const isToxic = result.label === 'NEGATIVE';
      lastAnalysisResult = { isToxic, score: result.score, text };

      const resultTag   = document.getElementById('result-tag');
      const resultScore = document.getElementById('result-score');
      if (resultTag) {
        resultTag.textContent = isToxic ? 'Toxic' : 'Safe';
        resultTag.className   = 'result-tag ' + (isToxic ? 'toxic' : 'safe');
      }
      if (resultScore) resultScore.textContent = (result.score * 100).toFixed(1) + '%';
      if (resultCard)  resultCard.classList.add('show');
      if (actionBtns)  actionBtns.style.display = 'flex';

    } catch (err) {
      console.warn('SilentShield Analyzer:', err.message);
      const resultTag = document.getElementById('result-tag');
      if (resultTag) { resultTag.textContent = 'Error'; resultTag.className = 'result-tag'; }
    } finally {
      runBtn.textContent = 'Run Inference';
      runBtn.disabled    = false;
    }
  });
}

// ── ACTION BUTTONS ────────────────────────────────────────────────────────────
const safeReplies = [
  "Thanks for sharing. Let's keep it respectful 🙏",
  "I see your point. Can we discuss constructively?",
  "Appreciate the passion. Let's focus on solutions.",
  "Interesting perspective! Less harsh wording?",
  "Let's maintain positive dialogue here."
];

const safeReplyBtn = document.getElementById('safeReplyBtn');
if (safeReplyBtn) {
  safeReplyBtn.addEventListener('click', () => {
    const reply = safeReplies[Math.floor(Math.random() * safeReplies.length)];
    navigator.clipboard.writeText(reply).then(() => {
      safeReplyBtn.textContent = '✅ Copied!';
      setTimeout(() => { safeReplyBtn.textContent = '💬 Safe Reply'; }, 1500);
    });
  });
}

const blockBtn = document.getElementById('blockBtn');
if (blockBtn) {
  blockBtn.addEventListener('click', () => {
    if (!lastAnalysisResult) return;
    chrome.storage.local.get(['blockedTexts'], (data) => {
      const blocked = data.blockedTexts || [];
      blocked.push({ text: lastAnalysisResult.text, blockedAt: Date.now() });
      chrome.storage.local.set({ blockedTexts: blocked });
      blockBtn.textContent = '✅ Blocked';
      setTimeout(() => { blockBtn.textContent = '🚫 Block'; }, 1500);
    });
  });
}

const reportBtn = document.getElementById('reportBtn');
if (reportBtn) {
  reportBtn.addEventListener('click', () => {
    if (!lastAnalysisResult) return;
    chrome.storage.local.get(['reportedTexts'], (data) => {
      const reported = data.reportedTexts || [];
      reported.push({ text: lastAnalysisResult.text, reportedAt: Date.now() });
      chrome.storage.local.set({ reportedTexts: reported });
      reportBtn.textContent = '✅ Reported';
      setTimeout(() => { reportBtn.textContent = '📢 Report'; }, 1500);
    });
  });
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
const dashboardBtn = document.getElementById('open-dashboard-btn');
if (dashboardBtn) {
  dashboardBtn.addEventListener('click', () => {
    chrome.windows.create({
      url:    chrome.runtime.getURL('dashboard/dashboard.html'),
      type:   'popup',
      width:  1000,
      height: 700
    });
  });
}

// ── LINK CHECKER ─────────────────────────────────────────────────────────────
const FISHY_DOMAINS = [
  'freemoney.com', 'hack-your-account.net', 'phishing-login.info',
  'totally-legit-update.xyz', 'malware-download.org'
];

const checkUrlBtn   = document.getElementById('check-url-btn');
const testUrlInput  = document.getElementById('test-url');
const urlResultCard = document.getElementById('url-result-card');
const urlResultTag  = document.getElementById('url-result-tag');
const urlResultDesc = document.getElementById('url-result-desc');

if (checkUrlBtn) {
  checkUrlBtn.addEventListener('click', () => {
    let urlString = (testUrlInput.value || '').trim();
    if (!urlString) return;
    if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
      urlString = 'https://' + urlString;
    }
    if (urlResultCard) urlResultCard.classList.add('show');
    try {
      const domain  = new URL(urlString).hostname.toLowerCase();
      const isFishy = FISHY_DOMAINS.some(f => domain === f || domain.endsWith('.' + f));
      if (isFishy) {
        urlResultTag.textContent  = 'Danger';
        urlResultTag.className    = 'result-tag toxic';
        urlResultDesc.textContent = `${domain} is flagged as malicious.`;
      } else {
        urlResultTag.textContent  = 'Safe';
        urlResultTag.className    = 'result-tag safe';
        urlResultDesc.textContent = `${domain} appears to be safe.`;
      }
    } catch {
      urlResultTag.textContent      = 'Invalid';
      urlResultTag.className        = 'result-tag';
      urlResultTag.style.background = 'var(--raised)';
      urlResultTag.style.color      = 'var(--text-2)';
      urlResultDesc.textContent     = 'Please enter a valid URL.';
    }
  });
}

// ── SETTINGS (slider / toggles) ───────────────────────────────────────────────
// Restore saved settings
chrome.storage.local.get(['threshold', 'autoBlur', 'showConfidence'], (data) => {
  if (chrome.runtime.lastError) return;
  const slider           = document.getElementById('slider');
  const thresholdVal     = document.getElementById('threshold-val');
  const blurToggleEl     = document.getElementById('auto-blur');
  const confidenceToggle = document.getElementById('show-confidence');

  if (slider && data.threshold !== undefined) {
    slider.value = data.threshold;
    if (thresholdVal) thresholdVal.textContent = parseFloat(data.threshold).toFixed(2);
  }
  if (blurToggleEl     && data.autoBlur       !== undefined) blurToggleEl.checked     = data.autoBlur;
  if (confidenceToggle && data.showConfidence  !== undefined) confidenceToggle.checked = data.showConfidence;
});

const sliderEl = document.getElementById('slider');
if (sliderEl) {
  sliderEl.addEventListener('input', e => {
    const val     = e.target.value;
    const display = document.getElementById('threshold-val');
    if (display) display.textContent = parseFloat(val).toFixed(2);
    chrome.storage.local.set({ threshold: val });
  });
}

const blurToggleEl = document.getElementById('auto-blur');
if (blurToggleEl) {
  blurToggleEl.addEventListener('change', e => {
    chrome.storage.local.set({ autoBlur: e.target.checked });
  });
}

const confToggle = document.getElementById('show-confidence');
if (confToggle) {
  confToggle.addEventListener('change', e => {
    chrome.storage.local.set({ showConfidence: e.target.checked });
  });
}

// ── INITIAL RENDER ────────────────────────────────────────────────────────────
// FIX: run immediately on script parse (popup HTML is already parsed by the time
// scripts execute, so DOMContentLoaded has already fired — use it as fallback)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', updateOverviewUI);
} else {
  updateOverviewUI();
}
