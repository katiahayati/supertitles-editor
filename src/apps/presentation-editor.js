import { escapeHtml, escapeHtmlWithBreaks } from '../shared/escape.js';
import { showError } from '../shared/flash.js';
import { alertDialog, confirmDialog, promptDialog } from '../shared/dialogs.js';
import { createUnsavedTracker } from '../shared/unsaved.js';
import { MSG, postToParent, onMessage } from '../shared/messaging.js';

// JSZip is loaded as a global UMD script in the HTML.
const JSZip = window.JSZip;

const state = {
  presentation: { title: 'New Presentation' },
  slides: [],
  currentSlideIndex: -1,
  fileName: '',
};

const unsaved = createUnsavedTracker();

const odpInput = document.getElementById('odp-input');
const projectInput = document.getElementById('project-input');
const newPresentationBtn = document.getElementById('new-presentation');
const saveProjectBtn = document.getElementById('save-project');
const addSlideBtn = document.getElementById('add-slide');
const deleteSlideBtn = document.getElementById('delete-slide');
const slidesList = document.getElementById('slides-list');
const slideEditor = document.getElementById('slide-editor');
const currentSlideNumber = document.getElementById('current-slide-number');
const slideCounter = document.getElementById('slide-counter');
const slideTypeSelect = document.getElementById('slide-type');
const slideTitleInput = document.getElementById('slide-title');
const slideSubtitleInput = document.getElementById('slide-subtitle');
const slideContentInput = document.getElementById('slide-content');
const titleGroup = document.getElementById('title-group');
const subtitleGroup = document.getElementById('subtitle-group');
const contentGroup = document.getElementById('content-group');
const fileNameDisplay = document.getElementById('file-name');
const slideProperties = document.querySelector('.slide-properties');

function init() {
  setupEventListeners();
  updateUI();
}

function setupEventListeners() {
  newPresentationBtn.addEventListener('click', createNewPresentation);
  odpInput.addEventListener('change', handleOdpUpload);
  projectInput.addEventListener('change', handleProjectUpload);
  saveProjectBtn.addEventListener('click', saveAsProject);
  addSlideBtn.addEventListener('click', addSlide);
  deleteSlideBtn.addEventListener('click', deleteCurrentSlide);
  slideTypeSelect.addEventListener('change', handleSlideTypeChange);

  slideTitleInput.addEventListener('input', updateCurrentSlide);
  slideSubtitleInput.addEventListener('input', updateCurrentSlide);
  slideContentInput.addEventListener('input', updateCurrentSlide);

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (!saveProjectBtn.disabled) saveAsProject();
    }
  });

  onMessage(handleParentMessage);
}

function createNewPresentation() {
  state.presentation = { title: 'New Presentation' };
  state.slides = [];
  state.currentSlideIndex = -1;
  state.fileName = '';

  updateFileNameDisplay();
  unsaved.clear();
  enableEditing();
  updateUI();
  notifyParent();
}

async function handleOdpUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    await loadOdp(file);
    state.fileName = file.name;
    updateFileNameDisplay();
    unsaved.clear();
  } catch (error) {
    console.error('Error loading ODP:', error);
    showError('Error loading ODP file: ' + error.message);
  }
  odpInput.value = '';
}

async function loadOdp(file) {
  const zip = new JSZip();
  const zipData = await zip.loadAsync(file);

  const contentXml = await zipData.file('content.xml').async('string');
  const parser = new DOMParser();
  const contentDoc = parser.parseFromString(contentXml, 'text/xml');

  let title = file.name.replace('.odp', '');
  if (zipData.file('meta.xml')) {
    const metaXml = await zipData.file('meta.xml').async('string');
    const metaDoc = parser.parseFromString(metaXml, 'text/xml');
    const titleEl = metaDoc.getElementsByTagName('dc:title')[0];
    if (titleEl) title = titleEl.textContent;
  }

  state.presentation = { title };
  state.slides = parseOdpSlides(contentDoc);
  state.currentSlideIndex = state.slides.length > 0 ? 0 : -1;

  enableEditing();
  updateUI();
  if (state.currentSlideIndex >= 0) displaySlide(state.currentSlideIndex);
  notifyParent();
}

