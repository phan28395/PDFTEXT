# Universal Document Preview System Implementation

## Overview
This document outlines the implementation of a flexible document preview system that works with multiple file types (PDF, Word, Excel, Images, etc.) with a consistent interface for range selection and preview.

## Architecture

### Core Concept
```
Upload → Analyze → Select Range → Generate Preview → Display
         ↓          ↓               ↓                ↓
    (metadata)  (pages/sheets)  (server process)  (vertical scroll)
```

## Implementation Steps

### Step 1: Create Document Type Abstraction

Create a unified interface for all document types:

```typescript
// src/types/document.ts
export interface DocumentMetadata {
  type: 'pdf' | 'docx' | 'xlsx' | 'image' | 'text';
  totalUnits: number;  // pages for PDF/Word, sheets for Excel, 1 for images
  unitName: string;    // "pages", "sheets", "slides", etc.
  fileName: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  additionalInfo?: Record<string, any>;
}

export interface DocumentProcessor {
  analyze(file: File | Buffer): Promise<DocumentMetadata>;
  generatePreview(file: File | Buffer, range: SelectionRange): Promise<PreviewData>;
  estimateCost(metadata: DocumentMetadata, range: SelectionRange): number;
}

export interface SelectionRange {
  start: number;
  end: number;
  all: boolean;
}

export interface PreviewData {
  units: PreviewUnit[];
  processingTime: number;
}

export interface PreviewUnit {
  index: number;
  imageUrl: string;
  thumbnail: string;
  text?: string;  // Extracted text preview
  metadata?: any;
}
```

### Step 2: Implement Document Processors

Create processors for each file type:

```typescript
// src/services/processors/pdfProcessor.ts
export class PDFProcessor implements DocumentProcessor {
  async analyze(file: File): Promise<DocumentMetadata> {
    // Use pdf-lib or similar to count pages
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    return {
      type: 'pdf',
      totalUnits: pdfDoc.getPageCount(),
      unitName: 'pages',
      fileName: file.name,
      fileSize: file.size,
    };
  }
  
  async generatePreview(file: File, range: SelectionRange): Promise<PreviewData> {
    // Server-side: Convert selected pages to images
    const formData = new FormData();
    formData.append('file', file);
    formData.append('range', JSON.stringify(range));
    
    const response = await fetch('/api/preview/pdf', {
      method: 'POST',
      body: formData
    });
    
    return response.json();
  }
  
  estimateCost(metadata: DocumentMetadata, range: SelectionRange): number {
    const units = range.all ? metadata.totalUnits : (range.end - range.start + 1);
    return units * 0.012; // $0.012 per page
  }
}

// src/services/processors/excelProcessor.ts
export class ExcelProcessor implements DocumentProcessor {
  async analyze(file: File): Promise<DocumentMetadata> {
    // Quick analysis without full parsing
    const formData = new FormData();
    formData.append('file', file);
    
    const response = await fetch('/api/analyze/excel', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    return {
      type: 'xlsx',
      totalUnits: data.sheetCount,
      unitName: 'sheets',
      fileName: file.name,
      fileSize: file.size,
      additionalInfo: {
        sheetNames: data.sheetNames,
        totalRows: data.totalRows
      }
    };
  }
  
  async generatePreview(file: File, range: SelectionRange): Promise<PreviewData> {
    // Convert selected sheets to images or HTML tables
    // Similar to PDF processor
  }
  
  estimateCost(metadata: DocumentMetadata, range: SelectionRange): number {
    // Excel might cost more due to complexity
    const units = range.all ? metadata.totalUnits : (range.end - range.start + 1);
    return units * 0.025; // $0.025 per sheet
  }
}
```

### Step 3: Create Document Preview Component

