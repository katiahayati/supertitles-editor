const { test, expect } = require('@playwright/test');
const { collectPageErrors } = require('./helpers');

const pages = [
  { path: '/index.html', ready: '.launcher h1' },
  { path: '/pdf-annotator.html', ready: '#drop-zone' },
  { path: '/presentation-editor.html', ready: '#slide-editor .empty-state' },
  { path: '/presentation-viewer.html', ready: '.slide-viewer' },
  { path: '/supertitles-manager.html', ready: '#empty-state' },
  { path: '/recital-manager.html', ready: '#empty-state' },
];

for (const { path, ready } of pages) {
  test(`${path} loads without page errors`, async ({ page }) => {
    const errors = collectPageErrors(page);
    await page.goto(path);
    await expect(page.locator(ready).first()).toBeVisible();
    expect(errors, `uncaught errors on ${path}`).toEqual([]);
  });
}

test('launcher links to all four apps', async ({ page }) => {
  await page.goto('/index.html');
  await expect(page.locator('.app-card')).toHaveCount(4);
  for (const href of [
    'recital-manager.html',
    'supertitles-manager.html',
    'presentation-editor.html',
    'pdf-annotator.html',
  ]) {
    await expect(page.locator(`.app-card[href="${href}"]`)).toBeVisible();
  }
});
