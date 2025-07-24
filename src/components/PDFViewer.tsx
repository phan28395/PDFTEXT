import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, Download, FileText, Settings } from 'lucide-react';
import * as pdfjs from 'pdfjs-dist';

// Set up PDF.js worker with multiple fallback strategies
if (typeof window !== 'undefined') {
  const setupWorker = async () => {
    const pdfjsVersion = pdfjs.version;
    console.log(`Setting up PDF.js worker for version: ${pdfjsVersion}`);
    
    // Strategy 1: Try local worker files first (if available in public directory)
    const localWorkerUrls = ['/pdf-worker-loader.js', '/pdf.worker.min.js', '/pdf.worker.js'];
    
    for (const url of localWorkerUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = url;
          console.log(`Using local PDF.js worker: ${url}`);
          return;
        }
      } catch (e) {
        console.log(`Local worker ${url} not available`);
      }
    }
    
    // Strategy 2: Use CDN with exact version
    const cdnUrls = [
      `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/legacy/build/pdf.worker.min.mjs`,
      `https://unpkg.com/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`,
      `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/legacy/build/pdf.worker.min.mjs`,
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsVersion}/pdf.worker.min.js`
    ];
    
    // Try each CDN URL
    for (const url of cdnUrls) {
      try {
        const response = await fetch(url, { method: 'HEAD' });
        if (response.ok) {
          pdfjs.GlobalWorkerOptions.workerSrc = url;
          console.log(`Using PDF.js worker from: ${url}`);
          return;
        }
      } catch (e) {
        console.log(`Failed to reach: ${url}`);
      }
    }
    
    // Strategy 3: Try to create worker inline (last resort)
    try {
      const workerBlob = new Blob([`importScripts('${cdnUrls[0]}')`], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(workerBlob);
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
      console.log('Using inline worker with CDN import');
    } catch (e) {
      console.error('Failed to create inline worker:', e);
      // Final fallback - disable worker (will be slower but functional)
      pdfjs.GlobalWorkerOptions.workerSrc = undefined;
      console.warn('PDF.js running without worker - performance may be impacted');
    }
  };
  
  // Initialize worker setup
  setupWorker().catch(console.error);
  
  // Disable eval for security (if supported)
  pdfjs.GlobalWorkerOptions.isEvalSupported = false;
}

interface PDFViewerProps {
  file: File;
  onPageRangeSelect?: (startPage: number, endPage: number, totalPages: number) => void;
  onFormatSelect?: (format: OutputFormat) => void;
  className?: string;
}

export interface OutputFormat {
  type: 'text' | 'docx' | 'markdown' | 'html' | 'json';
  name: string;
  description: string;
}

const OUTPUT_FORMATS: OutputFormat[] = [
  { type: 'text', name: 'Plain Text', description: 'Simple text format (.txt)' },
  { type: 'docx', name: 'Word Document', description: 'Microsoft Word format (.docx)' },
  { type: 'markdown', name: 'Markdown', description: 'Markdown format (.md)' },
  { type: 'html', name: 'HTML', description: 'Web format (.html)' },
  { type: 'json', name: 'JSON', description: 'Structured data format (.json)' }
];

export default function PDFViewer({ file, onPageRangeSelect, onFormatSelect, className = '' }: PDFViewerProps) {
  const [pdf, setPdf] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Page selection state
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [isRangeSelectionMode, setIsRangeSelectionMode] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>(OUTPUT_FORMATS[0]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF when file changes
  useEffect(() => {
    if (!file) return;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Validate file type
        if (!file.type.includes('pdf')) {
          throw new Error('File is not a valid PDF');
        }
        
        // Convert file to array buffer
        const arrayBuffer = await file.arrayBuffer();
        
        // Load PDF with additional options
        const loadingTask = pdfjs.getDocument({
          data: arrayBuffer,
          cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
          cMapPacked: true,
          standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
          // Add options for better compatibility
          isEvalSupported: false,
          disableAutoFetch: true,
          disableStream: true,
          // Additional error handling options
          stopAtErrors: false,
          disableFontFace: false,
          enableXfa: false,
        });
        
        // Add progress handler
        loadingTask.onProgress = (progressData: any) => {
          console.log(`Loading PDF: ${progressData.loaded} / ${progressData.total} bytes`);
        };
        
        const loadedPdf = await loadingTask.promise;
        
        // Validate the PDF was loaded successfully
        if (!loadedPdf || loadedPdf.numPages === 0) {
          throw new Error('PDF appears to be empty or corrupted');
        }
        
        setPdf(loadedPdf);
        setTotalPages(loadedPdf.numPages);
        setCurrentPage(1);
        setStartPage(1);
        setEndPage(loadedPdf.numPages);
        
        // Notify parent about initial range
        onPageRangeSelect?.(1, loadedPdf.numPages, loadedPdf.numPages);
        
        console.log(`PDF loaded successfully: ${loadedPdf.numPages} pages`);
      } catch (err: any) {
        console.error('Error loading PDF:', err);
        let errorMessage = 'Failed to load PDF. Please try again.';
        
        if (err.name === 'InvalidPDFException') {
          errorMessage = 'Invalid PDF file. Please check the file and try again.';
        } else if (err.name === 'MissingPDFException') {
          errorMessage = 'PDF file appears to be corrupted or empty.';
        } else if (err.name === 'UnexpectedResponseException') {
          errorMessage = 'Unable to load PDF. Please check your internet connection.';
        } else if (err.message) {
          errorMessage = err.message;
        }
        
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadPDF();
  }, [file, onPageRangeSelect]);

  // Render current page
  useEffect(() => {
    if (!pdf || !canvasRef.current || currentPage > totalPages) return;

    const renderPage = async () => {
      try {
        const page = await pdf.getPage(currentPage);
        const canvas = canvasRef.current!;
        const context = canvas.getContext('2d')!;
        
        // Clear previous content
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        const viewport = page.getViewport({ scale, rotation });
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Set canvas style for better appearance
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        
        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };
        
        // Cancel any previous render task
        const renderTask = page.render(renderContext);
        await renderTask.promise;
        
        console.log(`Page ${currentPage} rendered successfully`);
      } catch (err: any) {
        console.error('Error rendering page:', err);
        if (err.name !== 'RenderingCancelledException') {
          setError(`Failed to render page ${currentPage}. ${err.message || ''}`);
        }
      }
    };

    renderPage();
  }, [pdf, currentPage, scale, rotation, totalPages]);

  // Handle page range selection
  const handlePageRangeChange = (start: number, end: number) => {
    const validStart = Math.max(1, Math.min(start, totalPages));
    const validEnd = Math.max(validStart, Math.min(end, totalPages));
    
    setStartPage(validStart);
    setEndPage(validEnd);
    
    onPageRangeSelect?.(validStart, validEnd, totalPages);
  };

  // Handle format selection
  const handleFormatChange = (format: OutputFormat) => {
    setSelectedFormat(format);
    onFormatSelect?.(format);
  };

  // Navigation handlers
  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  const zoomIn = () => {
    setScale(prevScale => Math.min(prevScale + 0.25, 3.0));
  };

  const zoomOut = () => {
    setScale(prevScale => Math.max(prevScale - 0.25, 0.5));
  };

  const rotate = () => {
    setRotation(prevRotation => (prevRotation + 90) % 360);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-96 bg-red-50 rounded-lg border border-red-200 ${className}`}>
        <div className="text-center text-red-600">
          <FileText className="h-12 w-12 mx-auto mb-4" />
          <p className="font-medium">Error loading PDF</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          {/* Page navigation */}
          <div className="flex items-center space-x-2">
            <button
              onClick={goToPreviousPage}
              disabled={currentPage <= 1}
              className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={goToNextPage}
              disabled={currentPage >= totalPages}
              className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-2 border-l pl-4">
            <button
              onClick={zoomOut}
              disabled={scale <= 0.5}
              className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm font-medium w-12 text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={zoomIn}
              disabled={scale >= 3.0}
              className="p-1 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
          </div>

          {/* Rotate control */}
          <button
            onClick={rotate}
            className="p-1 rounded-md hover:bg-gray-200 border-l pl-4"
          >
            <RotateCw className="h-4 w-4" />
          </button>
        </div>

        {/* Page range toggle */}
        <button
          onClick={() => setIsRangeSelectionMode(!isRangeSelectionMode)}
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
            isRangeSelectionMode
              ? 'bg-blue-100 text-blue-700 border border-blue-300'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <Settings className="h-4 w-4 mr-1 inline" />
          Select Pages
        </button>
      </div>

      {/* Page range selection panel */}
      {isRangeSelectionMode && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Page range selection */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Select Page Range</h4>
              <div className="flex items-center space-x-3">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">From Page</label>
                  <input
                    type="number"
                    min="1"
                    max={totalPages}
                    value={startPage}
                    onChange={(e) => handlePageRangeChange(parseInt(e.target.value) || 1, endPage)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">To Page</label>
                  <input
                    type="number"
                    min={startPage}
                    max={totalPages}
                    value={endPage}
                    onChange={(e) => handlePageRangeChange(startPage, parseInt(e.target.value) || totalPages)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="text-xs text-gray-600 mt-4">
                  {endPage - startPage + 1} pages selected
                </div>
              </div>
            </div>

            {/* Output format selection */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Output Format</h4>
              <select
                value={selectedFormat.type}
                onChange={(e) => {
                  const format = OUTPUT_FORMATS.find(f => f.type === e.target.value) || OUTPUT_FORMATS[0];
                  handleFormatChange(format);
                }}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {OUTPUT_FORMATS.map((format) => (
                  <option key={format.type} value={format.type}>
                    {format.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">{selectedFormat.description}</p>
            </div>
          </div>
        </div>
      )}

      {/* PDF canvas container */}
      <div 
        ref={containerRef}
        className="overflow-auto max-h-96 flex justify-center p-4 bg-gray-100"
        style={{ maxHeight: '600px' }}
      >
        <canvas
          ref={canvasRef}
          className="border shadow-sm bg-white"
          style={{
            maxWidth: '100%',
            height: 'auto'
          }}
        />
      </div>

      {/* Footer with page info */}
      <div className="px-4 py-2 bg-gray-50 border-t text-center">
        <p className="text-xs text-gray-600">
          {file.name} • {totalPages} pages • {Math.round(file.size / 1024)} KB
          {isRangeSelectionMode && (
            <span className="ml-2 font-medium">
              • Processing pages {startPage}-{endPage} ({endPage - startPage + 1} pages)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}