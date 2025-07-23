import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 5; // 5 cleanup requests per minute per IP

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimitMap.has(ip)) {
    rateLimitMap.set(ip, []);
  }
  
  const requests = rateLimitMap.get(ip);
  
  while (requests.length > 0 && requests[0] < windowStart) {
    requests.shift();
  }
  
  if (requests.length >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  
  requests.push(now);
  return true;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for'] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

async function verifyAdminAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }
  
  // Check if user is admin
  const { data: userData, error: userError } = await supabase
    .from('users')
    .select('is_admin, email')
    .eq('id', user.id)
    .single();
    
  if (userError || !userData) {
    throw new Error('User not found');
  }
  
  if (!userData.is_admin && !userData.email?.includes('@admin.')) {
    throw new Error('Admin privileges required');
  }
  
  return user;
}

export default async function handler(req, res) {
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
    // Rate limiting
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many cleanup requests. Please try again later.',
        retryAfter: 60
      });
    }
    
    // Verify admin authentication
    const authHeader = req.headers.authorization;
    let adminUser;
    try {
      adminUser = await verifyAdminAuth(authHeader);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: authError.message
      });
    }
    
    if (req.method === 'GET') {
      const { action = 'stats' } = req.query;
      
      if (action === 'stats') {
        // Get cleanup statistics
        const { data: stats, error: statsError } = await supabase
          .rpc('get_processing_history_cleanup_stats');
          
        if (statsError) {
          console.error('Error getting cleanup stats:', statsError);
          return res.status(500).json({
            error: 'Database error',
            message: 'Failed to get cleanup statistics'
          });
        }
        
        // Get cleanup summary
        const { data: summary, error: summaryError } = await supabase
          .from('processing_history_cleanup_summary')
          .select('*')
          .single();
          
        if (summaryError) {
          console.error('Error getting cleanup summary:', summaryError);
          return res.status(500).json({
            error: 'Database error',
            message: 'Failed to get cleanup summary'
          });
        }
        
        res.status(200).json({
          success: true,
          data: {
            stats: stats?.[0] || {},
            summary: summary || {},
            current_time: new Date().toISOString()
          }
        });
        
      } else if (action === 'schedule') {
        // Check/run scheduled cleanup
        const { data: scheduleResult, error: scheduleError } = await supabase
          .rpc('schedule_processing_history_cleanup');
          
        if (scheduleError) {
          console.error('Error with scheduled cleanup:', scheduleError);
          return res.status(500).json({
            error: 'Database error',
            message: 'Failed to check scheduled cleanup'
          });
        }
        
        res.status(200).json({
          success: true,
          data: scheduleResult
        });
        
      } else {
        return res.status(400).json({
          error: 'Invalid action',
          message: 'Action must be "stats" or "schedule"'
        });
      }
      
    } else if (req.method === 'POST') {
      // Manual cleanup trigger
      const { retention_days = 365, force = false } = req.body;
      
      // Validate retention days
      if (typeof retention_days !== 'number' || retention_days < 30 || retention_days > 2555) {
        return res.status(400).json({
          error: 'Invalid retention days',
          message: 'Retention days must be between 30 and 2555 (7 years)'
        });
      }
      
      // Trigger manual cleanup
      const { data: cleanupResult, error: cleanupError } = await supabase
        .rpc('manual_processing_history_cleanup', {
          p_admin_user_id: adminUser.id,
          p_retention_days: retention_days,
          p_force: force
        });
        
      if (cleanupError) {
        console.error('Error with manual cleanup:', cleanupError);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to execute manual cleanup'
        });
      }
      
      if (!cleanupResult?.success) {
        return res.status(403).json({
          error: 'Cleanup failed',
          message: cleanupResult?.error || 'Unknown error during cleanup'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Manual cleanup executed successfully',
        data: cleanupResult
      });
      
    } else {
      res.status(405).json({
        error: 'Method not allowed',
        message: `Method ${req.method} is not supported`
      });
    }
    
  } catch (error) {
    console.error('Processing cleanup API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}