-- Security Logging System Database Schema

-- Create enum types for security events
DO $$ BEGIN
    CREATE TYPE security_event_type AS ENUM (
      'auth_login',
      'auth_login_failed',
      'auth_logout',
      'auth_register',
      'auth_password_reset',
      'api_key_rotation',
      'rate_limit_exceeded',
      'csp_violation',
      'file_upload',
      'file_processing',
      'payment_initiated',
      'payment_completed',
      'payment_failed',
      'admin_action',
      'suspicious_activity',
      'security_breach',
      'data_access',
      'data_export',
      'data_deletion',
      'system_error',
      'malware_detected',
      'ip_blocked',
      'user_suspended'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE security_severity AS ENUM (
      'info',
      'low',
      'medium',
      'high',
      'critical'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Main security events table
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type security_event_type NOT NULL,
    severity security_severity NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id UUID,
    session_id UUID,
    ip_address INET NOT NULL,
    user_agent TEXT,
    endpoint TEXT,
    method VARCHAR(10),
    status_code INTEGER,
    message TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    fingerprint VARCHAR(255),
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    source VARCHAR(50) NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON security_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_security_events_environment ON security_events(environment);

-- Enable Row Level Security
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin-only access for security data)
DROP POLICY IF EXISTS security_events_admin_all ON security_events;
CREATE POLICY security_events_admin_all ON security_events
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND (
                auth.users.raw_user_meta_data->>'role' = 'admin' OR
                auth.users.app_meta_data->>'role' = 'admin'
            )
        )
    );

-- Function to get security metrics for dashboard
CREATE OR REPLACE FUNCTION get_security_dashboard_metrics(
    p_environment VARCHAR(20) DEFAULT 'production',
    p_hours_back INTEGER DEFAULT 24
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH recent_events AS (
        SELECT *
        FROM security_events
        WHERE environment = p_environment
        AND timestamp >= NOW() - (p_hours_back || ' hours')::INTERVAL
    ),
    metrics AS (
        SELECT 
            COUNT(*) as total_events,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
            COUNT(*) FILTER (WHERE severity = 'high') as high_events,
            COUNT(*) FILTER (WHERE severity = 'medium') as medium_events,
            COUNT(*) FILTER (WHERE severity = 'low') as low_events,
            COUNT(*) FILTER (WHERE severity = 'info') as info_events,
            COUNT(DISTINCT ip_address) as unique_ips,
            COUNT(DISTINCT user_id) FILTER (WHERE user_id IS NOT NULL) as unique_users,
            COUNT(*) FILTER (WHERE resolved = false AND severity IN ('critical', 'high')) as unresolved_critical
        FROM recent_events
    )
    SELECT json_build_object(
        'period_hours', p_hours_back,
        'environment', p_environment,
        'summary', row_to_json(metrics.*)
    ) INTO result
    FROM metrics;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON security_events TO authenticated;
GRANT EXECUTE ON FUNCTION get_security_dashboard_metrics(VARCHAR, INTEGER) TO authenticated;