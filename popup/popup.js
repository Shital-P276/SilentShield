/* ── UI HELPERS ── */

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

function updateOverviewUI() {
    chrome.storage.local.get(['toxicCount', 'blurCount']).then(data => {
        const toxic = data.toxicCount || 0;
        const blurred = data.blurCount || 0;

        const totalScanned = Math.max(toxic, 1);
        const safetyScore = Math.max(0, Math.round(100 - (toxic / (totalScanned + 5)) * 100));

        const scoreEl = document.getElementById('score-display');
        const toxicEl = document.getElementById('toxic-count');
        const blurEl  = document.getElementById('blur-count');
        const fillEl  = document.getElementById('score-fill');

        if (scoreEl) countUp(scoreEl, safetyScore);
        if (toxicEl) countUp(toxicEl, toxic);
        if (blurEl)  countUp(blurEl, blurred);
        if (fillEl)  fillEl.style.width = safetyScore + '%';
    });
}

/* ── INITIAL LOAD & SETTINGS SYNC ── */

window.addEventListener('load', () => {
    updateOverviewUI();

    chrome.storage.local.get(['threshold', 'autoBlur', 'showConfidence']).then(data => {
        const slider          = document.getElementById('slider');
        const thresholdVal    = document.getElementById('threshold-val');
        const blurToggle      = document.getElementById('auto-blur');
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

/* ── TAB SWITCHING ── */

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const panel = document.getElementById('tab-' + btn.dataset.tab);
        if (panel) panel.classList.add('active');
    });
});

/* ── SETTINGS ── */

const sliderEl = document.getElementById('slider');
if (sliderEl) {
    sliderEl.addEventListener('input', e => {
        const val = e.target.value;
        const display = document.getElementById('threshold-val');
        if (display) display.textContent = parseFloat(val).toFixed(2);
        chrome.storage.local.set({ threshold: val });
    });
}

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

/* ── RESET STATS ── */

const resetBtn = document.getElementById('reset-stats-btn');
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        chrome.storage.local.set({ toxicCount: 0, blurCount: 0 }).then(() => {
            updateOverviewUI();
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: "RESET_COUNTERS" }).catch(() => {});
                }
            });
        });
        resetBtn.style.transform = 'rotate(360deg)';
        resetBtn.style.transition = 'transform 0.5s ease';
        setTimeout(() => {
            resetBtn.style.transform = 'rotate(0deg)';
            resetBtn.style.transition = 'none';
        }, 500);
    });
}

/* ── ANALYZER (TEST BENCH) ── */

const runBtn     = document.getElementById('run-btn');
const testText   = document.getElementById('test-text');
const resultCard = document.getElementById('result-card');
const actionBtns = document.getElementById('action-buttons');

// Track last result for safe reply
let lastAnalysisResult = null;

if (runBtn) {
    runBtn.addEventListener('click', async () => {
        const text = testText.value.trim();
        if (!text) return;

        runBtn.textContent = 'Analyzing…';
        runBtn.disabled = true;
        if (resultCard) resultCard.classList.remove('show');
        if (actionBtns) actionBtns.style.display = 'none';

        try {
            const response = await chrome.runtime.sendMessage({ type: 'ANALYZE_TEXT', text });
            const result   = response.result[0];
            const isToxic  = result.label === 'NEGATIVE';

            lastAnalysisResult = { isToxic, score: result.score, text };

            const resultTag   = document.getElementById('result-tag');
            const resultScore = document.getElementById('result-score');

            if (resultTag) {
                resultTag.textContent = isToxic ? 'Toxic' : 'Safe';
                resultTag.className   = 'result-tag ' + (isToxic ? 'toxic' : 'safe');
            }
            if (resultScore) resultScore.textContent = (result.score * 100).toFixed(1) + '%';
            if (resultCard)  resultCard.classList.add('show');

            // Show F1 action buttons when a result is available
            if (actionBtns) actionBtns.style.display = 'flex';

        } catch (err) {
            console.error('SilentShield Analyzer Error:', err);
        } finally {
            runBtn.textContent = 'Run Inference';
            runBtn.disabled    = false;
        }
    });
}

/* ── F1: ACTION BUTTONS (Safe Reply / Block / Report) ── */

