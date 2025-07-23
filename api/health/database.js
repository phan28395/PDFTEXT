// Health check endpoint for database connectivity
// Verifies Supabase database connection and performance

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
    service: 'Database',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    responseTime: 0,
    version: process.env.VITE_APP_VERSION || 'unknown'
  };

  try {
    // Check basic connectivity
    healthCheck.checks.connectivity = await checkConnectivity();
    
    // Check table accessibility
    healthCheck.checks.tables = await checkTables();
    
    // Check database functions
    healthCheck.checks.functions = await checkFunctions();
    
    // Check performance
    healthCheck.checks.performance = await checkPerformance();

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

// Check basic database connectivity
async function checkConnectivity() {
  try {
    const start = Date.now();
    
    // Simple query to test connection
    const { data, error } = await supabase
      .from('information_schema.tables')
      .select('table_name')
      .eq('table_schema', 'public')
      .limit(1);

    const queryTime = Date.now() - start;

    if (error) {
      throw new Error(`Database connection failed: ${error.message}`);
    }

    return {
      status: 'healthy',
      message: 'Database connection successful',
      timestamp: new Date().toISOString(),
      metadata: {
        queryTime,
        connected: true
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Connectivity check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check critical tables
async function checkTables() {
  try {
    const criticalTables = [
      'users',
      'processing_history',
      'api_cost_tracking',
      'performance_metrics'
    ];

    const tableChecks = {};
    
    for (const tableName of criticalTables) {
      try {
        const start = Date.now();
        const { data, error } = await supabase
          .from(tableName)
          .select('*')
          .limit(1);

        const queryTime = Date.now() - start;

        tableChecks[tableName] = {
          accessible: !error,
          queryTime,
          error: error?.message
        };

      } catch (tableError) {
        tableChecks[tableName] = {
          accessible: false,
          error: tableError.message
        };
      }
    }

    const allTablesAccessible = Object.values(tableChecks).every(
      check => check.accessible
    );

    return {
      status: allTablesAccessible ? 'healthy' : 'degraded',
      message: `${Object.keys(tableChecks).filter(table => tableChecks[table].accessible).length}/${criticalTables.length} critical tables accessible`,
      timestamp: new Date().toISOString(),
      metadata: {
        tables: tableChecks,
        totalTables: criticalTables.length,
        accessibleTables: Object.values(tableChecks).filter(check => check.accessible).length
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Table check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check database functions
async function checkFunctions() {
  try {
    const functionChecks = {};

    // Test usage tracking function
    try {
      const { data, error } = await supabase.rpc('get_user_usage_stats', {
        user_uuid: '00000000-0000-0000-0000-000000000000'
      });

      functionChecks.get_user_usage_stats = {
        exists: true,
        callable: !error || !error.message.includes('function does not exist'),
        error: error?.message
      };
    } catch (funcError) {
      functionChecks.get_user_usage_stats = {
        exists: false,
        error: funcError.message
      };
    }

    // Test cost tracking function
    try {
      const { data, error } = await supabase.rpc('track_api_cost', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_service: 'health-check',
        p_operation: 'test',
        p_cost_amount: 0,
        p_units_consumed: 0,
        p_unit_type: 'test'
      });

      functionChecks.track_api_cost = {
        exists: true,
        callable: !error || !error.message.includes('function does not exist'),
        error: error?.message
      };
    } catch (funcError) {
      functionChecks.track_api_cost = {
        exists: false,
        error: funcError.message
      };
    }

    const allFunctionsExist = Object.values(functionChecks).every(
      check => check.exists
    );

    return {
      status: allFunctionsExist ? 'healthy' : 'degraded',
      message: `${Object.values(functionChecks).filter(check => check.exists).length}/${Object.keys(functionChecks).length} functions available`,
      timestamp: new Date().toISOString(),
      metadata: {
        functions: functionChecks
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Functions check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check database performance
async function checkPerformance() {
  try {
    const performanceTests = [];

    // Test 1: Simple SELECT query
    const start1 = Date.now();
    await supabase.from('users').select('id').limit(10);
    const simpleSelectTime = Date.now() - start1;
    performanceTests.push({ test: 'simple_select', time: simpleSelectTime });

    // Test 2: COUNT query
    const start2 = Date.now();
    await supabase.from('processing_history').select('*', { count: 'exact', head: true });
    const countQueryTime = Date.now() - start2;
    performanceTests.push({ test: 'count_query', time: countQueryTime });

    // Test 3: Complex query with joins (if applicable)
    const start3 = Date.now();
    await supabase
      .from('processing_history')
      .select('id, user_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5);
    const complexQueryTime = Date.now() - start3;
    performanceTests.push({ test: 'complex_query', time: complexQueryTime });

    // Calculate average performance
    const avgResponseTime = performanceTests.reduce((sum, test) => sum + test.time, 0) / performanceTests.length;

    // Determine performance status
    let performanceStatus = 'healthy';
    if (avgResponseTime > 1000) {
      performanceStatus = 'unhealthy';
    } else if (avgResponseTime > 500) {
      performanceStatus = 'degraded';
    }

    return {
      status: performanceStatus,
      message: `Average query time: ${avgResponseTime.toFixed(2)}ms`,
      timestamp: new Date().toISOString(),
      metadata: {
        averageResponseTime: avgResponseTime,
        tests: performanceTests,
        thresholds: {
          healthy: '< 500ms',
          degraded: '500-1000ms',
          unhealthy: '> 1000ms'
        }
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Performance check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}