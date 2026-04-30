import { shield } from './linkguard.js';

chrome.runtime.onInstalled.addListener(() => shield.init());

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "analyzeText") {
    shield.analyzeText(request.text).then(sendResponse);
    return true; 
  }

  if (request.action === "analyzeImage") {
    shield.analyzeImage(request.imgUrl).then(sendResponse);
    return true;
  }

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
  }
});