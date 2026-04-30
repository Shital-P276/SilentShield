// SilentShield Background Service Worker v6.0
// Lightweight: only handles storage relay and badge updates
// AI model is loaded in content script to avoid CSP issues

'use strict';

const PREFIX = '[SilentShield BG]';
const log = (...a) => console.log(PREFIX, ...a);

// ─── BADGE HELPERS ──────────────────────────────────────────────────────────
function updateBadge(tabId, count) {
  try {
    if (count > 0) {
      chrome.action.setBadgeText({ text: String(count), tabId });
      chrome.action.setBadgeBackgroundColor({ color: '#e94560', tabId });
    } else {
      chrome.action.setBadgeText({ text: '', tabId });
    }
  } catch (e) {}
}

// ─── MESSAGE HANDLER ────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  const tabId = sender.tab?.id;

  if (msg.type === 'STATS_UPDATE') {
    log('Stats update from tab', tabId, msg.stats);
    updateBadge(tabId, msg.stats.flagged || 0);

    // Persist stats per tab
    if (tabId) {
      chrome.storage.local.set({ [`ssStats_${tabId}`]: msg.stats });
    }
    sendResponse({ ok: true });
  }

  if (msg.type === 'MODEL_READY') {
    log('toxic-bert model ready in tab', tabId);
    sendResponse({ ok: true });
  }

  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get('ssSettings', (result) => {
      sendResponse({ settings: result.ssSettings || {} });
    });
    return true; // async
  }

  if (msg.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ ssSettings: msg.settings }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }

  return true;
});

// ─── TAB EVENTS ─────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    updateBadge(tabId, 0);
  }
});

log('Background service worker started');
