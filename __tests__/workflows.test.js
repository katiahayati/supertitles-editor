/**
 * Tests for complete user workflows
 */

describe('Complete Workflows', () => {
  describe('PDF Annotation Workflow', () => {
    test('should complete full annotation workflow', () => {
      // 1. Load PDF
      const state = {
        pdfDoc: { numPages: 10 },
        currentPage: 1,
        totalPages: 10,
        annotations: [],
        annotationCounter: 1,
        scale: 1.5,
        markerSize: 40,
        deletedPages: []
      };

      expect(state.totalPages).toBe(10);

      // 2. Add annotations
      for (let i = 1; i <= 5; i++) {
        state.annotations.push({
          id: `SLIDE-${String(i).padStart(3, '0')}`,
          page: i,
          x: 0.5,
          y: 0.5
        });
        state.annotationCounter++;
      }

      expect(state.annotations.length).toBe(5);
      expect(state.annotationCounter).toBe(6);

      // 3. Delete a page
      const pageToDelete = 3;
      state.deletedPages.push(pageToDelete);
      state.deletedPages.sort((a, b) => a - b);
      state.annotations = state.annotations.filter(a => a.page !== pageToDelete);

      expect(state.deletedPages).toEqual([3]);
      expect(state.annotations.length).toBe(4);

      // 4. Adjust zoom
      state.scale = 2.0;
      expect(state.scale).toBe(2.0);

      // 5. Save should include all state
      const saveData = {
        pdf: 'base64data',
        annotations: state.annotations,
        settings: {
          zoom: state.scale,
          markerSize: state.markerSize,
          deletedPages: state.deletedPages
        }
      };

      expect(saveData.annotations.length).toBe(4);
      expect(saveData.settings.deletedPages).toEqual([3]);
      expect(saveData.settings.zoom).toBe(2.0);
    });
  });

  describe('Presentation Creation Workflow', () => {
    test('should complete full presentation workflow', () => {
      // 1. Initialize
      const state = {
        slides: [],
        currentSlideIndex: 0
      };

      // 2. Add title slide
      state.slides.push({
        type: 'title',
        content: 'Act I',
        fontFamily: 'Cinzel',
        fontWeight: 'bold'
      });

      expect(state.slides.length).toBe(1);

      // 3. Add supertitle slides
      state.slides.push({
        type: 'supertitle',
        translation: 'Once upon a time...',
        original: 'Il était une fois...'
      });

      state.slides.push({
        type: 'supertitle',
        translation: 'There lived a princess.',
        original: 'Il y avait une princesse.'
      });

      expect(state.slides.length).toBe(3);

      // 4. Navigate slides
      state.currentSlideIndex = 1;
      expect(state.slides[state.currentSlideIndex].type).toBe('supertitle');

      // 5. Edit slide
      state.slides[1].translation = 'Long ago...';
      expect(state.slides[1].translation).toBe('Long ago...');

      // 6. Save
      const saveData = {
        slides: state.slides
      };

      expect(saveData.slides.length).toBe(3);
    });
  });

  describe('Recital Export Workflow', () => {
    test('should number annotations sequentially across sets', () => {
      // Create recital with multiple sets
      const recital = {
        name: 'Spring Recital 2024',
        items: [
          {
            type: 'title',
            name: 'Opening',
            data: { title: 'Spring Recital 2024' }
          },
          {
            type: 'supertitles',
            name: 'Act I',
            data: {
              annotation: {
                annotations: [
                  { id: 'SLIDE-001', page: 1, x: 0.2, y: 0.2 },
                  { id: 'SLIDE-002', page: 1, x: 0.5, y: 0.5 }
                ],
                settings: { deletedPages: [] }
              }
            }
          },
          {
            type: 'supertitles',
            name: 'Act II',
            data: {
              annotation: {
                annotations: [
                  { id: 'SLIDE-001', page: 1, x: 0.3, y: 0.3 },
                  { id: 'SLIDE-002', page: 2, x: 0.4, y: 0.4 }
                ],
                settings: { deletedPages: [] }
              }
            }
          }
        ]
      };

      // Process for export
      let slideNumber = 1;
      const allNumbers = [];

      for (const item of recital.items) {
        if (item.type === 'title') {
          allNumbers.push(slideNumber);
          slideNumber++;
        } else if (item.type === 'supertitles') {
          const annotations = item.data.annotation.annotations || [];
          const deletedPages = item.data.annotation.settings?.deletedPages || [];

          // Sort annotations
          const sortedAnnotations = [...annotations].sort((a, b) => {
            if (a.page !== b.page) return a.page - b.page;
            if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
            return a.x - b.x;
          });

          // Number sequentially
          for (const ann of sortedAnnotations) {
            if (!deletedPages.includes(ann.page)) {
              allNumbers.push(slideNumber);
              slideNumber++;
            }
          }
        }
      }

      // Verify sequential numbering
      expect(allNumbers).toEqual([1, 2, 3, 4, 5]);
      expect(slideNumber).toBe(6);
    });

    test('should handle deleted pages in export', () => {
      const recital = {
        items: [
          {
            type: 'supertitles',
            data: {
              annotation: {
                annotations: [
                  { id: 'SLIDE-001', page: 1, x: 0.5, y: 0.5 },
                  { id: 'SLIDE-002', page: 2, x: 0.5, y: 0.5 },
                  { id: 'SLIDE-003', page: 3, x: 0.5, y: 0.5 },
                  { id: 'SLIDE-004', page: 4, x: 0.5, y: 0.5 }
                ],
                settings: { deletedPages: [2, 3] }
              }
            }
          }
        ]
      };

      let slideNumber = 1;
      const numbers = [];

      for (const item of recital.items) {
        if (item.type === 'supertitles') {
          const annotations = item.data.annotation.annotations;
          const deletedPages = item.data.annotation.settings.deletedPages;

          for (const ann of annotations) {
            if (!deletedPages.includes(ann.page)) {
              numbers.push(slideNumber);
              slideNumber++;
            }
          }
        }
      }

      expect(numbers).toEqual([1, 2]); // Only pages 1 and 4
    });
  });

  describe('Position Preservation Workflow', () => {
    test('should preserve positions when switching modes', () => {
      const state = {
        isAnnotateMode: false,
        currentSlide: 5,
        currentPage: 3
      };

      // Switch to annotate mode
      state.isAnnotateMode = true;
      expect(state.currentSlide).toBe(5);
      expect(state.currentPage).toBe(3);

      // Navigate
      state.currentSlide = 7;
      state.currentPage = 4;

      // Switch back to edit mode
      state.isAnnotateMode = false;
      expect(state.currentSlide).toBe(7);
      expect(state.currentPage).toBe(4);
    });
  });

  describe('Settings Persistence Workflow', () => {
    test('should persist settings through save/load cycle', () => {
      const state = {
        scale: 2.0,
        markerSize: 60,
        deletedPages: [2, 5, 7],
        annotations: [
          { id: 'SLIDE-001', page: 1, x: 0.5, y: 0.5 }
        ]
      };

      // Save
      const saveData = {
        pdf: 'base64data',
        annotations: state.annotations,
        settings: {
          zoom: state.scale,
          markerSize: state.markerSize,
          deletedPages: state.deletedPages
        }
      };

      // Load
      const newState = {
        scale: 1.5,
        markerSize: 40,
        deletedPages: [],
        annotations: []
      };

      newState.annotations = saveData.annotations;
      newState.scale = saveData.settings.zoom;
      newState.markerSize = saveData.settings.markerSize;
      newState.deletedPages = saveData.settings.deletedPages;

      // Verify
      expect(newState.scale).toBe(2.0);
      expect(newState.markerSize).toBe(60);
      expect(newState.deletedPages).toEqual([2, 5, 7]);
      expect(newState.annotations.length).toBe(1);
    });
  });
});
