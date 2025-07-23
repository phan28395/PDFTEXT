import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Simple authentication check for cron jobs
function verifyCronAuth(req) {
  const authHeader = req.headers.authorization;
  const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-in-production';
  
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    throw new Error('Invalid cron authentication');
  }
}

export default async function handler(req, res) {
  // Only allow POST requests for cron execution
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are allowed for cron jobs'
    });
  }
  
  try {
    // Verify cron authentication
    try {
      verifyCronAuth(req);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid cron authentication token'
      });
    }
    
    const { task = 'cleanup' } = req.body;
    
    if (task === 'cleanup') {
      // Run scheduled processing history cleanup
      console.log('Running scheduled processing history cleanup...');
      
      const { data: cleanupResult, error: cleanupError } = await supabase
        .rpc('schedule_processing_history_cleanup');
        
      if (cleanupError) {
        console.error('Scheduled cleanup error:', cleanupError);
        return res.status(500).json({
          error: 'Cleanup failed',
          message: cleanupError.message,
          details: cleanupError
        });
      }
      
      console.log('Scheduled cleanup completed:', cleanupResult);
      
      // Also run other cleanup tasks
      const cleanupTasks = [];
      
      // Cleanup expired batch outputs
      try {
        const { data: batchCleanup, error: batchError } = await supabase
          .rpc('cleanup_expired_batch_outputs');
          
        if (batchError) {
          console.error('Batch cleanup error:', batchError);
        } else {
          cleanupTasks.push({
            task: 'batch_outputs',
            result: batchCleanup
          });
        }
      } catch (err) {
        console.error('Batch cleanup failed:', err);
      }
      
      // Cleanup old security logs
      try {
        const { data: securityCleanup, error: securityError } = await supabase
          .rpc('cleanup_old_security_logs');
          
        if (securityError) {
          console.error('Security logs cleanup error:', securityError);
        } else {
          cleanupTasks.push({
            task: 'security_logs',
            result: securityCleanup
          });
        }
      } catch (err) {
        console.error('Security logs cleanup failed:', err);
      }
      
      // Cleanup old error reports
      try {
        const { data: errorCleanup, error: errorError } = await supabase
          .rpc('cleanup_old_error_reports');
          
        if (errorError) {
          console.error('Error reports cleanup error:', errorError);
        } else {
          cleanupTasks.push({
            task: 'error_reports',
            result: errorCleanup
          });
        }
      } catch (err) {
        console.error('Error reports cleanup failed:', err);
      }
      
      res.status(200).json({
        success: true,
        message: 'Scheduled cleanup tasks completed',
        data: {
          processing_history: cleanupResult,
          additional_tasks: cleanupTasks,
          execution_time: new Date().toISOString()
        }
      });
      
    } else if (task === 'health-check') {
      // Simple health check for cron monitoring
      const { data: dbHealth, error: dbError } = await supabase
        .from('users')
        .select('count')
        .limit(1);
        
      if (dbError) {
        return res.status(500).json({
          error: 'Database health check failed',
          message: dbError.message
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Health check passed',
        data: {
          database: 'healthy',
          timestamp: new Date().toISOString()
        }
      });
      
    } else {
      return res.status(400).json({
        error: 'Invalid task',
        message: 'Task must be "cleanup" or "health-check"'
      });
    }
    
  } catch (error) {
    console.error('Cron scheduler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during scheduled task execution',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}