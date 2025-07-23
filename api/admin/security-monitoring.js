import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RateLimitConfigs, IPManagement } from '../../src/lib/rateLimit.js';
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

async function securityMonitoringHandler(req, res) {
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
    
    const { timeframe = '24h', type = 'overview' } = req.query;
    
    switch (type) {
      case 'overview':
        return handleOverview(req, res, timeframe);
      case 'threats':
        return handleThreats(req, res, timeframe);
      case 'performance':
        return handlePerformance(req, res, timeframe);
      case 'alerts':
        return handleAlerts(req, res, timeframe);
      default:
        return res.status(400).json({ error: 'Invalid monitoring type' });
    }
    
  } catch (error) {
    console.error('Security monitoring error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve security monitoring data'
    });
  }
}

async function handleOverview(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Get rate limiting stats
    const rateLimitStats = IPManagement.getStats();
    
    // Get recent security events from database
    const { data: securityEvents } = await supabase
      .from('security_logs')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    // Get processing attempts and failures
    const { data: processingStats } = await supabase
      .from('usage_audit_log')
      .select('success, created_at, client_ip')
      .gte('created_at', since);
    
    // Analyze the data
    const overview = {
      timeframe,
      rateLimiting: {
        totalRequests: rateLimitStats.totalRequests,
        blockedRequests: rateLimitStats.totalFailures,
        blacklistedIPs: rateLimitStats.blacklistedIPs,
        whitelistedIPs: rateLimitStats.whitelistedIPs,
        suspiciousIPs: rateLimitStats.suspiciousIPs
      },
      security: {
        totalEvents: securityEvents?.length || 0,
        eventsByType: groupEventsByType(securityEvents || []),
        recentThreats: (securityEvents || [])
          .filter(e => ['blacklist_add', 'suspicious_activity'].includes(e.action))
          .slice(0, 10)
      },
      processing: {
        totalAttempts: processingStats?.length || 0,
        successRate: calculateSuccessRate(processingStats || []),
        topIPs: getTopIPs(processingStats || []),
        failurePattern: analyzeFailurePattern(processingStats || [])
      },
      alerts: generateSecurityAlerts(rateLimitStats, securityEvents || [], processingStats || [])
    };
    
    res.status(200).json(overview);
  } catch (error) {
    console.error('Error in handleOverview:', error);
    res.status(500).json({ error: 'Failed to generate security overview' });
  }
}

async function handleThreats(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Get threat-related events
    const { data: threatEvents } = await supabase
      .from('security_logs')
      .select('*')
      .gte('created_at', since)
      .in('action', ['blacklist_add', 'suspicious_activity', 'ddos_detected', 'rate_limit_exceeded'])
      .order('created_at', { ascending: false });
    
    // Get IPs with high failure rates
    const { data: processingFailures } = await supabase
      .from('usage_audit_log')
      .select('client_ip, success, created_at')
      .gte('created_at', since)
      .eq('success', false);
    
    const threatAnalysis = {
      detectedThreats: threatEvents?.length || 0,
      threatsByType: groupEventsByType(threatEvents || []),
      suspiciousIPs: analyzeSuspiciousIPs(processingFailures || []),
      threatTimeline: createThreatTimeline(threatEvents || []),
      recommendedActions: generateThreatRecommendations(threatEvents || [], processingFailures || [])
    };
    
    res.status(200).json(threatAnalysis);
  } catch (error) {
    console.error('Error in handleThreats:', error);
    res.status(500).json({ error: 'Failed to analyze threats' });
  }
}

async function handlePerformance(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    
    // Get processing performance data
    const { data: performanceData } = await supabase
      .from('usage_audit_log')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });
    
    const performance = {
      requestVolume: analyzeRequestVolume(performanceData || []),
      responseTime: analyzeResponseTimes(performanceData || []),
      errorRates: analyzeErrorRates(performanceData || []),
      resourceUsage: analyzeResourceUsage(performanceData || []),
      trends: generatePerformanceTrends(performanceData || [])
    };
    
    res.status(200).json(performance);
  } catch (error) {
    console.error('Error in handlePerformance:', error);
    res.status(500).json({ error: 'Failed to analyze performance' });
  }
}

async function handleAlerts(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const rateLimitStats = IPManagement.getStats();
    
    const alerts = {
      critical: [],
      warning: [],
      info: []
    };
    
    // Check for critical alerts
    if (rateLimitStats.blacklistedIPs > 10) {
      alerts.critical.push({
        type: 'high_blacklist_count',
        message: `High number of blacklisted IPs: ${rateLimitStats.blacklistedIPs}`,
        timestamp: new Date().toISOString()
      });
    }
    
    if (rateLimitStats.suspiciousIPs > 20) {
      alerts.warning.push({
        type: 'suspicious_activity',
        message: `Multiple suspicious IPs detected: ${rateLimitStats.suspiciousIPs}`,
        timestamp: new Date().toISOString()
      });
    }
    
    // Check recent processing failures
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    const { data: recentFailures } = await supabase
      .from('usage_audit_log')
      .select('client_ip, created_at')
      .gte('created_at', since)
      .eq('success', false);
    
    if (recentFailures && recentFailures.length > 100) {
      alerts.critical.push({
        type: 'high_failure_rate',
        message: `High failure rate detected: ${recentFailures.length} failures in ${timeframe}`,
        timestamp: new Date().toISOString()
      });
    }
    
    res.status(200).json(alerts);
  } catch (error) {
    console.error('Error in handleAlerts:', error);
    res.status(500).json({ error: 'Failed to generate alerts' });
  }
}

