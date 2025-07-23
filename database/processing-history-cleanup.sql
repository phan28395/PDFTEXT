-- Processing History Cleanup Functions
-- Implements automatic cleanup of processing history records older than 1 year

-- Create function to cleanup old processing history records
CREATE OR REPLACE FUNCTION cleanup_old_processing_history(
    p_retention_days INTEGER DEFAULT 365 -- 1 year default retention
) RETURNS JSON AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_text_cleanup_count INTEGER := 0;
    v_cutoff_date TIMESTAMP WITH TIME ZONE;
    v_total_freed_space BIGINT := 0;
    result JSON;
BEGIN
    -- Calculate cutoff date
    v_cutoff_date := NOW() - (p_retention_days || ' days')::interval;
    
    -- Calculate space that will be freed (sum of text content lengths)
    SELECT COALESCE(SUM(LENGTH(text_content)), 0)
    INTO v_total_freed_space
    FROM processing_history 
    WHERE created_at < v_cutoff_date 
    AND text_content IS NOT NULL;
    
    -- First, remove text content from old records (keep metadata but free up space)
    UPDATE processing_history 
    SET 
        text_content = NULL,
        updated_at = NOW()
    WHERE created_at < v_cutoff_date 
    AND text_content IS NOT NULL;
    
    GET DIAGNOSTICS v_text_cleanup_count = ROW_COUNT;
    
    -- For records older than 2 years, delete completely
    DELETE FROM processing_history 
    WHERE created_at < (NOW() - '730 days'::interval); -- 2 years
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Log the cleanup action in audit log
    INSERT INTO usage_audit_log (
        user_id,
        action,
        details,
        metadata,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        NULL, -- System action
        'system_cleanup',
        format('Cleaned up %s processing records older than %s days. Removed text content from %s records. Freed %s bytes.',
               v_deleted_count, 730, v_text_cleanup_count, v_total_freed_space),
        jsonb_build_object(
            'cleanup_type', 'processing_history',
            'retention_days', p_retention_days,
            'cutoff_date', v_cutoff_date,
            'deleted_records', v_deleted_count,
            'text_cleanup_count', v_text_cleanup_count,
            'freed_space_bytes', v_total_freed_space
        ),
        '127.0.0.1',
        'system-cleanup-function',
        NOW()
    );
    
    -- Build result
    SELECT json_build_object(
        'success', true,
        'deleted_records', v_deleted_count,
        'text_cleanup_count', v_text_cleanup_count,
        'freed_space_bytes', v_total_freed_space,
        'retention_days', p_retention_days,
        'cutoff_date', v_cutoff_date,
        'cleanup_timestamp', NOW()
    ) INTO result;
    
    RETURN result;
EXCEPTION
    WHEN OTHERS THEN
        -- Log error and return failure result
        INSERT INTO usage_audit_log (
            user_id,
            action,
            details,
            metadata,
            ip_address,
            user_agent,
            created_at
        ) VALUES (
            NULL,
            'system_cleanup_error',
            format('Processing history cleanup failed: %s', SQLERRM),
            jsonb_build_object(
                'error_message', SQLERRM,
                'error_state', SQLSTATE,
                'retention_days', p_retention_days
            ),
            '127.0.0.1',
            'system-cleanup-function',
            NOW()
        );
        
        SELECT json_build_object(
            'success', false,
            'error', SQLERRM,
            'error_code', SQLSTATE,
            'cleanup_timestamp', NOW()
        ) INTO result;
        
        RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get processing history cleanup statistics
