// content/linkScanner.js - SilentShield Malicious Link Module

// ── GUARD: do not run on browser internal pages ───────────────────────────────
if (window.location.protocol === 'chrome:' ||
    window.location.protocol === 'chrome-extension:' ||
    window.location.protocol === 'about:' ||
    window.location.protocol === 'edge:') {
  throw new Error('SilentShield: skipping internal page');
}

const FISHY_DOMAINS = [
  'freemoney.com', 'hack-your-account.net', 'phishing-login.info',
  'totally-legit-update.xyz', 'malware-download.org'
];

// ── EXTENSION CONTEXT GUARD ───────────────────────────────────────────────────
function isChromeAlive() {
  try { return !!chrome.runtime?.id; } catch { return false; }
}

// ── STORAGE HELPERS ───────────────────────────────────────────────────────────
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

async function recordFishyLink() {
  if (!isChromeAlive()) return;
  const data = await storageGet(['toxicCount', 'blurCount', 'inferenceCount']);
  await storageSet({
    toxicCount:     (data.toxicCount     || 0) + 1,
    blurCount:      (data.blurCount      || 0) + 1,
    inferenceCount: (data.inferenceCount || 0) + 1,
  });
}

async function recordScanned() {
  if (!isChromeAlive()) return;
  const data = await storageGet(['inferenceCount']);
  await storageSet({ inferenceCount: (data.inferenceCount || 0) + 1 });
}

// ── STYLES ────────────────────────────────────────────────────────────────────
function injectLinkStyles() {
  if (document.getElementById('silentshield-link-styles')) return;
  const target = document.head || document.documentElement;
  if (!target) return;

  const style = document.createElement('style');
  style.id = 'silentshield-link-styles';
  style.textContent = `
    .silentshield-fishy-link {
      filter: blur(5px) !important;
      transition: filter 0.3s ease !important;
      background-color: rgba(224, 92, 110, 0.2) !important;
      border-bottom: 2px dashed #e05c6e !important;
      pointer-events: auto !important;
    }
    .silentshield-fishy-link:hover { filter: blur(2px) !important; }
    .silentshield-warning-popup {
      position: fixed; top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: #181c20; border: 1px solid #e05c6e;
      border-radius: 8px; padding: 20px; z-index: 999999;
      color: #dde4ec; font-family: 'IBM Plex Sans', sans-serif;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      text-align: center; max-width: 400px;
    }
    .silentshield-popup-btn {
      margin-top: 15px; padding: 8px 16px; border: none;
      border-radius: 4px; cursor: pointer; font-weight: 500; margin-right: 10px;
    }
    .btn-safe   { background: #34c77b; color: #111416; }
    .btn-danger { background: transparent; border: 1px solid #e05c6e; color: #e05c6e; }
  `;
  target.appendChild(style);
}

// ── URL CHECK ─────────────────────────────────────────────────────────────────
function checkUrl(url) {
  try {
    const domain = new URL(url).hostname.toLowerCase();
    return FISHY_DOMAINS.some(fishy => domain === fishy || domain.endsWith('.' + fishy));
  } catch { return false; }
}

// ── WARNING POPUP ─────────────────────────────────────────────────────────────
function showWarningPopup(url) {
  // FIX: body guard — never call appendChild if body doesn't exist yet
  if (!document.body) return;

  // Remove any existing overlay first to avoid stacking
  const existing = document.getElementById('ss-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'ss-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(17,20,22,0.8); z-index:999998;';

  const popup = document.createElement('div');
  popup.className = 'silentshield-warning-popup';
  popup.innerHTML = `
    <h3 style="color:#e05c6e; margin-bottom:10px;">⚠️ Suspicious Link Detected</h3>
    <p style="font-size:13px; color:#6b7e93; margin-bottom:15px;">
      SilentShield has flagged this URL as potentially dangerous or deceptive:
    </p>
    <code style="display:block; background:#111416; padding:8px; border-radius:4px;
      word-break:break-all; margin-bottom:15px; color:#d4913a;">
      ${url}
    </code>
    <button class="silentshield-popup-btn btn-safe ss-go-back">Go Back (Safe)</button>
    <button class="silentshield-popup-btn btn-danger ss-proceed">Proceed Anyway</button>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  popup.querySelector('.ss-go-back').onclick  = () => overlay.remove();
  popup.querySelector('.ss-proceed').onclick  = () => { overlay.remove(); window.location.href = url; };
}

// ── LINK SCAN ─────────────────────────────────────────────────────────────────
function scanLinks() {
  if (!isChromeAlive()) return;
  const links = document.querySelectorAll('a[href]:not([data-ss-link-scanned])');
  links.forEach(link => {
    link.dataset.ssLinkScanned = 'true';
    const href = link.href;
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) return;

    if (checkUrl(href)) {
      link.classList.add('silentshield-fishy-link');
      recordFishyLink();
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showWarningPopup(href);
      }, true);
    } else {
      recordScanned();
    }
  });
}

// ── INIT ──────────────────────────────────────────────────────────────────────
function initLinkScanner() {
  injectLinkStyles();
  // FIX: only scan immediately if body exists, otherwise wait for DOMContentLoaded
  if (document.body) {
    scanLinks();
  }

  let debounceTimer = null;
  const obs = new MutationObserver(() => {
    if (!isChromeAlive()) { obs.disconnect(); return; }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(scanLinks, 500);
  });

  // FIX: observe documentElement (always exists), not body (may be null at document_start)
  obs.observe(document.documentElement, { childList: true, subtree: true });
}

// FIX: always safe to call initLinkScanner — body guard is inside each function
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLinkScanner);
} else {
  initLinkScanner();
}
