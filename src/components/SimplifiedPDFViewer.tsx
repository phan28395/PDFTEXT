import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCw, FileText, Settings } from 'lucide-react';

// We'll use PDF.js in the simplest possible way - no workers, just basic rendering
// This is a fallback that should work in any environment

interface SimplifiedPDFViewerProps {
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

export default function SimplifiedPDFViewer({ 
  file, 
  onPageRangeSelect, 
  onFormatSelect, 
  className = '' 
}: SimplifiedPDFViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [isRangeSelectionMode, setIsRangeSelectionMode] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>(OUTPUT_FORMATS[0]);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!file) return;

    // For now, just show a preview indicating the file was loaded
    // The actual PDF processing will happen server-side
    setIsLoading(false);
    setTotalPages(1); // We'll get the actual page count from the server
    
    // Notify parent
    if (onPageRangeSelect) {
      onPageRangeSelect(1, 1, 1);
    }
  }, [file, onPageRangeSelect]);

  // Handle page range selection
  const handlePageRangeChange = (start: number, end: number) => {
    const validStart = Math.max(1, Math.min(start, totalPages));
    const validEnd = Math.max(validStart, Math.min(end, totalPages));
    
    setStartPage(validStart);
    setEndPage(validEnd);
    
    if (onPageRangeSelect) {
      onPageRangeSelect(validStart, validEnd, totalPages);
    }
  };

  // Handle format selection
  const handleFormatChange = (format: OutputFormat) => {
    setSelectedFormat(format);
    if (onFormatSelect) {
      onFormatSelect(format);
    }
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-96 bg-gray-50 rounded-lg ${className}`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading PDF preview...</p>
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
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          <FileText className="h-5 w-5 text-gray-600" />
          <span className="text-sm font-medium text-gray-700">
            PDF Preview
          </span>
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
          Processing Options
        </button>
      </div>

      {/* Options panel */}
      {isRangeSelectionMode && (
        <div className="p-4 bg-blue-50 border-b">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Info message */}
            <div className="md:col-span-2">
              <p className="text-sm text-blue-700 mb-3">
                <strong>Note:</strong> Page selection and format options will be applied during processing.
                The actual PDF content will be extracted server-side for security and performance.
              </p>
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

      {/* Preview area */}
      <div className="p-8 text-center bg-gray-50">
        <FileText className="h-24 w-24 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {file.name}
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Size: {(file.size / 1024 / 1024).toFixed(2)} MB
        </p>
        <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded-md">
          <svg className="h-5 w-5 mr-2" fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" stroke="currentColor">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Ready for processing
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-gray-50 border-t text-center">
        <p className="text-xs text-gray-600">
          PDF content will be securely processed on our servers
        </p>
      </div>
    </div>
  );
}