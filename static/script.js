// ===== Service Worker (PWA) =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/static/sw.js').catch(() => {});
}

// ===== DOM Elements =====
const reviewInput = document.getElementById('reviewInput');
const charCount = document.getElementById('charCount');
const analyzeBtn = document.getElementById('analyzeBtn');
const errorBox = document.getElementById('errorBox');
const errorMsg = document.getElementById('errorMsg');
const inputCard = document.getElementById('inputCard');
const resultCard = document.getElementById('resultCard');

// ===== Character Counter & Button State =====
reviewInput.addEventListener('input', () => {
  const len = reviewInput.value.length;
  charCount.textContent = `${len} / 5000`;
  analyzeBtn.disabled = len < 10;

  // Hide error when typing
  errorBox.style.display = 'none';
});

// ===== Example Chips =====
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    reviewInput.value = chip.dataset.review;
    reviewInput.dispatchEvent(new Event('input'));
    reviewInput.focus();
  });
});

// ===== Analyze Button =====
analyzeBtn.addEventListener('click', async () => {
  const review = reviewInput.value.trim();

  // Client-side validation
  if (!review || review.length < 10) {
    showError('Please enter at least 10 characters for meaningful analysis.');
    return;
  }

  // UI loading state
  analyzeBtn.disabled = true;
  analyzeBtn.querySelector('.btn-text').style.display = 'none';
  analyzeBtn.querySelector('.btn-loading').style.display = 'flex';
  errorBox.style.display = 'none';
  resultCard.style.display = 'none';

  try {
    const res = await fetch('/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ review })
    });

    const data = await res.json();

    if (!data.success) {
      showError(data.error || 'An error occurred.');
      return;
    }

    // Show result
    displayResult(data);

  } catch (err) {
    showError('Unable to connect to the prediction server. Please try again.');
  } finally {
    analyzeBtn.disabled = false;
    analyzeBtn.querySelector('.btn-text').style.display = 'flex';
    analyzeBtn.querySelector('.btn-loading').style.display = 'none';
  }
});

// ===== Display Result =====
function displayResult(data) {
  const isPositive = data.label === 'Positive';
  const posPercent = (data.probability * 100).toFixed(2);
  const negPercent = (data.negative_probability * 100).toFixed(2);
  const confPercent = (data.confidence * 100).toFixed(1);

  // Icon
  const icon = document.getElementById('resultIcon');
  icon.textContent = isPositive ? '✓' : '✗';
  icon.className = 'result-icon ' + (isPositive ? 'positive' : 'negative');

  // Label
  const label = document.getElementById('resultLabel');
  label.textContent = data.label.toUpperCase();
  label.className = 'result-label-big ' + (isPositive ? 'positive' : 'negative');

  // Probability bars (animate after a tiny delay)
  document.getElementById('posProb').textContent = posPercent + '%';
  document.getElementById('negProb').textContent = negPercent + '%';

  const posBar = document.getElementById('posBar');
  const negBar = document.getElementById('negBar');
  posBar.style.width = '0%';
  negBar.style.width = '0%';

  // Confidence ring
  const circumference = 2 * Math.PI * 42; // r=42
  const ring = document.getElementById('confRing');
  ring.style.strokeDashoffset = circumference;
  document.getElementById('confValue').textContent = '0%';

  // Confidence description
  const confVal = data.confidence;
  let confDesc = 'Model certainty level';
  if (confVal > 0.9) confDesc = 'Very high confidence — the model is strongly certain about this prediction.';
  else if (confVal > 0.75) confDesc = 'High confidence — the model is fairly certain about this prediction.';
  else if (confVal > 0.6) confDesc = 'Moderate confidence — the prediction leans in this direction.';
  else confDesc = 'Low confidence — the review sentiment is ambiguous.';
  document.getElementById('confDesc').textContent = confDesc;

  // Interpretation
  document.getElementById('interpText').textContent = data.interpretation;

  // Update ring stroke color based on sentiment
  updateRingGradient(isPositive);

  // Show result card
  resultCard.style.display = 'block';
  resultCard.style.animation = 'none';
  resultCard.offsetHeight; // reflow
  resultCard.style.animation = '';

  // Scroll to result
  setTimeout(() => resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);

  // Animate bars and ring after card is visible
  requestAnimationFrame(() => {
    setTimeout(() => {
      posBar.style.width = posPercent + '%';
      negBar.style.width = negPercent + '%';

      const offset = circumference - (circumference * confVal);
      ring.style.strokeDashoffset = offset;
      document.getElementById('confValue').textContent = confPercent + '%';
    }, 150);
  });
}

// ===== Dynamic SVG Gradient for Ring =====
function updateRingGradient(isPositive) {
  // Remove existing defs if any
  const ring = document.querySelector('.confidence-ring');
  let defs = ring.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ring.prepend(defs);
  }

  const colors = isPositive
    ? ['#7c5cfc', '#00d4aa']
    : ['#ff5c8a', '#ff8c5c'];

  defs.innerHTML = `
    <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${colors[0]}" />
      <stop offset="100%" stop-color="${colors[1]}" />
    </linearGradient>
  `;

  document.getElementById('confRing').setAttribute('stroke', 'url(#ringGrad)');
}

// ===== Show Error =====
function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'flex';
  errorBox.style.animation = 'none';
  errorBox.offsetHeight;
  errorBox.style.animation = '';
}

// ===== New Analysis Button =====
document.getElementById('newBtn').addEventListener('click', () => {
  resultCard.style.display = 'none';
  reviewInput.value = '';
  reviewInput.dispatchEvent(new Event('input'));
  reviewInput.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== Keyboard shortcut: Ctrl+Enter to analyze =====
reviewInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !analyzeBtn.disabled) {
    analyzeBtn.click();
  }
});
