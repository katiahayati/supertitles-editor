import { arrayBufferToBase64, base64ToArrayBuffer } from '../shared/base64.js';
import { showError } from '../shared/flash.js';
import { alertDialog, confirmDialog, promptDialog } from '../shared/dialogs.js';
import { withLoading } from '../shared/loading.js';
import { createUnsavedTracker } from '../shared/unsaved.js';
import { MSG, postToParent, onMessage } from '../shared/messaging.js';
import { activePages as computeActivePages } from '../shared/schema.js';

// pdf.js is loaded as a global UMD script in the HTML.
const pdfjsLib = window.pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const MARKER_MIN = 20;
const MARKER_MAX = 100;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;

const state = {
  pdfDoc: null,
  pdfData: null,
  originalPdfFile: null,
  fileName: '',
  currentPage: 1,
  totalPages: 0,
  scale: 1.5,
  annotations: [],
  annotationCounter: 1,
  annotationPrefix: 'SLIDE',
  dragging: null,
  wasDragging: false,
  markerSize: 40,
  deletedPages: [],
  settings: {},
};

const unsaved = createUnsavedTracker();

const canvas = document.getElementById('pdf-canvas');
const ctx = canvas.getContext('2d');
const annotationsLayer = document.getElementById('annotations-layer');
const pdfUpload = document.getElementById('pdf-upload');
const annotationsUpload = document.getElementById('annotations-upload');
const saveAnnotationsBtn = document.getElementById('save-annotations');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const zoomInMenuBtn = document.getElementById('zoom-in-menu');
const zoomOutMenuBtn = document.getElementById('zoom-out-menu');
const zoomLevel = document.getElementById('zoom-level');
const dropZone = document.getElementById('drop-zone');
const canvasWrapper = document.getElementById('canvas-wrapper');
const markerSizeIncrease = document.getElementById('marker-size-increase');
const markerSizeDecrease = document.getElementById('marker-size-decrease');
const markerSizeDisplay = document.getElementById('marker-size-display');
const deletePageBtn = document.getElementById('delete-page');
const fileNameDisplay = document.getElementById('file-name');

function init() {
  setupEventListeners();
}

function setupEventListeners() {
  pdfUpload.addEventListener('change', handlePdfUpload);
  annotationsUpload.addEventListener('change', handleAnnotationsUpload);
  saveAnnotationsBtn.addEventListener('click', saveAnnotations);
  prevPageBtn.addEventListener('click', () => changePage(-1));
  nextPageBtn.addEventListener('click', () => changePage(1));
  zoomInBtn.addEventListener('click', () => zoom(0.1));
  zoomOutBtn.addEventListener('click', () => zoom(-0.1));
  if (zoomInMenuBtn) zoomInMenuBtn.addEventListener('click', () => zoom(0.1));
  if (zoomOutMenuBtn) zoomOutMenuBtn.addEventListener('click', () => zoom(-0.1));
  canvasWrapper.addEventListener('click', handleCanvasClick);
  markerSizeIncrease.addEventListener('click', () => adjustMarkerSize(5));
  markerSizeDecrease.addEventListener('click', () => adjustMarkerSize(-5));
  deletePageBtn.addEventListener('click', deleteCurrentPage);

  document.addEventListener('keydown', handleKeyPress);

  document.body.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  document.body.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type === 'application/pdf') {
      loadPdf(files[0]);
    }
  });

  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  onMessage(handleParentMessage);
}

async function handlePdfUpload(e) {
  const file = e.target.files[0];
  if (file) await loadPdf(file, true);
}

