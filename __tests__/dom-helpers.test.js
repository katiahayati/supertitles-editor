import { describe, test, expect, beforeEach } from 'vitest';
import { showFlash, showError } from '../src/shared/flash.js';
import { showLoading, hideLoading, withLoading } from '../src/shared/loading.js';
import { createUnsavedTracker } from '../src/shared/unsaved.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('flash', () => {
  test('creates a flash element and shows a success message', () => {
    showFlash('Saved!');
    const el = document.getElementById('flash-message');
    expect(el).toBeTruthy();
    expect(el.textContent).toBe('Saved!');
    expect(el.classList.contains('show')).toBe(true);
    expect(el.classList.contains('flash-success')).toBe(true);
  });

  test('showError uses the error variant', () => {
    showError('Boom');
    const el = document.getElementById('flash-message');
    expect(el.classList.contains('flash-error')).toBe(true);
    expect(el.classList.contains('flash-success')).toBe(false);
  });
});

describe('loading overlay', () => {
  test('show/hide toggles the show class', () => {
    showLoading('Working');
    const el = document.querySelector('.loading-overlay');
    expect(el.classList.contains('show')).toBe(true);
    expect(el.querySelector('.loading-text').textContent).toBe('Working');
    hideLoading();
    expect(el.classList.contains('show')).toBe(false);
  });

  test('withLoading runs the task and hides afterward, even on throw', async () => {
    const result = await withLoading('x', async () => 42);
    expect(result).toBe(42);
    expect(document.querySelector('.loading-overlay').classList.contains('show')).toBe(false);

    await expect(withLoading('x', async () => { throw new Error('nope'); })).rejects.toThrow('nope');
    expect(document.querySelector('.loading-overlay').classList.contains('show')).toBe(false);
  });
});

describe('unsaved tracker', () => {
  test('mark/clear toggle dirty state and the indicator', () => {
    const indicator = document.createElement('span');
    indicator.id = 'unsaved-indicator';
    indicator.style.display = 'none';
    document.body.appendChild(indicator);

    const tracker = createUnsavedTracker();
    expect(tracker.dirty).toBe(false);

    tracker.mark();
    expect(tracker.dirty).toBe(true);
    expect(indicator.style.display).toBe('inline');

    tracker.clear();
    expect(tracker.dirty).toBe(false);
    expect(indicator.style.display).toBe('none');
  });

  test('does not throw when there is no indicator element', () => {
    const tracker = createUnsavedTracker();
    expect(() => {
      tracker.mark();
      tracker.clear();
    }).not.toThrow();
  });
});
