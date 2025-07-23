-- Beta Testing Database Schema
-- This file contains all database tables and functions needed for beta testing

-- Beta Invitations Table
CREATE TABLE IF NOT EXISTS beta_invitations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    created_by UUID REFERENCES auth.users(id),
    email VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
    used_at TIMESTAMP WITH TIME ZONE,
    max_uses INTEGER DEFAULT 1,
    current_uses INTEGER DEFAULT 0,
    invitation_type VARCHAR(20) DEFAULT 'individual' CHECK (invitation_type IN ('individual', 'business', 'developer', 'bulk')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beta Users Table
CREATE TABLE IF NOT EXISTS beta_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) UNIQUE NOT NULL,
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'completed', 'dropped_out')),
    feedback_count INTEGER DEFAULT 0,
    last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    invitation_code VARCHAR(50) REFERENCES beta_invitations(code),
    user_type VARCHAR(20) DEFAULT 'individual' CHECK (user_type IN ('individual', 'business', 'developer')),
    testing_goals TEXT[] DEFAULT '{}',
    completion_percentage INTEGER DEFAULT 0,
    satisfaction_score INTEGER CHECK (satisfaction_score >= 1 AND satisfaction_score <= 5),
    would_recommend BOOLEAN,
    total_sessions INTEGER DEFAULT 0,
    total_session_time INTEGER DEFAULT 0, -- in seconds
    features_used TEXT[] DEFAULT '{}',
    issues_reported INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beta Feedback Table
CREATE TABLE IF NOT EXISTS beta_feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    feedback_type VARCHAR(30) NOT NULL CHECK (feedback_type IN ('bug_report', 'feature_request', 'usability', 'performance', 'general')),
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    severity VARCHAR(20) DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    category VARCHAR(50) NOT NULL,
    page_url TEXT,
    browser_info TEXT,
    screenshot_url TEXT,
    reproduction_steps TEXT,
    expected_behavior TEXT,
    actual_behavior TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed', 'duplicate')),
    priority INTEGER DEFAULT 3 CHECK (priority >= 1 AND priority <= 5),
    assigned_to UUID REFERENCES auth.users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    upvotes INTEGER DEFAULT 0,
    tags TEXT[] DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beta Sessions Table (for tracking user sessions during beta)
CREATE TABLE IF NOT EXISTS beta_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    session_end TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    pages_visited TEXT[] DEFAULT '{}',
    features_used TEXT[] DEFAULT '{}',
    actions_performed INTEGER DEFAULT 0,
    errors_encountered INTEGER DEFAULT 0,
    user_agent TEXT,
    ip_address INET,
    country VARCHAR(2),
    device_type VARCHAR(20),
    screen_resolution VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beta A/B Tests Table
CREATE TABLE IF NOT EXISTS beta_ab_tests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed')),
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_date TIMESTAMP WITH TIME ZONE,
    variants JSONB NOT NULL, -- {variant_a: {...}, variant_b: {...}}
    traffic_split JSONB DEFAULT '{"variant_a": 50, "variant_b": 50}',
    success_metrics TEXT[] DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Beta A/B Test Assignments Table