async function loadPdf(file, clearState = true) {
  try {
    state.originalPdfFile = file;
    state.fileName = file.name;

    const { base64Pdf, pdfBytes } = await withLoading('Loading PDF…', async () => {
      const arrayBuffer = await file.arrayBuffer();
      // Encode to base64 before the ArrayBuffer can be detached by pdf.js.
      const base64 = arrayBufferToBase64(arrayBuffer);
      return { base64Pdf: base64, pdfBytes: new Uint8Array(arrayBuffer) };
    });
    state.pdfData = base64Pdf;

    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;

    if (clearState) {
      state.annotations = [];
      state.deletedPages = [];
      state.currentPage = 1;
    } else {
      const pages = getActivePages();
      state.currentPage = pages.length > 0 ? pages[0] : 1;
    }

    updateAnnotationCounter();
    updateFileNameDisplay();
    if (clearState) unsaved.clear();

    dropZone.classList.add('hidden');
    await renderPage(state.currentPage);
    updatePageControls();

    saveAnnotationsBtn.disabled = false;
    deletePageBtn.disabled = false;

    notifyParent();
  } catch (error) {
    console.error('Error loading PDF:', error);
    showError('Error loading PDF. Please try another file.');
  }
}

async function renderPage(pageNum) {
  try {
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: state.scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;
    annotationsLayer.style.width = viewport.width + 'px';
    annotationsLayer.style.height = viewport.height + 'px';

    await page.render({ canvasContext: ctx, viewport }).promise;
    renderAnnotations();
  } catch (error) {
    console.error('Error rendering page:', error);
  }
}

let isNavigating = false;
let pendingNavigation = null;

async function handleKeyPress(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    e.preventDefault();
    if (!saveAnnotationsBtn.disabled) saveAnnotations();
    return;
  }

  if (e.key === '=' || e.key === '+') {
    e.preventDefault();
    zoom(0.1);
    return;
  }
  if (e.key === '-' || e.key === '_') {
    e.preventDefault();
    zoom(-0.1);
    return;
  }

  let delta = 0;
  switch (e.key) {
    case 'ArrowLeft':
    case 'ArrowUp':
      e.preventDefault();
      delta = -1;
      break;
    case 'ArrowRight':
    case 'ArrowDown':
      e.preventDefault();
      delta = 1;
      break;
    default:
      return;
  }

  if (isNavigating) {
    pendingNavigation = delta;
    return;
  }

  isNavigating = true;
  await changePage(delta);
  isNavigating = false;

  if (pendingNavigation !== null) {
    const pending = pendingNavigation;
    pendingNavigation = null;
    isNavigating = true;
    await changePage(pending);
    isNavigating = false;
  }
}

async function changePage(delta) {
  const pages = getActivePages();
  const currentIndex = pages.indexOf(state.currentPage);
  const newIndex = currentIndex + delta;

  if (newIndex >= 0 && newIndex < pages.length) {
    state.currentPage = pages[newIndex];
    await renderPage(state.currentPage);
    updatePageControls();
    notifyPageChange();
  }
}

function notifyPageChange() {
  postToParent({ type: MSG.PAGE_CHANGED, pageNumber: state.currentPage });
}

function updatePageControls() {
  const pages = getActivePages();
  const displayPage = pages.indexOf(state.currentPage) + 1;
  pageInfo.textContent = state.pdfDoc ? `Page ${displayPage} of ${pages.length}` : 'No document';
  // Disabled state tracks position within the active-page list, so deleting the
  // first or last page never strands navigation.
  prevPageBtn.disabled = displayPage <= 1;
  nextPageBtn.disabled = displayPage >= pages.length;
  deletePageBtn.disabled = pages.length <= 1;
}

function updateFileNameDisplay() {
  if (fileNameDisplay) fileNameDisplay.textContent = state.fileName || 'No project loaded';
}

function getActivePages() {
  return computeActivePages(state.totalPages, state.deletedPages);
}

function getActivePage(pageNum) {
  return getActivePages().indexOf(pageNum) + 1;
}

