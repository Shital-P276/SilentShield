import { shield } from './linkguard.js';

// Initialize both Text (toxic-bert) and Vision (nsfw_mobilenet_v2) models
chrome.runtime.onInstalled.addListener(() => shield.init());

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  // 1. Manual Popup Scan: Analyzes text and returns toxicity score for the Risk Meter
  if (request.action === "analyzeText") {
    shield.analyzeText(request.text).then(sendResponse);
    return true; // Keeps the message channel open for the async AI response
  }

  // 2. Image Guard: Scans image pixels for nudity or explicit content
  if (request.action === "analyzeImage") {
    shield.analyzeImage(request.imgUrl).then(sendResponse);
    return true;
  }

  // 3. Typing Guard: Triggers Voice and the Attractive Modal if abusive sentences are typed
  if (request.action === "typingWarning") {
    chrome.scripting.executeScript({
      target: { tabId: sender.tab.id },
      func: () => {
        // Trigger Voice Warning
        const msg = "Warning: You are typing abusive language.";
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.rate = 0.85; 
        window.speechSynthesis.speak(utterance);

        // Trigger the Attractive Modal (defined in content.js)
        if (typeof showAttractiveWarning === "function") {
          showAttractiveWarning();
        } else {
          alert(msg); // Fallback
        }
      }
    });
  }
});