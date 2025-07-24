// IMPORTANT: Due to persistent PDF.js worker issues, we're using SimplifiedPDFViewer instead
// This component is temporarily replaced to avoid worker-related errors
// The actual PDF processing happens server-side, so client-side preview is simplified

import SimplifiedPDFViewer from './SimplifiedPDFViewer';

// Re-export the simplified viewer as PDFViewer to maintain compatibility
export default SimplifiedPDFViewer;
export type { OutputFormat } from './SimplifiedPDFViewer';