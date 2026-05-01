// content/linkScanner.js - SilentShield Malicious Link Module

const FISHY_DOMAINS = [
  'freemoney.com', 'hack-your-account.net', 'phishing-login.info', 
  'totally-legit-update.xyz', 'malware-download.org'
]; // In a real scenario, you'd fetch this from a dynamic API or background script

const LINK_CATEGORIES = {
  phishing: { weight: 0.9 },
  malware: { weight: 0.95 },
  suspicious: { weight: 0.6 }
};

function injectLinkStyles() {
  if (document.getElementById('silentshield-link-styles')) return;
  const style = document.createElement('style');
  style.id = 'silentshield-link-styles';
  style.textContent = `
    .silentshield-fishy-link {
      filter: blur(5px) !important;
      transition: filter 0.3s ease !important;
      background-color: rgba(224, 92, 110, 0.2) !important; /* Matches your danger-muted theme */
      border-bottom: 2px dashed #e05c6e !important;
      pointer-events: auto !important; 
    }
    .silentshield-fishy-link:hover {
      filter: blur(2px) !important;
    }
    .silentshield-warning-popup {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: #181c20; /* Matches your surface var */
      border: 1px solid #e05c6e;
      border-radius: 8px;
      padding: 20px;
      z-index: 999999;
      color: #dde4ec;
      font-family: 'IBM Plex Sans', sans-serif;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      text-align: center;
      max-width: 400px;
    }
    .silentshield-popup-btn {
      margin-top: 15px;
      padding: 8px 16px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      margin-right: 10px;
    }
    .btn-safe { background: #34c77b; color: #111416; }
    .btn-danger { background: transparent; border: 1px solid #e05c6e; color: #e05c6e; }
  `;
  document.head.appendChild(style);
  console.log("🛡️ SilentShield: Link styles injected");
}

function checkUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname.toLowerCase();
    
    // Check if the domain ends with or exactly matches any in our list
    const isFishy = FISHY_DOMAINS.some(fishy => domain === fishy || domain.endsWith('.' + fishy));
    return isFishy;
  } catch (e) {
    return false; // Invalid URLs are ignored
  }
}

function showWarningPopup(url, originalEvent) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed; inset:0; background:rgba(17, 20, 22, 0.8); z-index:999998;';
  
  const popup = document.createElement('div');
  popup.className = 'silentshield-warning-popup';
  
  popup.innerHTML = `
    <h3 style="color: #e05c6e; margin-bottom: 10px;">⚠️ Suspicious Link Detected</h3>
    <p style="font-size: 13px; color: #6b7e93; margin-bottom: 15px;">
      SilentShield has flagged this URL as potentially dangerous or deceptive:
    </p>
    <code style="display:block; background:#111416; padding:8px; border-radius:4px; word-break:break-all; margin-bottom:15px; color:#d4913a;">
      ${url}
    </code>
    <button class="silentshield-popup-btn btn-safe" id="ss-go-back">Go Back (Safe)</button>
    <button class="silentshield-popup-btn btn-danger" id="ss-proceed">Proceed Anyway</button>
  `;

  overlay.appendChild(popup);
  document.body.appendChild(overlay);

  document.getElementById('ss-go-back').onclick = () => {
    document.body.removeChild(overlay);
  };

  document.getElementById('ss-proceed').onclick = () => {
    document.body.removeChild(overlay);
    window.location.href = url; // Proceed if user forces it
  };
}

function scanLinks() {
  const links = document.querySelectorAll('a[href]:not([data-ss-link-scanned])');
  
  links.forEach(link => {
    link.dataset.ssLinkScanned = "true";
    const href = link.href;

    if (checkUrl(href)) {
      link.classList.add('silentshield-fishy-link');
      
      // Override the click behavior
      link.addEventListener('click', (e) => {
        e.preventDefault(); // Stop them from navigating immediately
        e.stopPropagation();
        showWarningPopup(href, e);
      }, true); // Capture phase to ensure we intercept before other scripts
    }
  });
}

function initLinkScanner() {
  injectLinkStyles();
  
  // Initial scan
  setTimeout(scanLinks, 1000);
  
  // Observe for new links (e.g., infinite scrolling search results)
  new MutationObserver(scanLinks).observe(document.body, { childList: true, subtree: true });
}

initLinkScanner();