async function deleteCurrentPage() {
  const pages = getActivePages();
  if (pages.length <= 1) {
    await alertDialog('Cannot delete the last page.');
    return;
  }

  const ok = await confirmDialog(
    `Delete page ${getActivePage(state.currentPage)}? This will also remove all annotations on this page.`,
    { title: 'Delete page', confirmText: 'Delete' }
  );
  if (!ok) return;

  state.deletedPages.push(state.currentPage);
  state.deletedPages.sort((a, b) => a - b);
  state.annotations = state.annotations.filter((a) => a.page !== state.currentPage);
  unsaved.mark();

  const currentIndex = pages.indexOf(state.currentPage);
  const remaining = getActivePages();
  if (remaining.length > 0) {
    state.currentPage =
      currentIndex < remaining.length ? remaining[currentIndex] : remaining[currentIndex - 1];
  }

  await renderPage(state.currentPage);
  updatePageControls();
  notifyParent();
}

function zoom(delta) {
  state.scale = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.scale + delta));
  zoomLevel.textContent = Math.round(state.scale * 100) + '%';
  renderPage(state.currentPage);
}

function adjustMarkerSize(delta) {
  state.markerSize = Math.max(MARKER_MIN, Math.min(MARKER_MAX, state.markerSize + delta));
  markerSizeDisplay.textContent = state.markerSize + 'px';
  renderAnnotations();
}

function handleCanvasClick(e) {
  if (!state.pdfDoc) return;

  if (state.wasDragging) {
    state.wasDragging = false;
    return;
  }

  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;

  const annotationId = `${state.annotationPrefix}-${String(state.annotationCounter).padStart(3, '0')}`;
  state.annotations.push({ id: annotationId, page: state.currentPage, x, y });
  state.annotationCounter++;
  unsaved.mark();
  notifyParent();
  renderAnnotations();
}

function handleMouseMove(e) {
  if (!state.dragging || !annotationsLayer) return;
  state.wasDragging = true;

  const marker = annotationsLayer.querySelector(`[data-annotation-id="${state.dragging.id}"]`);
  if (!marker) return;

  const rect = canvas.getBoundingClientRect();
  const clampedX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
  const clampedY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
  const x = clampedX / rect.width;
  const y = clampedY / rect.height;

  state.dragging.x = x;
  state.dragging.y = y;
  marker.style.left = x * rect.width + 'px';
  marker.style.top = y * rect.height + 'px';
}

function handleMouseUp() {
  if (!state.dragging) return;

  const moved = state.wasDragging;
  const marker = annotationsLayer.querySelector(`[data-annotation-id="${state.dragging.id}"]`);
  if (marker) marker.classList.remove('dragging');

  state.dragging = null;
  canvasWrapper.style.cursor = 'crosshair';

  // Persist only if the marker actually moved (a plain click leaves it in place).
  if (moved) {
    unsaved.mark();
    notifyParent();
  }

  // Reset after the click event has a chance to fire, so a drag doesn't add a marker.
  setTimeout(() => {
    state.wasDragging = false;
  }, 50);
}

function renderAnnotations() {
  annotationsLayer.innerHTML = '';
  state.annotations
    .filter((a) => a.page === state.currentPage)
    .forEach((annotation) => annotationsLayer.appendChild(createAnnotationMarker(annotation)));
}

