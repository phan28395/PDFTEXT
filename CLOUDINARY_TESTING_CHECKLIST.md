# Cloudinary Integration Testing Checklist

## Pre-Testing Setup

### 1. Cloudinary Account Setup
- [ ] Create free Cloudinary account at cloudinary.com
- [ ] Note your Cloud Name from dashboard
- [ ] Create an unsigned upload preset:
  - Go to Settings → Upload
  - Add upload preset
  - Set Signing Mode to "Unsigned"
  - Set Folder to "pdfs"
  - Set Allowed formats to "pdf"
  - Enable "Unique filename"
  - Save and note the preset name

### 2. Environment Variables
- [ ] Copy `.env.example` to `.env.local`
- [ ] Add Cloudinary variables:
  ```
  VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
  VITE_CLOUDINARY_UPLOAD_PRESET=pdf_uploads
  VITE_CLOUDINARY_API_KEY=your_api_key (optional for testing)
  VITE_CLOUDINARY_API_SECRET=your_api_secret (optional for testing)
  ```

### 3. Database Migration
- [ ] Run the Cloudinary migration:
  ```bash
  npx supabase db push
  ```
- [ ] Verify `cloudinary_public_id` column added to `processing_history` table
- [ ] Verify `storage_path` column removed

## Functional Testing

### 1. PDF Upload Flow
- [ ] Start development server: `npm run dev`
- [ ] Navigate to upload page
- [ ] Select a small PDF file (< 5MB)
- [ ] Verify:
  - File uploads to Cloudinary (check Cloudinary Media Library)
  - Preview images appear (first and last page)
  - Page range selector works
  - Cost preview shows correctly

### 2. Preview Generation
- [ ] Upload a multi-page PDF
- [ ] Verify first page preview loads
- [ ] Verify last page preview loads (if > 1 page)
- [ ] Check image quality is acceptable
- [ ] Test page range selection:
  - Select specific pages
  - Verify cost updates accordingly

### 3. Processing Integration
- [ ] Select pages to process
- [ ] Click "Process Selected Pages"
- [ ] Verify:
  - Processing starts
  - Progress indicators work
  - Text extraction completes
  - Results display correctly

### 4. Error Handling
- [ ] Test with invalid file types
- [ ] Test with very large PDFs (> 50MB)
- [ ] Test with corrupted PDFs
- [ ] Test with no internet connection
- [ ] Verify appropriate error messages

### 5. Performance Testing
- [ ] Upload 5 PDFs in quick succession
- [ ] Monitor:
  - Upload speed
  - Preview generation time
  - Memory usage in browser
  - Network requests in DevTools

## Integration Testing

### 1. Database Integration
- [ ] Process a PDF
- [ ] Check database for:
  - `cloudinary_public_id` is populated
  - Processing history is recorded
  - User credits are deducted correctly

### 2. API Integration
- [ ] Monitor network tab during processing
- [ ] Verify API calls include `cloudinary_public_id`
- [ ] Check Document AI integration works
- [ ] Verify page range is respected

### 3. UI/UX Testing
- [ ] Test on mobile devices
- [ ] Test on different browsers:
  - [ ] Chrome
  - [ ] Firefox
  - [ ] Safari
  - [ ] Edge
- [ ] Verify responsive design
- [ ] Check loading states
- [ ] Test keyboard navigation

## Security Testing

### 1. Upload Security
- [ ] Verify only PDFs can be uploaded
- [ ] Test file size limits
- [ ] Check for XSS in filenames
- [ ] Verify unsigned uploads work

### 2. Access Control
- [ ] Verify PDFs are only accessible to uploader
- [ ] Test direct Cloudinary URLs
- [ ] Check authentication is required

## Cleanup Testing

### 1. Cloudinary Cleanup
- [ ] Verify old files are auto-deleted (if configured)
- [ ] Check storage usage in Cloudinary dashboard
- [ ] Test manual deletion if implemented

## Production Readiness

### 1. Environment Configuration
- [ ] Verify all env variables are set in production
- [ ] Test with production Cloudinary account
- [ ] Verify rate limits are appropriate

### 2. Monitoring
- [ ] Set up Cloudinary webhooks (if needed)
- [ ] Configure alerts for quota usage
- [ ] Test error logging

### 3. Documentation
- [ ] Update user documentation
- [ ] Create troubleshooting guide
- [ ] Document Cloudinary limits

## Known Issues to Test

1. **CSP (Content Security Policy)**
   - [ ] Verify Cloudinary domains are whitelisted
   - [ ] Check no CSP errors in console

2. **CORS Issues**
   - [ ] Test cross-origin requests
   - [ ] Verify uploads work from all environments

3. **Rate Limiting**
   - [ ] Test Cloudinary's rate limits
   - [ ] Implement appropriate retry logic

## Rollback Plan Testing

- [ ] Keep old code in a branch
- [ ] Test switching between old and new implementations
- [ ] Verify data migration is reversible

## Sign-off

- [ ] All tests passed
- [ ] Performance acceptable
- [ ] Security review complete
- [ ] Documentation updated
- [ ] Ready for production deployment

Date: ________________
Tested by: ________________
Approved by: ________________