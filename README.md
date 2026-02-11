# Supertitles Manager

A complete workflow tool for creating and managing supertitles for musical recitals. Create presentations, annotate PDFs, and combine multiple song cycles into a complete recital program.

## Overview

This toolkit provides four integrated applications for managing supertitles:

- **PDF Annotator** - Add numbered annotations to PDF scores
- **Presentation Editor** - Create and edit supertitle slides
- **Supertitles Manager** - Link presentations with annotated PDFs
- **Recital Manager** - Combine multiple sets into a complete recital

## Quick Start

Simply open any of the HTML files in your web browser:

- `pdf-annotator.html` - Annotate PDF scores
- `presentation-editor.html` - Create and edit slides
- `supertitles-manager.html` - Link presentations with PDFs
- `recital-manager.html` - Combine multiple sets into a recital

All applications run entirely in your browser—no server or installation required.

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
