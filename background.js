// background.js - SilentShield AI Pro - Unified Service Worker
import { shield } from './linkguard.js';

console.log('🛡️ SilentShield AI Pro: Service Worker Active');

// ── BLOCKLIST CONFIG ──
const DB_URL = "https://raw.githubusercontent.com/StevenBlack/hosts/master/alternates/porn/hosts";
const MAX_RULES = 4500;
const BLOCKED_KEYWORDS = [
  'xhamster', 'xnxx', 'eporner', 'nhentai', 'thumbzilla', 'pornhub',
  'free-hack', 'cracked-accounts'
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

    console.log(`🛡️ SilentShield: Parsed ${domains.length} domains.`);

    const domainRules = domains.slice(0, MAX_RULES).map((domain, index) => ({
      id: index + 1,
      priority: 1,
      action: { type: "redirect", redirect: { extensionPath: "/warning.html" } },
      condition: { urlFilter: "||" + domain, resourceTypes: ["main_frame"] }
    }));

    const keywordRules = BLOCKED_KEYWORDS.map((keyword, index) => ({
      id: 100000 + index,
      priority: 2,
      action: { type: "redirect", redirect: { extensionPath: "/warning.html" } },
      condition: { urlFilter: keyword, resourceTypes: ["main_frame"] }
    }));

    const allNewRules = [...domainRules, ...keywordRules];
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

// ── INITIALIZATION ──
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🛡️ SilentShield: Fresh install');
  }

  // Init AI models
  shield.init();

  // Setup Context Menu
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

  // Fetch blocklist
  fetchAndApplyBlocklist();

  // Daily sync alarm
  chrome.alarms.create("syncDatabase", { periodInMinutes: 1440 });
});

// ── ALARMS ──
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "syncDatabase") {
    fetchAndApplyBlocklist();
  }
});

// ── CONTEXT MENU ──
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

// ── MESSAGE HANDLER ──
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

  // F1: AI text analysis via ShieldAI
  if (request.action === "analyzeText") {
    shield.analyzeText(request.text).then(sendResponse);
    return true;
  }

  // F1: AI image/NSFW analysis via ShieldAI
  if (request.action === "analyzeImage") {
    shield.analyzeImage(request.imgUrl).then(sendResponse);
    return true;
  }

  // F1: Typing warning — trigger speech + modal in content script
  if (request.action === "typingWarning") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: () => {
        const msg = "Warning: You are typing abusive language.";
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.rate = 0.85;
        window.speechSynthesis.speak(utterance);
        if (typeof window.showAttractiveWarning === "function") {
          window.showAttractiveWarning();
        } else {
          alert(msg);
        }
      }
    });
    return;
  }

  // F2: Dashboard / stats messages
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
      chrome.storage.local.set({
        toxicCount: 0, blurCount: 0, inferenceCount: 0,
        detectedHistory: [], dailyTrends: {}
      }, () => sendResponse({ success: true }));
      return true;

    case 'updateStats':
      chrome.storage.local.set({ scanCount: (request.scanCount || 0), lastScan: Date.now() });
      break;

    case 'toggleShield':
      chrome.storage.local.set({ shieldActive: request.active });
      break;

    case 'FORCE_SYNC':
      fetchAndApplyBlocklist().then(() => sendResponse({ status: "success" }));
      return true;
  }
});
