// Data-model helpers shared across the apps: normalizing a .supertitles set file,
// ordering annotations for export, and sequential annotation numbering.
//
// These are pure functions (no DOM) so they can be unit-tested directly.

// Normalize a parsed .supertitles set (v1 and v2 share the same structure).
export function normalizeSet(setData, fallbackName = 'Untitled') {
  if (!setData || !setData.version) {
    throw new Error('Invalid supertitles set file format (missing version)');
  }
  if (![1, 2].includes(setData.version)) {
    throw new Error(`Unsupported supertitles set version: ${setData.version}`);
  }
  if (!setData.presentation || !setData.annotation) {
    throw new Error('Invalid supertitles set file format (missing presentation or annotation)');
  }

  return {
    version: setData.version,
    name: setData.name || fallbackName,
    presentation: setData.presentation,
    annotation: setData.annotation,
    presentationName:
      setData.metadata?.presentationName ||
      setData.presentation?.presentation?.title ||
      'Untitled presentation',
    annotationName:
      setData.metadata?.annotationName ||
      (setData.annotation?.pdf ? 'PDF loaded' : 'No PDF'),
  };
}

// Each slide should correspond to one annotation mark on the score, so the two
// counts should match. Returns the counts and whether they line up.
export function slideMarkCheck(presentationData, annotationData) {
  const slides = presentationData?.slides?.length ?? 0;
  const marks = annotationData?.annotations?.length ?? 0;
  return { slides, marks, match: slides === marks };
}

// List of 1-based page numbers that are not deleted.
export function activePages(totalPages, deletedPages = []) {
  const deleted = new Set(deletedPages);
  const pages = [];
  for (let i = 1; i <= totalPages; i++) {
    if (!deleted.has(i)) pages.push(i);
  }
  return pages;
}

// Reading order for annotations: page, then top-to-bottom (y), then left-to-right (x).
// Annotations within ~2% vertical distance are treated as the same row.
export function sortAnnotations(annotations) {
  return [...annotations].sort((a, b) => {
    if (a.page !== b.page) return a.page - b.page;
    if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
    return a.x - b.x;
  });
}

// Assign sequential numbers to a set's annotations in reading order, skipping
// deleted pages, starting at `startNumber`. Returns { numbered, nextNumber }
// where numbered is [{ ...annotation, number }]. This is the v1.2.1 numbering
// contract relied on by the combined-PDF export.
export function numberAnnotations(annotations, deletedPages = [], startNumber = 1) {
  const deleted = new Set(deletedPages);
  const sorted = sortAnnotations(annotations).filter((a) => !deleted.has(a.page));
  let n = startNumber;
  const numbered = sorted.map((a) => ({ ...a, number: n++ }));
  return { numbered, nextNumber: n };
}
