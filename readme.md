# SilentShield - AI Cyberbullying Protection Browser Extension

**SilentShield** is a browser extension that provides real-time AI-powered protection against cyberbullying and malicious links on social media platforms.

## 🎯 Problem Statement (TECKATHON PS 5)

Develop a smart, AI-powered monitoring platform (web/mobile/browser extension) that detects, analyzes, and prevents cyber threats such as cyberbullying, scams, and malicious links in real time.

## ✨ Current Features

- Real-time comment scanning on social media (focused on Reddit, X/Twitter)
- AI-based toxicity detection (simulated for now, real Transformers.js planned)
- Visual highlighting of toxic comments
- Auto-blur + Reveal functionality for toxic content
- Popup dashboard with safety score and statistics
- Sensitivity control and Auto-blur toggle
- Works on Firefox and Microsoft Edge

## 📁 Project Structure
SilentShield/
├── manifest.json
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── styles.css
├── content/
│   └── content.js
└── icons/
├── icon-16.png
├── icon-32.png
└── icon-192.png
text## 🚀 How to Load

**Edge:**
1. Go to `edge://extensions/`
2. Enable Developer mode
3. Click "Load unpacked" → select `SilentShield` folder

**Firefox:**
1. Go to `about:debugging#/runtime/this-firefox`
2. Click "Load Temporary Add-on" → select `manifest.json`

## Current Status

- Popup dashboard is working well
- Content script initializes but detection on Reddit is inconsistent
- Real AI model (Transformers.js) not yet integrated

## Next Development Goals

1. Integrate real **Transformers.js + toxic-bert** model
2. Improve comment detection reliability across platforms (especially Reddit)
3. Add malicious link scanner
4. Improve mitigation (Safe Reply suggestions)
5. Add proper statistics persistence
6. Prepare for submission (demo video + presentation)