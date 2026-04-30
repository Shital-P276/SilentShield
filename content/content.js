// SilentShield v6.1 - content.js
// Fixes: Reddit shadow DOM, WASM MIME type fallback, X duplicate processing

(async () => {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────
  const SS = {
    version: '6.1',
    platform: detectPlatform(),
    model: null,
    modelReady: false,
    modelLoading: false,
    processedNodes: new WeakSet(),
    processedTexts: new Set(),   // Secondary dedup by text hash for X (nodes get replaced)
    stats: { scanned: 0, flagged: 0, revealed: 0 },
    settings: { threshold: 0.7, autoBlur: true, enabled: true },
    debounceTimer: null,
    DEBOUNCE_MS: 800,
  };

  function log(...args)  { console.log('[SilentShield]', ...args); }
  function warn(...args) { console.warn('[SilentShield]', ...args); }

  function detectPlatform() {
    const h = location.hostname;
    if (h.includes('reddit.com')) return 'reddit';
    if (h.includes('twitter.com') || h.includes('x.com')) return 'x';
    return 'unknown';
  }

  // ─── Settings ─────────────────────────────────────────────────────────────
  async function loadSettings() {
    return new Promise(resolve => {
      chrome.storage.local.get(['threshold', 'autoBlur', 'enabled'], data => {
        if (data.threshold !== undefined) SS.settings.threshold = data.threshold;
        if (data.autoBlur  !== undefined) SS.settings.autoBlur  = data.autoBlur;
        if (data.enabled   !== undefined) SS.settings.enabled   = data.enabled;
        resolve();
      });
    });
  }

  // ─── Styles ───────────────────────────────────────────────────────────────
  function injectStyles() {
    if (document.getElementById('ss-styles')) return;
    const style = document.createElement('style');
    style.id = 'ss-styles';
    style.textContent = `
      .ss-blurred {
        filter: blur(6px) !important;
        transition: filter 0.2s ease;
        user-select: none;
        position: relative;
      }
      .ss-wrapper {
        position: relative;
      }
      .ss-btn-row {
        display: flex;
        gap: 8px;
        margin: 4px 0;
        z-index: 9999;
        position: relative;
      }
      .ss-btn {
        font-size: 12px;
        padding: 3px 10px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-family: sans-serif;
        font-weight: 600;
      }
      .ss-btn-reveal  { background: #e53e3e; color: #fff; }
      .ss-btn-reblur  { background: #718096; color: #fff; display: none; }
      .ss-badge {
        display: inline-block;
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 3px;
        background: #e53e3e;
        color: #fff;
        margin-left: 4px;
        font-family: sans-serif;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  // ─── AI Model ─────────────────────────────────────────────────────────────
  async function loadModel() {
    if (SS.modelReady || SS.modelLoading) return;
    SS.modelLoading = true;

    try {
      // Try local lib first (avoids CDN CSP issues)
      const libUrl = chrome.runtime.getURL('libs/transformers.min.js');
      const { pipeline, env } = await import(libUrl);

      // Point env paths to local libs so WASM/ONNX files load via extension URL
      // This is the key fix for the WASM MIME type / CSP error on Reddit
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = 1;

      // Override WASM path to use local copy if available
      const wasmBase = chrome.runtime.getURL('libs/');
      env.backends.onnx.wasm.wasmPaths = wasmBase;

      SS.model = await pipeline('text-classification', 'Xenova/toxic-bert', {
        progress_callback: (p) => {
          if (p.status === 'progress') {
            log(`Model loading: ${Math.round(p.progress || 0)}%`);
          }
        }
      });

      SS.modelReady = true;
      SS.modelLoading = false;
      log('✅ toxic-bert model loaded successfully');
      notifyPopup({ type: 'MODEL_STATUS', ready: true });

      // Re-scan now that model is ready
      scanComments();

    } catch (err) {
      SS.modelLoading = false;
      warn('Model load failed, using keyword fallback:', err.message);
      notifyPopup({ type: 'MODEL_STATUS', ready: false });
    }
  }

  function notifyPopup(msg) {
    chrome.runtime.sendMessage(msg).catch(() => {});
  }

  // ─── Toxicity Scoring ─────────────────────────────────────────────────────
  const TOXIC_KEYWORDS = [
    'kill yourself', 'kys', 'go die', 'worthless', 'stupid idiot',
    'you\'re trash', 'ur trash', 'piece of shit', 'hate you',
    'nobody likes you', 'kill urself', 'end yourself',
    'fuck you', 'fuck off', 'shut up', 'idiot', 'moron',
    'retard', 'retarded', 'faggot', 'nigger', 'nigga',
    'bitch', 'cunt', 'whore', 'slut', 'dumbass', 'asshole',
  ];

  function keywordScore(text) {
    if (!text) return 0;
    const lower = text.toLowerCase();
    let score = 0;
    for (const kw of TOXIC_KEYWORDS) {
      if (lower.includes(kw)) {
        // Longer/more severe keywords weight more
        score = Math.max(score, 0.6 + (kw.length / 100));
      }
    }
    return Math.min(score, 0.99);
  }

  async function getToxicityScore(text) {
    if (!text || text.trim().length < 3) return 0;

    if (SS.modelReady && SS.model) {
      try {
        const result = await SS.model(text.slice(0, 512));
        const toxic = result.find(r => r.label === 'toxic' || r.label === 'LABEL_1');
        return toxic ? toxic.score : 0;
      } catch (e) {
        // Fall through to keyword
      }
    }
    return keywordScore(text);
  }

  // ─── Text Extraction ──────────────────────────────────────────────────────

  // Recursively extract text from a node, piercing shadow roots up to maxDepth
  function extractTextFromNode(node, depth = 0, maxDepth = 6) {
    if (!node || depth > maxDepth) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';

    // Skip script/style/button nodes
    const tag = node.tagName?.toLowerCase();
    if (['script', 'style', 'button', 'svg', 'img'].includes(tag)) return '';

    let text = '';

    // Pierce shadow DOM
    if (node.shadowRoot) {
      text += extractTextFromNode(node.shadowRoot, depth + 1, maxDepth);
    }

    for (const child of node.childNodes) {
      text += extractTextFromNode(child, depth + 1, maxDepth);
    }

    return text;
  }

  // ─── Comment Finders ──────────────────────────────────────────────────────

  function findCommentsReddit() {
    const results = [];

    // Strategy 1: New Reddit — shreddit-comment custom elements
    const shreddit = document.querySelectorAll('shreddit-comment');
    for (const el of shreddit) {
      if (!SS.processedNodes.has(el)) {
        results.push({ node: el, getText: () => extractTextFromNode(el) });
      }
    }

    // Strategy 2: New Reddit — comment body paragraphs inside shadow DOM
    // (catches cases where shreddit-comment isn't the wrapper)
    const commentBodies = document.querySelectorAll(
      '[slot="comment"], .Comment, [data-testid="comment"], .commentarea .usertext-body'
    );
    for (const el of commentBodies) {
      if (!SS.processedNodes.has(el)) {
        results.push({ node: el, getText: () => el.innerText || el.textContent });
      }
    }

    // Strategy 3: Old Reddit
    const oldReddit = document.querySelectorAll('.thing.comment .usertext-body .md');
    for (const el of oldReddit) {
      if (!SS.processedNodes.has(el)) {
        results.push({ node: el, getText: () => el.innerText || el.textContent });
      }
    }

    return results;
  }

  function findCommentsX() {
    const results = [];

    // Tweet text elements
    const tweets = document.querySelectorAll('[data-testid="tweetText"]');
    for (const el of tweets) {
      // Walk up to find the article container for blurring
      const article = el.closest('article') || el;
      if (!SS.processedNodes.has(el)) {
        results.push({ node: el, blurTarget: article, getText: () => el.innerText || el.textContent });
      }
    }

    return results;
  }

  function findComments() {
    if (SS.platform === 'reddit') return findCommentsReddit();
    if (SS.platform === 'x')      return findCommentsX();
    return [];
  }

  // ─── Blur / Reveal ────────────────────────────────────────────────────────
  function applyBlur(node, blurTarget, text, score) {
    const target = blurTarget || node;

    // Wrap if not already wrapped
    let wrapper = target.closest('.ss-wrapper');
    if (!wrapper) {
      wrapper = document.createElement('div');
      wrapper.className = 'ss-wrapper';
      target.parentNode?.insertBefore(wrapper, target);
      wrapper.appendChild(target);
    }

    // Add blur class to target
    target.classList.add('ss-blurred');
    // Also blur all child .ss-blurred to ensure full coverage
    target.querySelectorAll('*').forEach(el => {
      if (el.tagName !== 'BUTTON') el.classList.add('ss-blurred');
    });

    // Add control row if not present
    if (!wrapper.querySelector('.ss-btn-row')) {
      const row = document.createElement('div');
      row.className = 'ss-btn-row';

      const badge = document.createElement('span');
      badge.className = 'ss-badge';
      badge.textContent = `⚠ ${Math.round(score * 100)}% toxic`;

      const revealBtn = document.createElement('button');
      revealBtn.className = 'ss-btn ss-btn-reveal';
      revealBtn.textContent = 'Show Content';
      revealBtn.onclick = () => revealContent(target, revealBtn, reblurBtn);

      const reblurBtn = document.createElement('button');
      reblurBtn.className = 'ss-btn ss-btn-reblur';
      reblurBtn.textContent = 'Re-blur';
      reblurBtn.onclick = () => {
        target.classList.add('ss-blurred');
        revealBtn.style.display = '';
        reblurBtn.style.display = 'none';
        SS.stats.revealed = Math.max(0, SS.stats.revealed - 1);
      };

      row.appendChild(badge);
      row.appendChild(revealBtn);
      row.appendChild(reblurBtn);
      wrapper.insertBefore(row, target);
    }
  }

  function revealContent(target, revealBtn, reblurBtn) {
    target.classList.remove('ss-blurred');
    target.querySelectorAll('.ss-blurred').forEach(el => el.classList.remove('ss-blurred'));
    revealBtn.style.display = 'none';
    reblurBtn.style.display = '';
    SS.stats.revealed++;
    updateBadge();
  }

  // ─── Main Scan ────────────────────────────────────────────────────────────
  async function scanComments() {
    if (!SS.settings.enabled) return;

    const candidates = findComments();
    if (candidates.length === 0) return;

    log(`Processing ${candidates.length} new comment(s)...`);

    for (const { node, blurTarget, getText } of candidates) {
      // Mark as processed immediately to prevent re-entry
      SS.processedNodes.add(node);
      SS.stats.scanned++;

      let text = '';
      try { text = getText().trim(); } catch (e) { continue; }

      // Secondary dedup by text content (important for X where nodes get recycled)
      if (!text || text.length < 5) continue;
      const textKey = text.slice(0, 100);
      if (SS.processedTexts.has(textKey)) continue;
      SS.processedTexts.add(textKey);

      const score = await getToxicityScore(text);

      if (score >= SS.settings.threshold) {
        SS.stats.flagged++;
        log(`Flagged (${Math.round(score * 100)}%): "${text.slice(0, 80).replace(/\n/g, ' ')}..."`);
        if (SS.settings.autoBlur) {
          applyBlur(node, blurTarget, text, score);
        }
      }
    }

    updateBadge();
    notifyPopup({ type: 'STATS_UPDATE', stats: SS.stats });
  }

  function updateBadge() {
    chrome.runtime.sendMessage({
      type: 'UPDATE_BADGE',
      count: SS.stats.flagged
    }).catch(() => {});
  }

  // ─── MutationObserver ─────────────────────────────────────────────────────
  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      // Quick relevance check before debouncing
      const relevant = mutations.some(m =>
        [...m.addedNodes].some(n =>
          n.nodeType === Node.ELEMENT_NODE && (
            n.tagName === 'SHREDDIT-COMMENT' ||
            n.matches?.('[data-testid="tweetText"], article, .Comment, [data-testid="comment"]') ||
            n.querySelector?.('shreddit-comment, [data-testid="tweetText"], .Comment')
          )
        )
      );
      if (!relevant) return;

      clearTimeout(SS.debounceTimer);
      SS.debounceTimer = setTimeout(scanComments, SS.DEBOUNCE_MS);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    log('MutationObserver started');
  }

  // ─── Message Listener ─────────────────────────────────────────────────────
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'GET_STATS') {
      sendResponse({ stats: SS.stats, modelReady: SS.modelReady, platform: SS.platform });
    }
    if (msg.type === 'UPDATE_SETTINGS') {
      Object.assign(SS.settings, msg.settings);
    }
    if (msg.type === 'RESCAN') {
      // Full rescan: clear text dedup but keep node WeakSet (nodes already blurred)
      SS.processedTexts.clear();
      scanComments();
    }
    return true;
  });

  // ─── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    log(`Platform detected: ${SS.platform}`);
    log(`v${SS.version} initializing on ${SS.platform}...`);

    await loadSettings();
    injectStyles();
    log('Styles injected');

    // Start model loading (non-blocking)
    log('Loading toxic-bert model...');
    loadModel(); // intentionally not awaited — keyword fallback handles the gap

    startObserver();
    log('✅ Initialized');

    // Double-pass scan for async-loaded content
    setTimeout(scanComments, 1500);
    setTimeout(scanComments, 4500);
  }

  // Wait for DOM if needed
  if (document.body) {
    init();
  } else {
    document.addEventListener('DOMContentLoaded', init);
  }

})();