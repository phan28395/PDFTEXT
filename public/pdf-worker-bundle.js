// PDF.js Worker Bundle - Loads the worker locally without external dependencies
// This file is served from your own domain, avoiding CSP issues

// Check if we're in a worker context
if (typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope) {
  // We're in a worker - import the PDF.js worker code
  try {
    // Try to load the legacy worker (more compatible)
    self.importScripts('/pdf.worker.legacy.js');
  } catch (e) {
    console.error('Failed to load PDF.js worker bundle:', e);
    // Try alternative path
    try {
      self.importScripts('./pdf.worker.legacy.js');
    } catch (e2) {
      console.error('Failed to load PDF.js worker bundle from alternative path:', e2);
    }
  }
}