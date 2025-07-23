-- Enhanced Usage Tracking with Database Locks
-- This script adds robust usage tracking with atomic operations and race condition protection

-- Create audit log table for tracking all usage activities
CREATE TABLE IF NOT EXISTS public.usage_audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  action VARCHAR(50) NOT NULL, -- 'page_processed', 'limit_exceeded', 'subscription_changed'
  pages_count INTEGER NOT NULL DEFAULT 0,
  pages_before INTEGER NOT NULL DEFAULT 0,
  pages_after INTEGER NOT NULL DEFAULT 0,
  subscription_plan_before VARCHAR(20),
  subscription_plan_after VARCHAR(20),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  ip_address INET,
  user_agent TEXT,
  
  -- Indexes for performance
  INDEX idx_usage_audit_log_user_id (user_id),
  INDEX idx_usage_audit_log_created_at (created_at),
  INDEX idx_usage_audit_log_action (action)
);

-- Enable RLS on audit log
ALTER TABLE public.usage_audit_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for audit log (users can only view their own logs)
CREATE POLICY "Users can view their own audit logs" ON public.usage_audit_log
  FOR SELECT USING (auth.uid() = user_id);

-- Create enhanced function with database locks and atomic operations
CREATE OR REPLACE FUNCTION public.atomic_update_user_pages_usage(
  user_uuid UUID,
  pages_count INTEGER,
  processing_record_id UUID DEFAULT NULL,
  client_ip INET DEFAULT NULL,
  client_user_agent TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  pages_before INTEGER;
  pages_monthly_before INTEGER;
  can_process BOOLEAN := FALSE;
  audit_metadata JSONB := '{}';
  result JSON;
BEGIN
  -- Use SELECT FOR UPDATE to prevent race conditions
  SELECT 
    id, subscription_plan, subscription_status, pages_used, 
    pages_processed_this_month, pages_limit, stripe_customer_id,
    subscription_period_start, subscription_period_end
  INTO user_record
  FROM public.users 
  WHERE id = user_uuid
  FOR UPDATE; -- This creates a row-level lock
  
  -- Check if user exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'user_not_found',
      'message', 'User not found'
    );
  END IF;
  
  -- Store current values for audit
  pages_before := user_record.pages_used;
  pages_monthly_before := user_record.pages_processed_this_month;
  
  -- Build audit metadata
  audit_metadata := jsonb_build_object(
    'processing_record_id', processing_record_id,
    'subscription_plan', user_record.subscription_plan,
    'subscription_status', user_record.subscription_status,
    'pages_limit', user_record.pages_limit,
    'period_start', user_record.subscription_period_start,
    'period_end', user_record.subscription_period_end
  );
  
  -- Check usage limits based on subscription
  IF user_record.subscription_plan = 'free' THEN
    -- Free users: lifetime limit of 10 pages
    can_process := (user_record.pages_used + pages_count) <= 10;
    
    IF NOT can_process THEN
      -- Log limit exceeded attempt
      INSERT INTO public.usage_audit_log (
        user_id, action, pages_count, pages_before, pages_after,
        subscription_plan_before, metadata, ip_address, user_agent
      ) VALUES (
        user_uuid, 'limit_exceeded', pages_count, pages_before, pages_before,
        user_record.subscription_plan, audit_metadata, client_ip, client_user_agent
      );
      
      RETURN json_build_object(
        'success', false,
        'error', 'limit_exceeded',
        'message', 'Free plan limit of 10 pages exceeded',
        'pages_used', user_record.pages_used,
        'pages_limit', 10,
        'subscription_plan', user_record.subscription_plan
      );
    END IF;
    
  ELSIF user_record.subscription_plan = 'pro' AND 
        user_record.subscription_status IN ('active', 'trialing') THEN
    -- Pro users: monthly limit of 1000 pages
    can_process := (user_record.pages_processed_this_month + pages_count) <= 1000;
    
    IF NOT can_process THEN
      -- Log limit exceeded attempt
      INSERT INTO public.usage_audit_log (
        user_id, action, pages_count, pages_before, pages_after,
        subscription_plan_before, metadata, ip_address, user_agent
      ) VALUES (
        user_uuid, 'limit_exceeded', pages_count, pages_monthly_before, pages_monthly_before,
        user_record.subscription_plan, audit_metadata, client_ip, client_user_agent
      );
      
      RETURN json_build_object(
        'success', false,
        'error', 'monthly_limit_exceeded',
        'message', 'Pro plan monthly limit of 1000 pages exceeded',
        'pages_used_this_month', user_record.pages_processed_this_month,
        'pages_limit', 1000,
        'subscription_plan', user_record.subscription_plan,
        'period_end', user_record.subscription_period_end
      );
    END IF;
    
  ELSE
    -- Inactive pro subscription falls back to free limits
    can_process := (user_record.pages_used + pages_count) <= 10;
    
    IF NOT can_process THEN
      INSERT INTO public.usage_audit_log (
        user_id, action, pages_count, pages_before, pages_after,
        subscription_plan_before, metadata, ip_address, user_agent
      ) VALUES (
        user_uuid, 'limit_exceeded', pages_count, pages_before, pages_before,
        user_record.subscription_plan, audit_metadata, client_ip, client_user_agent
      );
      
      RETURN json_build_object(
        'success', false,
        'error', 'subscription_inactive',
        'message', 'Subscription inactive, free plan limits apply',
        'pages_used', user_record.pages_used,
        'pages_limit', 10,
        'subscription_plan', user_record.subscription_plan,
        'subscription_status', user_record.subscription_status
      );
    END IF;
  END IF;
  
  -- Update usage counters atomically
  IF user_record.subscription_plan = 'free' OR 
     user_record.subscription_status NOT IN ('active', 'trialing') THEN
    -- Free users or inactive pro: update only lifetime counter
    UPDATE public.users 
    SET pages_used = pages_used + pages_count,
        updated_at = NOW()
    WHERE id = user_uuid;
    
  ELSE
    -- Active pro users: update both counters
    UPDATE public.users 
    SET pages_used = pages_used + pages_count,
        pages_processed_this_month = pages_processed_this_month + pages_count,
        updated_at = NOW()
    WHERE id = user_uuid;
  END IF;
  
  -- Log successful processing
  INSERT INTO public.usage_audit_log (
    user_id, action, pages_count, pages_before, pages_after,
    subscription_plan_before, metadata, ip_address, user_agent
  ) VALUES (
    user_uuid, 'page_processed', pages_count, pages_before, 
    pages_before + pages_count, user_record.subscription_plan, 
    audit_metadata, client_ip, client_user_agent
  );
  
  -- Build success response
  result := json_build_object(
    'success', true,
    'pages_processed', pages_count,
    'pages_used_before', pages_before,
    'pages_used_after', pages_before + pages_count,
    'subscription_plan', user_record.subscription_plan,
    'subscription_status', user_record.subscription_status
  );
  
  -- Add plan-specific usage info
  IF user_record.subscription_plan = 'pro' AND 
     user_record.subscription_status IN ('active', 'trialing') THEN
    result := result || json_build_object(
      'pages_used_this_month_before', pages_monthly_before,
      'pages_used_this_month_after', pages_monthly_before + pages_count,
      'monthly_limit', 1000,
      'period_end', user_record.subscription_period_end
    );
  ELSE
    result := result || json_build_object(
      'lifetime_limit', 10
    );
  END IF;
  
  RETURN result;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create function to get detailed usage statistics
