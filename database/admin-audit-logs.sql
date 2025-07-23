-- Admin Audit Logs Schema
-- This schema provides comprehensive audit logging for admin actions and compliance reporting

-- Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    
    -- Log identification
    log_type VARCHAR(50) NOT NULL, -- 'user_management', 'system_config', 'security_action', 'data_export', etc.
    action VARCHAR(100) NOT NULL, -- Specific action performed
    resource VARCHAR(100), -- Resource affected (user_id, setting_name, etc.)
    
    -- User information
    admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    target_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- User being acted upon (if applicable)
    
    -- Event details
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    details TEXT, -- Human-readable description
    metadata JSONB, -- Additional structured data
    
    -- Request information
    ip_address INET,
    user_agent TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT severity_check CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    CONSTRAINT log_type_check CHECK (log_type IN (
        'user_management', 'system_config', 'security_action', 'data_export',
        'subscription_management', 'content_moderation', 'system_maintenance',
        'compliance_report', 'authentication', 'authorization'
    ))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS admin_audit_logs_created_at_idx ON admin_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_user_idx ON admin_audit_logs(admin_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_target_user_idx ON admin_audit_logs(target_user_id);
CREATE INDEX IF NOT EXISTS admin_audit_logs_log_type_idx ON admin_audit_logs(log_type);
CREATE INDEX IF NOT EXISTS admin_audit_logs_action_idx ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS admin_audit_logs_severity_idx ON admin_audit_logs(severity);
CREATE INDEX IF NOT EXISTS admin_audit_logs_resource_idx ON admin_audit_logs(resource);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS admin_audit_logs_type_created_idx ON admin_audit_logs(log_type, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_created_idx ON admin_audit_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_audit_logs_severity_created_idx ON admin_audit_logs(severity, created_at DESC);

-- Create GIN index for metadata JSONB queries
CREATE INDEX IF NOT EXISTS admin_audit_logs_metadata_gin_idx ON admin_audit_logs USING GIN (metadata);

-- Enable Row Level Security (RLS)
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs" ON admin_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        auth.uid() IN (
            SELECT unnest(string_to_array(current_setting('app.admin_user_ids', true), ','))::uuid
        )
    );

-- RLS Policy: Only admins can insert audit logs (via service role)
CREATE POLICY "Service role can insert audit logs" ON admin_audit_logs
    FOR INSERT
    TO service_role
    WITH CHECK (true);

