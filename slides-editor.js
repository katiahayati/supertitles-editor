// Application state
const state = {
    presentation: null,
    slides: [],
    currentSlideIndex: -1,
    originalOdpZip: null
};

// DOM elements
const presentationUpload = document.getElementById('presentation-upload');
const newPresentationBtn = document.getElementById('new-presentation');
const saveOdpBtn = document.getElementById('save-odp');
const savePptxBtn = document.getElementById('save-pptx');
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
    presentationUpload.addEventListener('change', handlePresentationUpload);
    newPresentationBtn.addEventListener('click', createNewPresentation);
    saveOdpBtn.addEventListener('click', () => savePresentation('odp'));
    savePptxBtn.addEventListener('click', () => savePresentation('pptx'));
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

// Load presentation file (ODP or PPTX)
async function handlePresentationUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const extension = file.name.split('.').pop().toLowerCase();

    try {
        if (extension === 'odp') {
            await loadOdp(file);
            alert('ODP loaded successfully!');
        } else if (extension === 'pptx') {
            await loadPptx(file);
            alert('PPTX loaded successfully!');
        } else {
            alert('Unsupported file format. Please use .odp or .pptx files.');
        }
    } catch (error) {
        console.error('Error loading presentation:', error);
        alert('Error loading presentation file. Please try another file.');
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

// Load and parse PPTX file
async function loadPptx(file) {
    const zip = new JSZip();
    const zipData = await zip.loadAsync(file);

    // Store original zip for preserving structure
    state.originalOdpZip = zipData;

    // Parse presentation.xml (contains slide references)
    const presentationXml = await zipData.file('ppt/presentation.xml').async('string');
    const parser = new DOMParser();
    const presentationDoc = parser.parseFromString(presentationXml, 'text/xml');

    // Get slide references
    const slideIds = presentationDoc.getElementsByTagName('p:sldId');
    const slides = [];

    // Parse each slide
    for (let i = 0; i < slideIds.length; i++) {
        const slideId = slideIds[i].getAttribute('r:id');

        // Get the slide filename from relationships
        const relsXml = await zipData.file('ppt/_rels/presentation.xml.rels').async('string');
        const relsDoc = parser.parseFromString(relsXml, 'text/xml');
        const rels = relsDoc.getElementsByTagName('Relationship');

        let slideFile = null;
        for (let j = 0; j < rels.length; j++) {
            if (rels[j].getAttribute('Id') === slideId) {
                slideFile = 'ppt/' + rels[j].getAttribute('Target');
                break;
            }
        }

        if (slideFile && zipData.file(slideFile)) {
            const slideXml = await zipData.file(slideFile).async('string');
            const slideDoc = parser.parseFromString(slideXml, 'text/xml');
            const slide = parsePptxSlide(slideDoc, i);
            slides.push(slide);
        }
    }

    state.slides = slides;

    // Parse core properties for metadata
    if (zipData.file('docProps/core.xml')) {
        const coreXml = await zipData.file('docProps/core.xml').async('string');
        const coreDoc = parser.parseFromString(coreXml, 'text/xml');
        state.presentation = parsePptxMetadata(coreDoc, file.name);
    } else {
        state.presentation = {
            title: file.name.replace('.pptx', ''),
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

// Parse a single PPTX slide
function parsePptxSlide(slideDoc, index) {
    const slide = {
        id: `slide-${index + 1}`,
        name: `Slide ${index + 1}`,
        title: '',
        content: ''
    };

    // Extract text from all text elements
    const textElements = slideDoc.getElementsByTagName('a:t');
    const textContents = [];

    for (let i = 0; i < textElements.length; i++) {
        const text = textElements[i].textContent.trim();
        if (text) {
            textContents.push(text);
        }
    }

    // First text is usually title, rest is content
    if (textContents.length > 0) {
        slide.title = textContents[0];
        slide.content = textContents.slice(1).join('\n');
    }

    return slide;
}

// Parse PPTX metadata
function parsePptxMetadata(coreDoc, filename) {
    const titleEl = coreDoc.getElementsByTagName('dc:title')[0];
    const creatorEl = coreDoc.getElementsByTagName('dc:creator')[0];
    const createdEl = coreDoc.getElementsByTagName('dcterms:created')[0];

    return {
        title: titleEl ? titleEl.textContent : filename.replace('.pptx', ''),
        author: creatorEl ? creatorEl.textContent : '',
        created: createdEl ? createdEl.textContent : new Date().toISOString()
    };
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
    savePptxBtn.disabled = false;
    addSlideBtn.disabled = false;
    slideTitleInput.disabled = false;
    slideContentInput.disabled = false;
    updateSlideBtn.disabled = false;
}

// Save presentation (ODP or PPTX)
async function savePresentation(format) {
    if (!state.presentation || state.slides.length === 0) {
        alert('No presentation to save');
        return;
    }

    const extension = format === 'pptx' ? '.pptx' : '.odp';
    const fileName = prompt('Enter filename:', state.presentation.title || 'presentation');
    if (!fileName) return;

    try {
        let blob;
        if (format === 'pptx') {
            blob = await generatePptx();
        } else {
            blob = await generateOdp();
        }

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName.endsWith(extension) ? fileName : fileName + extension;
        a.click();
        URL.revokeObjectURL(url);

        alert(`${format.toUpperCase()} saved successfully!`);
    } catch (error) {
        console.error(`Error saving ${format.toUpperCase()}:`, error);
        alert(`Error saving ${format.toUpperCase()} file. Please try again.`);
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

// Generate PPTX file
async function generatePptx() {
    const zip = new JSZip();

    // Add required PPTX files
    zip.file('[Content_Types].xml', generatePptxContentTypes());
    zip.file('_rels/.rels', generatePptxRels());
    zip.file('ppt/_rels/presentation.xml.rels', generatePptxPresentationRels());
    zip.file('ppt/presentation.xml', generatePptxPresentation());

    // Add each slide
    for (let i = 0; i < state.slides.length; i++) {
        const slideXml = generatePptxSlide(state.slides[i], i);
        zip.file(`ppt/slides/slide${i + 1}.xml`, slideXml);
        zip.file(`ppt/slides/_rels/slide${i + 1}.xml.rels`, generatePptxSlideRels(i));
    }

    // Add slide layouts (minimal)
    zip.file('ppt/slideLayouts/slideLayout1.xml', generatePptxSlideLayout());
    zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', generatePptxSlideLayoutRels());

    // Add slide master (minimal)
    zip.file('ppt/slideMasters/slideMaster1.xml', generatePptxSlideMaster());
    zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', generatePptxSlideMasterRels());

    // Add theme
    zip.file('ppt/theme/theme1.xml', generatePptxTheme());

    // Add core properties
    zip.file('docProps/core.xml', generatePptxCore());
    zip.file('docProps/app.xml', generatePptxApp());

    return await zip.generateAsync({ type: 'blob' });
}

// Generate PPTX [Content_Types].xml
function generatePptxContentTypes() {
    let slideOverrides = '';
    for (let i = 1; i <= state.slides.length; i++) {
        slideOverrides += `  <Override PartName="/ppt/slides/slide${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>
${slideOverrides}  <Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>
  <Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>
  <Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

// Generate PPTX _rels/.rels
function generatePptxRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

// Generate PPTX ppt/_rels/presentation.xml.rels
function generatePptxPresentationRels() {
    let slideRels = '';
    for (let i = 1; i <= state.slides.length; i++) {
        slideRels += `  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${i}.xml"/>\n`;
    }

    const nextId = state.slides.length + 1;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${slideRels}  <Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>
  <Relationship Id="rId${nextId + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/>
</Relationships>`;
}

// Generate PPTX ppt/presentation.xml
function generatePptxPresentation() {
    let slideIdList = '';
    for (let i = 1; i <= state.slides.length; i++) {
        slideIdList += `    <p:sldId id="${255 + i}" r:id="rId${i}"/>\n`;
    }

    const masterId = state.slides.length + 1;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:sldMasterIdLst>
    <p:sldMasterId id="2147483648" r:id="rId${masterId}"/>
  </p:sldMasterIdLst>
  <p:sldIdLst>
${slideIdList}  </p:sldIdLst>
  <p:sldSz cx="9144000" cy="6858000"/>
</p:presentation>`;
}

// Generate PPTX slide
function generatePptxSlide(slide, index) {
    const contentLines = slide.content.split('\n').map(line =>
        `          <a:p><a:r><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
    ).join('\n');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="2" name="Title"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p><a:r><a:rPr lang="en-US" sz="4400" b="1"/><a:t>${escapeXml(slide.title)}</a:t></a:r></a:p>
        </p:txBody>
      </p:sp>
      <p:sp>
        <p:nvSpPr><p:cNvPr id="3" name="Content"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
${contentLines}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sld>`;
}

// Generate slide relationships
function generatePptxSlideRels(index) {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
</Relationships>`;
}

// Generate slide layout (minimal)
function generatePptxSlideLayout() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldLayout xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" type="blank">
  <p:cSld name="Blank">
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>
</p:sldLayout>`;
}

function generatePptxSlideLayoutRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/>
</Relationships>`;
}

// Generate slide master (minimal)
function generatePptxSlideMaster() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr/>
    </p:spTree>
  </p:cSld>
  <p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>
  <p:sldLayoutIdLst>
    <p:sldLayoutId id="2147483649" r:id="rId1"/>
  </p:sldLayoutIdLst>
</p:sldMaster>`;
}

function generatePptxSlideMasterRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/>
</Relationships>`;
}

// Generate theme (minimal)
function generatePptxTheme() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">
  <a:themeElements>
    <a:clrScheme name="Office">
      <a:dk1><a:sysClr val="windowText" lastClr="000000"/></a:dk1>
      <a:lt1><a:sysClr val="window" lastClr="FFFFFF"/></a:lt1>
      <a:dk2><a:srgbClr val="1F497D"/></a:dk2>
      <a:lt2><a:srgbClr val="EEECE1"/></a:lt2>
      <a:accent1><a:srgbClr val="4F81BD"/></a:accent1>
      <a:accent2><a:srgbClr val="C0504D"/></a:accent2>
      <a:accent3><a:srgbClr val="9BBB59"/></a:accent3>
      <a:accent4><a:srgbClr val="8064A2"/></a:accent4>
      <a:accent5><a:srgbClr val="4BACC6"/></a:accent5>
      <a:accent6><a:srgbClr val="F79646"/></a:accent6>
      <a:hlink><a:srgbClr val="0000FF"/></a:hlink>
      <a:folHlink><a:srgbClr val="800080"/></a:folHlink>
    </a:clrScheme>
    <a:fontScheme name="Office"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme>
    <a:fmtScheme name="Office"><a:fillStyleLst/><a:lnStyleLst/><a:effectStyleLst/><a:bgFillStyleLst/></a:fmtScheme>
  </a:themeElements>
</a:theme>`;
}

// Generate core properties
function generatePptxCore() {
    const now = new Date().toISOString();
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(state.presentation.title)}</dc:title>
  <dc:creator>${escapeXml(state.presentation.author || 'Slides Editor')}</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${state.presentation.created}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified>
</cp:coreProperties>`;
}

// Generate app properties
function generatePptxApp() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
  <Application>Slides Editor</Application>
  <Slides>${state.slides.length}</Slides>
</Properties>`;
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
