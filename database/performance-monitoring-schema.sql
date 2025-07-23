-- Performance monitoring database schema
-- Stores performance metrics, alerts, and monitoring data

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- 'web-vital', 'custom', 'api'
    data JSONB NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    url TEXT,
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance alerts table
CREATE TABLE IF NOT EXISTS performance_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System health metrics table
CREATE TABLE IF NOT EXISTS system_health_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value NUMERIC NOT NULL,
    unit VARCHAR(20),
    status VARCHAR(20) DEFAULT 'healthy', -- 'healthy', 'warning', 'critical'
    metadata JSONB,
    recorded_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cost tracking table for API usage
CREATE TABLE IF NOT EXISTS api_cost_tracking (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    service VARCHAR(50) NOT NULL, -- 'document-ai', 'virustotal', etc.
    operation VARCHAR(100) NOT NULL,
    cost_amount DECIMAL(10,6) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    units_consumed INTEGER,
    unit_type VARCHAR(50), -- 'pages', 'requests', 'bytes'
    processing_record_id UUID REFERENCES processing_history(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uptime monitoring table
CREATE TABLE IF NOT EXISTS uptime_monitoring (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    endpoint VARCHAR(500) NOT NULL,
    status_code INTEGER,
    response_time_ms INTEGER,
    is_available BOOLEAN NOT NULL,
    error_message TEXT,
    checked_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_performance_metrics_user_id ON performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_type ON performance_metrics(type);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_severity ON performance_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_performance_alerts_resolved ON performance_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_service ON system_health_metrics(service_name);
CREATE INDEX IF NOT EXISTS idx_system_health_metrics_recorded_at ON system_health_metrics(recorded_at);
CREATE INDEX IF NOT EXISTS idx_api_cost_tracking_user_id ON api_cost_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_api_cost_tracking_service ON api_cost_tracking(service);
CREATE INDEX IF NOT EXISTS idx_uptime_monitoring_service ON uptime_monitoring(service_name);
CREATE INDEX IF NOT EXISTS idx_uptime_monitoring_checked_at ON uptime_monitoring(checked_at);

-- Row Level Security policies
ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_cost_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE uptime_monitoring ENABLE ROW LEVEL SECURITY;

-- Performance metrics policies
CREATE POLICY "Users can view their own performance metrics" ON performance_metrics
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert performance metrics" ON performance_metrics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all performance metrics" ON performance_metrics
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Performance alerts policies
CREATE POLICY "Admins can manage performance alerts" ON performance_alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- System health metrics policies
CREATE POLICY "Service role can manage system health metrics" ON system_health_metrics
    FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view system health metrics" ON system_health_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- API cost tracking policies
CREATE POLICY "Users can view their own API costs" ON api_cost_tracking
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert API costs" ON api_cost_tracking
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all API costs" ON api_cost_tracking
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Uptime monitoring policies
CREATE POLICY "Service role can manage uptime monitoring" ON uptime_monitoring
    FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view uptime monitoring" ON uptime_monitoring
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Functions for performance monitoring

-- Get performance summary for a user
CREATE OR REPLACE FUNCTION get_user_performance_summary(user_uuid UUID)
RETURNS TABLE (
    web_vitals_score NUMERIC,
    avg_page_load_time NUMERIC,
    api_error_rate NUMERIC,
    total_api_calls INTEGER,
    last_24h_metrics INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH web_vitals AS (
        SELECT 
            AVG(CASE 
                WHEN (data->>'rating') = 'good' THEN 100
                WHEN (data->>'rating') = 'needs-improvement' THEN 50
                ELSE 0
            END) as score
        FROM performance_metrics 
        WHERE user_id = user_uuid 
        AND type = 'web-vital'
        AND timestamp > NOW() - INTERVAL '24 hours'
    ),
    page_load AS (
        SELECT AVG((data->>'value')::NUMERIC) as avg_time
        FROM performance_metrics 
        WHERE user_id = user_uuid 
        AND type = 'custom'
        AND data->>'name' = 'page-load-time'
        AND timestamp > NOW() - INTERVAL '24 hours'
    ),
    api_stats AS (
        SELECT 
            COUNT(*) as total_calls,
            AVG(CASE WHEN (data->>'status')::INTEGER >= 400 THEN 1.0 ELSE 0.0 END) * 100 as error_rate
        FROM performance_metrics 
        WHERE user_id = user_uuid 
        AND type = 'api'
        AND timestamp > NOW() - INTERVAL '24 hours'
    ),
    recent_metrics AS (
        SELECT COUNT(*) as count
        FROM performance_metrics 
        WHERE user_id = user_uuid 
        AND timestamp > NOW() - INTERVAL '24 hours'
    )
    SELECT 
        COALESCE(wv.score, 0),
        COALESCE(pl.avg_time, 0),
        COALESCE(apis.error_rate, 0),
        COALESCE(apis.total_calls, 0)::INTEGER,
        COALESCE(rm.count, 0)::INTEGER
    FROM web_vitals wv, page_load pl, api_stats apis, recent_metrics rm;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get system health status
CREATE OR REPLACE FUNCTION get_system_health_status()
RETURNS TABLE (
    service_name TEXT,
    status TEXT,
    last_check TIMESTAMPTZ,
    avg_response_time NUMERIC,
    availability_percentage NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        shm.service_name::TEXT,
        shm.status::TEXT,
        MAX(shm.recorded_at) as last_check,
        AVG(shm.value) as avg_response_time,
        (COUNT(CASE WHEN shm.status = 'healthy' THEN 1 END)::NUMERIC / COUNT(*)::NUMERIC * 100) as availability_percentage
    FROM system_health_metrics shm
    WHERE shm.recorded_at > NOW() - INTERVAL '24 hours'
    GROUP BY shm.service_name, shm.status
    ORDER BY last_check DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cost summary for a user
CREATE OR REPLACE FUNCTION get_user_cost_summary(user_uuid UUID, days INTEGER DEFAULT 30)
RETURNS TABLE (
    total_cost DECIMAL,
    document_ai_cost DECIMAL,
    total_pages_processed INTEGER,
    avg_cost_per_page DECIMAL,
    daily_costs JSONB
) AS $$
BEGIN
    RETURN QUERY
    WITH cost_data AS (
        SELECT 
            SUM(cost_amount) as total,
            SUM(CASE WHEN service = 'document-ai' THEN cost_amount ELSE 0 END) as doc_ai,
            SUM(CASE WHEN service = 'document-ai' THEN units_consumed ELSE 0 END) as pages,
            DATE(created_at) as cost_date,
            SUM(cost_amount) as daily_cost
        FROM api_cost_tracking 
        WHERE user_id = user_uuid 
        AND created_at > NOW() - INTERVAL '%s days'
        GROUP BY DATE(created_at)
    )
    SELECT 
        COALESCE(SUM(cd.total), 0),
        COALESCE(SUM(cd.doc_ai), 0),
        COALESCE(SUM(cd.pages), 0)::INTEGER,
        CASE 
            WHEN SUM(cd.pages) > 0 THEN SUM(cd.doc_ai) / SUM(cd.pages)
            ELSE 0
        END,
        COALESCE(
            json_agg(
                json_build_object(
                    'date', cd.cost_date,
                    'cost', cd.daily_cost
                )
                ORDER BY cd.cost_date
            ), 
            '[]'::json
        )::JSONB
    FROM cost_data cd;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track API costs
CREATE OR REPLACE FUNCTION track_api_cost(
    p_user_id UUID,
    p_service VARCHAR(50),
    p_operation VARCHAR(100),
    p_cost_amount DECIMAL(10,6),
    p_units_consumed INTEGER,
    p_unit_type VARCHAR(50),
    p_processing_record_id UUID DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    cost_id UUID;
BEGIN
    INSERT INTO api_cost_tracking (
        user_id,
        service,
        operation,
        cost_amount,
        units_consumed,
        unit_type,
        processing_record_id,
        metadata
    ) VALUES (
        p_user_id,
        p_service,
        p_operation,
        p_cost_amount,
        p_units_consumed,
        p_unit_type,
        p_processing_record_id,
        p_metadata
    ) RETURNING id INTO cost_id;
    
    RETURN cost_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old performance metrics (keep 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_performance_metrics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM performance_metrics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Also cleanup resolved alerts older than 30 days
    DELETE FROM performance_alerts 
    WHERE resolved = true 
    AND resolved_at < NOW() - INTERVAL '30 days';
    
    -- Cleanup old system health metrics (keep 30 days)
    DELETE FROM system_health_metrics 
    WHERE recorded_at < NOW() - INTERVAL '30 days';
    
    -- Cleanup old uptime monitoring (keep 7 days)
    DELETE FROM uptime_monitoring 
    WHERE checked_at < NOW() - INTERVAL '7 days';
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cost alerts table
CREATE TABLE IF NOT EXISTS cost_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    alert_type VARCHAR(50) NOT NULL, -- 'budget_warning', 'budget_exceeded', 'high_usage'
    period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    threshold DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) NOT NULL,
    percentage NUMERIC(5,2) NOT NULL,
    severity VARCHAR(20) NOT NULL, -- 'warning', 'critical'
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for cost alerts
CREATE INDEX IF NOT EXISTS idx_cost_alerts_user_id ON cost_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_created_at ON cost_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_cost_alerts_acknowledged ON cost_alerts(acknowledged);

-- Row Level Security for cost alerts
ALTER TABLE cost_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cost alerts" ON cost_alerts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert cost alerts" ON cost_alerts
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can acknowledge their own cost alerts" ON cost_alerts
    FOR UPDATE USING (auth.uid() = user_id);

-- Add cost tracking fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_api_costs DECIMAL(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS document_ai_costs DECIMAL(10,2) DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_pages_processed INTEGER DEFAULT 0;

-- Error reports table
CREATE TABLE IF NOT EXISTS error_reports (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    level VARCHAR(20) NOT NULL, -- 'error', 'warning', 'info', 'debug'
    message TEXT NOT NULL,
    stack TEXT,
    fingerprint VARCHAR(255) NOT NULL,
    url TEXT,
    user_agent TEXT,
    tags TEXT[] DEFAULT '{}',
    context JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error alerts table
CREATE TABLE IF NOT EXISTS error_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    error_fingerprint VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL, -- 'new_error', 'error_spike', 'high_frequency', 'critical_error'
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    message TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    first_occurrence TIMESTAMPTZ NOT NULL,
    last_occurrence TIMESTAMPTZ NOT NULL,
    affected_users INTEGER DEFAULT 0,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Error statistics table for daily aggregations
CREATE TABLE IF NOT EXISTS error_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    date DATE NOT NULL,
    total_errors INTEGER DEFAULT 0,
    errors_by_level JSONB DEFAULT '{}',
    errors_by_component JSONB DEFAULT '{}',
    unique_fingerprints TEXT[] DEFAULT '{}',
    affected_users INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(date)
);

-- Create indexes for error tracking
CREATE INDEX IF NOT EXISTS idx_error_reports_user_id ON error_reports(user_id);
CREATE INDEX IF NOT EXISTS idx_error_reports_fingerprint ON error_reports(fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_reports_level ON error_reports(level);
CREATE INDEX IF NOT EXISTS idx_error_reports_timestamp ON error_reports(timestamp);
CREATE INDEX IF NOT EXISTS idx_error_reports_created_at ON error_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_error_alerts_fingerprint ON error_alerts(error_fingerprint);
CREATE INDEX IF NOT EXISTS idx_error_alerts_type ON error_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_error_alerts_severity ON error_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_error_alerts_resolved ON error_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_error_alerts_created_at ON error_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_error_statistics_date ON error_statistics(date);

-- Row Level Security for error tracking
ALTER TABLE error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE error_statistics ENABLE ROW LEVEL SECURITY;

-- Error reports policies
CREATE POLICY "Service role can manage error reports" ON error_reports
    FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view all error reports" ON error_reports
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Error alerts policies
CREATE POLICY "Service role can manage error alerts" ON error_alerts
    FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can manage error alerts" ON error_alerts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Error statistics policies
CREATE POLICY "Service role can manage error statistics" ON error_statistics
    FOR ALL WITH CHECK (true);

CREATE POLICY "Admins can view error statistics" ON error_statistics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM auth.users 
            WHERE auth.uid() = auth.users.id 
            AND raw_user_meta_data->>'role' = 'admin'
        )
    );