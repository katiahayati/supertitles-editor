# Supertitles Manager Test Suite

This directory contains comprehensive tests for the Supertitles Manager system.

## Test Structure

### Unit & Logic Tests (Run by default)
- `annotation-numbering.test.js` - Annotation numbering logic (critical for PDF export)
- `data-structures.test.js` - Data structure validation and transformations
- `state-management.test.js` - State management and iframe communication
- `ui-interactions.test.js` - UI interactions and user workflows
- `workflows.test.js` - Complete end-to-end user workflows

### Browser Tests (Require Puppeteer, excluded by default)
- `integration.test.js` - Browser-based integration tests
- `pdf-export.test.js` - PDF export functionality tests
- `project-files.test.js` - Project file save/load tests

## Setup

1. Install dependencies:
```bash
npm install
```

2. Add a test PDF file:
Place a sample PDF file at `__tests__/fixtures/test.pdf`. The tests will skip PDF-related tests if this file is not present.

You can create a simple test PDF using:
- Online tools like https://www.adobe.com/acrobat/online/word-to-pdf.html
- Or any PDF you have available (preferably a simple 2-3 page PDF)

## Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Run tests with coverage:
```bash
npm run test:coverage
```

Run specific test file:
```bash
npm test -- integration.test.js
```

## Test Coverage

**Total Tests**: 86 passing
**Test Suites**: 5
**Pass Rate**: 100%

### Annotation Numbering (17 tests)
Critical tests for the v1.2.1 bug fix:
- Sequential numbering ignoring annotation IDs
- Handling deleted pages during numbering
- Sorting annotations by position (page, y, x)
- Multiple annotations per page
- Edge cases (empty arrays, all pages deleted)
- Numbering across multiple supertitles sets

### Data Structures (24 tests)
- Annotation structure and normalized coordinates (0-1 range)
- Presentation slide types (title, supertitle)
- Project file structure (PDF + annotations + settings)
- Supertitles set structure
- Recital structure and item types
- Coordinate normalization and PDF conversion
- Deleted pages handling
- Base64 encoding/decoding

### State Management (17 tests)
- PDF annotator state (zoom, annotations, pages, marker size)
- Presentation editor state (slides, navigation, playback)
- Supertitles manager state (mode switching, position tracking)
- Recital manager state (items, reordering, removal)
- Message passing between iframes (postMessage protocol)
- Settings persistence and application

### UI Interactions (23 tests)
- Zoom controls (increase/decrease with 0.5-3.0 limits)
- Marker size controls (20-100px limits)
- Page navigation (including skipping deleted pages)
- Annotation placement (normalized coordinates)
- Annotation deletion (right-click, page deletion)
- Slide navigation (keyboard arrows)
- Mode switching (Edit/Annotate)
- File loading states
- Recital item management (add, move, delete)
- Keyboard shortcuts (arrows, space for play/pause)

### Complete Workflows (5 tests)
- Full PDF annotation workflow (load, annotate, delete pages, zoom, save)
- Presentation creation workflow (add slides, navigate, edit, save)
- Recital export workflow (sequential numbering across sets and deleted pages)
- Position preservation when switching modes
- Settings persistence through save/load cycles

## Key Test Scenarios

### Critical: Annotation Numbering (v1.2.1 Bug Fix)
The most important tests verify the fix for recital manager PDF export:
1. Annotations numbered sequentially by sorted order, NOT by ID
2. Deleted pages skipped during numbering
3. Numbering continues correctly across multiple supertitles sets

Example: If a recital has a title slide (1), then two sets with 2 and 3 annotations respectively, the numbers should be: 1, 2, 3, 4, 5, 6 - not resetting per set.

### Settings Persistence
Tests ensure all settings survive save/load cycles:
- Zoom level (0.5-3.0)
- Marker size (20-100px)
- Deleted pages array
- All annotations with positions

### Position Preservation
Tests verify current slide and page are preserved when:
- Switching between Edit and Annotate modes
- Reloading supertitles sets

## Testing Philosophy

These tests focus on:
1. **Business Logic**: Core algorithms and data transformations
2. **State Management**: Proper state updates and synchronization
3. **Data Integrity**: Correct structure and validation
4. **User Workflows**: Complete end-to-end scenarios
5. **Bug Prevention**: Regression tests for fixed bugs

The tests do NOT require:
- Actual PDF.js library (mocked via setup.js)
- Real browser environment (uses jsdom)
- Real file I/O (mocked FileReader, URL)
- Network requests

This makes tests fast (< 1 second), reliable, and suitable for CI/CD.

## Notes

- Main test suite runs in jsdom environment (no browser needed)
- Browser-based tests (Puppeteer) are excluded by default
- All external dependencies are mocked in `setup.js`
- Tests are independent and can run in any order

## Adding New Tests

When adding new features:

1. Add test cases to the appropriate test file
2. Update this README with new coverage areas
3. Ensure tests are independent
4. Mock external dependencies in setup.js
5. Focus on business logic, not implementation details
