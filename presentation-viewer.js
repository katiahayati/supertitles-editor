// State
const state = {
    presentation: null,
    currentSlide: 0
};

// DOM elements
const prevBtn = document.getElementById('prev-slide');
const nextBtn = document.getElementById('next-slide');
const slideInfo = document.getElementById('slide-info');
const slideContent = document.querySelector('.slide-content');

// Initialize
function init() {
    setupEventListeners();
    notifyReady();
}

// Event listeners
function setupEventListeners() {
    prevBtn.addEventListener('click', () => changeSlide(-1));
    nextBtn.addEventListener('click', () => changeSlide(1));

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
            changeSlide(-1);
        } else if (e.key === 'ArrowRight') {
            changeSlide(1);
        }
    });

    // Listen for messages from parent
    window.addEventListener('message', handleMessage);
}

// Handle messages from parent
function handleMessage(event) {
    if (event.data.type === 'load-data') {
        loadPresentation(event.data.data, event.data.slideIndex);
    } else if (event.data.type === 'goto-slide') {
        if (event.data.slideIndex !== undefined) {
            state.currentSlide = event.data.slideIndex;
            renderSlide();
            updateControls();
        }
    }
}

// Load presentation data
function loadPresentation(data, slideIndex) {
    state.presentation = data;
    state.currentSlide = slideIndex !== undefined ? slideIndex : 0;
    renderSlide();
    updateControls();
}

// Change slide
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

// Notify parent of slide change
function notifySlideChange() {
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'slide-changed',
            slideIndex: state.currentSlide
        }, '*');
    }
}

// Render current slide
function renderSlide() {
    if (!state.presentation || !state.presentation.slides || state.presentation.slides.length === 0) {
        slideContent.innerHTML = '<div class="empty-state">No slides in presentation</div>';
        return;
    }

    const slide = state.presentation.slides[state.currentSlide];
    let html = '';

    switch (slide.type) {
        case 'title':
            html = `<div class="title-slide"><h1>${escapeHtml(slide.title || '')}</h1></div>`;
            break;
        case 'title-subtitle':
            html = `
                <div class="title-subtitle-slide">
                    <h1>${escapeHtml(slide.title || '')}</h1>
                    <h2>${escapeHtml(slide.subtitle || '')}</h2>
                </div>
            `;
            break;
        case 'title-content':
            html = `
                <div class="title-content-slide">
                    <h2>${escapeHtml(slide.title || '')}</h2>
                    <p>${escapeHtml(slide.content || '')}</p>
                </div>
            `;
            break;
        case 'content':
            html = `<p>${escapeHtml(slide.content || '')}</p>`;
            break;
        default:
            html = '<div class="empty-state">Unknown slide type</div>';
    }

    slideContent.innerHTML = html;
}

// Update controls
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

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Notify parent that we're ready
function notifyReady() {
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'presentation-viewer-ready' }, '*');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