function parseStyles(contentDoc) {
  const styles = {};
  const styleNS = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
  const foNS = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';

  const styleElements = contentDoc.getElementsByTagName('style:style');
  for (let i = 0; i < styleElements.length; i++) {
    const style = styleElements[i];
    const styleName = style.getAttributeNS(styleNS, 'name');
    if (!styleName) continue;
    styles[styleName] = { family: style.getAttributeNS(styleNS, 'family') };

    const textProps = style.getElementsByTagName('style:text-properties')[0];
    if (textProps) {
      styles[styleName].fontName = textProps.getAttributeNS(styleNS, 'font-name');
      styles[styleName].fontSize = textProps.getAttributeNS(foNS, 'font-size');
      styles[styleName].fontWeight = textProps.getAttributeNS(foNS, 'font-weight');
      styles[styleName].color = textProps.getAttributeNS(foNS, 'color');
    }
    const paraProps = style.getElementsByTagName('style:paragraph-properties')[0];
    if (paraProps) {
      styles[styleName].textAlign = paraProps.getAttributeNS(foNS, 'text-align');
    }
  }
  return styles;
}

function parseOdpSlides(contentDoc) {
  const slides = [];
  const drawPages = contentDoc.getElementsByTagName('draw:page');
  const styles = parseStyles(contentDoc);
  const textNS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';
  const presNS = 'urn:oasis:names:tc:opendocument:xmlns:presentation:1.0';

  for (let i = 0; i < drawPages.length; i++) {
    const frames = drawPages[i].getElementsByTagName('draw:frame');
    const framesByClass = {
      title: { content: null, style: {} },
      subtitle: { content: null, style: {} },
      outline: { content: null, style: {} },
    };

    for (let j = 0; j < frames.length; j++) {
      const frame = frames[j];
      const presClass = frame.getAttributeNS(presNS, 'class');
      if (presClass === 'notes' || presClass === 'page-number') continue;

      const textBoxes = frame.getElementsByTagName('text:p');
      const texts = [];
      let frameStyle = {};

      for (let k = 0; k < textBoxes.length; k++) {
        const para = textBoxes[k];
        const clone = para.cloneNode(true);

        if (k === 0) {
          const paraStyleName = para.getAttributeNS(textNS, 'style-name');
          if (paraStyleName && styles[paraStyleName]) {
            frameStyle.textAlign = styles[paraStyleName].textAlign;
          }
          const spans = para.getElementsByTagName('text:span');
          if (spans.length > 0) {
            const spanStyleName = spans[0].getAttributeNS(textNS, 'style-name');
            if (spanStyleName && styles[spanStyleName]) {
              frameStyle.fontName = styles[spanStyleName].fontName;
              frameStyle.fontSize = styles[spanStyleName].fontSize;
              frameStyle.fontWeight = styles[spanStyleName].fontWeight;
              frameStyle.color = styles[spanStyleName].color;
            }
          }
        }

        const numbers = clone.getElementsByTagName('text:number');
        while (numbers.length > 0) numbers[0].remove();

        const text = clone.textContent.replace(/<number>/g, '').trim();
        if (text) texts.push(text);
      }

      const content = texts.join('\n').trim();
      if (content && framesByClass[presClass]) {
        framesByClass[presClass] = { content, style: frameStyle };
      }
    }

    slides.push(convertOdpToSlide(framesByClass, i));
  }
  return slides;
}

