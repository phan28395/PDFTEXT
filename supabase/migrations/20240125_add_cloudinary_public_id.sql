-- Add cloudinary_public_id column to processing_history table
ALTER TABLE processing_history 
ADD COLUMN IF NOT EXISTS cloudinary_public_id TEXT;

-- Remove storage_path column if it exists (no longer needed)
ALTER TABLE processing_history 
DROP COLUMN IF EXISTS storage_path;

-- Add index for faster lookups by cloudinary_public_id
CREATE INDEX IF NOT EXISTS idx_processing_history_cloudinary_public_id 
ON processing_history(cloudinary_public_id);

-- Update existing records to have NULL cloudinary_public_id
-- (They will need to be reprocessed with the new system)
UPDATE processing_history 
SET cloudinary_public_id = NULL 
WHERE cloudinary_public_id IS NULL;