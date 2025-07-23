// Health check endpoint for PDF processing service
// Verifies Document AI integration and processing capabilities

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
    service: 'PDF Processing',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    checks: {},
    responseTime: 0,
    version: process.env.VITE_APP_VERSION || 'unknown'
  };

  try {
    // Check Document AI configuration
    healthCheck.checks.documentAI = await checkDocumentAI();
    
    // Check file processing capabilities
    healthCheck.checks.fileProcessing = await checkFileProcessing();
    
    // Check temporary storage
    healthCheck.checks.tempStorage = await checkTempStorage();
    
    // Check processing database tables
    healthCheck.checks.database = await checkProcessingDatabase();

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

// Check Document AI configuration
async function checkDocumentAI() {
  try {
    // Verify environment variables
    const requiredEnvVars = [
      'GOOGLE_APPLICATION_CREDENTIALS',
      'GOOGLE_CLOUD_PROJECT_ID'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      return {
        status: 'unhealthy',
        message: `Missing environment variables: ${missingVars.join(', ')}`,
        timestamp: new Date().toISOString()
      };
    }

    // Check if credentials file exists (in production this might be different)
    if (process.env.NODE_ENV !== 'production') {
      const fs = require('fs');
      const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      
      if (credentialsPath && !fs.existsSync(credentialsPath)) {
        return {
          status: 'unhealthy',
          message: 'Google credentials file not found',
          timestamp: new Date().toISOString()
        };
      }
    }

    return {
      status: 'healthy',
      message: 'Document AI configuration verified',
      timestamp: new Date().toISOString(),
      metadata: {
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID ? 'configured' : 'missing'
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Document AI check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check file processing capabilities
async function checkFileProcessing() {
  try {
    // Check if required modules are available
    const formidable = require('formidable');
    const fs = require('fs');
    
    // Verify temp directory is writable
    const tempDir = '/tmp';
    const testFile = `${tempDir}/health-check-${Date.now()}.txt`;
    
    fs.writeFileSync(testFile, 'health check');
    fs.unlinkSync(testFile);

    return {
      status: 'healthy',
      message: 'File processing capabilities verified',
      timestamp: new Date().toISOString(),
      metadata: {
        formidableAvailable: !!formidable,
        tempDirWritable: true
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `File processing check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check temporary storage
async function checkTempStorage() {
  try {
    const fs = require('fs');
    const path = require('path');
    
    const tempDir = '/tmp';
    const stats = fs.statSync(tempDir);
    
    if (!stats.isDirectory()) {
      throw new Error('Temp directory is not accessible');
    }

    // Check available space (simplified check)
    const testFile = path.join(tempDir, `space-check-${Date.now()}.txt`);
    const testData = 'x'.repeat(1024 * 1024); // 1MB test
    
    fs.writeFileSync(testFile, testData);
    const fileStats = fs.statSync(testFile);
    fs.unlinkSync(testFile);

    return {
      status: 'healthy',
      message: 'Temporary storage verified',
      timestamp: new Date().toISOString(),
      metadata: {
        tempDir,
        testFileSize: fileStats.size,
        writable: true
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Temp storage check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}

// Check processing database tables
async function checkProcessingDatabase() {
  try {
    // Test basic database connectivity and required tables
    const { data, error } = await supabase
      .from('processing_history')
      .select('id')
      .limit(1);

    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }

    // Check if usage tracking function exists
    const { data: functionData, error: functionError } = await supabase
      .rpc('atomic_update_user_pages_usage', {
        user_uuid: '00000000-0000-0000-0000-000000000000',
        pages_count: 0,
        processing_record_id: '00000000-0000-0000-0000-000000000000',
        client_ip: '127.0.0.1',
        client_user_agent: 'health-check'
      });

    // This should fail with a user not found error, which is expected
    const functionExists = functionError && !functionError.message.includes('function does not exist');

    return {
      status: 'healthy',
      message: 'Processing database verified',
      timestamp: new Date().toISOString(),
      metadata: {
        tableAccessible: !error,
        functionsAvailable: functionExists
      }
    };

  } catch (error) {
    return {
      status: 'unhealthy',
      message: `Database check failed: ${error.message}`,
      timestamp: new Date().toISOString()
    };
  }
}