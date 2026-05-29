// Single source of truth for the iframe postMessage protocol.
//
// Pages run from file://, where the iframe origin is "null" and a specific
// targetOrigin cannot be used reliably, so we post with '*'. We instead guard by
// validating the message `type` against the known set below.

export const MSG = {
  LOAD_DATA: 'load-data',
  PRESENTATION_READY: 'presentation-ready',
  ANNOTATION_READY: 'annotation-ready',
  PRESENTATION_VIEWER_READY: 'presentation-viewer-ready',
  PRESENTATION_CHANGED: 'presentation-changed',
  ANNOTATION_CHANGED: 'annotation-changed',
  SLIDE_CHANGED: 'slide-changed',
  PAGE_CHANGED: 'page-changed',
  GOTO_SLIDE: 'goto-slide',
  GOTO_PAGE: 'goto-page',
  // Sent up from an embedded annotate-mode frame to step the slide preview,
  // so Tab works no matter which frame currently has keyboard focus.
  STEP_SLIDE: 'step-slide',
};

const KNOWN_TYPES = new Set(Object.values(MSG));

export function post(targetWindow, message) {
  if (targetWindow) targetWindow.postMessage(message, '*');
}

export function postToParent(message) {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

// Subscribe to known protocol messages. Returns an unsubscribe function.
export function onMessage(handler) {
  const listener = (event) => {
    const data = event.data;
    if (data && KNOWN_TYPES.has(data.type)) handler(data, event);
  };
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

// Resolves the next time a message of `type` arrives. Used for the iframe
// ready-handshake instead of fixed setTimeout delays.
export function waitForMessage(type) {
  return new Promise((resolve) => {
    const listener = (event) => {
      if (event.data && event.data.type === type) {
        window.removeEventListener('message', listener);
        resolve(event.data);
      }
    };
    window.addEventListener('message', listener);
  });
}

// Reload `frame` to `src`, wait for its ready signal, then post `payload`.
// Replaces the fragile setTimeout(..., 500) reload waits.
export async function loadFrame(frame, src, readyType, payload) {
  const ready = waitForMessage(readyType);
  // Assigning src (even the same value) reloads the iframe document.
  frame.src = src;
  await ready;
  if (payload) post(frame.contentWindow, payload);
}
