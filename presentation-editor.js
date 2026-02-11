// Application state
const state = {
    presentation: { title: 'New Presentation' },
    slides: [],
    currentSlideIndex: -1,
    fileName: '',
    hasUnsavedChanges: false
};

// DOM elements
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
const unsavedIndicator = document.getElementById('unsaved-indicator');
const slideProperties = document.querySelector('.slide-properties');

// Initialize
function init() {
    setupEventListeners();
    updateUI(); // Initialize UI to show/hide panels based on initial state
}

// Event listeners
function setupEventListeners() {
    newPresentationBtn.addEventListener('click', createNewPresentation);
    odpInput.addEventListener('change', handleOdpUpload);
    projectInput.addEventListener('change', handleProjectUpload);
    saveProjectBtn.addEventListener('click', saveAsProject);
    addSlideBtn.addEventListener('click', addSlide);
    deleteSlideBtn.addEventListener('click', deleteCurrentSlide);
    slideTypeSelect.addEventListener('change', handleSlideTypeChange);

    // Auto-save on input
    slideTitleInput.addEventListener('input', updateCurrentSlide);
    slideSubtitleInput.addEventListener('input', updateCurrentSlide);
    slideContentInput.addEventListener('input', updateCurrentSlide);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (!saveProjectBtn.disabled) {
                saveAsProject();
            }
        }
    });

    // Warn before closing with unsaved changes
    window.addEventListener('beforeunload', (e) => {
        if (state.hasUnsavedChanges) {
            e.preventDefault();
            e.returnValue = '';
        }
    });
}

// Create new presentation
function createNewPresentation() {
    state.presentation = { title: 'New Presentation' };
    state.slides = [];
    state.currentSlideIndex = -1;
    state.fileName = '';

    updateFileNameDisplay();
    clearUnsavedChanges();

    enableEditing();
    updateUI();
    notifyParent();
}

// Handle ODP file upload
async function handleOdpUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        await loadOdp(file);
        // ODP loaded successfully - no alert needed
        state.fileName = file.name;
        updateFileNameDisplay();
        clearUnsavedChanges();
    } catch (error) {
        console.error('Error loading ODP:', error);
        alert('Error loading ODP file: ' + error.message);
    }

    odpInput.value = '';
}

// Load and parse ODP file
async function loadOdp(file) {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    // Parse content.xml
    const contentXml = await zipData.file('content.xml').async('string');
    const parser = new DOMParser();
    const contentDoc = parser.parseFromString(contentXml, 'text/xml');

    // Extract title
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
    if (state.currentSlideIndex >= 0) {
        displaySlide(state.currentSlideIndex);
    }
    notifyParent();
}

// Parse style information from ODP
function parseStyles(contentDoc) {
    const styles = {};
    const styleNS = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
    const foNS = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';

    const styleElements = contentDoc.getElementsByTagName('style:style');

    for (let i = 0; i < styleElements.length; i++) {
        const style = styleElements[i];
        const styleName = style.getAttributeNS(styleNS, 'name');
        const family = style.getAttributeNS(styleNS, 'family');

        if (!styleName) continue;

        styles[styleName] = { family };

        // Get text properties
        const textProps = style.getElementsByTagName('style:text-properties')[0];
        if (textProps) {
            styles[styleName].fontName = textProps.getAttributeNS(styleNS, 'font-name');
            styles[styleName].fontSize = textProps.getAttributeNS(foNS, 'font-size');
            styles[styleName].fontWeight = textProps.getAttributeNS(foNS, 'font-weight');
            styles[styleName].color = textProps.getAttributeNS(foNS, 'color');
        }

        // Get paragraph properties
        const paraProps = style.getElementsByTagName('style:paragraph-properties')[0];
        if (paraProps) {
            styles[styleName].textAlign = paraProps.getAttributeNS(foNS, 'text-align');
        }
    }

    return styles;
}

