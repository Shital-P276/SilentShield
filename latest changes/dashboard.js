/**
 * SilentShield Dashboard
 * Comprehensive dashboard for cyberbullying protection analytics
 */

(function() {
  'use strict';

  // ==========================================
  // Dynamic Data Storage
  // ==========================================
  let dashboardData = {
    safetyScore: 100,
    stats: {
      toxicDetected: 0,
      autoBlurred: 0,
      inferences: '0',
      activeDays: 0
    },
    recentActivity: [],
    historyEntries: [],
    trendsData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      toxic: [0, 0, 0, 0, 0, 0, 0],
      suspicious: [0, 0, 0, 0, 0, 0, 0],
      safe: [0, 0, 0, 0, 0, 0, 0]
    },
    testSamples: {
      toxic: 'You are such a worthless person. Nobody cares about you and you should just disappear. Everything you do is terrible.',
      hate: 'This group of people should not be allowed in our society. They are destroying our values and need to be removed.',
      harassment: 'I know where you live. I am going to find you and make you regret everything. Watch your back every day.',
      safe: 'Thank you so much for sharing this helpful information! I really appreciate your contribution to this discussion.'
    }
  };

  // ==========================================
  // DOM Elements
  // ==========================================
  const elements = {
    navItems: document.querySelectorAll('.nav-item'),
    tabPanels: document.querySelectorAll('.tab-panel'),
    pageTitle: document.getElementById('page-title'),
    settingsNavItems: document.querySelectorAll('.settings-nav-item'),
    settingsGroups: document.querySelectorAll('.settings-group'),
    historyCount: document.getElementById('history-count'),
    
    // Overview elements
    safetyScore: document.getElementById('safety-score'),
    scoreCircleFill: document.getElementById('score-circle-fill'),
    scoreStatus: document.getElementById('score-status'),
    toxicDetected: document.getElementById('toxic-detected'),
    autoBlurred: document.getElementById('auto-blurred'),
    inferences: document.getElementById('inferences'),
    activeDays: document.getElementById('active-days'),
    recentActivity: document.getElementById('recent-activity'),
    
    // Analyzer elements
    analyzerText: document.getElementById('analyzer-text'),
    charCount: document.getElementById('char-count'),
    analyzeBtn: document.getElementById('analyze-btn'),
    clearBtn: document.getElementById('clear-btn'),
    analysisContent: document.getElementById('analysis-content'),
    resultBadge: document.getElementById('result-badge'),
    categoriesCard: document.getElementById('categories-card'),
    categoryList: document.getElementById('category-list'),
    testChips: document.querySelectorAll('.chip'),
    
    // History elements
    historyTbody: document.getElementById('history-tbody'),
    historySearch: document.getElementById('history-search'),
    filterBtns: document.querySelectorAll('.filter-btn'),
    totalEntries: document.getElementById('total-entries'),
    
    // Settings elements
    sensitivitySlider: document.getElementById('sensitivity-slider'),
    thresholdDisplay: document.getElementById('threshold-display'),
    
    // Other buttons
    refreshBtn: document.getElementById('refresh-btn'),
    exportBtn: document.getElementById('export-btn'),
    clearHistoryBtn: document.getElementById('clear-history-btn'),
    resetSettingsBtn: document.getElementById('reset-settings-btn')
  };

  // ==========================================
  // State
  // ==========================================
  let currentTab = 'overview';
  let currentSettingsTab = 'general';
  let currentFilter = 'all';
  let isAnalyzing = false;

  // ==========================================
  // Real-time Toxicity Detection (same logic as content.js)
  // ==========================================
  const DETECTION_CATEGORIES = {
    toxic: { keywords: ['fuck','shit','bitch','asshole','stupid','idiot','worthless','loser','terrible','garbage','dumb','moron','hate you','suck','trash'], weight: 0.35 },
    hate: { keywords: ['hate','nigger','faggot','cunt','retard','kys','kill yourself','die','fag','chink','spic','wetback'], weight: 0.40 },
    harassment: { keywords: ['kill','die','hurt','attack','find you','watch your back','threat','regret','coming for you','destroy you','ruin your'], weight: 0.35 },
    profanity: { keywords: ['damn','hell','crap','piss','bastard','dammit','goddamn','jesus christ','oh my god','wtf'], weight: 0.15 }
  };

  function analyzeTextReal(text) {
    if (!text || text.length < 2) {
      return {
        verdict: 'Safe',
        verdictClass: 'safe',
        confidence: 0,
        primaryCategory: 'safe',
        categories: [
          { name: 'Toxicity', desc: 'General toxic language', score: 0, class: 'safe' },
          { name: 'Hate Speech', desc: 'Targeting groups', score: 0, class: 'safe' },
          { name: 'Harassment', desc: 'Direct attacks', score: 0, class: 'safe' },
          { name: 'Profanity', desc: 'Vulgar language', score: 0, class: 'safe' }
        ],
        summary: 'Text too short for meaningful analysis.'
      };
    }

    const lower = text.toLowerCase();
    let totalScore = 0.05;
    const categoryScores = {};

    // Analyze each category
    for (const [cat, data] of Object.entries(DETECTION_CATEGORIES)) {
      let catScore = 0;
      data.keywords.forEach(word => {
        if (lower.includes(word)) {
          catScore += data.weight;
        }
      });
      categoryScores[cat] = Math.min(catScore, 0.98);
      totalScore += catScore;
    }

    // Additional heuristics
    if (text.length < 150 && /fuck|kys|retard|bitch|kill yourself/i.test(lower)) totalScore += 0.4;
    if (/[A-Z]{5,}/.test(text)) totalScore += 0.1; // ALL CAPS shouting
    if ((text.match(/[!]/g) || []).length > 2) totalScore += 0.05; // Multiple exclamation
    if (text.length > 300) totalScore *= 0.85; // Longer texts get slight reduction

    totalScore = Math.min(totalScore, 0.99);

    // Determine primary category and verdict
    let primaryCategory = 'safe';
    let maxScore = 0;
    for (const [cat, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxScore = score;
        primaryCategory = cat;
      }
    }

    let verdict = 'Safe';
    let verdictClass = 'safe';
    if (totalScore > 0.7) {
      verdict = 'Toxic Detected';
      verdictClass = 'toxic';
    } else if (totalScore > 0.4) {
      verdict = 'Suspicious';
      verdictClass = 'warning';
    }

    return {
      verdict,
      verdictClass,
      confidence: totalScore,
      primaryCategory,
      categories: [
        { name: 'Toxicity', desc: 'General toxic language', score: categoryScores.toxic, class: getScoreClass(categoryScores.toxic) },
        { name: 'Hate Speech', desc: 'Targeting groups', score: categoryScores.hate, class: getScoreClass(categoryScores.hate) },
        { name: 'Harassment', desc: 'Direct attacks', score: categoryScores.harassment, class: getScoreClass(categoryScores.harassment) },
        { name: 'Profanity', desc: 'Vulgar language', score: categoryScores.profanity, class: getScoreClass(categoryScores.profanity) }
      ],
      summary: totalScore > 0.5
        ? `This content contains potentially harmful language (${primaryCategory}). Confidence: ${(totalScore * 100).toFixed(1)}%`
        : 'This content appears to be safe and does not contain detected harmful language.'
    };
  }

  function getScoreClass(score) {
    if (score > 0.5) return 'danger';
    if (score > 0.2) return 'warning';
    return 'safe';
  }

  // ==========================================
  // Settings Management
  // ==========================================
  let currentSettings = {
    autoStart: true,
    notifications: true,
    sound: false,
    threshold: 0.75,
    catToxicity: true,
    catHate: true,
    catHarassment: true,
    catProfanity: false,
    autoBlur: true,
    confidenceOverlay: true,
    theme: 'dark',
    blurIntensity: 'medium',
    storeHistory: true,
    dataRetention: '30'
  };

  async function loadSettings() {
    const stored = await chrome.storage.local.get([
      'threshold', 'autoBlur', 'notifications', 'soundAlerts',
      'theme', 'blurIntensity', 'storeHistory', 'dataRetention',
      'catToxicity', 'catHate', 'catHarassment', 'catProfanity',
      'autoStart', 'confidenceOverlay'
    ]);

    currentSettings = {
      autoStart: stored.autoStart !== false,
      notifications: stored.notifications !== false,
      sound: stored.soundAlerts === true,
      threshold: stored.threshold ?? 0.75,
      catToxicity: stored.catToxicity !== false,
      catHate: stored.catHate !== false,
      catHarassment: stored.catHarassment !== false,
      catProfanity: stored.catProfanity === true,
      autoBlur: stored.autoBlur !== false,
      confidenceOverlay: stored.confidenceOverlay !== false,
      theme: stored.theme ?? 'dark',
      blurIntensity: stored.blurIntensity ?? 'medium',
      storeHistory: stored.storeHistory !== false,
      dataRetention: stored.dataRetention ?? '30'
    };

    // Apply to UI
    applySettingsToUI();
    return currentSettings;
  }

  function applySettingsToUI() {
    const s = currentSettings;
    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) {
        if (el.type === 'checkbox') el.checked = value;
        else el.value = value;
      }
    };

    setValue('setting-autostart', s.autoStart);
    setValue('setting-notifications', s.notifications);
    setValue('setting-sound', s.sound);
    setValue('sensitivity-slider', s.threshold);
    setValue('threshold-display', s.threshold);
    setValue('cat-toxicity', s.catToxicity);
    setValue('cat-hate', s.catHate);
    setValue('cat-harassment', s.catHarassment);
    setValue('cat-profanity', s.catProfanity);
    setValue('setting-autoblur', s.autoBlur);
    setValue('setting-confidence', s.confidenceOverlay);
    setValue('setting-theme', s.theme);
    setValue('setting-blur-intensity', s.blurIntensity);
    setValue('setting-store-history', s.storeHistory);
    setValue('setting-retention', s.dataRetention);

    // Update threshold display
    const threshDisplay = document.getElementById('threshold-display');
    if (threshDisplay) threshDisplay.textContent = parseFloat(s.threshold).toFixed(2);
  }

  async function saveSetting(key, value) {
    currentSettings[key] = value;
    const storageKey = {
      autoStart: 'autoStart',
      notifications: 'notifications',
      sound: 'soundAlerts',
      threshold: 'threshold',
      catToxicity: 'catToxicity',
      catHate: 'catHate',
      catHarassment: 'catHarassment',
      catProfanity: 'catProfanity',
      autoBlur: 'autoBlur',
      confidenceOverlay: 'confidenceOverlay',
      theme: 'theme',
      blurIntensity: 'blurIntensity',
      storeHistory: 'storeHistory',
      dataRetention: 'dataRetention'
    }[key];

    if (storageKey) {
      await chrome.storage.local.set({ [storageKey]: value });
    }
  }

  // ==========================================
  // Data Loading from Storage
  // ==========================================
  async function loadDashboardData() {
    try {
      const data = await chrome.storage.local.get([
        'toxicCount', 'blurCount', 'inferenceCount',
        'detectedHistory', 'dailyTrends', 'installDate'
      ]);

      // Calculate stats
      const toxicDetected = data.toxicCount || 0;
      const autoBlurred = data.blurCount || 0;
      const inferenceCount = data.inferenceCount || 0;

      // Calculate active days
      let activeDays = 0;
      if (data.installDate) {
        const days = Math.floor((Date.now() - data.installDate) / (1000 * 60 * 60 * 24));
        activeDays = Math.max(1, days);
      }

      // Format inferences number
      const inferences = inferenceCount > 1000
        ? (inferenceCount / 1000).toFixed(1) + 'K'
        : inferenceCount.toString();

      // Calculate safety score (higher blur ratio = more threats = lower score)
      let safetyScore = 94;
      if (inferenceCount > 0) {
        const threatRatio = toxicDetected / inferenceCount;
        safetyScore = Math.max(50, Math.round(100 - (threatRatio * 100)));
      }

      // Process history
      const historyEntries = (data.detectedHistory || []).map(item => ({
        ...item,
        time: getRelativeTime(item.timestamp)
      }));

      // Process trends data
      const trendsData = processTrendsData(data.dailyTrends || {});

      // Update dashboard data
      dashboardData = {
        ...dashboardData,
        safetyScore,
        stats: {
          toxicDetected,
          autoBlurred,
          inferences,
          activeDays
        },
        recentActivity: historyEntries.slice(0, 5),
        historyEntries,
        trendsData
      };

      return dashboardData;
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      return dashboardData;
    }
  }

  function getRelativeTime(timestamp) {
    if (!timestamp) return 'Unknown';
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  }

  function processTrendsData(dailyTrends) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date();
    const labels = [];
    const toxic = [];
    const suspicious = [];
    const safe = [];

    // Get last 7 days
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const dayData = dailyTrends[dateStr] || { toxic: 0, suspicious: 0, safe: 0 };

      labels.push(days[date.getDay()]);
      toxic.push(dayData.toxic || 0);
      suspicious.push(dayData.suspicious || 0);
      safe.push(dayData.safe || 0);
    }

    return { labels, toxic, suspicious, safe };
  }

  // ==========================================
  // Tab Switching
  // ==========================================
  function switchTab(tabName) {
    // Update nav items
    elements.navItems.forEach(item => {
      item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update panels
    elements.tabPanels.forEach(panel => {
      panel.classList.toggle('active', panel.id === `tab-${tabName}`);
    });

    // Update title
    const titles = {
      overview: 'Overview',
      analyzer: 'Live Text Analyzer',
      history: 'Activity History',
      settings: 'Settings',
      about: 'About SilentShield'
    };
    elements.pageTitle.textContent = titles[tabName] || 'Overview';

    currentTab = tabName;

    // Trigger tab-specific init
    if (tabName === 'overview') {
      renderChart();
    }
  }

  function switchSettingsTab(tabName) {
    elements.settingsNavItems.forEach(item => {
      item.classList.toggle('active', item.dataset.settings === tabName);
    });

    elements.settingsGroups.forEach(group => {
      group.classList.toggle('active', group.id === `settings-${tabName}`);
    });

    currentSettingsTab = tabName;
  }

  // ==========================================
  // Overview Functions
  // ==========================================
  function updateSafetyScore() {
    const score = dashboardData.safetyScore;
    elements.safetyScore.textContent = score;
    
    // Update circular progress
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (score / 100) * circumference;
    elements.scoreCircleFill.style.strokeDashoffset = offset;
    
    // Color based on score
    elements.scoreCircleFill.classList.remove('danger', 'amber');
    if (score < 50) {
      elements.scoreCircleFill.classList.add('danger');
      elements.scoreStatus.className = 'score-status danger';
      elements.scoreStatus.innerHTML = '<span class="status-indicator"></span>Critical threat level';
    } else if (score < 75) {
      elements.scoreCircleFill.classList.add('amber');
      elements.scoreStatus.className = 'score-status amber';
      elements.scoreStatus.innerHTML = '<span class="status-indicator"></span>Elevated risk detected';
    } else {
      elements.scoreStatus.className = 'score-status safe';
      elements.scoreStatus.innerHTML = '<span class="status-indicator"></span>Your feed is safe';
    }
  }

  function updateStats() {
    elements.toxicDetected.textContent = dashboardData.stats.toxicDetected;
    elements.autoBlurred.textContent = dashboardData.stats.autoBlurred;
    elements.inferences.textContent = dashboardData.stats.inferences;
    elements.activeDays.textContent = dashboardData.stats.activeDays;
  }

  function renderRecentActivity() {
    if (!elements.recentActivity) return;

    if (dashboardData.recentActivity.length === 0) {
      elements.recentActivity.innerHTML = `
        <div class="empty-state" style="padding: 24px; text-align: center;">
          <p style="color: var(--text-secondary);">No detections yet. Browse the web to see activity here.</p>
        </div>
      `;
      return;
    }

    elements.recentActivity.innerHTML = dashboardData.recentActivity.map(item => `
      <div class="activity-item">
        <div class="activity-icon ${item.category}">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${getCategoryIcon(item.category)}
          </svg>
        </div>
        <div class="activity-content">
          <div class="activity-text">${escapeHtml(item.text)}</div>
          <div class="activity-meta">
            <span class="activity-tag ${item.category}">${item.category}</span>
            <span>${item.source}</span>
          </div>
        </div>
        <div class="activity-time">${item.time}</div>
      </div>
    `).join('');
  }

  function getCategoryIcon(category) {
    const icons = {
      toxic: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>',
      hate: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path>',
      harassment: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>',
      cyber_bullying: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>'
    };
    return icons[category] || icons.toxic;
  }

  function renderChart() {
    const canvas = document.getElementById('trendsChart');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 20, bottom: 40, left: 50 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    // Colors
    const colors = {
      toxic: '#e05c6e',
      suspicious: '#d4913a',
      safe: '#34c77b'
    };

    // Find max value
    const allValues = [...dashboardData.trendsData.toxic, ...dashboardData.trendsData.suspicious, ...dashboardData.trendsData.safe];
    const maxValue = Math.max(...allValues, 10) * 1.1;

    // Draw grid lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Y-axis labels
      ctx.fillStyle = '#4a5d6f';
      ctx.font = '11px "IBM Plex Mono"';
      ctx.textAlign = 'right';
      const value = Math.round(maxValue - (maxValue / 4) * i);
      ctx.fillText(value.toString(), padding.left - 10, y + 4);
    }

    // Draw bars
    const barWidth = chartWidth / dashboardData.trendsData.labels.length / 4;
    const groupWidth = chartWidth / dashboardData.trendsData.labels.length;

    dashboardData.trendsData.labels.forEach((label, i) => {
      const x = padding.left + i * groupWidth;
      const centerX = x + groupWidth / 2;

      // Draw bars
      const toxicHeight = (dashboardData.trendsData.toxic[i] / maxValue) * chartHeight;
      const suspiciousHeight = (dashboardData.trendsData.suspicious[i] / maxValue) * chartHeight;
      const safeHeight = (dashboardData.trendsData.safe[i] / maxValue) * chartHeight;

      // Safe bar
      ctx.fillStyle = colors.safe;
      ctx.fillRect(centerX - barWidth * 1.5, padding.top + chartHeight - safeHeight, barWidth, safeHeight);

      // Suspicious bar
      ctx.fillStyle = colors.suspicious;
      ctx.fillRect(centerX - barWidth * 0.5, padding.top + chartHeight - suspiciousHeight, barWidth, suspiciousHeight);

      // Toxic bar
      ctx.fillStyle = colors.toxic;
      ctx.fillRect(centerX + barWidth * 0.5, padding.top + chartHeight - toxicHeight, barWidth, toxicHeight);

      // X-axis labels
      ctx.fillStyle = '#8b9aab';
      ctx.font = '12px "IBM Plex Sans"';
      ctx.textAlign = 'center';
      ctx.fillText(label, centerX, height - 15);
    });
  }

  // ==========================================
  // Live Analyzer Functions
  // ==========================================
  function updateCharCount() {
    if (!elements.analyzerText || !elements.charCount) return;
    const count = elements.analyzerText.value.length;
    elements.charCount.textContent = `${count} chars`;
  }

  async function runAnalysis() {
    if (isAnalyzing || !elements.analyzerText) return;

    const text = elements.analyzerText.value.trim();
    if (!text) {
      showAnalysisError('Please enter some text to analyze');
      return;
    }

    isAnalyzing = true;
    elements.analyzeBtn.disabled = true;
    elements.analyzeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10"></circle>
        <path d="M12 6v6l4 2"></path>
      </svg>
      Analyzing...
    `;

    // Short timeout for quick fallback
    const safetyTimeout = setTimeout(() => {
      if (isAnalyzing) {
        console.log('Safety timeout triggered - using improved local analyzer');
        // Use improved CyberAnalyzer
        const cyberResult = window.CyberAnalyzer ? CyberAnalyzer.analyze(text) : null;
        if (cyberResult) {
          displayCyberResult(cyberResult.result);
        } else {
          const localResult = analyzeTextReal(text);
          displayLocalResult(localResult);
        }
        isAnalyzing = false;
        elements.analyzeBtn.disabled = false;
        elements.analyzeBtn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
          Run Analysis
        `;
      }
    }, 3000);

    try {
      console.log('Sending analysis request for text:', text.substring(0, 50) + '...');
      
      const response = await chrome.runtime.sendMessage({ 
        action: 'analyzeWithGrok', 
        text: text 
      });

      console.log('Analysis response:', response);
      clearTimeout(safetyTimeout);

      // Check if we got a valid response
      if (response && (response.result || response.success)) {
        const aiResult = response.result || response;
        
        // Build full category list from background response
        const categories = [
          { name: 'Toxicity', desc: 'General toxic language', score: aiResult.category === 'toxic' ? (aiResult.confidence || 0.5) : 0, class: aiResult.category === 'toxic' ? (aiResult.severity || 'medium') : 'safe' },
          { name: 'Hate Speech', desc: 'Targeting groups', score: aiResult.category === 'hate' ? (aiResult.confidence || 0.5) : 0, class: aiResult.category === 'hate' ? (aiResult.severity || 'high') : 'safe' },
          { name: 'Harassment', desc: 'Direct attacks', score: aiResult.category === 'harassment' ? (aiResult.confidence || 0.5) : 0, class: aiResult.category === 'harassment' ? (aiResult.severity || 'high') : 'safe' },
          { name: 'Profanity', desc: 'Vulgar language', score: aiResult.category === 'profanity' ? (aiResult.confidence || 0.3) : 0, class: aiResult.category === 'profanity' ? (aiResult.severity || 'low') : 'safe' }
        ];
        
        const result = {
          verdict: aiResult.isToxic ? 'Toxic Detected' : 'Safe',
          verdictClass: aiResult.isToxic ? (aiResult.severity || 'medium') : 'safe',
          confidence: typeof aiResult.confidence === 'number' ? aiResult.confidence : 0.5,
          primaryCategory: aiResult.category || 'safe',
          categories: categories,
          summary: aiResult.explanation || 'Analysis completed'
        };

        displayAnalysisResult(result);

        // Add to history if toxic
        if (aiResult.isToxic && currentSettings.storeHistory) {
          await addToHistory({
            text: text.substring(0, 200),
            category: aiResult.category || 'toxic',
            confidence: Math.round((aiResult.confidence || 0) * 100) + '%',
            score: aiResult.confidence || 0,
            source: 'Cyberbullying AI Expert',
            action: 'Analyzed'
          });
        }
      } else {
        // No valid response - use local analysis
        console.log('No valid response, using local analysis');
        const localResult = analyzeTextReal(text);
        displayLocalResult(localResult);
      }

    } catch (error) {
      console.error('Analysis error:', error);
      clearTimeout(safetyTimeout);
      // Use improved CyberAnalyzer on error
      const cyberResult = window.CyberAnalyzer ? CyberAnalyzer.analyze(text) : null;
      if (cyberResult) {
        displayCyberResult(cyberResult.result);
      } else {
        const localResult = analyzeTextReal(text);
        displayLocalResult(localResult);
      }
    }

    isAnalyzing = false;
    elements.analyzeBtn.disabled = false;
    elements.analyzeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      Run Analysis
    `;
  }

  // Helper function to display local analysis result
  function displayLocalResult(localResult) {
    // Ensure all required fields exist with defaults
    const result = {
      verdict: localResult.verdict || 'Safe',
      verdictClass: localResult.verdictClass || 'safe',
      confidence: typeof localResult.confidence === 'number' ? localResult.confidence : 0,
      primaryCategory: localResult.primaryCategory || 'safe',
      categories: localResult.categories || [
        { name: 'Toxicity', desc: 'General toxic language', score: 0, class: 'safe' },
        { name: 'Hate Speech', desc: 'Targeting groups', score: 0, class: 'safe' },
        { name: 'Harassment', desc: 'Direct attacks', score: 0, class: 'safe' },
        { name: 'Profanity', desc: 'Vulgar language', score: 0, class: 'safe' }
      ],
      summary: localResult.summary || 'Analysis completed.'
    };
    displayAnalysisResult(result);
  }

  // Helper function to display CyberAnalyzer result with improved accuracy
  function displayCyberResult(cyberResult) {
    const scores = cyberResult.allScores || {};
    const confidence = typeof cyberResult.confidence === 'number' ? cyberResult.confidence : 0;
    
    const result = {
      verdict: cyberResult.isToxic ? 'Toxic Detected' : 'Safe',
      verdictClass: cyberResult.isToxic ? (cyberResult.severity || 'medium') : 'safe',
      confidence: confidence,
      primaryCategory: cyberResult.category || 'safe',
      categories: [
        { name: 'Toxicity', desc: 'General toxic language', score: scores.toxic || 0, class: getScoreClass(scores.toxic || 0) },
        { name: 'Hate Speech', desc: 'Targeting groups', score: scores.hate || 0, class: getScoreClass(scores.hate || 0) },
        { name: 'Harassment', desc: 'Direct attacks', score: scores.harassment || 0, class: getScoreClass(scores.harassment || 0) },
        { name: 'Profanity', desc: 'Vulgar language', score: scores.profanity || 0, class: getScoreClass(scores.profanity || 0) }
      ],
      summary: cyberResult.explanation || 'Analysis completed.'
    };
    displayAnalysisResult(result);
  }

  async function addToHistory(detection) {
    const data = await chrome.storage.local.get(['detectedHistory']);
    const history = data.detectedHistory || [];

    const newItem = {
      id: Date.now() + Math.random(),
      ...detection,
      timestamp: Date.now(),
      time: 'Just now'
    };

    history.unshift(newItem);
    if (history.length > 100) history.pop();

    await chrome.storage.local.set({ detectedHistory: history });

    // Refresh dashboard data
    await loadDashboardData();
    renderRecentActivity();
    if (currentTab === 'history') {
      renderHistory(currentFilter, elements.historySearch?.value || '');
    }
  }

  // Removed - using analyzeTextReal instead
  function generateMockResultLegacy(text) {
    // Simple keyword-based detection for demo
    const toxicKeywords = ['worthless', 'stupid', 'hate', 'terrible', 'disappear', 'die', 'kill', 'idiot', 'loser'];
    const hateKeywords = ['group', 'people', 'race', 'religion', 'gender', 'belong', 'allowed', 'banned'];
    const harassmentKeywords = ['find you', 'watch your back', 'regret', 'going to', 'know where', 'threaten'];

    let toxicScore = 0.05;
    let hateScore = 0.03;
    let harassmentScore = 0.02;
    let profanityScore = 0.01;

    const lowerText = text.toLowerCase();

    toxicKeywords.forEach(word => {
      if (lowerText.includes(word)) toxicScore += 0.25;
    });

    hateKeywords.forEach(word => {
      if (lowerText.includes(word)) hateScore += 0.20;
    });

    harassmentKeywords.forEach(word => {
      if (lowerText.includes(word)) harassmentScore += 0.30;
    });

    // Cap scores
    toxicScore = Math.min(toxicScore, 0.98);
    hateScore = Math.min(hateScore, 0.98);
    harassmentScore = Math.min(harassmentScore, 0.98);

    const maxScore = Math.max(toxicScore, hateScore, harassmentScore);
    let verdict = 'Safe';
    let verdictClass = 'safe';

    if (maxScore > 0.7) {
      verdict = 'Toxic Detected';
      verdictClass = 'toxic';
    } else if (maxScore > 0.4) {
      verdict = 'Suspicious';
      verdictClass = 'warning';
    }

    return {
      verdict,
      verdictClass,
      confidence: maxScore,
      categories: [
        { name: 'Toxicity', desc: 'General toxic language', score: toxicScore, class: toxicScore > 0.5 ? 'danger' : toxicScore > 0.2 ? 'warning' : 'safe' },
        { name: 'Hate Speech', desc: 'Targeting groups', score: hateScore, class: hateScore > 0.5 ? 'danger' : hateScore > 0.2 ? 'warning' : 'safe' },
        { name: 'Harassment', desc: 'Direct attacks', score: harassmentScore, class: harassmentScore > 0.5 ? 'danger' : harassmentScore > 0.2 ? 'warning' : 'safe' },
        { name: 'Profanity', desc: 'Vulgar language', score: profanityScore, class: profanityScore > 0.5 ? 'danger' : profanityScore > 0.2 ? 'warning' : 'safe' }
      ],
      summary: maxScore > 0.5 
        ? 'This content contains potentially harmful language that may be considered toxic or inappropriate.'
        : 'This content appears to be safe and does not contain detected harmful language.'
    };
  }

  function displayAnalysisResult(result) {
    if (!elements.analysisContent || !elements.resultBadge || !elements.categoryList || !elements.categoriesCard) return;

    const verdict = result.verdict || 'Safe';
    const verdictClass = result.verdictClass || 'safe';
    const summary = result.summary || 'Analysis completed';
    const categories = result.categories || [];

    // Update badge
    elements.resultBadge.className = `result-badge ${verdictClass}`;
    elements.resultBadge.textContent = verdict;

    // Update main result - simplified without confidence
    elements.analysisContent.innerHTML = `
      <div class="analysis-result">
        <div class="result-header">
          <span class="result-verdict ${verdictClass}">${verdict}</span>
        </div>
        <div class="result-summary">${summary}</div>
      </div>
    `;

    // Show and update categories - simplified without percentage
    elements.categoriesCard.style.display = 'block';
    elements.categoryList.innerHTML = categories.map(cat => {
      const score = typeof cat.score === 'number' && !isNaN(cat.score) ? cat.score : 0;
      const hasDetection = score > 0.2;
      return `
        <div class="category-item">
          <div class="category-info">
            <div class="category-name">${cat.name || 'Unknown'}</div>
            <div class="category-desc">${cat.desc || ''}</div>
          </div>
          <div class="category-bar">
            <div class="category-fill ${cat.class || 'safe'}" style="width: ${score * 100}%"></div>
          </div>
          <div class="category-score">${hasDetection ? '✓' : '–'}</div>
        </div>
      `;
    }).join('');
  }

  function showAnalysisError(message) {
    if (!elements.analysisContent) return;
    elements.analysisContent.innerHTML = `
      <div class="empty-state" style="color: var(--danger);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="12" y1="8" x2="12" y2="12"></line>
          <line x1="12" y1="16" x2="12.01" y2="16"></line>
        </svg>
        <p>${message}</p>
      </div>
    `;
  }

  function clearAnalyzer() {
    if (elements.analyzerText) elements.analyzerText.value = '';
    updateCharCount();
    
    if (elements.analysisContent) {
      elements.analysisContent.innerHTML = `
        <div class="empty-state">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
          </svg>
          <p>Enter text and click "Run Analysis" to see results</p>
        </div>
      `;
    }
    
    if (elements.resultBadge) {
      elements.resultBadge.className = 'result-badge ready';
      elements.resultBadge.textContent = 'Ready';
    }
    
    if (elements.categoriesCard) {
      elements.categoriesCard.style.display = 'none';
    }
  }

  function loadTestSample(type) {
    if (!elements.analyzerText) return;
    elements.analyzerText.value = dashboardData.testSamples[type] || '';
    updateCharCount();
    clearAnalyzer();
  }

  // ==========================================
  // History Functions
  // ==========================================
  function renderHistory(filter = 'all', search = '') {
    if (!elements.historyTbody) return;

    let filtered = dashboardData.historyEntries;

    if (filter !== 'all') {
      filtered = filtered.filter(item => item.category === filter);
    }

    if (search) {
      filtered = filtered.filter(item => 
        item.text.toLowerCase().includes(search.toLowerCase())
      );
    }

    elements.historyTbody.innerHTML = filtered.map(item => `
      <tr>
        <td>
          <div class="history-content" title="${escapeHtml(item.text)}">${escapeHtml(item.text)}</div>
        </td>
        <td>
          <span class="history-category ${item.category}">${item.category}</span>
        </td>
        <td>
          <span class="history-confidence">${item.confidence}</span>
        </td>
        <td>
          <span class="history-source">${item.source}</span>
        </td>
        <td>
          <span class="history-time">${item.time}</span>
        </td>
        <td>
          <button class="history-action-btn" onclick="deleteHistoryItem(${item.id})">Delete</button>
        </td>
      </tr>
    `).join('');

    if (elements.totalEntries) {
      elements.totalEntries.textContent = dashboardData.historyEntries.length;
    }
    if (elements.historyCount) {
      elements.historyCount.textContent = dashboardData.historyEntries.length;
    }
  }

  async function clearAllHistory() {
    if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      await chrome.storage.local.set({
        toxicCount: 0,
        blurCount: 0,
        inferenceCount: 0,
        detectedHistory: [],
        dailyTrends: {}
      });
      await loadDashboardData();
      renderHistory();
      updateStats();
      updateSafetyScore();
      renderRecentActivity();
      renderChart();
      alert('All history has been cleared.');
    }
  }

  async function deleteHistoryItem(id) {
    // Remove from storage
    const data = await chrome.storage.local.get(['detectedHistory']);
    const history = (data.detectedHistory || []).filter(item => item.id !== id);
    await chrome.storage.local.set({ detectedHistory: history });

    // Reload and refresh
    await loadDashboardData();
    renderHistory(currentFilter, elements.historySearch?.value || '');
  }

  // ==========================================
  // Settings Functions
  // ==========================================
  function updateSensitivity(value) {
    if (elements.thresholdDisplay) {
      elements.thresholdDisplay.textContent = parseFloat(value).toFixed(2);
    }
  }


  async function resetAllSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      const defaults = {
        autoStart: true,
        notifications: true,
        soundAlerts: false,
        threshold: 0.75,
        catToxicity: true,
        catHate: true,
        catHarassment: true,
        catProfanity: false,
        autoBlur: true,
        confidenceOverlay: true,
        theme: 'dark',
        blurIntensity: 'medium',
        storeHistory: true,
        dataRetention: '30'
      };

      await chrome.storage.local.set(defaults);
      await loadSettings();
      applySettingsToUI();

      alert('Settings have been reset to default.');
    }
  }

  // ==========================================
  // Utility Functions
  // ==========================================
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function exportData() {
    const data = {
      exportDate: new Date().toISOString(),
      safetyScore: dashboardData.safetyScore,
      stats: dashboardData.stats,
      history: dashboardData.historyEntries
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `silentshield-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function refreshData() {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      Refreshing...
    `;

    await loadDashboardData();
    updateSafetyScore();
    updateStats();
    renderRecentActivity();
    renderHistory(currentFilter, elements.historySearch?.value || '');
    if (currentTab === 'overview') renderChart();

    elements.refreshBtn.disabled = false;
    elements.refreshBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="23 4 23 10 17 10"></polyline>
        <polyline points="1 20 1 14 7 14"></polyline>
        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
      </svg>
      Refresh
    `;
  }

  // ==========================================
  // Event Listeners
  // ==========================================
  function initEventListeners() {
    // Tab navigation
    elements.navItems.forEach(item => {
      item.addEventListener('click', () => switchTab(item.dataset.tab));
    });

    // Settings sub-navigation
    elements.settingsNavItems.forEach(item => {
      item.addEventListener('click', () => switchSettingsTab(item.dataset.settings));
    });

    // Analyzer
    if (elements.analyzerText) {
      elements.analyzerText.addEventListener('input', updateCharCount);
    }
    if (elements.analyzeBtn) {
      elements.analyzeBtn.addEventListener('click', runAnalysis);
    }
    if (elements.clearBtn) {
      elements.clearBtn.addEventListener('click', clearAnalyzer);
    }
    elements.testChips.forEach(chip => {
      chip.addEventListener('click', () => loadTestSample(chip.dataset.test));
    });

    // History filters
    elements.filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        elements.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderHistory(currentFilter, elements.historySearch?.value || '');
      });
    });

    if (elements.historySearch) {
      elements.historySearch.addEventListener('input', (e) => {
        renderHistory(currentFilter, e.target.value);
      });
    }

    // Settings - General
    document.getElementById('setting-autostart')?.addEventListener('change', (e) => saveSetting('autoStart', e.target.checked));
    document.getElementById('setting-notifications')?.addEventListener('change', (e) => saveSetting('notifications', e.target.checked));
    document.getElementById('setting-sound')?.addEventListener('change', (e) => saveSetting('sound', e.target.checked));

    // Settings - Detection
    if (elements.sensitivitySlider) {
      elements.sensitivitySlider.addEventListener('input', (e) => {
        updateSensitivity(e.target.value);
        saveSetting('threshold', parseFloat(e.target.value));
      });
    }

    document.getElementById('cat-toxicity')?.addEventListener('change', (e) => saveSetting('catToxicity', e.target.checked));
    document.getElementById('cat-hate')?.addEventListener('change', (e) => saveSetting('catHate', e.target.checked));
    document.getElementById('cat-harassment')?.addEventListener('change', (e) => saveSetting('catHarassment', e.target.checked));
    document.getElementById('cat-profanity')?.addEventListener('change', (e) => saveSetting('catProfanity', e.target.checked));
    document.getElementById('setting-autoblur')?.addEventListener('change', (e) => saveSetting('autoBlur', e.target.checked));
    document.getElementById('setting-confidence')?.addEventListener('change', (e) => saveSetting('confidenceOverlay', e.target.checked));

    // Settings - Display
    document.getElementById('setting-theme')?.addEventListener('change', (e) => saveSetting('theme', e.target.value));
    document.getElementById('setting-blur-intensity')?.addEventListener('change', (e) => saveSetting('blurIntensity', e.target.value));

    // Settings - Privacy
    document.getElementById('setting-store-history')?.addEventListener('change', (e) => saveSetting('storeHistory', e.target.checked));
    document.getElementById('setting-retention')?.addEventListener('change', (e) => saveSetting('dataRetention', e.target.value));

    // Action buttons
    if (elements.refreshBtn) {
      elements.refreshBtn.addEventListener('click', refreshData);
    }
    if (elements.exportBtn) {
      elements.exportBtn.addEventListener('click', exportData);
    }
    if (elements.clearHistoryBtn) {
      elements.clearHistoryBtn.addEventListener('click', clearAllHistory);
    }
    if (elements.resetSettingsBtn) {
      elements.resetSettingsBtn.addEventListener('click', resetAllSettings);
    }

    // Handle "View All" button in recent activity
    document.querySelectorAll('.btn-text[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Window resize for chart
    window.addEventListener('resize', () => {
      if (currentTab === 'overview') {
        renderChart();
      }
    });
  }

  // ==========================================
  // Firebase Auth
  // ==========================================
  let currentUser = null;
  let isLoginTab = true; // true = sign in, false = sign up

  // Auth UI elements
  const authElements = {
    tabSignin: document.getElementById('auth-tab-signin'),
    tabSignup: document.getElementById('auth-tab-signup'),
    emailInput: document.getElementById('auth-email'),
    passwordInput: document.getElementById('auth-password'),
    confirmPasswordInput: document.getElementById('auth-confirm-password'),
    submitBtn: document.getElementById('auth-submit-btn'),
    errorDiv: document.getElementById('auth-error'),
    stateLoggedOut: document.getElementById('state-logged-out'),
    stateLoggedIn: document.getElementById('state-logged-in'),
    profileAvatar: document.getElementById('profile-avatar'),
    profileName: document.getElementById('profile-name'),
    profileEmail: document.getElementById('profile-email'),
    syncBadge: document.getElementById('sync-badge'),
    syncBadgeLabel: document.getElementById('sync-badge-label'),
    syncLastTime: document.getElementById('sync-last-time'),
    syncNowBtn: document.getElementById('sync-now-btn'),
    signoutBtn: document.getElementById('auth-signout-btn')
  };

  function initAuthListeners() {
    // Tab switching
    authElements.tabSignin?.addEventListener('click', () => switchAuthTab('signin'));
    authElements.tabSignup?.addEventListener('click', () => switchAuthTab('signup'));

    // Form submission
    authElements.submitBtn?.addEventListener('click', handleAuthSubmit);

    // Sign out
    authElements.signoutBtn?.addEventListener('click', handleSignOut);

    // Sync now
    authElements.syncNowBtn?.addEventListener('click', handleSyncNow);

    // Enter key on password field
    authElements.passwordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAuthSubmit();
    });
    authElements.confirmPasswordInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') handleAuthSubmit();
    });

    // Listen for auth state changes from other tabs
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      if (changes.firebaseUID || changes.firebaseToken || changes.firebaseSyncEnabled) {
        checkAuthState();
      }
    });
  }

  function switchAuthTab(tab) {
    isLoginTab = tab === 'signin';
    authElements.tabSignin?.classList.toggle('active', isLoginTab);
    authElements.tabSignup?.classList.toggle('active', !isLoginTab);

    if (authElements.confirmPasswordInput) {
      authElements.confirmPasswordInput.style.display = isLoginTab ? 'none' : 'block';
    }
    if (authElements.submitBtn) {
      authElements.submitBtn.textContent = isLoginTab ? 'Sign In' : 'Create Account';
    }
    hideAuthError();
  }

  function showAuthError(message) {
    if (authElements.errorDiv) {
      authElements.errorDiv.textContent = message;
      authElements.errorDiv.classList.add('visible');
    }
  }

  function hideAuthError() {
    if (authElements.errorDiv) {
      authElements.errorDiv.textContent = '';
      authElements.errorDiv.classList.remove('visible');
    }
  }

  function setLoading(loading) {
    if (authElements.submitBtn) {
      authElements.submitBtn.disabled = loading;
      if (loading) {
        authElements.submitBtn.innerHTML = '<span class="spin-icon">↻</span> Please wait...';
      } else {
        authElements.submitBtn.textContent = isLoginTab ? 'Sign In' : 'Create Account';
      }
    }
  }

  async function handleAuthSubmit() {
    const email = authElements.emailInput?.value.trim() || '';
    const password = authElements.passwordInput?.value || '';
    const confirmPassword = authElements.confirmPasswordInput?.value || '';

    if (!email || !password) {
      showAuthError('Please enter both email and password');
      return;
    }

    if (!isLoginTab && password !== confirmPassword) {
      showAuthError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    hideAuthError();

    try {
      if (isLoginTab) {
        // Sign in
        const userCredential = await firebase.auth().signInWithEmailAndPassword(email, password);
        await handleAuthSuccess(userCredential.user);
      } else {
        // Sign up
        const userCredential = await firebase.auth().createUserWithEmailAndPassword(email, password);
        await handleAuthSuccess(userCredential.user);
      }
    } catch (error) {
      console.error('Auth error:', error);
      let message = 'Authentication failed';
      switch (error.code) {
        case 'auth/invalid-email':
          message = 'Invalid email address';
          break;
        case 'auth/user-not-found':
          message = 'No account found with this email';
          break;
        case 'auth/wrong-password':
          message = 'Incorrect password';
          break;
        case 'auth/email-already-in-use':
          message = 'An account already exists with this email';
          break;
        case 'auth/weak-password':
          message = 'Password is too weak';
          break;
        case 'auth/invalid-credential':
          message = 'Invalid email or password';
          break;
        default:
          message = error.message || 'Authentication failed';
      }
      showAuthError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuthSuccess(user) {
    currentUser = user;

    // Get ID token
    const token = await user.getIdToken();

    // Store auth data for content.js to use
    await chrome.storage.local.set({
      firebaseUID: user.uid,
      firebaseToken: token,
      firebaseSyncEnabled: true,
      firebaseEmail: user.email,
      firebaseDisplayName: user.displayName || user.email?.split('@')[0] || 'User'
    });

    updateAuthUI(user);
    hideAuthError();

    // Clear form
    if (authElements.emailInput) authElements.emailInput.value = '';
    if (authElements.passwordInput) authElements.passwordInput.value = '';
    if (authElements.confirmPasswordInput) authElements.confirmPasswordInput.value = '';

    // Trigger initial sync
    await handleSyncNow();
  }

  async function handleSignOut() {
    try {
      await firebase.auth().signOut();
      currentUser = null;

      // Clear stored auth data
      await chrome.storage.local.set({
        firebaseUID: null,
        firebaseToken: null,
        firebaseSyncEnabled: false
      });

      updateAuthUI(null);
    } catch (error) {
      console.error('Sign out error:', error);
      showAuthError('Failed to sign out');
    }
  }

  async function handleSyncNow() {
    if (!currentUser) return;

    const btn = authElements.syncNowBtn;
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="spin-icon">↻</span> Syncing...';
    }

    try {
        // Refresh token
        const token = await currentUser.getIdToken(true);
        await chrome.storage.local.set({ firebaseToken: token });

        // Get all relevant data from local storage
        const data = await chrome.storage.local.get([
            'toxicCount', 
            'blurCount', 
            'inferenceCount', 
            'installDate',
            'detectedHistory',
            'dailyTrends'
        ]);

        const toxicCount = data.toxicCount || 0;
        const blurCount = data.blurCount || 0;
        const inferenceCount = data.inferenceCount || 0;
        const detectedHistory = data.detectedHistory || [];
        const dailyTrends = data.dailyTrends || {};

        // Calculate safety score
        let safetyScore = 94;
        if (inferenceCount > 0) {
            const threatRatio = toxicCount / inferenceCount;
            safetyScore = Math.max(50, Math.round(100 - threatRatio * 100));
        }

        let riskLevel = 'low';
        if (safetyScore < 50) riskLevel = 'high';
        else if (safetyScore < 75) riskLevel = 'elevated';

        const installDate = data.installDate || Date.now();
        const activeDays = Math.max(1, Math.floor((Date.now() - installDate) / (1000 * 60 * 60 * 24)));

        const projectId = 'silentshield-39e11';
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users/${currentUser.uid}/dashboard/summary`;

        // Updated payload with history items included
        const payload = {
            fields: {
                safetyScore: { integerValue: String(safetyScore) },
                toxicDetected: { integerValue: String(toxicCount) },
                autoBlurred: { integerValue: String(blurCount) },
                inferences: { integerValue: String(inferenceCount) },
                activeDays: { integerValue: String(activeDays) },
                riskLevel: { stringValue: riskLevel },
                lastSyncedAt: { integerValue: String(Date.now()) },
                
                // === Added/Improved Fields ===
                toxicCount: { integerValue: String(toxicCount) },
                blurCount: { integerValue: String(blurCount) },
                inferenceCount: { integerValue: String(inferenceCount) },
                installDate: { integerValue: String(installDate) },
                
                // History items (array)
                detectedHistory: {
                    arrayValue: {
                        values: detectedHistory.map(item => ({
                            mapValue: {
                                fields: {
                                    id: { stringValue: String(item.id || Date.now()) },
                                    text: { stringValue: item.text || '' },
                                    category: { stringValue: item.category || 'toxic' },
                                    confidence: { stringValue: item.confidence || '' },
                                    score: { doubleValue: item.score || 0 },
                                    source: { stringValue: item.source || 'Unknown' },
                                    action: { stringValue: item.action || 'Detected' },
                                    timestamp: { integerValue: String(item.timestamp || Date.now()) }
                                }
                            }
                        }))
                    }
                },

                // Daily trends
                dailyTrends: {
                    mapValue: {
                        fields: Object.keys(dailyTrends).reduce((acc, date) => {
                            acc[date] = {
                                mapValue: {
                                    fields: {
                                        toxic: { integerValue: String(dailyTrends[date].toxic || 0) },
                                        suspicious: { integerValue: String(dailyTrends[date].suspicious || 0) },
                                        safe: { integerValue: String(dailyTrends[date].safe || 0) }
                                    }
                                }
                            };
                            return acc;
                        }, {})
                    }
                }
            }
        };

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Sync failed: ${response.status} - ${errorText}`);
        }

        // Success
        updateSyncTime(Date.now());
        console.log('✅ Dashboard + History synced to Firebase successfully');

    } catch (error) {
        console.error('Sync error:', error);
        if (authElements.syncBadgeLabel) {
            authElements.syncBadgeLabel.textContent = 'Sync failed';
        }
        if (authElements.syncBadge) {
            authElements.syncBadge.classList.remove('sync-badge');
            authElements.syncBadge.classList.add('sync-badge-off');
        }
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = `
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                </svg>
                Sync Now
            `;
        }
    }
}

  function updateSyncTime(timestamp) {
    if (authElements.syncLastTime) {
      const date = new Date(timestamp);
      authElements.syncLastTime.textContent = 'Last sync: ' + date.toLocaleTimeString();
    }
    if (authElements.syncBadge) {
      authElements.syncBadge.classList.remove('sync-badge-off');
      authElements.syncBadge.classList.add('sync-badge');
    }
    if (authElements.syncBadgeLabel) {
      authElements.syncBadgeLabel.textContent = 'Cloud sync active';
    }
  }

  function updateAuthUI(user) {
    if (!authElements.stateLoggedOut || !authElements.stateLoggedIn) return;

    if (user) {
      // Show logged-in state
      authElements.stateLoggedOut.classList.remove('active');
      authElements.stateLoggedIn.classList.add('active');

      // Update profile info
      const displayName = user.displayName || user.email?.split('@')[0] || 'User';
      const initials = displayName.substring(0, 2).toUpperCase();

      if (authElements.profileAvatar) {
        authElements.profileAvatar.textContent = initials;
      }
      if (authElements.profileName) {
        authElements.profileName.textContent = displayName;
      }
      if (authElements.profileEmail) {
        authElements.profileEmail.textContent = user.email || '';
      }

      // Update sync status
      updateSyncTime(Date.now());
    } else {
      // Show logged-out state
      authElements.stateLoggedOut.classList.add('active');
      authElements.stateLoggedIn.classList.remove('active');

      // Clear profile info
      if (authElements.profileAvatar) authElements.profileAvatar.textContent = '?';
      if (authElements.profileName) authElements.profileName.textContent = '—';
      if (authElements.profileEmail) authElements.profileEmail.textContent = '—';
      if (authElements.syncLastTime) authElements.syncLastTime.textContent = '—';
      if (authElements.syncBadgeLabel) authElements.syncBadgeLabel.textContent = 'Not synced';
      if (authElements.syncBadge) {
        authElements.syncBadge.classList.remove('sync-badge');
        authElements.syncBadge.classList.add('sync-badge-off');
      }
    }
  }

  async function checkAuthState() {
    // Check if Firebase is initialized
    if (typeof firebase === 'undefined' || !firebase.auth) {
      console.warn('Firebase not available - waiting for SDK to load...');
      // Retry after a short delay
      setTimeout(checkAuthState, 500);
      return;
    }

    // Listen to auth state changes
    firebase.auth().onAuthStateChanged(async (user) => {
      if (user) {
        currentUser = user;
        // Refresh token
        const token = await user.getIdToken();
        await chrome.storage.local.set({
          firebaseUID: user.uid,
          firebaseToken: token,
          firebaseSyncEnabled: true
        });
        updateAuthUI(user);
      } else {
        currentUser = null;
        updateAuthUI(null);
      }
    });

    // Also check stored auth state
    const stored = await chrome.storage.local.get(['firebaseUID', 'firebaseSyncEnabled']);
    if (stored.firebaseUID && stored.firebaseSyncEnabled) {
      // User should be signed in, Firebase will verify via onAuthStateChanged
      console.log('Found stored auth state for UID:', stored.firebaseUID);
    }
  }

  // ==========================================
  // Initialize
  // ==========================================
  async function init() {
    await loadSettings();
    await loadDashboardData();
    updateSafetyScore();
    updateStats();
    renderRecentActivity();
    renderHistory();
    updateCharCount();
    initEventListeners();
    initAuthListeners();

    // Initialize Firebase auth
    await checkAuthState();

    // Render chart after a short delay to ensure canvas is ready
    setTimeout(renderChart, 100);

    // Auto-refresh every 30 seconds
    setInterval(async () => {
      await loadDashboardData();
      updateStats();
      renderRecentActivity();
      if (currentTab === 'history') {
        renderHistory(currentFilter, elements.historySearch?.value || '');
      }
      if (currentTab === 'overview') {
        renderChart();
        updateSafetyScore();
      }
    }, 30000);

    // Periodic token refresh every 50 minutes (tokens expire after 1 hour)
    setInterval(async () => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true);
          await chrome.storage.local.set({ firebaseToken: token });
          console.log('Token refreshed');
        } catch (error) {
          console.error('Token refresh failed:', error);
        }
      }
    }, 50 * 60 * 1000);
  }

  // Start the dashboard
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose delete function globally for inline onclick handlers
  window.deleteHistoryItem = deleteHistoryItem;

})();