CREATE TABLE IF NOT EXISTS beta_ab_test_assignments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id UUID REFERENCES beta_ab_tests(id) NOT NULL,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    variant VARCHAR(50) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(test_id, user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_beta_invitations_code ON beta_invitations(code);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_status ON beta_invitations(status);
CREATE INDEX IF NOT EXISTS idx_beta_invitations_expires_at ON beta_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_beta_users_user_id ON beta_users(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_users_status ON beta_users(status);
CREATE INDEX IF NOT EXISTS idx_beta_users_last_activity ON beta_users(last_activity);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback(feedback_type);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_status ON beta_feedback(status);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_severity ON beta_feedback(severity);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_created_at ON beta_feedback(created_at);

CREATE INDEX IF NOT EXISTS idx_beta_sessions_user_id ON beta_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_sessions_start ON beta_sessions(session_start);

-- Row Level Security Policies
ALTER TABLE beta_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_ab_test_assignments ENABLE ROW LEVEL SECURITY;

-- Beta Users can read their own data
CREATE POLICY "Beta users can read own data" ON beta_users
    FOR SELECT USING (auth.uid() = user_id);

-- Beta Users can update their own data
CREATE POLICY "Beta users can update own data" ON beta_users
    FOR UPDATE USING (auth.uid() = user_id);

-- Beta Users can insert their own feedback
CREATE POLICY "Beta users can insert feedback" ON beta_feedback
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Beta Users can read their own feedback
CREATE POLICY "Beta users can read own feedback" ON beta_feedback
    FOR SELECT USING (auth.uid() = user_id);

-- Beta Users can read their own sessions
CREATE POLICY "Beta users can read own sessions" ON beta_sessions
    FOR SELECT USING (auth.uid() = user_id);

-- Beta Users can insert their own sessions
CREATE POLICY "Beta users can insert own sessions" ON beta_sessions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- A/B Test assignments are readable by assigned users
CREATE POLICY "Users can read own AB test assignments" ON beta_ab_test_assignments
    FOR SELECT USING (auth.uid() = user_id);

-- Admin policies (for admin users)
CREATE POLICY "Admins can manage invitations" ON beta_invitations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can read all beta data" ON beta_users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

CREATE POLICY "Admins can read all feedback" ON beta_feedback
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles 
            WHERE user_id = auth.uid() AND role = 'admin'
        )
    );

-- Functions for beta testing analytics
CREATE OR REPLACE FUNCTION get_beta_analytics()
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    WITH beta_stats AS (
        SELECT 
            COUNT(*) as total_users,
            COUNT(*) FILTER (WHERE status = 'active') as active_users,
            COUNT(*) FILTER (WHERE status = 'completed') as completed_users,
            COUNT(*) FILTER (WHERE status = 'dropped_out') as dropped_out_users,
            AVG(satisfaction_score) FILTER (WHERE satisfaction_score IS NOT NULL) as avg_satisfaction,
            AVG(completion_percentage) as avg_completion_rate
        FROM beta_users
    ),
    feedback_stats AS (
        SELECT 
            COUNT(*) as total_feedback,
            COUNT(*) FILTER (WHERE feedback_type = 'bug_report') as bug_reports,
            COUNT(*) FILTER (WHERE feedback_type = 'feature_request') as feature_requests,
            COUNT(*) FILTER (WHERE severity = 'critical') as critical_issues,
            COUNT(*) FILTER (WHERE status = 'resolved') as resolved_issues
        FROM beta_feedback
    ),
    session_stats AS (
        SELECT 
            AVG(duration_seconds) as avg_session_duration,
            SUM(actions_performed) as total_actions,
            AVG(errors_encountered) as avg_errors_per_session
        FROM beta_sessions
        WHERE session_end IS NOT NULL
    )
    SELECT json_build_object(
        'total_users', bs.total_users,
        'active_users', bs.active_users,
        'completion_rate', bs.avg_completion_rate,
        'satisfaction_score', bs.avg_satisfaction,
        'total_feedback', fs.total_feedback,
        'bug_reports', fs.bug_reports,
        'feature_requests', fs.feature_requests,
        'critical_issues', fs.critical_issues,
        'resolved_issues', fs.resolved_issues,
        'avg_session_duration', ss.avg_session_duration,
        'total_actions', ss.total_actions,
        'avg_errors_per_session', ss.avg_errors_per_session,
        'engagement_rate', CASE 
            WHEN bs.total_users > 0 THEN bs.active_users * 100.0 / bs.total_users 
            ELSE 0 
        END,
        'dropout_rate', CASE 
            WHEN bs.total_users > 0 THEN bs.dropped_out_users * 100.0 / bs.total_users 
            ELSE 0 
        END
    ) INTO result
    FROM beta_stats bs, feedback_stats fs, session_stats ss;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to generate invitation codes
