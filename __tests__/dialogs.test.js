import { describe, test, expect, beforeEach } from 'vitest';
import { alertDialog, confirmDialog, promptDialog } from '../src/shared/dialogs.js';

beforeEach(() => {
  document.body.innerHTML = '';
});

const primaryBtn = () => document.querySelector('.modal-actions .btn-primary');
const secondaryBtn = () => document.querySelector('.modal-actions .btn-secondary');

describe('confirmDialog', () => {
  test('resolves true when confirmed', async () => {
    const p = confirmDialog('Sure?');
    primaryBtn().click();
    await expect(p).resolves.toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });

  test('resolves false when cancelled', async () => {
    const p = confirmDialog('Sure?');
    secondaryBtn().click();
    await expect(p).resolves.toBe(false);
  });
});

describe('promptDialog', () => {
  test('resolves with the input value when confirmed', async () => {
    const p = promptDialog('Name:', { defaultValue: 'preset' });
    const input = document.querySelector('.modal-input');
    expect(input.value).toBe('preset');
    input.value = 'edited';
    primaryBtn().click();
    await expect(p).resolves.toBe('edited');
  });

  test('resolves null when cancelled', async () => {
    const p = promptDialog('Name:');
    secondaryBtn().click();
    await expect(p).resolves.toBeNull();
  });
});

describe('alertDialog', () => {
  test('has no cancel button and resolves on OK', async () => {
    const p = alertDialog('Heads up');
    expect(secondaryBtn()).toBeNull();
    primaryBtn().click();
    await expect(p).resolves.toBe(true);
    expect(document.querySelector('.modal-overlay')).toBeNull();
  });
});
