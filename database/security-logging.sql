-- Security Logging and Monitoring Database Schema
-- This extends the existing schema with security-related tables

-- Security logs table for tracking admin actions and security events
CREATE TABLE IF NOT EXISTS security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  action VARCHAR(100) NOT NULL,
  target_ip INET,
  admin_user_id UUID REFERENCES auth.users(id),
  source_ip INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS security_logs_created_at_idx ON security_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS security_logs_action_idx ON security_logs(action);
CREATE INDEX IF NOT EXISTS security_logs_target_ip_idx ON security_logs(target_ip);
CREATE INDEX IF NOT EXISTS security_logs_admin_user_idx ON security_logs(admin_user_id);

-- Row Level Security
ALTER TABLE security_logs ENABLE ROW LEVEL SECURITY;

-- Only allow admin users to read security logs
CREATE POLICY security_logs_admin_select ON security_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        -- Configure admin user IDs in environment or through a separate admin_users table
        SELECT unnest(string_to_array(current_setting('app.admin_user_ids', true), ','))::uuid
      )
    )
  );

-- Only allow system (service role) to insert security logs
CREATE POLICY security_logs_system_insert ON security_logs
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Rate limit violations table for tracking and analysis
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ip_address INET NOT NULL,
  endpoint VARCHAR(255) NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  user_agent TEXT,
  violation_type VARCHAR(50) NOT NULL, -- 'rate_limit', 'ddos', 'suspicious'
  violation_count INTEGER DEFAULT 1,
  first_violation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  last_violation TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for rate limit violations
CREATE INDEX IF NOT EXISTS rate_limit_violations_ip_idx ON rate_limit_violations(ip_address);
CREATE INDEX IF NOT EXISTS rate_limit_violations_endpoint_idx ON rate_limit_violations(endpoint);
CREATE INDEX IF NOT EXISTS rate_limit_violations_type_idx ON rate_limit_violations(violation_type);
CREATE INDEX IF NOT EXISTS rate_limit_violations_created_at_idx ON rate_limit_violations(created_at DESC);
CREATE INDEX IF NOT EXISTS rate_limit_violations_unresolved_idx ON rate_limit_violations(is_resolved, created_at) WHERE NOT is_resolved;

-- Row Level Security for rate limit violations
ALTER TABLE rate_limit_violations ENABLE ROW LEVEL SECURITY;

-- Only admin users can read/write rate limit violations
CREATE POLICY rate_limit_violations_admin_all ON rate_limit_violations
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT unnest(string_to_array(current_setting('app.admin_user_ids', true), ','))::uuid
      )
    )
  );

-- System can insert violations
CREATE POLICY rate_limit_violations_system_insert ON rate_limit_violations
  FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- Security metrics summary table for dashboard performance
CREATE TABLE IF NOT EXISTS security_metrics_summary (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  total_requests INTEGER DEFAULT 0,
  blocked_requests INTEGER DEFAULT 0,
  unique_ips INTEGER DEFAULT 0,
  suspicious_activities INTEGER DEFAULT 0,
  new_blacklisted_ips INTEGER DEFAULT 0,
  resolved_violations INTEGER DEFAULT 0,
  avg_response_time_ms NUMERIC(8,2) DEFAULT 0,
  max_concurrent_requests INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(date)
);

-- Index for metrics summary
CREATE INDEX IF NOT EXISTS security_metrics_summary_date_idx ON security_metrics_summary(date DESC);

-- Row Level Security for metrics summary
ALTER TABLE security_metrics_summary ENABLE ROW LEVEL SECURITY;

-- Only admin users can read metrics summary
CREATE POLICY security_metrics_summary_admin_select ON security_metrics_summary
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid()
      AND auth.users.id IN (
        SELECT unnest(string_to_array(current_setting('app.admin_user_ids', true), ','))::uuid
      )
    )
  );

