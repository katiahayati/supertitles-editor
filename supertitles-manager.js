// Application state
const state = {
    setName: null,
    setFileName: null, // Track the filename to auto-save
    presentationData: null,
    annotationData: null,
    presentationName: null,
    annotationName: null,
    hasUnsavedChanges: false
};

// DOM elements
const newSetBtn = document.getElementById('new-set');
const openSetBtn = document.getElementById('open-set');
const saveSetBtn = document.getElementById('save-set');
const setInput = document.getElementById('set-input');
const changePresentationBtn = document.getElementById('change-presentation');
const changeAnnotationBtn = document.getElementById('change-annotation');
const presentationInput = document.getElementById('presentation-input');
const annotationInput = document.getElementById('annotation-input');
const setInfo = document.getElementById('set-info');
const presentationNameDisplay = document.getElementById('presentation-name');
const annotationNameDisplay = document.getElementById('annotation-name');
const tabButtons = document.querySelectorAll('.tab');
const presentationFrame = document.getElementById('presentation-frame');
const annotationFrame = document.getElementById('annotation-frame');

// Initialize
function init() {
    setupEventListeners();
    setupIframes();
}

// Event listeners
function setupEventListeners() {
    newSetBtn.addEventListener('click', createNewSet);
    openSetBtn.addEventListener('click', () => setInput.click());
    setInput.addEventListener('change', handleSetUpload);
    saveSetBtn.addEventListener('click', saveSet);

    changePresentationBtn.addEventListener('click', () => presentationInput.click());
    presentationInput.addEventListener('change', handlePresentationChange);
    changeAnnotationBtn.addEventListener('click', () => annotationInput.click());
    annotationInput.addEventListener('change', handleAnnotationChange);

    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    // Listen for changes from iframes
    window.addEventListener('message', handleIframeMessage);
}

// Setup iframes with embedded editors
function setupIframes() {
    // We'll load the editors as separate pages
    presentationFrame.src = 'presentation-editor-embedded.html';
    annotationFrame.src = 'pdf-annotator-embedded.html';
}

// Handle messages from iframes
function handleIframeMessage(event) {
    if (event.data.type === 'presentation-changed') {
        state.presentationData = event.data.data;
        // Update presentation name from the message
        if (event.data.presentationTitle) {
            state.presentationName = event.data.presentationTitle;
        } else if (!state.presentationName && state.presentationData?.presentation?.title) {
            state.presentationName = state.presentationData.presentation.title;
        }
        state.hasUnsavedChanges = true;
        updateUI();
    } else if (event.data.type === 'annotation-changed') {
        state.annotationData = event.data.data;
        // Update annotation name from the message ONLY if a new file is being loaded
        console.log('Annotation changed, fileName:', event.data.fileName);
        if (event.data.fileName) {
            // New file loaded - update the name
            state.annotationName = event.data.fileName;
            console.log('Set annotation name to:', state.annotationName);
        } else if (state.annotationData?.pdf && !state.annotationName) {
            // PDF exists but no name set yet
            state.annotationName = 'PDF loaded';
        } else if (state.annotationData?.pdf && state.annotationName === 'No PDF loaded') {
            // Updating from "No PDF loaded" to generic
            state.annotationName = 'PDF loaded';
        }
        // If state.annotationName already has a value (like from metadata), keep it
        state.hasUnsavedChanges = true;
        updateUI();
    } else if (event.data.type === 'presentation-ready') {
        // Presentation editor is ready, load data if we have it
        if (state.presentationData) {
            presentationFrame.contentWindow.postMessage({
                type: 'load-data',
                data: state.presentationData
            }, '*');
        }
    } else if (event.data.type === 'annotation-ready') {
        // Annotation editor is ready, load data if we have it
        if (state.annotationData) {
            annotationFrame.contentWindow.postMessage({
                type: 'load-data',
                data: state.annotationData,
                metadata: {
                    fileName: state.annotationName
                }
            }, '*');
        }
    }
}

// Create new set
function createNewSet() {
    const name = prompt('Enter supertitle set name:');
    if (!name) return;

    state.setName = name;
    state.presentationName = 'New presentation';
    state.annotationName = 'No PDF loaded';
    state.presentationData = {
        version: 1,
        presentation: { title: name },
        slides: []
    };
    state.annotationData = {
        version: 1,
        pdf: null,
        annotations: [],
        settings: {
            markerSize: 40,
            viewMode: 'paginated',
            zoom: 1.0,
            deletedPages: []
        }
    };
    state.hasUnsavedChanges = false;

    // Send to iframes
    presentationFrame.contentWindow.postMessage({
        type: 'load-data',
        data: state.presentationData
    }, '*');

    annotationFrame.contentWindow.postMessage({
        type: 'load-data',
        data: state.annotationData,
        metadata: {
            fileName: state.annotationName
        }
    }, '*');

    enableEditing();
    updateUI();
}

