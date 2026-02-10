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

        print(f"  Found magenta region at ({x_center:.3f}, {y_center:.3f})")

    return positions

def extract_with_ocr(pdf_path):
    """Extract annotations using color detection."""
    doc = pymupdf.open(pdf_path)

    all_positions = []

    print(f"Processing {len(doc)} pages...")

    for page_num in range(len(doc)):
        print(f"\nPage {page_num + 1}:")
        page = doc[page_num]

        positions = find_magenta_numbers(page, page_num)
        all_positions.extend(positions)

    # Sort by page, then by y position (top to bottom), then by x position (left to right)
    all_positions.sort(key=lambda a: (a['page'], a['y'], a['x']))

    # Now assign sequential IDs
    all_annotations = []
    for i, pos in enumerate(all_positions):
        annotation = {
            "id": f"SLIDE-{i+1:03d}",
            "page": pos['page'],
            "x": pos['x'],
            "y": pos['y']
        }
        all_annotations.append(annotation)

    # Read PDF as base64
    with open(pdf_path, 'rb') as f:
        pdf_bytes = f.read()
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
        print("Usage: python extract_with_ocr.py <input.pdf> [output.pdfannotations]")
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_file = sys.argv[2] if len(sys.argv) > 2 else input_pdf.replace('.pdf', '.pdfannotations')

    print(f"Extracting annotations from: {input_pdf}")
    print("This may take a while...\n")

    pdf_base64, annotations, settings = extract_with_ocr(input_pdf)

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
