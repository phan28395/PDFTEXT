/**
 * Production Monitoring and Alerting API
 * Handles real-time monitoring, health checks, and alert notifications
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Health check intervals and thresholds
const HEALTH_CHECK_CONFIG = {
  API_RESPONSE_THRESHOLD: 5000, // 5 seconds
  DATABASE_QUERY_THRESHOLD: 3000, // 3 seconds
  ERROR_RATE_THRESHOLD: 0.05, // 5% error rate
  MEMORY_USAGE_THRESHOLD: 0.85, // 85% memory usage
  CHECK_INTERVAL: 60000, // 1 minute
};

// Production metrics storage
let productionMetrics = {
  apiRequests: {
    total: 0,
    errors: 0,
    lastErrorTime: null,
    averageResponseTime: 0,
    responseTimes: []
  },
  databaseQueries: {
    total: 0,
    errors: 0,
    averageQueryTime: 0,
    queryTimes: []
  },
  fileProcessing: {
    total: 0,
    successful: 0,
    failed: 0,
    averageProcessingTime: 0
  },
  userSessions: {
    active: 0,
    total: 0,
    peakConcurrent: 0
  },
  systemHealth: {
    status: 'healthy',
    uptime: Date.now(),
    lastHealthCheck: Date.now(),
    alerts: []
  }
};

/**
 * Main monitoring endpoint
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    switch (action) {
      case 'health':
        return await handleHealthCheck(req, res);
      case 'metrics':
        return await handleMetricsRetrieval(req, res);
      case 'alert':
        return await handleAlertProcessing(req, res);
      case 'status':
        return await handleSystemStatus(req, res);
      default:
        return await handleHealthCheck(req, res);
    }
  } catch (error) {
    console.error('Production monitoring error:', error);
    
    // Log error to database
    await logProductionError({
      type: 'monitoring_error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      severity: 'high'
    });

    return res.status(500).json({
      success: false,
      error: 'Internal monitoring system error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Comprehensive health check
 */
async function handleHealthCheck(req, res) {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    metrics: {},
    alerts: []
  };

  try {
    // Database connectivity check
    const dbStart = Date.now();
    const { data: dbTest, error: dbError } = await supabase
      .from('users')
      .select('count')
      .limit(1);
    
    const dbResponseTime = Date.now() - dbStart;
    
    healthCheck.checks.database = {
      status: dbError ? 'unhealthy' : 'healthy',
      responseTime: dbResponseTime,
      error: dbError?.message || null
    };

    // API response time check
    healthCheck.checks.api = {
      status: 'healthy',
      responseTime: Date.now() - (req._startTime || Date.now())
    };

    // Memory usage check (approximate)
    const memUsage = process.memoryUsage();
    healthCheck.checks.memory = {
      status: (memUsage.heapUsed / memUsage.heapTotal) < HEALTH_CHECK_CONFIG.MEMORY_USAGE_THRESHOLD ? 'healthy' : 'warning',
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      usage: (memUsage.heapUsed / memUsage.heapTotal * 100).toFixed(2) + '%'
    };

    // Error rate check
    const errorRate = productionMetrics.apiRequests.total > 0 ? 
      productionMetrics.apiRequests.errors / productionMetrics.apiRequests.total : 0;
    
    healthCheck.checks.errorRate = {
      status: errorRate < HEALTH_CHECK_CONFIG.ERROR_RATE_THRESHOLD ? 'healthy' : 'critical',
      rate: (errorRate * 100).toFixed(2) + '%',
      errors: productionMetrics.apiRequests.errors,
      total: productionMetrics.apiRequests.total
    };

    // Overall status determination
    const unhealthyChecks = Object.values(healthCheck.checks).filter(check => 
      check.status === 'unhealthy' || check.status === 'critical'
    );
    
    if (unhealthyChecks.length > 0) {
      healthCheck.status = 'unhealthy';
      healthCheck.alerts.push({
        type: 'health_check_failed',
        message: `${unhealthyChecks.length} health checks failed`,
        severity: 'high',
        timestamp: new Date().toISOString()
      });
    }

    // Update system health metrics
    productionMetrics.systemHealth.lastHealthCheck = Date.now();
    productionMetrics.systemHealth.status = healthCheck.status;

    // Store health check result
    await logHealthCheckResult(healthCheck);

    return res.status(200).json(healthCheck);

  } catch (error) {
    healthCheck.status = 'error';
    healthCheck.error = error.message;
    
    return res.status(500).json(healthCheck);
  }
}

/**
 * Retrieve production metrics
 */
