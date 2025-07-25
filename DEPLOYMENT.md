# Deployment Guide for Vercel

## Prerequisites

1. Vercel account
2. Supabase account and project
3. Environment variables configured

## Setup Steps

### 1. Supabase Storage Setup

Run the SQL commands in `supabase-storage-setup.sql` in your Supabase SQL Editor to create the necessary storage bucket.

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Variables

Set these environment variables in Vercel:

- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (keep secret!)

### 4. Deploy to Vercel

```bash
vercel --prod
```

Or connect your GitHub repo to Vercel for automatic deployments.

## Important Notes

### Sharp Configuration

For Sharp to work on Vercel, it will automatically install the correct binary. No additional configuration needed.

### PDF Processing Limitations

- Maximum file size: 10MB (configurable in API route)
- Maximum pages to preview: 50 (configurable)
- Processing timeout: 30 seconds
- Preview images expire after 1 hour

### Security Considerations

1. The API validates file types and sizes
2. Files are processed in Vercel's isolated environment
3. Supabase storage handles access control
4. No files are stored on Vercel's filesystem

### Production Improvements

For production, consider:

1. **Better PDF to Image Conversion**: The current implementation uses a placeholder. For real PDF rendering, consider:
   - Using Cloudinary or similar service
   - Installing Poppler in a custom Vercel runtime
   - Using a separate microservice for PDF processing

2. **Rate Limiting**: Add rate limiting using Vercel KV or Upstash

3. **Monitoring**: Set up error tracking with Sentry or similar

4. **Caching**: Use Vercel Edge Config for frequently accessed data

## Troubleshooting

### "Module not found" errors
Run `npm install` to ensure all dependencies are installed.

### Storage bucket errors
Ensure you've run the SQL setup script and the bucket is public.

### Preview generation fails
Check Vercel function logs for detailed error messages.