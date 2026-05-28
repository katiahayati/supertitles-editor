// Tracks unsaved-changes state, toggles the #unsaved-indicator dot, and installs
// the beforeunload guard. Each app creates one tracker.

export function createUnsavedTracker() {
  let dirty = false;

  const indicator = () => document.getElementById('unsaved-indicator');

  window.addEventListener('beforeunload', (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  return {
    mark() {
      dirty = true;
      const el = indicator();
      if (el) el.style.display = 'inline';
    },
    clear() {
      dirty = false;
      const el = indicator();
      if (el) el.style.display = 'none';
    },
    get dirty() {
      return dirty;
    },
  };
}
