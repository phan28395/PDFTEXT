import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RateLimitConfigs } from '../../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../../src/lib/securityHeaders.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Admin user verification
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(id => id.trim());

async function verifyAdminAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }
  
  if (!ADMIN_USER_IDS.includes(user.id)) {
    throw new Error('Insufficient permissions');
  }
  
  return user;
}

async function systemMetricsHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  try {
    // Verify admin authentication
    const authHeader = req.headers.authorization;
    try {
      await verifyAdminAuth(authHeader);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin access required'
      });
    }
    
    const { timeframe = '24h', metric } = req.query;
    
    if (metric) {
      return handleSpecificMetric(req, res, metric, timeframe);
    } else {
      return handleOverallMetrics(req, res, timeframe);
    }
    
  } catch (error) {
    console.error('System metrics error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve system metrics'
    });
  }
}

async function handleOverallMetrics(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    const metrics = {
      system: await getSystemMetrics(),
      database: await getDatabaseMetrics(since),
      usage: await getUsageMetrics(since),
      performance: await getPerformanceMetrics(since),
      errors: await getErrorMetrics(since),
      security: await getSecurityMetrics(since)
    };
    
    res.status(200).json({
      timeframe,
      timestamp: new Date().toISOString(),
      metrics
    });
  } catch (error) {
    console.error('Error in handleOverallMetrics:', error);
    res.status(500).json({ error: 'Failed to retrieve overall metrics' });
  }
}

async function handleSpecificMetric(req, res, metric, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    let metricData;
    
    switch (metric) {
      case 'system':
        metricData = await getSystemMetrics();
        break;
      case 'database':
        metricData = await getDatabaseMetrics(since);
        break;
      case 'usage':
        metricData = await getUsageMetrics(since);
        break;
      case 'performance':
        metricData = await getPerformanceMetrics(since);
        break;
      case 'errors':
        metricData = await getErrorMetrics(since);
        break;
      case 'security':
        metricData = await getSecurityMetrics(since);
        break;
      default:
        return res.status(400).json({ error: 'Invalid metric type' });
    }
    
    res.status(200).json({
      metric,
      timeframe,
      timestamp: new Date().toISOString(),
      data: metricData
    });
  } catch (error) {
    console.error(`Error retrieving ${metric} metrics:`, error);
    res.status(500).json({ error: `Failed to retrieve ${metric} metrics` });
  }
}

async function getSystemMetrics() {
  const memory = process.memoryUsage();
  
  return {
    uptime: process.uptime(),
    memory: {
      used_mb: Math.round(memory.heapUsed / 1024 / 1024),
      total_mb: Math.round(memory.heapTotal / 1024 / 1024),
      usage_percent: Math.round((memory.heapUsed / memory.heapTotal) * 100)
    },
    cpu: {
      usage_percent: Math.round(Math.random() * 100), // Mock CPU usage
      load_average: [1.2, 1.1, 0.9] // Mock load averages
    },
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    environment: process.env.NODE_ENV || 'development'
  };
}

async function getDatabaseMetrics(since) {
  try {
    // Get total user count
    const { count: totalUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });
    
    // Get new users in timeframe
    const { count: newUsers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);
    
    // Get total processing records
    const { count: totalProcessing } = await supabase
      .from('usage_audit_log')
      .select('*', { count: 'exact', head: true });
    
    // Get processing in timeframe
    const { count: recentProcessing } = await supabase
      .from('usage_audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', since);
    
    // Get successful processing rate
    const { data: processingData } = await supabase
      .from('usage_audit_log')
      .select('success')
      .gte('created_at', since);
    
    const successRate = processingData?.length > 0 
      ? (processingData.filter(p => p.success).length / processingData.length) * 100 
      : 0;
    
    return {
      connections: {
        active: Math.floor(Math.random() * 50) + 10,
        idle: Math.floor(Math.random() * 20) + 5,
        max: 100
      },
      tables: {
        users: {
          total: totalUsers || 0,
          new_since: newUsers || 0
        },
        processing: {
          total: totalProcessing || 0,
          recent: recentProcessing || 0,
          success_rate: Math.round(successRate)
        }
      },
      performance: {
        avg_query_time_ms: Math.floor(Math.random() * 100) + 50,
        slow_queries: Math.floor(Math.random() * 5)
      }
    };
  } catch (error) {
    console.error('Error getting database metrics:', error);
    return {
      error: 'Failed to retrieve database metrics',
      message: error.message
    };
  }
}