// Parse slides from ODP
function parseOdpSlides(contentDoc) {
    const slides = [];
    const drawPages = contentDoc.getElementsByTagName('draw:page');
    const styles = parseStyles(contentDoc);

    console.log('Parsed styles:', styles);

    for (let i = 0; i < drawPages.length; i++) {
        const page = drawPages[i];
        const frames = page.getElementsByTagName('draw:frame');

        // Categorize frames by their presentation class
        const framesByClass = {
            title: { content: null, style: {} },
            subtitle: { content: null, style: {} },
            outline: { content: null, style: {} }
        };

        for (let j = 0; j < frames.length; j++) {
            const frame = frames[j];
            const presClass = frame.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:presentation:1.0', 'class');

            // Skip notes and page numbers
            if (presClass === 'notes' || presClass === 'page-number') {
                continue;
            }

            // Extract text and style from this frame
            const textBoxes = frame.getElementsByTagName('text:p');
            const texts = [];
            let frameStyle = {};

            for (let k = 0; k < textBoxes.length; k++) {
                const para = textBoxes[k];
                const clone = para.cloneNode(true);

                // Get style from first paragraph
                if (k === 0) {
                    const paraStyleName = para.getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'style-name');
                    if (paraStyleName && styles[paraStyleName]) {
                        frameStyle.textAlign = styles[paraStyleName].textAlign;
                    }

                    // Get style from first span
                    const spans = para.getElementsByTagName('text:span');
                    if (spans.length > 0) {
                        const spanStyleName = spans[0].getAttributeNS('urn:oasis:names:tc:opendocument:xmlns:text:1.0', 'style-name');
                        if (spanStyleName && styles[spanStyleName]) {
                            frameStyle.fontName = styles[spanStyleName].fontName;
                            frameStyle.fontSize = styles[spanStyleName].fontSize;
                            frameStyle.fontWeight = styles[spanStyleName].fontWeight;
                            frameStyle.color = styles[spanStyleName].color;
                        }
                    }
                }

                // Remove number elements
                const numbers = clone.getElementsByTagName('text:number');
                while (numbers.length > 0) {
                    numbers[0].remove();
                }

                let text = clone.textContent;
                text = text.replace(/<number>/g, '');

                // Trim each paragraph
                text = text.trim();

                // Only add non-empty paragraphs
                if (text) {
                    texts.push(text);
                }
            }

            // Join paragraphs with newlines, then trim the whole result
            const content = texts.join('\n').trim();

            // Store text and style by frame class
            if (content) {
                if (presClass === 'title') {
                    framesByClass.title = { content, style: frameStyle };
                } else if (presClass === 'subtitle') {
                    framesByClass.subtitle = { content, style: frameStyle };
                } else if (presClass === 'outline') {
                    framesByClass.outline = { content, style: frameStyle };
                }
            }
        }

        // Convert to slide format
        const slide = convertOdpToSlide(framesByClass, i);
        console.log(`Slide ${i+1}:`, slide);
        slides.push(slide);
    }

    return slides;
}

// Convert ODP frames to slide based on presentation:class
function convertOdpToSlide(framesByClass, index) {
    const { title, subtitle, outline } = framesByClass;

    // Determine slide type based on which frame classes are present
    if (title.content && subtitle.content) {
        // Title + Subtitle slide
        return {
            id: `slide-${Date.now()}-${index}`,
            type: 'title-subtitle',
            title: title.content,
            subtitle: subtitle.content,
            content: '',
            styles: {
                title: title.style,
                subtitle: subtitle.style
            }
        };
    } else if (title.content && outline.content) {
        // Title + Content slide
        return {
            id: `slide-${Date.now()}-${index}`,
            type: 'title-content',
            title: title.content,
            subtitle: '',
            content: outline.content,
            styles: {
                title: title.style,
                content: outline.style
            }
        };
    } else if (outline.content) {
        // Content only slide
        return {
            id: `slide-${Date.now()}-${index}`,
            type: 'content',
            title: '',
            subtitle: '',
            content: outline.content,
            styles: {
                content: outline.style
            }
        };
    } else if (title.content) {
        // Title only slide
        return {
            id: `slide-${Date.now()}-${index}`,
            type: 'title',
            title: title.content,
            subtitle: '',
            content: '',
            styles: {
                title: title.style
            }
        };
    } else {
        // Empty slide
        return {
            id: `slide-${Date.now()}-${index}`,
            type: 'content',
            title: '',
            subtitle: '',
            content: '',
            styles: {}
        };
    }
}

