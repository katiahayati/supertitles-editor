#!/usr/bin/env python3
"""
Extract magenta/purple regions from flattened PDF using image processing.
Creates sequential annotations at detected positions.
"""

import sys
import json
import pymupdf
import base64
import cv2
import numpy as np
from PIL import Image
import io

def group_nearby_positions(positions, distance_threshold=0.05):
    """Group positions that are close together (part of the same number)."""
    if not positions:
        return []

    # Sort by y, then x
    positions = sorted(positions, key=lambda p: (p['y'], p['x']))

    groups = []
    current_group = [positions[0]]

    for pos in positions[1:]:
        # Check if this position is close to any position in the current group
        min_dist = min(
            ((pos['x'] - p['x'])**2 + (pos['y'] - p['y'])**2)**0.5
            for p in current_group
        )

        if min_dist < distance_threshold:
            # Add to current group
            current_group.append(pos)
        else:
            # Start new group
            groups.append(current_group)
            current_group = [pos]

    # Don't forget the last group
    groups.append(current_group)

    # Return the center of each group
    grouped_positions = []
    for group in groups:
        avg_x = sum(p['x'] for p in group) / len(group)
        avg_y = sum(p['y'] for p in group) / len(group)
        grouped_positions.append({
            'page': group[0]['page'],
            'x': avg_x,
            'y': avg_y
        })

    return grouped_positions

