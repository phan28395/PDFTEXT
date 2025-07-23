-- Stripe Integration Database Migration
-- This script adds necessary fields for Stripe subscription management

-- First, update the subscription_status enum to include more Stripe statuses
ALTER TYPE subscription_status ADD VALUE 'active';
ALTER TYPE subscription_status ADD VALUE 'canceled';
ALTER TYPE subscription_status ADD VALUE 'past_due';
ALTER TYPE subscription_status ADD VALUE 'unpaid';
ALTER TYPE subscription_status ADD VALUE 'trialing';

-- Add new columns to users table for subscription management
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(20) DEFAULT 'free',
ADD COLUMN IF NOT EXISTS pages_processed_this_month INTEGER DEFAULT 0 CHECK (pages_processed_this_month >= 0),
ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS subscription_period_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS subscription_period_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS full_name VARCHAR(255);

-- Update the pages_limit for pro users (1000 per month)
UPDATE public.users 
SET pages_limit = 1000 
WHERE subscription_status = 'pro';

-- Create function to reset monthly usage (called by webhook)
CREATE OR REPLACE FUNCTION public.reset_user_monthly_usage(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.users 
  SET pages_processed_this_month = 0,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Update the usage checking function for monthly limits
CREATE OR REPLACE FUNCTION public.can_user_process_pages(user_uuid UUID, pages_count INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_usage INTEGER;
  current_limit INTEGER;
  current_status subscription_status;
  current_plan VARCHAR(20);
BEGIN
  -- Get current user data
  SELECT pages_processed_this_month, pages_limit, subscription_status, subscription_plan
  INTO current_usage, current_limit, current_status, current_plan
  FROM public.users 
  WHERE id = user_uuid;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Free users: check lifetime limit (pages_used)
  IF current_plan = 'free' THEN
    SELECT pages_used INTO current_usage FROM public.users WHERE id = user_uuid;
    RETURN (current_usage + pages_count) <= 10; -- Free tier: 10 pages lifetime
  END IF;
  
  -- Pro users: check monthly limit (pages_processed_this_month)
  IF current_plan = 'pro' AND current_status IN ('active', 'trialing') THEN
    RETURN (current_usage + pages_count) <= 1000; -- Pro tier: 1000 pages per month
  END IF;
  
  -- Inactive subscriptions fall back to free tier limits
  SELECT pages_used INTO current_usage FROM public.users WHERE id = user_uuid;
  RETURN (current_usage + pages_count) <= 10;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Update the usage increment function for monthly tracking
CREATE OR REPLACE FUNCTION public.update_user_pages_usage(user_uuid UUID, pages_count INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_plan VARCHAR(20);
  current_status subscription_status;
BEGIN
  -- Get current user data
  SELECT subscription_plan, subscription_status 
  INTO current_plan, current_status
  FROM public.users 
  WHERE id = user_uuid;
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if user can process these pages
  IF NOT public.can_user_process_pages(user_uuid, pages_count) THEN
    RETURN FALSE;
  END IF;
  
  -- Update usage counters
  IF current_plan = 'free' THEN
    -- Free users: update lifetime counter
    UPDATE public.users 
    SET pages_used = pages_used + pages_count,
        updated_at = NOW()
    WHERE id = user_uuid;
  ELSE
    -- Pro users: update both lifetime and monthly counters
    UPDATE public.users 
    SET pages_used = pages_used + pages_count,
        pages_processed_this_month = pages_processed_this_month + pages_count,
        updated_at = NOW()
    WHERE id = user_uuid;
  END IF;
  
  RETURN TRUE;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create function to handle subscription status updates (called by webhook)
CREATE OR REPLACE FUNCTION public.update_user_subscription(
  user_uuid UUID,
  new_status subscription_status,
  new_plan VARCHAR(20),
  stripe_customer VARCHAR(255) DEFAULT NULL,
  stripe_subscription VARCHAR(255) DEFAULT NULL,
  period_start TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  period_end TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.users 
  SET subscription_status = new_status,
      subscription_plan = new_plan,
      stripe_customer_id = COALESCE(stripe_customer, stripe_customer_id),
      stripe_subscription_id = COALESCE(stripe_subscription, stripe_subscription_id),
      subscription_period_start = COALESCE(period_start, subscription_period_start),
      subscription_period_end = COALESCE(period_end, subscription_period_end),
      pages_limit = CASE 
        WHEN new_plan = 'pro' THEN 1000 
        ELSE 10 
      END,
      updated_at = NOW()
  WHERE id = user_uuid;
  
  RETURN FOUND;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON public.users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription_status ON public.users(subscription_status);

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION public.reset_user_monthly_usage(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.update_user_subscription(UUID, subscription_status, VARCHAR, VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) TO service_role;

-- Comments for documentation
COMMENT ON FUNCTION public.reset_user_monthly_usage(UUID) IS 'Resets monthly usage counter for pro users (called by Stripe webhook)';
COMMENT ON FUNCTION public.update_user_subscription(UUID, subscription_status, VARCHAR, VARCHAR, VARCHAR, TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Updates user subscription status and details from Stripe webhook';
COMMENT ON COLUMN public.users.subscription_plan IS 'Current subscription plan: free, pro';
COMMENT ON COLUMN public.users.pages_processed_this_month IS 'Pages processed in current month (resets monthly for pro users)';
COMMENT ON COLUMN public.users.stripe_subscription_id IS 'Stripe subscription ID';
COMMENT ON COLUMN public.users.subscription_period_start IS 'Current subscription period start date';
COMMENT ON COLUMN public.users.subscription_period_end IS 'Current subscription period end date';