// Add new slide
function addSlide() {
    // Use the type of the current slide, or default to 'title'
    const currentSlideType = state.currentSlideIndex >= 0 && state.slides[state.currentSlideIndex]
        ? state.slides[state.currentSlideIndex].type
        : 'title';

    const newSlide = {
        id: `slide-${Date.now()}`,
        type: currentSlideType,
        title: 'New Slide',
        subtitle: '',
        content: '',
        styles: {}
    };

    // Insert after current slide, or at end if no slide is selected
    const insertIndex = state.currentSlideIndex >= 0 ? state.currentSlideIndex + 1 : state.slides.length;
    state.slides.splice(insertIndex, 0, newSlide);
    state.currentSlideIndex = insertIndex;

    markUnsavedChanges();
    updateUI();
    displaySlide(state.currentSlideIndex);
    notifyParent();
}

// Delete current slide
function deleteCurrentSlide() {
    if (state.currentSlideIndex < 0 || state.slides.length === 0) return;
    if (!confirm('Delete this slide?')) return;

    state.slides.splice(state.currentSlideIndex, 1);
    markUnsavedChanges();

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
    notifyParent();
}

// Update current slide (auto-save)
function updateCurrentSlide() {
    if (state.currentSlideIndex < 0) return;

    const slide = state.slides[state.currentSlideIndex];
    slide.type = slideTypeSelect.value;
    slide.title = slideTitleInput.value;
    slide.subtitle = slideSubtitleInput.value;
    slide.content = slideContentInput.value;

    markUnsavedChanges();

    // Update preview only (don't call displaySlide to avoid infinite loop)
    updatePreview();
    updateSlidesList();

    // Notify parent of changes
    notifyParent();
}

// Handle slide type change
function handleSlideTypeChange() {
    updateFieldVisibility();
    updateCurrentSlide();
}

// Display slide in editor
function displaySlide(index) {
    if (index < 0 || index >= state.slides.length) return;

    state.currentSlideIndex = index;
    const slide = state.slides[index];

    // Update form inputs (remove event listeners temporarily)
    slideTitleInput.removeEventListener('input', updateCurrentSlide);
    slideSubtitleInput.removeEventListener('input', updateCurrentSlide);
    slideContentInput.removeEventListener('input', updateCurrentSlide);
    slideTypeSelect.removeEventListener('change', handleSlideTypeChange);

    slideTypeSelect.value = slide.type;
    slideTitleInput.value = slide.title;
    slideSubtitleInput.value = slide.subtitle;
    slideContentInput.value = slide.content;

    // Re-add event listeners
    slideTitleInput.addEventListener('input', updateCurrentSlide);
    slideSubtitleInput.addEventListener('input', updateCurrentSlide);
    slideContentInput.addEventListener('input', updateCurrentSlide);
    slideTypeSelect.addEventListener('change', handleSlideTypeChange);

    // Update visibility
    updateFieldVisibility();

    // Update preview
    updatePreview();
    currentSlideNumber.textContent = index + 1;

    // Notify parent of slide change
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'slide-changed',
            slideIndex: index
        }, '*');
    }

    updateSlidesList();
}

// Update field visibility based on slide type
function updateFieldVisibility() {
    const type = slideTypeSelect.value;

    if (type === 'title') {
        titleGroup.style.display = 'block';
        subtitleGroup.style.display = 'none';
        contentGroup.style.display = 'none';
    } else if (type === 'title-subtitle') {
        titleGroup.style.display = 'block';
        subtitleGroup.style.display = 'block';
        contentGroup.style.display = 'none';
    } else if (type === 'title-content') {
        titleGroup.style.display = 'block';
        subtitleGroup.style.display = 'none';
        contentGroup.style.display = 'block';
    } else if (type === 'content') {
        titleGroup.style.display = 'none';
        subtitleGroup.style.display = 'none';
        contentGroup.style.display = 'block';
    }
}

