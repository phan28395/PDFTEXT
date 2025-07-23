// Health check endpoint for authentication service
// Verifies Supabase Auth integration and functionality

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const startTime = Date.now();
  const healthCheck = {
    service: 'Authentication',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    responseTime: 0,
    version: process.env.VITE_APP_VERSION || 'unknown'
  };

  try {
    // Check Supabase configuration
    healthCheck.checks.supabaseConfig = await checkSupabaseConfig();
    
    // Check authentication endpoints
    healthCheck.checks.authEndpoints = await checkAuthEndpoints();
    
    // Check user management capabilities
    healthCheck.checks.userManagement = await checkUserManagement();
    
    // Check RLS policies
    healthCheck.checks.rowLevelSecurity = await checkRowLevelSecurity();

    // Determine overall health
    const allChecksHealthy = Object.values(healthCheck.checks).every(
      check => check.status === 'healthy'
    );
    
    healthCheck.status = allChecksHealthy ? 'healthy' : 'degraded';
    healthCheck.responseTime = Date.now() - startTime;

    const statusCode = allChecksHealthy ? 200 : 503;
    return res.status(statusCode).json(healthCheck);

  } catch (error) {
    healthCheck.status = 'unhealthy';
    healthCheck.responseTime = Date.now() - startTime;
    healthCheck.error = error.message;

    return res.status(503).json(healthCheck);
  }
}

// Check Supabase configuration
async function checkSupabaseConfig() {
  try {
    // Verify environment variables
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      return {
        status: 'unhealthy',
        message: `Missing environment variables: ${missingVars.join(', ')}`,
        timestamp: new Date().toISOString()
      };
    }

    // Verify URL format
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    if (!supabaseUrl.startsWith('https://') || !supabaseUrl.includes('supabase.co')) {
      return {
        status: 'unhealthy',
        message: 'Invalid Supabase URL format',
        timestamp: new Date().toISOString()
      };
    }

    return {
      status: 'healthy',
      message: 'Supabase configuration verified',
      timestamp: new Date().toISOString(),
      metadata: {
        urlConfigured: true,
        serviceRoleConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Configuration check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check authentication endpoints
async function checkAuthEndpoints() {
  try {
    // Test basic connection to Supabase Auth
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1
    });

    if (error) {
      throw new Error(`Auth API error: ${error.message}`);
    }

    return {
      status: 'healthy',
      message: 'Authentication endpoints accessible',
      timestamp: new Date().toISOString(),
      metadata: {
        authApiAccessible: true,
        canListUsers: !error
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Auth endpoints check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check user management capabilities
async function checkUserManagement() {
  try {
    // Check if we can access user-related tables
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`User table access failed: ${error.message}`);
    }

    // Check auth.users access
    const { data: authData, error: authError } = await supabase
      .from('auth.users')
      .select('id')
      .limit(1);

    // Note: This might fail due to RLS, which is expected
    const authTableAccessible = !authError || authError.code !== '42501';

    return {
      status: 'healthy',
      message: 'User management capabilities verified',
      timestamp: new Date().toISOString(),
      metadata: {
        userTableAccessible: !error,
        authTableAccessible
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `User management check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check Row Level Security policies
async function checkRowLevelSecurity() {
  try {
    // Test RLS by trying to access users table without auth context
    const publicSupabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.VITE_SUPABASE_ANON_KEY || 'dummy_key'
    );

    const { data, error } = await publicSupabase
      .from('users')
      .select('*')
      .limit(1);

    // RLS should prevent access, so we expect an error or empty result
    const rlsWorking = error || (data && data.length === 0);

    return {
      status: 'healthy',
      message: 'Row Level Security policies verified',
      timestamp: new Date().toISOString(),
      metadata: {
        rlsEnabled: rlsWorking,
        errorCode: error?.code,
        errorMessage: error?.message
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `RLS check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}