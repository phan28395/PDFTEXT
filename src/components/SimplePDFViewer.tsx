import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Settings, FileText } from 'lucide-react';

interface SimplePDFViewerProps {
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

export default function SimplePDFViewer({ file, onPageRangeSelect, onFormatSelect, className = '' }: SimplePDFViewerProps) {
  const [estimatedPages, setEstimatedPages] = useState(1);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  const [selectedFormat, setSelectedFormat] = useState<OutputFormat>(OUTPUT_FORMATS[0]);
  const [isRangeSelectionMode, setIsRangeSelectionMode] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  // Create object URL for PDF display
  useEffect(() => {
    if (file && file.type === 'application/pdf') {
      const url = URL.createObjectURL(file);
      setPdfUrl(url);
      
      // Estimate pages based on file size (rough estimate: 50KB per page)
      const estimated = Math.max(1, Math.ceil(file.size / 51200));
      setEstimatedPages(estimated);
      setEndPage(estimated);
      
      // Notify parent about initial range
      onPageRangeSelect?.(1, estimated, estimated);
      
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file, onPageRangeSelect]);

  // Handle page range selection
  const handlePageRangeChange = (start: number, end: number) => {
    const validStart = Math.max(1, Math.min(start, estimatedPages));
    const validEnd = Math.max(validStart, Math.min(end, estimatedPages));
    
    setStartPage(validStart);
    setEndPage(validEnd);
    
    onPageRangeSelect?.(validStart, validEnd, estimatedPages);
  };

  // Handle format selection
  const handleFormatChange = (format: OutputFormat) => {
    setSelectedFormat(format);
    onFormatSelect?.(format);
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50">
        <div className="flex items-center space-x-4">
          <FileText className="h-5 w-5 text-blue-600" />
          <div>
            <h3 className="font-medium text-gray-900">{file.name}</h3>
            <p className="text-sm text-gray-500">
              {Math.round(file.size / 1024)} KB • Est. {estimatedPages} pages
            </p>
          </div>
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
                    max={estimatedPages}
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
                    max={estimatedPages}
                    value={endPage}
                    onChange={(e) => handlePageRangeChange(startPage, parseInt(e.target.value) || estimatedPages)}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="text-xs text-gray-600 mt-4">
                  {endPage - startPage + 1} pages selected
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Note: Page count is estimated based on file size. Actual page count will be determined during processing.
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

      {/* PDF Preview */}
      <div className="p-4">
        {pdfUrl ? (
          <div className="border rounded-lg overflow-hidden">
            <embed
              src={pdfUrl}
              type="application/pdf"
              width="100%"
              height="400px"
              className="w-full"
            />
            <div className="p-2 bg-gray-50 text-center text-xs text-gray-600">
              PDF Preview - Use browser controls to navigate pages
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-center text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-2" />
              <p>PDF preview not available</p>
              <p className="text-sm">File will be processed normally</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer with processing info */}
      <div className="px-4 py-2 bg-gray-50 border-t text-center">
        <p className="text-xs text-gray-600">
          Processing pages {startPage}-{endPage} ({endPage - startPage + 1} pages) in {selectedFormat.name} format
        </p>
      </div>
    </div>
  );
}