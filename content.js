// --- CONFIGURATION ---
const SUBSTRING_LIST = ["fuck", "bitch", "asshole", "shit", "cunt", "nude", "porn", "naked"];
let isModalOpen = false;

/**
 * Triggers the authoritative voice warning.
 */
function speak(msg) {
  if (window.speechSynthesis.speaking) return; 
  const utterance = new SpeechSynthesisUtterance(msg);
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

/**
 * Injects and manages the Attractive Warning Modal.
 * State-managed to ensure it remains visible and persistent.
 */
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
    setTimeout(() => {
        modal.remove();
        isModalOpen = false; 
    }, 300);
  };
};

/**
 * Surgical Shielding Engine.
 * Targets specific text nodes to prevent "Blank Screen" syndrome.
 */
async function applyShield() {
  if (isModalOpen) return;

  // We target specific leaf-node tags instead of broad containers (like div or article)
  // to prevent the entire layout from vanishing.
  const targets = document.querySelectorAll(
    'p, span, h1, h2, h3, li, a, b, strong, em, i, [data-testid="tweetText"]'
  );
  
  targets.forEach(el => {
    // Only scan the element's own text to avoid parent containers catching child keywords
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
    }
  });

  // Media Analysis
  document.querySelectorAll('img:not([data-shield-checked]), video:not([data-shield-checked])').forEach(media => {
    media.dataset.shieldChecked = "pending";
    const mediaUrl = media.tagName === 'VIDEO' ? media.poster : media.src;
    
    // Simple substring check for media as well
    const mediaInfo = (media.alt + mediaUrl).toLowerCase();
    if (SUBSTRING_LIST.some(word => mediaInfo.includes(word))) {
        media.classList.add('silent-shield-blur');
    }

    if (mediaUrl && mediaUrl.startsWith('http')) {
      chrome.runtime.sendMessage({ action: "analyzeImage", imgUrl: mediaUrl }, (res) => {
        if (res && res.isExplicit) {
          media.classList.add('silent-shield-blur');
        }
        media.dataset.shieldChecked = "true";
      });
    }
  });
}

// Monitoring Systems
const observer = new MutationObserver(() => applyShield());
observer.observe(document.documentElement, { childList: true, subtree: true });

document.addEventListener('input', (e) => {
  const text = e.target.value?.toLowerCase() || "";
  if (SUBSTRING_LIST.some(word => text.includes(word)) && text.length > 8) {
    chrome.runtime.sendMessage({ action: "typingWarning" });
  }
});

setInterval(applyShield, 2000);
applyShield();