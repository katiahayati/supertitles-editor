# Testing Guide

The unit tests run with [Vitest](https://vitest.dev/) in a jsdom environment and
import the **real** source modules from `src/shared/` — they exercise the actual
shipped code, not copies of it.

## Running

```bash
npm install
npm test                # run once
npm run test:watch      # watch mode
npm run test:coverage   # with a coverage report (gated at 70%)
```

No test PDF or browser is required; all dependencies are pure modules or use
jsdom's DOM.

## What's covered

Tests live in `__tests__/` and target `src/shared/`:

- `schema.test.js` — set normalization (`normalizeSet`), active-page computation,
  annotation sorting, and sequential annotation **numbering** (the v1.2.x
  combined-PDF numbering contract: number in reading order, skip deleted pages,
  continue across sets).
- `base64.test.js` — base64 encode/decode round-trips, including buffers larger
  than the chunking threshold.
- `escape.test.js` — HTML escaping and newline-to-`<br>` conversion.
- `reveal.test.js` — Reveal.js export: one section per slide, escaping, style
  conversion, title/subtitle handling.
- `messaging.test.js` — the iframe postMessage protocol helpers (known-type
  filtering, ready handshake).
- `dom-helpers.test.js` — flash toast, loading overlay, unsaved-changes tracker.
- `dialogs.test.js` — promise-based alert/confirm/prompt modals.

## Coverage

`npm run test:coverage` enforces a 70% threshold across `src/shared/`. Raise it as
coverage grows.

## End-to-end (browser) tests

[Playwright](https://playwright.dev/) drives the real apps in headless Chromium
against the Vite dev server (which Playwright starts automatically).

```bash
npx playwright install chromium   # one-time: download the browser
npm run test:e2e
```

Specs live in `e2e/`:

- `smoke.spec.js` — every page loads with no uncaught errors; the launcher links
  to all four apps.
- `presentation-editor.spec.js` — new presentation → add slide → typing flows to
  the live preview and slide list.
- `recital-manager.spec.js` — new recital + add title slide, exercising the
  in-app modal dialogs (no native `prompt`).
- `supertitles-manager.spec.js` — creating a set loads both editor iframes via
  the ready-handshake (the mechanism that replaced the old `setTimeout` hack),
  plus tab switching and annotate-mode.

These tests need network access, because the apps load pdf.js, JSZip, and pdf-lib
from CDNs. They are intentionally **not** part of CI (to keep CI off the network);
run them locally before shipping UI changes.

## Notes

- The app entry modules in `src/apps/` are thin DOM controllers wired to the
  shared modules; their logic lives in `src/shared/` where it is unit-tested,
  and their wiring is covered by the Playwright specs above.
