-- API Key Rotation System Database Schema

-- Enable Row Level Security
ALTER SYSTEM SET row_security = on;

-- Table for storing API key configurations
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    current_key TEXT NOT NULL, -- Encrypted key
    previous_key TEXT, -- Encrypted previous key for rollback
    rotation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    next_rotation_date TIMESTAMP WITH TIME ZONE NOT NULL,
    rotation_interval_days INTEGER NOT NULL DEFAULT 90,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Unique constraint on service + environment
    UNIQUE(service_name, environment)
);

-- Table for logging key rotation events
CREATE TABLE IF NOT EXISTS key_rotation_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    rotation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    success BOOLEAN NOT NULL,
    message TEXT,
    user_id UUID, -- NULL for system-initiated rotations
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_api_keys_service_env ON api_keys(service_name, environment);
CREATE INDEX IF NOT EXISTS idx_api_keys_next_rotation ON api_keys(next_rotation_date) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_rotation_logs_service ON key_rotation_logs(service_name);
CREATE INDEX IF NOT EXISTS idx_rotation_logs_date ON key_rotation_logs(rotation_date);
CREATE INDEX IF NOT EXISTS idx_rotation_logs_success ON key_rotation_logs(success);

-- Enable Row Level Security on tables
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_rotation_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for api_keys table (admin access only)
CREATE POLICY api_keys_admin_all ON api_keys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- RLS Policies for key_rotation_logs table (admin access only)
CREATE POLICY rotation_logs_admin_all ON key_rotation_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' = 'admin'
        )
    );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for updating updated_at on api_keys
DROP TRIGGER IF EXISTS update_api_keys_updated_at ON api_keys;
CREATE TRIGGER update_api_keys_updated_at
    BEFORE UPDATE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to create api_keys table if not exists (for initialization)
CREATE OR REPLACE FUNCTION create_api_keys_table_if_not_exists()
RETURNS VOID AS $$
BEGIN
    -- This function is called from the TypeScript code to ensure tables exist
    -- Tables are already created above, so this is just a placeholder
    NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get keys needing rotation
