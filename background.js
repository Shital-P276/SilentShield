// Silent Shield Background Service Worker
console.log('🛡️ Silent Shield: Service Worker Active');

// Initialize on install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🛡️ Silent Shield: Fresh install');
  }
  
  // Create context menu for text selection
  chrome.contextMenus.create({
    id: "silentShieldAnalyze",
    title: "🛡️ Silent Shield: Scan Selection",
    contexts: ["selection"],
    documentUrlPatterns: ["<all_urls>"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Context menu failed:', chrome.runtime.lastError);
    }
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "silentShieldAnalyze") {
    // Notify popup/content script
    chrome.tabs.sendMessage(tab.id, {
      action: "silentShieldScan",
      text: info.selectionText,
      tabId: tab.id
    });
    
    // Visual feedback
    chrome.action.setBadgeText({ 
      text: 'AI', 
      tabId: tab.id 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#ff6b6b', 
      tabId: tab.id 
    });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  }
});

// Message listener for popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getShieldStatus':
      chrome.storage.local.get([
        'modelReady', 
        'scanCount', 
        'shieldActive'
      ], (result) => {
        sendResponse({
          modelReady: result.modelReady || false,
          scanCount: result.scanCount || 0,
          shieldActive: result.shieldActive !== false
        });
      });
      return true; // Async response
      
    case 'updateStats':
      chrome.storage.local.set({
        scanCount: (request.scanCount || 0),
        lastScan: Date.now()
      });
      break;
      
    case 'toggleShield':
      chrome.storage.local.set({
        shieldActive: request.active
      });
      break;
  }
});