function convertOdpToSlide(framesByClass, index) {
  const { title, subtitle, outline } = framesByClass;
  const id = `slide-${Date.now()}-${index}`;

  if (title.content && subtitle.content) {
    return { id, type: 'title-subtitle', title: title.content, subtitle: subtitle.content, content: '', styles: { title: title.style, subtitle: subtitle.style } };
  }
  if (title.content && outline.content) {
    return { id, type: 'title-content', title: title.content, subtitle: '', content: outline.content, styles: { title: title.style, content: outline.style } };
  }
  if (outline.content) {
    return { id, type: 'content', title: '', subtitle: '', content: outline.content, styles: { content: outline.style } };
  }
  if (title.content) {
    return { id, type: 'title', title: title.content, subtitle: '', content: '', styles: { title: title.style } };
  }
  return { id, type: 'content', title: '', subtitle: '', content: '', styles: {} };
}

function addSlide() {
  const currentType =
    state.currentSlideIndex >= 0 && state.slides[state.currentSlideIndex]
      ? state.slides[state.currentSlideIndex].type
      : 'title';

  const newSlide = { id: `slide-${Date.now()}`, type: currentType, title: 'New Slide', subtitle: '', content: '', styles: {} };
  const insertIndex = state.currentSlideIndex >= 0 ? state.currentSlideIndex + 1 : state.slides.length;
  state.slides.splice(insertIndex, 0, newSlide);
  state.currentSlideIndex = insertIndex;

  unsaved.mark();
  updateUI();
  displaySlide(state.currentSlideIndex);
  notifyParent();
}

async function deleteCurrentSlide() {
  if (state.currentSlideIndex < 0 || state.slides.length === 0) return;
  if (!(await confirmDialog('Delete this slide?', { title: 'Delete slide', confirmText: 'Delete' }))) return;

  state.slides.splice(state.currentSlideIndex, 1);
  unsaved.mark();

  if (state.slides.length === 0) state.currentSlideIndex = -1;
  else if (state.currentSlideIndex >= state.slides.length) state.currentSlideIndex = state.slides.length - 1;

  updateUI();
  if (state.currentSlideIndex >= 0) displaySlide(state.currentSlideIndex);
  else slideEditor.innerHTML = '<div class="empty-state"><p>No slides. Click "Add Slide" to create one.</p></div>';
  notifyParent();
}

function updateCurrentSlide() {
  if (state.currentSlideIndex < 0) return;

  const slide = state.slides[state.currentSlideIndex];
  slide.type = slideTypeSelect.value;
  slide.title = slideTitleInput.value;
  slide.subtitle = slideSubtitleInput.value;
  slide.content = slideContentInput.value;

  unsaved.mark();
  updatePreview();
  updateSlidesList();
  notifyParent();
}

function handleSlideTypeChange() {
  updateFieldVisibility();
  updateCurrentSlide();
}

function displaySlide(index) {
  if (index < 0 || index >= state.slides.length) return;

  state.currentSlideIndex = index;
  const slide = state.slides[index];

  // Set values without retriggering the input listeners.
  slideTitleInput.removeEventListener('input', updateCurrentSlide);
  slideSubtitleInput.removeEventListener('input', updateCurrentSlide);
  slideContentInput.removeEventListener('input', updateCurrentSlide);
  slideTypeSelect.removeEventListener('change', handleSlideTypeChange);

  slideTypeSelect.value = slide.type;
  slideTitleInput.value = slide.title;
  slideSubtitleInput.value = slide.subtitle;
  slideContentInput.value = slide.content;

  slideTitleInput.addEventListener('input', updateCurrentSlide);
  slideSubtitleInput.addEventListener('input', updateCurrentSlide);
  slideContentInput.addEventListener('input', updateCurrentSlide);
  slideTypeSelect.addEventListener('change', handleSlideTypeChange);

  updateFieldVisibility();
  updatePreview();
  currentSlideNumber.textContent = index + 1;
  postToParent({ type: MSG.SLIDE_CHANGED, slideIndex: index });
  updateSlidesList();
}

