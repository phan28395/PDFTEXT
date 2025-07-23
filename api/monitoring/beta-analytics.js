import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Set CORS headers for staging environment
  res.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify this is a staging environment
    if (process.env.NODE_ENV !== 'staging') {
      return res.status(403).json({ error: 'This endpoint is only available in staging' });
    }

    switch (req.method) {
      case 'GET':
        return await getBetaAnalytics(req, res);
      case 'POST':
        return await trackBetaEvent(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Beta analytics error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getBetaAnalytics(req, res) {
  try {
    // Get comprehensive beta analytics
    const { data: analytics, error } = await supabase
      .rpc('get_beta_analytics');

    if (error) throw error;

    // Get additional metrics
    const [
      { data: recentFeedback },
      { data: activeUsers },
      { data: topIssues },
      { data: featureUsage }
    ] = await Promise.all([
      // Recent feedback
      supabase
        .from('beta_feedback')
        .select('feedback_type, severity, created_at')
        .order('created_at', { ascending: false })
        .limit(50),

      // Active users in last 24 hours
      supabase
        .from('beta_users')
        .select('user_id, last_activity')
        .gte('last_activity', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),

      // Top issues by severity
      supabase
        .from('beta_feedback')
        .select('title, severity, feedback_type, created_at')
        .in('severity', ['high', 'critical'])
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(10),

      // Feature usage statistics
      supabase
        .from('beta_sessions')
        .select('features_used')
        .not('features_used', 'is', null)
        .gte('session_start', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    // Process feature usage data
    const featureStats = {};
    featureUsage?.forEach(session => {
      session.features_used?.forEach(feature => {
        featureStats[feature] = (featureStats[feature] || 0) + 1;
      });
    });

    const enhancedAnalytics = {
      ...analytics,
      recent_feedback: recentFeedback || [],
      active_users_24h: activeUsers?.length || 0,
      top_issues: topIssues || [],
      feature_usage: Object.entries(featureStats)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([feature, count]) => ({ feature, count })),
      last_updated: new Date().toISOString()
    };

    return res.status(200).json(enhancedAnalytics);
  } catch (error) {
    console.error('Error fetching beta analytics:', error);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}

async function trackBetaEvent(req, res) {
  try {
    const { event_type, user_id, metadata } = req.body;

    if (!event_type || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Verify user is a beta tester
    const { data: betaUser, error: betaError } = await supabase
      .from('beta_users')
      .select('id')
      .eq('user_id', user_id)
      .single();

    if (betaError || !betaUser) {
      return res.status(403).json({ error: 'User is not a beta tester' });
    }

    // Track the event
    const eventData = {
      event_type,
      user_id,
      metadata: metadata || {},
      ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
      user_agent: req.headers['user-agent'],
      timestamp: new Date().toISOString()
    };

    // Log to beta events table (if it exists) or use general logging
    const { error: logError } = await supabase
      .from('beta_events')
      .insert([eventData]);

    if (logError) {
      // Fallback to console logging if table doesn't exist
      console.log('Beta Event:', JSON.stringify(eventData));
    }

    // Update user activity
    await supabase
      .from('beta_users')
      .update({ last_activity: new Date().toISOString() })
      .eq('user_id', user_id);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error tracking beta event:', error);
    return res.status(500).json({ error: 'Failed to track event' });
  }
}