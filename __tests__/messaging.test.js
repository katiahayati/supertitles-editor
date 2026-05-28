import { describe, test, expect, vi, afterEach } from 'vitest';
import { MSG, post, postToParent, onMessage, waitForMessage } from '../src/shared/messaging.js';

function dispatch(data) {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

const unsubscribers = [];
afterEach(() => {
  while (unsubscribers.length) unsubscribers.pop()();
});

describe('post / postToParent', () => {
  test('post sends to the target window with wildcard origin', () => {
    const target = { postMessage: vi.fn() };
    post(target, { type: MSG.LOAD_DATA });
    expect(target.postMessage).toHaveBeenCalledWith({ type: MSG.LOAD_DATA }, '*');
  });

  test('post is a no-op for a null target', () => {
    expect(() => post(null, { type: MSG.LOAD_DATA })).not.toThrow();
  });

  test('postToParent does nothing when there is no real parent', () => {
    // jsdom: window.parent === window, so nothing should be posted to self.
    const spy = vi.spyOn(window, 'postMessage');
    postToParent({ type: MSG.SLIDE_CHANGED });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('onMessage', () => {
  test('invokes the handler only for known message types', () => {
    const handler = vi.fn();
    unsubscribers.push(onMessage(handler));

    dispatch({ type: MSG.SLIDE_CHANGED, slideIndex: 2 });
    dispatch({ type: 'totally-unknown-type' });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][0]).toMatchObject({ type: MSG.SLIDE_CHANGED, slideIndex: 2 });
  });

  test('returns an unsubscribe function', () => {
    const handler = vi.fn();
    const off = onMessage(handler);
    off();
    dispatch({ type: MSG.PAGE_CHANGED });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('waitForMessage', () => {
  test('resolves with the next message of the given type', async () => {
    const promise = waitForMessage(MSG.ANNOTATION_READY);
    dispatch({ type: MSG.PRESENTATION_READY }); // ignored
    dispatch({ type: MSG.ANNOTATION_READY, extra: 1 });
    await expect(promise).resolves.toMatchObject({ type: MSG.ANNOTATION_READY, extra: 1 });
  });
});