-- System can insert/update metrics
CREATE POLICY security_metrics_summary_system_write ON security_metrics_summary
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Function to log rate limit violations
CREATE OR REPLACE FUNCTION log_rate_limit_violation(
  p_ip_address INET,
  p_endpoint VARCHAR(255),
  p_user_id UUID DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_violation_type VARCHAR(50) DEFAULT 'rate_limit'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  violation_id UUID;
  existing_violation_id UUID;
BEGIN
  -- Check if there's an existing unresolved violation for this IP/endpoint in the last hour
  SELECT id INTO existing_violation_id
  FROM rate_limit_violations
  WHERE ip_address = p_ip_address
    AND endpoint = p_endpoint
    AND NOT is_resolved
    AND last_violation > NOW() - INTERVAL '1 hour'
  LIMIT 1;
  
  IF existing_violation_id IS NOT NULL THEN
    -- Update existing violation
    UPDATE rate_limit_violations
    SET 
      violation_count = violation_count + 1,
      last_violation = timezone('utc'::text, now()),
      updated_at = timezone('utc'::text, now()),
      user_agent = COALESCE(p_user_agent, user_agent),
      user_id = COALESCE(p_user_id, user_id)
    WHERE id = existing_violation_id;
    
    RETURN existing_violation_id;
  ELSE
    -- Create new violation record
    INSERT INTO rate_limit_violations (
      ip_address,
      endpoint,
      user_id,
      user_agent,
      violation_type
    ) VALUES (
      p_ip_address,
      p_endpoint,
      p_user_id,
      p_user_agent,
      p_violation_type
    ) RETURNING id INTO violation_id;
    
    RETURN violation_id;
  END IF;
END;
$$;

-- Function to update daily security metrics
CREATE OR REPLACE FUNCTION update_security_metrics_summary(summary_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO security_metrics_summary (
    date,
    total_requests,
    blocked_requests,
    unique_ips,
    suspicious_activities,
    new_blacklisted_ips,
    resolved_violations,
    updated_at
  )
  VALUES (
    summary_date,
    -- Total requests from usage audit log
    (SELECT COUNT(*) FROM usage_audit_log WHERE DATE(created_at) = summary_date),
    -- Blocked requests (failed attempts)
    (SELECT COUNT(*) FROM usage_audit_log WHERE DATE(created_at) = summary_date AND NOT success),
    -- Unique IPs
    (SELECT COUNT(DISTINCT client_ip) FROM usage_audit_log WHERE DATE(created_at) = summary_date),
    -- Suspicious activities (rate limit violations)
    (SELECT COUNT(*) FROM rate_limit_violations WHERE DATE(created_at) = summary_date),
    -- New blacklisted IPs
    (SELECT COUNT(*) FROM security_logs WHERE DATE(created_at) = summary_date AND action = 'blacklist_add'),
    -- Resolved violations
    (SELECT COUNT(*) FROM rate_limit_violations WHERE DATE(resolved_at) = summary_date AND is_resolved = true),
    timezone('utc'::text, now())
  )
  ON CONFLICT (date) DO UPDATE SET
    total_requests = EXCLUDED.total_requests,
    blocked_requests = EXCLUDED.blocked_requests,
    unique_ips = EXCLUDED.unique_ips,
    suspicious_activities = EXCLUDED.suspicious_activities,
    new_blacklisted_ips = EXCLUDED.new_blacklisted_ips,
    resolved_violations = EXCLUDED.resolved_violations,
    updated_at = timezone('utc'::text, now());
END;
$$;

-- Function to clean up old security logs (keep for 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_security_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete security logs older than 90 days
  DELETE FROM security_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Delete resolved rate limit violations older than 30 days
  DELETE FROM rate_limit_violations
  WHERE is_resolved = true AND resolved_at < NOW() - INTERVAL '30 days';
  
  RETURN deleted_count;
END;
$$;

-- Function to get security dashboard data
CREATE OR REPLACE FUNCTION get_security_dashboard_data(
  time_range INTERVAL DEFAULT '24 hours'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  dashboard_data JSONB;
  start_time TIMESTAMP WITH TIME ZONE;
BEGIN
  start_time := NOW() - time_range;
  
  SELECT jsonb_build_object(
    'summary', jsonb_build_object(
      'total_requests', COALESCE((SELECT COUNT(*) FROM usage_audit_log WHERE created_at >= start_time), 0),
      'failed_requests', COALESCE((SELECT COUNT(*) FROM usage_audit_log WHERE created_at >= start_time AND NOT success), 0),
      'unique_ips', COALESCE((SELECT COUNT(DISTINCT client_ip) FROM usage_audit_log WHERE created_at >= start_time), 0),
      'rate_limit_violations', COALESCE((SELECT COUNT(*) FROM rate_limit_violations WHERE created_at >= start_time), 0),
      'security_events', COALESCE((SELECT COUNT(*) FROM security_logs WHERE created_at >= start_time), 0)
    ),
    'top_ips', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'ip', client_ip,
          'requests', request_count,
          'failures', failure_count
        )
      )
      FROM (
        SELECT 
          client_ip,
          COUNT(*) as request_count,
          COUNT(*) FILTER (WHERE NOT success) as failure_count
        FROM usage_audit_log
        WHERE created_at >= start_time
        GROUP BY client_ip
        ORDER BY request_count DESC
        LIMIT 10
      ) top_ips_data
    ),
    'recent_violations', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'ip', ip_address,
          'endpoint', endpoint,
          'violation_type', violation_type,
          'count', violation_count,
          'last_violation', last_violation
        )
      )
      FROM rate_limit_violations
      WHERE created_at >= start_time
      ORDER BY last_violation DESC
      LIMIT 20
    )
  ) INTO dashboard_data;
  
  RETURN dashboard_data;
END;
$$;

-- Create a trigger to automatically update security metrics daily
-- This would typically be handled by a cron job or scheduled function

COMMENT ON TABLE security_logs IS 'Logs all security-related admin actions and system events';
COMMENT ON TABLE rate_limit_violations IS 'Tracks rate limiting violations for analysis and monitoring';
COMMENT ON TABLE security_metrics_summary IS 'Daily aggregated security metrics for dashboard performance';

COMMENT ON FUNCTION log_rate_limit_violation IS 'Records or updates rate limit violations with automatic deduplication';
COMMENT ON FUNCTION update_security_metrics_summary IS 'Updates daily security metrics summary';
COMMENT ON FUNCTION cleanup_old_security_logs IS 'Cleans up old security logs to maintain performance';
COMMENT ON FUNCTION get_security_dashboard_data IS 'Retrieves comprehensive security dashboard data for specified time range';