def remove_magenta_from_page(page):
    """Remove magenta/purple colored regions from the page using redaction."""
    # Render page to image
    mat = pymupdf.Matrix(2.0, 2.0)
    pix = page.get_pixmap(matrix=mat)

    # Convert to numpy array
    img_data = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_data))
    img_array = np.array(img)

    # Convert RGB to HSV
    hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)

    # Define range for magenta/purple color
    lower_magenta1 = np.array([140, 50, 50])
    upper_magenta1 = np.array([170, 255, 255])
    lower_magenta2 = np.array([290//2, 50, 50])
    upper_magenta2 = np.array([330//2, 255, 255])

    # Create mask for magenta color
    mask1 = cv2.inRange(hsv, lower_magenta1, upper_magenta1)
    mask2 = cv2.inRange(hsv, lower_magenta2, upper_magenta2)
    mask = cv2.bitwise_or(mask1, mask2)

    # Find contours of magenta regions
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Get page dimensions
    page_rect = page.rect
    page_width = page_rect.width
    page_height = page_rect.height

    # Add redaction annotations for each magenta region
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)

        # Convert from image coordinates (2x scaled) to PDF coordinates
        # Image: (0,0) at top-left, y increases downward
        # PDF: (0,0) at bottom-left, y increases upward
        pdf_x0 = (x / pix.width) * page_width
        pdf_y0 = page_height - ((y + h) / pix.height) * page_height
        pdf_x1 = ((x + w) / pix.width) * page_width
        pdf_y1 = page_height - (y / pix.height) * page_height

        # Add redaction annotation
        rect = pymupdf.Rect(pdf_x0, pdf_y0, pdf_x1, pdf_y1)
        page.add_redact_annot(rect, fill=(1, 1, 1))

    # Apply all redactions on this page
    page.apply_redactions()

def find_magenta_numbers(page, page_num):
    """Find magenta regions on a page using image processing."""

    # Render page to image
    mat = pymupdf.Matrix(2.0, 2.0)  # 2x zoom for better detection
    pix = page.get_pixmap(matrix=mat)

    # Convert to numpy array
    img_data = pix.tobytes("png")
    img = Image.open(io.BytesIO(img_data))
    img_array = np.array(img)

    # Convert RGB to HSV for better color detection
    hsv = cv2.cvtColor(img_array, cv2.COLOR_RGB2HSV)

    # Define range for magenta/purple color
    # Magenta in HSV: Hue around 280-320 degrees (normalized to 0-180 in OpenCV)
    lower_magenta1 = np.array([140, 50, 50])   # Lower purple range
    upper_magenta1 = np.array([170, 255, 255])

    lower_magenta2 = np.array([290//2, 50, 50])  # Upper purple range
    upper_magenta2 = np.array([330//2, 255, 255])

    # Create mask for magenta color
    mask1 = cv2.inRange(hsv, lower_magenta1, upper_magenta1)
    mask2 = cv2.inRange(hsv, lower_magenta2, upper_magenta2)
    mask = cv2.bitwise_or(mask1, mask2)

    # Find contours
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    positions = []

    for contour in contours:
        # Get bounding box
        x, y, w, h = cv2.boundingRect(contour)

        # Filter by size (numbers should be relatively small)
        if w < 10 or h < 10 or w > 200 or h > 200:
            continue

        # Calculate normalized position (center of bounding box)
        # Remember we rendered at 2x zoom
        x_center = (x + w/2) / (pix.width)
        y_center = (y + h/2) / (pix.height)

        positions.append({
            "page": page_num + 1,
            "x": x_center,
            "y": y_center
        })

    return positions

def extract_with_ocr(pdf_path):
    """Extract annotations using color detection and remove original numbers."""
    doc = pymupdf.open(pdf_path)

    all_positions = []

    print(f"Processing {len(doc)} pages...")

    # First pass: detect positions
    for page_num in range(len(doc)):
        print(f"\nPage {page_num + 1}:")
        page = doc[page_num]

        positions = find_magenta_numbers(page, page_num)
        print(f"  Found {len(positions)} raw detections")
        all_positions.extend(positions)

    # Group nearby positions (same page only)
    print(f"\nGrouping nearby positions...")
    pages_positions = {}
    for pos in all_positions:
        page = pos['page']
        if page not in pages_positions:
            pages_positions[page] = []
        pages_positions[page].append(pos)

    grouped_all = []
    for page in sorted(pages_positions.keys()):
        grouped = group_nearby_positions(pages_positions[page])
        print(f"  Page {page}: {len(pages_positions[page])} detections -> {len(grouped)} groups")
        grouped_all.extend(grouped)

    # Sort by page, then by y position (top to bottom), then by x position (left to right)
    grouped_all.sort(key=lambda a: (a['page'], a['y'], a['x']))

    # Now assign sequential IDs
    all_annotations = []
    for i, pos in enumerate(grouped_all):
        annotation = {
            "id": f"SLIDE-{i+1:03d}",
            "page": pos['page'],
            "x": pos['x'],
            "y": pos['y']
        }
        all_annotations.append(annotation)

    # Second pass: remove magenta numbers from PDF
    print(f"\nRemoving original magenta numbers from PDF...")
    for page_num in range(len(doc)):
        page = doc[page_num]
        remove_magenta_from_page(page)
        print(f"  Cleaned page {page_num + 1}")

    # Save cleaned PDF to bytes
    pdf_bytes = doc.tobytes()
    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')

    settings = {
        "markerSize": 40,
        "zoom": 1.0,
        "deletedPages": []
    }

    doc.close()

    return pdf_base64, all_annotations, settings

def main():
    if len(sys.argv) < 2:
        print("Usage: python extract_with_ocr.py <annotated.pdf> [clean.pdf] [output.pdfannotations]")
        print("  annotated.pdf: PDF with magenta annotations to detect")
        print("  clean.pdf: (optional) Clean PDF to use instead of removing annotations")
        print("  output.pdfannotations: (optional) Output file name")
        sys.exit(1)

    annotated_pdf = sys.argv[1]

    # Check if second arg is a PDF (clean version) or output file
    clean_pdf = None
    output_file = None

    if len(sys.argv) >= 3:
        if sys.argv[2].endswith('.pdf'):
            clean_pdf = sys.argv[2]
            output_file = sys.argv[3] if len(sys.argv) > 3 else annotated_pdf.replace('.pdf', '.pdfannotations')
        else:
            output_file = sys.argv[2]
    else:
        output_file = annotated_pdf.replace('.pdf', '.pdfannotations')

    print(f"Extracting annotations from: {annotated_pdf}")
    if clean_pdf:
        print(f"Using clean PDF: {clean_pdf}")
    print("This may take a while...\n")

    pdf_base64, annotations, settings = extract_with_ocr(annotated_pdf)

    # If clean PDF provided, use that instead
    if clean_pdf:
        print(f"\nUsing clean PDF instead of removing annotations...")
        with open(clean_pdf, 'rb') as f:
            clean_bytes = f.read()
            pdf_base64 = base64.b64encode(clean_bytes).decode('utf-8')

    print(f"\n{'='*60}")
    print(f"Total: {len(annotations)} annotations found")
    print(f"{'='*60}")

    # Create output format
    output_data = {
        "version": 1,
        "pdf": pdf_base64,
        "annotations": annotations,
        "settings": settings
    }

    # Write to JSON
    with open(output_file, 'w') as f:
        json.dump(output_data, f, indent=2)

    print(f"\nSaved to: {output_file}")
    print("You can now load this file in the PDF annotation tool!")

if __name__ == "__main__":
    main()