// Handle set file upload
async function handleSetUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const setData = JSON.parse(text);

        if (!setData.version || !setData.presentation) {
            throw new Error('Invalid supertitles set file format');
        }

        state.setName = setData.name || file.name.replace('.supertitles', '');
        state.setFileName = file.name.replace('.supertitles', ''); // Remember filename for auto-save
        state.presentationData = setData.presentation;

        // Handle different versions
        if (setData.version === 1) {
            // Old format: annotation data embedded
            if (!setData.annotation) {
                throw new Error('Invalid supertitles set file format (v1 missing annotation)');
            }
            state.annotationData = setData.annotation;

            // Load metadata if available
            if (setData.metadata) {
                state.presentationName = setData.metadata.presentationName || setData.presentation?.presentation?.title || 'Untitled presentation';
                state.annotationName = setData.metadata.annotationName || (setData.annotation?.pdf ? 'PDF loaded' : 'No PDF');
            } else {
                state.presentationName = setData.presentation?.presentation?.title || 'Untitled presentation';
                state.annotationName = setData.annotation?.pdf ? 'PDF loaded' : 'No PDF';
            }

            state.hasUnsavedChanges = false;

            // Send to iframes
            presentationFrame.contentWindow.postMessage({
                type: 'load-data',
                data: state.presentationData
            }, '*');

            annotationFrame.contentWindow.postMessage({
                type: 'load-data',
                data: state.annotationData,
                metadata: {
                    fileName: state.annotationName
                }
            }, '*');

            enableEditing();
            updateUI();

            alert('Supertitles set loaded successfully!');

        } else if (setData.version === 2) {
            // New format: embedded data (self-contained)
            if (!setData.presentation || !setData.annotation) {
                throw new Error('Invalid supertitles set file format (v2 missing presentation or annotation)');
            }

            state.setName = setData.name || file.name.replace('.supertitles', '');
            state.setFileName = file.name.replace('.supertitles', '');
            state.presentationData = setData.presentation;
            state.annotationData = setData.annotation;

            // Load metadata
            if (setData.metadata) {
                state.presentationName = setData.metadata.presentationName || setData.presentation?.presentation?.title || 'Untitled presentation';
                state.annotationName = setData.metadata.annotationName || (setData.annotation?.pdf ? 'PDF loaded' : 'No PDF');
            } else {
                state.presentationName = setData.presentation?.presentation?.title || 'Untitled presentation';
                state.annotationName = setData.annotation?.pdf ? 'PDF loaded' : 'No PDF';
            }

            state.hasUnsavedChanges = false;

            // Send to iframes
            presentationFrame.contentWindow.postMessage({
                type: 'load-data',
                data: state.presentationData
            }, '*');

            annotationFrame.contentWindow.postMessage({
                type: 'load-data',
                data: state.annotationData,
                metadata: {
                    fileName: state.annotationName
                }
            }, '*');

            enableEditing();
            updateUI();

            alert('Supertitles set loaded successfully!');

        } else {
            throw new Error(`Unsupported supertitles set version: ${setData.version}`);
        }

    } catch (error) {
        console.error('Error loading set:', error);
        alert('Error loading supertitles set: ' + error.message);
    }

    setInput.value = '';
}

