// content.js - SilentShield AI Pro

// ── EXTENSION CONTEXT GUARD ───────────────────────────────────────────────────
function isChromeAlive() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// ── CONFIGURATION ─────────────────────────────────────────────────────────────
const SUBSTRING_LIST = ['fuck','shit','bitch','asshole','stupid','idiot','nude','porn','naked'];
let isModalOpen = false;

// ── IN-MEMORY COUNTERS (avoids get/set race condition) ────────────────────────
// Loaded from storage on init, then kept in sync locally and flushed on change
let _toxicCount     = 0;
let _blurCount      = 0;
let _inferenceCount = 0;

function flushStats() {
  if (!isChromeAlive()) return;
  chrome.storage.local.set({
    toxicCount:     _toxicCount,
    blurCount:      _blurCount,
    inferenceCount: _inferenceCount,
  }, () => { void chrome.runtime?.lastError; });
}

function recordBlur() {
  _toxicCount++;
  _blurCount++;
  _inferenceCount++;
  flushStats();
}

function recordScan() {
  // called once per unique element scanned (not blurred)
  _inferenceCount++;
  flushStats();
}

// ── SPEECH & MODAL ────────────────────────────────────────────────────────────
function speak(msg) {
  if (window.speechSynthesis.speaking) return;
  const u = new SpeechSynthesisUtterance(msg);
  u.rate = 0.85;
  window.speechSynthesis.speak(u);
}

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
          Silent Shield AI has obscured restricted material to protect your experience.
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

// ── CORE ENGINE ───────────────────────────────────────────────────────────────
function applyShield() {
  if (isModalOpen) return;
  if (!isChromeAlive()) return;

  // ── TEXT ──
  document.querySelectorAll(
    'p, span, h1, h2, h3, li, a, b, strong, [data-testid="tweetText"]'
  ).forEach(el => {
    // FIX: use data attribute as processed flag — class check alone has race risk
    if (el.dataset.ssScanned) return;
    el.dataset.ssScanned = '1';
    recordScan(); // count every unique element scanned

    const text = (el.innerText || '').toLowerCase();
    if (SUBSTRING_LIST.some(word => text.includes(word))) {
      el.classList.add('silent-shield-blur');
      recordBlur(); // count as toxic + blurred
      el.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        speak('Warning: This section contains restricted content.');
        window.showAttractiveWarning();
      }, true);
    }
  });

  // ── MEDIA ──
  document.querySelectorAll(
    'img, video, shreddit-player, [data-testid="post-container"] video, .mG61Hc, div[data-ri] img'
  ).forEach(media => {
    if (media.dataset.ssScanned) return;
    media.dataset.ssScanned = '1';
    recordScan();

    const mediaUrl = (media.src || media.poster || '').toLowerCase();
    const mediaAlt = (media.alt || '').toLowerCase();
    const isAbusive = SUBSTRING_LIST.some(w => mediaUrl.includes(w) || mediaAlt.includes(w));
    const isAbusiveSearch =
      window.location.href.includes('tbm=isch') &&
      SUBSTRING_LIST.some(w => document.title.toLowerCase().includes(w));

    if (isAbusive || isAbusiveSearch) {
      media.classList.add('silent-shield-blur');
      recordBlur();
      speak('Warning: Restricted visual content detected.');
      window.showAttractiveWarning();
      return; // no need for AI check if already blurred
    }

    // Deep AI check — only if model is confirmed ready to avoid port-closed spam
    if (!mediaUrl.startsWith('http')) return;
    if (!isChromeAlive()) return;

    // FIX: check model readiness before sending analyzeImage
    // This prevents "message port closed" when the AI isn't loaded yet
    chrome.storage.local.get(['modelReady'], (data) => {
      if (chrome.runtime.lastError || !data.modelReady) return;
      chrome.runtime.sendMessage({ action: 'analyzeImage', imgUrl: mediaUrl }, (res) => {
        void chrome.runtime?.lastError; // always consume to suppress unchecked warning
        if (res && res.isExplicit && !media.classList.contains('silent-shield-blur')) {
          media.classList.add('silent-shield-blur');
          recordBlur();
          window.showAttractiveWarning();
        }
      });
    });
  });
}

// ── RESET HANDLER ─────────────────────────────────────────────────────────────
if (isChromeAlive()) {
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'RESET_COUNTERS') {
      _toxicCount = 0; _blurCount = 0; _inferenceCount = 0;
      flushStats();
      document.querySelectorAll('.silent-shield-blur').forEach(el => {
        el.classList.remove('silent-shield-blur');
        delete el.dataset.ssScanned; // allow re-scan after reset
      });
      document.querySelectorAll('[data-ss-scanned]').forEach(el => delete el.dataset.ssScanned);
      applyShield();
    }
  });
}

// ── TYPING DETECTION ──────────────────────────────────────────────────────────
document.addEventListener('input', (e) => {
  if (!isChromeAlive()) return;
  const text = (e.target.value || '').toLowerCase();
  if (SUBSTRING_LIST.some(w => text.includes(w)) && text.length > 8) {
    chrome.runtime.sendMessage({ action: 'typingWarning' }, () => {
      void chrome.runtime?.lastError;
    });
  }
});

// ── MONITORING ────────────────────────────────────────────────────────────────
// FIX: debounced MutationObserver — prevents applyShield firing on every DOM
// micro-change (which was re-queuing hundreds of analyzeImage messages)
let mutationTimer = null;
const observer = new MutationObserver(() => {
  if (!isChromeAlive()) { observer.disconnect(); return; }
  clearTimeout(mutationTimer);
  mutationTimer = setTimeout(applyShield, 300);
});
observer.observe(document.documentElement, { childList: true, subtree: true });

const shieldInterval = setInterval(() => {
  if (!isChromeAlive()) { clearInterval(shieldInterval); return; }
  applyShield();
}, 2000);

// ── INIT ──────────────────────────────────────────────────────────────────────
// Load existing counts from storage into memory before first scan
chrome.storage.local.get(['toxicCount', 'blurCount', 'inferenceCount'], (data) => {
  if (chrome.runtime.lastError) return;
  _toxicCount     = data.toxicCount     || 0;
  _blurCount      = data.blurCount      || 0;
  _inferenceCount = data.inferenceCount || 0;
  applyShield(); // first scan after counts are loaded
});