CREATE OR REPLACE FUNCTION public.get_user_usage_stats(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  stats JSON;
  recent_usage INTEGER;
  total_processed INTEGER;
  avg_pages_per_doc NUMERIC;
BEGIN
  -- Get user data
  SELECT 
    subscription_plan, subscription_status, pages_used, 
    pages_processed_this_month, pages_limit,
    subscription_period_start, subscription_period_end,
    created_at
  INTO user_record
  FROM public.users 
  WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'user_not_found');
  END IF;
  
  -- Get processing statistics
  SELECT 
    COUNT(*) as total_documents,
    COALESCE(SUM(pages_processed), 0) as total_pages_from_history,
    COALESCE(AVG(pages_processed), 0) as avg_pages_per_document
  INTO total_processed, total_processed, avg_pages_per_doc
  FROM public.processing_history 
  WHERE user_id = user_uuid AND processing_status = 'completed';
  
  -- Get recent usage (last 30 days)
  SELECT COALESCE(COUNT(*), 0)
  INTO recent_usage
  FROM public.usage_audit_log 
  WHERE user_id = user_uuid 
    AND action = 'page_processed' 
    AND created_at > NOW() - INTERVAL '30 days';
  
  -- Build comprehensive stats
  stats := json_build_object(
    'user_id', user_uuid,
    'subscription_plan', user_record.subscription_plan,
    'subscription_status', user_record.subscription_status,
    'pages_used', user_record.pages_used,
    'account_created', user_record.created_at,
    'total_documents_processed', total_processed,
    'average_pages_per_document', ROUND(avg_pages_per_doc, 2),
    'recent_activity_30_days', recent_usage
  );
  
  -- Add plan-specific information
  IF user_record.subscription_plan = 'pro' THEN
    stats := stats || json_build_object(
      'pages_used_this_month', user_record.pages_processed_this_month,
      'monthly_limit', 1000,
      'monthly_usage_percentage', ROUND((user_record.pages_processed_this_month::NUMERIC / 1000) * 100, 2),
      'period_start', user_record.subscription_period_start,
      'period_end', user_record.subscription_period_end,
      'days_until_reset', 
        CASE 
          WHEN user_record.subscription_period_end IS NOT NULL THEN
            EXTRACT(days FROM user_record.subscription_period_end - NOW())::INTEGER
          ELSE NULL 
        END
    );
  ELSE
    stats := stats || json_build_object(
      'lifetime_limit', 10,
      'lifetime_usage_percentage', ROUND((user_record.pages_used::NUMERIC / 10) * 100, 2),
      'pages_remaining', GREATEST(0, 10 - user_record.pages_used)
    );
  END IF;
  
  RETURN stats;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create function to get usage history with pagination
