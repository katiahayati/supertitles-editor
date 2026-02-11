// Test setup file
// Mock PDF.js
global.pdfjsLib = {
  GlobalWorkerOptions: {
    workerSrc: ''
  },
  getDocument: jest.fn()
};

// Mock canvas
HTMLCanvasElement.prototype.getContext = jest.fn(() => ({
  fillRect: jest.fn(),
  clearRect: jest.fn(),
  getImageData: jest.fn(),
  putImageData: jest.fn(),
  createImageData: jest.fn(),
  setTransform: jest.fn(),
  drawImage: jest.fn(),
  save: jest.fn(),
  fillText: jest.fn(),
  restore: jest.fn(),
  beginPath: jest.fn(),
  moveTo: jest.fn(),
  lineTo: jest.fn(),
  closePath: jest.fn(),
  stroke: jest.fn(),
  translate: jest.fn(),
  scale: jest.fn(),
  rotate: jest.fn(),
  arc: jest.fn(),
  fill: jest.fn(),
  measureText: jest.fn(() => ({ width: 0 })),
  transform: jest.fn(),
  rect: jest.fn(),
  clip: jest.fn()
}));

// Mock window.postMessage
global.postMessage = jest.fn();

// Mock FileReader
global.FileReader = class FileReader {
  readAsDataURL() {
    setTimeout(() => {
      this.onload({ target: { result: 'data:application/pdf;base64,mock' } });
    }, 0);
  }
  readAsArrayBuffer() {
    setTimeout(() => {
      this.onload({ target: { result: new ArrayBuffer(0) } });
    }, 0);
  }
};

// Mock URL methods
global.URL.createObjectURL = jest.fn(() => 'blob:mock');
global.URL.revokeObjectURL = jest.fn();

// Mock alert
global.alert = jest.fn();
