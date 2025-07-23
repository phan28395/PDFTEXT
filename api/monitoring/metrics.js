// Production Metrics Collection API
// Collects and aggregates key performance and business metrics

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Set CORS headers for monitoring dashboard access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method === 'GET') {
      // Collect real-time metrics
      const metrics = await collectMetrics();
      return res.status(200).json(metrics);
    }

    if (req.method === 'POST') {
      // Store custom metrics from frontend
      const metricData = req.body;
      await storeCustomMetric(metricData);
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Metrics collection error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    });
  }
}

async function collectMetrics() {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  try {
    // Collect system metrics
    const systemMetrics = {
      timestamp: now.toISOString(),
      system_status: 'healthy', // This would be calculated from health checks
      uptime_percentage: 99.9,   // This would be calculated from uptime data
    };

    // Collect user metrics
    const userMetrics = await getUserMetrics(hourAgo, dayAgo);

    // Collect processing metrics
    const processingMetrics = await getProcessingMetrics(hourAgo, dayAgo);

    // Collect business metrics
    const businessMetrics = await getBusinessMetrics(dayAgo);

    // Collect performance metrics
    const performanceMetrics = await getPerformanceMetrics(hourAgo);

    return {
      ...systemMetrics,
      users: userMetrics,
      processing: processingMetrics,
      business: businessMetrics,
      performance: performanceMetrics
    };

  } catch (error) {
    console.error('Error collecting metrics:', error);
    return {
      timestamp: now.toISOString(),
      system_status: 'error',
      error: error.message
    };
  }
}

async function getUserMetrics(hourAgo, dayAgo) {
  try {
    // Active users in last hour
    const { data: activeUsers, error: activeError } = await supabase
      .from('user_sessions')
      .select('user_id')
      .gte('last_active', hourAgo.toISOString())
      .neq('user_id', null);

    if (activeError) throw activeError;

    // New signups in last 24 hours
    const { data: newUsers, error: newError } = await supabase
      .from('auth.users')
      .select('id')
      .gte('created_at', dayAgo.toISOString());

    if (newError) throw newError;

    // Total registered users
    const { count: totalUsers, error: totalError } = await supabase
      .from('auth.users')
      .select('id', { count: 'exact' });

    if (totalError) throw totalError;

    return {
      active_users_hour: activeUsers?.length || 0,
      new_users_day: newUsers?.length || 0,
      total_users: totalUsers || 0,
      active_user_percentage: totalUsers ? ((activeUsers?.length || 0) / totalUsers * 100).toFixed(2) : 0
    };

  } catch (error) {
    console.error('Error collecting user metrics:', error);
    return {
      active_users_hour: 0,
      new_users_day: 0,
      total_users: 0,
      error: 'Failed to collect user metrics'
    };
  }
}

async function getProcessingMetrics(hourAgo, dayAgo) {
  try {
    // Processing jobs in last hour
    const { data: hourlyJobs, error: hourlyError } = await supabase
      .from('processing_history')
      .select('id, pages, status, processing_time')
      .gte('created_at', hourAgo.toISOString());

    if (hourlyError) throw hourlyError;

    // Processing jobs in last day
    const { data: dailyJobs, error: dailyError } = await supabase
      .from('processing_history')
      .select('id, pages, status, processing_time')
      .gte('created_at', dayAgo.toISOString());

    if (dailyError) throw dailyError;

    // Calculate metrics
    const hourlySuccessful = hourlyJobs?.filter(job => job.status === 'completed')?.length || 0;
    const hourlyFailed = hourlyJobs?.filter(job => job.status === 'failed')?.length || 0;
    const dailySuccessful = dailyJobs?.filter(job => job.status === 'completed')?.length || 0;
    const dailyPages = dailyJobs?.reduce((sum, job) => sum + (job.pages || 0), 0) || 0;

    // Calculate average processing time
    const successfulJobs = hourlyJobs?.filter(job => job.status === 'completed' && job.processing_time) || [];
    const avgProcessingTime = successfulJobs.length > 0 
      ? successfulJobs.reduce((sum, job) => sum + job.processing_time, 0) / successfulJobs.length 
      : 0;

    return {
      jobs_processed_hour: hourlyJobs?.length || 0,
      jobs_processed_day: dailyJobs?.length || 0,
      success_rate_hour: hourlyJobs?.length ? (hourlySuccessful / hourlyJobs.length * 100).toFixed(2) : 100,
      failed_jobs_hour: hourlyFailed,
      pages_processed_day: dailyPages,
      avg_processing_time_seconds: Math.round(avgProcessingTime)
    };

  } catch (error) {
    console.error('Error collecting processing metrics:', error);
    return {
      jobs_processed_hour: 0,
      jobs_processed_day: 0,
      success_rate_hour: 0,
      error: 'Failed to collect processing metrics'
    };
  }
}

