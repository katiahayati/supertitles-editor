import { arrayBufferToBase64 } from '../shared/base64.js';
import { showError } from '../shared/flash.js';
import { promptDialog, alertDialog } from '../shared/dialogs.js';
import { createUnsavedTracker } from '../shared/unsaved.js';
import { normalizeSet, slideMarkCheck } from '../shared/schema.js';
import { MSG, post, onMessage, loadFrame } from '../shared/messaging.js';

const PRESENTATION_SRC = 'presentation-editor.html';
const ANNOTATION_SRC = 'pdf-annotator.html';
const VIEWER_SRC = 'presentation-viewer.html';

const DEFAULT_ANNOTATION = () => ({
  version: 1,
  pdf: null,
  annotations: [],
  settings: { markerSize: 40, viewMode: 'paginated', zoom: 1.0, deletedPages: [] },
});

const state = {
  setName: null,
  setFileName: null,
  presentationData: null,
  annotationData: null,
  presentationName: null,
  annotationName: null,
  isAnnotateMode: false,
  currentSlide: 0,
  currentPage: 1,
};

const unsaved = createUnsavedTracker();

const newSetBtn = document.getElementById('new-set');
const saveSetBtn = document.getElementById('save-set');
const exportComponentsBtn = document.getElementById('export-components');
const setInput = document.getElementById('set-input');
const changePresentationBtn = document.getElementById('change-presentation');
const changeAnnotationBtn = document.getElementById('change-annotation');
const presentationInput = document.getElementById('presentation-input');
const annotationInput = document.getElementById('annotation-input');
const fileNameDisplay = document.getElementById('file-name');
const presentationNameDisplay = document.getElementById('presentation-name');
const annotationNameDisplay = document.getElementById('annotation-name');
const slideMarkStatus = document.getElementById('slide-mark-status');
const tabButtons = document.querySelectorAll('.tab');
const presentationFrame = document.getElementById('presentation-frame');
const annotationFrame = document.getElementById('annotation-frame');
const toggleModeBtn = document.getElementById('toggle-mode');
const annotatePresentationFrame = document.getElementById('annotate-presentation-frame');
const annotateAnnotationFrame = document.getElementById('annotate-annotation-frame');
const fileInfo = document.getElementById('file-info');
const tabs = document.getElementById('tabs');
const emptyState = document.getElementById('empty-state');

function init() {
  setupEventListeners();
  setupAnnotateFrames();
  updateUI();
}

function setupEventListeners() {
  newSetBtn.addEventListener('click', createNewSet);
  setInput.addEventListener('change', handleSetUpload);
  saveSetBtn.addEventListener('click', saveSet);
  if (exportComponentsBtn) exportComponentsBtn.addEventListener('click', exportComponents);

  changePresentationBtn.addEventListener('click', () => presentationInput.click());
  presentationInput.addEventListener('change', handlePresentationChange);
  changeAnnotationBtn.addEventListener('click', () => annotationInput.click());
  annotationInput.addEventListener('change', handleAnnotationChange);

  tabButtons.forEach((btn) => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  toggleModeBtn.addEventListener('click', toggleMode);

  onMessage(handleIframeMessage);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!saveSetBtn.disabled) saveSet();
    }
  });
}

// The annotate-mode frames are loaded once; they receive data when the user
// switches into annotate mode.
function setupAnnotateFrames() {
  annotatePresentationFrame.src = VIEWER_SRC;
  annotateAnnotationFrame.src = ANNOTATION_SRC;
}

function handleIframeMessage(data) {
  if (data.type === MSG.PRESENTATION_CHANGED) {
    state.presentationData = data.data;
    if (data.presentationTitle) state.presentationName = data.presentationTitle;
    else if (!state.presentationName && state.presentationData?.presentation?.title) {
      state.presentationName = state.presentationData.presentation.title;
    }
    unsaved.mark();
    updateUI();
  } else if (data.type === MSG.ANNOTATION_CHANGED) {
    state.annotationData = data.data;
    if (data.fileName) state.annotationName = data.fileName;
    else if (state.annotationData?.pdf && (!state.annotationName || state.annotationName === 'No PDF loaded')) {
      state.annotationName = 'PDF loaded';
    }
    unsaved.mark();
    updateUI();
  } else if (data.type === MSG.SLIDE_CHANGED) {
    state.currentSlide = data.slideIndex;
  } else if (data.type === MSG.PAGE_CHANGED) {
    state.currentPage = data.pageNumber;
  }
}