// Update preview
function updatePreview() {
    if (state.currentSlideIndex < 0) return;

    const slide = state.slides[state.currentSlideIndex];
    let previewHtml = '';

    if (slide.type === 'title') {
        const titleStyle = buildStyleString(slide.styles?.title);
        previewHtml = `<div class="slide-preview"><div class="title-slide"><h1 style="${titleStyle}">${escapeHtmlWithBreaks(slide.title)}</h1></div></div>`;
    } else if (slide.type === 'title-subtitle') {
        const titleStyle = buildStyleString(slide.styles?.title);
        const subtitleStyle = buildStyleString(slide.styles?.subtitle);
        previewHtml = `<div class="slide-preview"><div class="title-subtitle-slide"><h1 style="${titleStyle}">${escapeHtmlWithBreaks(slide.title)}</h1><h2 style="${subtitleStyle}">${escapeHtmlWithBreaks(slide.subtitle)}</h2></div></div>`;
    } else if (slide.type === 'title-content') {
        const titleStyle = buildStyleString(slide.styles?.title);
        const contentStyle = buildStyleString(slide.styles?.content);
        previewHtml = `<div class="slide-preview"><div class="title-content-slide"><h2 style="${titleStyle}">${escapeHtmlWithBreaks(slide.title)}</h2><p style="${contentStyle}">${escapeHtmlWithBreaks(slide.content)}</p></div></div>`;
    } else if (slide.type === 'content') {
        const contentStyle = buildStyleString(slide.styles?.content);
        previewHtml = `<div class="slide-preview"><p style="${contentStyle}">${escapeHtmlWithBreaks(slide.content)}</p></div>`;
    }

    console.log('Preview HTML:', previewHtml);
    slideEditor.innerHTML = previewHtml;
}

// Build inline style string from style object
function buildStyleString(styleObj) {
    if (!styleObj) return '';

    const parts = [];

    if (styleObj.fontName) {
        parts.push(`font-family: '${styleObj.fontName}', sans-serif`);
    }
    if (styleObj.fontSize) {
        parts.push(`font-size: ${styleObj.fontSize}`);
    }
    if (styleObj.fontWeight) {
        parts.push(`font-weight: ${styleObj.fontWeight}`);
    }
    if (styleObj.color) {
        parts.push(`color: ${styleObj.color}`);
    }
    if (styleObj.textAlign) {
        parts.push(`text-align: ${styleObj.textAlign}`);
    }

    const result = parts.join('; ');
    console.log('buildStyleString:', styleObj, '->', result);
    return result;
}

// Update slides list
function updateSlidesList() {
    slidesList.innerHTML = '';

    state.slides.forEach((slide, index) => {
        const item = document.createElement('div');
        item.className = 'slide-item';
        item.draggable = true;
        item.dataset.index = index;

        if (index === state.currentSlideIndex) {
            item.classList.add('active');
        }

        const typeLabel = slide.type === 'title' ? 'Title' :
                         slide.type === 'title-subtitle' ? 'Title+Subtitle' :
                         slide.type === 'title-content' ? 'Title+Content' :
                         'Content';

        let preview = '';
        if (slide.type === 'title' || slide.type === 'title-subtitle' || slide.type === 'title-content') {
            preview = slide.title.substring(0, 50) + (slide.title.length > 50 ? '...' : '');
        } else {
            preview = slide.content.substring(0, 50) + (slide.content.length > 50 ? '...' : '');
        }

        item.innerHTML = `
            <div class="slide-item-number">Slide ${index + 1}</div>
            <div class="slide-item-type">${typeLabel}</div>
            <div class="slide-item-preview">${escapeHtml(preview)}</div>
        `;

        item.addEventListener('click', () => displaySlide(index));

        // Drag and drop events
        item.addEventListener('dragstart', handleDragStart);
        item.addEventListener('dragover', handleDragOver);
        item.addEventListener('drop', handleDrop);
        item.addEventListener('dragend', handleDragEnd);

        slidesList.appendChild(item);
    });
}

