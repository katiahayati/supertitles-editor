const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('PDF Annotation Tool - Integration Tests', () => {
  let browser;
  let page;
  const testPdfPath = path.join(__dirname, 'fixtures', 'test.pdf');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    page = await browser.newPage();
    const htmlPath = 'file://' + path.join(__dirname, '..', 'index.html');
    await page.goto(htmlPath, { waitUntil: 'networkidle0' });
  });

  afterEach(async () => {
    await page.close();
  });

  describe('PDF Loading', () => {
    test('should load a PDF file successfully', async () => {
      // Check if test PDF exists, if not skip this test
      if (!fs.existsSync(testPdfPath)) {
        console.warn('Test PDF not found, skipping PDF loading tests');
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      // Wait for PDF to load
      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      const canvasWidth = await page.evaluate(() => {
        return document.querySelector('#pdf-canvas').width;
      });

      expect(canvasWidth).toBeGreaterThan(0);
    });

    test('should enable buttons after PDF loads', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => !document.querySelector('#save-annotations').disabled,
        { timeout: 5000 }
      );

      const buttonsEnabled = await page.evaluate(() => {
        return {
          saveBtn: !document.querySelector('#save-annotations').disabled,
          exportBtn: !document.querySelector('#export-pdf').disabled,
          toggleViewBtn: !document.querySelector('#toggle-view').disabled,
          deletePageBtn: !document.querySelector('#delete-page').disabled
        };
      });

      expect(buttonsEnabled.saveBtn).toBe(true);
      expect(buttonsEnabled.exportBtn).toBe(true);
      expect(buttonsEnabled.toggleViewBtn).toBe(true);
      expect(buttonsEnabled.deletePageBtn).toBe(true);
    });
  });

  describe('Annotation Management', () => {
    test('should add annotation when clicking on canvas', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      // Click on canvas to add annotation
      await page.click('#pdf-canvas');

      // Wait for annotation to appear
      await page.waitForSelector('.annotation-marker', { timeout: 2000 });

      const annotationCount = await page.evaluate(() => {
        return document.querySelectorAll('.annotation-marker').length;
      });

      expect(annotationCount).toBe(1);
    });

    test('should update annotation counter display', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      await page.click('#pdf-canvas');
      await page.waitForSelector('.annotation-marker', { timeout: 2000 });

      const displayedCount = await page.evaluate(() => {
        return document.querySelector('#annotation-count').textContent;
      });

      expect(displayedCount).toBe('1');
    });

    test('should generate unique annotation IDs', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      // Add multiple annotations
      await page.click('#pdf-canvas', { offset: { x: 100, y: 100 } });
      await page.waitForTimeout(200);
      await page.click('#pdf-canvas', { offset: { x: 200, y: 200 } });
      await page.waitForTimeout(200);

      const annotationIds = await page.evaluate(() => {
        const items = document.querySelectorAll('.annotation-item .annotation-id');
        return Array.from(items).map(el => el.textContent);
      });

      expect(annotationIds.length).toBe(2);
      expect(annotationIds[0]).not.toBe(annotationIds[1]);
      expect(annotationIds[0]).toMatch(/^SLIDE-\d{3}$/);
    });
  });

  describe('Marker Size Controls', () => {
    test('should increase marker size', async () => {
      const initialSize = await page.evaluate(() => {
        return document.querySelector('#marker-size-display').textContent;
      });

      await page.click('#marker-size-increase');

      const newSize = await page.evaluate(() => {
        return document.querySelector('#marker-size-display').textContent;
      });

      expect(parseInt(newSize)).toBeGreaterThan(parseInt(initialSize));
    });

    test('should decrease marker size', async () => {
      const initialSize = await page.evaluate(() => {
        return document.querySelector('#marker-size-display').textContent;
      });

      await page.click('#marker-size-decrease');

      const newSize = await page.evaluate(() => {
        return document.querySelector('#marker-size-display').textContent;
      });

      expect(parseInt(newSize)).toBeLessThan(parseInt(initialSize));
    });

    test('should not go below minimum marker size', async () => {
      // Click decrease many times
      for (let i = 0; i < 10; i++) {
        await page.click('#marker-size-decrease');
        await page.waitForTimeout(50);
      }

      const finalSize = await page.evaluate(() => {
        return document.querySelector('#marker-size-display').textContent;
      });

      expect(parseInt(finalSize)).toBeGreaterThanOrEqual(20);
    });

    test('should not exceed maximum marker size', async () => {
      // Click increase many times
      for (let i = 0; i < 20; i++) {
        await page.click('#marker-size-increase');
        await page.waitForTimeout(50);
      }

      const finalSize = await page.evaluate(() => {
        return document.querySelector('#marker-size-display').textContent;
      });

      expect(parseInt(finalSize)).toBeLessThanOrEqual(100);
    });
  });

  describe('Zoom Controls', () => {
    test('should zoom in', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      const initialWidth = await page.evaluate(() => {
        return document.querySelector('#pdf-canvas').width;
      });

      await page.click('#zoom-in');
      await page.waitForTimeout(500);

      const newWidth = await page.evaluate(() => {
        return document.querySelector('#pdf-canvas').width;
      });

      expect(newWidth).toBeGreaterThan(initialWidth);
    });

    test('should zoom out', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      const initialWidth = await page.evaluate(() => {
        return document.querySelector('#pdf-canvas').width;
      });

      await page.click('#zoom-out');
      await page.waitForTimeout(500);

      const newWidth = await page.evaluate(() => {
        return document.querySelector('#pdf-canvas').width;
      });

      expect(newWidth).toBeLessThan(initialWidth);
    });
  });

  describe('View Mode Toggle', () => {
    test('should switch to continuous view', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      await page.click('#toggle-view');
      await page.waitForTimeout(500);

      const viewState = await page.evaluate(() => {
        return {
          canvasWrapperVisible: window.getComputedStyle(document.querySelector('#canvas-wrapper')).display !== 'none',
          continuousWrapperVisible: window.getComputedStyle(document.querySelector('#continuous-canvas-wrapper')).display !== 'none',
          buttonText: document.querySelector('#view-mode-text').textContent
        };
      });

      expect(viewState.canvasWrapperVisible).toBe(false);
      expect(viewState.continuousWrapperVisible).toBe(true);
      expect(viewState.buttonText).toBe('Paginated View');
    });

    test('should switch back to paginated view', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      // Switch to continuous
      await page.click('#toggle-view');
      await page.waitForTimeout(500);

      // Switch back to paginated
      await page.click('#toggle-view');
      await page.waitForTimeout(500);

      const viewState = await page.evaluate(() => {
        return {
          canvasWrapperVisible: window.getComputedStyle(document.querySelector('#canvas-wrapper')).display !== 'none',
          continuousWrapperVisible: window.getComputedStyle(document.querySelector('#continuous-canvas-wrapper')).display !== 'none',
          buttonText: document.querySelector('#view-mode-text').textContent
        };
      });

      expect(viewState.canvasWrapperVisible).toBe(true);
      expect(viewState.continuousWrapperVisible).toBe(false);
      expect(viewState.buttonText).toBe('Continuous View');
    });
  });

  describe('Page Navigation', () => {
    test('should navigate to next page', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      const initialPageInfo = await page.evaluate(() => {
        return document.querySelector('#page-info').textContent;
      });

      await page.click('#next-page');
      await page.waitForTimeout(500);

      const newPageInfo = await page.evaluate(() => {
        return document.querySelector('#page-info').textContent;
      });

      expect(newPageInfo).not.toBe(initialPageInfo);
    });

    test('should disable prev button on first page', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      const prevBtnDisabled = await page.evaluate(() => {
        return document.querySelector('#prev-page').disabled;
      });

      expect(prevBtnDisabled).toBe(true);
    });
  });

  describe('Annotation Prefix', () => {
    test('should allow custom annotation prefix', async () => {
      if (!fs.existsSync(testPdfPath)) {
        return;
      }

      const fileInput = await page.$('#pdf-upload');
      await fileInput.uploadFile(testPdfPath);

      await page.waitForFunction(
        () => document.querySelector('#pdf-canvas').width > 0,
        { timeout: 5000 }
      );

      // Change prefix
      await page.click('#annotation-prefix', { clickCount: 3 });
      await page.type('#annotation-prefix', 'CUSTOM');
      await page.waitForTimeout(200);

      // Add annotation
      await page.click('#pdf-canvas');
      await page.waitForSelector('.annotation-marker', { timeout: 2000 });

      const annotationId = await page.evaluate(() => {
        return document.querySelector('.annotation-item .annotation-id').textContent;
      });

      expect(annotationId).toMatch(/^CUSTOM-\d{3}$/);
    });
  });

  describe('UI State', () => {
    test('should display correct initial state', async () => {
      const initialState = await page.evaluate(() => {
        return {
          saveDisabled: document.querySelector('#save-annotations').disabled,
          exportDisabled: document.querySelector('#export-pdf').disabled,
          toggleViewDisabled: document.querySelector('#toggle-view').disabled,
          deletePageDisabled: document.querySelector('#delete-page').disabled,
          pageInfo: document.querySelector('#page-info').textContent,
          annotationCount: document.querySelector('#annotation-count').textContent
        };
      });

      expect(initialState.saveDisabled).toBe(true);
      expect(initialState.exportDisabled).toBe(true);
      expect(initialState.toggleViewDisabled).toBe(true);
      expect(initialState.deletePageDisabled).toBe(true);
      expect(initialState.pageInfo).toBe('Page 0 of 0');
      expect(initialState.annotationCount).toBe('0');
    });
  });
});
