-- API Keys table for developer access
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    key_hash VARCHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    
    CONSTRAINT api_keys_name_length CHECK (char_length(name) BETWEEN 1 AND 255),
    CONSTRAINT api_keys_key_hash_length CHECK (char_length(key_hash) = 64)
);

-- API Usage Logs table for tracking and analytics
CREATE TABLE IF NOT EXISTS public.api_usage_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint VARCHAR(100) NOT NULL,
    processing_time INTEGER NOT NULL, -- milliseconds
    pages_processed INTEGER DEFAULT 0,
    success BOOLEAN NOT NULL,
    error_message TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT api_usage_logs_processing_time_positive CHECK (processing_time >= 0),
    CONSTRAINT api_usage_logs_pages_positive CHECK (pages_processed >= 0)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON public.api_keys(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_api_key_id ON public.api_usage_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_id ON public.api_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_success ON public.api_usage_logs(success);

-- Row Level Security (RLS) policies
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

-- API Keys policies
CREATE POLICY "Users can view their own API keys" ON public.api_keys
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own API keys" ON public.api_keys
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON public.api_keys
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON public.api_keys
    FOR DELETE USING (auth.uid() = user_id);

-- API Usage Logs policies
CREATE POLICY "Users can view their own API usage logs" ON public.api_usage_logs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service can insert API usage logs" ON public.api_usage_logs
    FOR INSERT WITH CHECK (true); -- Service role can insert logs

-- Functions for API operations
CREATE OR REPLACE FUNCTION increment_api_key_usage(key_id UUID, last_used_at TIMESTAMP WITH TIME ZONE)
RETURNS VOID AS $$
BEGIN
    UPDATE public.api_keys 
    SET 
        usage_count = usage_count + 1,
        last_used_at = increment_api_key_usage.last_used_at
    WHERE id = key_id AND is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user plan limits (assuming subscription data exists)
CREATE OR REPLACE FUNCTION get_user_plan_limits(user_uuid UUID)
RETURNS TABLE(
    subscription_plan TEXT,
    subscription_status TEXT,
    api_requests_per_hour INTEGER,
    api_requests_per_day INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(u.subscription_plan, 'free')::TEXT as subscription_plan,
        COALESCE(u.subscription_status, 'active')::TEXT as subscription_status,
        CASE 
            WHEN COALESCE(u.subscription_plan, 'free') = 'pro' THEN 600
            ELSE 60
        END as api_requests_per_hour,
        CASE 
            WHEN COALESCE(u.subscription_plan, 'free') = 'pro' THEN 10000
            ELSE 500
        END as api_requests_per_day
    FROM users u
    WHERE u.id = user_uuid;
    
    -- If no user found, return default free limits
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'free'::TEXT, 'active'::TEXT, 60, 500;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old API usage logs (for maintenance)
CREATE OR REPLACE FUNCTION cleanup_old_api_logs()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete logs older than 90 days
    DELETE FROM public.api_usage_logs 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add API key tracking to existing users table (if needed)
-- This assumes the users table exists from previous migrations
ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS api_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS api_tier VARCHAR(20) DEFAULT 'free';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT SELECT, INSERT ON public.api_usage_logs TO authenticated;
GRANT EXECUTE ON FUNCTION increment_api_key_usage(UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_plan_limits(UUID) TO authenticated;

-- Comments for documentation
COMMENT ON TABLE public.api_keys IS 'Developer API keys for programmatic access';
COMMENT ON TABLE public.api_usage_logs IS 'Logs of API usage for analytics and rate limiting';
COMMENT ON FUNCTION increment_api_key_usage(UUID, TIMESTAMP WITH TIME ZONE) IS 'Atomically increment API key usage counter';
COMMENT ON FUNCTION get_user_plan_limits(UUID) IS 'Get API rate limits based on user subscription plan';
COMMENT ON FUNCTION cleanup_old_api_logs() IS 'Maintenance function to clean up old API usage logs';