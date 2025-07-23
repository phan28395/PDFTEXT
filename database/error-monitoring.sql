-- Error monitoring database schema

-- Error reports table
CREATE TABLE IF NOT EXISTS error_reports (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('error', 'warn', 'info')),
    message TEXT NOT NULL,
    stack TEXT,
    context JSONB,
    user_id UUID REFERENCES users(id),
    session_id TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    occurrence_count INTEGER DEFAULT 1,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_occurrence TIMESTAMPTZ DEFAULT NOW(),
    tags TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Error statistics table
CREATE TABLE IF NOT EXISTS error_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    error_level TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    unique_errors INTEGER DEFAULT 1,
    unique_users INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date, error_level)
);

-- Error alerts table
CREATE TABLE IF NOT EXISTS error_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    error_id TEXT REFERENCES error_reports(id),
    alert_type TEXT NOT NULL CHECK (alert_type IN ('immediate', 'threshold', 'pattern')),
    rule_id TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'acknowledged')),
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMPTZ,
    delivery_method TEXT[] DEFAULT ARRAY[]::TEXT[], -- email, slack, webhook
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Alert rules table
CREATE TABLE IF NOT EXISTS alert_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    enabled BOOLEAN DEFAULT TRUE,
    conditions JSONB NOT NULL,
    actions JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered TIMESTAMPTZ
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metric_name TEXT NOT NULL,
    value NUMERIC NOT NULL,
    unit TEXT DEFAULT 'ms',
    user_id UUID REFERENCES users(id),
    session_id TEXT,
    context JSONB DEFAULT '{}'::JSONB,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- User session tracking
CREATE TABLE IF NOT EXISTS user_sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    last_activity TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    user_agent TEXT,
    ip_address INET,
    country TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_reports_timestamp ON error_reports(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_fingerprint ON error_reports(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_reports_level ON error_reports(level);
CREATE INDEX IF NOT EXISTS idx_error_reports_resolved ON error_reports(resolved);
CREATE INDEX IF NOT EXISTS idx_error_reports_session_id ON error_reports(session_id);

CREATE INDEX IF NOT EXISTS idx_error_statistics_date ON error_statistics(date);
CREATE INDEX IF NOT EXISTS idx_error_statistics_level ON error_statistics(error_level);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_started_at ON user_sessions(started_at);

-- GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_error_reports_context ON error_reports USING GIN(context);
CREATE INDEX IF NOT EXISTS idx_alert_rules_conditions ON alert_rules USING GIN(conditions);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_context ON performance_metrics USING GIN(context);

-- Row Level Security
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_statistics ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Error reports: Users can only see their own errors, admins see all
CREATE POLICY error_reports_user_policy ON error_reports
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Admin-only insert policy for error reports (API handles this)
CREATE POLICY error_reports_admin_insert ON error_reports
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Error statistics: Admin only
CREATE POLICY error_statistics_admin_only ON error_statistics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Error alerts: Admin only
CREATE POLICY error_alerts_admin_only ON error_alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Alert rules: Admin only
CREATE POLICY alert_rules_admin_only ON alert_rules
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Performance metrics: Users can see their own, admins see all
CREATE POLICY performance_metrics_user_policy ON performance_metrics
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- User sessions: Users can see their own, admins see all
CREATE POLICY user_sessions_user_policy ON user_sessions
    FOR SELECT USING (
        user_id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() AND role = 'admin'
        )
    );

-- Functions

-- Function to increment error count
CREATE OR REPLACE FUNCTION increment_error_count(
    date DATE,
    error_level TEXT,
    user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO error_statistics (date, error_level, count, unique_errors, unique_users)
    VALUES (date, error_level, 1, 1, CASE WHEN user_id IS NOT NULL THEN 1 ELSE 0 END)
    ON CONFLICT (date, error_level) 
    DO UPDATE SET
        count = error_statistics.count + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get error count for time window
CREATE OR REPLACE FUNCTION get_error_count_since(
    since_timestamp BIGINT,
    pattern TEXT DEFAULT ''
) RETURNS TABLE(count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT COUNT(*)::BIGINT
    FROM error_reports
    WHERE 
        EXTRACT(EPOCH FROM timestamp) * 1000 >= since_timestamp
        AND (pattern = '' OR message ~* pattern);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top errors
CREATE OR REPLACE FUNCTION get_top_errors(
    time_window INTERVAL DEFAULT '24 hours',
    limit_count INTEGER DEFAULT 10
) RETURNS TABLE(
    fingerprint TEXT,
    message TEXT,
    count BIGINT,
    latest_occurrence TIMESTAMPTZ,
    affected_users BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        er.fingerprint,
        er.message,
        SUM(er.occurrence_count)::BIGINT as count,
        MAX(er.last_occurrence) as latest_occurrence,
        COUNT(DISTINCT er.user_id)::BIGINT as affected_users
    FROM error_reports er
    WHERE er.timestamp >= NOW() - time_window
    GROUP BY er.fingerprint, er.message
    ORDER BY count DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get error trends
CREATE OR REPLACE FUNCTION get_error_trends(
    days INTEGER DEFAULT 7
) RETURNS TABLE(
    date DATE,
    total_errors BIGINT,
    unique_errors BIGINT,
    critical_errors BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.date,
        COALESCE(SUM(es.count), 0)::BIGINT as total_errors,
        COALESCE(SUM(es.unique_errors), 0)::BIGINT as unique_errors,
        COALESCE(SUM(CASE WHEN es.error_level = 'error' THEN es.count ELSE 0 END), 0)::BIGINT as critical_errors
    FROM generate_series(CURRENT_DATE - INTERVAL '1 day' * days, CURRENT_DATE, '1 day'::INTERVAL) d(date)
    LEFT JOIN error_statistics es ON es.date = d.date
    GROUP BY d.date
    ORDER BY d.date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up old error reports
CREATE OR REPLACE FUNCTION cleanup_old_error_reports(
    retention_days INTEGER DEFAULT 90
) RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM error_reports
    WHERE timestamp < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Triggers

-- Update timestamp trigger for error_statistics
CREATE OR REPLACE FUNCTION update_error_statistics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_error_statistics_updated_at
    BEFORE UPDATE ON error_statistics
    FOR EACH ROW
    EXECUTE FUNCTION update_error_statistics_timestamp();

-- Trigger to update user session activity
CREATE OR REPLACE FUNCTION update_session_activity()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE user_sessions 
    SET last_activity = NOW()
    WHERE session_id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_session_activity
    AFTER INSERT ON error_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_session_activity();