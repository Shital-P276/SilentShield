// warning.js - SilentShield Warning Page Logic

document.addEventListener('DOMContentLoaded', () => {
  // 1. SAFE URL DISPLAY LOGIC
  try {
    const urlBox = document.getElementById('blocked-url');
    const params = new URLSearchParams(window.location.search);
    const blockedParam = params.get('blocked');

    if (blockedParam) {
      urlBox.textContent = decodeURIComponent(blockedParam);
    } else if (document.referrer && document.referrer !== window.location.href) {
      // Only show referrer if it's readable and not the warning page itself
      urlBox.textContent = document.referrer;
    }
  } catch (e) {
    console.warn("SilentShield: Could not read source URL.", e);
  }

  // 2. ESCAPE HATCH LOGIC (Open new tab, close current)
  document.getElementById('back-btn').addEventListener('click', () => {
    // 1. Open Google securely in a new tab
    window.open('https://www.google.com', '_blank', 'noopener,noreferrer');
    
    // 2. Immediately close this blocked tab
    window.close();
    
    // 3. Fallback: If the browser refuses to close the tab (which happens if the user 
    // didn't directly open it), redirect the current page to Google.
    setTimeout(() => {
      window.location.replace('https://www.google.com');
    }, 150);
  });
});