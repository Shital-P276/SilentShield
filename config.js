/**
 * SilentShield Configuration
 * Store all sensitive API keys and config here
 */

const CONFIG = {
  // Firebase Config
  FIREBASE_API_KEY: 'AIzaSyBcQNVjpXh8iFCirQ6Dr3DWUecgPWJ-4FY',
  FIREBASE_PROJECT_ID: 'silentshield-39e11',
  AUTH_BASE_URL: 'https://identitytoolkit.googleapis.com/v1',
  TOKEN_URL: 'https://securetoken.googleapis.com/v1',
  
  // Groq API Config (for text analysis)
  GROK_API_KEY: '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',
  GROK_API_URL: 'https://api.groq.com/openai/v1/chat/completions',
  GROK_MODEL: 'llama-3.1-8b-instant'
};

// Export for ES modules or assign to window
if (typeof window !== 'undefined') {
  window.CONFIG = CONFIG;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = CONFIG;
}