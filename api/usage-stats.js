import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client with service role key for server operations
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

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported' 
    });
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
    
    // Get comprehensive usage statistics
    const { data: stats, error } = await supabase.rpc('get_user_usage_stats', {
      user_uuid: user.id
    });
    
    if (error) {
      console.error('Error fetching usage stats:', error);
      return res.status(500).json({
        error: 'Failed to fetch usage statistics',
        message: error.message
      });
    }
    
    // Get usage alerts
    const { data: alerts, error: alertsError } = await supabase.rpc('check_usage_alerts', {
      user_uuid: user.id
    });
    
    if (alertsError) {
      console.warn('Error fetching usage alerts:', alertsError);
    }
    
    // Return comprehensive statistics
    res.status(200).json({
      success: true,
      data: {
        ...stats,
        alerts: alerts || { alert_count: 0, alerts: [] }
      }
    });
    
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching usage statistics'
    });
  }
}