-- Create a function to log admin actions automatically
CREATE OR REPLACE FUNCTION log_admin_action(
    p_log_type VARCHAR(50),
    p_action VARCHAR(100),
    p_resource VARCHAR(100) DEFAULT NULL,
    p_admin_user_id UUID DEFAULT auth.uid(),
    p_target_user_id UUID DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT 'info',
    p_details TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_ip_address TEXT DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO admin_audit_logs (
        log_type,
        action,
        resource,
        admin_user_id,
        target_user_id,
        severity,
        details,
        metadata,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_log_type,
        p_action,
        p_resource,
        p_admin_user_id,
        p_target_user_id,
        p_severity,
        p_details,
        p_metadata,
        p_ip_address::inet,
        p_user_agent,
        NOW()
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to get audit log statistics
CREATE OR REPLACE FUNCTION get_audit_log_stats(
    p_date_from TIMESTAMP WITH TIME ZONE DEFAULT (NOW() - INTERVAL '30 days'),
    p_date_to TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
    total_logs BIGINT,
    logs_by_type JSONB,
    logs_by_severity JSONB,
    logs_by_admin JSONB,
    recent_critical JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH stats AS (
        SELECT 
            COUNT(*) as total,
            jsonb_object_agg(log_type, type_count) as by_type,
            jsonb_object_agg(severity, severity_count) as by_severity,
            jsonb_object_agg(admin_email, admin_count) as by_admin
        FROM (
            SELECT 
                al.log_type,
                al.severity,
                u.email as admin_email,
                COUNT(*) OVER (PARTITION BY al.log_type) as type_count,
                COUNT(*) OVER (PARTITION BY al.severity) as severity_count,
                COUNT(*) OVER (PARTITION BY al.admin_user_id) as admin_count
            FROM admin_audit_logs al
            JOIN auth.users u ON al.admin_user_id = u.id
            WHERE al.created_at >= p_date_from AND al.created_at <= p_date_to
        ) grouped
    ),
    critical_logs AS (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', al.id,
                'action', al.action,
                'details', al.details,
                'admin_email', u.email,
                'created_at', al.created_at
            ) ORDER BY al.created_at DESC
        ) as recent_critical
        FROM admin_audit_logs al
        JOIN auth.users u ON al.admin_user_id = u.id
        WHERE al.severity = 'critical' 
        AND al.created_at >= p_date_from 
        AND al.created_at <= p_date_to
        LIMIT 10
    )
    SELECT 
        stats.total,
        stats.by_type,
        stats.by_severity,
        stats.by_admin,
        COALESCE(critical_logs.recent_critical, '[]'::jsonb)
    FROM stats, critical_logs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function for compliance reporting
CREATE OR REPLACE FUNCTION generate_compliance_report(
    p_report_type VARCHAR(50), -- 'gdpr', 'hipaa', 'sox', 'general'
    p_date_from TIMESTAMP WITH TIME ZONE,
    p_date_to TIMESTAMP WITH TIME ZONE
) RETURNS TABLE (
    report_id UUID,
    report_type VARCHAR(50),
    total_events BIGINT,
    admin_actions JSONB,
    user_data_access JSONB,
    security_events JSONB,
    data_exports JSONB,
    generated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
    v_report_id UUID := gen_random_uuid();
BEGIN
    RETURN QUERY
    WITH compliance_data AS (
        SELECT 
            COUNT(*) as total,
            jsonb_agg(
                CASE WHEN log_type = 'user_management' 
                THEN jsonb_build_object(
                    'action', action,
                    'target_user', target_user_id,
                    'admin', admin_user_id,
                    'timestamp', created_at
                ) END
            ) FILTER (WHERE log_type = 'user_management') as admin_actions,
            
            jsonb_agg(
                CASE WHEN action ILIKE '%view%' OR action ILIKE '%access%' 
                THEN jsonb_build_object(
                    'action', action,
                    'resource', resource,
                    'admin', admin_user_id,
                    'timestamp', created_at
                ) END
            ) FILTER (WHERE action ILIKE '%view%' OR action ILIKE '%access%') as user_access,
            
            jsonb_agg(
                CASE WHEN log_type = 'security_action' 
                THEN jsonb_build_object(
                    'action', action,
                    'severity', severity,
                    'details', details,
                    'timestamp', created_at
                ) END
            ) FILTER (WHERE log_type = 'security_action') as security_events,
            
            jsonb_agg(
                CASE WHEN log_type = 'data_export' 
                THEN jsonb_build_object(
                    'action', action,
                    'resource', resource,
                    'admin', admin_user_id,
                    'timestamp', created_at
                ) END
            ) FILTER (WHERE log_type = 'data_export') as data_exports
        FROM admin_audit_logs
        WHERE created_at >= p_date_from AND created_at <= p_date_to
    )
    SELECT 
        v_report_id,
        p_report_type,
        cd.total,
        COALESCE(cd.admin_actions, '[]'::jsonb),
        COALESCE(cd.user_access, '[]'::jsonb),
        COALESCE(cd.security_events, '[]'::jsonb),
        COALESCE(cd.data_exports, '[]'::jsonb),
        NOW()
    FROM compliance_data cd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a view for audit log summary
CREATE OR REPLACE VIEW audit_log_summary AS
SELECT 
    DATE(created_at) as date,
    log_type,
    action,
    severity,
    COUNT(*) as count,
    COUNT(DISTINCT admin_user_id) as unique_admins,
    COUNT(DISTINCT target_user_id) as unique_targets
FROM admin_audit_logs
WHERE created_at >= (NOW() - INTERVAL '90 days')
GROUP BY DATE(created_at), log_type, action, severity
ORDER BY date DESC, count DESC;

-- Create a function to automatically clean up old audit logs (for data retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
    p_retention_days INTEGER DEFAULT 2555 -- 7 years default retention
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM admin_audit_logs 
    WHERE created_at < (NOW() - (p_retention_days || ' days')::interval);
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup action
    PERFORM log_admin_action(
        'system_maintenance',
        'cleanup_audit_logs',
        'audit_logs_table',
        NULL, -- system action, no admin user
        NULL, -- no target user
        'info',
        format('Cleaned up %s old audit log records older than %s days', deleted_count, p_retention_days),
        jsonb_build_object(
            'deleted_count', deleted_count,
            'retention_days', p_retention_days,
            'cleanup_date', NOW()
        )
    );
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant appropriate permissions
GRANT SELECT ON admin_audit_logs TO authenticated;
GRANT INSERT ON admin_audit_logs TO service_role;
GRANT EXECUTE ON FUNCTION log_admin_action TO service_role;
GRANT EXECUTE ON FUNCTION get_audit_log_stats TO service_role;
GRANT EXECUTE ON FUNCTION generate_compliance_report TO service_role;
GRANT SELECT ON audit_log_summary TO authenticated;

-- Add helpful comments
COMMENT ON TABLE admin_audit_logs IS 'Comprehensive audit log for all admin actions and system events for compliance and security monitoring';
COMMENT ON FUNCTION log_admin_action IS 'Helper function to create standardized audit log entries for admin actions';
COMMENT ON FUNCTION get_audit_log_stats IS 'Generate statistical summary of audit logs for dashboard display';
COMMENT ON FUNCTION generate_compliance_report IS 'Generate compliance reports for GDPR, HIPAA, SOX, and other regulatory requirements';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Data retention function to clean up old audit logs according to retention policy';

-- Example usage and sample data (for development/testing)
-- These would be removed in production

-- Sample audit log entries for testing
/*
SELECT log_admin_action(
    'user_management',
    'user_suspended',
    'user:550e8400-e29b-41d4-a716-446655440000',
    (SELECT id FROM auth.users LIMIT 1),
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    'warning',
    'User suspended for terms of service violation',
    '{"reason": "spam", "duration": "7 days"}'::jsonb,
    '192.168.1.100',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
);

SELECT log_admin_action(
    'system_config',
    'rate_limit_updated',
    'upload_rate_limit',
    (SELECT id FROM auth.users LIMIT 1),
    NULL,
    'info',
    'Upload rate limit changed from 5 to 10 per minute',
    '{"old_value": 5, "new_value": 10, "setting": "upload_rate_limit"}'::jsonb
);

SELECT log_admin_action(
    'data_export',
    'user_data_exported',
    'gdpr_export',
    (SELECT id FROM auth.users LIMIT 1),
    '550e8400-e29b-41d4-a716-446655440000'::uuid,
    'info',
    'User data exported for GDPR compliance request',
    '{"export_format": "json", "file_size": "2.5MB", "export_id": "exp_123456"}'::jsonb
);
*/