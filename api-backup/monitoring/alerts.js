// Monitoring alerts API endpoint
// Handles alert creation, retrieval, and management

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return createAlert(req, res);
  } else if (req.method === 'GET') {
    return getAlerts(req, res);
  } else if (req.method === 'PATCH') {
    return updateAlert(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Create a new alert
async function createAlert(req, res) {
  try {
    const {
      serviceName,
      alertType,
      severity,
      message,
      metadata
    } = req.body;

    // Validate required fields
    if (!serviceName || !alertType || !severity || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Check for existing unresolved alert
    const { data: existingAlert } = await supabase
      .from('uptime_alerts')
      .select('*')
      .eq('service_name', serviceName)
      .eq('alert_type', alertType)
      .eq('resolved', false)
      .single();

    if (existingAlert) {
      // Update existing alert timestamp and metadata
      const { error: updateError } = await supabase
        .from('uptime_alerts')
        .update({
          timestamp: new Date().toISOString(),
          metadata: { ...existingAlert.metadata, ...metadata },
          message
        })
        .eq('id', existingAlert.id);

      if (updateError) {
        console.error('Error updating existing alert:', updateError);
        return res.status(500).json({ error: 'Failed to update alert' });
      }

      return res.status(200).json({ 
        success: true, 
        alert: { ...existingAlert, updated: true }
      });
    }

    // Create new alert
    const { data: newAlert, error: insertError } = await supabase
      .from('uptime_alerts')
      .insert({
        service_name: serviceName,
        alert_type: alertType,
        severity,
        message,
        timestamp: new Date().toISOString(),
        resolved: false,
        metadata: metadata || {}
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating alert:', insertError);
      return res.status(500).json({ error: 'Failed to create alert' });
    }

    // Send notification based on severity
    await sendAlertNotification(newAlert);

    return res.status(201).json({ success: true, alert: newAlert });

  } catch (error) {
    console.error('Error in createAlert:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get alerts with filtering
async function getAlerts(req, res) {
  try {
    const { 
      serviceName, 
      alertType, 
      severity, 
      resolved, 
      limit = 50, 
      offset = 0 
    } = req.query;

    let query = supabase
      .from('uptime_alerts')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    // Apply filters
    if (serviceName) {
      query = query.eq('service_name', serviceName);
    }
    
    if (alertType) {
      query = query.eq('alert_type', alertType);
    }
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    if (resolved !== undefined) {
      query = query.eq('resolved', resolved === 'true');
    }

    const { data: alerts, count, error } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return res.status(500).json({ error: 'Failed to fetch alerts' });
    }

    // Get alert statistics
    const stats = await getAlertStatistics();

    return res.status(200).json({
      success: true,
      alerts,
      total: count,
      limit: parseInt(limit),
      offset: parseInt(offset),
      statistics: stats
    });

  } catch (error) {
    console.error('Error in getAlerts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update alert (mainly for resolving)
async function updateAlert(req, res) {
  try {
    const { alertId } = req.query;
    const { resolved, resolvedBy, resolvedAt, notes } = req.body;

    if (!alertId) {
      return res.status(400).json({ error: 'Alert ID is required' });
    }

    const updates = {};
    
    if (resolved !== undefined) {
      updates.resolved = resolved;
    }
    
    if (resolvedBy) {
      updates.resolved_by = resolvedBy;
    }
    
    if (resolvedAt) {
      updates.resolved_at = new Date(resolvedAt).toISOString();
    } else if (resolved) {
      updates.resolved_at = new Date().toISOString();
    }
    
    if (notes) {
      updates.resolution_notes = notes;
    }

    const { data: updatedAlert, error } = await supabase
      .from('uptime_alerts')
      .update(updates)
      .eq('id', alertId)
      .select()
      .single();

    if (error) {
      console.error('Error updating alert:', error);
      return res.status(500).json({ error: 'Failed to update alert' });
    }

    return res.status(200).json({ success: true, alert: updatedAlert });

  } catch (error) {
    console.error('Error in updateAlert:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get alert statistics
async function getAlertStatistics() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Total alerts
    const { count: totalAlerts } = await supabase
      .from('uptime_alerts')
      .select('*', { count: 'exact', head: true });

    // Unresolved alerts
    const { count: unresolvedAlerts } = await supabase
      .from('uptime_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('resolved', false);

    // Critical alerts in last 24h
    const { count: criticalAlerts24h } = await supabase
      .from('uptime_alerts')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'critical')
      .gte('timestamp', oneDayAgo.toISOString());

    // Alerts by severity in last week
    const { data: alertsBySeverity } = await supabase
      .from('uptime_alerts')
      .select('severity')
      .gte('timestamp', oneWeekAgo.toISOString());

    const severityCount = (alertsBySeverity || []).reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {});

    // Alerts by service in last week
    const { data: alertsByService } = await supabase
      .from('uptime_alerts')
      .select('service_name')
      .gte('timestamp', oneWeekAgo.toISOString());

    const serviceCount = (alertsByService || []).reduce((acc, alert) => {
      acc[alert.service_name] = (acc[alert.service_name] || 0) + 1;
      return acc;
    }, {});

    // Most frequent alert types
    const { data: alertsByType } = await supabase
      .from('uptime_alerts')
      .select('alert_type')
      .gte('timestamp', oneWeekAgo.toISOString());

    const typeCount = (alertsByType || []).reduce((acc, alert) => {
      acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: totalAlerts || 0,
      unresolved: unresolvedAlerts || 0,
      critical24h: criticalAlerts24h || 0,
      bySeverity: severityCount,
      byService: serviceCount,
      byType: typeCount
    };

  } catch (error) {
    console.error('Error getting alert statistics:', error);
    return {
      total: 0,
      unresolved: 0,
      critical24h: 0,
      bySeverity: {},
      byService: {},
      byType: {}
    };
  }
}

// Send alert notification
async function sendAlertNotification(alert) {
  try {
    // In a real implementation, you would send notifications via:
    // - Email
    // - Slack
    // - PagerDuty
    // - SMS
    // - Discord webhook
    // etc.

    console.log(`Alert notification: [${alert.severity.toUpperCase()}] ${alert.message}`);

    // Store notification in audit log
    await supabase
      .from('alert_notifications')
      .insert({
        alert_id: alert.id,
        notification_type: 'console',
        sent_at: new Date().toISOString(),
        status: 'sent',
        metadata: {
          alert_type: alert.alert_type,
          severity: alert.severity,
          service_name: alert.service_name
        }
      });

    // If this is a critical alert, you might want to implement immediate notifications
    if (alert.severity === 'critical') {
      // Send immediate notification
      await sendImmediateNotification(alert);
    }

  } catch (error) {
    console.error('Error sending alert notification:', error);
  }
}

// Send immediate notification for critical alerts
async function sendImmediateNotification(alert) {
  try {
    // Example webhook notification (replace with your actual notification service)
    const webhookUrl = process.env.ALERT_WEBHOOK_URL;
    
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: `🚨 CRITICAL ALERT: ${alert.message}`,
          attachments: [{
            color: 'danger',
            fields: [
              { title: 'Service', value: alert.service_name, short: true },
              { title: 'Type', value: alert.alert_type, short: true },
              { title: 'Time', value: new Date(alert.timestamp).toLocaleString(), short: false }
            ]
          }]
        })
      });
    }

  } catch (error) {
    console.error('Error sending immediate notification:', error);
  }
}