CREATE OR REPLACE FUNCTION get_processing_history_cleanup_stats()
RETURNS TABLE (
    total_records BIGINT,
    records_with_text BIGINT,
    records_without_text BIGINT,
    records_older_than_1_year BIGINT,
    records_older_than_2_years BIGINT,
    total_text_size BIGINT,
    old_text_size BIGINT,
    potential_space_savings BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_records,
        COUNT(*) FILTER (WHERE text_content IS NOT NULL) as records_with_text,
        COUNT(*) FILTER (WHERE text_content IS NULL) as records_without_text,
        COUNT(*) FILTER (WHERE created_at < NOW() - '365 days'::interval) as records_older_than_1_year,
        COUNT(*) FILTER (WHERE created_at < NOW() - '730 days'::interval) as records_older_than_2_years,
        COALESCE(SUM(LENGTH(text_content)), 0) as total_text_size,
        COALESCE(SUM(LENGTH(text_content)) FILTER (WHERE created_at < NOW() - '365 days'::interval), 0) as old_text_size,
        COALESCE(SUM(LENGTH(text_content)) FILTER (WHERE created_at < NOW() - '365 days'::interval), 0) as potential_space_savings
    FROM processing_history;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to schedule automatic cleanup
CREATE OR REPLACE FUNCTION schedule_processing_history_cleanup()
RETURNS JSON AS $$
DECLARE
    v_last_cleanup TIMESTAMP WITH TIME ZONE;
    v_should_run BOOLEAN := FALSE;
    v_cleanup_result JSON;
    result JSON;
BEGIN
    -- Check when cleanup was last run (look for system cleanup entries in audit log)
    SELECT created_at 
    INTO v_last_cleanup
    FROM usage_audit_log 
    WHERE action = 'system_cleanup' 
    AND details LIKE '%processing records%'
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Run cleanup if:
    -- 1. Never run before, OR
    -- 2. Last run was more than 7 days ago
    v_should_run := (
        v_last_cleanup IS NULL OR 
        v_last_cleanup < NOW() - '7 days'::interval
    );
    
    IF v_should_run THEN
        -- Run the cleanup
        SELECT cleanup_old_processing_history() INTO v_cleanup_result;
        
        SELECT json_build_object(
            'scheduled', true,
            'executed', true,
            'last_cleanup', v_last_cleanup,
            'cleanup_result', v_cleanup_result,
            'next_scheduled', NOW() + '7 days'::interval
        ) INTO result;
    ELSE
        SELECT json_build_object(
            'scheduled', true,
            'executed', false,
            'reason', 'Cleanup not due yet',
            'last_cleanup', v_last_cleanup,
            'next_scheduled', v_last_cleanup + '7 days'::interval
        ) INTO result;
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to manually trigger cleanup with admin override
CREATE OR REPLACE FUNCTION manual_processing_history_cleanup(
    p_admin_user_id UUID,
    p_retention_days INTEGER DEFAULT 365,
    p_force BOOLEAN DEFAULT FALSE
) RETURNS JSON AS $$
DECLARE
    v_cleanup_result JSON;
    v_admin_exists BOOLEAN;
    result JSON;
BEGIN
    -- Verify admin user exists and has admin role
    SELECT EXISTS(
        SELECT 1 FROM users 
        WHERE id = p_admin_user_id 
        AND (is_admin = TRUE OR email LIKE '%@admin.%')
    ) INTO v_admin_exists;
    
    IF NOT v_admin_exists THEN
        SELECT json_build_object(
            'success', false,
            'error', 'Unauthorized: Admin privileges required',
            'timestamp', NOW()
        ) INTO result;
        RETURN result;
    END IF;
    
    -- Log admin action
    INSERT INTO usage_audit_log (
        user_id,
        action,
        details,
        metadata,
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        p_admin_user_id,
        'admin_manual_cleanup',
        format('Admin manually triggered processing history cleanup with %s days retention', p_retention_days),
        jsonb_build_object(
            'retention_days', p_retention_days,
            'force', p_force,
            'admin_user_id', p_admin_user_id
        ),
        '127.0.0.1',
        'admin-manual-cleanup',
        NOW()
    );
    
    -- Run the cleanup
    SELECT cleanup_old_processing_history(p_retention_days) INTO v_cleanup_result;
    
    SELECT json_build_object(
        'success', true,
        'manual_trigger', true,
        'admin_user_id', p_admin_user_id,
        'cleanup_result', v_cleanup_result,
        'timestamp', NOW()
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION cleanup_old_processing_history(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_processing_history_cleanup_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_processing_history_cleanup() TO authenticated;
GRANT EXECUTE ON FUNCTION manual_processing_history_cleanup(UUID, INTEGER, BOOLEAN) TO authenticated;

-- Add comments for documentation
COMMENT ON FUNCTION cleanup_old_processing_history IS 'Cleans up old processing history records. Removes text content after 1 year, deletes records after 2 years.';
COMMENT ON FUNCTION get_processing_history_cleanup_stats IS 'Returns statistics about processing history storage and potential cleanup savings.';
COMMENT ON FUNCTION schedule_processing_history_cleanup IS 'Automatically schedules and runs processing history cleanup if due (every 7 days).';
COMMENT ON FUNCTION manual_processing_history_cleanup IS 'Allows admins to manually trigger processing history cleanup with custom retention settings.';

-- Create a view for easy cleanup monitoring
CREATE OR REPLACE VIEW processing_history_cleanup_summary AS
SELECT 
    (SELECT json_agg(
        json_build_object(
            'created_at', created_at,
            'action', action,
            'details', details,
            'metadata', metadata
        ) ORDER BY created_at DESC
    ) FROM usage_audit_log 
    WHERE action IN ('system_cleanup', 'admin_manual_cleanup', 'system_cleanup_error')
    AND details LIKE '%processing%'
    LIMIT 10) as recent_cleanup_history,
    
    (SELECT * FROM get_processing_history_cleanup_stats()) as current_stats,
    
    (SELECT created_at FROM usage_audit_log 
     WHERE action = 'system_cleanup' 
     AND details LIKE '%processing records%'
     ORDER BY created_at DESC LIMIT 1) as last_automatic_cleanup,
     
    (SELECT created_at + '7 days'::interval FROM usage_audit_log 
     WHERE action = 'system_cleanup' 
     AND details LIKE '%processing records%'
     ORDER BY created_at DESC LIMIT 1) as next_scheduled_cleanup;

-- Grant access to the view
GRANT SELECT ON processing_history_cleanup_summary TO authenticated;

COMMENT ON VIEW processing_history_cleanup_summary IS 'Comprehensive view of processing history cleanup status, statistics, and schedule.';