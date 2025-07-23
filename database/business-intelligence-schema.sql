-- Business Intelligence Schema for PDF-to-Text SaaS
-- This schema provides comprehensive analytics and business intelligence capabilities

-- ============================================================================
-- USER BEHAVIOR TRACKING
-- ============================================================================

-- User activity tracking table
CREATE TABLE public.user_activity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  session_id VARCHAR(64) NOT NULL,
  activity_type VARCHAR(50) NOT NULL, -- 'login', 'upload', 'download', 'subscribe', 'cancel', etc.
  activity_data JSONB, -- Flexible data storage for activity-specific information
  user_agent TEXT,
  ip_address INET,
  referrer TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- User cohorts table for cohort analysis
CREATE TABLE public.user_cohorts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  cohort_month DATE NOT NULL, -- First day of the month the user signed up
  acquisition_channel VARCHAR(100), -- 'organic', 'referral', 'paid', 'social', etc.
  first_subscription_date TIMESTAMP WITH TIME ZONE,
  churn_date TIMESTAMP WITH TIME ZONE,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  lifetime_pages_processed INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  UNIQUE(user_id)
);

-- ============================================================================
-- CONVERSION FUNNEL TRACKING
-- ============================================================================

-- Conversion events tracking
CREATE TABLE public.conversion_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id VARCHAR(64) NOT NULL,
  event_name VARCHAR(100) NOT NULL, -- 'page_view', 'sign_up', 'first_upload', 'upgrade', etc.
  event_properties JSONB,
  funnel_step INTEGER, -- Ordinal position in conversion funnel
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- A/B TESTING FRAMEWORK
-- ============================================================================

-- A/B test definitions
CREATE TABLE public.ab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_name VARCHAR(100) NOT NULL UNIQUE,
  test_description TEXT,
  feature_flag VARCHAR(100) NOT NULL,
  status VARCHAR(20) DEFAULT 'draft' NOT NULL, -- 'draft', 'active', 'paused', 'completed'
  traffic_allocation DECIMAL(3,2) DEFAULT 0.50, -- Percentage of users in test
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  success_metric VARCHAR(100), -- 'conversion_rate', 'revenue_per_user', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users,
  
  -- Constraints
  CHECK (traffic_allocation >= 0 AND traffic_allocation <= 1)
);

-- A/B test variants
CREATE TABLE public.ab_test_variants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES public.ab_tests(id) ON DELETE CASCADE NOT NULL,
  variant_name VARCHAR(50) NOT NULL, -- 'control', 'variant_a', 'variant_b'
  variant_config JSONB, -- Configuration specific to this variant
  traffic_weight DECIMAL(3,2) DEFAULT 0.50, -- Weight within the test
  
  UNIQUE(test_id, variant_name)
);

-- User test assignments
CREATE TABLE public.ab_test_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID REFERENCES public.ab_tests(id) ON DELETE CASCADE NOT NULL,
  variant_id UUID REFERENCES public.ab_test_variants(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  session_id VARCHAR(64), -- For anonymous users
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  
  -- Unique assignment per user per test
  UNIQUE(test_id, user_id),
  UNIQUE(test_id, session_id)
);

-- ============================================================================
-- CUSTOMER LIFETIME VALUE AND CHURN PREDICTION
-- ============================================================================

-- CLV calculations and predictions
CREATE TABLE public.customer_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Current metrics
  current_mrr DECIMAL(10,2) DEFAULT 0, -- Monthly Recurring Revenue
  total_revenue DECIMAL(10,2) DEFAULT 0,
  months_active INTEGER DEFAULT 0,
  
  -- Predictions
  predicted_ltv DECIMAL(10,2), -- Predicted Lifetime Value
  churn_probability DECIMAL(5,4), -- Probability of churning in next 30 days (0-1)
  churn_risk_score INTEGER, -- 1-10 risk score
  
  -- Usage patterns
  avg_monthly_pages INTEGER DEFAULT 0,
  days_since_last_activity INTEGER,
  feature_adoption_score DECIMAL(3,2), -- 0-1 score based on feature usage
  
  -- Timestamps
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- MARKETING CAMPAIGNS AND AUTOMATION
-- ============================================================================