function updateFieldVisibility() {
  const type = slideTypeSelect.value;
  const show = (el, visible) => (el.style.display = visible ? 'block' : 'none');
  show(titleGroup, type !== 'content');
  show(subtitleGroup, type === 'title-subtitle');
  show(contentGroup, type === 'title-content' || type === 'content');
}

function updatePreview() {
  if (state.currentSlideIndex < 0) return;
  const slide = state.slides[state.currentSlideIndex];
  let html = '';

  if (slide.type === 'title') {
    html = `<div class="slide-preview"><div class="title-slide"><h1 style="${buildStyleString(slide.styles?.title)}">${escapeHtmlWithBreaks(slide.title)}</h1></div></div>`;
  } else if (slide.type === 'title-subtitle') {
    html = `<div class="slide-preview"><div class="title-subtitle-slide"><h1 style="${buildStyleString(slide.styles?.title)}">${escapeHtmlWithBreaks(slide.title)}</h1><h2 style="${buildStyleString(slide.styles?.subtitle)}">${escapeHtmlWithBreaks(slide.subtitle)}</h2></div></div>`;
  } else if (slide.type === 'title-content') {
    html = `<div class="slide-preview"><div class="title-content-slide"><h2 style="${buildStyleString(slide.styles?.title)}">${escapeHtmlWithBreaks(slide.title)}</h2><p style="${buildStyleString(slide.styles?.content)}">${escapeHtmlWithBreaks(slide.content)}</p></div></div>`;
  } else if (slide.type === 'content') {
    html = `<div class="slide-preview"><p style="${buildStyleString(slide.styles?.content)}">${escapeHtmlWithBreaks(slide.content)}</p></div>`;
  }
  slideEditor.innerHTML = html;
}

function buildStyleString(styleObj) {
  if (!styleObj) return '';
  const parts = [];
  if (styleObj.fontName) parts.push(`font-family: '${styleObj.fontName}', sans-serif`);
  if (styleObj.fontSize) parts.push(`font-size: ${styleObj.fontSize}`);
  if (styleObj.fontWeight) parts.push(`font-weight: ${styleObj.fontWeight}`);
  if (styleObj.color) parts.push(`color: ${styleObj.color}`);
  if (styleObj.textAlign) parts.push(`text-align: ${styleObj.textAlign}`);
  return parts.join('; ');
}

