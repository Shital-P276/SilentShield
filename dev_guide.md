# SilentShield Development Guide

## Project Overview

We are building a **Manifest V3** browser extension for Firefox and Edge that detects cyberbullying in real-time using AI and provides mitigation (highlight + blur + reveal).

## Tech Stack

- Vanilla JavaScript (Plain JS - no Vite/React)
- Manifest V3
- Transformers.js (@xenova/transformers) for client-side AI
- Chrome Storage API
- Tailwind CSS via CDN (for popup)

## Current Files Status

- `manifest.json` — Ready (with icons 16, 32, 192)
- `popup/popup.html` — Good UI with safety score, stats, slider, test box
- `popup/popup.js` — Basic functionality + settings
- `content/content.js` — Initializes but comment detection on Reddit is weak

## Key Challenges So Far

1. **Reddit DOM is very dynamic** (`shreddit-comment`, shadow DOM, frequent changes)
2. Need better, more robust comment detection strategy
3. Real AI model integration (Transformers.js) is heavy (~110MB first load)
4. Need to balance performance vs detection accuracy

## Priority Tasks (in order)

### Phase 1: Fix Detection (High Priority)
- Improve `findPotentialComments()` function for Reddit and X
- Add better text extraction logic
- Reduce false negatives

### Phase 2: Integrate Real AI
- Add Transformers.js script loading
- Load `Xenova/toxic-bert` model
- Replace simulation with real model inference
- Handle model loading state gracefully

### Phase 3: Enhance Mitigation
- Add "Safe Reply" button with template suggestions
- Improve blur/reveal UX
- Add link scanner for malicious URLs

### Phase 4: Polish
- Better dashboard statistics
- Error handling and loading indicators
- Prepare demo video and presentation

## Important Notes for AI Developer

- Keep everything in **plain JavaScript** (no build tools)
- Use `chrome.storage.local` for persistence
- Be careful with performance — don't analyze every DOM element aggressively
- Use `MutationObserver` with debouncing
- Show clear console logs with `SilentShield` prefix for debugging

## Testing Platforms

Primary: **Reddit** (most challenging)
Secondary: **x.com** / Twitter

Would you like me to continue development? Please start with improving the comment detection logic on Reddit, then move to integrating the real Transformers.js toxicity model.