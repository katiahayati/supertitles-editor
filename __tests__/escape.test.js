import { describe, test, expect } from 'vitest';
import { escapeHtml, escapeHtmlWithBreaks } from '../src/shared/escape.js';

describe('escapeHtml', () => {
  test('escapes angle brackets and ampersands', () => {
    expect(escapeHtml('<script>"&"</script>')).toBe('&lt;script&gt;"&amp;"&lt;/script&gt;');
  });

  test('returns empty string for null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });

  test('leaves plain text unchanged', () => {
    expect(escapeHtml('Der Lindenbaum')).toBe('Der Lindenbaum');
  });
});

describe('escapeHtmlWithBreaks', () => {
  test('converts newlines to <br> after escaping', () => {
    expect(escapeHtmlWithBreaks('line1\nline2')).toBe('line1<br>line2');
  });

  test('still escapes html around the breaks', () => {
    expect(escapeHtmlWithBreaks('<b>\n<i>')).toBe('&lt;b&gt;<br>&lt;i&gt;');
  });
});
