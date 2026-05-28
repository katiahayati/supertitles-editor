import { base64ToArrayBuffer } from '../shared/base64.js';
import { escapeHtml } from '../shared/escape.js';
import { showFlash, showError } from '../shared/flash.js';
import { withLoading } from '../shared/loading.js';
import { alertDialog, confirmDialog, promptDialog } from '../shared/dialogs.js';
import { createUnsavedTracker } from '../shared/unsaved.js';
import { normalizeSet, numberAnnotations } from '../shared/schema.js';
import { generateRevealHtml } from '../shared/reveal.js';

// pdf-lib is loaded as a global UMD script in the HTML.
const PDFLib = window.PDFLib;

const state = {
  recitalName: null,
  recitalFileName: null,
  items: [], // { type: 'supertitles'|'title-slide', name, data }
};

const unsaved = createUnsavedTracker();

const newRecitalBtn = document.getElementById('new-recital');
const saveRecitalBtn = document.getElementById('save-recital');
const recitalInput = document.getElementById('recital-input');
const addSupertitlesBtn = document.getElementById('add-supertitles');
const supertitlesInput = document.getElementById('supertitles-input');
const addTitleSlideBtn = document.getElementById('add-title-slide');
const exportPresentationBtn = document.getElementById('export-presentation');
const exportPdfBtn = document.getElementById('export-pdf');
const fileNameDisplay = document.getElementById('file-name');
const recitalList = document.getElementById('recital-list');
const titleSlideEditor = document.getElementById('title-slide-editor');
const titleSlideTitleInput = document.getElementById('title-slide-title');
const titleSlideSubtitleInput = document.getElementById('title-slide-subtitle');
const confirmTitleSlideBtn = document.getElementById('confirm-title-slide');
const cancelTitleSlideBtn = document.getElementById('cancel-title-slide');
const emptyState = document.getElementById('empty-state');
const mainContent = document.getElementById('main-content');

function init() {
  setupEventListeners();
  updateUI();
}

function setupEventListeners() {
  newRecitalBtn.addEventListener('click', createNewRecital);
  recitalInput.addEventListener('change', handleRecitalUpload);
  saveRecitalBtn.addEventListener('click', saveRecital);
  addSupertitlesBtn.addEventListener('click', () => supertitlesInput.click());
  supertitlesInput.addEventListener('change', handleSupertitlesUpload);
  addTitleSlideBtn.addEventListener('click', showTitleSlideEditor);
  confirmTitleSlideBtn.addEventListener('click', confirmAddTitleSlide);
  cancelTitleSlideBtn.addEventListener('click', hideTitleSlideEditor);
  exportPresentationBtn.addEventListener('click', exportPresentation);
  exportPdfBtn.addEventListener('click', exportCombinedPdf);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!saveRecitalBtn.disabled) saveRecital();
    }
  });
}

async function createNewRecital() {
  const name = await promptDialog('Enter recital name:', { title: 'New recital' });
  if (!name) return;

  state.recitalName = name;
  state.recitalFileName = null;
  state.items = [];
  unsaved.clear();

  enableEditing();
  updateUI();
}

async function handleRecitalUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const recitalData = JSON.parse(await file.text());
    if (!recitalData.version || !recitalData.items) throw new Error('Invalid recital file format');

    state.recitalName = recitalData.name || file.name.replace('.recital', '');
    state.recitalFileName = file.name.replace('.recital', '');
    state.items = recitalData.items;
    unsaved.clear();

    enableEditing();
    updateUI();
  } catch (error) {
    console.error('Error loading recital:', error);
    showError('Error loading recital: ' + error.message);
  }
  recitalInput.value = '';
}