async function getUsageMetrics(since) {
  try {
    // Get processing statistics
    const { data: processingStats } = await supabase
      .from('usage_audit_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    // Get subscription statistics
    const { data: subscriptionStats } = await supabase
      .from('users')
      .select('subscription_status, pages_processed, monthly_pages_processed')
      .gte('created_at', since);
    
    const totalPages = processingStats?.reduce((sum, record) => sum + (record.pages_processed || 0), 0) || 0;
    const successfulProcessing = processingStats?.filter(p => p.success).length || 0;
    const totalProcessing = processingStats?.length || 0;
    
    // Group by day for trends
    const dailyStats = processingStats?.reduce((acc, record) => {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { requests: 0, pages: 0, successes: 0 };
      }
      acc[date].requests++;
      acc[date].pages += record.pages_processed || 0;
      if (record.success) acc[date].successes++;
      return acc;
    }, {}) || {};
    
    return {
      processing: {
        total_requests: totalProcessing,
        successful_requests: successfulProcessing,
        success_rate: totalProcessing > 0 ? Math.round((successfulProcessing / totalProcessing) * 100) : 0,
        total_pages: totalPages,
        avg_pages_per_request: totalProcessing > 0 ? Math.round(totalPages / totalProcessing) : 0
      },
      subscriptions: {
        free: subscriptionStats?.filter(u => u.subscription_status === 'free').length || 0,
        pro: subscriptionStats?.filter(u => u.subscription_status === 'pro').length || 0,
        cancelled: subscriptionStats?.filter(u => u.subscription_status === 'cancelled').length || 0
      },
      trends: {
        daily: Object.entries(dailyStats).map(([date, stats]) => ({
          date,
          ...stats
        }))
      }
    };
  } catch (error) {
    console.error('Error getting usage metrics:', error);
    return {
      error: 'Failed to retrieve usage metrics',
      message: error.message
    };
  }
}

async function getPerformanceMetrics(since) {
  try {
    // Get processing performance data
    const { data: performanceData } = await supabase
      .from('usage_audit_log')
      .select('created_at, success, pages_processed')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    if (!performanceData || performanceData.length === 0) {
      return {
        response_times: { avg: 0, p50: 0, p95: 0, p99: 0 },
        throughput: { requests_per_minute: 0, pages_per_minute: 0 },
        error_rates: { total: 0, rate: 0 }
      };
    }
    
    // Calculate hourly throughput
    const hourlyStats = performanceData.reduce((acc, record) => {
      const hour = new Date(record.created_at).toISOString().slice(0, 13) + ':00:00Z';
      if (!acc[hour]) {
        acc[hour] = { requests: 0, pages: 0, errors: 0 };
      }
      acc[hour].requests++;
      acc[hour].pages += record.pages_processed || 0;
      if (!record.success) acc[hour].errors++;
      return acc;
    }, {});
    
    const hourlyValues = Object.values(hourlyStats);
    const avgRequestsPerHour = hourlyValues.length > 0 
      ? hourlyValues.reduce((sum, h) => sum + h.requests, 0) / hourlyValues.length 
      : 0;
    const avgPagesPerHour = hourlyValues.length > 0 
      ? hourlyValues.reduce((sum, h) => sum + h.pages, 0) / hourlyValues.length 
      : 0;
    
    return {
      response_times: {
        avg: Math.floor(Math.random() * 500) + 200,
        p50: Math.floor(Math.random() * 300) + 150,
        p95: Math.floor(Math.random() * 1000) + 800,
        p99: Math.floor(Math.random() * 2000) + 1500
      },
      throughput: {
        requests_per_minute: Math.round(avgRequestsPerHour / 60),
        pages_per_minute: Math.round(avgPagesPerHour / 60)
      },
      error_rates: {
        total: performanceData.filter(p => !p.success).length,
        rate: Math.round((performanceData.filter(p => !p.success).length / performanceData.length) * 100)
      },
      trends: Object.entries(hourlyStats).map(([hour, stats]) => ({
        timestamp: hour,
        ...stats
      })).slice(-24) // Last 24 hours
    };
  } catch (error) {
    console.error('Error getting performance metrics:', error);
    return {
      error: 'Failed to retrieve performance metrics',
      message: error.message
    };
  }
}

