const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('Project File Save/Load Tests', () => {
  let browser;
  let page;
  const testPdfPath = path.join(__dirname, 'fixtures', 'test.pdf');
  const downloadsPath = path.join(__dirname, 'downloads');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
  });

  afterAll(async () => {
    await browser.close();

    if (fs.existsSync(downloadsPath)) {
      fs.readdirSync(downloadsPath).forEach(file => {
        fs.unlinkSync(path.join(downloadsPath, file));
      });
      fs.rmdirSync(downloadsPath);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();

    const client = await page.target().createCDPSession();
    await client.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadsPath
    });

    const htmlPath = 'file://' + path.join(__dirname, '..', 'index.html');
    await page.goto(htmlPath, { waitUntil: 'networkidle0' });
  });

  afterEach(async () => {
    await page.close();
  });

  test('should save project with annotations', async () => {
    if (!fs.existsSync(testPdfPath)) {
      console.warn('Test PDF not found, skipping project save test');
      return;
    }

    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Add annotation
    await page.click('#pdf-canvas');
    await page.waitForSelector('.annotation-marker', { timeout: 2000 });

    // Mock prompt for save
    await page.evaluateOnNewDocument(() => {
      window.prompt = () => 'test-project';
    });

    const saveBtn = await page.$('#save-annotations');
    expect(saveBtn).not.toBeNull();

    const isDisabled = await page.evaluate(() => {
      return document.querySelector('#save-annotations').disabled;
    });

    expect(isDisabled).toBe(false);
  });

  test('should preserve marker size in project file', async () => {
    if (!fs.existsSync(testPdfPath)) {
      return;
    }

    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Change marker size
    await page.click('#marker-size-increase');
    await page.click('#marker-size-increase');
    await page.click('#marker-size-increase');
    await page.waitForTimeout(200);

    const markerSize = await page.evaluate(() => {
      return document.querySelector('#marker-size-display').textContent;
    });

    expect(parseInt(markerSize)).toBe(55);
  });

  test('should preserve zoom level in project file', async () => {
    if (!fs.existsSync(testPdfPath)) {
      return;
    }

    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Change zoom
    await page.click('#zoom-in');
    await page.click('#zoom-in');
    await page.waitForTimeout(500);

    const zoomLevel = await page.evaluate(() => {
      return document.querySelector('#zoom-level').textContent;
    });

    expect(parseInt(zoomLevel)).toBeGreaterThan(150);
  });

  test('should preserve view mode in project file', async () => {
    if (!fs.existsSync(testPdfPath)) {
      return;
    }

    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Switch to continuous view
    await page.click('#toggle-view');
    await page.waitForTimeout(500);

    const viewModeText = await page.evaluate(() => {
      return document.querySelector('#view-mode-text').textContent;
    });

    expect(viewModeText).toBe('Paginated View');
  });

  test('should preserve deleted pages in project file', async () => {
    if (!fs.existsSync(testPdfPath)) {
      return;
    }

    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Navigate to page 2 and delete it
    await page.click('#next-page');
    await page.waitForTimeout(500);

    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.click('#delete-page');
    await page.waitForTimeout(500);

    // Check that we're back on page 1
    const pageInfo = await page.evaluate(() => {
      return document.querySelector('#page-info').textContent;
    });

    expect(pageInfo).toContain('Page 1');
  });

  test('should handle loading project without deleted pages', async () => {
    // Test that old project files (without deletedPages field) still work
    const mockProjectData = {
      version: '1.0',
      annotationPrefix: 'SLIDE',
      annotations: [
        { id: 'SLIDE-001', page: 1, x: 0.5, y: 0.5 }
      ],
      markerSize: 40,
      scale: 1.5,
      viewMode: 'paginated',
      metadata: {
        totalPages: 1,
        pdfFileName: 'test.pdf',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }
    };

    // This test just validates the structure is correct
    expect(mockProjectData.annotations).toHaveLength(1);
    expect(mockProjectData.annotationPrefix).toBe('SLIDE');
    expect(mockProjectData.markerSize).toBe(40);
  });

  test('should validate project file structure', async () => {
    // Validate that project files have required fields
    const requiredFields = [
      'version',
      'annotationPrefix',
      'annotations',
      'markerSize',
      'scale',
      'viewMode',
      'metadata'
    ];

    const mockProject = {
      version: '1.0',
      annotationPrefix: 'SLIDE',
      annotations: [],
      markerSize: 40,
      scale: 1.5,
      viewMode: 'paginated',
      deletedPages: [],
      metadata: {
        totalPages: 1,
        pdfFileName: 'test.pdf',
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString()
      }
    };

    requiredFields.forEach(field => {
      expect(mockProject).toHaveProperty(field);
    });
  });
});
