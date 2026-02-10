# PDF Slide Annotation Tool

A web-based tool for annotating PDF files with unique slide IDs. Designed for slideshow management systems where annotations mark slide transition points.

## Features

- **Load PDF files** - Support for multi-page PDF documents
- **Click to annotate** - Add unique IDs (e.g., SLIDE-001) by clicking on the PDF
- **Drag to reposition** - Move annotation markers to precise positions
- **Right-click to delete** - Remove unwanted annotations
- **Adjustable marker size** - Change marker size from 20px to 100px
- **Customizable prefixes** - Change annotation ID format to match your system
- **Project files** - Save and load projects with embedded PDF and annotations
- **Export annotated PDF** - Generate a PDF with visual markers (red asterisks) at annotation points
- **Page navigation** - Navigate through multi-page PDFs with ease
- **Zoom controls** - Zoom in/out for precise annotation placement
- **View modes** - Toggle between paginated and continuous view
- **Page deletion** - Remove unwanted pages from the PDF

## Usage

1. Open `index.html` in a modern web browser
2. Load a PDF file or existing project file
3. Click on areas to add annotations
4. Drag markers to adjust positions
5. Right-click markers to delete them
6. Save your project for later editing
7. Export annotated PDF when ready

## File Format

Project files are JSON format containing:
- PDF data (base64 encoded)
- Annotation positions and IDs
- Metadata (page count, timestamps, etc.)

## Technology Stack

- HTML5 Canvas
- PDF.js for PDF rendering
- pdf-lib for PDF generation
- Vanilla JavaScript (no build process required)

## Browser Requirements

Modern browsers with support for:
- ES6+ JavaScript
- HTML5 Canvas
- File API
- Base64 encoding/decoding

## Development

### Running Tests

Install dependencies:
```bash
npm install
```

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

Generate coverage report:
```bash
npm run test:coverage
```

**Note**: Some tests require a test PDF file at `__tests__/fixtures/test.pdf`. Tests will skip PDF-related functionality if this file is not present. See `__tests__/README.md` for more details.

### Test Coverage

The test suite includes:
- Integration tests for core functionality
- PDF export tests
- Project file save/load tests
- UI interaction tests
- Edge case handling

Tests use Puppeteer for browser automation and run in headless mode.
