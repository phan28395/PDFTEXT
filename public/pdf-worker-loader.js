// PDF.js Worker Loader - Compatible with all browsers
// This file loads the PDF.js worker with proper fallbacks

(function() {
  'use strict';
  
  // Check if we're in a worker context
  if (typeof importScripts !== 'function') {
    return;
  }
  
  // PDF.js version - should match package.json
  var PDFJS_VERSION = '4.8.69';
  
  // Try multiple CDN sources in order
  var workerUrls = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/' + PDFJS_VERSION + '/pdf.worker.min.js',
    'https://unpkg.com/pdfjs-dist@' + PDFJS_VERSION + '/legacy/build/pdf.worker.min.mjs',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@' + PDFJS_VERSION + '/legacy/build/pdf.worker.min.mjs'
  ];
  
  var loaded = false;
  var errors = [];
  
  // Try each URL until one works
  for (var i = 0; i < workerUrls.length && !loaded; i++) {
    try {
      importScripts(workerUrls[i]);
      loaded = true;
      console.log('PDF.js worker loaded from:', workerUrls[i]);
    } catch (e) {
      errors.push({ url: workerUrls[i], error: e.message });
    }
  }
  
  if (!loaded) {
    throw new Error('Failed to load PDF.js worker from any source. Errors: ' + JSON.stringify(errors));
  }
})();