CREATE OR REPLACE FUNCTION public.get_user_usage_history(
  user_uuid UUID,
  page_limit INTEGER DEFAULT 20,
  page_offset INTEGER DEFAULT 0,
  action_filter VARCHAR DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  total_count INTEGER;
  history_records JSON;
BEGIN
  -- Get total count for pagination
  SELECT COUNT(*)
  INTO total_count
  FROM public.usage_audit_log 
  WHERE user_id = user_uuid
    AND (action_filter IS NULL OR action = action_filter);
  
  -- Get paginated records
  SELECT json_agg(
    json_build_object(
      'id', id,
      'action', action,
      'pages_count', pages_count,
      'pages_before', pages_before,
      'pages_after', pages_after,
      'subscription_plan', subscription_plan_before,
      'created_at', created_at,
      'metadata', metadata
    ) ORDER BY created_at DESC
  )
  INTO history_records
  FROM public.usage_audit_log 
  WHERE user_id = user_uuid
    AND (action_filter IS NULL OR action = action_filter)
  ORDER BY created_at DESC
  LIMIT page_limit
  OFFSET page_offset;
  
  RETURN json_build_object(
    'total_count', total_count,
    'page_limit', page_limit,
    'page_offset', page_offset,
    'has_more', total_count > (page_offset + page_limit),
    'records', COALESCE(history_records, '[]'::json)
  );
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Create function for usage alerts (when approaching limits)
CREATE OR REPLACE FUNCTION public.check_usage_alerts(user_uuid UUID)
RETURNS JSON AS $$
DECLARE
  user_record RECORD;
  alerts JSON[];
  usage_percentage NUMERIC;
BEGIN
  -- Get user data
  SELECT 
    subscription_plan, subscription_status, pages_used, 
    pages_processed_this_month, subscription_period_end
  INTO user_record
  FROM public.users 
  WHERE id = user_uuid;
  
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'user_not_found');
  END IF;
  
  alerts := ARRAY[]::JSON[];
  
  -- Check free plan limits
  IF user_record.subscription_plan = 'free' THEN
    usage_percentage := (user_record.pages_used::NUMERIC / 10) * 100;
    
    IF usage_percentage >= 90 THEN
      alerts := alerts || json_build_object(
        'type', 'limit_warning',
        'severity', 'high',
        'message', 'You have used ' || ROUND(usage_percentage, 0) || '% of your free plan limit',
        'pages_used', user_record.pages_used,
        'pages_remaining', 10 - user_record.pages_used,
        'action_required', 'Consider upgrading to Pro for unlimited monthly pages'
      );
    ELSIF usage_percentage >= 70 THEN
      alerts := alerts || json_build_object(
        'type', 'limit_warning',
        'severity', 'medium',
        'message', 'You have used ' || ROUND(usage_percentage, 0) || '% of your free plan limit',
        'pages_used', user_record.pages_used,
        'pages_remaining', 10 - user_record.pages_used
      );
    END IF;
    
  -- Check pro plan monthly limits
  ELSIF user_record.subscription_plan = 'pro' AND 
        user_record.subscription_status IN ('active', 'trialing') THEN
    usage_percentage := (user_record.pages_processed_this_month::NUMERIC / 1000) * 100;
    
    IF usage_percentage >= 90 THEN
      alerts := alerts || json_build_object(
        'type', 'monthly_limit_warning',
        'severity', 'high',
        'message', 'You have used ' || ROUND(usage_percentage, 0) || '% of your monthly Pro limit',
        'pages_used_this_month', user_record.pages_processed_this_month,
        'pages_remaining', 1000 - user_record.pages_processed_this_month,
        'period_end', user_record.subscription_period_end
      );
    ELSIF usage_percentage >= 70 THEN
      alerts := alerts || json_build_object(
        'type', 'monthly_limit_warning',
        'severity', 'medium',
        'message', 'You have used ' || ROUND(usage_percentage, 0) || '% of your monthly Pro limit',
        'pages_used_this_month', user_record.pages_processed_this_month,
        'pages_remaining', 1000 - user_record.pages_processed_this_month,
        'period_end', user_record.subscription_period_end
      );
    END IF;
  END IF;
  
  -- Check subscription expiration
  IF user_record.subscription_plan = 'pro' AND 
     user_record.subscription_period_end IS NOT NULL AND
     user_record.subscription_period_end <= NOW() + INTERVAL '7 days' THEN
    alerts := alerts || json_build_object(
      'type', 'subscription_expiring',
      'severity', 'medium',
      'message', 'Your Pro subscription expires soon',
      'period_end', user_record.subscription_period_end,
      'action_required', 'Ensure your payment method is up to date'
    );
  END IF;
  
  RETURN json_build_object(
    'user_id', user_uuid,
    'alert_count', array_length(alerts, 1),
    'alerts', COALESCE(alerts, ARRAY[]::JSON[])
  );
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Grant permissions for new functions
GRANT EXECUTE ON FUNCTION public.atomic_update_user_pages_usage(UUID, INTEGER, UUID, INET, TEXT) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_usage_stats(UUID) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_usage_history(UUID, INTEGER, INTEGER, VARCHAR) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.check_usage_alerts(UUID) TO service_role, authenticated;

-- Grant table permissions
GRANT SELECT, INSERT ON public.usage_audit_log TO authenticated, service_role;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_usage_audit_log_composite ON public.usage_audit_log(user_id, action, created_at DESC);

-- Comments for documentation
COMMENT ON TABLE public.usage_audit_log IS 'Comprehensive audit log for all usage tracking activities';
COMMENT ON FUNCTION public.atomic_update_user_pages_usage(UUID, INTEGER, UUID, INET, TEXT) IS 'Atomically updates user page usage with race condition protection and audit logging';
COMMENT ON FUNCTION public.get_user_usage_stats(UUID) IS 'Returns comprehensive usage statistics for a user';
COMMENT ON FUNCTION public.get_user_usage_history(UUID, INTEGER, INTEGER, VARCHAR) IS 'Returns paginated usage history with filtering';
COMMENT ON FUNCTION public.check_usage_alerts(UUID) IS 'Checks for usage alerts and warnings based on current limits';