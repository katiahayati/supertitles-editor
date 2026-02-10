# PDF Slide Annotation Tool

A web-based tool for annotating PDF files with unique slide IDs. Designed for slideshow management systems where annotations mark slide transition points.

## Features

- **Load PDF files** - Support for multi-page PDF documents
- **Click to annotate** - Add unique IDs (e.g., SLIDE-001) by clicking on the PDF
- **Drag to reposition** - Move annotation markers to precise positions
- **Right-click to delete** - Remove unwanted annotations
- **Customizable prefixes** - Change annotation ID format to match your system
- **Project files** - Save and load projects with embedded PDF and annotations
- **Export annotated PDF** - Generate a PDF with visual markers (red asterisks) at annotation points
- **Page navigation** - Navigate through multi-page PDFs with ease
- **Zoom controls** - Zoom in/out for precise annotation placement

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