function exitAnnotateMode() {
  if (document.body.classList.contains('annotate-mode')) {
    document.body.classList.remove('annotate-mode');
    state.isAnnotateMode = false;
    toggleModeBtn.textContent = 'Annotate Mode';
  }
}

// Reload both editor frames and push the current data, waiting on the ready
// handshake (no fixed timeouts).
async function loadEditors() {
  await Promise.all([
    loadFrame(presentationFrame, PRESENTATION_SRC, MSG.PRESENTATION_READY, {
      type: MSG.LOAD_DATA,
      data: state.presentationData,
      metadata: { fileName: state.presentationName },
    }),
    loadFrame(annotationFrame, ANNOTATION_SRC, MSG.ANNOTATION_READY, {
      type: MSG.LOAD_DATA,
      data: state.annotationData,
      metadata: { fileName: state.annotationName },
    }),
  ]);
}

async function createNewSet() {
  const name = await promptDialog('Enter supertitle set name:', { title: 'New set' });
  if (!name) return;

  exitAnnotateMode();
  state.setName = name;
  state.setFileName = null;
  state.presentationName = 'New presentation';
  state.annotationName = 'No PDF loaded';
  state.presentationData = { version: 1, presentation: { title: name }, slides: [] };
  state.annotationData = DEFAULT_ANNOTATION();
  state.currentPage = 1;
  state.currentSlide = 0;

  enableEditing();
  updateUI();
  await loadEditors();
  unsaved.clear();
}

async function handleSetUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const setData = JSON.parse(await file.text());
    const fallbackName = file.name.replace('.supertitles', '');
    const normalized = normalizeSet(setData, fallbackName);

    exitAnnotateMode();
    state.setName = normalized.name;
    state.setFileName = fallbackName;
    state.presentationData = normalized.presentation;
    state.annotationData = normalized.annotation;
    state.presentationName = normalized.presentationName;
    state.annotationName = normalized.annotationName;
    state.currentPage = 1;
    state.currentSlide = 0;

    enableEditing();
    updateUI();
    await loadEditors();
    unsaved.clear();
  } catch (error) {
    console.error('Error loading set:', error);
    showError('Error loading supertitles set: ' + error.message);
  }
  setInput.value = '';
}

async function saveSet() {
  if (!state.setName) {
    await alertDialog('No set to save');
    return;
  }

  let filename = state.setFileName;
  if (!filename) {
    filename = await promptDialog('Enter filename (without extension):', {
      title: 'Save set',
      defaultValue: state.setName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
    });
    if (!filename) return;
    state.setFileName = filename;
  }

  const setData = {
    version: 2,
    name: state.setName,
    presentation: state.presentationData,
    annotation: state.annotationData,
    metadata: { presentationName: state.presentationName, annotationName: state.annotationName },
  };
  download(JSON.stringify(setData, null, 2), filename + '.supertitles');

  unsaved.clear();
  updateUI();
}

// Optional: export the standalone presentation + annotation files for editing in
// the individual tools. Kept separate so a normal save is a single download.
async function exportComponents() {
  if (!state.setName) {
    await alertDialog('No set to export');
    return;
  }
  const base =
    state.setFileName || state.setName.replace(/[^a-z0-9]/gi, '_').toLowerCase();

  download(JSON.stringify(state.presentationData, null, 2), base + '_presentation.json');
  download(JSON.stringify(state.annotationData, null, 2), base + '_annotation.pdfannotations');
}

async function handlePresentationChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const projectData = JSON.parse(await file.text());
    if (!projectData.version || !projectData.slides) throw new Error('Invalid presentation file format');

    state.presentationData = projectData;
    state.presentationName = projectData.presentation?.title || file.name.replace('.json', '');
    unsaved.mark();

    post(presentationFrame.contentWindow, {
      type: MSG.LOAD_DATA,
      data: state.presentationData,
      metadata: { fileName: state.presentationName },
    });
    updateUI();
  } catch (error) {
    console.error('Error loading presentation:', error);
    showError('Error loading presentation: ' + error.message);
  }
  presentationInput.value = '';
}

