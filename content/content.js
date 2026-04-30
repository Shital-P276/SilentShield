// content/content.js - SilentShield v4.3 Aggressive (Working Base)
let threshold = 0.75;
let autoBlurEnabled = true;

let toxicCount = 0;
let blurCount = 0;

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

  toxicKeywords.forEach(word => {
    if (lower.includes(word)) score += 0.35;
  });

  if (text.length < 150 && /fuck|kys|retard|bitch/i.test(lower)) score += 0.4;
  if (text.length > 300) score *= 0.7;

  return Math.min(0.96, score);
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

  const score = calculateToxicityScore(text);
  if (score > threshold) {
    console.log(`🔴 Flagged (${score.toFixed(2)}): ${text.substring(0, 70)}...`);
    toxicCount++;
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

    // Persist counts so popup can read them
    chrome.storage.local.set({ toxicCount, blurCount });
  }
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
  injectGlobalStyles();

  console.log("%c🚀 SilentShield v4.3 - Aggressive Detection (Stable)", "color:#10b981; font-weight:bold");

  setTimeout(scanContent, 1500);
  setInterval(scanContent, 5000);

  new MutationObserver(scanContent).observe(document.body, { childList: true, subtree: true });
}

init();