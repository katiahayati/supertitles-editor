const { test, expect } = require('@playwright/test');
const { openMenu, collectPageErrors } = require('./helpers');

test('create a recital and add a title slide via the in-app dialogs', async ({ page }) => {
  const errors = collectPageErrors(page);
  await page.goto('/recital-manager.html');

  // New Recital uses the in-app prompt modal (not native prompt()).
  await openMenu(page, 'File');
  await page.locator('#new-recital').click();
  await expect(page.locator('.modal-overlay')).toBeVisible();
  await page.locator('.modal-input').fill('Winterreise');
  await page.locator('.modal-actions .btn-primary').click();
  await expect(page.locator('.modal-overlay')).toHaveCount(0);

  await expect(page.locator('#main-content')).toBeVisible();
  await expect(page.locator('#file-name')).toContainText('Winterreise');

  // Add a title slide through the inline editor.
  await openMenu(page, 'Edit');
  await page.locator('#add-title-slide').click();
  await page.locator('#title-slide-title').fill('Intermission');
  await page.locator('#confirm-title-slide').click();

  const items = page.locator('#recital-list .recital-item');
  await expect(items).toHaveCount(1);
  await expect(items.first()).toContainText('Title Slide');
  await expect(items.first()).toContainText('Intermission');

  expect(errors).toEqual([]);
});