async function handleAnnotationChange(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    if (file.name.endsWith('.pdfannotations') || file.name.endsWith('.json')) {
      const projectData = JSON.parse(await file.text());
      if (!projectData.version) throw new Error('Invalid annotation project file format');
      state.annotationData = projectData;
      state.annotationName = file.name.replace('.pdfannotations', '').replace('.json', '');
    } else if (file.name.endsWith('.pdf')) {
      const base64 = arrayBufferToBase64(await file.arrayBuffer());
      state.annotationName = file.name;
      if (!state.annotationData) {
        state.annotationData = { ...DEFAULT_ANNOTATION(), pdf: base64 };
      } else {
        state.annotationData.pdf = base64;
        state.annotationData.annotations = [];
        state.annotationData.settings.deletedPages = [];
      }
    } else {
      throw new Error('Please select a PDF file or annotation project JSON file');
    }

    unsaved.mark();
    post(annotationFrame.contentWindow, {
      type: MSG.LOAD_DATA,
      data: state.annotationData,
      metadata: { fileName: state.annotationName },
    });
    updateUI();
  } catch (error) {
    console.error('Error loading annotation:', error);
    showError('Error loading annotation: ' + error.message);
  }
  annotationInput.value = '';
}

function switchTab(tabName) {
  tabButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach((content) => content.classList.remove('active'));
  document.getElementById(`${tabName}-tab`).classList.add('active');
}

function toggleMode() {
  state.isAnnotateMode = !state.isAnnotateMode;

  if (state.isAnnotateMode) {
    document.body.classList.add('annotate-mode');
    toggleModeBtn.textContent = 'Edit Mode';

    if (state.presentationData) {
      post(annotatePresentationFrame.contentWindow, {
        type: MSG.LOAD_DATA,
        data: state.presentationData,
        slideIndex: state.currentSlide,
      });
    }
    if (state.annotationData) {
      post(annotateAnnotationFrame.contentWindow, {
        type: MSG.LOAD_DATA,
        data: state.annotationData,
        pageNumber: state.currentPage,
        hideControls: true,
        metadata: { fileName: state.annotationName },
      });
    }
  } else {
    document.body.classList.remove('annotate-mode');
    toggleModeBtn.textContent = 'Annotate Mode';
    post(presentationFrame.contentWindow, { type: MSG.GOTO_SLIDE, slideIndex: state.currentSlide });
    post(annotationFrame.contentWindow, { type: MSG.GOTO_PAGE, pageNumber: state.currentPage });
  }
}

function enableEditing() {
  saveSetBtn.disabled = false;
  if (exportComponentsBtn) exportComponentsBtn.disabled = false;
  changePresentationBtn.disabled = false;
  changeAnnotationBtn.disabled = false;
  toggleModeBtn.disabled = false;
}

function updateUI() {
  if (fileNameDisplay) {
    fileNameDisplay.textContent = state.setName ? `Set: ${state.setName}` : 'No set loaded';
  }
  presentationNameDisplay.textContent = state.presentationName || 'None';
  annotationNameDisplay.textContent = state.annotationName || 'None';

  const { slides, marks, match } = slideMarkCheck(state.presentationData, state.annotationData);
  slideMarkStatus.textContent = match ? `${slides} / ${marks} ✓` : `${slides} / ${marks} — mismatch`;
  slideMarkStatus.classList.toggle('count-ok', match);
  slideMarkStatus.classList.toggle('count-mismatch', !match);
  slideMarkStatus.title = 'Each slide should have one matching annotation mark on the score';

  const hasSet = state.setName !== null;
  emptyState.style.display = hasSet ? 'none' : 'flex';
  fileInfo.style.display = hasSet ? 'flex' : 'none';
  tabs.style.display = hasSet ? 'flex' : 'none';
  document.querySelectorAll('.tab-content').forEach((el) => {
    el.style.display = hasSet ? '' : 'none';
  });
}

function download(content, fileName) {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

init();
