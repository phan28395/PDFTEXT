-- Run this SQL in your Supabase SQL Editor to set up storage buckets

-- Create pdfs bucket for uploaded PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdfs',
  'pdfs',
  false, -- Private bucket - only accessible via API
  209715200, -- 200MB limit per file
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Create pdf-previews bucket for preview images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf-previews',
  'pdf-previews',
  true, -- Public bucket for serving preview images
  5242880, -- 5MB limit per file
  ARRAY['application/pdf', 'image/webp', 'image/png', 'image/jpeg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for pdfs bucket

-- Allow authenticated users to upload PDFs
CREATE POLICY "Authenticated users can upload PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdfs' AND
  (storage.foldername(name))[1] = 'temp'
);

-- Allow service role to read PDFs
CREATE POLICY "Service role can read PDFs"
ON storage.objects FOR SELECT
TO service_role
USING (bucket_id = 'pdfs');

-- Allow users to read their own PDFs
CREATE POLICY "Users can read own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'pdfs' AND
  auth.uid()::text = (storage.foldername(name))[2]
);

-- Storage policies for pdf-previews bucket

-- Allow authenticated users to upload preview images
CREATE POLICY "Authenticated users can upload previews"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pdf-previews' AND
  (storage.foldername(name))[1] = 'previews'
);

-- Allow public read access to preview images
CREATE POLICY "Public can view preview images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-previews');

-- Allow service role to delete old previews
CREATE POLICY "Service role can delete previews"
ON storage.objects FOR DELETE
TO service_role
USING (bucket_id = 'pdf-previews');

-- Optional: Auto-cleanup policy for old files (requires pg_cron extension)
-- This would delete files older than 24 hours
-- You'll need to enable pg_cron in your Supabase dashboard first
/*
SELECT cron.schedule(
  'cleanup-old-previews',
  '0 * * * *', -- Every hour
  $$
  DELETE FROM storage.objects
  WHERE bucket_id = 'pdf-previews'
    AND created_at < NOW() - INTERVAL '24 hours';
  $$
);
*/