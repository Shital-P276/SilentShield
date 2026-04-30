const SUBSTRING_LIST = ["fuck", "bitch", "asshole", "shit", "cunt", "nude", "porn", "naked"];

function speak(msg) {
  const utterance = new SpeechSynthesisUtterance(msg);
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

// NEW: Function to create an attractive custom modal
function showAttractiveWarning() {
  // Remove existing modal if it exists
  const existing = document.getElementById('shield-warning-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'shield-warning-modal';
  modal.innerHTML = `
    <div class="shield-modal-content">
      <div class="shield-icon">🛡️</div>
      <h2>Content Blocked</h2>
      <p>Silent Shield AI has identified and obscured abusive material on this page to protect your browsing experience.</p>
      <button id="close-shield-modal">Dismiss</button>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('close-shield-modal').onclick = () => {
    modal.style.opacity = '0';
    setTimeout(() => modal.remove(), 300);
  };
}

async function applyShield() {
  document.querySelectorAll('p, span, h1, h2, li, img').forEach(el => {
    const content = (el.innerText || el.alt || "").toLowerCase();
    const hasAbuse = SUBSTRING_LIST.some(word => content.includes(word));
    
    if (hasAbuse && !el.classList.contains('silent-shield-blur')) {
      el.classList.add('silent-shield-blur');
      
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        speak("Warning: You are viewing abusive content.");
        showAttractiveWarning(); // Use the new attractive modal
      };
    }
  });

  document.querySelectorAll('img:not([data-shield-checked])').forEach(img => {
    img.dataset.shieldChecked = "pending";
    chrome.runtime.sendMessage({ action: "analyzeImage", imgUrl: img.src }, (res) => {
      if (res && res.isExplicit) {
        img.classList.add('silent-shield-blur');
      }
      img.dataset.shieldChecked = "true";
    });
  });
}

document.addEventListener('input', (e) => {
  const text = e.target.value?.toLowerCase() || "";
  if (SUBSTRING_LIST.some(word => text.includes(word)) && text.length > 8) {
    chrome.runtime.sendMessage({ action: "typingWarning" });
  }
});

setInterval(applyShield, 1500);