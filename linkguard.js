import { pipeline, env } from './transformers.js';

// Setup environment for browser extension compatibility
env.allowLocalModels = false;
env.useBrowserCache = true;

class ShieldAI {
  constructor() {
    this.textPipe = null;
    this.visionPipe = null;
    this.ready = false;
  }

  async init() {
    try {
      // toxic-bert for text variety (toxicity, insult, threat)
      this.textPipe = await pipeline('text-classification', 'Xenova/toxic-bert');
      // nsfw_mobilenet_v2 for visual detection (porn, sexy, hentai)
      this.visionPipe = await pipeline('image-classification', 'Xenova/nsfw_mobilenet_v2');
      this.ready = true;
      console.log("Shield AI: Variety-aware models fully loaded.");
    } catch (e) {
      console.error("Shield AI: Initialization failed", e);
    }
  }

  async analyzeText(text) {
    if (!this.ready) return { isAbusive: false };
    const results = await this.textPipe(text);
    // Returns true if toxicity or insult confidence exceeds 70%
    return {
      isAbusive: results.some(r => r.score > 0.7 && (r.label === 'toxic' || r.label === 'insult'))
    };
  }

  async analyzeImage(imgUrl) {
    if (!this.ready) return { isExplicit: false };
    try {
      const res = await this.visionPipe(imgUrl);
      const explicitLabels = ['porn', 'hentai', 'sexy'];
      const topResult = res[0];
      // Returns true if the top visual category is explicit
      return {
        isExplicit: explicitLabels.includes(topResult.label) && topResult.score > 0.6
      };
    } catch (e) {
      return { isExplicit: false };
    }
  }
}

export const shield = new ShieldAI();