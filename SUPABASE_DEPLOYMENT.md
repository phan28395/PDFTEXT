# Supabase Edge Function Deployment Guide

## Overview

This guide explains how to deploy the PDF processing system using Supabase Edge Functions, which handles all PDF processing within Supabase (no Vercel API routes needed).

## Architecture

```
Browser → Supabase Storage → Supabase Edge Function → Preview Generation
           (Direct upload)     (Process in Supabase)    (No transfer!)
```

## Setup Steps

### 1. Install Supabase CLI

```bash
# macOS/Linux
brew install supabase/tap/supabase

# Windows (via Scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 2. Setup Storage Buckets

Run the SQL commands in `supabase-storage-setup.sql` in your Supabase SQL Editor:
- Creates `pdfs` bucket for uploaded files (200MB limit)
- Creates `pdf-previews` bucket for generated previews
- Sets up proper access policies

### 3. Deploy Edge Function

```bash
# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref <your-project-ref>

# Deploy the function
supabase functions deploy process-pdf
```

### 4. Environment Variables

Set these in your `.env` file:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Set these in Supabase Dashboard > Edge Functions > process-pdf > Secrets:
```
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 5. Update Dependencies

```bash
# Remove unnecessary dependencies since we're not using Vercel API
npm uninstall sharp pdf2pic puppeteer

# The app only needs:
npm install
```

## How It Works

1. **File Upload**: Files upload directly to Supabase Storage (bypasses 4.5MB limit)
2. **Processing**: Edge Function processes PDFs entirely within Supabase
3. **Preview**: Returns sample pages (max 15) with gaps for large documents
4. **No Transfer**: PDF never leaves Supabase infrastructure

## Benefits

✅ **No file size limits** (up to 200MB configured)  
✅ **No transfer between services**  
✅ **Faster processing** (everything in one place)  
✅ **Lower costs** (no bandwidth between services)  
✅ **Better security** (files stay in Supabase)  

## Testing

Test the Edge Function directly:

```bash
# Test analyze action
curl -L -X POST 'https://<project-ref>.supabase.co/functions/v1/process-pdf' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "analyze", "fileName": "temp/test.pdf"}'

# Test preview action
curl -L -X POST 'https://<project-ref>.supabase.co/functions/v1/process-pdf' \
  -H 'Authorization: Bearer <anon-key>' \
  -H 'Content-Type: application/json' \
  -d '{"action": "preview", "fileName": "temp/test.pdf", "range": {"all": true}}'
```

## Production Considerations

### 1. PDF to Image Conversion

The current implementation stores single-page PDFs as previews. For production, consider:

1. **Use a PDF rendering service**:
   ```typescript
   // In Edge Function
   const imageUrl = await fetch('https://api.cloudinary.com/v1_1/demo/image/upload', {
     method: 'POST',
     body: pdfBytes
   });
   ```

2. **Client-side rendering** with PDF.js:
   ```typescript
   // Display PDF directly in browser
   // No image conversion needed
   ```

### 2. Cleanup Strategy

Enable automated cleanup in Supabase:

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule hourly cleanup
SELECT cron.schedule(
  'cleanup-old-files',
  '0 * * * *',
  $$
  DELETE FROM storage.objects
  WHERE bucket_id IN ('pdfs', 'pdf-previews')
    AND created_at < NOW() - INTERVAL '24 hours'
    AND name LIKE 'temp/%';
  $$
);
```

### 3. Rate Limiting

Add rate limiting in Edge Function:

```typescript
// Track requests per user
const rateLimitKey = `rate_limit:${userId}`;
const requests = await redis.incr(rateLimitKey);
await redis.expire(rateLimitKey, 60); // 1 minute window

if (requests > 10) {
  return new Response('Rate limit exceeded', { status: 429 });
}
```

### 4. Monitoring

- Enable Supabase Function logs
- Set up alerts for errors
- Monitor storage usage

## Troubleshooting

### "Failed to upload" error
- Check storage bucket policies
- Ensure buckets exist
- Verify file size is under limit

### "Function invocation failed"
- Check Edge Function logs in Supabase Dashboard
- Verify environment variables are set
- Check CORS settings

### Preview not displaying
- Ensure pdf-previews bucket is public
- Check browser console for errors
- Verify file paths are correct

## Deployment to Vercel

Since all PDF processing happens in Supabase, Vercel deployment is simple:

```bash
# No special configuration needed
vercel --prod
```

No need to worry about:
- File size limits
- Function timeouts  
- Binary dependencies
- Memory constraints

Everything heavy happens in Supabase! 🎉