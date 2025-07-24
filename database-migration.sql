-- Database Migration for Pay-Per-Use Model with Free Trial
-- Run these commands in your Supabase SQL editor

-- First, let's check and create the credit_balance column if it doesn't exist
-- This handles both new and existing database schemas
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credit_balance INTEGER DEFAULT 0;

-- Add other new columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS free_pages_remaining INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS document_type TEXT CHECK (document_type IN ('standard', 'latex', 'forms'));

-- Add new columns to processing_history table  
ALTER TABLE processing_history
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'standard' CHECK (document_type IN ('standard', 'latex', 'forms')),
ADD COLUMN IF NOT EXISTS download_format TEXT DEFAULT 'combined' CHECK (download_format IN ('combined', 'separated', 'individual'));

-- Update existing users to have 5 free pages and default credit balance
UPDATE users 
SET 
  free_pages_remaining = COALESCE(free_pages_remaining, 5),
  credit_balance = COALESCE(credit_balance, 0)
WHERE free_pages_remaining IS NULL OR credit_balance IS NULL;

-- Create or update the can_user_process_pages function
CREATE OR REPLACE FUNCTION can_user_process_pages(
  user_uuid UUID,
  pages_count INTEGER,
  cost_per_page NUMERIC DEFAULT 1.2
) RETURNS BOOLEAN AS $$
DECLARE
  user_credit_balance INTEGER;
  user_free_pages INTEGER;
  total_cost NUMERIC;
BEGIN
  -- Get user's current credit balance and free pages
  SELECT credit_balance, COALESCE(free_pages_remaining, 0)
  INTO user_credit_balance, user_free_pages
  FROM users
  WHERE id = user_uuid;
  
  -- If user not found, return false
  IF user_credit_balance IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate cost after using free pages
  total_cost := GREATEST(0, pages_count - user_free_pages) * cost_per_page;
  
  -- Check if user has enough credits
  RETURN user_credit_balance >= total_cost;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or update the charge_user_credits function  
CREATE OR REPLACE FUNCTION charge_user_credits(
  user_uuid UUID,
  pages_count INTEGER,
  cost_per_page NUMERIC DEFAULT 1.2
) RETURNS JSON AS $$
DECLARE
  user_credit_balance INTEGER;
  user_free_pages INTEGER;
  pages_used_from_free INTEGER;
  pages_needing_payment INTEGER;
  credits_charged NUMERIC;
  new_balance INTEGER;
BEGIN
  -- Get user's current balances
  SELECT credit_balance, COALESCE(free_pages_remaining, 0), COALESCE(pages_used, 0)
  INTO user_credit_balance, user_free_pages
  FROM users
  WHERE id = user_uuid;
  
  -- If user not found, return error
  IF user_credit_balance IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'User not found');
  END IF;
  
  -- Calculate charges
  pages_used_from_free := LEAST(pages_count, user_free_pages);
  pages_needing_payment := pages_count - pages_used_from_free;
  credits_charged := pages_needing_payment * cost_per_page;
  
  -- Check if user has enough credits
  IF credits_charged > user_credit_balance THEN
    RETURN json_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Update user balances
  new_balance := user_credit_balance - credits_charged;
  
  UPDATE users 
  SET 
    credit_balance = new_balance,
    free_pages_remaining = user_free_pages - pages_used_from_free,
    pages_used = COALESCE(pages_used, 0) + pages_count,
    updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN json_build_object(
    'success', true, 
    'new_balance', new_balance,
    'free_pages_used', pages_used_from_free,
    'credits_charged', credits_charged
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_free_pages ON users(free_pages_remaining);
CREATE INDEX IF NOT EXISTS idx_users_credit_balance ON users(credit_balance);
CREATE INDEX IF NOT EXISTS idx_processing_history_document_type ON processing_history(document_type);
CREATE INDEX IF NOT EXISTS idx_processing_history_download_format ON processing_history(download_format);