function createAnnotationMarker(annotation) {
  const marker = document.createElement('div');
  marker.className = 'annotation-marker';
  marker.style.width = state.markerSize + 'px';
  marker.style.height = state.markerSize + 'px';
  marker.style.left = annotation.x * canvas.width + 'px';
  marker.style.top = annotation.y * canvas.height + 'px';
  marker.dataset.annotationId = annotation.id;
  marker.dataset.pageNum = annotation.page;
  marker.title = 'Drag to move · right-click to delete';

  marker.innerHTML = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 0 L50 100 M0 50 L100 50 M15 15 L85 85 M85 15 L15 85"
                  stroke="#dc3545" stroke-width="12" stroke-linecap="round"/>
            <circle cx="50" cy="50" r="8" fill="#dc3545"/>
        </svg>
    `;

  marker.addEventListener('mousedown', (e) => {
    e.stopPropagation();
    e.preventDefault();
    state.dragging = annotation;
    marker.classList.add('dragging');
    canvasWrapper.style.cursor = 'grabbing';
  });

  marker.addEventListener('contextmenu', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    const ok = await confirmDialog(`Delete annotation "${annotation.id}"?`, {
      title: 'Delete annotation',
      confirmText: 'Delete',
    });
    if (ok) deleteAnnotation(annotation.id);
  });

  return marker;
}

function deleteAnnotation(id) {
  state.annotations = state.annotations.filter((a) => a.id !== id);
  unsaved.mark();
  renderAnnotations();
  notifyParent();
}

function updateAnnotationCounter() {
  if (state.annotations.length === 0) {
    state.annotationCounter = 1;
    return;
  }
  const numbers = state.annotations
    .filter((a) => a.id.startsWith(state.annotationPrefix + '-'))
    .map((a) => {
      const match = a.id.match(/-(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    });
  state.annotationCounter = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
}

async function saveAnnotations() {
  if (!state.originalPdfFile) {
    await alertDialog('Please load a PDF first');
    return;
  }

  const defaultName = state.fileName.replace(/\.pdf$/i, '') + '-project';
  const fileName = await promptDialog('Enter project file name:', {
    title: 'Save project',
    defaultValue: defaultName,
  });
  if (!fileName) return;

  try {
    const projectFile = {
      version: 1,
      pdf: state.pdfData,
      annotations: state.annotations,
      annotationPrefix: state.annotationPrefix,
      settings: {
        markerSize: state.markerSize,
        zoom: state.scale,
        deletedPages: state.deletedPages,
      },
      metadata: {
        totalPages: state.totalPages,
        pdfFileName: state.fileName,
        createdAt: new Date().toISOString(),
        modifiedAt: new Date().toISOString(),
      },
    };

    downloadJson(projectFile, fileName.endsWith('.pdfannotations') ? fileName : fileName + '.pdfannotations');
    unsaved.clear();
  } catch (error) {
    console.error('Error saving project:', error);
    showError('Error saving project. Please try again.');
  }
}

function downloadJson(obj, fileName) {
  const blob = new Blob([JSON.stringify(obj)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleAnnotationsUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const pdfData = data.pdf || data.pdfData;

    if (pdfData && Array.isArray(data.annotations)) {
      const deletedPages = data.settings?.deletedPages || data.deletedPages;
      if (Array.isArray(deletedPages)) state.deletedPages = deletedPages;

      const fileName = data.metadata?.fileName || data.metadata?.pdfFileName || file.name;
      await withLoading('Loading project…', async () => {
        const pdfBlob = new Blob([base64ToArrayBuffer(pdfData)], { type: 'application/pdf' });
        const pdfFile = new File([pdfBlob], fileName, { type: 'application/pdf' });
        await loadPdf(pdfFile, false);
      });

      dropZone.classList.add('hidden');
      state.annotations = data.annotations;
      if (data.annotationPrefix) state.annotationPrefix = data.annotationPrefix;

      const markerSize = data.settings?.markerSize || data.markerSize;
      if (markerSize) {
        state.markerSize = markerSize;
        markerSizeDisplay.textContent = state.markerSize + 'px';
      }
      const zoomVal = data.settings?.zoom || data.scale;
      if (zoomVal) {
        state.scale = zoomVal;
        zoomLevel.textContent = Math.round(state.scale * 100) + '%';
      }

      await renderPage(state.currentPage);
      renderAnnotations();
      updateAnnotationCounter();
      notifyParent();
    } else if (Array.isArray(data.annotations)) {
      if (!state.pdfDoc) {
        await alertDialog('Please load a PDF first, or use a project file that includes the PDF.');
        return;
      }
      state.annotations = data.annotations;
      if (data.annotationPrefix) state.annotationPrefix = data.annotationPrefix;
      if (data.markerSize) {
        state.markerSize = data.markerSize;
        markerSizeDisplay.textContent = state.markerSize + 'px';
      }
      if (data.scale) {
        state.scale = data.scale;
        zoomLevel.textContent = Math.round(state.scale * 100) + '%';
      }
      if (Array.isArray(data.deletedPages)) state.deletedPages = data.deletedPages;

      await renderPage(state.currentPage);
      renderAnnotations();
      updateAnnotationCounter();
    } else {
      throw new Error('Invalid project file format');
    }
  } catch (error) {
    console.error('Error loading project:', error);
    showError('Error loading project file. Please check the file format.');
  }
}

function notifyParent() {
  postToParent({
    type: MSG.ANNOTATION_CHANGED,
    data: {
      version: 1,
      pdf: state.pdfData,
      annotations: state.annotations,
      settings: {
        markerSize: state.markerSize,
        zoom: state.scale,
        deletedPages: state.deletedPages,
      },
    },
    fileName: state.originalPdfFile?.name || null,
  });
}

async function handleParentMessage(data) {
  if (data.type === MSG.LOAD_DATA) {
    if (data.hideControls) applyAnnotateModeLayout();

    if (data.data.settings) {
      state.settings = { ...state.settings, ...data.data.settings };
      applySettings();
    }

    if (data.data.pdf) {
      state.pdfData = data.data.pdf;
      await loadPdfFromBytes(base64ToArrayBuffer(data.data.pdf), data.pageNumber);
      if (data.metadata?.fileName) {
        state.originalPdfFile = { name: data.metadata.fileName };
        state.fileName = data.metadata.fileName;
        updateFileNameDisplay();
      }
    }

    if (data.data.annotations) {
      state.annotations = data.data.annotations;
      renderAnnotations();
    }
  } else if (data.type === MSG.GOTO_PAGE) {
    if (data.pageNumber >= 1 && data.pageNumber <= state.totalPages) {
      state.currentPage = data.pageNumber;
      await renderPage(state.currentPage);
      updatePageControls();
    }
  }
}

// Annotate mode (embedded read-only view): let the body scroll naturally so the
// parent iframe shows a single scrollbar.
function applyAnnotateModeLayout() {
  const set = (sel, styles) => {
    const el = sel.startsWith('#') ? document.getElementById(sel.slice(1)) : document.querySelector(sel);
    if (el) Object.assign(el.style, styles);
  };
  set('.controls', { display: 'none' });
  set('header', { display: 'none' });
  set('.container', { height: 'auto', minHeight: '100%', overflow: 'visible' });
  set('.pdf-container', { overflow: 'visible', minHeight: '0' });
  set('.pdf-container > div:last-child', { overflow: 'visible', height: 'auto', flex: 'none' });
  document.body.style.overflow = 'auto';
  document.body.style.height = 'auto';
  document.documentElement.style.overflow = 'auto';
}

async function loadPdfFromBytes(arrayBuffer, pageNumber) {
  state.pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  state.totalPages = state.pdfDoc.numPages;

  let targetPage = pageNumber !== undefined ? pageNumber : 1;
  if (state.deletedPages.includes(targetPage)) {
    const pages = getActivePages();
    targetPage = pages.length > 0 ? pages[0] : 1;
  }
  state.currentPage = targetPage;

  dropZone.classList.add('hidden');
  await renderPage(state.currentPage);
  updatePageControls();
  renderAnnotations();
}

function applySettings() {
  if (state.settings.zoom) {
    state.scale = state.settings.zoom;
    zoomLevel.textContent = Math.round(state.scale * 100) + '%';
  }
  if (state.settings.markerSize) {
    state.markerSize = state.settings.markerSize;
    markerSizeDisplay.textContent = state.markerSize + 'px';
  }
  if (state.settings.deletedPages) state.deletedPages = state.settings.deletedPages;
}

init();
postToParent({ type: MSG.ANNOTATION_READY });
