// content.js - SilentShield AI Pro
let isModalOpen = false;

// ── CONFIGURATION & TARGETING ──
const SUBSTRING_LIST = ['fuck','shit','bitch','asshole','stupid','idiot','nude','porn','naked'];

// ── SPEECH & MODAL ──
function speak(msg) {
  if (window.speechSynthesis.speaking) return;
  const utterance = new SpeechSynthesisUtterance(msg);
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
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
          Silent Shield AI has obscured restricted material (including specific images/videos) to protect your experience.
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

// ── CORE ENGINE ──
function applyShield() {
  if (isModalOpen) return;

  // 1. Text Targeting (Leaf nodes for surgical blur)
  const textTargets = document.querySelectorAll('p, span, h1, h2, h3, li, a, b, strong, [data-testid="tweetText"]');
  
  // 2. Platform Specific Targeting: Reddit Videos & Google Images
  const mediaTargets = document.querySelectorAll(`
    img, 
    video, 
    shreddit-player, 
    [data-testid="post-container"] video,
    .mG61Hc, 
    div[data-ri] img
  `);

  // Process Text
  textTargets.forEach(el => {
    const text = el.innerText.toLowerCase();
    if (SUBSTRING_LIST.some(word => text.includes(word)) && !el.classList.contains('silent-shield-blur')) {
      el.classList.add('silent-shield-blur');
    }
  });

  // Process Media (Reddit & Google Images)
  mediaTargets.forEach(media => {
    if (media.classList.contains('silent-shield-blur')) return;

    const mediaUrl = (media.src || media.poster || "").toLowerCase();
    const mediaAlt = (media.alt || "").toLowerCase();
    const pageTitle = document.title.toLowerCase();

    // Check if the individual media or the current Google Search context is abusive
    const isAbusiveMedia = SUBSTRING_LIST.some(word => mediaUrl.includes(word) || mediaAlt.includes(word));
    const isGoogleAbusiveSearch = window.location.href.includes("tbm=isch") && SUBSTRING_LIST.some(word => pageTitle.includes(word));

    if (isAbusiveMedia || isGoogleAbusiveSearch) {
      media.classList.add('silent-shield-blur');
      
      // Trigger warning for explicit media detection
      if (isGoogleAbusiveSearch || isAbusiveMedia) {
        speak("Warning: Restricted visual content detected.");
        window.showAttractiveWarning();
      }
    }

    // Deep AI Analysis for Images[cite: 2, 4]
    if (mediaUrl && mediaUrl.startsWith('http') && media.dataset.shieldChecked !== "true") {
      media.dataset.shieldChecked = "pending";
      chrome.runtime.sendMessage({ action: "analyzeImage", imgUrl: mediaUrl }, (res) => {
        if (res && res.isExplicit) {
          media.classList.add('silent-shield-blur');
          window.showAttractiveWarning();
        }
        media.dataset.shieldChecked = "true";
      });
    }
  });
}

// ── MONITORING ──
const observer = new MutationObserver(() => applyShield());
observer.observe(document.documentElement, { childList: true, subtree: true });

// Typing Guard[cite: 2]
document.addEventListener('input', (e) => {
  const text = e.target.value?.toLowerCase() || "";
  if (SUBSTRING_LIST.some(word => text.includes(word)) && text.length > 8) {
    chrome.runtime.sendMessage({ action: "typingWarning" });
  }
});

setInterval(applyShield, 2000);
applyShield();