// Import worker as text and create a data URL
// This bundles the worker into the main JavaScript avoiding CSP issues
import workerCode from 'pdfjs-dist/build/pdf.worker.min.mjs?raw';

export function setupPdfWorker() {
  if (typeof window === 'undefined') return '';
  
  try {
    // Create a blob from the worker code
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    
    // Create a data URL that embeds the worker code
    // Data URLs are allowed by CSP as they're part of the same origin
    const workerUrl = URL.createObjectURL(blob);
    
    console.log('PDF.js worker created as blob URL');
    return workerUrl;
  } catch (error) {
    console.error('Failed to create PDF.js worker blob:', error);
    return '';
  }
}