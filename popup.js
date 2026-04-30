document.addEventListener('DOMContentLoaded', () => {
    const scanBtn = document.getElementById('scanBtn');
    const scanInput = document.getElementById('scanInput');
    const statusBadge = document.getElementById('shieldStatus');
    const resultArea = document.getElementById('resultArea');
    const riskLevel = document.querySelector('#riskLevel span');
    const meterFill = document.getElementById('meterFill');
    const scanCountEl = document.getElementById('scanCount');

    // Load initial scan count from storage
    chrome.storage.local.get(['count'], (data) => {
        scanCountEl.innerText = data.count || 0;
    });

    scanBtn.addEventListener('click', async () => {
        const text = scanInput.value.trim();
        if (!text) return;

        statusBadge.innerText = "Scanning...";
        statusBadge.style.background = "#555";

        // Send to background.js for AI Analysis
        chrome.runtime.sendMessage({ action: "analyzeText", text: text }, (response) => {
            resultArea.style.display = 'block';
            
            if (response && response.isAbusive) {
                statusBadge.innerText = "Threat Detected";
                statusBadge.style.background = "#e74c3c";
                riskLevel.innerText = "HIGH";
                riskLevel.style.color = "#e74c3c";
                meterFill.style.width = "100%";
                meterFill.style.background = "#e74c3c";
            } else {
                statusBadge.innerText = "Safe";
                statusBadge.style.background = "#2ecc71";
                riskLevel.innerText = "LOW";
                riskLevel.style.color = "#2ecc71";
                meterFill.style.width = "15%";
                meterFill.style.background = "#2ecc71";
            }
            
            // Update Scan Count persistent data
            chrome.storage.local.get(['count'], (data) => {
                const newCount = (data.count || 0) + 1;
                chrome.storage.local.set({ count: newCount });
                scanCountEl.innerText = newCount;
            });
        });
    });
});