-- Campaign definitions
CREATE TABLE public.marketing_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_name VARCHAR(200) NOT NULL,
  campaign_type VARCHAR(50) NOT NULL, -- 'email', 'in_app', 'push', 'sms'
  trigger_type VARCHAR(50) NOT NULL, -- 'manual', 'behavioral', 'scheduled', 'churn_risk'
  trigger_conditions JSONB, -- Conditions that trigger the campaign
  
  -- Campaign content
  subject_line VARCHAR(500),
  message_content TEXT,
  call_to_action VARCHAR(200),
  
  -- Targeting
  target_audience JSONB, -- User segment criteria
  
  -- Status and scheduling
  status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  scheduled_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  created_by UUID REFERENCES auth.users,
  
  -- Performance tracking
  sent_count INTEGER DEFAULT 0,
  opened_count INTEGER DEFAULT 0,
  clicked_count INTEGER DEFAULT 0,
  converted_count INTEGER DEFAULT 0
);

-- Campaign sends and interactions
CREATE TABLE public.campaign_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES public.marketing_campaigns(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Interaction tracking
  sent_at TIMESTAMP WITH TIME ZONE,
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional data
  interaction_data JSONB,
  
  UNIQUE(campaign_id, user_id)
);

-- ============================================================================
-- REFERRAL PROGRAM
-- ============================================================================

-- Referral codes and tracking
CREATE TABLE public.referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  referral_code VARCHAR(20) NOT NULL UNIQUE,
  
  -- Tracking
  clicks INTEGER DEFAULT 0,
  signups INTEGER DEFAULT 0,
  conversions INTEGER DEFAULT 0,
  total_reward_earned DECIMAL(10,2) DEFAULT 0,
  
  -- Configuration
  reward_type VARCHAR(20) DEFAULT 'credit', -- 'credit', 'discount', 'cash'
  reward_amount DECIMAL(10,2) DEFAULT 5.00,
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active', 'paused', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Referral events
CREATE TABLE public.referral_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referral_id UUID REFERENCES public.referrals(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  event_type VARCHAR(20) NOT NULL, -- 'click', 'signup', 'conversion'
  reward_amount DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- BUSINESS METRICS AGGREGATION
-- ============================================================================

-- Daily business metrics summary
CREATE TABLE public.daily_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL UNIQUE,
  
  -- Revenue metrics
  daily_revenue DECIMAL(10,2) DEFAULT 0,
  daily_mrr DECIMAL(10,2) DEFAULT 0,
  new_subscriptions INTEGER DEFAULT 0,
  cancelled_subscriptions INTEGER DEFAULT 0,
  
  -- User metrics
  new_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  churned_users INTEGER DEFAULT 0,
  
  -- Usage metrics
  total_pages_processed INTEGER DEFAULT 0,
  total_api_calls INTEGER DEFAULT 0,
  
  -- Conversion metrics
  conversion_rate DECIMAL(5,4),
  
  -- Timestamps
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cohorts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ab_test_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.marketing_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- User activity policies
CREATE POLICY "Users can view their own activity" ON public.user_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own activity" ON public.user_activity
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admin access for analytics (requires admin role)
CREATE POLICY "Admins can view all analytics data" ON public.user_activity
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email IN ('admin@company.com', 'analytics@company.com')
    )
  );

-- Similar admin policies for other tables
CREATE POLICY "Admins can view all cohorts" ON public.user_cohorts
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email IN ('admin@company.com', 'analytics@company.com')
    )
  );

CREATE POLICY "Admins can manage A/B tests" ON public.ab_tests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND email IN ('admin@company.com', 'analytics@company.com')
    )
  );

-- Users can view their own referrals
CREATE POLICY "Users can view their own referrals" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id);

CREATE POLICY "Users can create their own referrals" ON public.referrals
  FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- ============================================================================
-- FUNCTIONS FOR ANALYTICS
-- ============================================================================