function updateSlidesList() {
  slidesList.innerHTML = '';
  state.slides.forEach((slide, index) => {
    const item = document.createElement('div');
    item.className = 'slide-item';
    item.draggable = true;
    item.dataset.index = index;
    if (index === state.currentSlideIndex) item.classList.add('active');

    const typeLabel =
      slide.type === 'title' ? 'Title' :
      slide.type === 'title-subtitle' ? 'Title+Subtitle' :
      slide.type === 'title-content' ? 'Title+Content' : 'Content';

    const source = slide.type === 'content' ? slide.content : slide.title;
    const preview = (source || '').substring(0, 50) + ((source || '').length > 50 ? '...' : '');

    item.innerHTML = `
            <div class="slide-item-number">Slide ${index + 1}</div>
            <div class="slide-item-type">${typeLabel}</div>
            <div class="slide-item-preview">${escapeHtml(preview)}</div>
        `;

    item.addEventListener('click', () => displaySlide(index));
    item.addEventListener('dragstart', handleDragStart);
    item.addEventListener('dragover', handleDragOver);
    item.addEventListener('drop', handleDrop);
    item.addEventListener('dragend', handleDragEnd);

    slidesList.appendChild(item);
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
    const [dragged] = state.slides.splice(draggedIndex, 1);
    state.slides.splice(dropIndex, 0, dragged);

    if (state.currentSlideIndex === draggedIndex) state.currentSlideIndex = dropIndex;
    else if (draggedIndex < state.currentSlideIndex && dropIndex >= state.currentSlideIndex) state.currentSlideIndex--;
    else if (draggedIndex > state.currentSlideIndex && dropIndex <= state.currentSlideIndex) state.currentSlideIndex++;

    unsaved.mark();
    updateUI();
    notifyParent();
  }
  return false;
}

function handleDragEnd(e) {
  e.currentTarget.style.opacity = '1';
  draggedIndex = null;
}

function updateUI() {
  slideCounter.textContent = `${state.slides.length} slide${state.slides.length !== 1 ? 's' : ''}`;
  updateSlidesList();

  const hasSlides = state.slides.length > 0;
  deleteSlideBtn.disabled = !hasSlides;

  if (hasSlides) {
    slideProperties.style.display = 'block';
    if (state.currentSlideIndex >= 0) displaySlide(state.currentSlideIndex);
  } else {
    slideProperties.style.display = 'none';
    currentSlideNumber.textContent = '-';
    slideEditor.innerHTML = '<div class="empty-state"><p>Create a new presentation or load an ODP file to get started</p></div>';
  }
}

function enableEditing() {
  saveProjectBtn.disabled = false;
  addSlideBtn.disabled = false;
  slideTypeSelect.disabled = false;
  slideTitleInput.disabled = false;
  slideSubtitleInput.disabled = false;
  slideContentInput.disabled = false;
}

async function saveAsProject() {
  if (state.slides.length === 0) {
    await alertDialog('No slides to save');
    return;
  }

  const defaultFilename = state.presentation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
  const filename = await promptDialog('Enter filename (without extension):', {
    title: 'Save project',
    defaultValue: defaultFilename,
  });
  if (!filename) return;

  const projectData = { version: 1, presentation: state.presentation, slides: state.slides };
  const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename + '.json';
  a.click();
  URL.revokeObjectURL(url);

  state.fileName = filename + '.json';
  updateFileNameDisplay();
  unsaved.clear();
}

async function handleProjectUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  try {
    const projectData = JSON.parse(await file.text());
    if (!projectData.version || !projectData.slides) throw new Error('Invalid project file format');

    state.presentation = projectData.presentation || { title: 'Presentation' };
    state.slides = projectData.slides;
    state.currentSlideIndex = state.slides.length > 0 ? 0 : -1;

    enableEditing();
    updateUI();
    if (state.currentSlideIndex >= 0) displaySlide(state.currentSlideIndex);

    notifyParent();
    state.fileName = file.name;
    updateFileNameDisplay();
    unsaved.clear();
  } catch (error) {
    console.error('Error loading project:', error);
    showError('Error loading project file: ' + error.message);
  }
  projectInput.value = '';
}

function notifyParent() {
  postToParent({
    type: MSG.PRESENTATION_CHANGED,
    data: { version: 1, presentation: state.presentation, slides: state.slides },
    presentationTitle: state.presentation?.title || null,
  });
}

function handleParentMessage(data) {
  if (data.type === MSG.LOAD_DATA) {
    state.presentation = data.data.presentation || { title: 'Presentation' };
    state.slides = data.data.slides || [];
    state.currentSlideIndex = state.slides.length > 0 ? 0 : -1;

    if (data.metadata?.fileName) {
      state.fileName = data.metadata.fileName;
      updateFileNameDisplay();
    }

    enableEditing();
    updateUI();
    if (state.currentSlideIndex >= 0) displaySlide(state.currentSlideIndex);
  } else if (data.type === MSG.GOTO_SLIDE) {
    if (data.slideIndex >= 0 && data.slideIndex < state.slides.length) {
      state.currentSlideIndex = data.slideIndex;
      displaySlide(state.currentSlideIndex);
    }
  }
}

function updateFileNameDisplay() {
  if (fileNameDisplay) fileNameDisplay.textContent = state.fileName || 'No project loaded';
}

init();
postToParent({ type: MSG.PRESENTATION_READY });
