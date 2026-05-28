const { test, expect } = require('@playwright/test');
const { openMenu, collectPageErrors } = require('./helpers');

// Exercises the iframe ready-handshake (loadFrame) that replaced the old
// setTimeout(500) hack: creating a set must load data into both editor iframes.
test('new set loads both editor iframes via the ready handshake', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/supertitles-manager.html');

  await openMenu(page, 'File');
  await page.locator('#new-set').click();
  await page.locator('.modal-input').fill('Test Set');
  await page.locator('.modal-actions .btn-primary').click();

  await expect(page.locator('#file-name')).toContainText('Test Set');
  await expect(page.locator('#tabs')).toBeVisible();

  // Presentation editor iframe received the (empty) presentation.
  const editor = page.frameLocator('#presentation-frame');
  await expect(editor.locator('#slide-counter')).toHaveText('0 slides');
  await expect(editor.locator('#file-name')).toContainText('New presentation');

  // Annotation tab: the annotator iframe loaded with no PDF, so its drop zone shows.
  await page.locator('.tab[data-tab="annotation"]').click();
  await expect(page.frameLocator('#annotation-frame').locator('#drop-zone')).toBeVisible();

  // Annotate mode reveals the combined view.
  await openMenu(page, 'View');
  await page.locator('#toggle-mode').click();
  await expect(page.locator('body')).toHaveClass(/annotate-mode/);

  expect(errors).toEqual([]);
});
