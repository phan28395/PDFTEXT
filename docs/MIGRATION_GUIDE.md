# Migration Guide: Client-Side to Server-Side PDF Processing

## Overview
Step-by-step guide to migrate from problematic client-side PDF.js to robust server-side image rendering.

## Migration Steps

### Step 1: Install Backend Dependencies

```bash
# Core dependencies
npm install --save pdf2pic sharp multer
npm install --save @types/multer @types/sharp

# Optional for better performance
npm install --save pdf-poppler-utils  # Linux only
npm install --save gm                  # GraphicsMagick
npm install --save bull redis          # For queuing

# For production
npm install --save aws-sdk             # S3 storage
npm install --save express-rate-limit  # Rate limiting
```

### Step 2: Create Basic PDF Processor

Start with a minimal implementation:

```typescript
// src/api/services/simplePdfProcessor.ts
import { fromPath } from 'pdf2pic';
import fs from 'fs/promises';
import path from 'path';

export async function convertPdfPage(
  pdfPath: string,
  pageNumber: number
): Promise<Buffer> {
  const converter = fromPath(pdfPath, {
    density: 150,
    format: 'webp',
    quality: 85
  });
  
  const page = await converter(pageNumber);
  return page.buffer;
}
```

### Step 3: Add API Endpoint

```typescript
// src/api/routes/pdf-basic.ts
router.post('/convert-page', upload.single('pdf'), async (req, res) => {
  const { pageNumber = 1 } = req.body;
  
  // Save temporarily
  const tempPath = `/tmp/${Date.now()}.pdf`;
  await fs.writeFile(tempPath, req.file.buffer);
  
  try {
    const imageBuffer = await convertPdfPage(tempPath, pageNumber);
    res.contentType('image/webp').send(imageBuffer);
  } finally {
    await fs.unlink(tempPath);
  }
});
```

### Step 4: Create Transition Component

Keep both viewers during migration:

```tsx
// src/components/PDFViewerWrapper.tsx
export function PDFViewerWrapper({ file, ...props }) {
  const useServerSide = process.env.REACT_APP_USE_SERVER_PDF === 'true';
  
  if (useServerSide) {
    return <ServerSidePDFViewer file={file} {...props} />;
  }
  
  // Fallback to SimplifiedPDFViewer
  return <SimplifiedPDFViewer file={file} {...props} />;
}
```

### Step 5: Implement Minimal Server Viewer

```tsx
// src/components/MinimalServerPDFViewer.tsx
export function MinimalServerPDFViewer({ file }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [imageUrl, setImageUrl] = useState('');
  
  useEffect(() => {
    // Upload and get first page
    const formData = new FormData();
    formData.append('pdf', file);
    formData.append('pageNumber', '1');
    
    fetch('/api/pdf/convert-page', {
      method: 'POST',
      body: formData
    })
    .then(res => res.blob())
    .then(blob => {
      setImageUrl(URL.createObjectURL(blob));
    });
  }, [file]);
  
  return (
    <div>
      <img src={imageUrl} alt="PDF Page" />
      <button onClick={() => setCurrentPage(p => p - 1)}>Previous</button>
      <button onClick={() => setCurrentPage(p => p + 1)}>Next</button>
    </div>
  );
}
```

### Step 6: Update FileUpload Component

```tsx
// Modify FileUpload.tsx
const [viewerMode, setViewerMode] = useState<'client' | 'server'>('server');

// In the render section, replace PDFViewer with:
{showPDFViewer && selectedFile && (
  viewerMode === 'server' ? (
    <ServerSidePDFViewer
      file={selectedFile}
      onPageRangeSelect={handlePageRangeSelect}
    />
  ) : (
    <SimplifiedPDFViewer
      file={selectedFile}
      onPageRangeSelect={handlePageRangeSelect}
    />
  )
)}
```

### Step 7: Database Schema Updates

```sql
-- Add table for PDF processing jobs
CREATE TABLE pdf_processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  pdf_id VARCHAR(255) UNIQUE NOT NULL,
  original_filename VARCHAR(255),
  page_count INTEGER,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
);

-- Add indexes
CREATE INDEX idx_pdf_jobs_user ON pdf_processing_jobs(user_id);
CREATE INDEX idx_pdf_jobs_status ON pdf_processing_jobs(status);
CREATE INDEX idx_pdf_jobs_expires ON pdf_processing_jobs(expires_at);
```

### Step 8: Gradual Feature Rollout

```typescript
// src/config/featureFlags.ts
export const features = {
  serverSidePdf: {
    enabled: process.env.NODE_ENV === 'development',
    rolloutPercentage: 10, // 10% of users
    
    isEnabled(userId: string): boolean {
      if (!this.enabled) return false;
      
      // Consistent rollout based on user ID
      const hash = userId.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      return Math.abs(hash) % 100 < this.rolloutPercentage;
    }
  }
};
```

### Step 9: Remove Old Dependencies

Once migration is complete:

```bash
# Remove client-side PDF dependencies
npm uninstall pdfjs-dist

# Clean up old worker files
rm -rf public/pdf-worker*
rm -rf public/cmaps
rm -rf public/standard_fonts
```

### Step 10: Update Environment Variables

```env
# .env.production
REACT_APP_USE_SERVER_PDF=true
PDF_PROCESSING_TIMEOUT=30000
PDF_MAX_FILE_SIZE=52428800
PDF_STORAGE_PATH=/var/pdf-storage
```

## Testing Checklist

- [ ] Upload small PDF (< 5 pages)
- [ ] Upload large PDF (> 100 pages)
- [ ] Test page navigation
- [ ] Test range selection
- [ ] Test on mobile devices
- [ ] Test with slow network
- [ ] Test error scenarios
- [ ] Load test with concurrent users

## Rollback Plan

If issues arise:

1. Set `REACT_APP_USE_SERVER_PDF=false`
2. Restart application
3. Users automatically fallback to client-side viewer
4. Investigate and fix issues
5. Re-enable when ready

## Monitoring Migration

```typescript
// Track usage
analytics.track('pdf_viewer_mode', {
  mode: useServerSide ? 'server' : 'client',
  userId: user.id,
  fileSize: file.size,
  pageCount: totalPages
});

// Monitor performance
performance.mark('pdf-render-start');
// ... rendering ...
performance.mark('pdf-render-end');
performance.measure('pdf-render', 'pdf-render-start', 'pdf-render-end');
```

## Success Metrics

- ✅ No more CSP errors
- ✅ First page loads < 2s
- ✅ Works on all browsers
- ✅ Reduced client memory usage
- ✅ Better mobile performance