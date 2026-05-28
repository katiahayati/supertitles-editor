import { escapeHtml } from '../shared/escape.js';
import { MSG, postToParent, onMessage } from '../shared/messaging.js';

const state = {
  presentation: null,
  currentSlide: 0,
};

const prevBtn = document.getElementById('prev-slide');
const nextBtn = document.getElementById('next-slide');
const slideInfo = document.getElementById('slide-info');
const slideContent = document.querySelector('.slide-content');

function init() {
  setupEventListeners();
  notifyReady();
}

function setupEventListeners() {
  prevBtn.addEventListener('click', () => changeSlide(-1));
  nextBtn.addEventListener('click', () => changeSlide(1));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') changeSlide(-1);
    else if (e.key === 'ArrowRight') changeSlide(1);
  });

  onMessage(handleMessage);
}

function handleMessage(data) {
  if (data.type === MSG.LOAD_DATA) {
    loadPresentation(data.data, data.slideIndex);
  } else if (data.type === MSG.GOTO_SLIDE) {
    if (data.slideIndex !== undefined) {
      state.currentSlide = data.slideIndex;
      renderSlide();
      updateControls();
    }
  }
}

function loadPresentation(data, slideIndex) {
  state.presentation = data;
  state.currentSlide = slideIndex !== undefined ? slideIndex : 0;
  renderSlide();
  updateControls();
}

function changeSlide(delta) {
  if (!state.presentation || !state.presentation.slides) return;

  const newSlide = state.currentSlide + delta;
  if (newSlide >= 0 && newSlide < state.presentation.slides.length) {
    state.currentSlide = newSlide;
    renderSlide();
    updateControls();
    notifySlideChange();
  }
}

function notifySlideChange() {
  postToParent({ type: MSG.SLIDE_CHANGED, slideIndex: state.currentSlide });
}

function renderSlide() {
  if (!state.presentation || !state.presentation.slides || state.presentation.slides.length === 0) {
    slideContent.innerHTML = '<div class="empty-state">No slides in presentation</div>';
    return;
  }

  const slide = state.presentation.slides[state.currentSlide];
  let html = '';

  switch (slide.type) {
    case 'title':
      html = `<div class="title-slide"><h1>${escapeHtml(slide.title)}</h1></div>`;
      break;
    case 'title-subtitle':
      html = `
                <div class="title-subtitle-slide">
                    <h1>${escapeHtml(slide.title)}</h1>
                    <h2>${escapeHtml(slide.subtitle)}</h2>
                </div>
            `;
      break;
    case 'title-content':
      html = `
                <div class="title-content-slide">
                    <h2>${escapeHtml(slide.title)}</h2>
                    <p>${escapeHtml(slide.content)}</p>
                </div>
            `;
      break;
    case 'content':
      html = `<p>${escapeHtml(slide.content)}</p>`;
      break;
    default:
      html = '<div class="empty-state">Unknown slide type</div>';
  }

  slideContent.innerHTML = html;
}

function updateControls() {
  if (!state.presentation || !state.presentation.slides) {
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    slideInfo.textContent = 'No presentation loaded';
    return;
  }

  prevBtn.disabled = state.currentSlide === 0;
  nextBtn.disabled = state.currentSlide === state.presentation.slides.length - 1;
  slideInfo.textContent = `Slide ${state.currentSlide + 1} of ${state.presentation.slides.length}`;
}

function notifyReady() {
  postToParent({ type: MSG.PRESENTATION_VIEWER_READY });
}

init();
