# PDF-TO-TEXT Project Restructuring Plan

## Current State Analysis

### Problems Identified
1. **Supabase Edge Function Limitations**
   - `supabase/functions/process-pdf/index.ts` doesn't convert PDF to images
   - Only stores PDFs, not actual image previews
   - Comments indicate "In production, use pdf-to-image service" - never implemented

2. **Complex Upload Flow**
   - PDF → Vercel → Supabase Storage → Edge Function → Still PDFs
   - Multiple points of failure
   - Unnecessary bandwidth usage

3. **CSP Blocking PDF.js**
   - Multiple attempts to use PDF.js failed due to strict CSP
   - SimplifiedPDFViewer.tsx doesn't actually render PDFs
   - Fallback solutions not working

4. **Redundant Components**
   - Three PDF viewer components (PDFViewer, SimplePDFViewer, SimplifiedPDFViewer)
   - Complex document preview system that doesn't work
   - Unnecessary abstraction layers

## New Architecture: Cloudinary-Based Solution

### Core Services
- **Vercel**: Frontend hosting only
- **Supabase**: Database (users, history, results)
- **Cloudinary**: PDF upload, metrics, preview generation
- **Google Document AI**: Text extraction
- **No Supabase Storage or Edge Functions for PDFs**

### Data Flow
```
1. User → Cloudinary (direct upload)
2. Cloudinary → Metrics & Preview URLs
3. User selects pages → Google Document AI
4. Results → Supabase DB
5. Download → Generated from Vercel
```

## Implementation Plan

### Phase 1: Setup Cloudinary

#### Step 1.1: Create Cloudinary Account
- Sign up for free tier at cloudinary.com
- Note: 25GB storage, 25GB bandwidth, 25 credits/month

#### Step 1.2: Configure Cloudinary
```javascript
// Environment variables to add:
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=pdf_uploads
VITE_CLOUDINARY_API_KEY=your_api_key
VITE_CLOUDINARY_API_SECRET=your_api_secret // Server-side only
```

#### Step 1.3: Create Upload Preset
- In Cloudinary dashboard, create unsigned upload preset
- Settings:
  - Folder: "pdfs"
  - Allowed formats: pdf
  - Max file size: 200MB
  - Auto-delete after: 10 days

### Phase 2: Remove Redundant Code

#### Step 2.1: Delete Supabase Edge Function
```bash
rm -rf supabase/functions/process-pdf
```

#### Step 2.2: Remove Redundant PDF Components
Delete these files:
- `src/components/PDFViewer.tsx`
- `src/components/SimplePDFViewer.tsx`
- `src/components/SimplifiedPDFViewer.tsx`
- `src/components/DocumentPreview/PreviewDisplay.tsx`
- `src/components/DocumentPreview/RangeSelector.tsx`

#### Step 2.3: Remove Supabase Storage Code
- Remove PDF upload logic from `pdfProcessor.ts`
- Remove storage bucket creation from migration files

### Phase 3: Implement Cloudinary Integration

#### Step 3.1: Create Cloudinary Service
```typescript
// src/services/cloudinary.ts
import { DocumentMetadata, PreviewData } from '@/types/document';

export class CloudinaryService {
  private cloudName: string;
  private uploadPreset: string;

  constructor() {
    this.cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  }

  async uploadPDF(file: File): Promise<{publicId: string; url: string; pages: number}> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/upload`,
      { method: 'POST', body: formData }
    );
    
    const data = await response.json();
    return {
      publicId: data.public_id,
      url: data.secure_url,
      pages: data.pages || 1
    };
  }

  getPreviewUrl(publicId: string, page: number): string {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/pg_${page},q_70,w_400/${publicId}.jpg`;
  }

  async getMetadata(publicId: string): Promise<DocumentMetadata> {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/${publicId}`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${import.meta.env.VITE_CLOUDINARY_API_KEY}:${import.meta.env.VITE_CLOUDINARY_API_SECRET}`)}`
        }
      }
    );
    
    const data = await response.json();
    return {
      type: 'pdf',
      totalUnits: data.pages || 1,
      unitName: 'pages',
      fileName: data.original_filename,
      fileSize: data.bytes,
    };
  }
}
```

#### Step 3.2: Update FileUpload Component
```typescript
// src/components/FileUpload.tsx
// Replace Supabase upload with Cloudinary
const handleUpload = async (file: File) => {
  const cloudinary = new CloudinaryService();
  const { publicId, url, pages } = await cloudinary.uploadPDF(file);
  
  // Store reference in state
  setUploadedFile({
    publicId,
    url,
    pages,
    fileName: file.name,
    fileSize: file.size
  });
};
```

#### Step 3.3: Create Minimal Preview Component
```typescript
// src/components/PDFPreview.tsx
interface PDFPreviewProps {
  publicId: string;
  totalPages: number;
  onPageRangeSelect: (start: number, end: number) => void;
}

