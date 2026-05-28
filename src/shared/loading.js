// Lightweight full-screen loading overlay for synchronous-feeling heavy work
// (large PDF base64 encode/decode). Styling lives in styles/base.css (.loading-*).

let overlay = null;

export function showLoading(message = 'Working…') {
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="loading-box"><div class="loading-spinner"></div><span class="loading-text"></span></div>';
  }
  if (!overlay.isConnected) document.body.appendChild(overlay);
  overlay.querySelector('.loading-text').textContent = message;
  overlay.classList.add('show');
}

export function hideLoading() {
  if (overlay) overlay.classList.remove('show');
}

// Run an async task with the overlay shown; always hide afterward. A microtask
// yield lets the overlay paint before heavy synchronous work begins.
export async function withLoading(message, task) {
  showLoading(message);
  try {
    await new Promise((r) => setTimeout(r, 0));
    return await task();
  } finally {
    hideLoading();
  }
}