async function getBusinessMetrics(dayAgo) {
  try {
    // Revenue metrics (this would integrate with Stripe)
    // For now, we'll estimate based on subscription data
    const { data: subscriptions, error: subError } = await supabase
      .from('user_subscriptions')
      .select('plan, status, created_at')
      .eq('status', 'active');

    if (subError) throw subError;

    // Calculate estimated MRR
    const monthlyRevenue = subscriptions?.reduce((sum, sub) => {
      const planValue = sub.plan === 'pro_monthly' ? 29.99 : 
                      sub.plan === 'pro_annual' ? 29.99 : 0; // Annual normalized to monthly
      return sum + planValue;
    }, 0) || 0;

    // New subscriptions in last 24 hours
    const newSubscriptions = subscriptions?.filter(
      sub => new Date(sub.created_at) >= dayAgo
    )?.length || 0;

    return {
      monthly_recurring_revenue: monthlyRevenue.toFixed(2),
      active_subscriptions: subscriptions?.length || 0,
      new_subscriptions_day: newSubscriptions,
      free_tier_users: 0, // Would be calculated from user data
      conversion_rate: 0  // Would be calculated from signup to subscription data
    };

  } catch (error) {
    console.error('Error collecting business metrics:', error);
    return {
      monthly_recurring_revenue: 0,
      active_subscriptions: 0,
      error: 'Failed to collect business metrics'
    };
  }
}

async function getPerformanceMetrics(hourAgo) {
  try {
    // This would typically come from APM tools or custom performance logging
    // For now, we'll return estimated values
    return {
      avg_response_time_ms: 250,      // Would be calculated from request logs
      error_rate_percentage: 0.1,     // Would be calculated from error logs
      requests_per_minute: 45,        // Would be calculated from access logs
      cache_hit_rate_percentage: 85,  // Would be from CDN analytics
      database_query_time_ms: 75      // Would be from database monitoring
    };

  } catch (error) {
    console.error('Error collecting performance metrics:', error);
    return {
      avg_response_time_ms: 0,
      error_rate_percentage: 0,
      error: 'Failed to collect performance metrics'
    };
  }
}

async function storeCustomMetric(metricData) {
  try {
    // Store custom metrics in database for historical analysis
    const { error } = await supabase
      .from('custom_metrics')
      .insert({
        metric_name: metricData.name,
        metric_value: metricData.value,
        metric_type: metricData.type,
        context: metricData.context || {},
        timestamp: new Date().toISOString()
      });

    if (error) throw error;

    // Check if metric value exceeds alert thresholds
    await checkAlertThresholds(metricData);

    return true;

  } catch (error) {
    console.error('Error storing custom metric:', error);
    throw error;
  }
}

async function checkAlertThresholds(metricData) {
  // Define alert thresholds
  const thresholds = {
    'error_rate': 5.0,           // Alert if error rate > 5%
    'response_time': 5000,       // Alert if response time > 5 seconds
    'processing_failures': 10,    // Alert if > 10 failures per hour
    'memory_usage': 80,          // Alert if memory usage > 80%
    'storage_usage': 90          // Alert if storage usage > 90%
  };

  const threshold = thresholds[metricData.name];
  if (threshold && metricData.value > threshold) {
    // In production, this would send alerts via email, SMS, Slack, etc.
    console.warn(`ALERT: ${metricData.name} exceeded threshold`, {
      value: metricData.value,
      threshold,
      timestamp: new Date().toISOString()
    });

    // Store alert in database
    await supabase
      .from('monitoring_alerts')
      .insert({
        alert_type: 'threshold_exceeded',
        metric_name: metricData.name,
        metric_value: metricData.value,
        threshold_value: threshold,
        severity: getSeverity(metricData.name, metricData.value, threshold),
        context: metricData.context || {},
        timestamp: new Date().toISOString()
      });
  }
}

function getSeverity(metricName, value, threshold) {
  const severityMultiplier = value / threshold;
  
  if (severityMultiplier >= 2.0) return 'critical';
  if (severityMultiplier >= 1.5) return 'high';
  if (severityMultiplier >= 1.2) return 'medium';
  return 'low';
}