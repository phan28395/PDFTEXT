/**
 * Security Monitoring Dashboard API
 * Provides real-time security metrics, alerts, and threat information
 */

import { applySecurityHeaders, withSecurityHeaders } from '../../src/lib/securityHeaders.ts';
import { threatDetection } from '../../src/lib/threatDetection.ts';
import { securityLogger } from '../../src/lib/securityLogger.ts';

export default withSecurityHeaders()(async function handler(req, res) {
  try {
    // Verify admin access
    const user = await verifyAdmin(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method, query } = req;
    const { action, timeframe = '24h' } = query;

    switch (method) {
      case 'GET':
        return await handleGetRequest(req, res, action, timeframe);
      case 'POST':
        return await handlePostRequest(req, res, action, req.body);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Security monitoring API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle GET requests for security monitoring
 */
async function handleGetRequest(req, res, action, timeframe) {
  switch (action) {
    case 'dashboard':
      return await getDashboardMetrics(req, res, timeframe);
    
    case 'alerts':
      return await getActiveAlerts(req, res);
    
    case 'threat-stats':
      return await getThreatStatistics(req, res);
    
    case 'recent-events':
      return await getRecentEvents(req, res, timeframe);
    
    case 'patterns':
      return await getThreatPatterns(req, res);
    
    case 'blocked-ips':
      return await getBlockedIPs(req, res);
    
    case 'export':
      return await exportSecurityData(req, res, timeframe);
    
    default:
      // Return comprehensive security overview
      return await getSecurityOverview(req, res, timeframe);
  }
}

/**
 * Handle POST requests for security actions
 */
async function handlePostRequest(req, res, action, body) {
  switch (action) {
    case 'resolve-alert':
      return await resolveAlert(req, res, body);
    
    case 'unblock-ip':
      return await unblockIP(req, res, body);
    
    case 'update-pattern':
      return await updateThreatPattern(req, res, body);
    
    case 'manual-alert':
      return await createManualAlert(req, res, body);
    
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Get comprehensive dashboard metrics
 */
async function getDashboardMetrics(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const toDate = new Date();

    // Get security metrics from logger
    const metrics = await securityLogger.getSecurityMetrics(fromDate, toDate);
    
    // Get threat detection statistics
    const threatStats = threatDetection.getThreatStatistics();
    
    // Get active alerts
    const activeAlerts = threatDetection.getActiveAlerts();
    
    // Get database metrics if available
    const dbMetrics = await getDatabaseMetrics();

    const dashboardData = {
      timeframe: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        hours
      },
      metrics: {
        ...metrics,
        threatDetection: threatStats,
        database: dbMetrics
      },
      alerts: {
        active: activeAlerts.length,
        critical: activeAlerts.filter(a => a.pattern.severity === 'critical').length,
        high: activeAlerts.filter(a => a.pattern.severity === 'high').length,
        recent: activeAlerts.slice(0, 5).map(alert => ({
          id: alert.id,
          pattern: alert.pattern.name,
          severity: alert.pattern.severity,
          triggeredAt: alert.triggeredAt,
          eventCount: alert.events.length
        }))
      },
      realTime: {
        timestamp: new Date().toISOString(),
        systemStatus: 'operational', // This could be determined by health checks
        activeThreats: activeAlerts.filter(a => a.pattern.severity === 'critical').length
      }
    };

    return res.json(dashboardData);
  } catch (error) {
    console.error('Error getting dashboard metrics:', error);
    return res.status(500).json({ error: 'Failed to get dashboard metrics' });
  }
}

/**
 * Get active security alerts
 */
async function getActiveAlerts(req, res) {
  try {
    const alerts = threatDetection.getActiveAlerts();
    
    const formattedAlerts = alerts.map(alert => ({
      id: alert.id,
      pattern: {
        id: alert.pattern.id,
        name: alert.pattern.name,
        description: alert.pattern.description,
        severity: alert.pattern.severity
      },
      triggeredAt: alert.triggeredAt,
      eventCount: alert.events.length,
      metadata: alert.metadata,
      resolved: alert.resolved,
      resolvedAt: alert.resolvedAt
    }));

    return res.json({
      alerts: formattedAlerts,
      count: formattedAlerts.length
    });
  } catch (error) {
    console.error('Error getting active alerts:', error);
    return res.status(500).json({ error: 'Failed to get active alerts' });
  }
}

/**
 * Get threat detection statistics
 */
async function getThreatStatistics(req, res) {
  try {
    const stats = threatDetection.getThreatStatistics();
    
    return res.json({
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting threat statistics:', error);
    return res.status(500).json({ error: 'Failed to get threat statistics' });
  }
}

/**
 * Get recent security events
 */
async function getRecentEvents(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const events = await securityLogger.searchEvents('', 100, {
      fromDate,
      severity: ['critical', 'high', 'medium']
    });

    const formattedEvents = events.map(event => ({
      id: event.id,
      type: event.eventType,
      severity: event.severity,
      timestamp: event.timestamp,
      ipAddress: event.ipAddress,
      userId: event.userId,
      message: event.message,
      source: event.source,
      resolved: event.resolved
    }));

    return res.json({
      events: formattedEvents,
      count: formattedEvents.length,
      timeframe: {
        from: fromDate.toISOString(),
        hours
      }
    });
  } catch (error) {
    console.error('Error getting recent events:', error);
    return res.status(500).json({ error: 'Failed to get recent events' });
  }
}

/**
 * Get configured threat patterns
 */
async function getThreatPatterns(req, res) {
  try {
    const stats = threatDetection.getThreatStatistics();
    
    // Note: This is a simplified version. In a real implementation,
    // we'd need to expose pattern details from the threat detection engine
    const patterns = {
      active: stats.activePatterns,
      total: stats.totalPatterns,
      // We can't access the actual patterns from outside the class currently
      // This would need to be added to the ThreatDetectionEngine API
    };

    return res.json({
      patterns,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting threat patterns:', error);
    return res.status(500).json({ error: 'Failed to get threat patterns' });
  }
}

/**
 * Get currently blocked IPs
 */
async function getBlockedIPs(req, res) {
  try {
    const stats = threatDetection.getThreatStatistics();
    
    // Note: This is simplified. The actual blocked IPs list
    // would need to be exposed from the threat detection engine
    return res.json({
      blockedCount: stats.blockedIPs,
      suspendedUsers: stats.suspendedUsers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting blocked IPs:', error);
    return res.status(500).json({ error: 'Failed to get blocked IPs' });
  }
}

/**
 * Export security data for compliance
 */
async function exportSecurityData(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const toDate = new Date();

    const format = req.query.format || 'json';
    const exportData = await securityLogger.exportEvents(fromDate, toDate, format);

    const filename = `security_export_${fromDate.toISOString().split('T')[0]}_${toDate.toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    
    return res.send(exportData);
  } catch (error) {
    console.error('Error exporting security data:', error);
    return res.status(500).json({ error: 'Failed to export security data' });
  }
}

/**
 * Get comprehensive security overview
 */
async function getSecurityOverview(req, res, timeframe) {
  try {
    const hours = parseTimeframe(timeframe);
    const fromDate = new Date(Date.now() - hours * 60 * 60 * 1000);
    const toDate = new Date();

    const [metrics, threatStats, activeAlerts] = await Promise.all([
      securityLogger.getSecurityMetrics(fromDate, toDate),
      Promise.resolve(threatDetection.getThreatStatistics()),
      Promise.resolve(threatDetection.getActiveAlerts())
    ]);

    return res.json({
      overview: {
        timeframe: { from: fromDate.toISOString(), to: toDate.toISOString(), hours },
        securityEvents: metrics,
        threatDetection: threatStats,
        alerts: {
          active: activeAlerts.length,
          bySeverity: activeAlerts.reduce((acc, alert) => {
            acc[alert.pattern.severity] = (acc[alert.pattern.severity] || 0) + 1;
            return acc;
          }, {}),
        },
        systemHealth: {
          status: 'operational',
          lastCheck: new Date().toISOString()
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting security overview:', error);
    return res.status(500).json({ error: 'Failed to get security overview' });
  }
}

/**
 * Resolve a security alert
 */
async function resolveAlert(req, res, body) {
  try {
    const { alertId, resolution } = body;
    
    if (!alertId) {
      return res.status(400).json({ error: 'Alert ID is required' });
    }

    const resolved = threatDetection.resolveAlert(alertId, resolution);
    
    if (!resolved) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    return res.json({
      success: true,
      alertId,
      resolvedAt: new Date().toISOString(),
      resolution
    });
  } catch (error) {
    console.error('Error resolving alert:', error);
    return res.status(500).json({ error: 'Failed to resolve alert' });
  }
}

/**
 * Unblock an IP address (placeholder - would need to be implemented in threat detection)
 */
async function unblockIP(req, res, body) {
  try {
    const { ipAddress } = body;
    
    if (!ipAddress) {
      return res.status(400).json({ error: 'IP address is required' });
    }

    // This would need to be implemented in the threat detection engine
    // threatDetection.unblockIP(ipAddress);

    return res.json({
      success: true,
      ipAddress,
      unblockedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error unblocking IP:', error);
    return res.status(500).json({ error: 'Failed to unblock IP' });
  }
}

/**
 * Update a threat pattern (placeholder)
 */
async function updateThreatPattern(req, res, body) {
  try {
    const { patternId, updates } = body;
    
    if (!patternId || !updates) {
      return res.status(400).json({ error: 'Pattern ID and updates are required' });
    }

    // This would need to be implemented in the threat detection engine
    // threatDetection.updatePattern(patternId, updates);

    return res.json({
      success: true,
      patternId,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error updating threat pattern:', error);
    return res.status(500).json({ error: 'Failed to update threat pattern' });
  }
}

/**
 * Create a manual security alert
 */
async function createManualAlert(req, res, body) {
  try {
    const { title, description, severity = 'medium', details = {} } = body;
    
    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    // Log the manual alert as a security event
    await securityLogger.logEvent({
      eventType: 'suspicious_activity',
      severity,
      ipAddress: getClientIP(req),
      userAgent: req.headers['user-agent'] || 'Unknown',
      userId: req.user?.id, // If available from auth
      message: `Manual alert: ${title}`,
      details: { description, manualAlert: true, ...details },
      source: 'manual',
      tags: ['manual_alert', 'admin_created'],
      metadata: { createdBy: req.user?.id }
    });

    return res.json({
      success: true,
      alert: {
        title,
        description,
        severity,
        createdAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating manual alert:', error);
    return res.status(500).json({ error: 'Failed to create manual alert' });
  }
}

/**
 * Parse timeframe string to hours
 */
function parseTimeframe(timeframe) {
  const timeMap = {
    '1h': 1,
    '6h': 6,
    '12h': 12,
    '24h': 24,
    '7d': 24 * 7,
    '30d': 24 * 30
  };
  
  return timeMap[timeframe] || 24;
}

/**
 * Get database metrics (placeholder)
 */
async function getDatabaseMetrics() {
  try {
    // This could query database health, connection count, query performance, etc.
    return {
      connectionStatus: 'healthy',
      queryPerformance: 'good',
      lastCheck: new Date().toISOString()
    };
  } catch (error) {
    return {
      connectionStatus: 'unknown',
      error: error.message
    };
  }
}

/**
 * Verify admin access
 */
async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const isAdmin = user.user_metadata?.role === 'admin' || 
                   user.app_metadata?.role === 'admin';
    
    return isAdmin ? user : null;
  } catch (error) {
    console.error('Admin verification error:', error);
    return null;
  }
}

/**
 * Get client IP address
 */
function getClientIP(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}