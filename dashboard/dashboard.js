/**
 * SilentShield Dashboard
 * Comprehensive dashboard for cyberbullying protection analytics
 */

(function() {
  'use strict';

  // ==========================================
  // Sample Data (Placeholder)
  // ==========================================
  const sampleData = {
    safetyScore: 94,
    stats: {
      toxicDetected: 127,
      autoBlurred: 89,
      inferences: '2.4K',
      activeDays: 14
    },
    recentActivity: [
      { id: 1, text: 'You are such a worthless person, nobody likes you', category: 'toxic', confidence: 0.94, source: 'X (Twitter)', time: '2 min ago' },
      { id: 2, text: 'This group of people should not be allowed here', category: 'hate', confidence: 0.89, source: 'Reddit', time: '5 min ago' },
      { id: 3, text: 'I am going to find you and make you regret everything', category: 'harassment', confidence: 0.87, source: 'Facebook', time: '12 min ago' },
      { id: 4, text: 'Why are you even alive? Just disappear already', category: 'toxic', confidence: 0.96, source: 'Instagram', time: '18 min ago' },
      { id: 5, text: 'Go back to where you came from, you don\'t belong here', category: 'hate', confidence: 0.91, source: 'X (Twitter)', time: '25 min ago' },
    ],
    historyEntries: [
      { id: 1, text: 'You are such a worthless person, nobody likes you', category: 'toxic', confidence: '94%', source: 'X (Twitter)', time: '2 min ago', action: 'Blurred' },
      { id: 2, text: 'This group of people should not be allowed here', category: 'hate', confidence: '89%', source: 'Reddit', time: '5 min ago', action: 'Blurred' },
      { id: 3, text: 'I am going to find you and make you regret everything', category: 'harassment', confidence: '87%', source: 'Facebook', time: '12 min ago', action: 'Blurred' },
      { id: 4, text: 'Why are you even alive? Just disappear already', category: 'toxic', confidence: '96%', source: 'Instagram', time: '18 min ago', action: 'Blurred' },
      { id: 5, text: 'Go back to where you came from, you don\'t belong here', category: 'hate', confidence: '91%', source: 'X (Twitter)', time: '25 min ago', action: 'Blurred' },
      { id: 6, text: 'You\'re so stupid, can\'t you do anything right?', category: 'toxic', confidence: '82%', source: 'Reddit', time: '32 min ago', action: 'Blurred' },
      { id: 7, text: 'I know where you live, watch your back', category: 'harassment', confidence: '93%', source: 'Facebook', time: '45 min ago', action: 'Blocked' },
      { id: 8, text: 'People like you ruin everything for everyone else', category: 'toxic', confidence: '78%', source: 'Instagram', time: '1 hour ago', action: 'Blurred' },
      { id: 9, text: 'Your kind should be banned from this platform', category: 'hate', confidence: '85%', source: 'X (Twitter)', time: '1 hour ago', action: 'Blurred' },
      { id: 10, text: 'Keep talking and see what happens to you', category: 'harassment', confidence: '88%', source: 'Reddit', time: '2 hours ago', action: 'Blocked' },
    ],
    trendsData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      toxic: [12, 19, 15, 22, 18, 25, 14],
      suspicious: [8, 12, 10, 15, 11, 14, 9],
      safe: [180, 195, 188, 172, 190, 165, 178]
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
    const score = sampleData.safetyScore;
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
    elements.toxicDetected.textContent = sampleData.stats.toxicDetected;
    elements.autoBlurred.textContent = sampleData.stats.autoBlurred;
    elements.inferences.textContent = sampleData.stats.inferences;
    elements.activeDays.textContent = sampleData.stats.activeDays;
  }

  function renderRecentActivity() {
    if (!elements.recentActivity) return;
    
    elements.recentActivity.innerHTML = sampleData.recentActivity.map(item => `
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
      harassment: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>'
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
    const allValues = [...sampleData.trendsData.toxic, ...sampleData.trendsData.suspicious, ...sampleData.trendsData.safe];
    const maxValue = Math.max(...allValues) * 1.1;

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
    const barWidth = chartWidth / sampleData.trendsData.labels.length / 4;
    const groupWidth = chartWidth / sampleData.trendsData.labels.length;

    sampleData.trendsData.labels.forEach((label, i) => {
      const x = padding.left + i * groupWidth;
      const centerX = x + groupWidth / 2;

      // Draw bars
      const toxicHeight = (sampleData.trendsData.toxic[i] / maxValue) * chartHeight;
      const suspiciousHeight = (sampleData.trendsData.suspicious[i] / maxValue) * chartHeight;
      const safeHeight = (sampleData.trendsData.safe[i] / maxValue) * chartHeight;

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
      </svg>
      Analyzing...
    `;

    // Simulate analysis delay
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Generate mock results based on text content
    const result = generateMockResult(text);
    displayAnalysisResult(result);

    isAnalyzing = false;
    elements.analyzeBtn.disabled = false;
    elements.analyzeBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
      </svg>
      Run Analysis
    `;
  }

  function generateMockResult(text) {
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

    // Update badge
    elements.resultBadge.className = `result-badge ${result.verdictClass}`;
    elements.resultBadge.textContent = result.verdict;

    // Update main result
    elements.analysisContent.innerHTML = `
      <div class="analysis-result">
        <div class="result-header">
          <span class="result-verdict ${result.verdictClass}">${result.verdict}</span>
          <div class="result-confidence">
            <div class="confidence-value">${(result.confidence * 100).toFixed(1)}%</div>
            <div class="confidence-label">Confidence</div>
          </div>
        </div>
        <div class="result-summary">${result.summary}</div>
      </div>
    `;

    // Show and update categories
    elements.categoriesCard.style.display = 'block';
    elements.categoryList.innerHTML = result.categories.map(cat => `
      <div class="category-item">
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-desc">${cat.desc}</div>
        </div>
        <div class="category-bar">
          <div class="category-fill ${cat.class}" style="width: ${cat.score * 100}%"></div>
        </div>
        <div class="category-score">${(cat.score * 100).toFixed(0)}%</div>
      </div>
    `).join('');
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
    elements.analyzerText.value = sampleData.testSamples[type] || '';
    updateCharCount();
    clearAnalyzer();
  }

  // ==========================================
  // History Functions
  // ==========================================
  function renderHistory(filter = 'all', search = '') {
    if (!elements.historyTbody) return;

    let filtered = sampleData.historyEntries;

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
      elements.totalEntries.textContent = sampleData.historyEntries.length;
    }
    if (elements.historyCount) {
      elements.historyCount.textContent = sampleData.historyEntries.length;
    }
  }

  function deleteHistoryItem(id) {
    const index = sampleData.historyEntries.findIndex(item => item.id === id);
    if (index > -1) {
      sampleData.historyEntries.splice(index, 1);
      renderHistory(currentFilter, elements.historySearch?.value || '');
    }
  }

  // ==========================================
  // Settings Functions
  // ==========================================
  function updateSensitivity(value) {
    if (elements.thresholdDisplay) {
      elements.thresholdDisplay.textContent = parseFloat(value).toFixed(2);
    }
  }

  function clearAllHistory() {
    if (confirm('Are you sure you want to clear all history? This action cannot be undone.')) {
      sampleData.historyEntries = [];
      renderHistory();
      alert('All history has been cleared.');
    }
  }

  function resetAllSettings() {
    if (confirm('Are you sure you want to reset all settings to default?')) {
      // Reset toggles
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        cb.checked = cb.id !== 'setting-sound' && cb.id !== 'cat-profanity';
      });
      
      // Reset slider
      if (elements.sensitivitySlider) {
        elements.sensitivitySlider.value = 0.75;
        updateSensitivity(0.75);
      }
      
      // Reset selects
      const themeSelect = document.getElementById('setting-theme');
      if (themeSelect) themeSelect.value = 'dark';
      
      const blurSelect = document.getElementById('setting-blur-intensity');
      if (blurSelect) blurSelect.value = 'medium';
      
      const retentionSelect = document.getElementById('setting-retention');
      if (retentionSelect) retentionSelect.value = '30';
      
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
      safetyScore: sampleData.safetyScore,
      stats: sampleData.stats,
      history: sampleData.historyEntries
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

  function refreshData() {
    elements.refreshBtn.disabled = true;
    elements.refreshBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10"></circle>
      </svg>
      Refreshing...
    `;

    setTimeout(() => {
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
    }, 1000);
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

    // Settings
    if (elements.sensitivitySlider) {
      elements.sensitivitySlider.addEventListener('input', (e) => updateSensitivity(e.target.value));
    }

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
  // Initialize
  // ==========================================
  function init() {
    updateSafetyScore();
    updateStats();
    renderRecentActivity();
    renderHistory();
    updateCharCount();
    initEventListeners();

    // Render chart after a short delay to ensure canvas is ready
    setTimeout(renderChart, 100);
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
