// PDF.js configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// Application state
const state = {
    pdfDoc: null,
    pdfData: null,
    originalPdfFile: null,
    currentPage: 1,
    totalPages: 0,
    scale: 1.5,
    annotations: [],
    annotationCounter: 1,
    annotationPrefix: 'SLIDE',
    dragging: null,
    dragOffset: { x: 0, y: 0 },
    wasDragging: false,
    markerSize: 40, // Default marker size in pixels
    deletedPages: [] // Track deleted page numbers
};

// DOM elements
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
const zoomLevel = document.getElementById('zoom-level');
const dropZone = document.getElementById('drop-zone');
const canvasWrapper = document.getElementById('canvas-wrapper');
const markerSizeIncrease = document.getElementById('marker-size-increase');
const markerSizeDecrease = document.getElementById('marker-size-decrease');
const markerSizeDisplay = document.getElementById('marker-size-display');
const deletePageBtn = document.getElementById('delete-page');

// Initialize
function init() {
    setupEventListeners();
}

// Event listeners
function setupEventListeners() {
    pdfUpload.addEventListener('change', handlePdfUpload);
    annotationsUpload.addEventListener('change', handleAnnotationsUpload);
    saveAnnotationsBtn.addEventListener('click', saveAnnotations);
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
    zoomInBtn.addEventListener('click', () => zoom(0.1));
    zoomOutBtn.addEventListener('click', () => zoom(-0.1));
    canvasWrapper.addEventListener('click', handleCanvasClick);
    markerSizeIncrease.addEventListener('click', () => adjustMarkerSize(5));
    markerSizeDecrease.addEventListener('click', () => adjustMarkerSize(-5));
    deletePageBtn.addEventListener('click', deleteCurrentPage);

    // Keyboard navigation
    document.addEventListener('keydown', handleKeyPress);

    // Drag and drop for PDF files
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

    // Mouse move and up for dragging annotations
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Load PDF
async function handlePdfUpload(e) {
    const file = e.target.files[0];
    if (file) {
        await loadPdf(file, true);
    }
}

async function loadPdf(file, clearState = true) {
    try {
        // Store the original file
        state.originalPdfFile = file;

        const arrayBuffer = await file.arrayBuffer();

        // Convert to base64 FIRST before the ArrayBuffer gets detached
        const base64Pdf = arrayBufferToBase64(arrayBuffer);
        state.pdfData = base64Pdf;

        const pdfBytes = new Uint8Array(arrayBuffer);

        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        state.pdfDoc = await loadingTask.promise;
        state.totalPages = state.pdfDoc.numPages;

        // Clear annotations and deleted pages when loading new PDF (but not when loading from project)
        if (clearState) {
            state.annotations = [];
            state.deletedPages = [];
            state.currentPage = 1;
        } else {
            // When loading from project, set to first active page
            const activePages = getActivePages();
            state.currentPage = activePages.length > 0 ? activePages[0] : 1;
        }

        updateAnnotationCounter();

        dropZone.classList.add('hidden');
        await renderPage(state.currentPage);
        updatePageControls();

        saveAnnotationsBtn.disabled = false;
        deletePageBtn.disabled = false;

        // Notify parent after loading
        notifyParent();
    } catch (error) {
        console.error('Error loading PDF:', error);
        alert('Error loading PDF. Please try another file.');
    }
}

// Render PDF page
async function renderPage(pageNum) {
    try {
        const page = await state.pdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: state.scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        annotationsLayer.style.width = viewport.width + 'px';
        annotationsLayer.style.height = viewport.height + 'px';

        const renderContext = {
            canvasContext: ctx,
            viewport: viewport
        };

        await page.render(renderContext).promise;
        renderAnnotations();
    } catch (error) {
        console.error('Error rendering page:', error);
    }
}

// Keyboard navigation
// Track if we're already rendering a page navigation
let isNavigating = false;
let pendingNavigation = null;

async function handleKeyPress(e) {
    // Only handle arrow keys if not typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
    }

    let delta = 0;
    switch(e.key) {
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

    // If currently navigating, store the pending navigation
    if (isNavigating) {
        pendingNavigation = delta;
        return;
    }

    // Navigate immediately
    isNavigating = true;
    await changePage(delta);
    isNavigating = false;

    // If there was a pending navigation, execute it
    if (pendingNavigation !== null) {
        const pending = pendingNavigation;
        pendingNavigation = null;
        isNavigating = true;
        await changePage(pending);
        isNavigating = false;
    }
}

// Page navigation
async function changePage(delta) {
    const activePages = getActivePages();
    const currentIndex = activePages.indexOf(state.currentPage);
    const newIndex = currentIndex + delta;

    if (newIndex >= 0 && newIndex < activePages.length) {
        state.currentPage = activePages[newIndex];
        await renderPage(state.currentPage);
        updatePageControls();
    }
}

function updatePageControls() {
    const activePage = getActivePage(state.currentPage);
    const activePages = getActivePages();
    pageInfo.textContent = `Page ${activePage} of ${activePages.length}`;
    prevPageBtn.disabled = state.currentPage === 1;
    nextPageBtn.disabled = state.currentPage === state.totalPages;
    deletePageBtn.disabled = activePages.length <= 1; // Can't delete last page
}

// Get active (non-deleted) pages
function getActivePages() {
    const pages = [];
    for (let i = 1; i <= state.totalPages; i++) {
        if (!state.deletedPages.includes(i)) {
            pages.push(i);
        }
    }
    return pages;
}

// Get the display page number (excluding deleted pages)
function getActivePage(pageNum) {
    const activePages = getActivePages();
    return activePages.indexOf(pageNum) + 1;
}

// Delete current page
function deleteCurrentPage() {
    const activePages = getActivePages();
    if (activePages.length <= 1) {
        alert('Cannot delete the last page.');
        return;
    }

    if (!confirm(`Delete page ${getActivePage(state.currentPage)}? This will also remove all annotations on this page.`)) {
        return;
    }

    // Mark page as deleted
    state.deletedPages.push(state.currentPage);
    state.deletedPages.sort((a, b) => a - b);

    // Remove annotations for this page
    state.annotations = state.annotations.filter(a => a.page !== state.currentPage);

    // Navigate to next available page
    const currentIndex = activePages.indexOf(state.currentPage);
    const remainingPages = getActivePages();

    if (remainingPages.length > 0) {
        // Go to the next page if available, otherwise previous
        if (currentIndex < remainingPages.length) {
            state.currentPage = remainingPages[currentIndex];
        } else {
            state.currentPage = remainingPages[currentIndex - 1];
        }
    }

    renderPage(state.currentPage);
    updatePageControls();
}

// Delete page (for continuous view)
function deletePage(pageNum) {
    const activePages = getActivePages();
    if (activePages.length <= 1) {
        alert('Cannot delete the last page.');
        return;
    }

    if (!confirm(`Delete page ${getActivePage(pageNum)}? This will also remove all annotations on this page.`)) {
        return;
    }

    // Mark page as deleted
    state.deletedPages.push(pageNum);
    state.deletedPages.sort((a, b) => a - b);

    // Remove annotations for this page
    state.annotations = state.annotations.filter(a => a.page !== pageNum);

    // Update display
    renderPage(state.currentPage);
}

// Zoom
function zoom(delta) {
    state.scale = Math.max(0.5, Math.min(3, state.scale + delta));
    zoomLevel.textContent = Math.round(state.scale * 100) + '%';
    renderPage(state.currentPage);
}

// Adjust marker size
function adjustMarkerSize(delta) {
    state.markerSize = Math.max(20, Math.min(100, state.markerSize + delta));
    markerSizeDisplay.textContent = state.markerSize + 'px';
    renderAnnotations();
}


// Handle canvas click to add annotation
function handleCanvasClick(e) {
    if (!state.pdfDoc) return;

    // Don't add annotation if we just finished dragging
    if (state.wasDragging) {
        state.wasDragging = false;
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    const annotationId = `${state.annotationPrefix}-${String(state.annotationCounter).padStart(3, '0')}`;

    const annotation = {
        id: annotationId,
        page: state.currentPage,
        x: x,
        y: y
    };

    state.annotations.push(annotation);
    state.annotationCounter++;
    notifyParent();

    renderAnnotations();
}

// Handle mouse move for dragging
function handleMouseMove(e) {
    if (!state.dragging) return;

    // Mark that we're actively dragging
    state.wasDragging = true;

    // Find the marker element
    if (!annotationsLayer) return;
    const marker = annotationsLayer.querySelector(`[data-annotation-id="${state.dragging.id}"]`);
    if (!marker) return;

    // Get the canvas rectangle
    const rect = canvas.getBoundingClientRect();

    // Calculate new position relative to canvas
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    // Clamp to canvas bounds
    const clampedX = Math.max(0, Math.min(rect.width, canvasX));
    const clampedY = Math.max(0, Math.min(rect.height, canvasY));

    // Convert to normalized coordinates (0-1)
    const x = clampedX / rect.width;
    const y = clampedY / rect.height;

    // Update the annotation position
    state.dragging.x = x;
    state.dragging.y = y;

    // Update the marker position in real-time
    marker.style.left = (x * rect.width) + 'px';
    marker.style.top = (y * rect.height) + 'px';
}

// Handle mouse up to finish dragging
function handleMouseUp(e) {
    if (state.dragging) {
        // Find marker in current view
        const marker = annotationsLayer.querySelector(`[data-annotation-id="${state.dragging.id}"]`);
        if (marker) {
            marker.classList.remove('dragging');
        }

        state.dragging = null;
        canvasWrapper.style.cursor = 'crosshair';

        // Update the annotations list in case page order changed
        // Reset wasDragging flag after a short delay to allow click event to process
        setTimeout(() => {
            state.wasDragging = false;
        }, 50);
    }
}

// Render annotations on current page
function renderAnnotations() {
    annotationsLayer.innerHTML = '';

    const pageAnnotations = state.annotations.filter(a => a.page === state.currentPage);

    pageAnnotations.forEach(annotation => {
        const marker = createAnnotationMarker(annotation);
        annotationsLayer.appendChild(marker);
    });
}

// Create visual annotation marker
function createAnnotationMarker(annotation, targetCanvas = null) {
    const canvasEl = targetCanvas || canvas;
    const marker = document.createElement('div');
    marker.className = 'annotation-marker';
    marker.style.width = state.markerSize + 'px';
    marker.style.height = state.markerSize + 'px';
    marker.style.left = (annotation.x * canvasEl.width) + 'px';
    marker.style.top = (annotation.y * canvasEl.height) + 'px';
    marker.dataset.annotationId = annotation.id;
    marker.dataset.pageNum = annotation.page;

    // Red asterisk SVG (no label)
    marker.innerHTML = `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path d="M50 0 L50 100 M0 50 L100 50 M15 15 L85 85 M85 15 L15 85"
                  stroke="#dc3545"
                  stroke-width="12"
                  stroke-linecap="round"/>
            <circle cx="50" cy="50" r="8" fill="#dc3545"/>
        </svg>
    `;

    // Handle drag start
    marker.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();

        // Start dragging
        state.dragging = annotation;

        const rect = canvas.getBoundingClientRect();
        const markerRect = marker.getBoundingClientRect();

        // Calculate offset from marker center
        state.dragOffset = {
            x: e.clientX - markerRect.left - markerRect.width / 2,
            y: e.clientY - markerRect.top - markerRect.height / 2
        };

        marker.classList.add('dragging');
        if (state.viewMode === 'paginated') {
            canvasWrapper.style.cursor = 'grabbing';
        }
    });

    // Handle right-click for delete
    marker.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Delete annotation "${annotation.id}"?`)) {
            deleteAnnotation(annotation.id);
        }
    });

    return marker;
}

// Delete annotation
function deleteAnnotation(id) {
    state.annotations = state.annotations.filter(a => a.id !== id);
    renderAnnotations();
    notifyParent();
}


// Update annotation counter based on existing annotations
function updateAnnotationCounter() {
    if (state.annotations.length === 0) {
        state.annotationCounter = 1;
    } else {
        // Find the highest number used with current prefix
        const numbers = state.annotations
            .filter(a => a.id.startsWith(state.annotationPrefix + '-'))
            .map(a => {
                const match = a.id.match(/-(\d+)$/);
                return match ? parseInt(match[1]) : 0;
            });

        state.annotationCounter = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
    }
}

// Save project file (PDF + annotations bundled together)
async function saveAnnotations() {
    if (!state.originalPdfFile) {
        alert('Please load a PDF first');
        return;
    }

    try {
        // Create project data
        const projectData = {
            version: '1.0',
            annotationPrefix: state.annotationPrefix,
            annotations: state.annotations,
            markerSize: state.markerSize,
            scale: state.scale,
            viewMode: state.viewMode,
            deletedPages: state.deletedPages,
            metadata: {
                totalPages: state.totalPages,
                pdfFileName: state.originalPdfFile.name,
                createdAt: new Date().toISOString(),
                modifiedAt: new Date().toISOString()
            }
        };

        // Read PDF as base64
        const pdfArrayBuffer = await state.originalPdfFile.arrayBuffer();
        const pdfBase64 = arrayBufferToBase64(pdfArrayBuffer);

        // Combine everything into one project file
        const projectFile = {
            ...projectData,
            pdfData: pdfBase64
        };

        // Prompt user for filename
        const defaultName = state.originalPdfFile.name.replace('.pdf', '') + '-project';
        const fileName = prompt('Enter project file name:', defaultName);

        if (!fileName) {
            return; // User cancelled
        }

        const blob = new Blob([JSON.stringify(projectFile)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.json') ? fileName : fileName + '.json';
        a.click();
        URL.revokeObjectURL(url);

        alert('Project saved successfully!');
    } catch (error) {
        console.error('Error saving project:', error);
        alert('Error saving project. Please try again.');
    }
}

// Helper function to convert ArrayBuffer to base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Helper function to convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

// Load project file (PDF + annotations)
async function handleAnnotationsUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Check if this is a project file with embedded PDF
        // Support both 'pdf' and 'pdfData' field names
        const pdfData = data.pdf || data.pdfData;
        if (pdfData && data.annotations && Array.isArray(data.annotations)) {
            // Restore deleted pages first (before loading PDF)
            const deletedPages = data.settings?.deletedPages || data.deletedPages;
            if (deletedPages && Array.isArray(deletedPages)) {
                state.deletedPages = deletedPages;
            }

            // Load the PDF from the project file (don't clear state)
            const pdfArrayBuffer = base64ToArrayBuffer(pdfData);
            const pdfBlob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
            const pdfFile = new File([pdfBlob], data.metadata?.pdfFileName || 'document.pdf', { type: 'application/pdf' });

            await loadPdf(pdfFile, false);

            // Hide drop zone
            dropZone.classList.add('hidden');

            // Load the annotations
            state.annotations = data.annotations;
            if (data.annotationPrefix) {
                state.annotationPrefix = data.annotationPrefix;
            }

            // Restore marker size if saved (check both locations)
            const markerSize = data.settings?.markerSize || data.markerSize;
            if (markerSize) {
                state.markerSize = markerSize;
                markerSizeDisplay.textContent = state.markerSize + 'px';
            }

            // Restore zoom scale if saved (check both locations)
            const zoom = data.settings?.zoom || data.scale;
            if (zoom) {
                state.scale = zoom;
                zoomLevel.textContent = Math.round(state.scale * 100) + '%';
            }

            // Render paginated view
            await renderPage(state.currentPage);
            renderAnnotations();

            updateAnnotationCounter();

            notifyParent();

            const activePages = getActivePages();
            alert(`Project loaded successfully! ${state.annotations.length} annotations on ${activePages.length} pages.`);
        }
        // Fallback: old format with just annotations
        else if (data.annotations && Array.isArray(data.annotations)) {
            if (!state.pdfDoc) {
                alert('Please load a PDF first, or use a project file that includes the PDF.');
                return;
            }

            state.annotations = data.annotations;
            if (data.annotationPrefix) {
                state.annotationPrefix = data.annotationPrefix;
            }

            // Restore marker size if saved
            if (data.markerSize) {
                state.markerSize = data.markerSize;
                markerSizeDisplay.textContent = state.markerSize + 'px';
            }

            // Restore zoom scale if saved
            if (data.scale) {
                state.scale = data.scale;
                zoomLevel.textContent = Math.round(state.scale * 100) + '%';
            }

            // Restore deleted pages if saved
            if (data.deletedPages && Array.isArray(data.deletedPages)) {
                state.deletedPages = data.deletedPages;
            }

            // Render paginated view
            await renderPage(state.currentPage);
            renderAnnotations();

            updateAnnotationCounter();

            const activePages = getActivePages();
            alert(`Loaded ${state.annotations.length} annotations on ${activePages.length} pages successfully!`);
        } else {
            throw new Error('Invalid project file format');
        }
    } catch (error) {
        console.error('Error loading project:', error);
        alert('Error loading project file. Please check the file format.');
    }
}

// Export PDF with annotations rendered
async function exportAnnotatedPdf() {
    if (!state.pdfDoc) {
        alert('Please load a PDF first');
        return;
    }

    try {
        // Load pdf-lib if not already loaded
        if (typeof PDFLib === 'undefined') {
            const pdfLibScript = document.createElement('script');
            pdfLibScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';

            await new Promise((resolve, reject) => {
                pdfLibScript.onload = resolve;
                pdfLibScript.onerror = reject;
                document.head.appendChild(pdfLibScript);
            });
        }

        const { PDFDocument, rgb } = PDFLib;

        // Get the PDF data
        let arrayBuffer;
        if (state.originalPdfFile && state.originalPdfFile.arrayBuffer) {
            // Real file object
            arrayBuffer = await state.originalPdfFile.arrayBuffer();
        } else if (state.pdfData) {
            // Base64 data (when loaded from saved project)
            const binaryString = atob(state.pdfData);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            arrayBuffer = bytes.buffer;
        } else {
            throw new Error('No PDF data available');
        }

        // Load the original PDF
        const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pages = pdfDoc.getPages();

        // Add annotations to each page BEFORE removing pages
        for (let pageNum = 1; pageNum <= state.totalPages; pageNum++) {
            // Skip deleted pages - don't add annotations to them
            if (state.deletedPages.includes(pageNum)) {
                continue;
            }

            const pageAnnotations = state.annotations.filter(a => a.page === pageNum);

            if (pageAnnotations.length > 0) {
                const page = pages[pageNum - 1];
                const { width, height } = page.getSize();

                pageAnnotations.forEach(annotation => {
                    // Calculate position (PDF coordinates start from bottom-left)
                    const x = annotation.x * width;
                    const y = height - (annotation.y * height);

                    // Draw red asterisk using current marker size
                    // Convert screen pixels to PDF points by scaling relative to canvas
                    const canvasWidth = canvas.width / state.scale;
                    const scaleFactor = width / canvasWidth;
                    const size = (state.markerSize / 2) * scaleFactor; // Half marker size for radius
                    const color = rgb(0.86, 0.21, 0.27); // Red color
                    const thickness = Math.max(1, size / 5); // Scale line thickness

                    // Draw lines forming asterisk
                    page.drawLine({
                        start: { x: x, y: y - size },
                        end: { x: x, y: y + size },
                        thickness: thickness,
                        color: color
                    });

                    page.drawLine({
                        start: { x: x - size, y: y },
                        end: { x: x + size, y: y },
                        thickness: thickness,
                        color: color
                    });

                    page.drawLine({
                        start: { x: x - size * 0.7, y: y - size * 0.7 },
                        end: { x: x + size * 0.7, y: y + size * 0.7 },
                        thickness: thickness,
                        color: color
                    });

                    page.drawLine({
                        start: { x: x - size * 0.7, y: y + size * 0.7 },
                        end: { x: x + size * 0.7, y: y - size * 0.7 },
                        thickness: thickness,
                        color: color
                    });

                    // Draw circle in center
                    page.drawCircle({
                        x: x,
                        y: y,
                        size: Math.max(1, size / 5),
                        color: color
                    });
                });
            }
        }

        // Prompt user for filename
        const defaultName = state.originalPdfFile.name.replace('.pdf', '') + '-annotated';
        const fileName = prompt('Enter PDF file name:', defaultName);

        if (!fileName) {
            return; // User cancelled
        }

        // Now remove deleted pages (in reverse order to maintain indices)
        for (let i = state.deletedPages.length - 1; i >= 0; i--) {
            const pageIndex = state.deletedPages[i] - 1;
            pdfDoc.removePage(pageIndex);
        }

        // Save the PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith('.pdf') ? fileName : fileName + '.pdf';
        a.click();
        URL.revokeObjectURL(url);

        alert('Annotated PDF exported successfully!');
    } catch (error) {
        console.error('Error exporting PDF:', error);
        alert('Error exporting PDF. Please try again.');
    }
}

// Notify parent when data changes
function notifyParent() {
    if (window.parent !== window) {
        window.parent.postMessage({
            type: 'annotation-changed',
            data: {
                version: 1,
                pdf: state.pdfData,
                annotations: state.annotations,
                settings: {
                    markerSize: state.markerSize,
                    zoom: state.scale,
                    deletedPages: Array.isArray(state.deletedPages) ? state.deletedPages : Array.from(state.deletedPages)
                }
            },
            fileName: state.originalPdfFile?.name || null
        }, '*');
    }
}

// Listen for messages from parent
window.addEventListener('message', async (event) => {
    if (event.data.type === 'load-data') {
        const data = event.data.data;
        const metadata = event.data.metadata;

        if (data.pdf) {
            // Load PDF from base64
            state.pdfData = data.pdf;
            const pdfBytes = base64ToArrayBuffer(data.pdf);
            await loadPdfFromBytes(pdfBytes);

            // Store filename from metadata if available
            if (metadata && metadata.fileName) {
                // Create a fake file object to store the name
                state.originalPdfFile = { name: metadata.fileName };
            }
        }

        if (data.annotations) {
            state.annotations = data.annotations;
            renderAnnotations();
        }

        if (data.settings) {
            state.settings = { ...state.settings, ...data.settings };
            applySettings();
        }
    }
});

// Helper: Convert base64 to ArrayBuffer
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

// Load PDF from bytes
async function loadPdfFromBytes(arrayBuffer) {
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    state.pdfDoc = await loadingTask.promise;
    state.totalPages = state.pdfDoc.numPages;
    state.currentPage = 1;

    dropZone.classList.add('hidden');
    await renderPage(state.currentPage);
    updatePageControls();
    renderAnnotations();

    // Don't notify parent here - this is called when loading FROM parent
    // The parent already has the data
}

// Apply settings from loaded data
function applySettings() {
    if (state.settings.zoom) {
        state.zoom = state.settings.zoom;
    }
    if (state.settings.markerSize) {
        state.markerSize = state.settings.markerSize;
        document.getElementById('marker-size').value = state.markerSize;
        document.getElementById('marker-size-value').textContent = state.markerSize;
    }
    if (state.settings.viewMode) {
        state.viewMode = state.settings.viewMode;
        document.getElementById('view-mode').value = state.viewMode;
        updateViewMode();
    }
    if (state.settings.deletedPages) {
        state.deletedPages = new Set(state.settings.deletedPages);
    }
}

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        // Notify parent we're ready
        window.parent.postMessage({ type: 'annotation-ready' }, '*');
    });
} else {
    init();
    // Notify parent we're ready
    window.parent.postMessage({ type: 'annotation-ready' }, '*');
}
