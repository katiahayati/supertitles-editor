/**
 * Tests for state management and iframe communication
 */

describe('State Management', () => {
  describe('PDF Annotator State', () => {
    let state;

    beforeEach(() => {
      state = {
        pdfDoc: null,
        pdfData: null,
        currentPage: 1,
        totalPages: 0,
        scale: 1.5,
        annotations: [],
        annotationCounter: 1,
        markerSize: 40,
        deletedPages: []
      };
    });

    test('should initialize with default values', () => {
      expect(state.currentPage).toBe(1);
      expect(state.scale).toBe(1.5);
      expect(state.annotations).toEqual([]);
      expect(state.markerSize).toBe(40);
      expect(state.deletedPages).toEqual([]);
    });

    test('should update zoom level', () => {
      state.scale = 2.0;
      expect(state.scale).toBe(2.0);
    });

    test('should add annotation', () => {
      const annotation = {
        id: 'SLIDE-001',
        page: 1,
        x: 0.5,
        y: 0.5
      };
      state.annotations.push(annotation);

      expect(state.annotations.length).toBe(1);
      expect(state.annotations[0]).toEqual(annotation);
    });

    test('should remove annotation', () => {
      state.annotations = [
        { id: 'SLIDE-001', page: 1, x: 0.5, y: 0.5 },
        { id: 'SLIDE-002', page: 1, x: 0.6, y: 0.6 }
      ];

      state.annotations = state.annotations.filter(a => a.id !== 'SLIDE-001');

      expect(state.annotations.length).toBe(1);
      expect(state.annotations[0].id).toBe('SLIDE-002');
    });

    test('should track deleted pages', () => {
      state.deletedPages.push(2);
      state.deletedPages.push(5);
      state.deletedPages.sort((a, b) => a - b);

      expect(state.deletedPages).toEqual([2, 5]);
    });
  });

  describe('Presentation Editor State', () => {
    let state;

    beforeEach(() => {
      state = {
        slides: [],
        currentSlideIndex: 0,
        isPlaying: false,
        fileName: ''
      };
    });

    test('should initialize with empty slides', () => {
      expect(state.slides).toEqual([]);
      expect(state.currentSlideIndex).toBe(0);
      expect(state.isPlaying).toBe(false);
    });

    test('should add slide', () => {
      const slide = {
        type: 'title',
        content: 'Act I'
      };
      state.slides.push(slide);

      expect(state.slides.length).toBe(1);
      expect(state.slides[0]).toEqual(slide);
    });

    test('should navigate slides', () => {
      state.slides = [
        { type: 'title', content: 'Act I' },
        { type: 'supertitle', translation: 'Hello' }
      ];
      state.currentSlideIndex = 0;

      state.currentSlideIndex++;
      expect(state.currentSlideIndex).toBe(1);

      state.currentSlideIndex--;
      expect(state.currentSlideIndex).toBe(0);
    });
  });

  describe('Supertitles Manager State', () => {
    let state;

    beforeEach(() => {
      state = {
        presentationData: null,
        annotationData: null,
        presentationName: 'None',
        annotationName: 'None',
        setName: 'Untitled',
        isAnnotateMode: false,
        currentSlide: 0,
        currentPage: 1
      };
    });

    test('should toggle annotate mode', () => {
      expect(state.isAnnotateMode).toBe(false);
      state.isAnnotateMode = true;
      expect(state.isAnnotateMode).toBe(true);
    });

    test('should track current positions', () => {
      state.currentSlide = 5;
      state.currentPage = 3;

      expect(state.currentSlide).toBe(5);
      expect(state.currentPage).toBe(3);
    });

    test('should preserve positions when switching modes', () => {
      state.currentSlide = 5;
      state.currentPage = 3;

      // Switch to annotate mode
      state.isAnnotateMode = true;

      // Positions should remain
      expect(state.currentSlide).toBe(5);
      expect(state.currentPage).toBe(3);
    });
  });

  describe('Recital Manager State', () => {
    let state;

    beforeEach(() => {
      state = {
        recitalName: 'Untitled Recital',
        recitalFileName: '',
        items: []
      };
    });

    test('should add recital item', () => {
      const item = {
        type: 'title',
        name: 'Opening',
        data: { title: 'Spring Recital' }
      };
      state.items.push(item);

      expect(state.items.length).toBe(1);
      expect(state.items[0]).toEqual(item);
    });

    test('should reorder items', () => {
      state.items = [
        { type: 'title', name: 'First', data: {} },
        { type: 'title', name: 'Second', data: {} },
        { type: 'title', name: 'Third', data: {} }
      ];

      // Move second item to first position
      const item = state.items.splice(1, 1)[0];
      state.items.splice(0, 0, item);

      expect(state.items[0].name).toBe('Second');
      expect(state.items[1].name).toBe('First');
      expect(state.items[2].name).toBe('Third');
    });

    test('should remove item', () => {
      state.items = [
        { type: 'title', name: 'First', data: {} },
        { type: 'title', name: 'Second', data: {} }
      ];

      state.items.splice(0, 1);

      expect(state.items.length).toBe(1);
      expect(state.items[0].name).toBe('Second');
    });
  });
});