CREATE OR REPLACE FUNCTION get_keys_needing_rotation(env_name TEXT DEFAULT 'production')
RETURNS TABLE (
    id UUID,
    service_name VARCHAR(100),
    environment VARCHAR(20),
    next_rotation_date TIMESTAMP WITH TIME ZONE,
    rotation_interval_days INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ak.id,
        ak.service_name,
        ak.environment,
        ak.next_rotation_date,
        ak.rotation_interval_days
    FROM api_keys ak
    WHERE ak.next_rotation_date <= NOW()
    AND ak.is_active = true
    AND ak.environment = env_name
    ORDER BY ak.next_rotation_date ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log key rotation event
CREATE OR REPLACE FUNCTION log_key_rotation(
    p_service_name VARCHAR(100),
    p_environment VARCHAR(20),
    p_success BOOLEAN,
    p_message TEXT DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO key_rotation_logs (
        service_name,
        environment,
        success,
        message,
        user_id,
        ip_address,
        user_agent
    ) VALUES (
        p_service_name,
        p_environment,
        p_success,
        p_message,
        p_user_id,
        p_ip_address,
        p_user_agent
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get rotation history for a service
CREATE OR REPLACE FUNCTION get_rotation_history(
    p_service_name VARCHAR(100) DEFAULT NULL,
    p_environment VARCHAR(20) DEFAULT 'production',
    p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    service_name VARCHAR(100),
    environment VARCHAR(20),
    rotation_date TIMESTAMP WITH TIME ZONE,
    success BOOLEAN,
    message TEXT,
    user_id UUID
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        krl.id,
        krl.service_name,
        krl.environment,
        krl.rotation_date,
        krl.success,
        krl.message,
        krl.user_id
    FROM key_rotation_logs krl
    WHERE (p_service_name IS NULL OR krl.service_name = p_service_name)
    AND krl.environment = p_environment
    ORDER BY krl.rotation_date DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get key rotation statistics
CREATE OR REPLACE FUNCTION get_rotation_statistics(
    p_environment VARCHAR(20) DEFAULT 'production',
    p_days_back INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH rotation_stats AS (
        SELECT 
            service_name,
            COUNT(*) as total_rotations,
            COUNT(*) FILTER (WHERE success = true) as successful_rotations,
            COUNT(*) FILTER (WHERE success = false) as failed_rotations,
            MAX(rotation_date) as last_rotation,
            ROUND(
                (COUNT(*) FILTER (WHERE success = true)::DECIMAL / COUNT(*)) * 100, 
                2
            ) as success_rate
        FROM key_rotation_logs krl
        WHERE krl.environment = p_environment
        AND krl.rotation_date >= NOW() - INTERVAL '%s days', p_days_back
        GROUP BY service_name
    ),
    overall_stats AS (
        SELECT 
            COUNT(DISTINCT service_name) as total_services,
            COUNT(*) as total_rotations,
            COUNT(*) FILTER (WHERE success = true) as successful_rotations,
            COUNT(*) FILTER (WHERE success = false) as failed_rotations
        FROM key_rotation_logs krl
        WHERE krl.environment = p_environment
        AND krl.rotation_date >= NOW() - INTERVAL '%s days', p_days_back
    )
    SELECT json_build_object(
        'period_days', p_days_back,
        'environment', p_environment,
        'overall', row_to_json(overall_stats.*),
        'by_service', json_agg(row_to_json(rotation_stats.*))
    ) INTO result
    FROM rotation_stats, overall_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to disable a key (emergency situation)
CREATE OR REPLACE FUNCTION disable_api_key(
    p_service_name VARCHAR(100),
    p_environment VARCHAR(20) DEFAULT 'production'
)
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE api_keys
    SET is_active = false,
        updated_at = NOW()
    WHERE service_name = p_service_name
    AND environment = p_environment;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the disable event
    PERFORM log_key_rotation(
        p_service_name,
        p_environment,
        true,
        'Key disabled via emergency procedure',
        auth.uid(),
        NULL,
        NULL
    );
    
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enable a key
CREATE OR REPLACE FUNCTION enable_api_key(
    p_service_name VARCHAR(100),
    p_environment VARCHAR(20) DEFAULT 'production'
)
RETURNS BOOLEAN AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    UPDATE api_keys
    SET is_active = true,
        updated_at = NOW()
    WHERE service_name = p_service_name
    AND environment = p_environment;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the enable event
    PERFORM log_key_rotation(
        p_service_name,
        p_environment,
        true,
        'Key enabled',
        auth.uid(),
        NULL,
        NULL
    );
    
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to rollback to previous key
CREATE OR REPLACE FUNCTION rollback_to_previous_key(
    p_service_name VARCHAR(100),
    p_environment VARCHAR(20) DEFAULT 'production'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_record api_keys%ROWTYPE;
    updated_count INTEGER;
BEGIN
    -- Get current key configuration
    SELECT * INTO current_record
    FROM api_keys
    WHERE service_name = p_service_name
    AND environment = p_environment
    AND is_active = true;
    
    -- Check if previous key exists
    IF current_record.previous_key IS NULL THEN
        RAISE EXCEPTION 'No previous key available for rollback for service: %', p_service_name;
    END IF;
    
    -- Swap current and previous keys
    UPDATE api_keys
    SET current_key = current_record.previous_key,
        previous_key = current_record.current_key,
        updated_at = NOW()
    WHERE service_name = p_service_name
    AND environment = p_environment;
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    
    -- Log the rollback event
    PERFORM log_key_rotation(
        p_service_name,
        p_environment,
        true,
        'Rolled back to previous key',
        auth.uid(),
        NULL,
        NULL
    );
    
    RETURN updated_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions to authenticated users (admins only via RLS)
GRANT ALL ON api_keys TO authenticated;
GRANT ALL ON key_rotation_logs TO authenticated;

-- Grant execution on functions to authenticated users
GRANT EXECUTE ON FUNCTION create_api_keys_table_if_not_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION get_keys_needing_rotation(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION log_key_rotation(VARCHAR, VARCHAR, BOOLEAN, TEXT, UUID, INET, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rotation_history(VARCHAR, VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_rotation_statistics(VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION disable_api_key(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION enable_api_key(VARCHAR, VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION rollback_to_previous_key(VARCHAR, VARCHAR) TO authenticated;