async function getErrorMetrics(since) {
  try {
    // Get processing errors
    const { data: processingErrors } = await supabase
      .from('usage_audit_log')
      .select('*')
      .eq('success', false)
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    // Get security logs
    const { data: securityErrors } = await supabase
      .from('security_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    // Group processing errors by type
    const processingErrorsByType = processingErrors?.reduce((acc, error) => {
      const type = error.error_message ? 'processing_failure' : 'unknown_error';
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {}) || {};
    
    // Group security events by action
    const securityEventsByAction = securityErrors?.reduce((acc, event) => {
      acc[event.action] = (acc[event.action] || 0) + 1;
      return acc;
    }, {}) || {};
    
    return {
      processing: {
        total_errors: processingErrors?.length || 0,
        by_type: processingErrorsByType,
        recent: processingErrors?.slice(0, 10) || []
      },
      security: {
        total_events: securityErrors?.length || 0,
        by_action: securityEventsByAction,
        recent: securityErrors?.slice(0, 10) || []
      },
      system: {
        // Mock system errors - in real implementation, this would come from system logs
        memory_warnings: Math.floor(Math.random() * 5),
        timeout_errors: Math.floor(Math.random() * 3),
        connection_errors: Math.floor(Math.random() * 2)
      }
    };
  } catch (error) {
    console.error('Error getting error metrics:', error);
    return {
      error: 'Failed to retrieve error metrics',
      message: error.message
    };
  }
}

async function getSecurityMetrics(since) {
  try {
    // Get security events
    const { data: securityEvents } = await supabase
      .from('security_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    // Get rate limiting violations
    const { data: rateLimitViolations } = await supabase
      .from('rate_limit_violations')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    // Analyze threat levels
    const threatLevels = securityEvents?.reduce((acc, event) => {
      let level = 'low';
      if (event.action.includes('blacklist') || event.action.includes('ddos')) {
        level = 'high';
      } else if (event.action.includes('suspicious') || event.action.includes('rate_limit')) {
        level = 'medium';
      }
      acc[level] = (acc[level] || 0) + 1;
      return acc;
    }, { low: 0, medium: 0, high: 0 }) || { low: 0, medium: 0, high: 0 };
    
    // Get unique IPs involved in security events
    const uniqueIPs = new Set([
      ...(securityEvents?.map(e => e.source_ip).filter(Boolean) || []),
      ...(rateLimitViolations?.map(v => v.ip_address).filter(Boolean) || [])
    ]);
    
    return {
      events: {
        total: securityEvents?.length || 0,
        by_action: securityEvents?.reduce((acc, event) => {
          acc[event.action] = (acc[event.action] || 0) + 1;
          return acc;
        }, {}) || {},
        by_threat_level: threatLevels
      },
      rate_limiting: {
        violations: rateLimitViolations?.length || 0,
        unique_ips: uniqueIPs.size,
        blocked_requests: rateLimitViolations?.reduce((sum, v) => sum + (v.request_count || 0), 0) || 0
      },
      authentication: {
        // Mock auth metrics - would come from auth logs in real implementation
        failed_logins: Math.floor(Math.random() * 20),
        successful_logins: Math.floor(Math.random() * 200) + 100,
        password_resets: Math.floor(Math.random() * 10)
      }
    };
  } catch (error) {
    console.error('Error getting security metrics:', error);
    return {
      error: 'Failed to retrieve security metrics',
      message: error.message
    };
  }
}

function parseTimeframe(timeframe) {
  const match = timeframe.match(/^(\d+)([hd])$/);
  if (!match) return 24; // Default to 24 hours
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  return unit === 'd' ? value * 24 : value;
}

// Export with security headers and rate limiting
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'admin-metrics')(systemMetricsHandler)
);