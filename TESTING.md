# Testing Guide

## Overview

This project includes a comprehensive test suite to ensure all functionality works correctly and to catch regressions early.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Suite Structure

### 1. Integration Tests (`__tests__/integration.test.js`)
Tests core functionality end-to-end:
- PDF loading and rendering
- Annotation management (add, count, unique IDs)
- Marker size controls (increase, decrease, min/max limits)
- Zoom controls (in, out)
- View mode toggling
- Page navigation
- Custom annotation prefixes
- UI state management

### 2. PDF Export Tests (`__tests__/pdf-export.test.js`)
Tests PDF export functionality:
- Export with annotations
- Export without PDF (should be disabled)
- Export with custom marker sizes
- Export with deleted pages excluded
- Download behavior

### 3. Project File Tests (`__tests__/project-files.test.js`)
Tests project save/load functionality:
- Saving projects with annotations
- Preserving marker size
- Preserving zoom level
- Preserving view mode
- Preserving deleted pages
- Loading projects
- Backward compatibility with old formats
- Project file structure validation

## Test Requirements

### Required Setup

1. **Node.js**: Version 18.x or 20.x
2. **Test PDF**: Place a test PDF at `__tests__/fixtures/test.pdf`

### Optional Test PDF

Tests will run without the test PDF, but will skip PDF-related tests. To enable full coverage:

1. Find or create a simple 2-3 page PDF
2. Place it at `__tests__/fixtures/test.pdf`
3. Re-run tests

## Continuous Integration

Tests automatically run on:
- Every push to main branch
- Every pull request
- Using GitHub Actions (see `.github/workflows/test.yml`)

## What's Tested

✅ **PDF Loading**
- File upload handling
- PDF rendering
- Canvas initialization
- Button state updates

✅ **Annotations**
- Adding by clicking
- Unique ID generation
- Counter updates
- Custom prefixes
- List display

✅ **Markers**
- Size adjustment
- Min/max limits
- Visual updates
- Drag and drop

✅ **Controls**
- Zoom in/out
- Page navigation
- View mode toggle
- Page deletion

✅ **Export**
- PDF generation
- Annotation rendering
- Deleted page handling
- Custom sizes

✅ **Project Files**
- Save functionality
- Load functionality
- Settings preservation
- State restoration

✅ **Edge Cases**
- Minimum/maximum values
- Button disable states
- Empty states
- Invalid inputs

## Test Coverage Goals

Current targets:
- Branches: 50%
- Functions: 50%
- Lines: 50%
- Statements: 50%

These are conservative targets that can be increased as the test suite matures.

## Writing New Tests

When adding new features:

1. Add test cases to appropriate test file
2. Follow existing test patterns
3. Use descriptive test names
4. Test both happy path and edge cases
5. Clean up resources after tests
6. Update this documentation

Example test structure:
```javascript
test('should do something specific', async () => {
  // Arrange - set up test conditions

  // Act - perform the action

  // Assert - verify the result
  expect(result).toBe(expected);
});
```

## Debugging Tests

If tests fail:

1. **Check logs**: Tests output detailed error messages
2. **Run in watch mode**: `npm run test:watch` for faster feedback
3. **Run single test**: `npm test -- integration.test.js`
4. **Check test PDF**: Ensure `__tests__/fixtures/test.pdf` exists
5. **Increase timeout**: Edit `jest.config.js` if tests timeout
6. **Headful mode**: Modify Puppeteer launch options to see browser

## Performance

Tests are optimized for speed:
- Run in parallel by default
- Use headless browser mode
- Clean up resources after each test
- Mock external dependencies where possible

Typical test run time: 30-60 seconds (depends on CPU and test PDF size)

## Known Limitations

- Tests require a test PDF for full coverage
- Some tests use timeouts to wait for UI updates
- Download tests may be flaky on some systems
- Browser automation tests require Chrome/Chromium

## Future Improvements

Potential enhancements:
- Visual regression testing
- Performance benchmarks
- Cross-browser testing
- Mobile device testing
- Accessibility testing
- Load testing with large PDFs
- Mock PDF.js for faster unit tests
