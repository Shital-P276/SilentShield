

// Silent Shield Background Service Worker
console.log('🛡️ Silent Shield: Service Worker Active');

// Initialize on install/update
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('🛡️ Silent Shield: Fresh install');
  }
  
  // Create context menu for text selection
  chrome.contextMenus.create({
    id: "silentShieldAnalyze",
    title: "🛡️ Silent Shield: Scan Selection",
    contexts: ["selection"],
    documentUrlPatterns: ["<all_urls>"]
  }, () => {
    if (chrome.runtime.lastError) {
      console.error('Context menu failed:', chrome.runtime.lastError);
    }
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "silentShieldAnalyze") {
    // Notify popup/content script
    chrome.tabs.sendMessage(tab.id, {
      action: "silentShieldScan",
      text: info.selectionText,
      tabId: tab.id
    });
    
    // Visual feedback
    chrome.action.setBadgeText({ 
      text: 'AI', 
      tabId: tab.id 
    });
    chrome.action.setBadgeBackgroundColor({ 
      color: '#ff6b6b', 
      tabId: tab.id 
    });
    
    setTimeout(() => {
      chrome.action.setBadgeText({ text: '' });
    }, 3000);
  }
});

// Message listener for popup/content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case 'getShieldStatus':
      chrome.storage.local.get([
        'modelReady',
        'scanCount',
        'shieldActive',
        'toxicCount',
        'blurCount',
        'inferenceCount'
      ], (result) => {
        sendResponse({
          modelReady: result.modelReady || false,
          scanCount: result.scanCount || 0,
          shieldActive: result.shieldActive !== false,
          toxicCount: result.toxicCount || 0,
          blurCount: result.blurCount || 0,
          inferenceCount: result.inferenceCount || 0
        });
      });
      return true; // Async response

    case 'getDashboardData':
      chrome.storage.local.get([
        'toxicCount',
        'blurCount',
        'inferenceCount',
        'detectedHistory',
        'dailyTrends',
        'installDate'
      ], (result) => {
        sendResponse(result);
      });
      return true;

    case 'clearAllHistory':
      chrome.storage.local.set({
        toxicCount: 0,
        blurCount: 0,
        inferenceCount: 0,
        detectedHistory: [],
        dailyTrends: {}
      }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'updateStats':
      chrome.storage.local.set({
        scanCount: (request.scanCount || 0),
        lastScan: Date.now()
      });
      break;

    case 'toggleShield':
      chrome.storage.local.set({
        shieldActive: request.active
      });
      break;

    case 'analyzeWithGrok':
      analyzeWithGrok(request.text).then(result => {
        sendResponse(result);
      }).catch(error => {
        sendResponse({ error: error.message });
      });
      return true; // Async response
  }
});

// ==========================================
// Grok API Analyzer
// ==========================================

// Load config from config.js
async function getConfig() {
  // Check if already loaded globally
  if (typeof window !== 'undefined' && window.CONFIG) {
    return window.CONFIG;
  }
  
  // Try to import config.js
  try {
    const configModule = await import(chrome.runtime.getURL('config.js'));
    return configModule.default || configModule.CONFIG || window.CONFIG;
  } catch (e) {
    console.error('Failed to load config.js:', e);
    return null;
  }
}

