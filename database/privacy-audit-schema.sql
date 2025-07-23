-- Privacy Audit Log Table for GDPR Compliance
-- This table tracks all privacy-related actions for audit and compliance purposes

CREATE TABLE IF NOT EXISTS privacy_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Can be null for anonymized entries
    action TEXT NOT NULL, -- e.g., 'data_export_requested', 'data_deletion_initiated', etc.
    ip_address INET,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}', -- Flexible storage for action-specific data
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_privacy_audit_log_user_id ON privacy_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_log_action ON privacy_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_log_created_at ON privacy_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_privacy_audit_log_ip_address ON privacy_audit_log(ip_address);

-- Row Level Security
ALTER TABLE privacy_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only view their own privacy audit logs
CREATE POLICY "Users can view own privacy audit logs" ON privacy_audit_log
    FOR SELECT USING (
        auth.uid() = user_id OR 
        user_id IS NULL -- Allow viewing anonymized entries for transparency
    );

-- Policy: Service can insert audit logs
CREATE POLICY "Service can insert privacy audit logs" ON privacy_audit_log
    FOR INSERT WITH CHECK (true);

-- Policy: Admins can view all logs (for compliance and support)
CREATE POLICY "Admins can view all privacy audit logs" ON privacy_audit_log
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- User Consent Management Table
CREATE TABLE IF NOT EXISTS user_consent (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL, -- e.g., 'marketing', 'analytics', 'processing', 'cookies'
    consented BOOLEAN NOT NULL DEFAULT false,
    consent_date TIMESTAMP WITH TIME ZONE,
    withdrawal_date TIMESTAMP WITH TIME ZONE,
    ip_address INET,
    user_agent TEXT,
    privacy_policy_version TEXT, -- Track which version of privacy policy user consented to
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure one record per user per consent type
    UNIQUE(user_id, consent_type)
);

-- Index for efficient querying
CREATE INDEX IF NOT EXISTS idx_user_consent_user_id ON user_consent(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consent_type ON user_consent(consent_type);
CREATE INDEX IF NOT EXISTS idx_user_consent_consented ON user_consent(consented);

-- Row Level Security
ALTER TABLE user_consent ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage their own consent
CREATE POLICY "Users can manage own consent" ON user_consent
    FOR ALL USING (auth.uid() = user_id);

-- Policy: Admins can view all consent records (for compliance)
CREATE POLICY "Admins can view all consent records" ON user_consent
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Data Retention Settings Table
CREATE TABLE IF NOT EXISTS data_retention_settings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    data_type TEXT NOT NULL UNIQUE, -- e.g., 'processing_history', 'audit_logs', 'user_data'
    retention_days INTEGER NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default retention settings
INSERT INTO data_retention_settings (data_type, retention_days, description) VALUES
    ('processing_text_content', 365, 'Extracted text content from PDF processing'),
    ('processing_metadata', 730, 'Processing metadata and statistics'),
    ('usage_audit_logs', 90, 'User activity and usage tracking logs'),
    ('privacy_audit_logs', 2555, 'Privacy-related actions (7 years for compliance)'),
    ('security_logs', 365, 'Security events and violations'),
    ('user_profile_data', -1, 'User profile data (retained until account deletion)'),
    ('batch_processing_data', 365, 'Batch processing jobs and results'),
    ('subscription_data', 2555, 'Billing and subscription history (7 years for tax compliance)')
ON CONFLICT (data_type) DO NOTHING;

-- Policy: Only admins can modify retention settings
ALTER TABLE data_retention_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage retention settings" ON data_retention_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.id = auth.uid() 
            AND users.is_admin = true
        )
    );

-- Public can read retention settings (for transparency)
CREATE POLICY "Public can read retention settings" ON data_retention_settings
    FOR SELECT USING (true);