export function PDFPreview({ publicId, totalPages, onPageRangeSelect }: PDFPreviewProps) {
  const cloudinary = new CloudinaryService();
  const [selectedRange, setSelectedRange] = useState({ start: 1, end: totalPages });
  
  // Show only first and last page
  const firstPageUrl = cloudinary.getPreviewUrl(publicId, 1);
  const lastPageUrl = cloudinary.getPreviewUrl(publicId, totalPages);
  
  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <h3>First Page</h3>
          <img src={firstPageUrl} alt="First page" className="w-full" />
        </div>
        <div>
          <h3>Last Page</h3>
          <img src={lastPageUrl} alt="Last page" className="w-full" />
        </div>
      </div>
      
      <div className="mt-4">
        <p>Total pages: {totalPages}</p>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={selectedRange.start}
          onChange={(e) => setSelectedRange({...selectedRange, start: +e.target.value})}
        />
        <span> to </span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={selectedRange.end}
          onChange={(e) => setSelectedRange({...selectedRange, end: +e.target.value})}
        />
        <button onClick={() => onPageRangeSelect(selectedRange.start, selectedRange.end)}>
          Process Selected Pages
        </button>
      </div>
    </div>
  );
}
```

### Phase 4: Update Processing Flow

#### Step 4.1: Update Document Processor
```typescript
// src/services/processors/pdfProcessor.ts
export class PDFProcessor implements DocumentProcessor {
  async analyze(file: File): Promise<DocumentMetadata> {
    const cloudinary = new CloudinaryService();
    const { publicId, pages } = await cloudinary.uploadPDF(file);
    
    return {
      type: 'pdf',
      totalUnits: pages,
      unitName: 'pages',
      fileName: file.name,
      fileSize: file.size,
      publicId // Store for later use
    };
  }
  
  async processPages(publicId: string, startPage: number, endPage: number): Promise<string> {
    // Send to Google Document AI
    const documentAI = new DocumentAIService();
    const cloudinaryUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${publicId}`;
    
    return await documentAI.processDocument(cloudinaryUrl, {
      pages: `${startPage}-${endPage}`
    });
  }
}
```

#### Step 4.2: Update Database Schema
```sql
-- Remove storage-related columns
ALTER TABLE processing_history 
DROP COLUMN IF EXISTS storage_path,
ADD COLUMN cloudinary_public_id TEXT;
```

### Phase 5: Testing & Deployment

#### Step 5.1: Test Locally
1. Set up Cloudinary environment variables
2. Test PDF upload (various sizes)
3. Verify preview generation
4. Test Google Document AI integration
5. Ensure downloads work

#### Step 5.2: Update Production Environment
1. Add Cloudinary env vars to Vercel
2. Run database migrations
3. Deploy new code
4. Monitor for errors

#### Step 5.3: Cleanup Old Data
1. Delete PDFs from Supabase Storage
2. Remove unused database tables
3. Update documentation

## Code to Remove

### Complete Files to Delete
```
- supabase/functions/process-pdf/index.ts
- src/components/PDFViewer.tsx
- src/components/SimplePDFViewer.tsx  
- src/components/SimplifiedPDFViewer.tsx
- src/components/DocumentPreview/PreviewDisplay.tsx
- src/components/DocumentPreview/RangeSelector.tsx
- src/hooks/useDocumentPreview.ts (if only used for old preview)
```

### Functions/Methods to Remove
- `uploadFile()` methods that use Supabase Storage
- PDF rendering logic using canvas
- Worker-based PDF processing
- Complex preview caching logic

## New File Structure
```
src/
├── services/
│   ├── cloudinary.ts (NEW)
│   ├── documentai.ts (existing)
│   └── processors/
│       └── pdfProcessor.ts (simplified)
├── components/
│   ├── FileUpload.tsx (updated)
│   ├── PDFPreview.tsx (NEW - minimal)
│   └── ProcessingResults.tsx (existing)
└── types/
    └── document.ts (simplified)
```

## Environment Variables
```env
# Remove
SUPABASE_SERVICE_ROLE_KEY

# Add
VITE_CLOUDINARY_CLOUD_NAME=
VITE_CLOUDINARY_UPLOAD_PRESET=
CLOUDINARY_API_KEY= (server-side only)
CLOUDINARY_API_SECRET= (server-side only)
```

## Benefits of New Architecture
1. **Simpler**: Direct upload to Cloudinary, no intermediate steps
2. **Cheaper**: Free tier covers most use cases
3. **Faster**: Preview images generated instantly by Cloudinary
4. **Secure**: No CSP issues, no client-side PDF rendering
5. **Scalable**: Cloudinary handles any file size

## Migration Checklist
- [ ] Set up Cloudinary account
- [ ] Create upload preset
- [ ] Add environment variables
- [ ] Implement CloudinaryService
- [ ] Update FileUpload component
- [ ] Create minimal PDFPreview component
- [ ] Update pdfProcessor
- [ ] Remove old PDF components
- [ ] Delete Supabase Edge Function
- [ ] Update database schema
- [ ] Test thoroughly
- [ ] Deploy to production
- [ ] Clean up old files from Supabase Storage

## Monitoring After Deployment
1. Watch Cloudinary usage (25GB limit)
2. Monitor error rates
3. Check user feedback
4. Verify Google Document AI integration
5. Track conversion rates

## Rollback Plan
If issues arise:
1. Keep old code in a branch for 30 days
2. Supabase Storage remains available
3. Can revert to previous commit
4. Document any issues for future reference