# Server-Side PDF Processing Implementation Plan

## Overview
Replace client-side PDF.js with server-side PDF processing that converts PDF pages to images, eliminating all CSP and worker issues while providing better performance and compatibility.

## Architecture

### Data Flow
```
1. User uploads PDF
   ↓
2. Server stores original PDF
   ↓
3. Server converts PDF → Images (on-demand or pre-process)
   ↓
4. Serve images to client viewer
   ↓
5. User selects page range
   ↓
6. Extract text from selected pages only
```

## Backend Implementation

### 1. API Endpoints

```typescript
// PDF Processing endpoints
POST   /api/pdf/upload          // Upload PDF, returns processing job ID
GET    /api/pdf/:id/info        // Get PDF metadata (page count, size, etc.)
GET    /api/pdf/:id/page/:num   // Get specific page as image
GET    /api/pdf/:id/thumbnail/:num // Get page thumbnail
POST   /api/pdf/:id/process     // Process specific page range to text
DELETE /api/pdf/:id             // Clean up PDF and associated images
```

### 2. PDF Processing Service

```typescript
interface PDFProcessor {
  // Convert PDF to images using one of these approaches:
  // Option A: Sharp + PDF.js (Node.js)
  // Option B: Puppeteer (headless Chrome)
  // Option C: Google Document AI (existing integration)
  // Option D: pdf2image/ImageMagick
  
  uploadPDF(file: Buffer): Promise<string>; // Returns PDF ID
  convertToImages(pdfId: string): Promise<void>;
  getPageImage(pdfId: string, pageNum: number, options?: ImageOptions): Promise<Buffer>;
  extractText(pdfId: string, startPage: number, endPage: number): Promise<string>;
  cleanup(pdfId: string): Promise<void>;
}

interface ImageOptions {
  width?: number;
  height?: number;
  format?: 'png' | 'webp' | 'jpeg';
  quality?: number;
  thumbnail?: boolean;
}
```

### 3. Storage Strategy

```
Option A: Filesystem
/storage/
  /pdfs/
    /{userId}/
      /{pdfId}/
        /original.pdf
        /pages/
          /1.webp
          /2.webp
          /thumbnails/
            /1.webp
            
Option B: Supabase Storage
- Store in buckets with proper access control
- Use signed URLs for security
- Automatic CDN distribution

Option C: Redis/Memory Cache
- Cache frequently accessed pages
- Auto-expire after X minutes
```

### 4. Processing Options Comparison

| Method | Pros | Cons | Best For |
|--------|------|------|----------|
| Sharp + pdf-poppler | Fast, lightweight | Linux dependencies | Small-medium PDFs |
| Puppeteer | Accurate rendering | Resource heavy | Complex PDFs |
| Google Document AI | Already integrated, OCR capable | API costs | Text extraction focus |
| ImageMagick | Mature, reliable | Security concerns | Simple conversions |

## Frontend Implementation

### 1. New Viewer Component Structure

```typescript
// ServerSidePDFViewer.tsx
interface ServerSidePDFViewerProps {
  pdfId: string;
  totalPages: number;
  onPageRangeSelect?: (start: number, end: number) => void;
  selectedRange?: { start: number; end: number };
}

// Features:
- Lazy loading images as user scrolls
- Smooth page transitions
- Keyboard navigation (arrows, page up/down)
- Touch gestures for mobile
- Zoom functionality (CSS transform)
```

### 2. UI Components

```
┌─────────────────────────────────────┐
│ ┌─────────────────────────────────┐ │
│ │  Page 1 of 10  [<] [>]  Go: [5] │ │ ← Navigation Bar
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │     Page Image Display          │ │ ← Scrollable Container
│ │                                 │ │
│ │  [Lazy loaded images]           │ │
│ │                                 │ │
│ └─────────────────────────────────┘ │
│ ┌─────────────────────────────────┐ │
│ │ Select pages: [1] to [5] ✓     │ │ ← Range Selector
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3. Page Navigation Features

```typescript
// Navigation methods
- Direct page input: Type page number and press Enter
- Arrow buttons: Previous/Next page
- Keyboard shortcuts: 
  - Arrow keys: prev/next
  - Home/End: first/last
  - Page Up/Down: scroll
- Scroll wheel: Natural scrolling through pages
- Touch: Swipe gestures
- Thumbnail sidebar (optional)
```

### 4. Page Range Selection

```typescript
interface PageRangeSelector {
  // Visual feedback
  - Highlight selected range
  - Show page previews on hover
  - Disable pages outside range
  
  // Interaction
  - Click and drag to select range
  - Or use input fields: "From page [ ] to [ ]"
  - Show cost preview: "5 pages = $0.06"
  
  // Integration
  - Update viewer to show only selected pages
  - Pass range to text extraction API
}
```

## Implementation Phases

### Phase 1: Basic Infrastructure (Week 1)
- [ ] Set up backend PDF processing endpoint
- [ ] Implement basic PDF to image conversion
- [ ] Create simple image viewer component
- [ ] Replace existing PDFViewer

### Phase 2: Navigation & Controls (Week 2)
- [ ] Add page navigation controls
- [ ] Implement keyboard shortcuts
- [ ] Add loading states and progress
- [ ] Optimize image lazy loading

### Phase 3: Range Selection (Week 3)
- [ ] Build page range selector UI
- [ ] Integrate with viewer limitations
- [ ] Connect to text extraction
- [ ] Add cost calculation display

### Phase 4: Optimization (Week 4)
- [ ] Add image caching layer
- [ ] Implement progressive loading
- [ ] Add error recovery
- [ ] Performance monitoring

## Technical Decisions Needed

1. **PDF Processing Library**
   - Recommended: `sharp` + `pdf-poppler` for speed
   - Alternative: Puppeteer for accuracy

2. **Image Format**
   - WebP for modern browsers (smaller size)
   - JPEG fallback for compatibility
   - PNG for documents with transparency

3. **Caching Strategy**
   - Pre-generate all pages vs on-demand
   - Cache duration (1 hour? 24 hours?)
   - Storage limits per user

4. **Resolution Strategy**
   - Desktop: 150-200 DPI equivalent
   - Mobile: 100-150 DPI
   - Thumbnails: 72 DPI

## Security Considerations

1. **Access Control**
   - Verify user owns PDF before serving images
   - Use signed URLs with expiration
   - Rate limit image requests

2. **Resource Limits**
   - Max PDF size (50MB?)
   - Max pages to process (1000?)
   - Concurrent processing jobs per user

3. **Cleanup Policy**
   - Auto-delete after 24 hours
   - Or delete after successful text extraction
   - Manual cleanup option

## Performance Metrics

- Target: < 2s to display first page
- Image load time: < 500ms per page
- Memory usage: < 100MB client-side
- Support PDFs up to 1000 pages

## Fallback Strategy

If server-side processing fails:
1. Fall back to simple iframe viewer
2. Offer direct PDF download
3. Show error with explanation

## Cost Estimates

- Storage: ~1MB per PDF page as image
- Processing: ~1s CPU time per page
- Bandwidth: ~100KB per page served
- Estimated cost: ~$0.001 per page processed