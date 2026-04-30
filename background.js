// background.js - SilentShield Unified Service Worker
console.log('🛡️ Silent Shield: Service Worker Active');

// We use an established, open-source blocklist (Malware + Adware + Porn)
const DB_URL = "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn/hosts";
const MAX_RULES = 4500; // Chrome limits dynamic rules
const BLOCKED_KEYWORDS = [
  'xhamster', 'xnxx', 'eporner', 'nhentai', 'thumbzilla', 'pornhub',
  'free-hack', 'cracked-accounts' // You can add phishing keywords here too
];


async function fetchAndApplyBlocklist() {
  console.log("🛡️ SilentShield: Fetching latest threat database...");
  
  try {
    const response = await fetch(DB_URL);
    const text = await response.text();
    
    const lines = text.split('\n');
    const domains = [];
    
    for (let line of lines) {
      if (line.startsWith('#') || line.trim() === '') continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 2 && (parts[0] === '0.0.0.0' || parts[0] === '127.0.0.1')) {
        const domain = parts[1];
        if (domain !== 'localhost' && domain !== '0.0.0.0') {
          domains.push(domain);
        }
      }
    }

    console.log(`🛡️ SilentShield: Parsed ${domains.length} domains. Applying top ${MAX_RULES}...`);

    // 1. Generate rules for the downloaded DOMAINS
    const domainRules = domains.slice(0, MAX_RULES).map((domain, index) => {
      return {
        id: index + 1, // IDs 1 to 4500
        priority: 1,
        action: { type: "redirect", redirect: { extensionPath: "/warning.html" } },
        condition: { urlFilter: "||" + domain, resourceTypes: ["main_frame"] }
      };
    });

    // 2. Generate rules for your custom KEYWORDS
    const keywordRules = BLOCKED_KEYWORDS.map((keyword, index) => {
      return {
        id: 100000 + index, // Offset IDs so they don't clash with the domain rules
        priority: 2,        // Give keywords a slightly higher priority
        action: { type: "redirect", redirect: { extensionPath: "/warning.html" } },
        condition: { 
          urlFilter: keyword, // No '||' means this will match anywhere in the URL!
          resourceTypes: ["main_frame"] 
        }
      };
    });

    // 3. Combine both sets of rules
    const allNewRules = [...domainRules, ...keywordRules];

    // 4. Wipe old rules and apply the new combined list
    const oldRules = await chrome.declarativeNetRequest.getDynamicRules();
    const oldRuleIds = oldRules.map(rule => rule.id);

    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: oldRuleIds,
      addRules: allNewRules
    });

    console.log("✅ SilentShield: Database & Keyword Blocks synced and active!");
    chrome.storage.local.set({ lastSync: Date.now() });

  } catch (error) {
    console.error("❌ SilentShield: Failed to sync database:", error);
  }
}

// ── INITIALIZATION & LISTENERS ──

// Run on install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🛡️ Silent Shield: Fresh install');
  }
  
  // 1. Setup Context Menu
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

  // 2. Fetch the blocklist
  fetchAndApplyBlocklist();
  
  // 3. Set daily sync alarm
  chrome.alarms.create("syncDatabase", { periodInMinutes: 1440 });
});

// Handle alarms
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncDatabase") {
    fetchAndApplyBlocklist();
  }
});

// Handle context menu clicks
// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "silentShieldAnalyze") {
    chrome.tabs.sendMessage(tab.id, {
      action: "silentShieldScan",
      text: info.selectionText,
      tabId: tab.id
    });
    
    chrome.action.setBadgeText({ text: 'AI', tabId: tab.id });
    chrome.action.setBadgeBackgroundColor({ color: '#ff6b6b', tabId: tab.id });
    setTimeout(() => chrome.action.setBadgeText({ text: '' }), 3000);
  }
});

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getShieldStatus':
      chrome.storage.local.get(['modelReady','scanCount','shieldActive','toxicCount','blurCount','inferenceCount'], (result) => {
        sendResponse({
          modelReady: result.modelReady || false,
          scanCount: result.scanCount || 0,
          shieldActive: result.shieldActive !== false,
          toxicCount: result.toxicCount || 0,
          blurCount: result.blurCount || 0,
          inferenceCount: result.inferenceCount || 0
        });
      });
      return true;

    case 'getDashboardData':
      chrome.storage.local.get(['toxicCount','blurCount','inferenceCount','detectedHistory','dailyTrends','installDate'], sendResponse);
      return true;

    case 'clearAllHistory':
      chrome.storage.local.set({toxicCount: 0, blurCount: 0, inferenceCount: 0, detectedHistory: [], dailyTrends: {}}, () => sendResponse({ success: true }));
      return true;

    case 'updateStats':
      chrome.storage.local.set({scanCount: (request.scanCount || 0), lastScan: Date.now()});
      break;

    case 'toggleShield':
      chrome.storage.local.set({shieldActive: request.active});
      break;

    case 'FORCE_SYNC': // Allow popup to force a manual sync
      fetchAndApplyBlocklist().then(() => sendResponse({status: "success"}));
      return true; 
  }
});