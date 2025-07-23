// Error alert management API
// Handles alert notifications and management

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  try {
    // Handle different HTTP methods
    switch (req.method) {
      case 'GET':
        return await getAlerts(req, res);
      case 'POST':
        return await createAlert(req, res);
      case 'PUT':
        return await updateAlert(req, res);
      case 'DELETE':
        return await deleteAlert(req, res);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Error in alert handler:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get alerts with filtering and pagination
async function getAlerts(req, res) {
  try {
    // Check admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const {
      page = 1,
      limit = 50,
      severity,
      resolved,
      alert_type,
      since
    } = req.query;

    let query = supabase
      .from('error_alerts')
      .select('*')
      .order('created_at', { ascending: false });

    // Apply filters
    if (severity) {
      query = query.eq('severity', severity);
    }

    if (resolved !== undefined) {
      query = query.eq('resolved', resolved === 'true');
    }

    if (alert_type) {
      query = query.eq('alert_type', alert_type);
    }

    if (since) {
      query = query.gte('created_at', since);
    }

    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data: alerts, error, count } = await query;

    if (error) {
      console.error('Error fetching alerts:', error);
      return res.status(500).json({ error: 'Failed to fetch alerts' });
    }

    // Get summary statistics
    const summary = await getAlertSummary();

    return res.status(200).json({
      success: true,
      alerts: alerts || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      },
      summary
    });

  } catch (error) {
    console.error('Error in getAlerts:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Create new alert
async function createAlert(req, res) {
  try {
    const alertData = req.body;

    // Validate required fields
    if (!alertData.message || !alertData.severity || !alertData.alert_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const { error } = await supabase
      .from('error_alerts')
      .insert({
        error_fingerprint: alertData.errorFingerprint || 'manual',
        alert_type: alertData.alertType,
        severity: alertData.severity,
        message: alertData.message,
        count: alertData.count || 1,
        first_occurrence: alertData.firstOccurrence || new Date().toISOString(),
        last_occurrence: alertData.lastOccurrence || new Date().toISOString(),
        affected_users: alertData.affectedUsers || 0,
        resolved: false
      });

    if (error) {
      console.error('Error creating alert:', error);
      return res.status(500).json({ error: 'Failed to create alert' });
    }

    // Send notification if critical
    if (alertData.severity === 'critical') {
      await sendCriticalAlert(alertData);
    }

    return res.status(201).json({ success: true });

  } catch (error) {
    console.error('Error in createAlert:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update alert (mainly for resolving)
async function updateAlert(req, res) {
  try {
    // Check admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.query;
    const updateData = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Alert ID required' });
    }

    const { error } = await supabase
      .from('error_alerts')
      .update({
        resolved: updateData.resolved,
        resolved_at: updateData.resolved ? new Date().toISOString() : null,
        resolved_by: updateData.resolved ? user.id : null,
        notes: updateData.notes,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) {
      console.error('Error updating alert:', error);
      return res.status(500).json({ error: 'Failed to update alert' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error in updateAlert:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Delete alert
async function deleteAlert(req, res) {
  try {
    // Check admin authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user || user.user_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { id } = req.query;

    if (!id) {
      return res.status(400).json({ error: 'Alert ID required' });
    }

    const { error } = await supabase
      .from('error_alerts')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting alert:', error);
      return res.status(500).json({ error: 'Failed to delete alert' });
    }

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error in deleteAlert:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get alert summary statistics
async function getAlertSummary() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Get counts by severity and time period
    const [
      { data: totalAlerts },
      { data: unresolvedAlerts },
      { data: criticalAlerts },
      { data: recentAlerts },
      { data: weeklyAlerts }
    ] = await Promise.all([
      supabase.from('error_alerts').select('id', { count: 'exact', head: true }),
      supabase.from('error_alerts').select('id', { count: 'exact', head: true }).eq('resolved', false),
      supabase.from('error_alerts').select('id', { count: 'exact', head: true }).eq('severity', 'critical').eq('resolved', false),
      supabase.from('error_alerts').select('id', { count: 'exact', head: true }).gte('created_at', oneDayAgo.toISOString()),
      supabase.from('error_alerts').select('id', { count: 'exact', head: true }).gte('created_at', oneWeekAgo.toISOString())
    ]);

    // Get alerts by type
    const { data: alertsByType } = await supabase
      .from('error_alerts')
      .select('alert_type')
      .eq('resolved', false);

    const typeDistribution = (alertsByType || []).reduce((acc, alert) => {
      acc[alert.alert_type] = (acc[alert.alert_type] || 0) + 1;
      return acc;
    }, {});

    return {
      total: totalAlerts?.length || 0,
      unresolved: unresolvedAlerts?.length || 0,
      critical: criticalAlerts?.length || 0,
      last24h: recentAlerts?.length || 0,
      lastWeek: weeklyAlerts?.length || 0,
      byType: typeDistribution
    };

  } catch (error) {
    console.error('Error getting alert summary:', error);
    return {
      total: 0,
      unresolved: 0,
      critical: 0,
      last24h: 0,
      lastWeek: 0,
      byType: {}
    };
  }
}

// Send critical alert notification
async function sendCriticalAlert(alertData) {
  try {
    // This would integrate with your notification system
    // Examples:
    // - Send email to admins
    // - Post to Slack channel
    // - Send SMS to on-call engineer
    // - Create ticket in support system

    console.log('CRITICAL ALERT:', {
      type: alertData.alertType,
      message: alertData.message,
      timestamp: new Date().toISOString()
    });

    // Example integration points:
    // await sendEmailNotification(alertData);
    // await postToSlack(alertData);
    // await sendSMS(alertData);

  } catch (error) {
    console.error('Error sending critical alert:', error);
  }
}