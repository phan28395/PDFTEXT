// Uptime monitoring API endpoint
// Receives uptime check results and manages monitoring data

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method === 'POST') {
    return handleUptimeResult(req, res);
  } else if (req.method === 'GET') {
    return getUptimeStatus(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

// Handle uptime check result
async function handleUptimeResult(req, res) {
  try {
    const { 
      checkId, 
      timestamp, 
      isAvailable, 
      responseTime, 
      statusCode, 
      errorMessage, 
      metadata 
    } = req.body;

    // Validate required fields
    if (!checkId || !timestamp || isAvailable === undefined || !responseTime === undefined) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store uptime result
    const { error: dbError } = await supabase
      .from('uptime_results')
      .insert({
        check_id: checkId,
        timestamp: new Date(timestamp).toISOString(),
        is_available: isAvailable,
        response_time: responseTime,
        status_code: statusCode || null,
        error_message: errorMessage || null,
        metadata: metadata || {},
        created_at: new Date().toISOString()
      });

    if (dbError) {
      console.error('Database error storing uptime result:', dbError);
      return res.status(500).json({ error: 'Failed to store uptime result' });
    }

    // Update service status
    await updateServiceStatus(checkId, isAvailable, responseTime);

    // Check for alerts
    await checkUptimeAlerts(checkId, isAvailable, responseTime, errorMessage);

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error processing uptime result:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get uptime status and statistics
async function getUptimeStatus(req, res) {
  try {
    const { serviceName, period = '24h' } = req.query;

    // Calculate time range
    const now = new Date();
    let startTime = new Date();
    
    switch (period) {
      case '1h':
        startTime.setHours(now.getHours() - 1);
        break;
      case '24h':
        startTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        startTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        startTime.setDate(now.getDate() - 30);
        break;
      default:
        startTime.setDate(now.getDate() - 1);
    }

    // Get uptime checks
    let checksQuery = supabase
      .from('uptime_checks')
      .select('*')
      .eq('enabled', true);

    if (serviceName) {
      checksQuery = checksQuery.eq('service_name', serviceName);
    }

    const { data: checks, error: checksError } = await checksQuery;

    if (checksError) {
      console.error('Error fetching uptime checks:', checksError);
      return res.status(500).json({ error: 'Failed to fetch uptime checks' });
    }

    // Get results for each check
    const serviceStatuses = await Promise.all(
      checks.map(async (check) => {
        const { data: results, error: resultsError } = await supabase
          .from('uptime_results')
          .select('*')
          .eq('check_id', check.id)
          .gte('timestamp', startTime.toISOString())
          .order('timestamp', { ascending: false });

        if (resultsError) {
          console.error('Error fetching uptime results:', resultsError);
          return null;
        }

        if (results.length === 0) {
          return {
            serviceName: check.service_name,
            isAvailable: null,
            lastCheck: null,
            responseTime: 0,
            uptime: 0,
            incidentCount: 0
          };
        }

        const latestResult = results[0];
        const availableResults = results.filter(r => r.is_available);
        const uptime = availableResults.length / results.length;
        const avgResponseTime = availableResults.length > 0 
          ? availableResults.reduce((sum, r) => sum + r.response_time, 0) / availableResults.length
          : 0;
        const incidentCount = results.filter(r => !r.is_available).length;

        return {
          serviceName: check.service_name,
          isAvailable: latestResult.is_available,
          lastCheck: latestResult.timestamp,
          responseTime: avgResponseTime,
          uptime: uptime * 100,
          incidentCount,
          totalChecks: results.length,
          endpoint: check.endpoint
        };
      })
    );

    // Filter out null results
    const validStatuses = serviceStatuses.filter(status => status !== null);

    // Calculate overall system health
    const overallHealth = calculateOverallHealth(validStatuses);

    return res.status(200).json({
      success: true,
      period,
      serviceStatuses: validStatuses,
      overallHealth
    });

  } catch (error) {
    console.error('Error getting uptime status:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Update service status in database
async function updateServiceStatus(checkId, isAvailable, responseTime) {
  try {
    // Get check details
    const { data: check, error: checkError } = await supabase
      .from('uptime_checks')
      .select('service_name')
      .eq('id', checkId)
      .single();

    if (checkError || !check) {
      return;
    }

    // Update or insert service status
    const { error: statusError } = await supabase
      .from('service_status')
      .upsert({
        service_name: check.service_name,
        is_available: isAvailable,
        last_check: new Date().toISOString(),
        response_time: responseTime,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'service_name'
      });

    if (statusError) {
      console.error('Error updating service status:', statusError);
    }

  } catch (error) {
    console.error('Error in updateServiceStatus:', error);
  }
}

// Check for uptime alerts
async function checkUptimeAlerts(checkId, isAvailable, responseTime, errorMessage) {
  try {
    // Get check details
    const { data: check, error: checkError } = await supabase
      .from('uptime_checks')
      .select('*')
      .eq('id', checkId)
      .single();

    if (checkError || !check) {
      return;
    }

    const alerts = [];

    // Service down alert
    if (!isAvailable) {
      // Check consecutive failures
      const { data: recentResults } = await supabase
        .from('uptime_results')
        .select('is_available')
        .eq('check_id', checkId)
        .order('timestamp', { ascending: false })
        .limit(5);

      const consecutiveFailures = getConsecutiveFailures(recentResults || []);

      if (consecutiveFailures >= 2) {
        alerts.push({
          service_name: check.service_name,
          alert_type: 'service_down',
          severity: 'critical',
          message: `${check.service_name} has been down for ${consecutiveFailures} consecutive checks`,
          metadata: {
            checkId,
            endpoint: check.endpoint,
            errorMessage,
            consecutiveFailures
          }
        });
      }
    }

    // Service recovered alert
    if (isAvailable) {
      const { data: lastResult } = await supabase
        .from('uptime_results')
        .select('is_available')
        .eq('check_id', checkId)
        .order('timestamp', { ascending: false })
        .limit(2);

      if (lastResult && lastResult.length > 1 && !lastResult[1].is_available) {
        alerts.push({
          service_name: check.service_name,
          alert_type: 'service_recovered',
          severity: 'low',
          message: `${check.service_name} has recovered and is now available`,
          metadata: {
            checkId,
            endpoint: check.endpoint,
            responseTime
          }
        });

        // Mark previous alerts as resolved
        await supabase
          .from('uptime_alerts')
          .update({ resolved: true })
          .eq('service_name', check.service_name)
          .eq('resolved', false);
      }
    }

    // Slow response alert
    if (isAvailable && responseTime > check.timeout * 0.8) {
      alerts.push({
        service_name: check.service_name,
        alert_type: 'slow_response',
        severity: 'medium',
        message: `${check.service_name} is responding slowly (${responseTime}ms)`,
        metadata: {
          checkId,
          endpoint: check.endpoint,
          responseTime,
          threshold: check.timeout * 0.8
        }
      });
    }

    // Store alerts
    if (alerts.length > 0) {
      const { error: alertError } = await supabase
        .from('uptime_alerts')
        .insert(alerts.map(alert => ({
          ...alert,
          timestamp: new Date().toISOString(),
          resolved: false
        })));

      if (alertError) {
        console.error('Error storing uptime alerts:', alertError);
      }
    }

  } catch (error) {
    console.error('Error checking uptime alerts:', error);
  }
}

// Count consecutive failures
function getConsecutiveFailures(results) {
  let count = 0;
  for (const result of results) {
    if (!result.is_available) {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// Calculate overall system health
function calculateOverallHealth(serviceStatuses) {
  if (serviceStatuses.length === 0) {
    return {
      status: 'unknown',
      servicesUp: 0,
      servicesTotal: 0,
      averageUptime: 0
    };
  }

  const servicesUp = serviceStatuses.filter(s => s.isAvailable).length;
  const servicesTotal = serviceStatuses.length;
  const averageUptime = serviceStatuses.reduce((sum, s) => sum + s.uptime, 0) / servicesTotal;

  let status = 'healthy';
  if (servicesUp === 0) {
    status = 'down';
  } else if (servicesUp < servicesTotal || averageUptime < 95) {
    status = 'degraded';
  }

  return {
    status,
    servicesUp,
    servicesTotal,
    averageUptime: Math.round(averageUptime * 100) / 100
  };
}