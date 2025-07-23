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
    
    // Parse query parameters
    const { 
      page = 0, 
      limit = 20, 
      action = null 
    } = req.query;
    
    // Validate parameters
    const pageNum = Math.max(0, parseInt(page) || 0);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const offset = pageNum * limitNum;
    
    // Valid action filters
    const validActions = ['page_processed', 'limit_exceeded', 'subscription_changed'];
    const actionFilter = action && validActions.includes(action) ? action : null;
    
    // Get paginated usage history
    const { data: history, error } = await supabase.rpc('get_user_usage_history', {
      user_uuid: user.id,
      page_limit: limitNum,
      page_offset: offset,
      action_filter: actionFilter
    });
    
    if (error) {
      console.error('Error fetching usage history:', error);
      return res.status(500).json({
        error: 'Failed to fetch usage history',
        message: error.message
      });
    }
    
    // Return paginated history
    res.status(200).json({
      success: true,
      data: history
    });
    
  } catch (error) {
    console.error('API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching usage history'
    });
  }
}