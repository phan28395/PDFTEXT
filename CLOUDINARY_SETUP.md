# Cloudinary Setup Guide

## Overview

This project now uses Cloudinary for PDF storage and preview generation instead of Supabase Storage. This provides:
- Automatic preview image generation
- CDN delivery
- Better performance
- Simpler architecture

## Setup Instructions

### 1. Create Cloudinary Account

1. Go to [cloudinary.com](https://cloudinary.com)
2. Sign up for a free account
3. From your dashboard, note your **Cloud Name**

### 2. Configure Upload Preset

1. In Cloudinary dashboard, go to **Settings** → **Upload**
2. Click **Add upload preset**
3. Configure as follows:
   - **Preset name**: `pdf_uploads`
   - **Signing Mode**: Unsigned
   - **Folder**: `pdfs`
   - **Allowed formats**: `pdf`
   - **Unique filename**: Yes
   - **Max file size**: 200MB (or your preference)
4. Save the preset

### 3. Set Environment Variables

Add these to your `.env.local` file:

```env
# Required
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name_here
VITE_CLOUDINARY_UPLOAD_PRESET=pdf_uploads

# Optional - only needed for metadata retrieval
VITE_CLOUDINARY_API_KEY=your_api_key_here
VITE_CLOUDINARY_API_SECRET=your_api_secret_here
```

### 4. Run Database Migration

Execute the migration to add Cloudinary support:

```bash
# If using Supabase CLI
npx supabase db push

# Or apply manually
psql your_database_url < supabase/migrations/20240125_add_cloudinary_public_id.sql
```

## Architecture Changes

### Before (Supabase Storage)
```
User → Upload PDF → Vercel API → Supabase Storage → Edge Function → Process
```

### After (Cloudinary)
```
User → Upload PDF → Cloudinary → Preview URLs → Select Pages → Document AI
```

## Key Components

### 1. CloudinaryService (`src/services/cloudinary.ts`)
- Handles PDF uploads
- Generates preview URLs
- Manages file metadata

### 2. PDFPreview Component (`src/components/PDFPreview.tsx`)
- Shows first/last page previews
- Allows page range selection
- Minimal, fast UI

### 3. Updated PDFProcessor (`src/services/processors/pdfProcessor.ts`)
- Integrates with Cloudinary
- Processes specific page ranges
- Works with Document AI

## Usage

### Uploading PDFs

```typescript
const cloudinary = new CloudinaryService();
const { publicId, url, pages } = await cloudinary.uploadPDF(file);
```

### Generating Previews

```typescript
// Get preview for page 1
const previewUrl = cloudinary.getPreviewUrl(publicId, 1);

// Get smaller thumbnail
const thumbnailUrl = cloudinary.getPreviewUrl(publicId, 1, 200);
```

### Processing Pages

```typescript
const processor = new PDFProcessor();
const text = await processor.processPages(publicId, startPage, endPage);
```

## Cloudinary Limits (Free Tier)

- **Storage**: 25GB
- **Bandwidth**: 25GB/month
- **Transformations**: 25 credits/month
- **API calls**: Unlimited

## Troubleshooting

### Upload Fails
- Check upload preset name matches
- Verify cloud name is correct
- Ensure file is actually a PDF
- Check file size limits

### Preview Not Loading
- Verify Cloudinary transformation credits
- Check CSP headers allow Cloudinary domain
- Ensure publicId is valid

### API Key Issues
- API keys only needed for metadata
- Basic upload/preview works without them
- Keep API secret secure (server-side only)

## Migration from Old System

1. Existing files remain in Supabase Storage
2. New uploads go to Cloudinary
3. Old processing records still work
4. Gradual migration recommended

## Security Considerations

1. **Unsigned Uploads**: Safe for client-side, files validated
2. **Access Control**: URLs are public but unguessable
3. **Auto-deletion**: Configure in upload preset (e.g., 30 days)
4. **Rate Limiting**: Cloudinary handles this automatically

## Monitoring

Check Cloudinary dashboard for:
- Storage usage
- Bandwidth consumption
- Transformation credits
- Error logs

## Cost Optimization

1. Set auto-deletion for old files
2. Use appropriate preview sizes
3. Cache previews client-side
4. Monitor usage regularly

## Next Steps

1. Test thoroughly with CLOUDINARY_TESTING_CHECKLIST.md
2. Update production environment variables
3. Run database migrations
4. Deploy and monitor

For issues or questions, check:
- [Cloudinary Docs](https://cloudinary.com/documentation)
- [Upload Presets Guide](https://cloudinary.com/documentation/upload_presets)
- API_UPDATE_NOTES.md for backend integration details