import { createClient } from '@supabase/supabase-js';
import { processingQueue } from '../src/lib/documentai.js';
import { withRateLimit, RateLimitConfigs } from '../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../src/lib/securityHeaders.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyUserAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }
  
  return user;
}

async function processingQueueHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    let user;
    try {
      user = await verifyUserAuth(authHeader);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token'
      });
    }

    if (req.method === 'GET') {
      // Get processing job status
      const { jobId } = req.query;
      
      if (!jobId) {
        return res.status(400).json({
          error: 'Missing job ID',
          message: 'Job ID is required to check status'
        });
      }

      const jobStatus = processingQueue.getStatus(jobId);
      
      if (!jobStatus) {
        return res.status(404).json({
          error: 'Job not found',
          message: 'No processing job found with the specified ID'
        });
      }

      // Verify user owns this job
      if (jobStatus.userId !== user.id) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You do not have permission to view this job'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          id: jobStatus.id,
          status: jobStatus.status,
          progress: jobStatus.progress || 0,
          filename: jobStatus.filename,
          createdAt: jobStatus.createdAt,
          startedAt: jobStatus.startedAt,
          completedAt: jobStatus.completedAt,
          errorMessage: jobStatus.errorMessage,
          retryCount: jobStatus.retryCount
        }
      });

    } else if (req.method === 'POST') {
      // Create new processing job
      const { filename, priority = 'normal' } = req.body;
      
      if (!filename) {
        return res.status(400).json({
          error: 'Missing filename',
          message: 'Filename is required to create processing job'
        });
      }

      // Validate priority
      if (!['low', 'normal', 'high'].includes(priority)) {
        return res.status(400).json({
          error: 'Invalid priority',
          message: 'Priority must be one of: low, normal, high'
        });
      }

      const jobId = processingQueue.addJob({
        userId: user.id,
        filename,
        priority
      });

      res.status(201).json({
        success: true,
        data: {
          jobId,
          status: 'pending',
          message: 'Processing job created successfully'
        }
      });

    } else {
      res.status(405).json({
        error: 'Method not allowed',
        message: 'Only GET and POST methods are supported'
      });
    }

  } catch (error) {
    console.error('Processing queue API error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export with security middleware
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'processing-queue')(processingQueueHandler)
);