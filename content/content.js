// content/content.js - SilentShield v5.0 (Real toxic-bert Integration)
let threshold = 0.75;
let autoBlurEnabled = true;
let isModelReady = false;

async function loadSettings() {
  const data = await chrome.storage.local.get(['threshold', 'autoBlur']);
  if (data.threshold !== undefined) threshold = data.threshold;
  if (data.autoBlur !== undefined) autoBlurEnabled = data.autoBlur;
}

function injectGlobalStyles() {
  if (document.getElementById('silentshield-styles')) return;
  const style = document.createElement('style');
  style.id = 'silentshield-styles';
  style.textContent = `
    .silentshield-toxic, .silentshield-toxic * { filter: blur(7px) !important; transition: filter 0.4s ease !important; }
    .silentshield-toxic { border: 3px solid #ef4444 !important; border-radius: 8px !important; position: relative !important; }
  `;
  document.head.appendChild(style);
}

async function getToxicityScore(text) {
  if (!text || text.length < 30) return 0;

  try {
    const response = await chrome.runtime.sendMessage({
      action: "ANALYZE_TOXICITY",
      text: text
    });

    if (response && typeof response.score === 'number') {
      isModelReady = true;
      return response.score;
    }
  } catch (e) {
    console.warn("Model not ready yet, using fallback");
  }

  // Fallback to keyword method
  const lower = text.toLowerCase();
  let score = 0.1;
  const keywords = ["fuck","fucking","shit","bitch","asshole","cunt","kys","retard"];
  keywords.forEach(w => { if (lower.includes(w)) score += 0.35; });
  return Math.min(0.95, score);
}

function findComments() {
  const candidates = [];
  document.querySelectorAll('shreddit-comment').forEach(el => candidates.push(el));
  document.querySelectorAll('div[id^="t1_"], faceplate-comment').forEach(el => candidates.push(el));
  return candidates;
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

  getToxicityScore(text).then(score => {
    if (score > threshold) {
      console.log(`🔴 AI Flagged (${(score*100).toFixed(1)}%): ${text.substring(0,70)}...`);

      element.classList.add('silentshield-toxic');

      if (autoBlurEnabled) {
        const revealBtn = document.createElement('button');
        revealBtn.textContent = "👁️ Reveal";
        revealBtn.style.cssText = `position:absolute; bottom:-26px; left:50%; transform:translateX(-50%); background:#1f2937; color:white; border:2px solid #ef4444; padding:6px 16px; border-radius:9999px; z-index:200; cursor:pointer;`;

        revealBtn.onclick = (e) => {
          e.stopPropagation();
          element.classList.remove('silentshield-toxic');
          revealBtn.remove();
        };

        element.style.position = 'relative';
        element.appendChild(revealBtn);
      }
    }
  });
}

let scanTimeout = null;
function scanContent() {
  if (scanTimeout) clearTimeout(scanTimeout);
  scanTimeout = setTimeout(() => {
    const items = findComments();
    console.log(`🔍 Scanning ${items.length} items`);
    items.forEach(protectComment);
  }, 1200);
}

async function init() {
  await loadSettings();
  injectGlobalStyles();

  console.log("%c🚀 SilentShield v5.0 - Real toxic-bert Integration", "color:#10b981; font-weight:bold");

  setTimeout(scanContent, 2000);
  setInterval(scanContent, 6000);

  new MutationObserver(scanContent).observe(document.body, { childList: true, subtree: true });
}

init();