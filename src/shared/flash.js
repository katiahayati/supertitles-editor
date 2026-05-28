// Non-blocking toast. Creates its own host element if the page doesn't have one,
// so any app can call it without markup changes. Supports success and error variants.

let hideTimer = null;

function ensureEl() {
  let el = document.getElementById('flash-message');
  if (!el) {
    el = document.createElement('div');
    el.id = 'flash-message';
    el.className = 'flash-message';
    document.body.appendChild(el);
  }
  return el;
}

export function showFlash(message, { duration = 3000, type = 'success' } = {}) {
  const el = ensureEl();
  el.textContent = message;
  el.classList.remove('flash-error', 'flash-success');
  el.classList.add(type === 'error' ? 'flash-error' : 'flash-success', 'show');

  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove('show'), duration);
}

export function showError(message, duration = 5000) {
  showFlash(message, { duration, type: 'error' });
}
