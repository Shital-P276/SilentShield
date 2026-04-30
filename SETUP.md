# SilentShield Setup Guide

## Grok API Configuration

To use the AI-powered text analysis feature, you need to configure your xAI Grok API key.

### 1. Get Your API Key

1. Go to https://console.x.ai/
2. Sign up or log in to your xAI account
3. Navigate to "API Keys" section
4. Create a new API key
5. Copy the key (it starts with `xai-`)

### 2. Configure the Extension

1. Open `env.js` file in the extension root
2. Replace `xai-your-api-key-here` with your actual API key:

```javascript
const ENV = {
  GROK_API_KEY: 'xai-your-actual-api-key-here',
  // ... rest of config
};
```

### 3. Reload the Extension

1. Go to `chrome://extensions/`
2. Find SilentShield
3. Click the reload button

### Features

Once configured, the analyzers in both:
- **Popup** (quick analyzer in the extension popup)
- **Dashboard** (live text analyzer tab)

Will use Grok AI for advanced content moderation analysis.

### Fallback

If the Grok API is unavailable or the key is not configured, the extension will automatically fall back to a local keyword-based analysis engine.

### Privacy Note

- Text sent to Grok API is processed by xAI's servers
- No data is stored on xAI's servers beyond the API call
- All other data remains local to your browser
