// Application state
const state = {
    presentation: null,
    slides: [],
    currentSlideIndex: -1,
    originalOdpZip: null
};

// DOM elements
const odpUpload = document.getElementById('odp-upload');
const newPresentationBtn = document.getElementById('new-presentation');
const saveOdpBtn = document.getElementById('save-odp');
const addSlideBtn = document.getElementById('add-slide');
const deleteSlideBtn = document.getElementById('delete-slide');
const slidesList = document.getElementById('slides-list');
const slideEditor = document.getElementById('slide-editor');
const currentSlideNumber = document.getElementById('current-slide-number');
const slideCounter = document.getElementById('slide-counter');
const slideTitleInput = document.getElementById('slide-title');
const slideContentInput = document.getElementById('slide-content');
const updateSlideBtn = document.getElementById('update-slide');

// Initialize
function init() {
    setupEventListeners();
}

// Event listeners
function setupEventListeners() {
    odpUpload.addEventListener('change', handleOdpUpload);
    newPresentationBtn.addEventListener('click', createNewPresentation);
    saveOdpBtn.addEventListener('click', saveOdp);
    addSlideBtn.addEventListener('click', addSlide);
    deleteSlideBtn.addEventListener('click', deleteCurrentSlide);
    updateSlideBtn.addEventListener('click', updateCurrentSlide);
}

// Create new presentation
function createNewPresentation() {
    state.presentation = {
        title: 'New Presentation',
        author: '',
        created: new Date().toISOString()
    };
    state.slides = [];
    state.currentSlideIndex = -1;
    state.originalOdpZip = null;

    // Add first slide
    addSlide();

    enableEditing();
    updateUI();
}

// Load ODP file
async function handleOdpUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        await loadOdp(file);
        alert('ODP loaded successfully!');
    } catch (error) {
        console.error('Error loading ODP:', error);
        alert('Error loading ODP file. Please try another file.');
    }
}

// Load and parse ODP file
async function loadOdp(file) {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    // Store original zip for preserving structure
    state.originalOdpZip = zipData;

    // Parse content.xml (contains slide content)
    const contentXml = await zipData.file('content.xml').async('string');
    const parser = new DOMParser();
    const contentDoc = parser.parseFromString(contentXml, 'text/xml');

    // Extract slides from content.xml
    state.slides = parseSlides(contentDoc);

    // Parse meta.xml for presentation metadata
    if (zipData.file('meta.xml')) {
        const metaXml = await zipData.file('meta.xml').async('string');
        const metaDoc = parser.parseFromString(metaXml, 'text/xml');
        state.presentation = parseMetadata(metaDoc);
    } else {
        state.presentation = {
            title: file.name.replace('.odp', ''),
            author: '',
            created: new Date().toISOString()
        };
    }

    state.currentSlideIndex = state.slides.length > 0 ? 0 : -1;

    enableEditing();
    updateUI();
    if (state.currentSlideIndex >= 0) {
        displaySlide(state.currentSlideIndex);
    }
}

// Parse slides from content.xml
function parseSlides(contentDoc) {
    const slides = [];
    const drawPages = contentDoc.getElementsByTagName('draw:page');

    for (let i = 0; i < drawPages.length; i++) {
        const page = drawPages[i];
        const slide = {
            id: page.getAttribute('draw:id') || `slide-${i + 1}`,
            name: page.getAttribute('draw:name') || `Slide ${i + 1}`,
            title: '',
            content: ''
        };

        // Extract text content from frames
        const frames = page.getElementsByTagName('draw:frame');
        const textContents = [];

        for (let j = 0; j < frames.length; j++) {
            const textBoxes = frames[j].getElementsByTagName('text:p');
            for (let k = 0; k < textBoxes.length; k++) {
                const text = textBoxes[k].textContent.trim();
                if (text) {
                    textContents.push(text);
                }
            }
        }

        // First text is usually title, rest is content
        if (textContents.length > 0) {
            slide.title = textContents[0];
            slide.content = textContents.slice(1).join('\n');
        }

        slides.push(slide);
    }

    return slides;
}

// Parse metadata from meta.xml
function parseMetadata(metaDoc) {
    const titleEl = metaDoc.getElementsByTagName('dc:title')[0];
    const creatorEl = metaDoc.getElementsByTagName('meta:initial-creator')[0];
    const dateEl = metaDoc.getElementsByTagName('meta:creation-date')[0];

    return {
        title: titleEl ? titleEl.textContent : 'Untitled',
        author: creatorEl ? creatorEl.textContent : '',
        created: dateEl ? dateEl.textContent : new Date().toISOString()
    };
}

// Add new slide
function addSlide() {
    const newSlide = {
        id: `slide-${Date.now()}`,
        name: `Slide ${state.slides.length + 1}`,
        title: 'New Slide',
        content: 'Enter slide content here'
    };

    state.slides.push(newSlide);
    state.currentSlideIndex = state.slides.length - 1;

    updateUI();
    displaySlide(state.currentSlideIndex);
}

// Delete current slide
function deleteCurrentSlide() {
    if (state.currentSlideIndex < 0 || state.slides.length === 0) return;

    if (!confirm('Delete this slide?')) return;

    state.slides.splice(state.currentSlideIndex, 1);

    if (state.slides.length === 0) {
        state.currentSlideIndex = -1;
    } else if (state.currentSlideIndex >= state.slides.length) {
        state.currentSlideIndex = state.slides.length - 1;
    }

    updateUI();
    if (state.currentSlideIndex >= 0) {
        displaySlide(state.currentSlideIndex);
    } else {
        slideEditor.innerHTML = '<div class="empty-state"><p>No slides. Click "Add Slide" to create one.</p></div>';
    }
}