-- Function to get user's privacy settings and consent status
CREATE OR REPLACE FUNCTION get_user_privacy_settings(p_user_id UUID)
RETURNS TABLE (
    consent_type TEXT,
    consented BOOLEAN,
    consent_date TIMESTAMP WITH TIME ZONE,
    privacy_policy_version TEXT,
    can_withdraw BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        uc.consent_type,
        uc.consented,
        uc.consent_date,
        uc.privacy_policy_version,
        (uc.consented = true AND uc.withdrawal_date IS NULL) as can_withdraw
    FROM user_consent uc
    WHERE uc.user_id = p_user_id
    ORDER BY uc.consent_type;
END;
$$;

-- Function to update user consent
CREATE OR REPLACE FUNCTION update_user_consent(
    p_user_id UUID,
    p_consent_type TEXT,
    p_consented BOOLEAN,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_privacy_policy_version TEXT DEFAULT '1.0'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_time TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
BEGIN
    -- Insert or update consent record
    INSERT INTO user_consent (
        user_id, 
        consent_type, 
        consented, 
        consent_date, 
        withdrawal_date,
        ip_address, 
        user_agent, 
        privacy_policy_version,
        updated_at
    ) VALUES (
        p_user_id,
        p_consent_type,
        p_consented,
        CASE WHEN p_consented THEN current_time ELSE NULL END,
        CASE WHEN NOT p_consented THEN current_time ELSE NULL END,
        p_ip_address,
        p_user_agent,
        p_privacy_policy_version,
        current_time
    )
    ON CONFLICT (user_id, consent_type) 
    DO UPDATE SET
        consented = p_consented,
        consent_date = CASE 
            WHEN p_consented AND NOT user_consent.consented THEN current_time 
            WHEN p_consented THEN user_consent.consent_date
            ELSE NULL 
        END,
        withdrawal_date = CASE 
            WHEN NOT p_consented AND user_consent.consented THEN current_time 
            WHEN NOT p_consented THEN user_consent.withdrawal_date
            ELSE NULL 
        END,
        ip_address = p_ip_address,
        user_agent = p_user_agent,
        privacy_policy_version = p_privacy_policy_version,
        updated_at = current_time;

    -- Log the consent change
    INSERT INTO privacy_audit_log (user_id, action, ip_address, user_agent, metadata)
    VALUES (
        p_user_id,
        CASE WHEN p_consented THEN 'consent_granted' ELSE 'consent_withdrawn' END,
        p_ip_address,
        p_user_agent,
        jsonb_build_object(
            'consent_type', p_consent_type,
            'consented', p_consented,
            'privacy_policy_version', p_privacy_policy_version,
            'timestamp', current_time
        )
    );

    RETURN true;
EXCEPTION
    WHEN OTHERS THEN
        RETURN false;
END;
$$;

-- Function to check data retention compliance
CREATE OR REPLACE FUNCTION check_data_retention_compliance()
RETURNS TABLE (
    data_type TEXT,
    retention_days INTEGER,
    expired_records_count BIGINT,
    next_cleanup_recommended TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    retention_record RECORD;
    expired_count BIGINT;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    FOR retention_record IN 
        SELECT drs.data_type, drs.retention_days 
        FROM data_retention_settings drs 
        WHERE drs.is_active = true AND drs.retention_days > 0
    LOOP
        cutoff_date := timezone('utc'::text, now()) - (retention_record.retention_days || ' days')::INTERVAL;
        expired_count := 0;

        -- Check different data types
        CASE retention_record.data_type
            WHEN 'processing_text_content' THEN
                SELECT COUNT(*) INTO expired_count
                FROM processing_history 
                WHERE created_at < cutoff_date AND extracted_text IS NOT NULL;
                
            WHEN 'usage_audit_logs' THEN
                SELECT COUNT(*) INTO expired_count
                FROM usage_audit_log 
                WHERE created_at < cutoff_date;
                
            WHEN 'privacy_audit_logs' THEN
                SELECT COUNT(*) INTO expired_count
                FROM privacy_audit_log 
                WHERE created_at < cutoff_date;
                
            WHEN 'security_logs' THEN
                SELECT COUNT(*) INTO expired_count
                FROM security_logs 
                WHERE created_at < cutoff_date;
                
            ELSE
                expired_count := 0;
        END CASE;

        RETURN QUERY SELECT 
            retention_record.data_type,
            retention_record.retention_days,
            expired_count,
            cutoff_date;
    END LOOP;
END;
$$;

-- Function to anonymize expired data
CREATE OR REPLACE FUNCTION anonymize_expired_data()
RETURNS TABLE (
    data_type TEXT,
    records_anonymized BIGINT,
    execution_time TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_time TIMESTAMP WITH TIME ZONE := timezone('utc'::text, now());
    text_content_cutoff TIMESTAMP WITH TIME ZONE;
    audit_cutoff TIMESTAMP WITH TIME ZONE;
    anonymized_count BIGINT;
BEGIN
    -- Get retention periods
    SELECT (current_time - (retention_days || ' days')::INTERVAL) INTO text_content_cutoff
    FROM data_retention_settings 
    WHERE data_type = 'processing_text_content' AND is_active = true;
    
    SELECT (current_time - (retention_days || ' days')::INTERVAL) INTO audit_cutoff
    FROM data_retention_settings 
    WHERE data_type = 'usage_audit_logs' AND is_active = true;

    -- Anonymize processing text content (keep metadata)
    UPDATE processing_history 
    SET extracted_text = NULL,
        structured_content = NULL,
        mathematical_content = NULL,
        images = NULL
    WHERE created_at < text_content_cutoff 
    AND (extracted_text IS NOT NULL OR structured_content IS NOT NULL);
    
    GET DIAGNOSTICS anonymized_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'processing_text_content'::TEXT,
        anonymized_count,
        current_time;

    -- Delete old usage audit logs
    DELETE FROM usage_audit_log 
    WHERE created_at < audit_cutoff;
    
    GET DIAGNOSTICS anonymized_count = ROW_COUNT;
    
    RETURN QUERY SELECT 
        'usage_audit_logs'::TEXT,
        anonymized_count,
        current_time;

    -- Log the anonymization action
    INSERT INTO privacy_audit_log (user_id, action, metadata)
    VALUES (
        NULL, -- System action
        'data_anonymization_completed',
        jsonb_build_object(
            'execution_time', current_time,
            'text_content_cutoff', text_content_cutoff,
            'audit_cutoff', audit_cutoff,
            'automated_process', true
        )
    );
END;
$$;

-- Create a view for privacy compliance dashboard
CREATE OR REPLACE VIEW privacy_compliance_summary AS
SELECT 
    'Total Users' as metric,
    COUNT(*)::TEXT as value,
    'active_users' as category
FROM users
WHERE deleted_at IS NULL

UNION ALL

SELECT 
    'Privacy Audit Logs (Last 30 Days)' as metric,
    COUNT(*)::TEXT as value,
    'audit_activity' as category
FROM privacy_audit_log
WHERE created_at >= (timezone('utc'::text, now()) - '30 days'::INTERVAL)

UNION ALL

SELECT 
    'Data Export Requests (Last 30 Days)' as metric,
    COUNT(*)::TEXT as value,
    'gdpr_requests' as category
FROM privacy_audit_log
WHERE action = 'data_export_completed'
AND created_at >= (timezone('utc'::text, now()) - '30 days'::INTERVAL)

UNION ALL

SELECT 
    'Data Deletion Requests (Last 30 Days)' as metric,
    COUNT(*)::TEXT as value,
    'gdpr_requests' as category
FROM privacy_audit_log
WHERE action = 'data_deletion_completed'
AND created_at >= (timezone('utc'::text, now()) - '30 days'::INTERVAL)

UNION ALL

SELECT 
    'Marketing Consent Rate' as metric,
    ROUND(
        (COUNT(*) FILTER (WHERE consented = true))::DECIMAL / 
        NULLIF(COUNT(*), 0) * 100, 1
    )::TEXT || '%' as value,
    'consent_rates' as category
FROM user_consent
WHERE consent_type = 'marketing';

-- Grant appropriate permissions
GRANT SELECT ON privacy_compliance_summary TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_privacy_settings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user_consent(UUID, TEXT, BOOLEAN, INET, TEXT, TEXT) TO authenticated;

-- Admin-only functions
GRANT EXECUTE ON FUNCTION check_data_retention_compliance() TO service_role;
GRANT EXECUTE ON FUNCTION anonymize_expired_data() TO service_role;

COMMENT ON TABLE privacy_audit_log IS 'Tracks all privacy-related actions for GDPR compliance and audit purposes';
COMMENT ON TABLE user_consent IS 'Manages user consent for different types of data processing';
COMMENT ON TABLE data_retention_settings IS 'Configures data retention periods for compliance';
COMMENT ON FUNCTION get_user_privacy_settings(UUID) IS 'Returns user privacy settings and consent status';
COMMENT ON FUNCTION update_user_consent(UUID, TEXT, BOOLEAN, INET, TEXT, TEXT) IS 'Updates user consent with audit logging';
COMMENT ON FUNCTION check_data_retention_compliance() IS 'Checks for expired data that should be cleaned up';
COMMENT ON FUNCTION anonymize_expired_data() IS 'Anonymizes expired data according to retention policies';