// Drag and drop handlers
let draggedIndex = null;

function handleDragStart(e) {
    draggedIndex = parseInt(e.currentTarget.dataset.index);
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

    const dropIndex = parseInt(e.currentTarget.dataset.index);

    if (draggedIndex !== null && draggedIndex !== dropIndex) {
        // Remove the dragged slide
        const [draggedSlide] = state.slides.splice(draggedIndex, 1);

        // Insert at new position
        state.slides.splice(dropIndex, 0, draggedSlide);

        // Update current slide index if needed
        if (state.currentSlideIndex === draggedIndex) {
            state.currentSlideIndex = dropIndex;
        } else if (draggedIndex < state.currentSlideIndex && dropIndex >= state.currentSlideIndex) {
            state.currentSlideIndex--;
        } else if (draggedIndex > state.currentSlideIndex && dropIndex <= state.currentSlideIndex) {
            state.currentSlideIndex++;
        }

        updateUI();
        notifyParent();
    }

    return false;
}

function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    draggedIndex = null;
}

// Update UI
function updateUI() {
    slideCounter.textContent = `${state.slides.length} slide${state.slides.length !== 1 ? 's' : ''}`;
    updateSlidesList();

    const hasSlides = state.slides.length > 0;
    deleteSlideBtn.disabled = !hasSlides;

    // Show/hide slide properties and editor based on whether slides exist
    if (hasSlides) {
        slideProperties.style.display = 'block';
        if (state.currentSlideIndex >= 0) {
            displaySlide(state.currentSlideIndex);
        }
    } else {
        slideProperties.style.display = 'none';
        currentSlideNumber.textContent = '-';
        slideEditor.innerHTML = '<div class="empty-state"><p>Create a new presentation or load an ODP file to get started</p></div>';
    }
}

// Enable editing
function enableEditing() {
    saveProjectBtn.disabled = false;
    addSlideBtn.disabled = false;
    slideTypeSelect.disabled = false;
    slideTitleInput.disabled = false;
    slideSubtitleInput.disabled = false;
    slideContentInput.disabled = false;
}

// Save as Project (JSON)
function saveAsProject() {
    if (state.slides.length === 0) {
        alert('No slides to save');
        return;
    }

    const defaultFilename = state.presentation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
    const filename = prompt('Enter filename (without extension):', defaultFilename);

    if (!filename) return; // User cancelled

    const projectData = {
        version: 1,
        presentation: state.presentation,
        slides: state.slides
    };

    const json = JSON.stringify(projectData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.json';
    a.click();
    URL.revokeObjectURL(url);

    state.fileName = filename + '.json';
    updateFileNameDisplay();
    clearUnsavedChanges();
}

// Handle Project file upload
async function handleProjectUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const projectData = JSON.parse(text);

        if (!projectData.version || !projectData.slides) {
            throw new Error('Invalid project file format');
        }

        state.presentation = projectData.presentation || { title: 'Presentation' };
        state.slides = projectData.slides;
        state.currentSlideIndex = state.slides.length > 0 ? 0 : -1;

        enableEditing();
        updateUI();
        if (state.currentSlideIndex >= 0) {
            displaySlide(state.currentSlideIndex);
        }

        notifyParent();
        // Project loaded successfully - no alert needed
        state.fileName = file.name;
        updateFileNameDisplay();
        clearUnsavedChanges();
    } catch (error) {
        console.error('Error loading project:', error);
        alert('Error loading project file: ' + error.message);
    }

    projectInput.value = '';
}

// Save as HTML (Reveal.js)
function saveAsHtml() {
    if (state.slides.length === 0) {
        alert('No slides to save');
        return;
    }

    const defaultFilename = state.presentation.title.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation';
    const filename = prompt('Enter filename (without extension):', defaultFilename);

    if (!filename) return; // User cancelled

    const html = generateRevealHtml();
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.html';
    a.click();
    URL.revokeObjectURL(url);
}

