-- Batch Processing Database Schema
-- Adds comprehensive batch processing capabilities to the PDF-to-text SaaS platform

-- Create batch_jobs table for managing batch processing operations
CREATE TABLE IF NOT EXISTS batch_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    priority INTEGER NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10), -- 1 = highest priority
    total_files INTEGER NOT NULL DEFAULT 0,
    processed_files INTEGER NOT NULL DEFAULT 0,
    failed_files INTEGER NOT NULL DEFAULT 0,
    total_pages INTEGER NOT NULL DEFAULT 0,
    processed_pages INTEGER NOT NULL DEFAULT 0,
    estimated_pages INTEGER DEFAULT 0,
    merge_output BOOLEAN NOT NULL DEFAULT false,
    merge_format VARCHAR(10) CHECK (merge_format IS NULL OR merge_format IN ('txt', 'md', 'docx')),
    output_options JSONB DEFAULT '{}',
    error_details JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create batch_files table for tracking individual files in batch jobs
CREATE TABLE IF NOT EXISTS batch_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE NOT NULL,
    processing_record_id UUID REFERENCES processing_history(id) ON DELETE SET NULL,
    original_filename VARCHAR(500) NOT NULL,
    file_size BIGINT NOT NULL,
    estimated_pages INTEGER DEFAULT 1,
    actual_pages INTEGER,
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    error_message TEXT,
    error_code VARCHAR(50),
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create batch_outputs table for storing merged outputs
CREATE TABLE IF NOT EXISTS batch_outputs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_job_id UUID REFERENCES batch_jobs(id) ON DELETE CASCADE NOT NULL,
    output_type VARCHAR(10) NOT NULL CHECK (output_type IN ('txt', 'md', 'docx')),
    file_path VARCHAR(1000) NOT NULL,
    file_size BIGINT NOT NULL,
    download_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    download_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user_id ON batch_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_priority ON batch_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_created_at ON batch_jobs(created_at);
CREATE INDEX IF NOT EXISTS idx_batch_files_batch_job_id ON batch_files(batch_job_id);
CREATE INDEX IF NOT EXISTS idx_batch_files_status ON batch_files(status);
CREATE INDEX IF NOT EXISTS idx_batch_outputs_batch_job_id ON batch_outputs(batch_job_id);
CREATE INDEX IF NOT EXISTS idx_batch_outputs_download_token ON batch_outputs(download_token);
CREATE INDEX IF NOT EXISTS idx_batch_outputs_expires_at ON batch_outputs(expires_at);

-- Enable Row Level Security
ALTER TABLE batch_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_outputs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for batch_jobs
CREATE POLICY "Users can view their own batch jobs" ON batch_jobs
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own batch jobs" ON batch_jobs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own batch jobs" ON batch_jobs
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own batch jobs" ON batch_jobs
    FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for batch_files
CREATE POLICY "Users can view their batch files" ON batch_files
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_files.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert batch files for their jobs" ON batch_files
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_files.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their batch files" ON batch_files
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_files.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their batch files" ON batch_files
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_files.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

-- Create RLS policies for batch_outputs
CREATE POLICY "Users can view their batch outputs" ON batch_outputs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_outputs.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert batch outputs for their jobs" ON batch_outputs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_outputs.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update their batch outputs" ON batch_outputs
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_outputs.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete their batch outputs" ON batch_outputs
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM batch_jobs 
            WHERE batch_jobs.id = batch_outputs.batch_job_id 
            AND batch_jobs.user_id = auth.uid()
        )
    );

-- Create function to update batch job progress
CREATE OR REPLACE FUNCTION update_batch_job_progress(
    p_batch_job_id UUID
) RETURNS VOID AS $$
DECLARE
    v_total_files INTEGER;
    v_processed_files INTEGER;
    v_failed_files INTEGER;
    v_total_pages INTEGER;
    v_processed_pages INTEGER;
    v_new_status VARCHAR(50);
BEGIN
    -- Get current file counts
    SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status IN ('completed', 'failed', 'skipped')) as processed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed,
        COALESCE(SUM(estimated_pages), 0) as est_pages,
        COALESCE(SUM(actual_pages) FILTER (WHERE status = 'completed'), 0) as proc_pages
    INTO v_total_files, v_processed_files, v_failed_files, v_total_pages, v_processed_pages
    FROM batch_files 
    WHERE batch_job_id = p_batch_job_id;

    -- Determine new status
    IF v_processed_files = 0 THEN
        v_new_status := 'pending';
    ELSIF v_processed_files < v_total_files THEN
        v_new_status := 'processing';
    ELSIF v_failed_files = v_total_files THEN
        v_new_status := 'failed';
    ELSE
        v_new_status := 'completed';
    END IF;

    -- Update batch job
    UPDATE batch_jobs SET
        total_files = v_total_files,
        processed_files = v_processed_files,
        failed_files = v_failed_files,
        total_pages = v_total_pages,
        processed_pages = v_processed_pages,
        status = v_new_status,
        updated_at = NOW(),
        completed_at = CASE WHEN v_new_status IN ('completed', 'failed') THEN NOW() ELSE completed_at END
    WHERE id = p_batch_job_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to estimate batch processing cost