const safeReplies = [
    "Thanks for sharing. Let's keep it respectful 🙏",
    "I see your point. Can we discuss constructively?",
    "Appreciate the passion. Let's focus on solutions.",
    "Interesting perspective! Less harsh wording?",
    "Let's maintain positive dialogue here."
];

const safeReplyBtn = document.getElementById('safeReplyBtn');
if (safeReplyBtn) {
    safeReplyBtn.addEventListener('click', () => {
        const reply = safeReplies[Math.floor(Math.random() * safeReplies.length)];
        navigator.clipboard.writeText(reply).then(() => {
            safeReplyBtn.textContent = '✅ Copied!';
            setTimeout(() => { safeReplyBtn.textContent = '💬 Safe Reply'; }, 1500);
        });
    });
}

const blockBtn = document.getElementById('blockBtn');
if (blockBtn) {
    blockBtn.addEventListener('click', () => {
        if (!lastAnalysisResult) return;
        chrome.storage.local.get(['blockedTexts'], (data) => {
            const blocked = data.blockedTexts || [];
            blocked.push({ text: lastAnalysisResult.text, blockedAt: Date.now() });
            chrome.storage.local.set({ blockedTexts: blocked });
            blockBtn.textContent = '✅ Blocked';
            setTimeout(() => { blockBtn.textContent = '🚫 Block'; }, 1500);
        });
    });
}

const reportBtn = document.getElementById('reportBtn');
if (reportBtn) {
    reportBtn.addEventListener('click', () => {
        if (!lastAnalysisResult) return;
        chrome.storage.local.get(['reportedTexts'], (data) => {
            const reported = data.reportedTexts || [];
            reported.push({ text: lastAnalysisResult.text, reportedAt: Date.now() });
            chrome.storage.local.set({ reportedTexts: reported });
            reportBtn.textContent = '✅ Reported';
            setTimeout(() => { reportBtn.textContent = '📢 Report'; }, 1500);
        });
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

/* ── LIVE STORAGE SYNC ── */

chrome.storage.onChanged.addListener((changes) => {
    if (changes.toxicCount || changes.blurCount) {
        updateOverviewUI();
    }
});

/* ── LINK CHECKER MODULE ── */

const checkUrlBtn = document.getElementById('check-url-btn');
const testUrlInput = document.getElementById('test-url');
const urlResultCard = document.getElementById('url-result-card');
const urlResultTag = document.getElementById('url-result-tag');
const urlResultDesc = document.getElementById('url-result-desc');

if (checkUrlBtn) {
    checkUrlBtn.addEventListener('click', () => {
        let urlString = testUrlInput.value.trim();
        if (!urlString) return;

        // Auto-prepend http:// if the user just types "example.com"
        if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
            urlString = 'https://' + urlString;
        }

        if (urlResultCard) urlResultCard.classList.add('show');
        
        // Show loading state while querying the massive database
        urlResultTag.textContent = 'SCANNING';
        urlResultTag.className = 'result-tag';
        urlResultTag.style.background = 'var(--raised)';
        urlResultTag.style.color = 'var(--text-1)';
        urlResultDesc.textContent = 'Checking against active threat database...';

        // Send the URL to the background script to test against the real rules
        chrome.runtime.sendMessage({ action: 'testLink', url: urlString }, (response) => {
            // Check if the background script disconnected or threw an error
            if (chrome.runtime.lastError || !response) {
                urlResultTag.textContent = 'ERROR';
                urlResultTag.style.background = 'var(--raised)';
                urlResultTag.style.color = 'var(--text-2)';
                urlResultDesc.textContent = 'Could not connect to the scanner engine.';
                return;
            }

            // Clear inline styles from the loading state
            urlResultTag.style.background = '';
            urlResultTag.style.color = '';

            // Update UI based on background script's real analysis
            if (response.isSafe) {
                urlResultTag.textContent = 'SAFE';
                urlResultTag.className = 'result-tag safe'; 
                urlResultDesc.textContent = `${urlString} appears to be safe.`;
            } else {
                urlResultTag.textContent = 'BLOCKED';
                urlResultTag.className = 'result-tag toxic'; 
                urlResultDesc.innerHTML = `<strong>${urlString}</strong> is flagged as malicious.<br><span style="color:var(--danger); font-size: 11px; display:block; margin-top:4px;">Reason: ${response.reason}</span>`;
            }
        });
    });
}