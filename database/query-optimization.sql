-- Database query optimization enhancements
-- Additional indexes, materialized views, and optimization functions

-- Additional composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_user_date_status 
ON processing_history(user_id, created_at DESC, status) 
WHERE created_at > NOW() - INTERVAL '1 year';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_jobs_user_created_status 
ON batch_jobs(user_id, created_at DESC, status)
WHERE created_at > NOW() - INTERVAL '6 months';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usage_audit_log_user_operation_date 
ON usage_audit_log(user_id, operation, created_at DESC)
WHERE created_at > NOW() - INTERVAL '3 months';

-- Partial indexes for frequently filtered data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_failed_recent 
ON processing_history(user_id, created_at DESC)
WHERE status = 'failed' AND created_at > NOW() - INTERVAL '30 days';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_jobs_processing_active 
ON batch_jobs(priority DESC, created_at ASC)
WHERE status IN ('pending', 'processing') AND created_at > NOW() - INTERVAL '1 day';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_recent_web_vitals 
ON performance_metrics(user_id, type, timestamp DESC)
WHERE type = 'web-vital' AND timestamp > NOW() - INTERVAL '24 hours';

-- Expression indexes for JSON queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_processing_history_page_count 
ON processing_history(user_id, ((extracted_data->>'page_count')::integer))
WHERE extracted_data ? 'page_count';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_performance_metrics_web_vital_rating 
ON performance_metrics(user_id, (data->>'rating'))
WHERE type = 'web-vital' AND data ? 'rating';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_batch_jobs_file_count 
ON batch_jobs(user_id, ((job_config->>'total_files')::integer))
WHERE job_config ? 'total_files';

-- Materialized views for dashboard queries
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_activity_summary AS
SELECT 
    user_id,
    DATE_TRUNC('day', created_at) as activity_date,
    COUNT(*) as total_operations,
    SUM(CASE WHEN operation = 'pdf_process' THEN 1 ELSE 0 END) as pdf_processes,
    SUM(CASE WHEN operation = 'batch_process' THEN 1 ELSE 0 END) as batch_processes,
    SUM(CASE WHEN operation = 'usage_increase' THEN pages_processed ELSE 0 END) as total_pages,
    AVG(CASE WHEN operation = 'pdf_process' THEN processing_time_ms ELSE NULL END) as avg_processing_time
FROM usage_audit_log
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY user_id, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON mv_user_activity_summary(user_id, activity_date);

-- Materialized view for performance dashboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_performance_summary AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    type,
    COUNT(*) as metric_count,
    AVG((data->>'value')::numeric) FILTER (WHERE data ? 'value') as avg_value,
    MAX((data->>'value')::numeric) FILTER (WHERE data ? 'value') as max_value,
    MIN((data->>'value')::numeric) FILTER (WHERE data ? 'value') as min_value,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(*) FILTER (WHERE data->>'rating' = 'poor') as poor_metrics,
    COUNT(*) FILTER (WHERE data->>'rating' = 'good') as good_metrics
FROM performance_metrics
WHERE timestamp >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', timestamp), type;

CREATE UNIQUE INDEX ON mv_performance_summary(hour, type);

-- Materialized view for cost analysis
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_cost_analysis AS
SELECT 
    user_id,
    service,
    DATE_TRUNC('day', created_at) as cost_date,
    SUM(cost_amount) as daily_cost,
    SUM(units_consumed) as daily_units,
    COUNT(*) as daily_operations,
    AVG(cost_amount) as avg_cost_per_operation
FROM api_cost_tracking
WHERE created_at >= NOW() - INTERVAL '90 days'
GROUP BY user_id, service, DATE_TRUNC('day', created_at);