// Generate Reveal.js HTML
function generateRevealHtml() {
    let slidesHtml = '';

    state.slides.forEach(slide => {
        slidesHtml += '            <section>\n';

        if (slide.type === 'title') {
            const style = buildStyleString(slide.styles?.title);
            slidesHtml += `                <h1 style="${style}">${escapeHtml(slide.title)}</h1>\n`;
        } else if (slide.type === 'title-subtitle') {
            const titleStyle = buildStyleString(slide.styles?.title);
            const subtitleStyle = buildStyleString(slide.styles?.subtitle);
            slidesHtml += `                <h1 style="${titleStyle}">${escapeHtml(slide.title)}</h1>\n`;
            slidesHtml += `                <h2 style="${subtitleStyle}">${escapeHtml(slide.subtitle).replace(/\n/g, '<br>')}</h2>\n`;
        } else if (slide.type === 'title-content') {
            const titleStyle = buildStyleString(slide.styles?.title);
            const contentStyle = buildStyleString(slide.styles?.content);
            slidesHtml += `                <h2 style="${titleStyle}">${escapeHtml(slide.title)}</h2>\n`;
            slidesHtml += `                <p style="${contentStyle}">${escapeHtml(slide.content).replace(/\n/g, '<br>')}</p>\n`;
        } else if (slide.type === 'content') {
            const contentStyle = buildStyleString(slide.styles?.content);
            slidesHtml += `                <p style="${contentStyle}">${escapeHtml(slide.content).replace(/\n/g, '<br>')}</p>\n`;
        }

        slidesHtml += '            </section>\n';
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(state.presentation.title)}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/reveal.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/theme/white.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Roboto:wght@100;300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        .reveal {
            background: white;
        }
        .reveal .slides {
            text-align: center;
        }
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
${slidesHtml}
        </div>
    </div>
    <script src="https://cdn.jsdelivr.net/npm/reveal.js@4.6.1/dist/reveal.js"></script>
    <script>
        Reveal.initialize({
            hash: true,
            center: true,
            transition: 'slide'
        });
    </script>
</body>
</html>`;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Escape HTML and convert newlines to <br> tags
function escapeHtmlWithBreaks(text) {
    const escaped = escapeHtml(text);
    return escaped.replace(/\n/g, '<br>');
}

// Notify parent when data changes
function notifyParent() {
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'presentation-changed',
            data: {
                version: 1,
                presentation: state.presentation,
                slides: state.slides
            },
            presentationTitle: state.presentation?.title || null
        }, '*');
    }
}

// Listen for messages from parent
window.addEventListener('message', (event) => {
    if (event.data.type === 'load-data') {
        const data = event.data.data;
        const metadata = event.data.metadata;
        state.presentation = data.presentation || { title: 'Presentation' };
        state.slides = data.slides || [];
        state.currentSlideIndex = state.slides.length > 0 ? 0 : -1;

        // Update fileName from metadata if available
        if (metadata && metadata.fileName) {
            state.fileName = metadata.fileName;
            updateFileNameDisplay();
        }

        enableEditing();
        updateUI();
        if (state.currentSlideIndex >= 0) {
            displaySlide(state.currentSlideIndex);
        }
    } else if (event.data.type === 'goto-slide') {
        if (event.data.slideIndex !== undefined && event.data.slideIndex >= 0 && event.data.slideIndex < state.slides.length) {
            state.currentSlideIndex = event.data.slideIndex;
            displaySlide(state.currentSlideIndex);
        }
    }
});

// Unsaved changes tracking
function markUnsavedChanges() {
    state.hasUnsavedChanges = true;
    if (unsavedIndicator) {
        unsavedIndicator.style.display = 'inline';
    }
}

function clearUnsavedChanges() {
    state.hasUnsavedChanges = false;
    if (unsavedIndicator) {
        unsavedIndicator.style.display = 'none';
    }
}

function updateFileNameDisplay() {
    if (fileNameDisplay) {
        fileNameDisplay.textContent = state.fileName || 'No project loaded';
    }
}

// Notify parent we're ready
window.parent.postMessage({ type: 'presentation-ready' }, '*');

// Initialize
init();