async function handleMetricsRetrieval(req, res) {
  try {
    const { timeframe = '1h' } = req.query;
    
    // Get recent error logs
    const { data: recentErrors } = await supabase
      .from('error_logs')
      .select('*')
      .gte('created_at', getTimeframeStart(timeframe))
      .order('created_at', { ascending: false })
      .limit(50);

    // Get processing statistics
    const { data: processingStats } = await supabase
      .from('processing_history')
      .select('status, processing_time, created_at')
      .gte('created_at', getTimeframeStart(timeframe));

    // Calculate metrics
    const metrics = {
      ...productionMetrics,
      timeframe,
      recentErrors: recentErrors || [],
      processingStats: calculateProcessingStats(processingStats || []),
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      metrics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Metrics retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
}

/**
 * Process and handle alerts
 */
async function handleAlertProcessing(req, res) {
  try {
    const { type, message, severity = 'medium', metadata = {} } = req.body;

    const alert = {
      type,
      message,
      severity,
      metadata,
      timestamp: new Date().toISOString(),
      id: generateAlertId()
    };

    // Store alert in database
    await supabase.from('production_alerts').insert([{
      alert_type: type,
      message,
      severity,
      metadata,
      created_at: new Date().toISOString()
    }]);

    // Add to in-memory alerts
    productionMetrics.systemHealth.alerts.push(alert);

    // Keep only last 100 alerts in memory
    if (productionMetrics.systemHealth.alerts.length > 100) {
      productionMetrics.systemHealth.alerts = productionMetrics.systemHealth.alerts.slice(-100);
    }

    // Send notifications for high severity alerts
    if (severity === 'high' || severity === 'critical') {
      await sendAlertNotification(alert);
    }

    return res.status(200).json({
      success: true,
      alert,
      message: 'Alert processed successfully'
    });

  } catch (error) {
    console.error('Alert processing error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process alert'
    });
  }
}

/**
 * Get overall system status
 */
async function handleSystemStatus(req, res) {
  try {
    const status = {
      overall: productionMetrics.systemHealth.status,
      uptime: Date.now() - productionMetrics.systemHealth.uptime,
      lastHealthCheck: productionMetrics.systemHealth.lastHealthCheck,
      activeAlerts: productionMetrics.systemHealth.alerts.filter(alert => 
        (Date.now() - new Date(alert.timestamp).getTime()) < 3600000 // Last hour
      ),
      quickStats: {
        totalApiRequests: productionMetrics.apiRequests.total,
        errorRate: productionMetrics.apiRequests.total > 0 ? 
          (productionMetrics.apiRequests.errors / productionMetrics.apiRequests.total * 100).toFixed(2) + '%' : '0%',
        activeUsers: productionMetrics.userSessions.active,
        processingJobs: productionMetrics.fileProcessing.total
      },
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      status,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('System status error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get system status'
    });
  }
}

/**
 * Helper Functions
 */

function getTimeframeStart(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '15m':
      return new Date(now.getTime() - 15 * 60 * 1000).toISOString();
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
  }
}

function calculateProcessingStats(records) {
  const successful = records.filter(r => r.status === 'completed').length;
  const failed = records.filter(r => r.status === 'failed').length;
  const avgTime = records.length > 0 ? 
    records.reduce((sum, r) => sum + (r.processing_time || 0), 0) / records.length : 0;

  return {
    total: records.length,
    successful,
    failed,
    successRate: records.length > 0 ? ((successful / records.length) * 100).toFixed(2) + '%' : '100%',
    averageProcessingTime: Math.round(avgTime * 100) / 100
  };
}

async function logProductionError(error) {
  try {
    await supabase.from('error_logs').insert([{
      error_type: error.type,
      message: error.message,
      stack_trace: error.stack,
      severity: error.severity,
      created_at: error.timestamp
    }]);
  } catch (logError) {
    console.error('Failed to log production error:', logError);
  }
}

async function logHealthCheckResult(healthCheck) {
  try {
    await supabase.from('health_checks').insert([{
      status: healthCheck.status,
      checks: healthCheck.checks,
      alerts: healthCheck.alerts,
      created_at: healthCheck.timestamp
    }]);
  } catch (error) {
    console.error('Failed to log health check:', error);
  }
}

async function sendAlertNotification(alert) {
  // In production, integrate with notification services like:
  // - Email notifications
  // - Slack/Discord webhooks
  // - SMS alerts
  // - PagerDuty
  
  console.log(`🚨 HIGH SEVERITY ALERT: ${alert.message}`, alert);
  
  // Example: Send to webhook
  try {
    if (process.env.ALERT_WEBHOOK_URL) {
      const response = await fetch(process.env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Production Alert: ${alert.message}`,
          alert
        })
      });
    }
  } catch (error) {
    console.error('Failed to send alert notification:', error);
  }
}

function generateAlertId() {
  return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Middleware to track API metrics
export function trackApiMetrics(req, res, next) {
  const startTime = Date.now();
  req._startTime = startTime;
  
  productionMetrics.apiRequests.total++;
  
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    // Track response time
    productionMetrics.apiRequests.responseTimes.push(responseTime);
    if (productionMetrics.apiRequests.responseTimes.length > 100) {
      productionMetrics.apiRequests.responseTimes.shift();
    }
    
    // Calculate average response time
    productionMetrics.apiRequests.averageResponseTime = 
      productionMetrics.apiRequests.responseTimes.reduce((a, b) => a + b, 0) / 
      productionMetrics.apiRequests.responseTimes.length;
    
    // Track errors
    if (res.statusCode >= 400) {
      productionMetrics.apiRequests.errors++;
      productionMetrics.apiRequests.lastErrorTime = Date.now();
    }
  });
  
  if (next) next();
}