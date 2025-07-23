-- Enhanced Processing History Schema for Step 13
-- Adds support for advanced text extraction features

-- Add columns for enhanced content storage
ALTER TABLE processing_history 
ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(4,2) DEFAULT 0.95,
ADD COLUMN IF NOT EXISTS extracted_content JSONB,
ADD COLUMN IF NOT EXISTS processing_metadata JSONB;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_processing_history_confidence 
ON processing_history(confidence_score);

CREATE INDEX IF NOT EXISTS idx_processing_history_extracted_content 
ON processing_history USING GIN(extracted_content);

CREATE INDEX IF NOT EXISTS idx_processing_history_metadata 
ON processing_history USING GIN(processing_metadata);

-- Add index for mathematical content searches
CREATE INDEX IF NOT EXISTS idx_processing_history_mathematics 
ON processing_history USING GIN((extracted_content->'mathematics'));

-- Add index for structural content searches  
CREATE INDEX IF NOT EXISTS idx_processing_history_structure 
ON processing_history USING GIN((extracted_content->'structure'));

-- Add index for image content searches
CREATE INDEX IF NOT EXISTS idx_processing_history_images 
ON processing_history USING GIN((extracted_content->'images'));

-- Function to search for mathematical content across processing history
CREATE OR REPLACE FUNCTION search_mathematical_content(
  user_uuid UUID,
  search_term TEXT DEFAULT NULL,
  math_type TEXT DEFAULT NULL
)
RETURNS TABLE(
  record_id UUID,
  filename TEXT,
  page_number INTEGER,
  math_content TEXT,
  math_type TEXT,
  confidence DECIMAL,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.id as record_id,
    ph.filename,
    (math_item->>'page')::INTEGER as page_number,
    math_item->>'content' as math_content,
    math_item->>'type' as math_type,
    (math_item->>'confidence')::DECIMAL as confidence,
    ph.created_at
  FROM processing_history ph,
       jsonb_array_elements(ph.extracted_content->'mathematics') as math_item
  WHERE ph.user_id = user_uuid
    AND (search_term IS NULL OR (math_item->>'content') ILIKE '%' || search_term || '%')
    AND (math_type IS NULL OR (math_item->>'type') = math_type)
  ORDER BY ph.created_at DESC;
END;
$$;

-- Function to search for images and visual content
CREATE OR REPLACE FUNCTION search_image_content(
  user_uuid UUID,
  search_description TEXT DEFAULT NULL
)
RETURNS TABLE(
  record_id UUID,
  filename TEXT,
  page_number INTEGER,
  image_description TEXT,
  confidence DECIMAL,
  width INTEGER,
  height INTEGER,
  has_text BOOLEAN,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ph.id as record_id,
    ph.filename,
    (img_item->>'page')::INTEGER as page_number,
    img_item->>'description' as image_description,
    (img_item->>'confidence')::DECIMAL as confidence,
    (img_item->'size'->>'width')::INTEGER as width,
    (img_item->'size'->>'height')::INTEGER as height,
    (img_item->>'extractedText') IS NOT NULL as has_text,
    ph.created_at
  FROM processing_history ph,
       jsonb_array_elements(ph.extracted_content->'images') as img_item
  WHERE ph.user_id = user_uuid
    AND (search_description IS NULL OR (img_item->>'description') ILIKE '%' || search_description || '%')
  ORDER BY ph.created_at DESC;
END;
$$;

-- Function to get document structure analysis
CREATE OR REPLACE FUNCTION get_document_structure(
  user_uuid UUID,
  record_uuid UUID
)
RETURNS TABLE(
  tables_count INTEGER,
  paragraphs_count INTEGER,
  headers_count INTEGER,
  lists_count INTEGER,
  fonts_used JSONB,
  document_layout JSONB
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(jsonb_array_length(ph.extracted_content->'structure'->'tables'), 0)::INTEGER as tables_count,
    COALESCE(jsonb_array_length(ph.extracted_content->'structure'->'paragraphs'), 0)::INTEGER as paragraphs_count,
    COALESCE(jsonb_array_length(ph.extracted_content->'structure'->'headers'), 0)::INTEGER as headers_count,
    COALESCE(jsonb_array_length(ph.extracted_content->'structure'->'lists'), 0)::INTEGER as lists_count,
    ph.extracted_content->'formatting'->'fonts' as fonts_used,
    ph.extracted_content->'formatting'->'layout' as document_layout
  FROM processing_history ph
  WHERE ph.user_id = user_uuid 
    AND ph.id = record_uuid;
END;
$$;

-- Function to get processing quality metrics
CREATE OR REPLACE FUNCTION get_processing_quality_metrics(
  user_uuid UUID,
  days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
  average_confidence DECIMAL,
  total_documents INTEGER,
  high_quality_docs INTEGER,
  documents_with_math INTEGER,
  documents_with_images INTEGER,
  documents_with_tables INTEGER,
  avg_processing_time INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ROUND(AVG(ph.confidence_score), 3) as average_confidence,
    COUNT(*)::INTEGER as total_documents,
    COUNT(CASE WHEN ph.confidence_score >= 0.9 THEN 1 END)::INTEGER as high_quality_docs,
    COUNT(CASE WHEN ph.extracted_content->'mathematics' IS NOT NULL THEN 1 END)::INTEGER as documents_with_math,
    COUNT(CASE WHEN ph.extracted_content->'images' IS NOT NULL THEN 1 END)::INTEGER as documents_with_images,
    COUNT(CASE WHEN ph.extracted_content->'structure'->'tables' IS NOT NULL THEN 1 END)::INTEGER as documents_with_tables,
    ROUND(AVG(ph.processing_time))::INTEGER as avg_processing_time
  FROM processing_history ph
  WHERE ph.user_id = user_uuid 
    AND ph.created_at >= NOW() - INTERVAL '1 day' * days_back
    AND ph.status = 'completed';
END;
$$;

-- Enhanced RLS policies for new columns
CREATE POLICY "Users can view enhanced content in their own processing records"
ON processing_history 
FOR SELECT 
USING (auth.uid() = user_id);

-- Add comment describing the enhanced schema
COMMENT ON COLUMN processing_history.confidence_score IS 'Overall confidence score (0-1) for the document processing quality';
COMMENT ON COLUMN processing_history.extracted_content IS 'JSON object containing structured data: mathematics, images, tables, formatting';
COMMENT ON COLUMN processing_history.processing_metadata IS 'Additional metadata about the processing: queue info, retries, etc.';

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_mathematical_content TO authenticated;
GRANT EXECUTE ON FUNCTION search_image_content TO authenticated;
GRANT EXECUTE ON FUNCTION get_document_structure TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_quality_metrics TO authenticated;