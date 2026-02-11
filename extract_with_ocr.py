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
    """Remove magenta/purple colored regions from the page."""
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

    # Invert mask to get everything except magenta
    mask_inv = cv2.bitwise_not(mask)

    # Apply mask to make magenta regions white
    img_array[mask > 0] = [255, 255, 255]

    # Convert back to PIL image
    cleaned_img = Image.fromarray(img_array)

    # Convert to bytes
    img_bytes = io.BytesIO()
    cleaned_img.save(img_bytes, format='PNG')
    img_bytes.seek(0)

    # Get page rectangle
    rect = page.rect

    # Insert the cleaned image
    page.insert_image(rect, stream=img_bytes.getvalue())

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
