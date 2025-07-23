/**
 * API Key Rotation Management Endpoint
 * Provides admin interface for managing API key rotations
 */

import { applySecurityHeaders, withSecurityHeaders } from '../../src/lib/securityHeaders.ts';
import { keyRotationManager } from '../../src/lib/keyRotation.ts';

export default withSecurityHeaders()(async function handler(req, res) {
  try {
    // Verify admin access
    const user = await verifyAdmin(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method, query, body } = req;
    const { action, service } = query;

    switch (method) {
      case 'GET':
        return await handleGetRequest(req, res, action, service);
      case 'POST':
        return await handlePostRequest(req, res, action, service, body);
      case 'PUT':
        return await handlePutRequest(req, res, action, service, body);
      case 'DELETE':
        return await handleDeleteRequest(req, res, action, service);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Key rotation API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle GET requests
 */
async function handleGetRequest(req, res, action, service) {
  switch (action) {
    case 'status':
      // Get rotation status for all services or specific service
      const keysNeedingRotation = await keyRotationManager.getKeysNeedingRotation();
      const filteredKeys = service 
        ? keysNeedingRotation.filter(k => k.serviceName === service)
        : keysNeedingRotation;
      
      return res.json({
        keysNeedingRotation: filteredKeys,
        totalDue: filteredKeys.length
      });

    case 'history':
      // Get rotation history
      const history = await keyRotationManager.getRotationHistory(service, 100);
      return res.json({ history });

    case 'test':
      // Test key validity
      if (!service) {
        return res.status(400).json({ error: 'Service name required for testing' });
      }
      
      const isValid = await keyRotationManager.testKeyValidity(service);
      return res.json({ 
        service,
        valid: isValid,
        testedAt: new Date().toISOString()
      });

    case 'stats':
      // Get rotation statistics
      const stats = await getRotationStatistics(service);
      return res.json(stats);

    default:
      // Return overview of all services
      const allServices = ['stripe', 'supabase', 'google-document-ai', 'virustotal'];
      const serviceStatuses = await Promise.all(
        allServices.map(async (serviceName) => {
          try {
            const isValid = await keyRotationManager.testKeyValidity(serviceName);
            return {
              service: serviceName,
              valid: isValid,
              lastChecked: new Date().toISOString()
            };
          } catch (error) {
            return {
              service: serviceName,
              valid: false,
              error: error.message,
              lastChecked: new Date().toISOString()
            };
          }
        })
      );
      
      return res.json({
        services: serviceStatuses,
        keysNeedingRotation: await keyRotationManager.getKeysNeedingRotation()
      });
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(req, res, action, service, body) {
  switch (action) {
    case 'rotate':
      // Rotate specific service key or all due keys
      if (service) {
        const result = await keyRotationManager.rotateServiceKey(service);
        return res.json(result);
      } else {
        const results = await keyRotationManager.rotateAllDueKeys();
        return res.json({
          results,
          totalProcessed: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        });
      }

    case 'test-all':
      // Test all service keys
      const allServices = ['stripe', 'supabase', 'google-document-ai', 'virustotal'];
      const testResults = await Promise.all(
        allServices.map(async (serviceName) => {
          const isValid = await keyRotationManager.testKeyValidity(serviceName);
          return {
            service: serviceName,
            valid: isValid,
            testedAt: new Date().toISOString()
          };
        })
      );
      
      return res.json({
        tests: testResults,
        allValid: testResults.every(t => t.valid)
      });

    case 'emergency-disable':
      // Emergency disable a key
      if (!service) {
        return res.status(400).json({ error: 'Service name required' });
      }
      
      const disabled = await emergencyDisableKey(service);
      return res.json({
        service,
        disabled,
        disabledAt: new Date().toISOString()
      });

    case 'schedule':
      // Setup or modify rotation schedule
      if (!service || !body.intervalDays) {
        return res.status(400).json({ error: 'Service name and interval required' });
      }
      
      const scheduled = await updateRotationSchedule(service, body.intervalDays);
      return res.json({
        service,
        intervalDays: body.intervalDays,
        scheduled,
        updatedAt: new Date().toISOString()
      });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(req, res, action, service, body) {
  switch (action) {
    case 'enable':
      // Enable a disabled key
      if (!service) {
        return res.status(400).json({ error: 'Service name required' });
      }
      
      const enabled = await enableKey(service);
      return res.json({
        service,
        enabled,
        enabledAt: new Date().toISOString()
      });

    case 'rollback':
      // Rollback to previous key
      if (!service) {
        return res.status(400).json({ error: 'Service name required' });
      }
      
      const rolledBack = await rollbackKey(service);
      return res.json({
        service,
        rolledBack,
        rolledBackAt: new Date().toISOString()
      });

    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Handle DELETE requests
 */
async function handleDeleteRequest(req, res, action, service) {
  // Currently no delete operations supported
  return res.status(405).json({ error: 'Delete operations not supported' });
}

/**
 * Verify admin access
 */
async function verifyAdmin(req) {
  // Extract token from Authorization header
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return null;
  }

  try {
    // Verify with Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return null;
    }

    // Check if user has admin role
    const isAdmin = user.user_metadata?.role === 'admin' || 
                   user.app_metadata?.role === 'admin';
    
    return isAdmin ? user : null;
  } catch (error) {
    console.error('Admin verification error:', error);
    return null;
  }
}

/**
 * Get rotation statistics
 */
async function getRotationStatistics(service) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.rpc('get_rotation_statistics', {
      p_environment: process.env.NODE_ENV,
      p_days_back: 30
    });

    if (error) throw error;

    return data || {
      period_days: 30,
      environment: process.env.NODE_ENV,
      overall: { total_services: 0, total_rotations: 0 },
      by_service: []
    };
  } catch (error) {
    console.error('Error getting rotation statistics:', error);
    return null;
  }
}

/**
 * Emergency disable a key
 */
async function emergencyDisableKey(service) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.rpc('disable_api_key', {
      p_service_name: service,
      p_environment: process.env.NODE_ENV
    });

    return !error && data;
  } catch (error) {
    console.error('Error disabling key:', error);
    return false;
  }
}

/**
 * Enable a key
 */
async function enableKey(service) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.rpc('enable_api_key', {
      p_service_name: service,
      p_environment: process.env.NODE_ENV
    });

    return !error && data;
  } catch (error) {
    console.error('Error enabling key:', error);
    return false;
  }
}

/**
 * Rollback to previous key
 */
async function rollbackKey(service) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase.rpc('rollback_to_previous_key', {
      p_service_name: service,
      p_environment: process.env.NODE_ENV
    });

    return !error && data;
  } catch (error) {
    console.error('Error rolling back key:', error);
    return false;
  }
}

/**
 * Update rotation schedule
 */
async function updateRotationSchedule(service, intervalDays) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const nextRotation = new Date();
    nextRotation.setDate(nextRotation.getDate() + intervalDays);

    const { error } = await supabase
      .from('api_keys')
      .update({
        rotation_interval_days: intervalDays,
        next_rotation_date: nextRotation.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('service_name', service)
      .eq('environment', process.env.NODE_ENV);

    return !error;
  } catch (error) {
    console.error('Error updating rotation schedule:', error);
    return false;
  }
}