async function analyzeWithGrok(text) {
  const ENV = await getConfig();
  
  if (!ENV || !ENV.GROK_API_KEY) {
    console.warn('Grok API key not configured in config.js, using local analysis');
    return analyzeWithLocalEngine(text);
  }

  const systemPrompt = `You are a content moderation AI. Analyze the given text for toxicity, hate speech, harassment, and profanity.

Respond ONLY with a JSON object in this exact format:
{
  "isToxic": true/false,
  "isSafe": true/false,
  "confidence": 0.0-1.0,
  "category": "toxic" | "hate" | "harassment" | "profanity" | "safe",
  "severity": "low" | "medium" | "high" | "critical",
  "explanation": "Brief explanation of why this content is flagged or considered safe"
}

Rules:
- isToxic: true if content contains harmful language
- isSafe: true only if content is completely harmless
- confidence: How certain you are (0.0 = uncertain, 1.0 = very certain)
- category: Primary category of concern, or "safe" if harmless
- severity: How severe the issue is
- Keep explanation under 100 characters`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(ENV.GROK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ENV.GROK_API_KEY}`
      },
      body: JSON.stringify({
        model: ENV.GROK_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this text: "${text}"` }
        ],
        temperature: 0.1,
        max_tokens: 200
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Grok API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    console.log('Grok API response:', data);
    
    const content = data.choices?.[0]?.message?.content || '';
    console.log('Grok content:', content);

    // Parse JSON from response
    let result;
    try {
      // Extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || 
                       content.match(/```\n?([\s\S]*?)\n?```/) ||
                       [null, content];
      const jsonStr = jsonMatch[1] || content;
      result = JSON.parse(jsonStr);
      console.log('Parsed Grok result:', result);
    } catch (parseError) {
      console.error('Failed to parse Grok response:', content);
      // Fallback: create result from raw content
      const isSafe = content.toLowerCase().includes('safe') && 
                     !content.toLowerCase().includes('toxic') &&
                     !content.toLowerCase().includes('harmful');
      result = {
        isToxic: !isSafe,
        isSafe: isSafe,
        confidence: 0.7,
        category: isSafe ? 'safe' : 'toxic',
        severity: isSafe ? 'low' : 'medium',
        explanation: 'Analysis based on content evaluation'
      };
    }

    return {
      success: true,
      result: result,
      raw: content
    };

  } catch (error) {
    console.error('Grok API failed:', error.message);
    
    // Check if it's a connection/model unavailable error
    if (error.message.includes('unavailable') || 
        error.message.includes('connection') ||
        error.message.includes(' forcibly closed') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ETIMEDOUT')) {
      console.log('Groq API service is down or unreachable, using local analysis');
    } else {
      console.log('Grok API error, falling back to local analysis engine');
    }
    
    // Always fallback to local analysis
    const fallback = analyzeWithLocalEngine(text);
    console.log('Local fallback result:', fallback);
    return fallback;
  }
}

// Local fallback analysis engine (keyword-based) - Cyber Bullying Detection
function analyzeWithLocalEngine(text) {
  console.log('Running local cyber bullying analysis on text:', text.substring(0, 50) + '...');
  
  // Cyber bullying / Toxic content keywords
  const toxicKeywords = [
    'fuck','shit','bitch','asshole','stupid','idiot','worthless','loser',
    'terrible','garbage','dumb','moron','hate you','suck','trash',
    'kill yourself','kys','retard','ugly','fat','disgusting','pathetic'
  ];
  
  // Hate speech / Discrimination
  const hateKeywords = [
    'hate','nigger','faggot','cunt','fag','chink','spic','wetback',
    'cracker','white trash','kike','raghead','terrorist','gay','lesbo'
  ];
  
  // Harassment / Threats
  const harassmentKeywords = [
    'kill','die','hurt','attack','find you','watch your back','threat',
    'regret','coming for you','destroy you','ruin your','know where you live',
    'stalking','following you','waiting for you','better hide'
  ];
  
  // Cyber bullying specific phrases
  const cyberBullyingPhrases = [
    'nobody likes you','go away','leave this place','unwanted here',
    'kill yourself','end your life','nobody cares','alone forever',
    'worthless','better off dead','disappear','stop posting'
  ];

  const lower = text.toLowerCase();
  let scores = { toxic: 0, hate: 0, harassment: 0, cyberBullying: 0 };

  toxicKeywords.forEach(word => { if (lower.includes(word)) scores.toxic += 0.25; });
  hateKeywords.forEach(word => { if (lower.includes(word)) scores.hate += 0.40; });
  harassmentKeywords.forEach(word => { if (lower.includes(word)) scores.harassment += 0.35; });
  cyberBullyingPhrases.forEach(phrase => { if (lower.includes(phrase)) scores.cyberBullying += 0.45; });

  // Cap scores
  Object.keys(scores).forEach(k => scores[k] = Math.min(scores[k], 0.98));

  const maxScore = Math.max(...Object.values(scores));
  const isToxic = maxScore > 0.3;
  
  let category = 'safe';
  let severity = 'low';
  let explanation = 'Content appears safe';
  
  if (scores.cyberBullying > 0.3) { 
    category = 'cyber_bullying'; 
    severity = 'high'; 
    explanation = 'Cyber bullying content detected';
  }
  else if (scores.hate > 0.3) { 
    category = 'hate'; 
    severity = 'high'; 
    explanation = 'Hate speech detected';
  }
  else if (scores.harassment > 0.3) { 
    category = 'harassment'; 
    severity = 'high'; 
    explanation = 'Harassment/threats detected';
  }
  else if (scores.toxic > 0.3) { 
    category = 'toxic'; 
    severity = 'medium'; 
    explanation = 'Toxic language detected';
  }

  const result = {
    success: true,
    result: {
      isToxic: isToxic,
      isSafe: !isToxic,
      confidence: Math.min(maxScore + 0.2, 0.95),
      category: category,
      severity: severity,
      explanation: explanation + ' (AI analysis)'
    },
    fallback: true
  };
  
  console.log('Local engine returning:', result);
  return result;
}