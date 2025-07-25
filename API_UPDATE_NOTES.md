# API Update Notes for Cloudinary Integration

## Current State
The API endpoint `/api/process-pdf.js` currently:
1. Receives PDF files directly via multipart form upload
2. Processes them with Google Document AI
3. Stores metadata in Supabase

## Required Updates for Cloudinary Integration

### 1. Update Processing Flow
Instead of receiving the file directly, the API should:
```javascript
// Old approach
const fileBuffer = fs.readFileSync(file.filepath);

// New approach
const cloudinaryPublicId = fields.cloudinaryPublicId?.[0];
if (!cloudinaryPublicId) {
  // Fall back to old approach for backward compatibility
  // Or require Cloudinary upload first
}
```

### 2. Add Cloudinary Public ID to Database
Update the processing record to include:
```javascript
const { error: recordError } = await supabase
  .from('processing_history')
  .insert({
    // ... existing fields
    cloudinary_public_id: cloudinaryPublicId,
    // Remove storage_path field
  });
```

### 3. Process from Cloudinary URL
```javascript
// If cloudinaryPublicId is provided
if (cloudinaryPublicId) {
  // Fetch PDF from Cloudinary
  const cloudinaryUrl = `https://res.cloudinary.com/${CLOUD_NAME}/raw/upload/${cloudinaryPublicId}`;
  const response = await fetch(cloudinaryUrl);
  const fileBuffer = Buffer.from(await response.arrayBuffer());
  
  // Continue with Document AI processing
}
```

### 4. Update Frontend API Call
The frontend `processPDF` function in `/src/api/processing.ts` should be updated to:
1. First upload to Cloudinary
2. Then send the Cloudinary public ID to the API
3. Remove direct file upload

```typescript
// In processPDF function
const formData = new FormData();
// Instead of: formData.append('file', file);
formData.append('cloudinaryPublicId', cloudinaryPublicId);
formData.append('documentType', documentType);
// ... rest of the fields
```

### 5. Benefits
- Reduced API bandwidth usage
- Better file management through Cloudinary
- Automatic preview generation
- CDN delivery of processed files

## Migration Strategy
1. Support both approaches initially (file upload and Cloudinary ID)
2. Update frontend to use Cloudinary first
3. Monitor usage and deprecate direct file upload
4. Remove old code after migration period