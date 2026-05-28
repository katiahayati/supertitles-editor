# Test Suite

Vitest unit tests that import the real modules from `src/shared/`. See the
top-level `TESTING.md` for the full guide.

```bash
npm test
npm run test:coverage
```

| File | Module under test | Focus |
| --- | --- | --- |
| `schema.test.js` | `src/shared/schema.js` | set normalization, active pages, annotation sort + sequential numbering |
| `base64.test.js` | `src/shared/base64.js` | encode/decode round-trips |
| `escape.test.js` | `src/shared/escape.js` | HTML escaping |
| `reveal.test.js` | `src/shared/reveal.js` | Reveal.js export markup |
| `messaging.test.js` | `src/shared/messaging.js` | postMessage protocol helpers |
| `dom-helpers.test.js` | `flash.js`, `loading.js`, `unsaved.js` | toast, loading overlay, unsaved tracker |
| `dialogs.test.js` | `src/shared/dialogs.js` | modal alert/confirm/prompt |

Tests need no fixtures, network, or browser — pure modules plus jsdom.
