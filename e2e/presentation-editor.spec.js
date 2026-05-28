const { test, expect } = require('@playwright/test');
const { openMenu, collectPageErrors } = require('./helpers');

test('create a presentation, add a slide, and see the live preview', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/presentation-editor.html');

  await openMenu(page, 'File');
  await page.locator('#new-presentation').click();

  await openMenu(page, 'Edit');
  await page.locator('#add-slide').click();

  // Slide counter updates and the properties form is enabled.
  await expect(page.locator('#slide-counter')).toHaveText('1 slide');
  const titleInput = page.locator('#slide-title');
  await expect(titleInput).toBeEnabled();

  // Typing flows into the live preview.
  await titleInput.fill('Der Lindenbaum');
  await expect(page.locator('#slide-editor .title-slide h1')).toHaveText('Der Lindenbaum');

  // The slide list reflects the new slide.
  await expect(page.locator('#slides-list .slide-item')).toHaveCount(1);
  await expect(page.locator('#slides-list .slide-item-preview')).toContainText('Der Lindenbaum');

  expect(errors).toEqual([]);
});
