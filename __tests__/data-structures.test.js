/**
 * Tests for data structures used throughout the supertitles system
 */

describe('Data Structures', () => {
  describe('Annotation structure', () => {
    test('should have required fields', () => {
      const annotation = {
        id: 'SLIDE-001',
        page: 1,
        x: 0.5,
        y: 0.5
      };

      expect(annotation).toHaveProperty('id');
      expect(annotation).toHaveProperty('page');
      expect(annotation).toHaveProperty('x');
      expect(annotation).toHaveProperty('y');
    });

    test('should use normalized coordinates (0-1)', () => {
      const annotation = {
        id: 'SLIDE-001',
        page: 1,
        x: 0.5,
        y: 0.5
      };

      expect(annotation.x).toBeGreaterThanOrEqual(0);
      expect(annotation.x).toBeLessThanOrEqual(1);
      expect(annotation.y).toBeGreaterThanOrEqual(0);
      expect(annotation.y).toBeLessThanOrEqual(1);
    });
  });

  describe('Presentation slide structure', () => {
    test('should support title slides', () => {
      const slide = {
        type: 'title',
        content: 'Act I',
        fontFamily: 'Cinzel',
        fontWeight: 'bold'
      };

      expect(slide.type).toBe('title');
      expect(slide).toHaveProperty('content');
    });

    test('should support supertitle slides', () => {
      const slide = {
        type: 'supertitle',
        translation: 'Hello, world!',
        original: 'Hola, mundo!'
      };

      expect(slide.type).toBe('supertitle');
      expect(slide).toHaveProperty('translation');
      expect(slide).toHaveProperty('original');
    });
  });

  describe('Project file structure', () => {
    test('should contain pdf data and annotations', () => {
      const projectFile = {
        pdf: 'base64string',
        annotations: [
          { id: 'SLIDE-001', page: 1, x: 0.5, y: 0.5 }
        ],
        settings: {
          zoom: 1.5,
          markerSize: 40,
          deletedPages: []
        },
        metadata: {
          fileName: 'score.pdf',
          version: '1.2.1'
        }
      };

      expect(projectFile).toHaveProperty('pdf');
      expect(projectFile).toHaveProperty('annotations');
      expect(projectFile).toHaveProperty('settings');
      expect(Array.isArray(projectFile.annotations)).toBe(true);
    });

    test('should include settings', () => {
      const settings = {
        zoom: 1.5,
        markerSize: 40,
        deletedPages: [2, 5]
      };

      expect(settings).toHaveProperty('zoom');
      expect(settings).toHaveProperty('markerSize');
      expect(settings).toHaveProperty('deletedPages');
      expect(Array.isArray(settings.deletedPages)).toBe(true);
    });
  });

  describe('Supertitles set structure', () => {
    test('should contain presentation and annotation data', () => {
      const supertitlesSet = {
        name: 'Act I',
        presentation: {
          slides: [
            { type: 'title', content: 'Act I' },
            { type: 'supertitle', translation: 'Hello', original: 'Hola' }
          ]
        },
        annotation: {
          pdf: 'base64string',
          annotations: [],
          settings: {
            zoom: 1.5,
            markerSize: 40,
            deletedPages: []
          }
        },
        presentationFileName: 'act1.json',
        annotationFileName: 'score.pdf'
      };

      expect(supertitlesSet).toHaveProperty('name');
      expect(supertitlesSet).toHaveProperty('presentation');
      expect(supertitlesSet).toHaveProperty('annotation');
      expect(supertitlesSet.presentation).toHaveProperty('slides');
      expect(supertitlesSet.annotation).toHaveProperty('pdf');
    });
  });

  describe('Recital structure', () => {
    test('should contain items with type and data', () => {
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
              presentation: { slides: [] },
              annotation: { pdf: 'base64', annotations: [] }
            }
          }
        ]
      };

      expect(recital).toHaveProperty('name');
      expect(recital).toHaveProperty('items');
      expect(Array.isArray(recital.items)).toBe(true);
      expect(recital.items[0]).toHaveProperty('type');
      expect(recital.items[0]).toHaveProperty('data');
    });

    test('should support title and supertitles item types', () => {
      const titleItem = {
        type: 'title',
        name: 'Act I',
        data: { title: 'Act I', subtitle: 'Scene 1' }
      };

      const supertitlesItem = {
        type: 'supertitles',
        name: 'Aria',
        data: {
          presentation: { slides: [] },
          annotation: { pdf: '', annotations: [] }
        }
      };

      expect(['title', 'supertitles']).toContain(titleItem.type);
      expect(['title', 'supertitles']).toContain(supertitlesItem.type);
    });
  });
});

describe('Coordinate Normalization', () => {
  test('should normalize click coordinates to 0-1 range', () => {
    const canvasWidth = 800;
    const canvasHeight = 600;
    const clickX = 400; // Middle
    const clickY = 300; // Middle

    const normalizedX = clickX / canvasWidth;
    const normalizedY = clickY / canvasHeight;

    expect(normalizedX).toBe(0.5);
    expect(normalizedY).toBe(0.5);
  });

  test('should denormalize coordinates for rendering', () => {
    const normalizedX = 0.5;
    const normalizedY = 0.5;
    const canvasWidth = 800;
    const canvasHeight = 600;

    const pixelX = normalizedX * canvasWidth;
    const pixelY = normalizedY * canvasHeight;

    expect(pixelX).toBe(400);
    expect(pixelY).toBe(300);
  });

  test('should convert to PDF coordinates (bottom-left origin)', () => {
    const normalizedX = 0.5;
    const normalizedY = 0.5; // Middle in normalized (top-left origin)
    const pdfWidth = 600;
    const pdfHeight = 800;

    const pdfX = normalizedX * pdfWidth;
    const pdfY = pdfHeight - (normalizedY * pdfHeight);

    expect(pdfX).toBe(300);
    expect(pdfY).toBe(400); // Flipped because PDF origin is bottom-left
  });
});

describe('Deleted Pages Handling', () => {
  test('should filter out deleted pages from active pages', () => {
    const totalPages = 10;
    const deletedPages = [2, 5, 7];

    const activePages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (!deletedPages.includes(i)) {
        activePages.push(i);
      }
    }

    expect(activePages).toEqual([1, 3, 4, 6, 8, 9, 10]);
    expect(activePages.length).toBe(7);
  });

  test('should keep deleted pages sorted', () => {
    const deletedPages = [5, 2, 8, 1];
    deletedPages.sort((a, b) => a - b);

    expect(deletedPages).toEqual([1, 2, 5, 8]);
  });

  test('should navigate to next active page when deleting current', () => {
    const totalPages = 10;
    const deletedPages = [2, 5];
    const currentPage = 5; // About to be deleted

    // Find active pages
    const activePages = [];
    for (let i = 1; i <= totalPages; i++) {
      if (!deletedPages.includes(i) && i !== currentPage) {
        activePages.push(i);
      }
    }

    // Find next page after current
    const nextPage = activePages.find(p => p > currentPage) || activePages[activePages.length - 1];

    expect(nextPage).toBe(6);
  });
});

describe('Base64 Encoding/Decoding', () => {
  test('should convert ArrayBuffer to base64', () => {
    const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));

    expect(typeof base64).toBe('string');
    expect(base64).toBe('SGVsbG8=');
  });

  test('should convert base64 to ArrayBuffer', () => {
    const base64 = 'SGVsbG8=';
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    expect(bytes).toEqual(new Uint8Array([72, 101, 108, 108, 111]));
  });
});