async function handleSupertitlesUpload(e) {
  const files = e.target.files;
  if (!files.length) return;

  for (const file of files) {
    try {
      const setData = JSON.parse(await file.text());
      const fallbackName = file.name.replace('.supertitles', '');
      const normalized = normalizeSet(setData, fallbackName);

      state.items.push({
        type: 'supertitles',
        name: normalized.name,
        filename: fallbackName,
        data: setData,
      });
      unsaved.mark();
    } catch (error) {
      console.error('Error loading supertitles:', error);
      showError(`Error loading ${file.name}: ${error.message}`);
    }
  }

  updateUI();
  supertitlesInput.value = '';
}

function showTitleSlideEditor() {
  titleSlideEditor.style.display = 'block';
  titleSlideTitleInput.value = '';
  titleSlideSubtitleInput.value = '';
  titleSlideTitleInput.focus();
}

function hideTitleSlideEditor() {
  titleSlideEditor.style.display = 'none';
  titleSlideTitleInput.value = '';
  titleSlideSubtitleInput.value = '';
  delete titleSlideEditor.dataset.editingIndex;
}

async function confirmAddTitleSlide() {
  const title = titleSlideTitleInput.value.trim();
  if (!title) {
    await alertDialog('Please enter a title');
    return;
  }
  const subtitle = titleSlideSubtitleInput.value.trim();
  const editingIndex = titleSlideEditor.dataset.editingIndex;

  if (editingIndex !== undefined) {
    const index = parseInt(editingIndex, 10);
    state.items[index].data.title = title;
    state.items[index].data.subtitle = subtitle;
    state.items[index].name = title;
  } else {
    state.items.push({ type: 'title-slide', name: title, data: { title, subtitle } });
  }

  unsaved.mark();
  hideTitleSlideEditor();
  updateUI();
}

async function saveRecital() {
  if (!state.recitalName) {
    await alertDialog('No recital to save');
    return;
  }

  let filename = state.recitalFileName;
  if (!filename) {
    filename = await promptDialog('Enter filename (without extension):', {
      title: 'Save recital',
      defaultValue: state.recitalName.replace(/[^a-z0-9]/gi, '_').toLowerCase(),
    });
    if (!filename) return;
    state.recitalFileName = filename;
  }

  const recitalData = { version: 1, name: state.recitalName, items: state.items };
  download(JSON.stringify(recitalData, null, 2), filename + '.recital', 'application/json');

  unsaved.clear();
  updateUI();
}

async function exportPresentation() {
  if (!state.items.length) {
    await alertDialog('No items in recital to export');
    return;
  }

  const allSlides = [];
  let slideNumber = 1;
  for (const item of state.items) {
    if (item.type === 'supertitles') {
      for (const slide of item.data.presentation.slides || []) {
        allSlides.push({ ...slide, number: slideNumber++ });
      }
    } else if (item.type === 'title-slide') {
      allSlides.push({
        id: `title-slide-${Date.now()}-${slideNumber}`,
        type: 'title-subtitle',
        title: item.data.title,
        subtitle: item.data.subtitle,
        content: '',
        styles: {},
        number: slideNumber++,
      });
    }
  }

  const html = generateRevealHtml(allSlides, { title: state.recitalName });
  download(html, defaultExportName() + '.html', 'text/html');
  showFlash('Presentation exported successfully!');
}

async function exportCombinedPdf() {
  if (!state.items.length) {
    await alertDialog('No items in recital to export');
    return;
  }

  try {
    await withLoading('Building combined PDF…', async () => {
      const { PDFDocument, rgb, StandardFonts } = PDFLib;
      const mergedPdf = await PDFDocument.create();
      const numberFont = await mergedPdf.embedFont(StandardFonts.Helvetica);
      let slideNumber = 1;

      for (const item of state.items) {
        if (item.type === 'title-slide') {
          slideNumber = drawTitleSlidePage(mergedPdf, numberFont, await titleFonts(mergedPdf), item, slideNumber, rgb);
        } else if (item.type === 'supertitles') {
          slideNumber = await drawSupertitlesSet(mergedPdf, numberFont, item, slideNumber, rgb, PDFDocument);
        }
      }

      const pdfBytes = await mergedPdf.save();
      download(pdfBytes, defaultExportName() + '_annotated.pdf', 'application/pdf');
    });
    showFlash('Combined PDF exported successfully!');
  } catch (error) {
    console.error('Error exporting PDF:', error);
    showError('Error exporting PDF: ' + error.message);
  }
}

