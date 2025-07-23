// Error reporting API endpoint
// Receives and processes error reports from client applications

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const errorReport = req.body;

    // Validate required fields
    if (!errorReport.message || !errorReport.fingerprint || !errorReport.level) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Get user ID from authentication if available
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        userId = user?.id || null;
      } catch (error) {
        // Continue without user ID if auth fails
      }
    }

    // Store error report in database
    const { error: dbError } = await supabase
      .from('error_reports')
      .insert({
        user_id: userId || errorReport.userId,
        level: errorReport.level,
        message: errorReport.message,
        stack: errorReport.stack,
        fingerprint: errorReport.fingerprint,
        url: errorReport.url,
        user_agent: errorReport.userAgent || req.headers['user-agent'],
        tags: errorReport.tags || [],
        context: errorReport.context || {},
        metadata: errorReport.metadata || {},
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        timestamp: errorReport.timestamp || new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error storing error report:', dbError);
      return res.status(500).json({ error: 'Failed to store error report' });
    }

    // Process error for alerting
    await processErrorForAlerts(errorReport, userId);

    // Update error statistics
    await updateErrorStatistics(errorReport);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error processing error report:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Process error for alert generation
async function processErrorForAlerts(errorReport, userId) {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

    // Check for critical errors
    if (isCriticalError(errorReport)) {
      await createAlert({
        error_fingerprint: errorReport.fingerprint,
        alert_type: 'critical_error',
        severity: 'critical',
        message: `Critical error: ${errorReport.message}`,
        count: 1,
        first_occurrence: now,
        last_occurrence: now
      });
    }

    // Check for new errors (first occurrence)
    const { data: existingErrors, error } = await supabase
      .from('error_reports')
      .select('id')
      .eq('fingerprint', errorReport.fingerprint)
      .limit(1);

    if (!error && existingErrors && existingErrors.length === 0) {
      await createAlert({
        error_fingerprint: errorReport.fingerprint,
        alert_type: 'new_error',
        severity: 'medium',
        message: `New error detected: ${errorReport.message}`,
        count: 1,
        first_occurrence: now,
        last_occurrence: now
      });
    }

    // Check for error spikes (10+ errors in 5 minutes)
    const { data: recentErrors } = await supabase
      .from('error_reports')
      .select('id')
      .gte('created_at', fiveMinutesAgo.toISOString());

    if (recentErrors && recentErrors.length >= 10) {
      await createAlert({
        error_fingerprint: 'spike',
        alert_type: 'error_spike',
        severity: 'high',
        message: `Error spike detected: ${recentErrors.length} errors in 5 minutes`,
        count: recentErrors.length,
        first_occurrence: fiveMinutesAgo,
        last_occurrence: now
      });
    }

    // Check for high frequency errors (5+ same errors in 1 hour)
    const { data: sameErrors } = await supabase
      .from('error_reports')
      .select('id')
      .eq('fingerprint', errorReport.fingerprint)
      .gte('created_at', oneHourAgo.toISOString());

    if (sameErrors && sameErrors.length >= 5) {
      await createAlert({
        error_fingerprint: errorReport.fingerprint,
        alert_type: 'high_frequency',
        severity: 'high',
        message: `High frequency error: ${errorReport.message} (${sameErrors.length} times in 1 hour)`,
        count: sameErrors.length,
        first_occurrence: oneHourAgo,
        last_occurrence: now
      });
    }

  } catch (error) {
    console.error('Error processing alerts:', error);
  }
}

// Create alert in database
async function createAlert(alertData) {
  try {
    // Check if similar alert already exists and is unresolved
    const { data: existingAlert } = await supabase
      .from('error_alerts')
      .select('id')
      .eq('error_fingerprint', alertData.error_fingerprint)
      .eq('alert_type', alertData.alert_type)
      .eq('resolved', false)
      .limit(1);

    if (existingAlert && existingAlert.length > 0) {
      // Update existing alert
      await supabase
        .from('error_alerts')
        .update({
          count: alertData.count,
          last_occurrence: alertData.last_occurrence,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingAlert[0].id);
    } else {
      // Create new alert
      const { error } = await supabase
        .from('error_alerts')
        .insert({
          error_fingerprint: alertData.error_fingerprint,
          alert_type: alertData.alert_type,
          severity: alertData.severity,
          message: alertData.message,
          count: alertData.count,
          first_occurrence: alertData.first_occurrence,
          last_occurrence: alertData.last_occurrence,
          resolved: false
        });

      if (!error) {
        // Send notification (implement based on your notification system)
        await sendAlertNotification(alertData);
      }
    }

  } catch (error) {
    console.error('Error creating alert:', error);
  }
}

// Determine if error is critical
function isCriticalError(errorReport) {
  const criticalPatterns = [
    /payment.*failed/i,
    /database.*connection/i,
    /auth.*failure/i,
    /security.*breach/i,
    /data.*corruption/i,
    /system.*crash/i,
    /memory.*leak/i,
    /deadlock/i
  ];

  return criticalPatterns.some(pattern => pattern.test(errorReport.message));
}

// Update error statistics
async function updateErrorStatistics(errorReport) {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Update daily error statistics
    const { error } = await supabase
      .from('error_statistics')
      .upsert({
        date: today,
        total_errors: 1,
        errors_by_level: { [errorReport.level]: 1 },
        errors_by_component: { [errorReport.context?.component || 'unknown']: 1 },
        unique_fingerprints: [errorReport.fingerprint]
      }, {
        onConflict: 'date',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('Error updating statistics:', error);
    }

  } catch (error) {
    console.error('Error in updateErrorStatistics:', error);
  }
}

// Send alert notification (implement based on your notification system)
async function sendAlertNotification(alertData) {
  try {
    // This could integrate with:
    // - Email notifications
    // - Slack webhooks
    // - SMS alerts
    // - Push notifications
    // - Third-party monitoring services

    console.log('Alert generated:', {
      type: alertData.alert_type,
      severity: alertData.severity,
      message: alertData.message,
      count: alertData.count
    });

    // Example: Send to admin notification system
    if (alertData.severity === 'critical') {
      // Send immediate notification for critical errors
      // await sendImmediateNotification(alertData);
    }

  } catch (error) {
    console.error('Error sending alert notification:', error);
  }
}