// Helper functions
function parseTimeframe(timeframe) {
  const match = timeframe.match(/^(\d+)([hd])$/);
  if (!match) return 24; // Default to 24 hours
  
  const value = parseInt(match[1]);
  const unit = match[2];
  
  return unit === 'd' ? value * 24 : value;
}

function groupEventsByType(events) {
  return events.reduce((acc, event) => {
    acc[event.action] = (acc[event.action] || 0) + 1;
    return acc;
  }, {});
}

function calculateSuccessRate(processingStats) {
  if (processingStats.length === 0) return 100;
  const successful = processingStats.filter(s => s.success).length;
  return Math.round((successful / processingStats.length) * 100);
}

function getTopIPs(processingStats) {
  const ipCounts = processingStats.reduce((acc, stat) => {
    acc[stat.client_ip] = (acc[stat.client_ip] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(ipCounts)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .map(([ip, count]) => ({ ip, requests: count }));
}

function analyzeFailurePattern(processingStats) {
  const failures = processingStats.filter(s => !s.success);
  const hourlyFailures = {};
  
  failures.forEach(failure => {
    const hour = new Date(failure.created_at).getHours();
    hourlyFailures[hour] = (hourlyFailures[hour] || 0) + 1;
  });
  
  return hourlyFailures;
}

function generateSecurityAlerts(rateLimitStats, securityEvents, processingStats) {
  const alerts = [];
  
  if (rateLimitStats.suspiciousIPs > 5) {
    alerts.push({
      level: 'warning',
      type: 'suspicious_activity',
      message: `${rateLimitStats.suspiciousIPs} suspicious IPs detected`
    });
  }
  
  if (rateLimitStats.blacklistedIPs > 5) {
    alerts.push({
      level: 'info',
      type: 'blacklist_status',
      message: `${rateLimitStats.blacklistedIPs} IPs currently blacklisted`
    });
  }
  
  return alerts;
}

function analyzeSuspiciousIPs(processingFailures) {
  const ipFailureCounts = processingFailures.reduce((acc, failure) => {
    acc[failure.client_ip] = (acc[failure.client_ip] || 0) + 1;
    return acc;
  }, {});
  
  return Object.entries(ipFailureCounts)
    .filter(([ip, count]) => count > 10)
    .sort(([,a], [,b]) => b - a)
    .map(([ip, failures]) => ({ ip, failures, risk: failures > 20 ? 'high' : 'medium' }));
}

function createThreatTimeline(threatEvents) {
  return threatEvents.map(event => ({
    timestamp: event.created_at,
    type: event.action,
    target: event.target_ip,
    severity: event.action.includes('ddos') || event.action.includes('blacklist') ? 'high' : 'medium'
  }));
}

function generateThreatRecommendations(threatEvents, processingFailures) {
  const recommendations = [];
  
  if (threatEvents.length > 20) {
    recommendations.push({
      priority: 'high',
      action: 'Review and strengthen rate limiting rules',
      reason: 'High volume of security events detected'
    });
  }
  
  const suspiciousIPs = analyzeSuspiciousIPs(processingFailures);
  if (suspiciousIPs.length > 0) {
    recommendations.push({
      priority: 'medium',
      action: 'Consider blacklisting high-risk IPs',
      reason: `${suspiciousIPs.length} IPs showing suspicious patterns`,
      details: suspiciousIPs.slice(0, 5)
    });
  }
  
  return recommendations;
}

function analyzeRequestVolume(performanceData) {
  const hourlyVolume = {};
  performanceData.forEach(data => {
    const hour = new Date(data.created_at).getHours();
    hourlyVolume[hour] = (hourlyVolume[hour] || 0) + 1;
  });
  return hourlyVolume;
}

function analyzeResponseTimes(performanceData) {
  // This would require response time data in the audit log
  return { average: 0, percentile95: 0, percentile99: 0 };
}

function analyzeErrorRates(performanceData) {
  const total = performanceData.length;
  const errors = performanceData.filter(d => !d.success).length;
  return { total, errors, rate: total > 0 ? (errors / total) * 100 : 0 };
}

function analyzeResourceUsage(performanceData) {
  // This would require resource usage metrics
  return { cpu: 0, memory: 0, requests_per_second: 0 };
}

function generatePerformanceTrends(performanceData) {
  // Generate trends over time
  return { trend: 'stable', change: 0 };
}

// Export with security headers and admin rate limiting
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'admin-monitoring')(securityMonitoringHandler)
);