const MARKER_SIZE = 25; // consistent across all sets

async function titleFonts(pdf) {
  const { StandardFonts } = PDFLib;
  return {
    title: await pdf.embedFont(StandardFonts.HelveticaBold),
    subtitle: await pdf.embedFont(StandardFonts.Helvetica),
  };
}

function drawTitleSlidePage(pdf, numberFont, fonts, item, slideNumber, rgb) {
  const page = pdf.addPage([612, 792]); // Letter
  const { width, height } = page.getSize();

  // WinAnsi-safe: strip newlines/tabs that pdf-lib's standard fonts can't encode.
  const cleanTitle = item.data.title.replace(/[\n\r\t]/g, ' ');
  const titleSize = 48;
  page.drawText(cleanTitle, {
    x: (width - fonts.title.widthOfTextAtSize(cleanTitle, titleSize)) / 2,
    y: height - 250,
    size: titleSize,
    font: fonts.title,
    color: rgb(0, 0, 0),
  });

  if (item.data.subtitle) {
    const cleanSubtitle = item.data.subtitle.replace(/[\n\r\t]/g, ' ');
    const subtitleSize = 24;
    page.drawText(cleanSubtitle, {
      x: (width - fonts.subtitle.widthOfTextAtSize(cleanSubtitle, subtitleSize)) / 2,
      y: height - 320,
      size: subtitleSize,
      font: fonts.subtitle,
      color: rgb(0, 0, 0),
    });
  }

  drawNumberMarker(page, numberFont, slideNumber, width / 2, height / 2, rgb);
  return slideNumber + 1;
}

async function drawSupertitlesSet(mergedPdf, numberFont, item, startNumber, rgb, PDFDocument) {
  const pdfData = item.data.annotation.pdf;
  const annotations = item.data.annotation.annotations || [];
  const deletedPages = item.data.annotation.settings?.deletedPages || [];

  if (!pdfData) {
    console.warn(`No PDF data for supertitles set: ${item.name}`);
    return startNumber;
  }

  const sourcePdf = await PDFDocument.load(base64ToArrayBuffer(pdfData), { ignoreEncryption: true });
  const { numbered } = numberAnnotations(annotations, deletedPages, startNumber);

  const pages = sourcePdf.getPages();
  for (let i = 0; i < pages.length; i++) {
    const pageNum = i + 1;
    if (deletedPages.includes(pageNum)) continue;

    const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [i]);
    mergedPdf.addPage(copiedPage);
    const { width, height } = copiedPage.getSize();

    numbered
      .filter((ann) => ann.page === pageNum)
      .forEach((ann) => {
        // Normalized (0-1, y from top) -> PDF points (origin bottom-left).
        drawNumberMarker(copiedPage, numberFont, ann.number, ann.x * width, height - ann.y * height, rgb);
      });
  }

  // Next number = startNumber + count of drawn annotations.
  return startNumber + numbered.length;
}

function drawNumberMarker(page, font, number, x, y, rgb) {
  const numberText = String(number);
  const numberSize = MARKER_SIZE * 0.6;
  const circleSize = MARKER_SIZE * 0.7;

  page.drawCircle({
    x,
    y,
    size: circleSize,
    borderColor: rgb(1, 0, 0),
    borderWidth: 3,
    color: rgb(1, 1, 1),
    opacity: 0.8,
  });

  page.drawText(numberText, {
    x: x - font.widthOfTextAtSize(numberText, numberSize) / 2,
    y: y - numberSize / 3,
    size: numberSize,
    font,
    color: rgb(0, 0, 0),
  });
}

