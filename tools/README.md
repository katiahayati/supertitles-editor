# Tools

Helper scripts that sit alongside the browser apps but are run separately.

## extract_with_ocr.py

Recovers annotation positions from a **flattened** score PDF — one where the
transition markers were drawn in (magenta/purple) and baked into the page rather
than stored as editable `.pdfannotations` data. It detects the colored marks via
image processing, groups them into individual markers, and writes a
`.pdfannotations` file you can open directly in the PDF Annotator (or attach to a
set in the Supertitles Manager).

### Setup

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r tools/requirements.txt
```

### Usage

```bash
# Detect marks in an annotated PDF and remove them, emitting annotated.pdfannotations
python tools/extract_with_ocr.py annotated.pdf

# Use a separate clean PDF for the output instead of erasing the marks
python tools/extract_with_ocr.py annotated.pdf clean.pdf output.pdfannotations
```

The output is a `version: 1` annotation project (`{ pdf, annotations, settings }`)
— the same format the PDF Annotator saves — so it loads straight into the apps.
