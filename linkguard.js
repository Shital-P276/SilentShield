import { pipeline, env } from './transformers.js';

// Setup environment for browser extension compatibility
// Disabling local models ensures it fetches from Hugging Face/CDN
env.allowLocalModels = false;
env.useBrowserCache = true;

class ShieldAI {
  constructor() {
    this.textPipe = null;
    this.visionPipe = null;
    this.ready = false;
  }

  /**
   * Initializes the AI models.
   * Downloads and caches the models on the first run.
   */
  async init() {
    try {
      // toxic-bert: Analyzes text for toxicity, insults, and threats
      this.textPipe = await pipeline('text-classification', 'Xenova/toxic-bert');
      
      // nsfw_mobilenet_v2: Analyzes image pixels for explicit content
      this.visionPipe = await pipeline('image-classification', 'Xenova/nsfw_mobilenet_v2');
      
      this.ready = true;
      console.log("Shield AI: Variety-aware models fully loaded.");
    } catch (e) {
      console.error("Shield AI: Initialization failed", e);
    }
  }

  /**
   * Analyzes text for abusive content.
   * @param {string} text - The text to analyze.
   * @returns {Promise<Object>} - An object indicating if the text is abusive.
   */
  async analyzeText(text) {
    if (!this.ready) {
        console.warn("Shield AI: Text model not ready.");
        return { isAbusive: false };
    }
    
    try {
      const results = await this.textPipe(text);
      // Returns true if toxicity or insult confidence exceeds 70% threshold
      const isAbusive = results.some(r => 
        r.score > 0.7 && (r.label === 'toxic' || r.label === 'insult')
      );
      
      return { isAbusive };
    } catch (e) {
      console.error("Shield AI: Text analysis error", e);
      return { isAbusive: false };
    }
  }

  /**
   * Analyzes an image for explicit content.
   * Handles images on standard sites, X (Twitter) thumbnails, and adult sites.
   * @param {string} imgUrl - The source URL of the image or video poster.
   * @returns {Promise<Object>} - An object indicating if the image is explicit.
   */
  async analyzeImage(imgUrl) {
    if (!this.ready) {
        console.warn("Shield AI: Vision model not ready.");
        return { isExplicit: false };
    }
    
    try {
      const res = await this.visionPipe(imgUrl);
      // Targeted labels for pornographic, hentai, or explicit content
      const explicitLabels = ['porn', 'hentai', 'sexy'];
      const topResult = res[0];
      
      // Returns true if the top visual category matches explicit labels with >60% confidence
      const isExplicit = explicitLabels.includes(topResult.label) && topResult.score > 0.6;
      
      return { isExplicit };
    } catch (e) {
      // Errors usually occur due to CORS or broken links; fail-safe to false to prevent blocking legitimate UI
      return { isExplicit: false };
    }
  }
}

// Export a single instance to be used by background.js
export const shield = new ShieldAI();