```tsx
// src/components/DocumentPreview/DocumentPreview.tsx
import React, { useState, useEffect } from 'react';
import { DocumentMetadata, SelectionRange, PreviewData } from '@/types/document';
import { getProcessor } from '@/services/documentProcessorFactory';
import RangeSelector from './RangeSelector';
import PreviewDisplay from './PreviewDisplay';
import DocumentInfo from './DocumentInfo';

interface DocumentPreviewProps {
  file: File;
  onConfirm: (range: SelectionRange) => void;
}

export default function DocumentPreview({ file, onConfirm }: DocumentPreviewProps) {
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [selectedRange, setSelectedRange] = useState<SelectionRange>({
    start: 1,
    end: 1,
    all: false
  });
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [cost, setCost] = useState(0);
  
  // Analyze document on mount
  useEffect(() => {
    analyzeDocument();
  }, [file]);
  
  const analyzeDocument = async () => {
    setLoading(true);
    try {
      const processor = getProcessor(file.type);
      const meta = await processor.analyze(file);
      setMetadata(meta);
      setSelectedRange({
        start: 1,
        end: meta.totalUnits,
        all: true
      });
    } catch (error) {
      console.error('Failed to analyze document:', error);
    } finally {
      setLoading(false);
    }
  };
  
  // Generate preview when range changes
  useEffect(() => {
    if (metadata && selectedRange) {
      generatePreview();
    }
  }, [selectedRange, metadata]);
  
  const generatePreview = async () => {
    if (!metadata) return;
    
    setLoading(true);
    try {
      const processor = getProcessor(metadata.type);
      const preview = await processor.generatePreview(file, selectedRange);
      setPreviewData(preview);
      
      // Calculate cost
      const estimatedCost = processor.estimateCost(metadata, selectedRange);
      setCost(estimatedCost);
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="flex h-full">
      {/* Left Panel: Document Info & Range Selection */}
      <div className="w-1/3 bg-white border-r p-6 space-y-6">
        <DocumentInfo metadata={metadata} loading={loading} />
        
        {metadata && (
          <>
            <RangeSelector
              metadata={metadata}
              value={selectedRange}
              onChange={setSelectedRange}
            />
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900">Processing Cost</h4>
              <p className="text-2xl font-bold text-blue-600">
                ${cost.toFixed(2)}
              </p>
              <p className="text-sm text-blue-700">
                {selectedRange.all ? metadata.totalUnits : (selectedRange.end - selectedRange.start + 1)} {metadata.unitName}
              </p>
            </div>
            
            <button
              onClick={() => onConfirm(selectedRange)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Process Selected {metadata.unitName}
            </button>
          </>
        )}
      </div>
      
      {/* Right Panel: Preview Display */}
      <div className="flex-1 bg-gray-50">
        <PreviewDisplay 
          previewData={previewData}
          loading={loading}
          metadata={metadata}
        />
      </div>
    </div>
  );
}
```

### Step 4: Create Range Selector Component

```tsx
// src/components/DocumentPreview/RangeSelector.tsx
interface RangeSelectorProps {
  metadata: DocumentMetadata;
  value: SelectionRange;
  onChange: (range: SelectionRange) => void;
}

export default function RangeSelector({ metadata, value, onChange }: RangeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">
        Select {metadata.unitName} to process
      </h3>
      
      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ start: 1, end: metadata.totalUnits, all: true })}
          className={`px-4 py-2 rounded ${
            value.all ? 'bg-blue-600 text-white' : 'bg-gray-100'
          }`}
        >
          All {metadata.unitName}
        </button>
        
        <button
          onClick={() => onChange({ start: 1, end: 1, all: false })}
          className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          First {metadata.unitName.slice(0, -1)}
        </button>
      </div>
      
      {/* Custom Range */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Custom Range
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={metadata.totalUnits}
            value={value.start}
            onChange={(e) => onChange({
              ...value,
              start: parseInt(e.target.value) || 1,
              all: false
            })}
            className="w-20 px-3 py-2 border rounded"
          />
          <span>to</span>
          <input
            type="number"
            min={1}
            max={metadata.totalUnits}
            value={value.end}
            onChange={(e) => onChange({
              ...value,
              end: parseInt(e.target.value) || metadata.totalUnits,
              all: false
            })}
            className="w-20 px-3 py-2 border rounded"
          />
          <span className="text-sm text-gray-500">
            of {metadata.totalUnits}
          </span>
        </div>
      </div>
      
      {/* Visual Range Indicator */}
      <div className="mt-4">
        <div className="h-2 bg-gray-200 rounded-full relative">
          <div
            className="absolute h-full bg-blue-600 rounded-full"
            style={{
              left: `${((value.start - 1) / metadata.totalUnits) * 100}%`,
              width: `${((value.end - value.start + 1) / metadata.totalUnits) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
}
```

### Step 5: Create Preview Display Component

```tsx
// src/components/DocumentPreview/PreviewDisplay.tsx
import { useVirtualizer } from '@tanstack/react-virtual';
import { PreviewData, DocumentMetadata } from '@/types/document';