function defaultExportName() {
  return state.recitalFileName || state.recitalName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

function download(content, fileName, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function updateUI() {
  updateFileNameDisplay();
  updateRecitalList();

  const hasRecital = state.recitalName !== null;
  emptyState.style.display = hasRecital ? 'none' : 'flex';
  mainContent.style.display = hasRecital ? 'grid' : 'none';
}

function updateFileNameDisplay() {
  if (fileNameDisplay) {
    fileNameDisplay.textContent = state.recitalName ? `Recital: ${state.recitalName}` : 'No recital loaded';
  }
}

function updateRecitalList() {
  recitalList.innerHTML = '';

  if (state.items.length === 0) {
    recitalList.innerHTML = `
            <div class="empty-state">
                <p>No items in recital</p>
                <p style="font-size: 0.9em;">Add supertitle sets or title slides to get started</p>
            </div>`;
    return;
  }

  state.items.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = 'recital-item';
    itemEl.draggable = true;
    itemEl.dataset.index = index;

    let typeLabel, title, details;
    if (item.type === 'supertitles') {
      typeLabel = 'Supertitles Set';
      title = item.name;
      const slideCount = item.data.presentation.slides?.length || 0;
      details = `${slideCount} slide${slideCount !== 1 ? 's' : ''}`;
    } else {
      typeLabel = 'Title Slide';
      title = item.data.title;
      details = item.data.subtitle || '(no subtitle)';
    }

    const editButton =
      item.type === 'title-slide'
        ? `<button class="btn-small btn-edit" data-index="${index}">Edit</button>`
        : '';

    itemEl.innerHTML = `
            <div class="recital-item-header">
                <span class="recital-item-type">${typeLabel}</span>
                <div class="recital-item-actions">
                    ${editButton}
                    <button class="btn-small btn-remove" data-index="${index}">Remove</button>
                </div>
            </div>
            <div class="recital-item-title">${escapeHtml(title)}</div>
            <div class="recital-item-details">${escapeHtml(details)}</div>
        `;

    itemEl.addEventListener('dragstart', handleDragStart);
    itemEl.addEventListener('dragover', handleDragOver);
    itemEl.addEventListener('drop', handleDrop);
    itemEl.addEventListener('dragend', handleDragEnd);

    const editBtn = itemEl.querySelector('.btn-edit');
    if (editBtn) {
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        editTitleSlide(index);
      });
    }
    itemEl.querySelector('.btn-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      removeItem(index);
    });

    recitalList.appendChild(itemEl);
  });
}

let draggedIndex = null;

function handleDragStart(e) {
  draggedIndex = parseInt(e.currentTarget.dataset.index, 10);
  e.currentTarget.style.opacity = '0.4';
  e.dataTransfer.effectAllowed = 'move';
}

function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  const dropIndex = parseInt(e.currentTarget.dataset.index, 10);

  if (draggedIndex !== null && draggedIndex !== dropIndex) {
    const [dragged] = state.items.splice(draggedIndex, 1);
    state.items.splice(dropIndex, 0, dragged);
    unsaved.mark();
    updateUI();
  }
  return false;
}

function handleDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  draggedIndex = null;
}

async function removeItem(index) {
  if (await confirmDialog('Remove this item from the recital?', { title: 'Remove item', confirmText: 'Remove' })) {
    state.items.splice(index, 1);
    unsaved.mark();
    updateUI();
  }
}

function editTitleSlide(index) {
  const item = state.items[index];
  if (item.type !== 'title-slide') return;

  titleSlideTitleInput.value = item.data.title;
  titleSlideSubtitleInput.value = item.data.subtitle || '';
  titleSlideEditor.style.display = 'block';
  titleSlideEditor.dataset.editingIndex = index;
}

function enableEditing() {
  saveRecitalBtn.disabled = false;
  addSupertitlesBtn.disabled = false;
  addTitleSlideBtn.disabled = false;
  exportPresentationBtn.disabled = false;
  exportPdfBtn.disabled = false;
}

init();
