# Slides Editor - ODP Format

A simple web-based editor for creating and editing OpenDocument Presentation (ODP) files.

## Features

- **Load ODP files** - Open existing .odp presentations
- **Create new presentations** - Start from scratch
- **Edit slides** - Update title and content for each slide
- **Add slides** - Create new slides in your presentation
- **Delete slides** - Remove unwanted slides
- **Save as ODP** - Export your presentation as .odp format
- **Slide navigation** - Easy browsing through slides
- **Live preview** - See changes as you edit

## Usage

1. Open `slides-editor.html` in a web browser
2. Choose an option:
   - **Load ODP**: Load an existing .odp file
   - **New Presentation**: Start with a blank presentation
3. Edit slides using the form on the right
4. Click "Update Slide" to save changes to current slide
5. Use "Add Slide" to create new slides
6. Click "Save ODP" to export your presentation

## File Structure

```
slides-editor.html - Main HTML file
slides-editor.css  - Styling
slides-editor.js   - ODP parsing and generation logic
```

## Technical Details

### ODP Format

ODP (OpenDocument Presentation) is an open standard format based on XML and ZIP:
- Files are ZIP archives containing XML files
- `content.xml` - Contains slide content
- `meta.xml` - Contains presentation metadata
- `styles.xml` - Contains styling information
- `META-INF/manifest.xml` - File manifest

### Implementation

The editor uses:
- **JSZip** - For reading and creating ZIP archives
- **DOMParser** - For parsing XML content
- **Vanilla JavaScript** - No framework dependencies

### Features

**Loading:**
- Extracts slides from content.xml
- Parses text content from draw:frame elements
- Preserves original file structure when possible

**Saving:**
- Generates valid ODP structure
- Creates content.xml with updated slides
- Includes metadata in meta.xml
- Maintains compatibility with LibreOffice/OpenOffice

### Limitations

Current version is simplified and:
- Supports title + content text only
- Does not preserve complex formatting
- Does not handle images or media
- Does not preserve animations
- Limited style support

## Browser Requirements

Modern browsers with:
- ES6+ JavaScript support
- File API support
- Blob and URL.createObjectURL support

## ODP Compatibility

Generated ODP files are compatible with:
- LibreOffice Impress
- Apache OpenOffice Impress
- Other ODP-compatible presentation software

## Future Enhancements

Potential improvements:
- Rich text formatting
- Image support
- Slide layouts
- Master slides
- Animations
- Speaker notes
- Slide transitions
- Export to PDF
- Import from PowerPoint

## Testing

To test the editor:
1. Create a simple ODP in LibreOffice Impress
2. Load it in the editor
3. Make changes
4. Save as new ODP
5. Open in LibreOffice to verify

## Notes

- The editor focuses on text content only
- Complex presentations may lose formatting
- Best used for simple text-based slides
- Always keep backups of original files
