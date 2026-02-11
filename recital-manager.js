// Application state
const state = {
    recitalName: null,
    recitalFileName: null,
    items: [], // Array of {type: 'supertitles'|'title-slide', data: {...}, name: string}
    hasUnsavedChanges: false
};

// DOM elements
const newRecitalBtn = document.getElementById('new-recital');
const saveRecitalBtn = document.getElementById('save-recital');
const recitalInput = document.getElementById('recital-input');
const addSupertitlesBtn = document.getElementById('add-supertitles');
const supertitlesInput = document.getElementById('supertitles-input');
const addTitleSlideBtn = document.getElementById('add-title-slide');
const exportPresentationBtn = document.getElementById('export-presentation');
const exportPdfBtn = document.getElementById('export-pdf');
const fileNameDisplay = document.getElementById('file-name');
const unsavedIndicator = document.getElementById('unsaved-indicator');
const recitalList = document.getElementById('recital-list');
const titleSlideEditor = document.getElementById('title-slide-editor');
const titleSlideTitleInput = document.getElementById('title-slide-title');
const titleSlideSubtitleInput = document.getElementById('title-slide-subtitle');
const confirmTitleSlideBtn = document.getElementById('confirm-title-slide');
const cancelTitleSlideBtn = document.getElementById('cancel-title-slide');
const emptyState = document.getElementById('empty-state');
const mainContent = document.getElementById('main-content');

// Initialize
function init() {
    setupEventListeners();
    updateUI(); // Initialize UI to show empty state on load
}

// Event listeners
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

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            if (!saveRecitalBtn.disabled) {
                saveRecital();
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

// Create new recital
function createNewRecital() {
    const name = prompt('Enter recital name:');
    if (!name) return;

    state.recitalName = name;
    state.recitalFileName = null;
    state.items = [];
    clearUnsavedChanges();

    enableEditing();
    updateUI();
}

// Handle recital file upload
async function handleRecitalUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const recitalData = JSON.parse(text);

        if (!recitalData.version || !recitalData.items) {
            throw new Error('Invalid recital file format');
        }

        state.recitalName = recitalData.name || file.name.replace('.recital', '');
        state.recitalFileName = file.name.replace('.recital', '');
        state.items = recitalData.items;
        clearUnsavedChanges();

        enableEditing();
        updateUI();

        // Recital loaded successfully - no alert needed
    } catch (error) {
        console.error('Error loading recital:', error);
        alert('Error loading recital: ' + error.message);
    }

    recitalInput.value = '';
}

// Handle supertitles file upload
async function handleSupertitlesUpload(e) {
    const files = e.target.files;
    if (!files.length) return;

    for (const file of files) {
        try {
            const text = await file.text();
            const supertitlesData = JSON.parse(text);

            console.log('Loading supertitles file:', file.name);
            console.log('Version:', supertitlesData.version);
            console.log('Data:', supertitlesData);

            if (!supertitlesData.version) {
                throw new Error('Invalid supertitles set file format (missing version)');
            }

            if (supertitlesData.version === 1) {
                // Old format: annotation data embedded
                if (!supertitlesData.presentation || !supertitlesData.annotation) {
                    throw new Error('Invalid supertitles set file format (v1 missing presentation or annotation)');
                }

                const item = {
                    type: 'supertitles',
                    name: supertitlesData.name || file.name.replace('.supertitles', ''),
                    data: supertitlesData
                };

                state.items.push(item);
                markUnsavedChanges();

            } else if (supertitlesData.version === 2) {
                // New format: embedded data (self-contained)
                if (!supertitlesData.presentation || !supertitlesData.annotation) {
                    throw new Error('Invalid supertitles set file format (v2 missing presentation or annotation)');
                }

                const item = {
                    type: 'supertitles',
                    name: supertitlesData.name || file.name.replace('.supertitles', ''),
                    data: supertitlesData
                };

                state.items.push(item);
                markUnsavedChanges();

            } else {
                throw new Error(`Unsupported supertitles set version: ${supertitlesData.version}`);
            }

        } catch (error) {
            console.error('Error loading supertitles:', error);
            alert(`Error loading ${file.name}: ${error.message}`);
        }
    }

    updateUI();
    supertitlesInput.value = '';
}

