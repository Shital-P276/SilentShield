# SilentShield TODO — v6.0

## ✅ Done in v6.0
- [x] Rewrote content.js with robust shadow DOM detection (shreddit-comment)
- [x] Fixed blur/reveal using CSS class toggle (not inline styles) — survives re-renders
- [x] Moved toxic-bert to content script (fixes CSP blocking in service worker)
- [x] Debounced MutationObserver (600ms) — no more performance spikes
- [x] WeakSet for processed nodes — no duplicate processing
- [x] Multi-selector cascade for Reddit old + new UI
- [x] Double scan on init (1.5s + 4s) for late-loading Reddit content
- [x] Keyword fallback when model not ready
- [x] Clean popup with model status indicator
- [x] Firefox-compatible manifest (browser_specific_settings)

## 🔴 High Priority

### Step 1 — Download Transformers.js locally
```bash
node setup-libs.js
```
This puts transformers.min.js in /libs/ so the content script can import it
via chrome.runtime.getURL() — no CDN CSP issues.

### Step 2 — Test on Reddit
1. Load extension in Edge: edge://extensions/ → Load unpacked
2. Open reddit.com/r/worldnews or any comment-heavy subreddit  
3. Open DevTools Console → filter "[SilentShield]"
4. You should see: "Processing X new comment(s)"

### Step 3 — Verify blur/reveal
- Comments with toxic keywords should blur automatically
- "Show Content" button should unblur cleanly
- "Re-blur" button should work after reveal

## 🟡 Medium Priority
- [ ] Add "Safe Reply" suggestion panel (use Claude API in popup)
- [ ] Malicious link scanner (check URLs against Google Safe Browsing API)
- [ ] Platform toggles in popup (Reddit only / X only)
- [ ] Stats persistence per domain

## 🟢 Nice to Have
- [ ] Dark/light popup theme toggle
- [ ] Export flagged comments as JSON
- [ ] Instagram/Facebook support
- [ ] Confidence breakdown (which toxic category triggered)

## 📹 Demo Checklist
- [ ] Auto-blur working on Reddit live comments
- [ ] Reveal/re-blur working
- [ ] Popup shows real-time stats
- [ ] AI model active (not keyword fallback)
- [ ] Record 2-minute demo video
- [ ] Prepare slides (Problem → Solution → Demo → Impact)
