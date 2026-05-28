# Supertitles Manager

A complete workflow tool for creating and managing supertitles for musical recitals. Create presentations, annotate PDFs, and combine multiple song cycles into a complete recital program.

## Overview

This toolkit provides four integrated applications for managing supertitles:

- **PDF Annotator** - Add numbered annotations to PDF scores
- **Presentation Editor** - Create and edit supertitle slides
- **Supertitles Manager** - Link presentations with annotated PDFs
- **Recital Manager** - Combine multiple sets into a complete recital

## Demo Video

Here's a [video](https://youtu.be/btKFC8YLiCA) that shows how to use the tool and the philosophy behind it.

## Summary Workflow

1. **Create your slides** in an editor that supports ODP export (Google Slides, LibreOffice Impress for example). 
Do this separately for every set in your recital.
2. **Use the supertitles manager** (supertitles-manager.html) to open the presentation and the score PDF and annotate
the PDF with where you want transitions. Do this for every set.
3. **Use the recital manager** (recital-manager.html) to piece your recital from the sets you created.
4. **Export full presentation and annotated score**. Regenerate them as often as you want with no additional work.

## Quick Start

The apps still run entirely in your browser with **no server at runtime** — but
the source is now ES modules, so you build self-contained pages first.

```bash
npm install
npm run build
```

This writes self-contained HTML files to `dist/` (all JS and CSS inlined). Open
any of them directly in your browser — double-click or `file://`:

- `dist/index.html` - Launcher linking all four apps
- `dist/pdf-annotator.html` - Annotate PDF scores
- `dist/presentation-editor.html` - Create and edit slides
- `dist/supertitles-manager.html` - Link presentations with PDFs
- `dist/recital-manager.html` - Combine multiple sets into a recital

(An internet connection is still needed the first time, for the CDN libraries
pdf.js, JSZip, pdf-lib, and Reveal.js.)

## Development

```bash
npm run dev      # Vite dev server with hot reload (open the printed URL)
npm test         # Run the unit test suite (Vitest)
npm run test:coverage
npm run test:e2e # Browser end-to-end tests (Playwright; needs `npx playwright install chromium` once)
```

Source layout:

- `src/apps/` - one entry module per page
- `src/shared/` - shared utilities (escaping, base64, dialogs, toast, the iframe
  messaging protocol, the set/annotation schema, Reveal export)
- `src/styles/` - shared CSS (`base`, `menubar`, `forms`, `pdf-annotator`)
- `tools/` - standalone helpers (see `tools/README.md`), e.g. OCR-based
  annotation recovery from flattened PDFs

## Workflow

### For a Single Song Cycle or Set

1. **Create Your Slides**
   - Use an external editor (Google Slides, LibreOffice Impress, PowerPoint)
   - Design your supertitle slides with translations, lyrics, or text
   - Export as `.odp` format (OpenDocument Presentation)

4. **Link Translations with Score**
   - Open `supertitles-manager.html`
   - **File → New Set**
   - The presentation editor and PDF annotator will load
   - Edit your presentation and add annotations
   - **File → Save Set** — saves a single self-contained `name.supertitles` file
     (presentation + annotation + PDF all embedded)
   - **File → Export Components** (optional) — also writes the standalone
     `name_presentation.json` and `name_annotation.pdfannotations` files for
     editing in the individual tools

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

## Version

Current version: **v1.3.0**

---

🤖 Built with [Claude Code](https://claude.com/claude-code)
