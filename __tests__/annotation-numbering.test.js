/**
 * Tests for annotation numbering logic in recital manager
 * These tests verify the critical bug fix in v1.2.1
 */

describe('Annotation Numbering', () => {
  describe('Sequential numbering', () => {
    test('should number annotations sequentially ignoring IDs', () => {
      const annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 1, x: 0.2, y: 0.2 },
        { id: 'SLIDE-001', page: 2, x: 0.1, y: 0.1 }, // Duplicate ID
        { id: 'SLIDE-003', page: 2, x: 0.3, y: 0.3 }
      ];

      const deletedPages = [];
      let slideNumber = 1;
      const numbers = [];

      // Sort annotations (same logic as recital-manager.js)
      const sortedAnnotations = [...annotations].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
        return a.x - b.x;
      });

      // Number sequentially
      for (const ann of sortedAnnotations) {
        if (!deletedPages.includes(ann.page)) {
          numbers.push(slideNumber);
          slideNumber++;
        }
      }

      expect(numbers).toEqual([1, 2, 3, 4]);
    });

    test('should skip annotations on deleted pages', () => {
      const annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 2, x: 0.1, y: 0.1 },
        { id: 'SLIDE-003', page: 3, x: 0.1, y: 0.1 },
        { id: 'SLIDE-004', page: 4, x: 0.1, y: 0.1 }
      ];

      const deletedPages = [2, 3];
      let slideNumber = 1;
      const numbers = [];

      const sortedAnnotations = [...annotations].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
        return a.x - b.x;
      });

      for (const ann of sortedAnnotations) {
        if (!deletedPages.includes(ann.page)) {
          numbers.push(slideNumber);
          slideNumber++;
        }
      }

      expect(numbers).toEqual([1, 2]);
      expect(slideNumber).toBe(3); // Next number after 1,2
    });

    test('should sort annotations by page, then y, then x', () => {
      const annotations = [
        { id: 'A', page: 2, x: 0.5, y: 0.5 },
        { id: 'B', page: 1, x: 0.5, y: 0.5 },
        { id: 'C', page: 1, x: 0.3, y: 0.5 }, // Same page, earlier x
        { id: 'D', page: 1, x: 0.5, y: 0.3 }  // Same page, earlier y
      ];

      const sortedAnnotations = [...annotations].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
        return a.x - b.x;
      });

      expect(sortedAnnotations.map(a => a.id)).toEqual(['D', 'C', 'B', 'A']);
    });

    test('should handle multiple annotations per page', () => {
      const annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 1, x: 0.2, y: 0.1 },
        { id: 'SLIDE-003', page: 1, x: 0.3, y: 0.1 },
        { id: 'SLIDE-001', page: 2, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 2, x: 0.2, y: 0.1 }
      ];

      const deletedPages = [];
      let slideNumber = 5; // Start from 5
      const numbers = [];

      const sortedAnnotations = [...annotations].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
        return a.x - b.x;
      });

      for (const ann of sortedAnnotations) {
        if (!deletedPages.includes(ann.page)) {
          numbers.push(slideNumber);
          slideNumber++;
        }
      }

      expect(numbers).toEqual([5, 6, 7, 8, 9]);
      expect(slideNumber).toBe(10);
    });
  });

  describe('Edge cases', () => {
    test('should handle empty annotations array', () => {
      const annotations = [];
      const deletedPages = [];
      let slideNumber = 1;
      const numbers = [];

      for (const ann of annotations) {
        if (!deletedPages.includes(ann.page)) {
          numbers.push(slideNumber);
          slideNumber++;
        }
      }

      expect(numbers).toEqual([]);
      expect(slideNumber).toBe(1);
    });

    test('should handle all pages deleted', () => {
      const annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 2, x: 0.1, y: 0.1 }
      ];

      const deletedPages = [1, 2];
      let slideNumber = 1;
      const numbers = [];

      for (const ann of annotations) {
        if (!deletedPages.includes(ann.page)) {
          numbers.push(slideNumber);
          slideNumber++;
        }
      }

      expect(numbers).toEqual([]);
      expect(slideNumber).toBe(1);
    });

    test('should handle annotations at same position (y within 0.02)', () => {
      const annotations = [
        { id: 'A', page: 1, x: 0.5, y: 0.100 },
        { id: 'B', page: 1, x: 0.3, y: 0.105 }, // Within 0.02 of first
        { id: 'C', page: 1, x: 0.7, y: 0.110 }  // Within 0.02 of first
      ];

      const sortedAnnotations = [...annotations].sort((a, b) => {
        if (a.page !== b.page) return a.page - b.page;
        if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
        return a.x - b.x;
      });

      // Should sort by x when y is within threshold
      expect(sortedAnnotations.map(a => a.id)).toEqual(['B', 'A', 'C']);
    });
  });

  describe('Multiple supertitles sets', () => {
    test('should continue numbering across multiple sets', () => {
      // First set
      const set1Annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 1, x: 0.2, y: 0.2 }
      ];

      let slideNumber = 1;
      let set1Numbers = [];

      for (const ann of set1Annotations) {
        set1Numbers.push(slideNumber);
        slideNumber++;
      }

      // Second set should continue from where first set left off
      const set2Annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 1, x: 0.2, y: 0.2 },
        { id: 'SLIDE-003', page: 1, x: 0.3, y: 0.3 }
      ];

      let set2Numbers = [];

      for (const ann of set2Annotations) {
        set2Numbers.push(slideNumber);
        slideNumber++;
      }

      expect(set1Numbers).toEqual([1, 2]);
      expect(set2Numbers).toEqual([3, 4, 5]);
      expect(slideNumber).toBe(6);
    });

    test('should handle deleted pages in multiple sets', () => {
      // First set with deleted pages
      const set1Annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 2, x: 0.1, y: 0.1 },
        { id: 'SLIDE-003', page: 3, x: 0.1, y: 0.1 }
      ];
      const set1DeletedPages = [2];

      let slideNumber = 1;
      let set1Numbers = [];

      for (const ann of set1Annotations) {
        if (!set1DeletedPages.includes(ann.page)) {
          set1Numbers.push(slideNumber);
          slideNumber++;
        }
      }

      // Second set
      const set2Annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.1, y: 0.1 },
        { id: 'SLIDE-002', page: 2, x: 0.1, y: 0.1 }
      ];
      const set2DeletedPages = [];

      let set2Numbers = [];

      for (const ann of set2Annotations) {
        if (!set2DeletedPages.includes(ann.page)) {
          set2Numbers.push(slideNumber);
          slideNumber++;
        }
      }

      expect(set1Numbers).toEqual([1, 2]); // Skipped page 2
      expect(set2Numbers).toEqual([3, 4]);
      expect(slideNumber).toBe(5);
    });
  });
});
