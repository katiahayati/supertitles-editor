// Promise-based, in-app replacements for native alert/confirm/prompt.
// Styling lives in styles/base.css (.modal-* classes).

function buildModal({ title, message, input, defaultValue, placeholder, confirmText, cancelText, showCancel }) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');

  if (title) {
    const h = document.createElement('h3');
    h.className = 'modal-title';
    h.textContent = title;
    box.appendChild(h);
  }

  if (message) {
    const p = document.createElement('p');
    p.className = 'modal-message';
    p.textContent = message;
    box.appendChild(p);
  }

  let field = null;
  if (input) {
    field = document.createElement('input');
    field.type = 'text';
    field.className = 'modal-input';
    field.value = defaultValue ?? '';
    if (placeholder) field.placeholder = placeholder;
    box.appendChild(field);
  }

  const actions = document.createElement('div');
  actions.className = 'modal-actions';

  let cancelBtn = null;
  if (showCancel) {
    cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-secondary';
    cancelBtn.textContent = cancelText || 'Cancel';
    actions.appendChild(cancelBtn);
  }

  const confirmBtn = document.createElement('button');
  confirmBtn.className = 'btn btn-primary';
  confirmBtn.textContent = confirmText || 'OK';
  actions.appendChild(confirmBtn);

  box.appendChild(actions);
  overlay.appendChild(box);

  return { overlay, box, field, confirmBtn, cancelBtn };
}

function open({ input = false, showCancel = true, ...opts }) {
  return new Promise((resolve) => {
    const { overlay, field, confirmBtn, cancelBtn } = buildModal({ input, showCancel, ...opts });
    document.body.appendChild(overlay);

    const cleanup = (value) => {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(value);
    };

    const accept = () => cleanup(input ? field.value : true);
    const cancel = () => cleanup(input ? null : false);

    confirmBtn.addEventListener('click', accept);
    if (cancelBtn) cancelBtn.addEventListener('click', cancel);
    overlay.addEventListener('mousedown', (e) => {
      if (e.target === overlay && showCancel) cancel();
    });

    function onKey(e) {
      if (e.key === 'Escape' && showCancel) {
        e.preventDefault();
        cancel();
      } else if (e.key === 'Enter' && (input || document.activeElement === confirmBtn || !showCancel)) {
        e.preventDefault();
        accept();
      }
    }
    document.addEventListener('keydown', onKey, true);

    (field || confirmBtn).focus();
    if (field) field.select();
  });
}

export function alertDialog(message, { title = '' } = {}) {
  return open({ message, title, input: false, showCancel: false, confirmText: 'OK' });
}

export function confirmDialog(message, { title = '', confirmText = 'OK', cancelText = 'Cancel' } = {}) {
  return open({ message, title, input: false, showCancel: true, confirmText, cancelText });
}

export function promptDialog(message, { title = '', defaultValue = '', placeholder = '', confirmText = 'OK' } = {}) {
  return open({ message, title, input: true, showCancel: true, defaultValue, placeholder, confirmText });
}
