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

  // Slide/mark sanity check: starts matched at 0 / 0.
  await expect(page.locator('#slide-mark-status')).toContainText('0 / 0');
  await expect(page.locator('#slide-mark-status')).toHaveClass(/count-ok/);

  // Adding a slide (1) with no marks (0) must flag a mismatch in the manager.
  await editor.locator('.menu-title', { hasText: 'Edit' }).hover();
  await editor.locator('#add-slide').click();
  await expect(page.locator('#slide-mark-status')).toContainText('1 / 0');
  await expect(page.locator('#slide-mark-status')).toHaveClass(/count-mismatch/);

  // Annotation tab: the annotator iframe loaded with no PDF, so its drop zone shows.
  await page.locator('.tab[data-tab="annotation"]').click();
  await expect(page.frameLocator('#annotation-frame').locator('#drop-zone')).toBeVisible();

  // Annotate mode reveals the combined view.
  await openMenu(page, 'View');
  await page.locator('#toggle-mode').click();
  await expect(page.locator('body')).toHaveClass(/annotate-mode/);

  expect(errors).toEqual([]);
});

test('arrow keys step the slide preview in annotate mode', async ({ page }) => {
  await page.goto('/supertitles-manager.html');

  await openMenu(page, 'File');
  await page.locator('#new-set').click();
  await page.locator('.modal-input').fill('Arrows');
  await page.locator('.modal-actions .btn-primary').click();

  // Add two slides in the embedded editor.
  const editor = page.frameLocator('#presentation-frame');
  for (let i = 0; i < 2; i++) {
    await editor.locator('.menu-title', { hasText: 'Edit' }).hover();
    await editor.locator('#add-slide').click();
  }
  await expect(editor.locator('#slide-counter')).toHaveText('2 slides');

  // Enter annotate mode; the viewer opens on the current (2nd) slide.
  await openMenu(page, 'View');
  await page.locator('#toggle-mode').click();
  const viewer = page.frameLocator('#annotate-presentation-frame');
  await expect(viewer.locator('#slide-info')).toContainText('Slide 2 of 2');

  // Arrows on the parent page drive the preview back and forth.
  // (Focus is on the parent frame after clicking the toggle button.)
  await page.keyboard.press('ArrowLeft');
  await expect(viewer.locator('#slide-info')).toContainText('Slide 1 of 2');
  await page.keyboard.press('ArrowRight');
  await expect(viewer.locator('#slide-info')).toContainText('Slide 2 of 2');
  // Clamps at the end.
  await page.keyboard.press('ArrowRight');
  await expect(viewer.locator('#slide-info')).toContainText('Slide 2 of 2');
});
