# Server-Side PDF Implementation Guide

## Quick Start Code Examples

### Backend: PDF Processing Service

```typescript
// src/services/pdfImageProcessor.ts
import sharp from 'sharp';
import { fromPath } from 'pdf2pic';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';

export class PDFImageProcessor {
  private storageDir = './storage/pdfs';
  
  async convertPDFToImages(
    pdfBuffer: Buffer, 
    pdfId: string,
    options: {
      dpi?: number;
      format?: 'png' | 'webp' | 'jpeg';
      quality?: number;
    } = {}
  ) {
    const { dpi = 150, format = 'webp', quality = 85 } = options;
    
    // Save PDF temporarily
    const tempPath = `/tmp/${pdfId}.pdf`;
    await fs.writeFile(tempPath, pdfBuffer);
    
    // Convert to images
    const converter = fromPath(tempPath, {
      density: dpi,
      saveFilename: pdfId,
      savePath: `${this.storageDir}/${pdfId}/pages`,
      format: format.toUpperCase(),
      quality
    });
    
    const pageCount = await this.getPageCount(tempPath);
    
    // Convert all pages
    for (let i = 1; i <= pageCount; i++) {
      await converter(i);
    }
    
    // Cleanup temp file
    await fs.unlink(tempPath);
    
    return { pdfId, pageCount };
  }
  
  async getPageImage(
    pdfId: string, 
    pageNum: number, 
    thumbnail = false
  ): Promise<Buffer> {
    const imagePath = `${this.storageDir}/${pdfId}/pages/${pdfId}.${pageNum}.webp`;
    
    if (thumbnail) {
      // Generate thumbnail on the fly
      return sharp(imagePath)
        .resize(200, 300, { fit: 'inside' })
        .toBuffer();
    }
    
    return fs.readFile(imagePath);
  }
}
```

### API Endpoints

```typescript
// src/api/routes/pdf.ts
import express from 'express';
import multer from 'multer';
import { PDFImageProcessor } from '../services/pdfImageProcessor';

const router = express.Router();
const upload = multer({ memory: true });
const processor = new PDFImageProcessor();

// Upload and process PDF
router.post('/upload', upload.single('pdf'), async (req, res) => {
  try {
    const pdfId = uuidv4();
    const result = await processor.convertPDFToImages(
      req.file.buffer,
      pdfId
    );
    
    res.json({
      success: true,
      pdfId: result.pdfId,
      pageCount: result.pageCount
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get page image
router.get('/:pdfId/page/:pageNum', async (req, res) => {
  try {
    const { pdfId, pageNum } = req.params;
    const thumbnail = req.query.thumbnail === 'true';
    
    const imageBuffer = await processor.getPageImage(
      pdfId,
      parseInt(pageNum),
      thumbnail
    );
    
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=3600');
    res.send(imageBuffer);
  } catch (error) {
    res.status(404).json({ error: 'Page not found' });
  }
});
```

### Frontend: Server-Side PDF Viewer

