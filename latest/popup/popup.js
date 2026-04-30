/* ── UI HELPERS ── */

// Animates numbers from 0 to target
function countUp(el, target, ms = 800) {
    if (!el) return;
    let start;
    const tick = ts => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / ms, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
}

// Updates the Dashboard (Score + Progress Bar + Stats)
function updateOverviewUI() {
    chrome.storage.local.get(['toxicCount', 'blurCount']).then(data => {
        const toxic = data.toxicCount || 0;
        const blurred = data.blurCount || 0;

        // Safety score logic: Starts at 100, drops as toxic items are found
        // Uses a "totalScanned" buffer so the score isn't 0% immediately
        const totalScanned = Math.max(toxic, 1);
        const safetyScore = Math.max(0, Math.round(100 - (toxic / (totalScanned + 5)) * 100));

        const scoreEl = document.getElementById('score-display');
        const toxicEl = document.getElementById('toxic-count');
        const blurEl = document.getElementById('blur-count');
        const fillEl = document.getElementById('score-fill');

        if (scoreEl) countUp(scoreEl, safetyScore);
        if (toxicEl) countUp(toxicEl, toxic);
        if (blurEl) countUp(blurEl, blurred);
        if (fillEl) fillEl.style.width = safetyScore + '%';
    });
}

/* ── INITIAL LOAD & SETTINGS SYNC ── */

window.addEventListener('load', () => {
    // 1. Initial UI Render
    updateOverviewUI();

    // 2. Restore Saved Settings (Threshold & Toggles)
    chrome.storage.local.get(['threshold', 'autoBlur', 'showConfidence']).then(data => {
        const slider = document.getElementById('slider');
        const thresholdVal = document.getElementById('threshold-val');
        const blurToggle = document.getElementById('auto-blur');
        const confidenceToggle = document.getElementById('show-confidence');

        if (data.threshold !== undefined && slider) {
            slider.value = data.threshold;
            if (thresholdVal) thresholdVal.textContent = parseFloat(data.threshold).toFixed(2);
        }
        if (data.autoBlur !== undefined && blurToggle) {
            blurToggle.checked = data.autoBlur;
        }
        if (data.showConfidence !== undefined && confidenceToggle) {
            confidenceToggle.checked = data.showConfidence;
        }
    });
});

/* ── EVENT LISTENERS ── */

// Tab Switching
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('tab-' + btn.dataset.tab);
        if (panel) panel.classList.add('active');
    });
});

// Settings: Sensitivity Slider
const sliderEl = document.getElementById('slider');
if (sliderEl) {
    sliderEl.addEventListener('input', e => {
        const val = e.target.value;
        const display = document.getElementById('threshold-val');
        if (display) display.textContent = parseFloat(val).toFixed(2);
        chrome.storage.local.set({ threshold: val });
    });
}

// Settings: Toggles
const blurToggle = document.getElementById('auto-blur');
if (blurToggle) {
    blurToggle.addEventListener('change', e => {
        chrome.storage.local.set({ autoBlur: e.target.checked });
    });
}

const confToggle = document.getElementById('show-confidence');
if (confToggle) {
    confToggle.addEventListener('change', e => {
        chrome.storage.local.set({ showConfidence: e.target.checked });
    });
}

/* ── REFRESH / RESET LOGIC ── */

const resetBtn = document.getElementById('reset-stats-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        // Clear counts in storage
        chrome.storage.local.set({ toxicCount: 0, blurCount: 0 }).then(() => {
            updateOverviewUI();
            
            // Notify content script to reset its local variables
            chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "RESET_COUNTERS" }).catch(() => {
                        // Ignore error if content script isn't injected on this page
                    });
                }
            });
        });

        // Visual feedback (spin icon)
        resetBtn.style.transform = 'rotate(360deg)';
        resetBtn.style.transition = 'transform 0.5s ease';
        setTimeout(() => { 
            resetBtn.style.transform = 'rotate(0deg)'; 
            resetBtn.style.transition = 'none'; 
        }, 500);
    });
}

/* ── TEST BENCH (ANALYZER) ── */

