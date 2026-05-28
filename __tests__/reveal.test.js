import { describe, test, expect } from 'vitest';
import { generateRevealHtml } from '../src/shared/reveal.js';

describe('generateRevealHtml', () => {
  test('renders one <section> per slide', () => {
    const html = generateRevealHtml([
      { type: 'title', title: 'A' },
      { type: 'content', content: 'B' },
    ]);
    expect((html.match(/<section>/g) || []).length).toBe(2);
  });

  test('includes the document title, escaped', () => {
    const html = generateRevealHtml([], { title: 'Tom & Jerry' });
    expect(html).toContain('<title>Tom &amp; Jerry</title>');
  });

  test('renders title + subtitle slides with an h1 and h2', () => {
    const html = generateRevealHtml([{ type: 'title-subtitle', title: 'T', subtitle: 'S' }]);
    expect(html).toContain('<h1');
    expect(html).toContain('>T<');
    expect(html).toContain('<h2');
    expect(html).toContain('>S<');
  });

  test('omits the subtitle h2 when there is no subtitle', () => {
    const html = generateRevealHtml([{ type: 'title-subtitle', title: 'T', subtitle: '' }]);
    expect(html).not.toContain('<h2');
  });

  test('escapes slide text to prevent injection', () => {
    const html = generateRevealHtml([{ type: 'content', content: '<img src=x onerror=alert(1)>' }]);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  test('converts camelCase style keys to CSS and applies them inline', () => {
    const html = generateRevealHtml([
      { type: 'title', title: 'T', styles: { title: { fontSize: '40px', textAlign: 'center' } } },
    ]);
    expect(html).toContain('font-size: 40px');
    expect(html).toContain('text-align: center');
  });
});
