-- Add missing columns to processing_history table
-- This migration ensures all required columns exist

-- Add payment_amount column
ALTER TABLE public.processing_history
ADD COLUMN IF NOT EXISTS payment_amount DECIMAL(10,2) DEFAULT 0;

-- Add was_paid column
ALTER TABLE public.processing_history
ADD COLUMN IF NOT EXISTS was_paid BOOLEAN DEFAULT false;

-- Add stripe_payment_intent_id column
ALTER TABLE public.processing_history
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Add processing_time column (was previously processing_time_ms)
ALTER TABLE public.processing_history
ADD COLUMN IF NOT EXISTS processing_time INTEGER;

-- Add confidence_score column
ALTER TABLE public.processing_history
ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2);

-- Add error_message column
ALTER TABLE public.processing_history
ADD COLUMN IF NOT EXISTS error_message TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.processing_history.payment_amount IS 'Amount of credits charged for processing this document';
COMMENT ON COLUMN public.processing_history.was_paid IS 'Whether credits were charged for this processing';
COMMENT ON COLUMN public.processing_history.stripe_payment_intent_id IS 'Stripe payment intent ID if applicable';
COMMENT ON COLUMN public.processing_history.processing_time IS 'Processing time in milliseconds';
COMMENT ON COLUMN public.processing_history.confidence_score IS 'Confidence score from Document AI (0-1)';
COMMENT ON COLUMN public.processing_history.error_message IS 'Error message if processing failed';