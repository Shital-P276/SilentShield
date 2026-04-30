// SilentShield Popup v6.0

const log = (...a) => console.log('[SS Popup]', ...a);

// ─── DOM REFS ────────────────────────────────────────────────────────────────
const els = {
  enabled: document.getElementById('toggle-enabled'),
  autoBlur: document.getElementById('toggle-autoblur'),
  sensitivity: document.getElementById('sensitivity-slider'),
  sensitivityVal: document.getElementById('sensitivity-val'),
  scanned: document.getElementById('stat-scanned'),
  flagged: document.getElementById('stat-flagged'),
  revealed: document.getElementById('stat-revealed'),
  safetyScore: document.getElementById('safety-score'),
  safetyLabel: document.getElementById('safety-label'),
  modelStatus: document.getElementById('model-status'),
  rescanBtn: document.getElementById('btn-rescan'),
  resetBtn: document.getElementById('btn-reset'),
  platformBadge: document.getElementById('platform-badge'),
};

let currentSettings = {
  enabled: true,
  autoBlur: true,
  sensitivity: 0.5,
};

// ─── SETTINGS ────────────────────────────────────────────────────────────────
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get('ssSettings', (r) => {
      if (r.ssSettings) currentSettings = { ...currentSettings, ...r.ssSettings };
      resolve();
    });
  });
}

function saveSettings() {
  chrome.storage.local.set({ ssSettings: currentSettings });
  // Push to active content script
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'UPDATE_SETTINGS',
        settings: currentSettings,
      }).catch(() => {});
    }
  });
}

function applySettingsToUI() {
  if (els.enabled) els.enabled.checked = currentSettings.enabled;
  if (els.autoBlur) els.autoBlur.checked = currentSettings.autoBlur;
  if (els.sensitivity) {
    els.sensitivity.value = currentSettings.sensitivity * 100;
    if (els.sensitivityVal) els.sensitivityVal.textContent = Math.round(currentSettings.sensitivity * 100) + '%';
  }
}

// ─── STATS ───────────────────────────────────────────────────────────────────
function updateStatsUI(stats) {
  if (!stats) return;
  if (els.scanned) els.scanned.textContent = stats.scanned || 0;
  if (els.flagged) els.flagged.textContent = stats.flagged || 0;
  if (els.revealed) els.revealed.textContent = stats.revealed || 0;

  // Safety score: 0 flagged = 100%, proportional
  const total = stats.scanned || 1;
  const flagged = stats.flagged || 0;
  const score = Math.max(0, Math.round((1 - flagged / total) * 100));

  if (els.safetyScore) els.safetyScore.textContent = score + '%';
  if (els.safetyLabel) {
    if (score >= 90) {
      els.safetyLabel.textContent = 'Safe Environment';
      els.safetyLabel.className = 'safe';
    } else if (score >= 70) {
      els.safetyLabel.textContent = 'Moderate Risk';
      els.safetyLabel.className = 'moderate';
    } else {
      els.safetyLabel.textContent = 'High Toxicity';
      els.safetyLabel.className = 'danger';
    }
  }
}

async function fetchStats() {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]?.id) return resolve(null);
      chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATS' }, (res) => {
        if (chrome.runtime.lastError) return resolve(null);
        resolve(res);
      });
    });
  });
}

// ─── PLATFORM DETECTION ──────────────────────────────────────────────────────
function detectPlatform(url) {
  if (!url) return null;
  if (url.includes('reddit.com')) return 'Reddit';
  if (url.includes('x.com') || url.includes('twitter.com')) return 'X / Twitter';
  return null;
}

// ─── EVENT LISTENERS ─────────────────────────────────────────────────────────
function bindEvents() {
  if (els.enabled) {
    els.enabled.addEventListener('change', () => {
      currentSettings.enabled = els.enabled.checked;
      saveSettings();
    });
  }

  if (els.autoBlur) {
    els.autoBlur.addEventListener('change', () => {
      currentSettings.autoBlur = els.autoBlur.checked;
      saveSettings();
    });
  }

  if (els.sensitivity) {
    els.sensitivity.addEventListener('input', () => {
      const val = els.sensitivity.value / 100;
      currentSettings.sensitivity = val;
      if (els.sensitivityVal) els.sensitivityVal.textContent = els.sensitivity.value + '%';
      saveSettings();
    });
  }

  if (els.rescanBtn) {
    els.rescanBtn.addEventListener('click', () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          chrome.tabs.sendMessage(tabs[0].id, { type: 'RESCAN' }).catch(() => {});
        }
      });
      els.rescanBtn.textContent = 'Rescanning...';
      setTimeout(() => {
        els.rescanBtn.textContent = '🔄 Rescan Page';
        fetchStats().then(updateStatsUI);
      }, 2000);
    });
  }

  if (els.resetBtn) {
    els.resetBtn.addEventListener('click', () => {
      chrome.storage.local.remove(['ssStats']);
      updateStatsUI({ scanned: 0, flagged: 0, revealed: 0 });
    });
  }
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
async function init() {
  await loadSettings();
  applySettingsToUI();
  bindEvents();

  // Get current tab info
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];
    if (!tab) return;

    const platform = detectPlatform(tab.url);
    if (els.platformBadge) {
      if (platform) {
        els.platformBadge.textContent = platform;
        els.platformBadge.style.display = 'inline-block';
      } else {
        els.platformBadge.textContent = 'Unsupported Site';
        els.platformBadge.style.opacity = '0.5';
      }
    }

    const res = await fetchStats();
    if (res) {
      updateStatsUI(res.stats);
      if (els.modelStatus) {
        els.modelStatus.textContent = res.modelReady ? '✅ AI Model Active' : '⚡ Keyword Mode';
        els.modelStatus.className = res.modelReady ? 'model-ready' : 'model-fallback';
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