const runBtn = document.getElementById('run-btn');
const testText = document.getElementById('test-text');
const resultCard = document.getElementById('result-card');

if (runBtn) {
    runBtn.addEventListener('click', async () => {
        const text = testText.value.trim();
        if (!text) return;

        runBtn.textContent = 'Analyzing...';
        runBtn.disabled = true;
        if (resultCard) resultCard.classList.remove('show');

        try {
            // Try to use improved CyberAnalyzer first (instant, no API call)
            let result;
            if (window.CyberAnalyzer) {
                console.log('Using CyberAnalyzer for instant analysis');
                const cyberResult = CyberAnalyzer.analyze(text);
                result = cyberResult.result;
            } else {
                // Fallback to background script
                const response = await chrome.runtime.sendMessage({ 
                    action: 'analyzeWithGrok', 
                    text: text 
                });
                if (response.error) throw new Error(response.error);
                result = response.result;
            }

            const isToxic = result.isToxic;

            const resultTag = document.getElementById('result-tag');
            const resultScore = document.getElementById('result-score');
            const resultExplanation = document.getElementById('result-explanation');

            if (resultTag) {
                const categoryDisplay = result.category === 'cyber_bullying' ? 'CYBER BULLYING' : 
                                       (result.category || 'safe').toUpperCase();
                resultTag.textContent = isToxic ? '⚠️ ' + categoryDisplay : '✓ Safe';
                resultTag.className = 'result-tag ' + (isToxic ? (result.severity || 'medium') : 'safe');
            }
            if (resultScore) {
                resultScore.textContent = isToxic ? 'Abusive content detected' : 'No abusive content detected';
            }
            if (resultExplanation) {
                resultExplanation.textContent = result.explanation || 'Analysis completed';
                resultExplanation.style.display = 'block';
            }
            if (resultCard) resultCard.classList.add('show');

            // Store the analysis in history
            if (isToxic) {
                const currentToxic = (await chrome.storage.local.get('toxicCount')).toxicCount || 0;
                await chrome.storage.local.set({ toxicCount: currentToxic + 1 });
            }

        } catch (err) {
            console.error('SilentShield Analyzer Error:', err);
            // Try CyberAnalyzer as error fallback
            if (window.CyberAnalyzer) {
                const fallback = CyberAnalyzer.analyze(testText.value.trim());
                const result = fallback.result;
                const resultTag = document.getElementById('result-tag');
                const resultScore = document.getElementById('result-score');
                
                if (resultTag) {
                    resultTag.textContent = result.isToxic ? '⚠️ ' + (result.category || 'toxic').toUpperCase() : '✓ Safe';
                    resultTag.className = 'result-tag ' + (result.isToxic ? (result.severity || 'medium') : 'safe');
                }
                if (resultScore) {
                    resultScore.textContent = result.isToxic ? 'Abusive content detected' : 'No abusive content detected';
                }
                if (resultCard) resultCard.classList.add('show');
            } else {
                const resultTag = document.getElementById('result-tag');
                const resultScore = document.getElementById('result-score');
                
                if (resultTag) {
                    resultTag.textContent = 'Error';
                    resultTag.className = 'result-tag error';
                }
                if (resultScore) {
                    resultScore.textContent = err.message || 'Failed to analyze';
                }
                if (resultCard) resultCard.classList.add('show');
            }
        } finally {
            runBtn.textContent = 'Run Analysis';
            runBtn.disabled = false;
        }
    });
}

/* ── OPEN FULL DASHBOARD ── */

const dashboardBtn = document.getElementById('open-dashboard-btn');
if (dashboardBtn) {
    dashboardBtn.addEventListener('click', () => {
        chrome.windows.create({
            url: chrome.runtime.getURL('dashboard/dashboard.html'),
            type: 'popup',
            width: 1000,
            height: 700
        });
    });
}

/* ── EXTERNAL SYNC ── */

// Listen for updates from content.js while popup is open
chrome.storage.onChanged.addListener((changes) => {
    if (changes.toxicCount || changes.blurCount) {
        updateOverviewUI();
    }
});