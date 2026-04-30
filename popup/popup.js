/* ── TABS ── */

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

/* ── COUNT-UP ANIMATION ── */

function countUp(el, target, ms = 800) {
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

/* ── OVERVIEW INIT ── */
window.addEventListener('load', () => {
  chrome.storage.local.get(['toxicCount', 'blurCount']).then(data => {
    const toxic = data.toxicCount || 0;
    const blurred = data.blurCount || 0;

    // Safety score: invert toxic ratio (floor at 0, cap at 100)
    const totalScanned = Math.max(toxic, 1);
    const safetyScore = Math.max(0, Math.round(100 - (toxic / (totalScanned + 10)) * 100));

    countUp(document.getElementById('score-display'), safetyScore);
    countUp(document.getElementById('toxic-count'), toxic);
    countUp(document.getElementById('blur-count'), blurred);
    document.getElementById('score-fill').style.width = safetyScore + '%';
  });
});


/* ── SETTINGS: SLIDER ── */

document.getElementById('slider').addEventListener('input', e => {
  document.getElementById('threshold-val').textContent =
    parseFloat(e.target.value).toFixed(2);
  browser.storage.local.set({ threshold: e.target.value });
});

/* ── SETTINGS: TOGGLES ── */

document.getElementById('auto-blur').addEventListener('change', e => {
  browser.storage.local.set({ autoBlur: e.target.checked });
});

document.getElementById('show-confidence').addEventListener('change', e => {
  browser.storage.local.set({ showConfidence: e.target.checked });
});

/* ── TEST BENCH ── */

const runBtn     = document.getElementById('run-btn');
const testText   = document.getElementById('test-text');
const resultCard = document.getElementById('result-card');
const resultTag  = document.getElementById('result-tag');
const resultScore = document.getElementById('result-score');

runBtn.addEventListener('click', async () => {
  const text = testText.value.trim();
  if (!text) return;

  runBtn.textContent = 'Analyzing…';
  runBtn.disabled = true;
  resultCard.classList.remove('show');

  try {
    const response = await browser.runtime.sendMessage({ type: 'ANALYZE_TEXT', text });
    const result = response.result[0];
    const isToxic = result.label === 'NEGATIVE';

    resultTag.textContent = isToxic ? 'Toxic' : 'Safe';
    resultTag.className = 'result-tag ' + (isToxic ? 'toxic' : 'safe');
    resultScore.textContent = (result.score * 100).toFixed(1) + '%';
    resultCard.classList.add('show');
  } catch (err) {
    resultTag.textContent = 'Error';
    resultTag.className = 'result-tag toxic';
    resultScore.textContent = '—';
    resultCard.classList.add('show');
    console.error('SilentShield: background script error', err);
  } finally {
    runBtn.textContent = 'Run Inference';
    runBtn.disabled = false;
  }
});

/* ── RESTORE SAVED SETTINGS ── */

browser.storage.local.get(['threshold', 'autoBlur', 'showConfidence']).then(data => {
  if (data.threshold !== undefined) {
    document.getElementById('slider').value = data.threshold;
    document.getElementById('threshold-val').textContent =
      parseFloat(data.threshold).toFixed(2);
  }
  if (data.autoBlur !== undefined) {
    document.getElementById('auto-blur').checked = data.autoBlur;
  }
  if (data.showConfidence !== undefined) {
    document.getElementById('show-confidence').checked = data.showConfidence;
  }
});

/* ── OPEN FULL DASHBOARD ── */

document.getElementById('open-dashboard-btn').addEventListener('click', () => {
  browser.windows.create({
    url: browser.runtime.getURL('dashboard/dashboard.html'),
    type: 'popup',
    width: 1000,
    height: 700,
    left: 100,
    top: 100
  });
});