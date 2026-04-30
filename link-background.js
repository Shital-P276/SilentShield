// Silent Shield LinkGuard Background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'linkguardScan') {
    chrome.action.setPopup({popup: 'link-popup.html'});
    chrome.action.openPopup();
  }
});