// Save set
function saveSet() {
    if (!state.setName) {
        alert('No set to save');
        return;
    }

    // If we don't have a filename yet (first save), ask for it
    let filename = state.setFileName;
    if (!filename) {
        filename = prompt('Enter filename (without extension):', state.setName.replace(/[^a-z0-9]/gi, '_').toLowerCase());
        if (!filename) return;
        state.setFileName = filename;
    }

    console.log('Saving set with names:', state.presentationName, state.annotationName);

    // Save presentation file (for individual editing)
    const presentationFilename = filename + '_presentation.json';
    const presentationJson = JSON.stringify(state.presentationData, null, 2);
    const presentationBlob = new Blob([presentationJson], { type: 'application/json' });
    const presentationUrl = URL.createObjectURL(presentationBlob);
    const presentationLink = document.createElement('a');
    presentationLink.href = presentationUrl;
    presentationLink.download = presentationFilename;
    presentationLink.click();
    URL.revokeObjectURL(presentationUrl);

    // Save annotation file (for individual editing)
    const annotationFilename = filename + '_annotation.pdfannotations';
    const annotationJson = JSON.stringify(state.annotationData, null, 2);
    const annotationBlob = new Blob([annotationJson], { type: 'application/json' });
    const annotationUrl = URL.createObjectURL(annotationBlob);
    const annotationLink = document.createElement('a');
    annotationLink.href = annotationUrl;
    annotationLink.download = annotationFilename;
    annotationLink.click();
    URL.revokeObjectURL(annotationUrl);

    // Save supertitles file with ALL data embedded (self-contained)
    const setData = {
        version: 2,
        name: state.setName,
        presentation: state.presentationData,
        annotation: state.annotationData,
        metadata: {
            presentationName: state.presentationName,
            annotationName: state.annotationName
        }
    };

    console.log('Set data to save:', setData);

    const json = JSON.stringify(setData, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename + '.supertitles';
    a.click();
    URL.revokeObjectURL(url);

    state.hasUnsavedChanges = false;
    updateUI();
}

// Handle presentation file change
async function handlePresentationChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const text = await file.text();
        const projectData = JSON.parse(text);

        if (!projectData.version || !projectData.slides) {
            throw new Error('Invalid presentation file format');
        }

        state.presentationData = projectData;
        state.presentationName = projectData.presentation?.title || file.name.replace('.json', '');
        state.hasUnsavedChanges = true;

        presentationFrame.contentWindow.postMessage({
            type: 'load-data',
            data: state.presentationData
        }, '*');

        updateUI();
        alert('Presentation updated!');
    } catch (error) {
        console.error('Error loading presentation:', error);
        alert('Error loading presentation: ' + error.message);
    }

    presentationInput.value = '';
}

// Handle annotation file change
async function handleAnnotationChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        // Check if it's a project file or PDF
        if (file.name.endsWith('.pdfannotations') || file.name.endsWith('.json')) {
            const text = await file.text();
            const projectData = JSON.parse(text);

            if (!projectData.version) {
                throw new Error('Invalid annotation project file format');
            }

            state.annotationData = projectData;
            state.annotationName = file.name.replace('.pdfannotations', '').replace('.json', '');
            delete state.annotationFileReference; // Clear the reference since we now have the data
        } else if (file.name.endsWith('.pdf')) {
            // Load new PDF - keep existing annotations structure but update PDF
            const arrayBuffer = await file.arrayBuffer();
            const base64 = arrayBufferToBase64(arrayBuffer);

            state.annotationName = file.name;

            if (!state.annotationData) {
                state.annotationData = {
                    version: 1,
                    pdf: base64,
                    annotations: [],
                    settings: {
                        markerSize: 40,
                        viewMode: 'paginated',
                        zoom: 1.0,
                        deletedPages: []
                    }
                };
            } else {
                state.annotationData.pdf = base64;
                // Clear annotations when loading new PDF
                state.annotationData.annotations = [];
                state.annotationData.settings.deletedPages = [];
            }
        } else {
            throw new Error('Please select a PDF file or annotation project JSON file');
        }

        state.hasUnsavedChanges = true;

        annotationFrame.contentWindow.postMessage({
            type: 'load-data',
            data: state.annotationData,
            metadata: {
                fileName: state.annotationName
            }
        }, '*');

        updateUI();
        alert('Annotation updated!');
    } catch (error) {
        console.error('Error loading annotation:', error);
        alert('Error loading annotation: ' + error.message);
    }

    annotationInput.value = '';
}

// Helper: Convert ArrayBuffer to Base64
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Switch tabs
function switchTab(tabName) {
    // Update tab buttons
    tabButtons.forEach(btn => {
        if (btn.dataset.tab === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    if (tabName === 'presentation') {
        document.getElementById('presentation-tab').classList.add('active');
    } else if (tabName === 'annotation') {
        document.getElementById('annotation-tab').classList.add('active');
    }
}

// Enable editing
function enableEditing() {
    saveSetBtn.disabled = false;
    changePresentationBtn.disabled = false;
    changeAnnotationBtn.disabled = false;
}

// Update UI
function updateUI() {
    if (state.setName) {
        const unsavedIndicator = state.hasUnsavedChanges ? ' (unsaved changes)' : '';
        setInfo.textContent = `Set: ${state.setName}${unsavedIndicator}`;
    } else {
        setInfo.textContent = 'No set loaded';
    }

    presentationNameDisplay.textContent = state.presentationName || 'None';
    annotationNameDisplay.textContent = state.annotationName || 'None';
}

// Initialize
init();
