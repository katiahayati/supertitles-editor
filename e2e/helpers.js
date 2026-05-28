// Menu items live in hover-revealed dropdowns, so hover the top-level menu title
// before clicking an item inside it.
async function openMenu(page, label) {
  await page.locator('.menu-title', { hasText: label }).hover();
}

// Attach before navigation; returns an array that collects uncaught page errors.
function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push(err.message));
  return errors;
}

module.exports = { openMenu, collectPageErrors };