```tsx
// src/components/ServerSidePDFViewer.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ChevronLeft, ChevronRight, Home, FileText, Loader2 } from 'lucide-react';

interface ServerSidePDFViewerProps {
  pdfId: string;
  totalPages: number;
  onPageRangeSelect?: (start: number, end: number) => void;
  selectedRange?: { start: number; end: number };
}

export default function ServerSidePDFViewer({
  pdfId,
  totalPages,
  onPageRangeSelect,
  selectedRange
}: ServerSidePDFViewerProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(totalPages);
  const [pageInput, setPageInput] = useState('1');
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Preload adjacent pages for smooth navigation
  useEffect(() => {
    const preloadPages = [
      currentPage - 1,
      currentPage + 1
    ].filter(p => p > 0 && p <= totalPages);
    
    preloadPages.forEach(pageNum => {
      const img = new Image();
      img.src = `/api/pdf/${pdfId}/page/${pageNum}`;
    });
  }, [currentPage, pdfId, totalPages]);
  
  // Keyboard navigation
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      switch(e.key) {
        case 'ArrowLeft':
          goToPreviousPage();
          break;
        case 'ArrowRight':
          goToNextPage();
          break;
        case 'Home':
          setCurrentPage(rangeStart);
          break;
        case 'End':
          setCurrentPage(rangeEnd);
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPage, rangeStart, rangeEnd]);
  
  const goToPreviousPage = () => {
    if (currentPage > rangeStart) {
      setCurrentPage(prev => prev - 1);
      setPageInput(String(currentPage - 1));
    }
  };
  
  const goToNextPage = () => {
    if (currentPage < rangeEnd) {
      setCurrentPage(prev => prev + 1);
      setPageInput(String(currentPage + 1));
    }
  };
  
  const handlePageInputSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const page = parseInt(pageInput);
    if (page >= rangeStart && page <= rangeEnd) {
      setCurrentPage(page);
    } else {
      setPageInput(String(currentPage));
    }
  };
  
  const handleRangeSelection = () => {
    if (onPageRangeSelect) {
      onPageRangeSelect(rangeStart, rangeEnd);
    }
  };
  
  const pageCount = rangeEnd - rangeStart + 1;
  const costEstimate = pageCount * 0.012;
  
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Navigation Bar */}
      <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={goToPreviousPage}
            disabled={currentPage <= rangeStart}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Page</span>
            <form onSubmit={handlePageInputSubmit}>
              <input
                type="number"
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value)}
                min={rangeStart}
                max={rangeEnd}
                className="w-16 px-2 py-1 border rounded text-center"
              />
            </form>
            <span className="text-sm text-gray-600">of {totalPages}</span>
          </div>
          
          <button
            onClick={goToNextPage}
            disabled={currentPage >= rangeEnd}
            className="p-2 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
        
        {/* Quick Navigation */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setCurrentPage(rangeStart)}
            className="p-2 rounded hover:bg-gray-100"
            title="First page"
          >
            <Home className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Page Display */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto p-4 flex justify-center"
      >
        <div className="max-w-4xl w-full">
          {loading && (
            <div className="flex items-center justify-center h-96">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          )}
          
          <img
            src={`/api/pdf/${pdfId}/page/${currentPage}`}
            alt={`Page ${currentPage}`}
            className="w-full shadow-lg rounded"
            onLoad={() => setLoading(false)}
            onLoadStart={() => setLoading(true)}
          />
          
          {/* Thumbnail Preview (optional) */}
          <div className="mt-4 flex space-x-2 overflow-x-auto py-2">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i;
              if (pageNum > totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`flex-shrink-0 border-2 rounded ${
                    pageNum === currentPage 
                      ? 'border-blue-500' 
                      : 'border-gray-300'
                  }`}
                >
                  <img
                    src={`/api/pdf/${pdfId}/page/${pageNum}?thumbnail=true`}
                    alt={`Page ${pageNum}`}
                    className="h-20 w-16 object-cover"
                  />
                </button>
              );
            }).filter(Boolean)}
          </div>
        </div>
      </div>
      
      {/* Page Range Selector */}
      <div className="bg-white border-t px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <FileText className="h-5 w-5 text-gray-600" />
            <span className="text-sm text-gray-600">Select pages to extract:</span>
            <input
              type="number"
              value={rangeStart}
              onChange={(e) => setRangeStart(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
              max={totalPages}
              className="w-16 px-2 py-1 border rounded text-center"
            />
            <span>to</span>
            <input
              type="number"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(Math.min(totalPages, parseInt(e.target.value) || totalPages))}
              min={1}
              max={totalPages}
              className="w-16 px-2 py-1 border rounded text-center"
            />
          </div>
          
          <div className="flex items-center space-x-4">
            <span className="text-sm text-gray-600">
              {pageCount} pages = ${costEstimate.toFixed(2)}
            </span>
            <button
              onClick={handleRangeSelection}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Apply Selection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

### Optimized Image Loading

```typescript
// src/hooks/useImagePreloader.ts
export function useImagePreloader(
  baseUrl: string,
  currentPage: number,
  totalPages: number,
  preloadRange = 2
) {
  useEffect(() => {
    const pages = [];
    
    // Preload previous pages
    for (let i = 1; i <= preloadRange; i++) {
      const page = currentPage - i;
      if (page > 0) pages.push(page);
    }
    
    // Preload next pages
    for (let i = 1; i <= preloadRange; i++) {
      const page = currentPage + i;
      if (page <= totalPages) pages.push(page);
    }
    
    // Load images
    pages.forEach(pageNum => {
      const img = new Image();
      img.src = `${baseUrl}/${pageNum}`;
    });
  }, [baseUrl, currentPage, totalPages, preloadRange]);
}
```

### Integration with Existing FileUpload

```tsx
// Update FileUpload.tsx
const handleProcessing = async () => {
  // Upload PDF and get ID
  const formData = new FormData();
  formData.append('pdf', selectedFile);
  
  const response = await fetch('/api/pdf/upload', {
    method: 'POST',
    body: formData
  });
  
  const { pdfId, pageCount } = await response.json();
  
  // Show server-side viewer
  setShowPDFViewer(true);
  setPdfData({ pdfId, pageCount });
};

// In render
{showPDFViewer && pdfData && (
  <ServerSidePDFViewer
    pdfId={pdfData.pdfId}
    totalPages={pdfData.pageCount}
    onPageRangeSelect={(start, end) => {
      setSelectedPageRange({ start, end });
      // Continue with text extraction
    }}
  />
)}