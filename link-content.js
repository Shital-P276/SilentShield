// Auto-protect suspicious links on pages
function highlightRiskyLinks() {
  document.querySelectorAll('a[href]').forEach(link => {
    const url = link.href;
    if (!url.startsWith('http')) return;

    const guard = window.LinkGuard || { scanURL: () => ({}) };
    const result = guard.scanURL(url);
    
    if (result.level === 'DANGER') {
      link.style.border = '3px solid #ff6b6b !important';
      link.style.background = 'rgba(255,107,107,0.3) !important';
      link.title = ` DANGER: ${result.threats.join(', ')}`;
      
      // Block click
      link.addEventListener('click', (e) => {
        e.preventDefault();
        guard.showDangerPopup(result);
        guard.speakWarning('Dangerous link blocked!', 'danger');
      });
    }
  });
}

// Run on load + dynamic
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', highlightRiskyLinks);
} else {
  highlightRiskyLinks();
}

new MutationObserver(highlightRiskyLinks).observe(document.body, {
  childList: true,
  subtree: true
});