interface PreviewDisplayProps {
  previewData: PreviewData | null;
  loading: boolean;
  metadata: DocumentMetadata | null;
}

export default function PreviewDisplay({ 
  previewData, 
  loading, 
  metadata 
}: PreviewDisplayProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Virtual scrolling for performance
  const virtualizer = useVirtualizer({
    count: previewData?.units.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 800, // Estimated height of each preview
    overscan: 2,
  });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Generating preview...</p>
        </div>
      </div>
    );
  }
  
  if (!previewData || previewData.units.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Select {metadata?.unitName} to preview</p>
      </div>
    );
  }
  
  return (
    <div ref={parentRef} className="h-full overflow-auto p-6">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const unit = previewData.units[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <PreviewUnit unit={unit} metadata={metadata} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Individual preview unit component
function PreviewUnit({ unit, metadata }: { unit: PreviewUnit; metadata: DocumentMetadata }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-gray-900">
          {metadata.unitName.slice(0, -1)} {unit.index}
        </h4>
        {unit.text && (
          <span className="text-sm text-gray-500">
            {unit.text.split(' ').length} words detected
          </span>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <img
          src={unit.imageUrl}
          alt={`${metadata.unitName.slice(0, -1)} ${unit.index}`}
          className="w-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}
```

### Step 6: Create Backend Preview Generators

```typescript
// src/api/services/previewGenerators/pdfPreviewGenerator.ts
import { fromBuffer } from 'pdf2pic';
import sharp from 'sharp';

export async function generatePDFPreview(
  buffer: Buffer,
  range: { start: number; end: number; all: boolean },
  options = {}
): Promise<PreviewUnit[]> {
  const converter = fromBuffer(buffer, {
    density: 150,
    format: 'webp',
    quality: 85,
    ...options
  });
  
  // Get page count
  const pdfDoc = await PDFDocument.load(buffer);
  const pageCount = pdfDoc.getPageCount();
  
  // Determine pages to convert
  const startPage = range.all ? 1 : range.start;
  const endPage = range.all ? pageCount : Math.min(range.end, pageCount);
  
  const units: PreviewUnit[] = [];
  
  for (let i = startPage; i <= endPage; i++) {
    const page = await converter(i);
    
    // Generate thumbnail
    const thumbnail = await sharp(page.buffer)
      .resize(200, 300, { fit: 'inside' })
      .toBuffer();
    
    // Store in temporary storage and get URLs
    const imageUrl = await storeTemporary(page.buffer, `page-${i}.webp`);
    const thumbnailUrl = await storeTemporary(thumbnail, `thumb-${i}.webp`);
    
    units.push({
      index: i,
      imageUrl,
      thumbnail: thumbnailUrl,
      text: await extractTextFromPage(buffer, i) // Optional
    });
  }
  
  return units;
}

// Excel preview generator
export async function generateExcelPreview(
  buffer: Buffer,
  range: { start: number; end: number; all: boolean }
): Promise<PreviewUnit[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  
  const sheets = range.all 
    ? workbook.worksheets 
    : workbook.worksheets.slice(range.start - 1, range.end);
  
  const units: PreviewUnit[] = [];
  
  for (const [index, sheet] of sheets.entries()) {
    // Convert sheet to HTML table or image
    const html = await sheetToHTML(sheet);
    const image = await htmlToImage(html);
    
    const imageUrl = await storeTemporary(image, `sheet-${index + 1}.webp`);
    
    units.push({
      index: index + 1,
      imageUrl,
      thumbnail: imageUrl, // Could generate smaller version
      text: sheet.name,
      metadata: {
        rowCount: sheet.rowCount,
        columnCount: sheet.columnCount
      }
    });
  }
  
  return units;
}
```

### Step 7: Integrate with Existing FileUpload

```tsx
// Update FileUpload.tsx
import DocumentPreview from '@/components/DocumentPreview/DocumentPreview';

// Replace the PDF viewer section with:
{showDocumentPreview && selectedFile && (
  <DocumentPreview
    file={selectedFile}
    onConfirm={async (range) => {
      setSelectedRange(range);
      // Continue with processing
      await handleProcessing(selectedFile, range);
    }}
  />
)}
```

### Step 8: Add Support for More File Types

```typescript
// src/services/processors/imageProcessor.ts
export class ImageProcessor implements DocumentProcessor {
  async analyze(file: File): Promise<DocumentMetadata> {
    return {
      type: 'image',
      totalUnits: 1,
      unitName: 'images',
      fileName: file.name,
      fileSize: file.size,
      dimensions: await getImageDimensions(file)
    };
  }
  
  async generatePreview(file: File): Promise<PreviewData> {
    const url = URL.createObjectURL(file);
    return {
      units: [{
        index: 1,
        imageUrl: url,
        thumbnail: url
      }],
      processingTime: 0
    };
  }
}

// src/services/processors/wordProcessor.ts
export class WordProcessor implements DocumentProcessor {
  // Similar to PDF but for DOCX files
  // Use mammoth.js or server-side conversion
}
```

### Step 9: Factory Pattern for Processors

```typescript
// src/services/documentProcessorFactory.ts
import { PDFProcessor } from './processors/pdfProcessor';
import { ExcelProcessor } from './processors/excelProcessor';
import { WordProcessor } from './processors/wordProcessor';
import { ImageProcessor } from './processors/imageProcessor';

const processors = {
  'application/pdf': new PDFProcessor(),
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': new ExcelProcessor(),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': new WordProcessor(),
  'image/jpeg': new ImageProcessor(),
  'image/png': new ImageProcessor(),
  'image/webp': new ImageProcessor(),
};

export function getProcessor(mimeType: string): DocumentProcessor {
  const processor = processors[mimeType];
  if (!processor) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  return processor;
}

export function isSupportedType(mimeType: string): boolean {
  return mimeType in processors;
}
```

### Step 10: Performance Optimizations

```typescript
// src/hooks/useDocumentPreview.ts
export function useDocumentPreview(file: File) {
  const [state, setState] = useState({
    metadata: null,
    previewData: null,
    loading: false,
    error: null
  });
  
  // Cache preview data
  const previewCache = useRef(new Map());
  
  const generatePreview = useCallback(async (range: SelectionRange) => {
    const cacheKey = `${range.start}-${range.end}-${range.all}`;
    
    // Check cache
    if (previewCache.current.has(cacheKey)) {
      setState(prev => ({
        ...prev,
        previewData: previewCache.current.get(cacheKey)
      }));
      return;
    }
    
    // Generate new preview
    setState(prev => ({ ...prev, loading: true }));
    
    try {
      const processor = getProcessor(file.type);
      const preview = await processor.generatePreview(file, range);
      
      // Cache result
      previewCache.current.set(cacheKey, preview);
      
      setState(prev => ({
        ...prev,
        previewData: preview,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error.message,
        loading: false
      }));
    }
  }, [file]);
  
  return { ...state, generatePreview };
}
```

## Testing Checklist

- [ ] Test PDF with 1, 10, 100+ pages
- [ ] Test Excel with multiple sheets
- [ ] Test Word documents
- [ ] Test various image formats
- [ ] Test range selection edge cases
- [ ] Test preview scrolling performance
- [ ] Test on mobile devices
- [ ] Test error handling
- [ ] Test concurrent file uploads

## Security Considerations

1. **File Validation**: Always validate file type and size server-side
2. **Resource Limits**: Limit preview generation (max pages, timeout)
3. **Access Control**: Ensure users can only access their own previews
4. **Cleanup**: Auto-delete preview images after processing
5. **Rate Limiting**: Prevent abuse of preview generation

## Future Enhancements

1. **Add OCR**: Extract text from images in PDFs
2. **Smart Selection**: Auto-detect important pages
3. **Batch Processing**: Handle multiple files
4. **Preview Caching**: Cache common document previews
5. **Progressive Loading**: Load previews as user scrolls