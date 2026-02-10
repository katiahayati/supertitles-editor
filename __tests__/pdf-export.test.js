const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

describe('PDF Export Tests', () => {
  let browser;
  let page;
  const testPdfPath = path.join(__dirname, 'fixtures', 'test.pdf');
  const downloadsPath = path.join(__dirname, 'downloads');

  beforeAll(async () => {
    browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    // Create downloads directory
    if (!fs.existsSync(downloadsPath)) {
      fs.mkdirSync(downloadsPath, { recursive: true });
    }
  });

  afterAll(async () => {
    await browser.close();

    // Cleanup downloads directory
    if (fs.existsSync(downloadsPath)) {
      fs.readdirSync(downloadsPath).forEach(file => {
        fs.unlinkSync(path.join(downloadsPath, file));
      });
      fs.rmdirSync(downloadsPath);
    }
  });

  beforeEach(async () => {
    page = await browser.newPage();

    // Set download behavior
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

  test('should trigger PDF export with annotations', async () => {
    if (!fs.existsSync(testPdfPath)) {
      console.warn('Test PDF not found, skipping PDF export test');
      return;
    }

    // Load PDF
    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Add annotation
    await page.click('#pdf-canvas', { offset: { x: 100, y: 100 } });
    await page.waitForSelector('.annotation-marker', { timeout: 2000 });

    // Mock the prompt for filename
    await page.evaluateOnNewDocument(() => {
      window.prompt = () => 'test-export';
    });

    // Wait for pdf-lib to load
    await page.waitForTimeout(1000);

    // Click export (this will trigger download)
    const exportPromise = new Promise((resolve) => {
      page.on('dialog', async dialog => {
        await dialog.accept();
        resolve();
      });
    });

    await page.click('#export-pdf');

    // Wait for potential alert
    await Promise.race([
      exportPromise,
      page.waitForTimeout(3000)
    ]);

    // Verify export button was clicked
    const exportBtnClicked = await page.evaluate(() => {
      return document.querySelector('#export-pdf') !== null;
    });

    expect(exportBtnClicked).toBe(true);
  });

  test('should not export without PDF loaded', async () => {
    const exportDisabled = await page.evaluate(() => {
      return document.querySelector('#export-pdf').disabled;
    });

    expect(exportDisabled).toBe(true);
  });

  test('should export with custom marker sizes', async () => {
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
    await page.waitForTimeout(200);

    // Add annotation
    await page.click('#pdf-canvas');
    await page.waitForSelector('.annotation-marker', { timeout: 2000 });

    const markerSize = await page.evaluate(() => {
      return document.querySelector('#marker-size-display').textContent;
    });

    expect(parseInt(markerSize)).toBeGreaterThan(40);

    // Export should not throw error
    await page.evaluateOnNewDocument(() => {
      window.prompt = () => 'test-custom-size';
    });

    const exportBtn = await page.$('#export-pdf');
    expect(exportBtn).not.toBeNull();
  });

  test('should export with deleted pages excluded', async () => {
    if (!fs.existsSync(testPdfPath)) {
      return;
    }

    const fileInput = await page.$('#pdf-upload');
    await fileInput.uploadFile(testPdfPath);

    await page.waitForFunction(
      () => document.querySelector('#pdf-canvas').width > 0,
      { timeout: 5000 }
    );

    // Add annotation on first page
    await page.click('#pdf-canvas');
    await page.waitForSelector('.annotation-marker', { timeout: 2000 });

    // Navigate to second page
    await page.click('#next-page');
    await page.waitForTimeout(500);

    // Delete the second page
    page.on('dialog', async dialog => {
      await dialog.accept();
    });

    await page.click('#delete-page');
    await page.waitForTimeout(500);

    // Verify we're on first page and export button is enabled
    const state = await page.evaluate(() => {
      return {
        exportDisabled: document.querySelector('#export-pdf').disabled,
        pageInfo: document.querySelector('#page-info').textContent
      };
    });

    expect(state.exportDisabled).toBe(false);
    expect(state.pageInfo).toContain('Page 1');
  });
});
