import { describe, test, expect } from 'vitest';
import {
  normalizeSet,
  slideMarkCheck,
  activePages,
  sortAnnotations,
  numberAnnotations,
} from '../src/shared/schema.js';

describe('normalizeSet', () => {
  const makeSet = (over = {}) => ({
    version: 2,
    name: 'Winterreise',
    presentation: { version: 1, presentation: { title: 'Winterreise' }, slides: [] },
    annotation: { version: 1, pdf: 'BASE64', annotations: [], settings: {} },
    metadata: { presentationName: 'Winterreise', annotationName: 'score.pdf' },
    ...over,
  });

  test('accepts v1 and v2 with the same shape', () => {
    expect(normalizeSet(makeSet({ version: 1 })).version).toBe(1);
    expect(normalizeSet(makeSet({ version: 2 })).version).toBe(2);
  });

  test('throws on missing version', () => {
    expect(() => normalizeSet({})).toThrow(/missing version/);
  });

  test('throws on unsupported version', () => {
    expect(() => normalizeSet(makeSet({ version: 99 }))).toThrow(/Unsupported/);
  });

  test('throws when presentation or annotation missing', () => {
    expect(() => normalizeSet(makeSet({ annotation: undefined }))).toThrow(/missing presentation or annotation/);
  });

  test('derives names from metadata, falling back to title and pdf presence', () => {
    const fromMeta = normalizeSet(makeSet());
    expect(fromMeta.presentationName).toBe('Winterreise');
    expect(fromMeta.annotationName).toBe('score.pdf');

    const noMeta = normalizeSet(makeSet({ metadata: undefined }));
    expect(noMeta.presentationName).toBe('Winterreise');
    expect(noMeta.annotationName).toBe('PDF loaded');

    const noPdf = normalizeSet(
      makeSet({ metadata: undefined, annotation: { version: 1, pdf: null, annotations: [] } })
    );
    expect(noPdf.annotationName).toBe('No PDF');
  });

  test('uses fallback name when set has none', () => {
    expect(normalizeSet(makeSet({ name: undefined }), 'fallback').name).toBe('fallback');
  });
});

describe('slideMarkCheck', () => {
  test('matches when slide count equals mark count', () => {
    const pres = { slides: [{}, {}, {}] };
    const ann = { annotations: [{}, {}, {}] };
    expect(slideMarkCheck(pres, ann)).toEqual({ slides: 3, marks: 3, match: true });
  });

  test('flags a mismatch and reports both counts', () => {
    const pres = { slides: [{}, {}, {}] };
    const ann = { annotations: [{}, {}] };
    expect(slideMarkCheck(pres, ann)).toEqual({ slides: 3, marks: 2, match: false });
  });

  test('treats missing data as zero counts (and 0 == 0 matches)', () => {
    expect(slideMarkCheck(null, null)).toEqual({ slides: 0, marks: 0, match: true });
    expect(slideMarkCheck({}, {})).toEqual({ slides: 0, marks: 0, match: true });
  });
});

describe('activePages', () => {
  test('lists all pages when nothing deleted', () => {
    expect(activePages(3)).toEqual([1, 2, 3]);
  });

  test('excludes deleted pages', () => {
    expect(activePages(5, [2, 4])).toEqual([1, 3, 5]);
  });

  test('handles all pages deleted', () => {
    expect(activePages(2, [1, 2])).toEqual([]);
  });
});

describe('sortAnnotations', () => {
  test('orders by page, then y (top-to-bottom), then x (left-to-right)', () => {
    const annotations = [
      { id: 'A', page: 2, x: 0.5, y: 0.5 },
      { id: 'B', page: 1, x: 0.5, y: 0.5 },
      { id: 'C', page: 1, x: 0.1, y: 0.1 },
      { id: 'D', page: 1, x: 0.9, y: 0.1 },
    ];
    expect(sortAnnotations(annotations).map((a) => a.id)).toEqual(['C', 'D', 'B', 'A']);
  });

  test('treats annotations within 2% vertical distance as the same row', () => {
    const annotations = [
      { id: 'right', page: 1, x: 0.8, y: 0.5 },
      { id: 'left', page: 1, x: 0.2, y: 0.51 }, // within 0.02 of `right`
    ];
    expect(sortAnnotations(annotations).map((a) => a.id)).toEqual(['left', 'right']);
  });

  test('does not mutate the input array', () => {
    const annotations = [
      { id: 'A', page: 2, x: 0, y: 0 },
      { id: 'B', page: 1, x: 0, y: 0 },
    ];
    sortAnnotations(annotations);
    expect(annotations.map((a) => a.id)).toEqual(['A', 'B']);
  });
});

describe('numberAnnotations (v1.2.1 numbering contract)', () => {
  test('numbers sequentially in reading order, ignoring annotation IDs', () => {
    const annotations = [
      { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
      { id: 'SLIDE-002', page: 1, x: 0.2, y: 0.2 },
      { id: 'SLIDE-001', page: 2, x: 0.1, y: 0.1 }, // duplicate ID
      { id: 'SLIDE-003', page: 2, x: 0.3, y: 0.3 },
    ];
    const { numbered, nextNumber } = numberAnnotations(annotations, [], 1);
    expect(numbered.map((a) => a.number)).toEqual([1, 2, 3, 4]);
    expect(nextNumber).toBe(5);
  });

  test('skips annotations on deleted pages', () => {
    const annotations = [
      { id: 'a', page: 1, x: 0.1, y: 0.1 },
      { id: 'b', page: 2, x: 0.1, y: 0.1 },
      { id: 'c', page: 3, x: 0.1, y: 0.1 },
      { id: 'd', page: 4, x: 0.1, y: 0.1 },
    ];
    const { numbered, nextNumber } = numberAnnotations(annotations, [2, 3], 1);
    expect(numbered.map((a) => a.id)).toEqual(['a', 'd']);
    expect(numbered.map((a) => a.number)).toEqual([1, 2]);
    expect(nextNumber).toBe(3);
  });

  test('continues numbering across sets via startNumber', () => {
    const setA = numberAnnotations([{ id: 'a', page: 1, x: 0, y: 0 }], [], 1);
    const setB = numberAnnotations(
      [
        { id: 'b', page: 1, x: 0, y: 0 },
        { id: 'c', page: 1, x: 0, y: 0.5 },
      ],
      [],
      setA.nextNumber
    );
    expect(setA.numbered.map((a) => a.number)).toEqual([1]);
    expect(setB.numbered.map((a) => a.number)).toEqual([2, 3]);
    expect(setB.nextNumber).toBe(4);
  });

  test('handles empty annotations', () => {
    const { numbered, nextNumber } = numberAnnotations([], [], 7);
    expect(numbered).toEqual([]);
    expect(nextNumber).toBe(7);
  });

  test('handles all pages deleted', () => {
    const { numbered, nextNumber } = numberAnnotations(
      [{ id: 'a', page: 1, x: 0, y: 0 }],
      [1],
      1
    );
    expect(numbered).toEqual([]);
    expect(nextNumber).toBe(1);
  });
});
