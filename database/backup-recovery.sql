-- Backup and Recovery System Database Schema

-- Create enum types for backup operations
DO $$ BEGIN
    CREATE TYPE backup_type AS ENUM (
        'full',
        'incremental',
        'differential',
        'emergency'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE backup_status AS ENUM (
        'pending',
        'in_progress',
        'completed',
        'failed',
        'expired'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Backup registry table
CREATE TABLE IF NOT EXISTS backup_registry (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type backup_type NOT NULL,
    status backup_status NOT NULL DEFAULT 'pending',
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in milliseconds
    size BIGINT, -- Size in bytes
    tables TEXT[] NOT NULL,
    location VARCHAR(500) NOT NULL, -- Backup file location/path
    metadata JSONB DEFAULT '{}',
    error TEXT,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    created_by UUID, -- User who created the backup (NULL for automated)
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Recovery jobs table
CREATE TABLE IF NOT EXISTS recovery_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_id UUID REFERENCES backup_registry(id) ON DELETE CASCADE,
    status backup_status NOT NULL DEFAULT 'pending',
    requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration INTEGER, -- Duration in milliseconds
    tables TEXT[] DEFAULT '{}',
    recovery_point TIMESTAMP WITH TIME ZONE,
    requested_by UUID NOT NULL, -- Admin who requested recovery
    metadata JSONB DEFAULT '{}',
    error TEXT,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Backup schedules table
CREATE TABLE IF NOT EXISTS backup_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    type backup_type NOT NULL,
    schedule VARCHAR(100) NOT NULL, -- Cron expression
    tables TEXT[] NOT NULL,
    retention_days INTEGER NOT NULL DEFAULT 30,
    enabled BOOLEAN DEFAULT TRUE,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by UUID,
    environment VARCHAR(20) NOT NULL DEFAULT 'production',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Backup verification table (for integrity checks)
CREATE TABLE IF NOT EXISTS backup_verifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    backup_id UUID REFERENCES backup_registry(id) ON DELETE CASCADE,
    verification_type VARCHAR(50) NOT NULL, -- checksum, integrity, restore_test
    status backup_status NOT NULL DEFAULT 'pending',
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    result JSONB DEFAULT '{}',
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_backup_registry_status ON backup_registry(status);
CREATE INDEX IF NOT EXISTS idx_backup_registry_type ON backup_registry(type);
CREATE INDEX IF NOT EXISTS idx_backup_registry_scheduled_at ON backup_registry(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_backup_registry_completed_at ON backup_registry(completed_at);
CREATE INDEX IF NOT EXISTS idx_backup_registry_environment ON backup_registry(environment);
CREATE INDEX IF NOT EXISTS idx_backup_registry_tables ON backup_registry USING GIN(tables);

CREATE INDEX IF NOT EXISTS idx_recovery_jobs_status ON recovery_jobs(status);
CREATE INDEX IF NOT EXISTS idx_recovery_jobs_backup_id ON recovery_jobs(backup_id);
CREATE INDEX IF NOT EXISTS idx_recovery_jobs_requested_by ON recovery_jobs(requested_by);
CREATE INDEX IF NOT EXISTS idx_recovery_jobs_requested_at ON recovery_jobs(requested_at);

CREATE INDEX IF NOT EXISTS idx_backup_schedules_enabled ON backup_schedules(enabled);
CREATE INDEX IF NOT EXISTS idx_backup_schedules_next_run ON backup_schedules(next_run) WHERE enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_backup_schedules_environment ON backup_schedules(environment);

CREATE INDEX IF NOT EXISTS idx_backup_verifications_backup_id ON backup_verifications(backup_id);
CREATE INDEX IF NOT EXISTS idx_backup_verifications_status ON backup_verifications(status);

-- Enable Row Level Security
ALTER TABLE backup_registry ENABLE ROW LEVEL SECURITY;
ALTER TABLE recovery_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE backup_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (admin-only access for backup data)
DROP POLICY IF EXISTS backup_registry_admin_all ON backup_registry;
CREATE POLICY backup_registry_admin_all ON backup_registry
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

DROP POLICY IF EXISTS recovery_jobs_admin_all ON recovery_jobs;
CREATE POLICY recovery_jobs_admin_all ON recovery_jobs
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

DROP POLICY IF EXISTS backup_schedules_admin_all ON backup_schedules;
CREATE POLICY backup_schedules_admin_all ON backup_schedules
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

DROP POLICY IF EXISTS backup_verifications_admin_all ON backup_verifications;
CREATE POLICY backup_verifications_admin_all ON backup_verifications
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

-- Trigger functions
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_backup_registry_updated_at ON backup_registry;
CREATE TRIGGER update_backup_registry_updated_at
    BEFORE UPDATE ON backup_registry
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_recovery_jobs_updated_at ON recovery_jobs;
CREATE TRIGGER update_recovery_jobs_updated_at
    BEFORE UPDATE ON recovery_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_backup_schedules_updated_at ON backup_schedules;
CREATE TRIGGER update_backup_schedules_updated_at
    BEFORE UPDATE ON backup_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to get backup statistics
CREATE OR REPLACE FUNCTION get_backup_statistics(
    p_environment VARCHAR(20) DEFAULT 'production',
    p_days_back INTEGER DEFAULT 30
)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH backup_stats AS (
        SELECT 
            COUNT(*) as total_backups,
            COUNT(*) FILTER (WHERE status = 'completed') as successful_backups,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_backups,
            COUNT(*) FILTER (WHERE status = 'in_progress') as active_backups,
            COUNT(*) FILTER (WHERE type = 'full') as full_backups,
            COUNT(*) FILTER (WHERE type = 'incremental') as incremental_backups,
            COUNT(*) FILTER (WHERE type = 'differential') as differential_backups,
            COUNT(*) FILTER (WHERE type = 'emergency') as emergency_backups,
            AVG(size) FILTER (WHERE size IS NOT NULL) as avg_backup_size,
            AVG(duration) FILTER (WHERE duration IS NOT NULL) as avg_backup_duration
        FROM backup_registry
        WHERE environment = p_environment
        AND scheduled_at >= NOW() - (p_days_back || ' days')::INTERVAL
    ),
    recovery_stats AS (
        SELECT 
            COUNT(*) as total_recoveries,
            COUNT(*) FILTER (WHERE status = 'completed') as successful_recoveries,
            COUNT(*) FILTER (WHERE status = 'failed') as failed_recoveries,
            COUNT(*) FILTER (WHERE status = 'in_progress') as active_recoveries
        FROM recovery_jobs
        WHERE environment = p_environment
        AND requested_at >= NOW() - (p_days_back || ' days')::INTERVAL
    ),
    schedule_stats AS (
        SELECT 
            COUNT(*) as total_schedules,
            COUNT(*) FILTER (WHERE enabled = true) as active_schedules,
            MIN(next_run) FILTER (WHERE enabled = true) as next_scheduled_backup
        FROM backup_schedules
        WHERE environment = p_environment
    )
    SELECT json_build_object(
        'period_days', p_days_back,
        'environment', p_environment,
        'backups', row_to_json(backup_stats.*),
        'recoveries', row_to_json(recovery_stats.*),
        'schedules', row_to_json(schedule_stats.*),
        'timestamp', NOW()
    ) INTO result
    FROM backup_stats, recovery_stats, schedule_stats;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to cleanup old backups
CREATE OR REPLACE FUNCTION cleanup_old_backups(
    p_environment VARCHAR(20) DEFAULT 'production'
)
RETURNS JSON AS $$
DECLARE
    cleanup_count INTEGER := 0;
    backup_record RECORD;
    result JSON;
BEGIN
    -- Mark expired backups based on retention policies
    FOR backup_record IN
        SELECT 
            br.id,
            br.type,
            br.completed_at,
            bs.retention_days
        FROM backup_registry br
        LEFT JOIN backup_schedules bs ON bs.type = br.type AND bs.environment = br.environment
        WHERE br.environment = p_environment
        AND br.status = 'completed'
        AND br.completed_at < NOW() - COALESCE(bs.retention_days, 30) * INTERVAL '1 day'
    LOOP
        -- Update status to expired
        UPDATE backup_registry
        SET status = 'expired', updated_at = NOW()
        WHERE id = backup_record.id;
        
        cleanup_count := cleanup_count + 1;
    END LOOP;
    
    -- Also cleanup old failed backups (older than 7 days)
    UPDATE backup_registry
    SET status = 'expired', updated_at = NOW()
    WHERE environment = p_environment
    AND status = 'failed'
    AND scheduled_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS cleanup_count = cleanup_count + ROW_COUNT;
    
    SELECT json_build_object(
        'cleaned_up_count', cleanup_count,
        'environment', p_environment,
        'cleaned_at', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get backups due for cleanup
CREATE OR REPLACE FUNCTION get_backups_due_for_cleanup(
    p_environment VARCHAR(20) DEFAULT 'production'
)
RETURNS TABLE (
    backup_id UUID,
    backup_type backup_type,
    completed_at TIMESTAMP WITH TIME ZONE,
    age_days INTEGER,
    retention_days INTEGER,
    size_bytes BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        br.id,
        br.type,
        br.completed_at,
        EXTRACT(days FROM NOW() - br.completed_at)::INTEGER as age_days,
        COALESCE(bs.retention_days, 30) as retention_days,
        br.size
    FROM backup_registry br
    LEFT JOIN backup_schedules bs ON bs.type = br.type AND bs.environment = br.environment
    WHERE br.environment = p_environment
    AND br.status = 'completed'
    AND br.completed_at < NOW() - COALESCE(bs.retention_days, 30) * INTERVAL '1 day'
    ORDER BY br.completed_at ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify backup integrity
CREATE OR REPLACE FUNCTION create_backup_verification(
    p_backup_id UUID,
    p_verification_type VARCHAR(50) DEFAULT 'integrity'
)
RETURNS UUID AS $$
DECLARE
    verification_id UUID;
BEGIN
    INSERT INTO backup_verifications (
        backup_id,
        verification_type,
        status
    ) VALUES (
        p_backup_id,
        p_verification_type,
        'pending'
    ) RETURNING id INTO verification_id;
    
    RETURN verification_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT ALL ON backup_registry TO authenticated;
GRANT ALL ON recovery_jobs TO authenticated;
GRANT ALL ON backup_schedules TO authenticated;
GRANT ALL ON backup_verifications TO authenticated;

-- Grant function execution
GRANT EXECUTE ON FUNCTION get_backup_statistics(VARCHAR, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_old_backups(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION get_backups_due_for_cleanup(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION create_backup_verification(UUID, VARCHAR) TO authenticated;