// background.js - SilentShield Background Service Worker with Real toxic-bert

console.log('🛡️ SilentShield: Background Service Worker Active');

let classifier = null;
let modelReady = false;

// Load the toxicity model
async function loadToxicityModel() {
  if (modelReady) return true;

  try {
    console.log('🔄 Loading Xenova/toxic-bert model...');

    const { pipeline } = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2');

    classifier = await pipeline('text-classification', 'Xenova/toxic-bert', {
      quantized: true,
      progress_callback: (data) => {
        if (data.status === 'ready') {
          console.log('✅ toxic-bert model loaded successfully');
        }
      }
    });

    modelReady = true;
    chrome.storage.local.set({ modelReady: true });
    console.log('🚀 SilentShield AI Model Ready');
    return true;

  } catch (error) {
    console.error('❌ Failed to load toxic-bert model:', error);
    return false;
  }
}

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "ANALYZE_TOXICITY") {
    handleToxicityAnalysis(request.text, sendResponse);
    return true; // Keep message channel open for async response
  }

  // Existing handlers
  if (request.action === 'getShieldStatus') {
    sendResponse({
      modelReady: modelReady,
      scanCount: 0 // can be expanded later
    });
    return true;
  }
});

async function handleToxicityAnalysis(text, sendResponse) {
  if (!text || text.length < 10) {
    sendResponse({ score: 0 });
    return;
  }

  // Ensure model is loaded
  if (!classifier) {
    const loaded = await loadToxicityModel();
    if (!loaded) {
      // Fallback to simple keyword score
      const fallbackScore = getKeywordScore(text);
      sendResponse({ score: fallbackScore });
      return;
    }
  }

  try {
    const results = await classifier(text, { top_k: null });
    // Find the 'toxic' label score
    const toxicResult = results.find(r => r.label.toLowerCase().includes('toxic')) || results[0];
    const score = toxicResult.score || 0;

    console.log(`AI Analysis: "${text.substring(0, 60)}..." → Score: ${(score*100).toFixed(1)}%`);
    sendResponse({ score: score });

  } catch (error) {
    console.error('Inference error:', error);
    sendResponse({ score: getKeywordScore(text) });
  }
}

// Simple keyword fallback
function getKeywordScore(text) {
  const lower = text.toLowerCase();
  let score = 0.1;
  const badWords = ["fuck","fucking","shit","bitch","asshole","cunt","kys","retard"];
  badWords.forEach(word => {
    if (lower.includes(word)) score += 0.35;
  });
  return Math.min(0.95, score);
}

// Initialize model on startup
loadToxicityModel();

console.log('🛡️ SilentShield Background initialized');