// Show title slide editor
function showTitleSlideEditor() {
    titleSlideEditor.style.display = 'block';
    titleSlideTitleInput.value = '';
    titleSlideSubtitleInput.value = '';
    titleSlideTitleInput.focus();
}

// Hide title slide editor
function hideTitleSlideEditor() {
    titleSlideEditor.style.display = 'none';
}

// Confirm add title slide
function confirmAddTitleSlide() {
    const title = titleSlideTitleInput.value.trim();
    if (!title) {
        alert('Please enter a title');
        return;
    }

    const subtitle = titleSlideSubtitleInput.value.trim();

    const item = {
        type: 'title-slide',
        name: title,
        data: {
            title: title,
            subtitle: subtitle
        }
    };

    state.items.push(item);
    state.hasUnsavedChanges = true;
    hideTitleSlideEditor();
    updateUI();
}

// Save recital
function saveRecital() {
    if (!state.recitalName) {
        alert('No recital to save');
        return;
    }

    let filename = state.recitalFileName;
    if (!filename) {
        filename = prompt('Enter filename (without extension):', state.recitalName.replace(/[^a-z0-9]/gi, '_').toLowerCase());
        if (!filename) return;
        state.recitalFileName = filename;
    }

    const recitalData = {
        version: 1,
        name: state.recitalName,
        items: state.items
    };

    const json = JSON.stringify(recitalData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.recital';
    a.click();
    URL.revokeObjectURL(url);

    clearUnsavedChanges();
    updateUI();
}

// Export presentation
function exportPresentation() {
    if (!state.items.length) {
        alert('No items in recital to export');
        return;
    }

    // Combine all slides from all items
    const allSlides = [];
    let slideNumber = 1;

    for (const item of state.items) {
        if (item.type === 'supertitles') {
            // Add all slides from the presentation
            const slides = item.data.presentation.slides || [];
            for (const slide of slides) {
                const numberedSlide = {
                    ...slide,
                    number: slideNumber++
                };
                allSlides.push(numberedSlide);
            }
        } else if (item.type === 'title-slide') {
            // Add the title slide
            const titleSlide = {
                id: `title-slide-${Date.now()}-${slideNumber}`,
                type: 'title-subtitle',
                title: item.data.title,
                subtitle: item.data.subtitle,
                content: '',
                styles: {},
                number: slideNumber++
            };
            allSlides.push(titleSlide);
        }
    }

    // Generate Reveal.js HTML
    const html = generateRevealJsHtml(allSlides);

    // Download the HTML file
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (state.recitalFileName || state.recitalName.replace(/[^a-z0-9]/gi, '_').toLowerCase()) + '.html';
    a.click();
    URL.revokeObjectURL(url);

    alert('Presentation exported successfully!');
}

// Generate Reveal.js HTML
function generateRevealJsHtml(slides) {
    const slideHtmls = slides.map(slide => {
        if (slide.type === 'title' || slide.type === 'title-subtitle') {
            const titleStyle = slide.styles?.title || {};
            const subtitleStyle = slide.styles?.subtitle || {};

            const titleCss = Object.entries(titleStyle).map(([k, v]) => {
                const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${v}`;
            }).join('; ');

            const subtitleCss = Object.entries(subtitleStyle).map(([k, v]) => {
                const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${v}`;
            }).join('; ');

            return `
                <section>
                    <h1 style="${titleCss}">${escapeHtml(slide.title)}</h1>
                    ${slide.subtitle ? `<h2 style="${subtitleCss}">${escapeHtml(slide.subtitle)}</h2>` : ''}
                </section>`;
        } else if (slide.type === 'title-content') {
            const titleStyle = slide.styles?.title || {};
            const contentStyle = slide.styles?.content || {};

            const titleCss = Object.entries(titleStyle).map(([k, v]) => {
                const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${v}`;
            }).join('; ');

            const contentCss = Object.entries(contentStyle).map(([k, v]) => {
                const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${v}`;
            }).join('; ');

            const contentHtml = slide.content.split('\n').map(line => {
                line = line.trim();
                if (!line) return '';
                return `<p>${escapeHtml(line)}</p>`;
            }).join('\n');

            return `
                <section>
                    <h2 style="${titleCss}">${escapeHtml(slide.title)}</h2>
                    <div style="${contentCss}">${contentHtml}</div>
                </section>`;
        } else if (slide.type === 'content') {
            const contentStyle = slide.styles?.content || {};

            const contentCss = Object.entries(contentStyle).map(([k, v]) => {
                const cssKey = k.replace(/([A-Z])/g, '-$1').toLowerCase();
                return `${cssKey}: ${v}`;
            }).join('; ');

            const contentHtml = slide.content.split('\n').map(line => {
                line = line.trim();
                if (!line) return '';
                return `<p>${escapeHtml(line)}</p>`;
            }).join('\n');

            return `
                <section>
                    <div style="${contentCss}">${contentHtml}</div>
                </section>`;
        }
    }).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(state.recitalName)}</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/theme/white.min.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Roboto:wght@100;300;400;500;700;900&display=swap" rel="stylesheet">
    <style>
        .reveal {
            font-family: 'Roboto', sans-serif;
        }
        .reveal h1 {
            font-family: 'Cinzel', serif;
            font-weight: 700;
            text-transform: none;
            color: #000;
        }
        .reveal h2 {
            font-family: 'Roboto', sans-serif;
            text-transform: none;
            color: #000;
        }
        .reveal section {
            color: #000;
            padding-bottom: 100px;
        }
    </style>
</head>
<body>
    <div class="reveal">
        <div class="slides">
${slideHtmls}
        </div>
    </div>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/reveal.js/4.5.0/reveal.min.js"></script>
    <script>
        Reveal.initialize({
            hash: true,
            slideNumber: 'c/t',
            controls: true,
            progress: true,
            center: true,
            transition: 'none'
        });
    </script>
</body>
</html>`;
}

// Helper: Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Update UI
function updateUI() {
    updateFileNameDisplay();
    updateRecitalList();

    // Show/hide empty state based on whether a recital is loaded
    const hasRecital = state.recitalName !== null;
    if (hasRecital) {
        emptyState.style.display = 'none';
        mainContent.style.display = 'grid';
    } else {
        emptyState.style.display = 'flex';
        mainContent.style.display = 'none';
    }
}

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
        if (state.recitalName) {
            fileNameDisplay.textContent = `Recital: ${state.recitalName}`;
        } else {
            fileNameDisplay.textContent = 'No recital loaded';
        }
    }
}

// Update recital list
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

        itemEl.innerHTML = `
            <div class="recital-item-header">
                <span class="recital-item-type">${typeLabel}</span>
                <div class="recital-item-actions">
                    <button class="btn-small btn-remove" data-index="${index}">Remove</button>
                </div>
            </div>
            <div class="recital-item-title">${escapeHtml(title)}</div>
            <div class="recital-item-details">${escapeHtml(details)}</div>
        `;

        // Add drag and drop events
        itemEl.addEventListener('dragstart', handleDragStart);
        itemEl.addEventListener('dragover', handleDragOver);
        itemEl.addEventListener('drop', handleDrop);
        itemEl.addEventListener('dragend', handleDragEnd);

        // Add remove button handler
        const removeBtn = itemEl.querySelector('.btn-remove');
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeItem(index);
        });

        recitalList.appendChild(itemEl);
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
        // Remove the dragged item
        const [draggedItem] = state.items.splice(draggedIndex, 1);

        // Insert at new position
        state.items.splice(dropIndex, 0, draggedItem);

        markUnsavedChanges();
        updateUI();
    }

    return false;
}

function handleDragEnd(e) {
    e.currentTarget.style.opacity = '1';
    draggedIndex = null;
}

// Remove item
function removeItem(index) {
    if (confirm('Remove this item from the recital?')) {
        state.items.splice(index, 1);
        markUnsavedChanges();
        updateUI();
    }
}

// Enable editing
function enableEditing() {
    saveRecitalBtn.disabled = false;
    addSupertitlesBtn.disabled = false;
    addTitleSlideBtn.disabled = false;
    exportPresentationBtn.disabled = false;
    exportPdfBtn.disabled = false;
}

// Export combined PDF with renumbered annotations
async function exportCombinedPdf() {
    if (!state.items.length) {
        alert('No items in recital to export');
        return;
    }

    try {
        const { PDFDocument, rgb, StandardFonts } = PDFLib;

        // Create a new PDF document
        const mergedPdf = await PDFDocument.create();

        let slideNumber = 1;

        for (const item of state.items) {
            if (item.type === 'title-slide') {
                // Create a title slide page
                const page = mergedPdf.addPage([612, 792]); // Letter size
                const { width, height } = page.getSize();

                const titleFont = await mergedPdf.embedFont(StandardFonts.HelveticaBold);
                const subtitleFont = await mergedPdf.embedFont(StandardFonts.Helvetica);
                const numberFont = await mergedPdf.embedFont(StandardFonts.Helvetica);

                // Draw title
                const titleSize = 48;
                const titleWidth = titleFont.widthOfTextAtSize(item.data.title, titleSize);
                page.drawText(item.data.title, {
                    x: (width - titleWidth) / 2,
                    y: height - 250,
                    size: titleSize,
                    font: titleFont,
                    color: rgb(0, 0, 0)
                });

                // Draw subtitle if exists
                if (item.data.subtitle) {
                    const subtitleSize = 24;
                    const subtitleWidth = subtitleFont.widthOfTextAtSize(item.data.subtitle, subtitleSize);
                    page.drawText(item.data.subtitle, {
                        x: (width - subtitleWidth) / 2,
                        y: height - 320,
                        size: subtitleSize,
                        font: subtitleFont,
                        color: rgb(0, 0, 0)
                    });
                }

                // Draw slide number annotation (centered on page)
                const markerSize = 40;
                const markerX = width / 2;
                const markerY = height / 2;

                // Draw number text first to calculate circle size
                const numberText = slideNumber.toString();
                const numberSize = 24;
                const circleSize = markerSize * 0.7; // Tighter circle

                // Draw circle
                page.drawCircle({
                    x: markerX,
                    y: markerY,
                    size: circleSize,
                    borderColor: rgb(1, 0, 0),
                    borderWidth: 3,
                    color: rgb(1, 1, 1),
                    opacity: 0.8
                });

                const numberWidth = numberFont.widthOfTextAtSize(numberText, numberSize);
                page.drawText(numberText, {
                    x: markerX - numberWidth / 2,
                    y: markerY - numberSize / 3,
                    size: numberSize,
                    font: numberFont,
                    color: rgb(0, 0, 0)
                });

                slideNumber++;

            } else if (item.type === 'supertitles') {
                // Get the PDF data and annotations
                const pdfData = item.data.annotation.pdf;
                const annotations = item.data.annotation.annotations || [];
                const slides = item.data.presentation.slides || [];
                const deletedPages = item.data.annotation.settings?.deletedPages || [];

                console.log(`\n========================================`);
                console.log(`Processing supertitles set: ${item.name}`);
                console.log(`Annotations count: ${annotations.length}`);
                console.log(`Slides count: ${slides.length}`);
                console.log(`Deleted pages:`, deletedPages);
                console.log(`Starting slide number: ${slideNumber}`);
                console.log(`All annotations:`, annotations);

                if (!pdfData) {
                    console.warn(`No PDF data for supertitles set: ${item.name}`);
                    continue;
                }

                // Load the source PDF (this should be the ORIGINAL unannotated PDF)
                const pdfBytes = base64ToArrayBuffer(pdfData);
                const sourcePdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

                // Sort annotations by position (top to bottom, left to right)
                const sortedAnnotations = [...annotations].sort((a, b) => {
                    // Sort by page first
                    if (a.page !== b.page) return a.page - b.page;
                    // Then by y (top to bottom)
                    // In normalized coords: y=0 is top, y=1 is bottom
                    // So smaller y value = higher on page
                    if (Math.abs(a.y - b.y) > 0.02) return a.y - b.y;
                    // Then by x (left to right)
                    return a.x - b.x;
                });

                // Number annotations sequentially based on sorted order
                // Skip annotations on deleted pages
                let currentNumber = slideNumber;
                console.log(`\nNumbering annotations starting from ${slideNumber}:`);

                // Copy pages and add renumbered annotations
                const pages = sourcePdf.getPages();
                const markerSize = item.data.annotation.settings?.markerSize || 40;

                const numberFont = await mergedPdf.embedFont(StandardFonts.Helvetica);

                for (let i = 0; i < pages.length; i++) {
                    const pageNum = i + 1;

                    // Skip deleted pages
                    if (deletedPages.includes(pageNum)) {
                        console.log(`Skipping deleted page ${pageNum}`);
                        continue;
                    }

                    // Copy the page
                    const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [i]);
                    mergedPdf.addPage(copiedPage);

                    const { width, height } = copiedPage.getSize();

                    // Find annotations for this page (excluding deleted pages)
                    const pageAnnotations = sortedAnnotations.filter(ann => {
                        return ann.page === pageNum && !deletedPages.includes(ann.page);
                    });

                    // Draw annotations with sequential numbers
                    console.log(`\nDrawing ${pageAnnotations.length} annotations on page ${pageNum}:`);
                    for (const ann of pageAnnotations) {
                        console.log(`  Drawing annotation ${ann.id} as number ${currentNumber} at (${ann.x}, ${ann.y})`);

                        // Convert from normalized coordinates (0-1) to PDF coordinates
                        // Annotations are stored as: x = (clickX - rect.left) / rect.width
                        // So x,y are in range 0-1
                        // PDF: (0,0) at bottom-left, y increases upward
                        const pdfX = ann.x * width;
                        const pdfY = height - (ann.y * height);

                        // Draw circle (tighter around the number)
                        const numberText = currentNumber.toString();
                        const numberSize = markerSize * 0.6;
                        const circleSize = markerSize * 0.7; // Reduced from full markerSize

                        copiedPage.drawCircle({
                            x: pdfX,
                            y: pdfY,
                            size: circleSize,
                            borderColor: rgb(1, 0, 0),
                            borderWidth: 3,
                            color: rgb(1, 1, 1),
                            opacity: 0.8
                        });

                        const numberWidth = numberFont.widthOfTextAtSize(numberText, numberSize);
                        copiedPage.drawText(numberText, {
                            x: pdfX - numberWidth / 2,
                            y: pdfY - numberSize / 3,
                            size: numberSize,
                            font: numberFont,
                            color: rgb(0, 0, 0)
                        });

                        currentNumber++;
                    }
                }

                // Set slide number to the next number after all annotations
                // currentNumber already has the correct value from the mapping loop
                console.log(`\nFinished processing set. Setting slideNumber from ${slideNumber} to ${currentNumber}`);
                slideNumber = currentNumber;
                console.log(`========================================\n`);
            }
        }

        // Save and download the merged PDF
        const pdfBytes = await mergedPdf.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (state.recitalFileName || state.recitalName.replace(/[^a-z0-9]/gi, '_').toLowerCase()) + '_annotated.pdf';
        a.click();
        URL.revokeObjectURL(url);

        alert('Combined PDF exported successfully!');

    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error exporting PDF: ' + error.message);
    }
}

// Helper: Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Initialize
init();
