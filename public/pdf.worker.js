// This file serves as a fallback worker loader for PDF.js
// It will be served from the public directory and available at /pdf.worker.js

if (typeof importScripts === 'function') {
  // We're in a worker context
  // First try to load the local worker file if available
  try {
    importScripts('/pdf.worker.min.js');
  } catch (e) {
    // Fallback to CDN if local file is not available
    importScripts('https://unpkg.com/pdfjs-dist@4.8.69/build/pdf.worker.min.js');
  }
}