CREATE UNIQUE INDEX ON mv_cost_analysis(user_id, service, cost_date);

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_dashboard_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_activity_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_performance_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_cost_analysis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to analyze slow queries
CREATE OR REPLACE FUNCTION analyze_slow_queries(
    threshold_ms integer DEFAULT 1000,
    limit_count integer DEFAULT 20
)
RETURNS TABLE (
    query text,
    mean_exec_time numeric,
    calls bigint,
    total_exec_time numeric,
    rows_per_call numeric,
    mean_io_time numeric
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_statements.query,
        pg_stat_statements.mean_exec_time,
        pg_stat_statements.calls,
        pg_stat_statements.total_exec_time,
        CASE 
            WHEN pg_stat_statements.calls > 0 
            THEN pg_stat_statements.rows::numeric / pg_stat_statements.calls 
            ELSE 0 
        END as rows_per_call,
        (pg_stat_statements.blk_read_time + pg_stat_statements.blk_write_time) / pg_stat_statements.calls as mean_io_time
    FROM pg_stat_statements
    WHERE pg_stat_statements.mean_exec_time > threshold_ms
        AND pg_stat_statements.calls > 1
    ORDER BY pg_stat_statements.mean_exec_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get table statistics
CREATE OR REPLACE FUNCTION get_table_statistics()
RETURNS TABLE (
    table_name text,
    row_count bigint,
    total_size text,
    index_size text,
    toast_size text,
    table_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.tablename::text,
        t.n_tup_ins - t.n_tup_del as row_count,
        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
        pg_size_pretty(pg_indexes_size(c.oid)) as index_size,
        pg_size_pretty(pg_total_relation_size(c.oid) - pg_relation_size(c.oid)) as toast_size,
        pg_size_pretty(pg_relation_size(c.oid)) as table_size
    FROM pg_stat_user_tables t
    JOIN pg_class c ON c.relname = t.tablename
    WHERE t.schemaname = 'public'
    ORDER BY pg_total_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get index usage statistics
CREATE OR REPLACE FUNCTION get_index_usage()
RETURNS TABLE (
    table_name text,
    index_name text,
    index_scans bigint,
    tuples_read bigint,
    tuples_fetched bigint,
    index_size text
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.tablename::text,
        i.indexrelname::text,
        i.idx_scan,
        i.idx_tup_read,
        i.idx_tup_fetch,
        pg_size_pretty(pg_relation_size(c.oid)) as index_size
    FROM pg_stat_user_indexes i
    JOIN pg_class c ON c.relname = i.indexrelname
    WHERE i.schemaname = 'public'
    ORDER BY i.idx_scan DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to identify unused indexes
CREATE OR REPLACE FUNCTION find_unused_indexes()
RETURNS TABLE (
    table_name text,
    index_name text,
    index_size text,
    index_scans bigint
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        i.tablename::text,
        i.indexrelname::text,
        pg_size_pretty(pg_relation_size(c.oid)) as index_size,
        i.idx_scan
    FROM pg_stat_user_indexes i
    JOIN pg_class c ON c.relname = i.indexrelname
    WHERE i.schemaname = 'public'
        AND i.idx_scan < 10  -- Less than 10 scans
        AND c.relname NOT LIKE '%_pkey'  -- Exclude primary keys
        AND c.relname NOT LIKE '%_unique'  -- Exclude unique constraints
    ORDER BY pg_relation_size(c.oid) DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for query plan analysis
CREATE OR REPLACE FUNCTION explain_query_plan(query_text text)
RETURNS TABLE (plan_line text) AS $$
BEGIN
    RETURN QUERY EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ' || query_text;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to optimize vacuum and analyze operations
CREATE OR REPLACE FUNCTION optimize_maintenance()
RETURNS text AS $$
DECLARE
    table_rec record;
    result text := '';
BEGIN
    -- Vacuum and analyze tables with high update/delete activity
    FOR table_rec IN 
        SELECT tablename, n_tup_upd + n_tup_del as changes
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        AND n_tup_upd + n_tup_del > 1000
        ORDER BY changes DESC
    LOOP
        EXECUTE 'VACUUM ANALYZE ' || quote_ident(table_rec.tablename);
        result := result || 'Vacuumed and analyzed ' || table_rec.tablename || E'\n';
    END LOOP;
    
    -- Update table statistics
    EXECUTE 'ANALYZE';
    result := result || 'Updated database statistics' || E'\n';
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to monitor connection and lock statistics
CREATE OR REPLACE FUNCTION get_database_health()
RETURNS TABLE (
    metric_name text,
    metric_value numeric,
    metric_unit text,
    status text
) AS $$
BEGIN
    RETURN QUERY
    WITH metrics AS (
        SELECT 'active_connections' as name, 
               COUNT(*)::numeric as value, 
               'connections' as unit,
               CASE WHEN COUNT(*) > 80 THEN 'warning' WHEN COUNT(*) > 100 THEN 'critical' ELSE 'healthy' END as status
        FROM pg_stat_activity 
        WHERE state = 'active'
        
        UNION ALL
        
        SELECT 'idle_connections' as name,
               COUNT(*)::numeric as value,
               'connections' as unit,
               CASE WHEN COUNT(*) > 50 THEN 'warning' ELSE 'healthy' END as status
        FROM pg_stat_activity 
        WHERE state = 'idle'
        
        UNION ALL
        
        SELECT 'database_size' as name,
               pg_database_size(current_database())::numeric / (1024*1024*1024) as value,
               'GB' as unit,
               CASE 
                   WHEN pg_database_size(current_database())::numeric / (1024*1024*1024) > 10 THEN 'warning'
                   WHEN pg_database_size(current_database())::numeric / (1024*1024*1024) > 20 THEN 'critical'
                   ELSE 'healthy' 
               END as status
        
        UNION ALL
        
        SELECT 'locks_granted' as name,
               COUNT(*)::numeric as value,
               'locks' as unit,
               CASE WHEN COUNT(*) > 1000 THEN 'warning' WHEN COUNT(*) > 2000 THEN 'critical' ELSE 'healthy' END as status
        FROM pg_locks 
        WHERE granted = true
        
        UNION ALL
        
        SELECT 'locks_waiting' as name,
               COUNT(*)::numeric as value,
               'locks' as unit,
               CASE WHEN COUNT(*) > 0 THEN 'warning' WHEN COUNT(*) > 10 THEN 'critical' ELSE 'healthy' END as status
        FROM pg_locks 
        WHERE granted = false
    )
    SELECT 
        m.name::text,
        m.value,
        m.unit::text,
        m.status::text
    FROM metrics m;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to monitor query performance in real-time
CREATE OR REPLACE FUNCTION get_active_queries()
RETURNS TABLE (
    pid integer,
    duration interval,
    query text,
    state text,
    wait_event text,
    client_addr inet
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        pg_stat_activity.pid,
        NOW() - pg_stat_activity.query_start as duration,
        pg_stat_activity.query,
        pg_stat_activity.state,
        pg_stat_activity.wait_event,
        pg_stat_activity.client_addr
    FROM pg_stat_activity
    WHERE pg_stat_activity.state != 'idle'
        AND pg_stat_activity.query IS NOT NULL
        AND pg_stat_activity.query NOT LIKE '%pg_stat_activity%'
    ORDER BY duration DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Automated maintenance scheduling
CREATE OR REPLACE FUNCTION schedule_maintenance_tasks()
RETURNS void AS $$
BEGIN
    -- Refresh materialized views every hour
    IF EXTRACT(minute FROM NOW()) = 0 THEN
        PERFORM refresh_dashboard_views();
    END IF;
    
    -- Run optimization every 6 hours
    IF EXTRACT(hour FROM NOW()) % 6 = 0 AND EXTRACT(minute FROM NOW()) = 0 THEN
        PERFORM optimize_maintenance();
    END IF;
    
    -- Cleanup old data daily at 2 AM
    IF EXTRACT(hour FROM NOW()) = 2 AND EXTRACT(minute FROM NOW()) = 0 THEN
        PERFORM cleanup_old_performance_metrics();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create extension for better query analysis if not exists
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Configure PostgreSQL parameters for better performance (recommendations)
-- These should be set in postgresql.conf:
/*
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.max = 10000
pg_stat_statements.track = all
effective_cache_size = '2GB'  -- Adjust based on available RAM
shared_buffers = '512MB'      -- Adjust based on available RAM
work_mem = '4MB'              -- Adjust based on workload
maintenance_work_mem = '64MB'  -- For maintenance operations
checkpoint_completion_target = 0.9
wal_buffers = '16MB'
random_page_cost = 1.1        -- For SSDs
*/

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION refresh_dashboard_views() TO authenticated;
GRANT EXECUTE ON FUNCTION get_database_health() TO authenticated;
GRANT SELECT ON mv_user_activity_summary TO authenticated;
GRANT SELECT ON mv_performance_summary TO authenticated;
GRANT SELECT ON mv_cost_analysis TO authenticated;

-- Grant admin-only functions
GRANT EXECUTE ON FUNCTION analyze_slow_queries(integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION get_table_statistics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_index_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION find_unused_indexes() TO authenticated;
GRANT EXECUTE ON FUNCTION optimize_maintenance() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_queries() TO authenticated;