import React, { useState } from 'react';
import { CloudinaryService } from '@/services/cloudinary';

interface PDFPreviewProps {
  publicId: string;
  totalPages: number;
  onPageRangeSelect: (start: number, end: number) => void;
}

export default function PDFPreview({ publicId, totalPages, onPageRangeSelect }: PDFPreviewProps) {
  const cloudinary = new CloudinaryService();
  const [selectedRange, setSelectedRange] = useState({ start: 1, end: totalPages });
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Show only first and last page for preview
  const firstPageUrl = cloudinary.getPreviewUrl(publicId, 1, 600);
  const lastPageUrl = totalPages > 1 ? cloudinary.getPreviewUrl(publicId, totalPages, 600) : null;
  
  const handleProcess = () => {
    setIsProcessing(true);
    onPageRangeSelect(selectedRange.start, selectedRange.end);
  };
  
  return (
    <div className="space-y-6">
      {/* Preview Images */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-gray-700">First Page</h3>
          <div className="border rounded-lg overflow-hidden bg-gray-50">
            <img 
              src={firstPageUrl} 
              alt="First page preview" 
              className="w-full h-auto"
              loading="lazy"
            />
          </div>
        </div>
        
        {lastPageUrl && (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700">Last Page</h3>
            <div className="border rounded-lg overflow-hidden bg-gray-50">
              <img 
                src={lastPageUrl} 
                alt="Last page preview" 
                className="w-full h-auto"
                loading="lazy"
              />
            </div>
          </div>
        )}
      </div>
      
      {/* Page Range Selection */}
      <div className="bg-gray-50 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            Total pages: {totalPages}
          </span>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label htmlFor="start-page" className="block text-sm font-medium text-gray-700 mb-1">
              From page
            </label>
            <input
              id="start-page"
              type="number"
              min="1"
              max={totalPages}
              value={selectedRange.start}
              onChange={(e) => setSelectedRange({
                ...selectedRange, 
                start: Math.max(1, Math.min(+e.target.value, selectedRange.end))
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>
          
          <div className="flex-1">
            <label htmlFor="end-page" className="block text-sm font-medium text-gray-700 mb-1">
              To page
            </label>
            <input
              id="end-page"
              type="number"
              min="1"
              max={totalPages}
              value={selectedRange.end}
              onChange={(e) => setSelectedRange({
                ...selectedRange, 
                end: Math.max(selectedRange.start, Math.min(+e.target.value, totalPages))
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
        
        <button
          onClick={handleProcess}
          disabled={isProcessing}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isProcessing ? 'Processing...' : `Process ${selectedRange.end - selectedRange.start + 1} page(s)`}
        </button>
      </div>
    </div>
  );
}