// Update current slide
function updateCurrentSlide() {
    if (state.currentSlideIndex < 0) return;

    const slide = state.slides[state.currentSlideIndex];
    slide.title = slideTitleInput.value;
    slide.content = slideContentInput.value;

    updateUI();
    displaySlide(state.currentSlideIndex);
}

// Display slide in editor
function displaySlide(index) {
    if (index < 0 || index >= state.slides.length) return;

    state.currentSlideIndex = index;
    const slide = state.slides[index];

    // Update form inputs
    slideTitleInput.value = slide.title;
    slideContentInput.value = slide.content;

    // Update preview
    slideEditor.innerHTML = `
        <div class="slide-preview">
            <h2>${slide.title}</h2>
            <p>${slide.content.replace(/\n/g, '<br>')}</p>
        </div>
    `;

    currentSlideNumber.textContent = index + 1;

    // Update slides list
    updateSlidesList();
}

// Update slides list
function updateSlidesList() {
    slidesList.innerHTML = '';

    state.slides.forEach((slide, index) => {
        const item = document.createElement('div');
        item.className = 'slide-item';
        if (index === state.currentSlideIndex) {
            item.classList.add('active');
        }

        item.innerHTML = `
            <div class="slide-item-number">Slide ${index + 1}</div>
            <div class="slide-item-title">${slide.title}</div>
            <div class="slide-item-preview">${slide.content.substring(0, 50)}${slide.content.length > 50 ? '...' : ''}</div>
        `;

        item.addEventListener('click', () => displaySlide(index));
        slidesList.appendChild(item);
    });
}

// Update UI
function updateUI() {
    slideCounter.textContent = `${state.slides.length} slide${state.slides.length !== 1 ? 's' : ''}`;
    updateSlidesList();

    const hasSlides = state.slides.length > 0;
    deleteSlideBtn.disabled = !hasSlides;
}

// Enable editing
function enableEditing() {
    saveOdpBtn.disabled = false;
    addSlideBtn.disabled = false;
    slideTitleInput.disabled = false;
    slideContentInput.disabled = false;
    updateSlideBtn.disabled = false;
}

// Save as ODP
async function saveOdp() {
    if (!state.presentation || state.slides.length === 0) {
        alert('No presentation to save');
        return;
    }

    const fileName = prompt('Enter filename:', state.presentation.title || 'presentation');
    if (!fileName) return;

    try {
        const odpBlob = await generateOdp();

        const url = URL.createObjectURL(odpBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.odp') ? fileName : fileName + '.odp';
        a.click();
        URL.revokeObjectURL(url);

        alert('ODP saved successfully!');
    } catch (error) {
        console.error('Error saving ODP:', error);
        alert('Error saving ODP file. Please try again.');
    }
}

// Generate ODP file
async function generateOdp() {
    const zip = new JSZip();

    // If we loaded an existing ODP, use it as base
    if (state.originalOdpZip) {
        // Copy most files from original
        const filesToCopy = ['META-INF/manifest.xml', 'mimetype', 'styles.xml', 'settings.xml'];
        for (const filename of filesToCopy) {
            if (state.originalOdpZip.file(filename)) {
                const content = await state.originalOdpZip.file(filename).async('string');
                zip.file(filename, content);
            }
        }
    } else {
        // Create minimal ODP structure
        zip.file('mimetype', 'application/vnd.oasis.opendocument.presentation');

        zip.file('META-INF/manifest.xml', `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.presentation"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`);
    }

    // Generate content.xml with slides
    const contentXml = generateContentXml();
    zip.file('content.xml', contentXml);

    // Generate meta.xml
    const metaXml = generateMetaXml();
    zip.file('meta.xml', metaXml);

    return await zip.generateAsync({ type: 'blob' });
}

// Generate content.xml
function generateContentXml() {
    let slidesXml = '';

    state.slides.forEach((slide, index) => {
        slidesXml += `
    <draw:page draw:name="${slide.name}" draw:id="${slide.id}">
      <draw:frame draw:layer="layout" svg:width="25cm" svg:height="2cm" svg:x="2cm" svg:y="2cm">
        <draw:text-box>
          <text:p text:style-name="Title">${escapeXml(slide.title)}</text:p>
        </draw:text-box>
      </draw:frame>
      <draw:frame draw:layer="layout" svg:width="23cm" svg:height="15cm" svg:x="2cm" svg:y="5cm">
        <draw:text-box>
          ${slide.content.split('\n').map(line => `<text:p text:style-name="Content">${escapeXml(line)}</text:p>`).join('\n          ')}
        </draw:text-box>
      </draw:frame>
    </draw:page>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0"
  xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0"
  office:version="1.2">
  <office:body>
    <office:presentation>${slidesXml}
    </office:presentation>
  </office:body>
</office:document-content>`;
}

// Generate meta.xml
function generateMetaXml() {
    const now = new Date().toISOString();

    return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  office:version="1.2">
  <office:meta>
    <dc:title>${escapeXml(state.presentation.title)}</dc:title>
    <meta:initial-creator>${escapeXml(state.presentation.author || 'Slides Editor')}</meta:initial-creator>
    <meta:creation-date>${state.presentation.created}</meta:creation-date>
    <dc:date>${now}</dc:date>
    <meta:editing-cycles>1</meta:editing-cycles>
    <meta:generator>Slides Editor 1.0</meta:generator>
  </office:meta>
</office:document-meta>`;
}

// Escape XML special characters
function escapeXml(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

// Initialize the application
init();
