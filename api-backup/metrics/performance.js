// Performance metrics collection API
// Receives and stores performance data from client applications

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, data, timestamp, url, userAgent } = req.body;

    // Validate required fields
    if (!type || !data || !timestamp) {
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

    // Store metric in database
    const { error: dbError } = await supabase
      .from('performance_metrics')
      .insert({
        user_id: userId,
        type,
        data,
        timestamp,
        url: url || null,
        user_agent: userAgent || null,
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress
      });

    if (dbError) {
      console.error('Database error storing performance metric:', dbError);
      return res.status(500).json({ error: 'Failed to store metric' });
    }

    // Check for performance alerts
    await checkPerformanceAlerts(type, data);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error processing performance metric:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Check for performance alerts and trigger notifications
async function checkPerformanceAlerts(type, data) {
  try {
    const alerts = [];

    // Web Vitals alerts
    if (type === 'web-vital') {
      const { name, value, rating } = data;
      
      if (rating === 'poor') {
        alerts.push({
          severity: 'high',
          type: 'web-vital-poor',
          message: `Poor ${name} detected: ${value}`,
          data: { metric: name, value, rating }
        });
      }
    }

    // API performance alerts
    if (type === 'api') {
      const { endpoint, duration, status, error } = data;
      
      // Slow API calls (>5 seconds)
      if (duration > 5000) {
        alerts.push({
          severity: 'medium',
          type: 'slow-api',
          message: `Slow API call detected: ${endpoint} (${duration}ms)`,
          data: { endpoint, duration, status }
        });
      }

      // API errors
      if (status >= 500) {
        alerts.push({
          severity: 'high',
          type: 'api-error',
          message: `API error detected: ${endpoint} (${status})`,
          data: { endpoint, status, error }
        });
      }
    }

    // Custom metric alerts
    if (type === 'custom') {
      const { name, value } = data;
      
      // Page load time alerts (>10 seconds)
      if (name === 'page-load-time' && value > 10000) {
        alerts.push({
          severity: 'medium',
          type: 'slow-page-load',
          message: `Slow page load detected: ${value}ms`,
          data: { value }
        });
      }

      // Slow resource alerts (>5 seconds)
      if (name === 'slow-resource' && value > 5000) {
        alerts.push({
          severity: 'low',
          type: 'slow-resource',
          message: `Slow resource detected: ${data.metadata?.name} (${value}ms)`,
          data: { value, resource: data.metadata }
        });
      }
    }

    // Store alerts in database
    if (alerts.length > 0) {
      const { error } = await supabase
        .from('performance_alerts')
        .insert(alerts.map(alert => ({
          ...alert,
          created_at: new Date().toISOString()
        })));

      if (error) {
        console.error('Error storing performance alerts:', error);
      }
    }

  } catch (error) {
    console.error('Error checking performance alerts:', error);
  }
}