CREATE OR REPLACE FUNCTION generate_beta_invitation_code()
RETURNS TEXT AS $$
DECLARE
    code TEXT;
    exists_check INTEGER;
BEGIN
    LOOP
        -- Generate a random 12-character code
        code := upper(substring(replace(encode(gen_random_bytes(9), 'base64'), '/', ''), 1, 12));
        
        -- Check if code already exists
        SELECT COUNT(*) INTO exists_check FROM beta_invitations WHERE code = code;
        
        -- Exit loop if code is unique
        EXIT WHEN exists_check = 0;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to create beta invitation
CREATE OR REPLACE FUNCTION create_beta_invitation(
    p_email TEXT DEFAULT NULL,
    p_invitation_type TEXT DEFAULT 'individual',
    p_expires_in_days INTEGER DEFAULT 30,
    p_max_uses INTEGER DEFAULT 1
)
RETURNS TEXT AS $$
DECLARE
    invitation_code TEXT;
BEGIN
    invitation_code := generate_beta_invitation_code();
    
    INSERT INTO beta_invitations (
        code,
        email,
        invitation_type,
        expires_at,
        max_uses,
        created_by
    ) VALUES (
        invitation_code,
        p_email,
        p_invitation_type,
        NOW() + (p_expires_in_days || ' days')::INTERVAL,
        p_max_uses,
        auth.uid()
    );
    
    RETURN invitation_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track beta user activity
CREATE OR REPLACE FUNCTION track_beta_activity(
    p_page_visited TEXT DEFAULT NULL,
    p_feature_used TEXT DEFAULT NULL,
    p_action_type TEXT DEFAULT 'page_view'
)
RETURNS VOID AS $$
DECLARE
    current_session_id UUID;
    is_beta_user BOOLEAN;
BEGIN
    -- Check if user is a beta user
    SELECT EXISTS(
        SELECT 1 FROM beta_users 
        WHERE user_id = auth.uid() AND status = 'active'
    ) INTO is_beta_user;
    
    IF NOT is_beta_user THEN
        RETURN;
    END IF;
    
    -- Update last activity
    UPDATE beta_users 
    SET 
        last_activity = NOW(),
        updated_at = NOW()
    WHERE user_id = auth.uid();
    
    -- Get or create current session
    SELECT id INTO current_session_id
    FROM beta_sessions
    WHERE user_id = auth.uid() 
        AND session_end IS NULL
        AND session_start > NOW() - INTERVAL '4 hours'
    ORDER BY session_start DESC
    LIMIT 1;
    
    IF current_session_id IS NULL THEN
        INSERT INTO beta_sessions (user_id, user_agent, ip_address)
        VALUES (auth.uid(), 
                COALESCE(current_setting('request.headers', true)::json->>'user-agent', ''),
                inet_client_addr())
        RETURNING id INTO current_session_id;
    END IF;
    
    -- Update session data
    UPDATE beta_sessions
    SET 
        pages_visited = array_append(
            CASE WHEN array_length(pages_visited, 1) > 50 
                 THEN pages_visited[2:50] 
                 ELSE pages_visited 
            END, 
            COALESCE(p_page_visited, '')
        ),
        features_used = CASE 
            WHEN p_feature_used IS NOT NULL THEN
                array_append(
                    CASE WHEN array_length(features_used, 1) > 50 
                         THEN features_used[2:50] 
                         ELSE features_used 
                    END,
                    p_feature_used
                )
            ELSE features_used
        END,
        actions_performed = actions_performed + 1
    WHERE id = current_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER update_beta_invitations_updated_at
    BEFORE UPDATE ON beta_invitations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beta_users_updated_at
    BEFORE UPDATE ON beta_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beta_feedback_updated_at
    BEFORE UPDATE ON beta_feedback
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beta_ab_tests_updated_at
    BEFORE UPDATE ON beta_ab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();