import { describe, test, expect } from 'vitest';
import { arrayBufferToBase64, base64ToArrayBuffer } from '../src/shared/base64.js';

describe('base64 round-trip', () => {
  test('encodes and decodes back to the original bytes', () => {
    const original = new Uint8Array([0, 1, 2, 254, 255, 100, 37]);
    const b64 = arrayBufferToBase64(original.buffer);
    const decoded = new Uint8Array(base64ToArrayBuffer(b64));
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  test('produces valid base64 for an empty buffer', () => {
    expect(arrayBufferToBase64(new Uint8Array([]).buffer)).toBe('');
    expect(new Uint8Array(base64ToArrayBuffer('')).length).toBe(0);
  });

  test('handles buffers larger than the 0x8000 chunk size', () => {
    const big = new Uint8Array(100000);
    for (let i = 0; i < big.length; i++) big[i] = i % 256;
    const decoded = new Uint8Array(base64ToArrayBuffer(arrayBufferToBase64(big.buffer)));
    expect(decoded.length).toBe(big.length);
    expect(decoded[0]).toBe(0);
    expect(decoded[256]).toBe(0);
    expect(decoded[99999]).toBe(99999 % 256);
  });
});
