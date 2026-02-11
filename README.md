# Supertitles Manager

A complete workflow tool for creating and managing supertitles for musical recitals. Create presentations, annotate PDFs, and combine multiple song cycles into a complete recital program.

## Overview

This toolkit provides four integrated applications for managing supertitles:

- **PDF Annotator** - Add numbered annotations to PDF scores
- **Presentation Editor** - Create and edit supertitle slides
- **Supertitles Manager** - Link presentations with annotated PDFs
- **Recital Manager** - Combine multiple sets into a complete recital

## Quick Start

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3 (for local server)

### Running the Application

```bash
# Start a local web server
python3 -m http.server 8080

# Open in browser
# Navigate to http://localhost:8080
```

## Workflow

### For a Single Song Cycle or Set

1. **Create Your Slides**
   - Use an external editor (Google Slides, LibreOffice Impress, PowerPoint)
   - Design your supertitle slides with translations, lyrics, or text
   - Export as `.odp` format (OpenDocument Presentation)

2. **Import and Edit** (if needed)
   - Open `presentation-editor.html`
   - **File → Import from ODP**
   - Make any necessary edits
   - **File → Save Project** (saves as `.json`)

3. **Annotate Your Score**
   - Open `pdf-annotator.html`
   - **File → New Project** and load your PDF score
   - Click to add numbered annotations where each slide should appear
   - Drag markers to adjust positioning
   - **File → Save Project** (saves as `.pdfannotations`)

4. **Link Presentation with Annotations**
   - Open `supertitles-manager.html`
   - **File → New Set**
   - The presentation editor and PDF annotator will load
   - Edit your presentation and add annotations
   - **File → Save Set** (saves as `.supertitles`)
   - This creates three files:
     - `name.supertitles` - Combined set (all data included)
     - `name_presentation.json` - Standalone presentation
     - `name_annotation.pdfannotations` - Standalone annotations

### For a Complete Recital (Multiple Sets)

1. **Create Individual Sets**
   - Complete the workflow above for each song cycle or piece
   - Save each as a `.supertitles` file

2. **Combine into Recital**
   - Open `recital-manager.html`
   - **File → New Recital**
   - **Edit → Add Supertitles Set** for each song cycle
   - **Edit → Add Title Slide** to add intermission or section markers
   - Drag and drop to reorder items
   - **File → Save Recital** (saves as `.recital`)

3. **Export Final Files**
   - **File → Export Presentation** - Complete slide deck as HTML
   - **File → Export Combined PDF** - All scores with annotations

## Features

### PDF Annotator
- Load and annotate PDF scores
- Numbered markers with customizable size
- Delete individual pages or annotations
- Zoom controls for precise placement
- Save/load annotation projects

### Presentation Editor
- Import from ODP files
- Multiple slide layouts (title, title+subtitle, title+content, content only)
- Drag-and-drop slide reordering
- Real-time preview
- Export to HTML (Reveal.js)

### Supertitles Manager
- Integrated presentation and annotation editing
- **Annotate Mode** - Side-by-side view for precise alignment
- Automatic change tracking
- Embedded project saving (self-contained files)

### Recital Manager
- Combine multiple supertitle sets
- Add custom title slides between pieces
- Reorder items with drag-and-drop
- Export complete presentation and combined PDF
- Perfect for multi-song recitals and concerts

## Keyboard Shortcuts

- `Ctrl+S` / `Cmd+S` - Save project
- `+` / `-` - Zoom in/out (PDF Annotator)
- `←` / `→` - Navigate pages (PDF Annotator)

## File Formats

- `.odp` - OpenDocument Presentation (import/export)
- `.json` - Presentation project files
- `.pdfannotations` - PDF annotation project files
- `.supertitles` - Combined presentation + annotation sets
- `.recital` - Complete recital with multiple sets

## Tips

- **Use high-quality PDFs** for best annotation results
- **Export from Google Slides**: File → Download → ODP Document
- **Export from LibreOffice**: File → Save As → ODP
- **Save frequently** - Unsaved changes indicator (●) appears when needed
- **Annotate Mode** in Supertitles Manager helps align slides with score measures
- **Test your workflow** with a single song before creating a full recital

## Browser Compatibility

- Chrome/Edge (recommended)
- Firefox
- Safari

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

### Test Coverage

The test suite includes 86 passing tests covering:
- Integration tests for core functionality
- PDF export tests
- Project file save/load tests
- UI interaction tests
- Edge case handling

Tests use Jest and run in headless mode.

## Version

Current version: **v1.3.0**

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
