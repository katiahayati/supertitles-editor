# Tests for PDF Annotation Tool

This directory contains automated tests for the PDF annotation tool.

## Test Structure

- `integration.test.js` - End-to-end tests for core functionality
- `pdf-export.test.js` - Tests for PDF export functionality
- `project-files.test.js` - Tests for project save/load functionality

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

The tests cover:

### Core Functionality
- PDF loading and rendering
- Button state management
- Canvas interaction
- UI state validation

### Annotation Management
- Adding annotations by clicking
- Generating unique annotation IDs
- Updating annotation counter
- Custom annotation prefixes

### Marker Controls
- Increasing/decreasing marker size
- Enforcing min/max size limits
- Size display updates

### Zoom Controls
- Zoom in/out functionality
- Canvas size changes

### View Modes
- Toggling between paginated and continuous views
- UI state changes with view modes
- Button state in different views

### Page Navigation
- Next/previous page navigation
- Button disable states
- Page info display

### Page Deletion
- Deleting pages in paginated view
- Annotations removal on page deletion
- Navigation after deletion

### PDF Export
- Export functionality
- Export with annotations
- Export with custom marker sizes
- Export with deleted pages excluded

### Project Files
- Saving project state
- Preserving marker size
- Preserving zoom level
- Preserving view mode
- Preserving deleted pages
- Loading project files
- Backward compatibility

## Notes

- Tests use Puppeteer for browser automation
- Some tests require a test PDF file to run
- Tests run in headless mode by default
- Download tests create a temporary downloads directory
- All temporary files are cleaned up after tests

## Troubleshooting

If tests fail:

1. **Test PDF not found**: Add a PDF file to `__tests__/fixtures/test.pdf`
2. **Timeout errors**: Increase timeout in jest.config.js
3. **Puppeteer issues**: Make sure Chrome/Chromium is installed
4. **Permission errors**: Check file permissions in __tests__ directory

## Adding New Tests

When adding new features, please add corresponding tests:

1. Add test cases to the appropriate test file
2. Update this README with new test coverage areas
3. Ensure tests are independent and can run in any order
4. Clean up any resources (files, downloads) created during tests