CREATE OR REPLACE FUNCTION estimate_batch_cost(
    p_batch_job_id UUID
) RETURNS TABLE (
    estimated_pages INTEGER,
    estimated_cost_usd DECIMAL(10,4),
    current_user_pages INTEGER,
    pages_remaining INTEGER,
    can_process BOOLEAN,
    requires_upgrade BOOLEAN
) AS $$
DECLARE
    v_user_id UUID;
    v_estimated_pages INTEGER;
    v_current_usage INTEGER;
    v_subscription_type VARCHAR(50);
    v_pages_limit INTEGER;
    v_cost_per_page DECIMAL(10,4) := 0.01; -- $0.01 per page
BEGIN
    -- Get job details
    SELECT bj.user_id, COALESCE(SUM(bf.estimated_pages), 0)
    INTO v_user_id, v_estimated_pages
    FROM batch_jobs bj
    LEFT JOIN batch_files bf ON bj.id = bf.batch_job_id
    WHERE bj.id = p_batch_job_id
    GROUP BY bj.user_id;

    -- Get user usage and subscription
    SELECT 
        COALESCE(u.pages_used, 0),
        COALESCE(u.subscription_type, 'free'),
        CASE WHEN u.subscription_type = 'pro' THEN 1000 ELSE 10 END
    INTO v_current_usage, v_subscription_type, v_pages_limit
    FROM users u
    WHERE u.id = v_user_id;

    RETURN QUERY SELECT
        v_estimated_pages,
        (v_estimated_pages * v_cost_per_page)::DECIMAL(10,4),
        v_current_usage,
        GREATEST(0, v_pages_limit - v_current_usage),
        (v_current_usage + v_estimated_pages) <= v_pages_limit,
        (v_current_usage + v_estimated_pages) > v_pages_limit AND v_subscription_type = 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get batch processing queue
CREATE OR REPLACE FUNCTION get_batch_processing_queue(
    p_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    batch_job_id UUID,
    user_id UUID,
    priority INTEGER,
    total_files INTEGER,
    estimated_pages INTEGER,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bj.id,
        bj.user_id,
        bj.priority,
        bj.total_files,
        bj.estimated_pages,
        bj.created_at
    FROM batch_jobs bj
    WHERE bj.status = 'pending'
    ORDER BY bj.priority ASC, bj.created_at ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to get next file to process in batch
CREATE OR REPLACE FUNCTION get_next_batch_file(
    p_batch_job_id UUID
) RETURNS TABLE (
    file_id UUID,
    filename VARCHAR(500),
    file_size BIGINT,
    estimated_pages INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        bf.id,
        bf.original_filename,
        bf.file_size,
        bf.estimated_pages
    FROM batch_files bf
    WHERE bf.batch_job_id = p_batch_job_id
      AND bf.status = 'pending'
    ORDER BY bf.created_at ASC
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to cleanup expired batch outputs
CREATE OR REPLACE FUNCTION cleanup_expired_batch_outputs() RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM batch_outputs
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update batch job progress when files change
CREATE OR REPLACE FUNCTION trigger_update_batch_progress() RETURNS TRIGGER AS $$
BEGIN
    -- Update progress for the affected batch job
    PERFORM update_batch_job_progress(COALESCE(NEW.batch_job_id, OLD.batch_job_id));
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batch_files_progress_trigger
    AFTER INSERT OR UPDATE OR DELETE ON batch_files
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_batch_progress();

-- Create trigger to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER batch_jobs_updated_at_trigger
    BEFORE UPDATE ON batch_jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER batch_files_updated_at_trigger
    BEFORE UPDATE ON batch_files
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_jobs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_files TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON batch_outputs TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION update_batch_job_progress(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION estimate_batch_cost(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_batch_processing_queue(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_next_batch_file(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_batch_outputs() TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE batch_jobs IS 'Stores batch processing job information and progress tracking';
COMMENT ON TABLE batch_files IS 'Tracks individual files within batch processing jobs';
COMMENT ON TABLE batch_outputs IS 'Stores merged output files for batch jobs with download tokens';
COMMENT ON FUNCTION update_batch_job_progress(UUID) IS 'Updates batch job progress based on file completion status';
COMMENT ON FUNCTION estimate_batch_cost(UUID) IS 'Estimates processing cost and checks user limits for batch jobs';
COMMENT ON FUNCTION get_batch_processing_queue(INTEGER) IS 'Gets pending batch jobs ordered by priority for processing';
COMMENT ON FUNCTION get_next_batch_file(UUID) IS 'Gets the next file to process in a batch job';
COMMENT ON FUNCTION cleanup_expired_batch_outputs() IS 'Removes expired batch output files and tokens';