-- Function to calculate customer lifetime value
CREATE OR REPLACE FUNCTION calculate_customer_ltv(customer_user_id UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_revenue DECIMAL(10,2);
  months_active INTEGER;
  avg_monthly_revenue DECIMAL(10,2);
  predicted_ltv DECIMAL(10,2);
BEGIN
  -- Get total revenue and months active
  SELECT 
    COALESCE(SUM(amount), 0),
    GREATEST(1, EXTRACT(MONTH FROM AGE(NOW(), MIN(created_at))))
  INTO total_revenue, months_active
  FROM public.processing_history 
  WHERE user_id = customer_user_id;
  
  -- Calculate average monthly revenue
  avg_monthly_revenue := total_revenue / months_active;
  
  -- Simple LTV prediction (can be enhanced with ML models)
  predicted_ltv := avg_monthly_revenue * 12; -- Assume 12 month retention
  
  RETURN predicted_ltv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update daily metrics
CREATE OR REPLACE FUNCTION update_daily_metrics(target_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.daily_metrics (
    metric_date,
    new_users,
    total_pages_processed,
    daily_revenue
  )
  SELECT 
    target_date,
    COUNT(DISTINCT CASE WHEN DATE(created_at) = target_date THEN id END) as new_users,
    COALESCE(SUM(CASE WHEN DATE(created_at) = target_date THEN pages_processed END), 0) as pages_processed,
    0 as daily_revenue -- Will be updated by payment webhooks
  FROM public.users u
  LEFT JOIN public.processing_history ph ON u.id = ph.user_id
  ON CONFLICT (metric_date) DO UPDATE SET
    new_users = EXCLUDED.new_users,
    total_pages_processed = EXCLUDED.total_pages_processed,
    calculated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Create indexes for performance
CREATE INDEX idx_user_activity_user_id ON public.user_activity (user_id);
CREATE INDEX idx_user_activity_type ON public.user_activity (activity_type);
CREATE INDEX idx_user_activity_created_at ON public.user_activity (created_at);
CREATE INDEX idx_user_activity_session ON public.user_activity (session_id);

CREATE INDEX idx_user_cohorts_month ON public.user_cohorts (cohort_month);
CREATE INDEX idx_user_cohorts_channel ON public.user_cohorts (acquisition_channel);

CREATE INDEX idx_conversion_events_user_id ON public.conversion_events (user_id);
CREATE INDEX idx_conversion_events_name ON public.conversion_events (event_name);
CREATE INDEX idx_conversion_events_step ON public.conversion_events (funnel_step);
CREATE INDEX idx_conversion_events_created_at ON public.conversion_events (created_at);

CREATE INDEX idx_customer_metrics_churn_prob ON public.customer_metrics (churn_probability DESC);
CREATE INDEX idx_customer_metrics_ltv ON public.customer_metrics (predicted_ltv DESC);
CREATE INDEX idx_customer_metrics_risk ON public.customer_metrics (churn_risk_score DESC);

CREATE INDEX idx_campaign_interactions_campaign ON public.campaign_interactions (campaign_id);
CREATE INDEX idx_campaign_interactions_user ON public.campaign_interactions (user_id);

CREATE INDEX idx_referrals_referrer ON public.referrals (referrer_id);
CREATE INDEX idx_referrals_code ON public.referrals (referral_code);

CREATE INDEX idx_referral_events_referral ON public.referral_events (referral_id);
CREATE INDEX idx_referral_events_user ON public.referral_events (referred_user_id);
CREATE INDEX idx_referral_events_type ON public.referral_events (event_type);

CREATE INDEX idx_daily_metrics_date ON public.daily_metrics (metric_date DESC);

-- Additional indexes for common queries
CREATE INDEX idx_user_activity_compound ON public.user_activity (user_id, activity_type, created_at);
CREATE INDEX idx_conversion_events_funnel ON public.conversion_events (funnel_step, created_at);
CREATE INDEX idx_customer_metrics_composite ON public.customer_metrics (churn_probability, predicted_ltv);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE public.user_activity IS 'Tracks all user activities for behavior analysis';
COMMENT ON TABLE public.user_cohorts IS 'User cohort analysis data for retention tracking';
COMMENT ON TABLE public.conversion_events IS 'Conversion funnel event tracking';
COMMENT ON TABLE public.ab_tests IS 'A/B test definitions and configurations';
COMMENT ON TABLE public.customer_metrics IS 'Customer lifetime value and churn predictions';
COMMENT ON TABLE public.marketing_campaigns IS 'Automated marketing campaign management';
COMMENT ON TABLE public.referrals IS 'Referral program tracking';
COMMENT ON TABLE public.daily_metrics IS 'Daily aggregated business metrics';