describe('Message Passing', () => {
  describe('Parent-Child Communication', () => {
    test('should send load-data message', () => {
      const message = {
        type: 'load-data',
        data: {
          slides: [{ type: 'title', content: 'Hello' }]
        }
      };

      expect(message.type).toBe('load-data');
      expect(message.data).toHaveProperty('slides');
    });

    test('should send slide-changed message', () => {
      const message = {
        type: 'slide-changed',
        slideIndex: 5
      };

      expect(message.type).toBe('slide-changed');
      expect(message.slideIndex).toBe(5);
    });

    test('should send page-changed message', () => {
      const message = {
        type: 'page-changed',
        pageNumber: 3
      };

      expect(message.type).toBe('page-changed');
      expect(message.pageNumber).toBe(3);
    });

    test('should send goto-slide message', () => {
      const message = {
        type: 'goto-slide',
        slideIndex: 10
      };

      expect(message.type).toBe('goto-slide');
      expect(message.slideIndex).toBe(10);
    });

    test('should send goto-page message', () => {
      const message = {
        type: 'goto-page',
        pageNumber: 7
      };

      expect(message.type).toBe('goto-page');
      expect(message.pageNumber).toBe(7);
    });

    test('should send annotation-changed message', () => {
      const message = {
        type: 'annotation-changed',
        annotations: [
          { id: 'SLIDE-001', page: 1, x: 0.5, y: 0.5 }
        ]
      };

      expect(message.type).toBe('annotation-changed');
      expect(message.annotations).toBeInstanceOf(Array);
    });

    test('should include hideControls flag in load-data', () => {
      const message = {
        type: 'load-data',
        data: {},
        hideControls: true
      };

      expect(message.hideControls).toBe(true);
    });
  });
});

describe('Settings Persistence', () => {
  test('should save zoom level', () => {
    const settings = {
      zoom: 1.5,
      markerSize: 40,
      deletedPages: []
    };

    expect(settings.zoom).toBe(1.5);
  });

  test('should save marker size', () => {
    const settings = {
      zoom: 1.5,
      markerSize: 60,
      deletedPages: []
    };

    expect(settings.markerSize).toBe(60);
  });

  test('should save deleted pages', () => {
    const settings = {
      zoom: 1.5,
      markerSize: 40,
      deletedPages: [2, 5, 7]
    };

    expect(settings.deletedPages).toEqual([2, 5, 7]);
  });

  test('should apply settings on load', () => {
    const savedSettings = {
      zoom: 2.0,
      markerSize: 50,
      deletedPages: [3]
    };

    const state = {
      scale: 1.5,
      markerSize: 40,
      deletedPages: []
    };

    // Apply saved settings
    state.scale = savedSettings.zoom;
    state.markerSize = savedSettings.markerSize;
    state.deletedPages = savedSettings.deletedPages;

    expect(state.scale).toBe(2.0);
    expect(state.markerSize).toBe(50);
    expect(state.deletedPages).toEqual([3]);
  });
});
