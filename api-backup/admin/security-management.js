import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RateLimitConfigs, IPManagement } from '../../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../../src/lib/securityHeaders.js';

// Initialize Supabase client with service role key
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Admin user IDs (configure these in environment variables)
const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || '').split(',').filter(id => id.trim());

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
  if (!ADMIN_USER_IDS.includes(user.id)) {
    throw new Error('Insufficient permissions');
  }
  
  return user;
}

async function securityManagementHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Verify admin authentication
    const authHeader = req.headers.authorization;
    try {
      await verifyAdminAuth(authHeader);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin access required'
      });
    }
    
    const { action, ip } = req.method === 'GET' ? req.query : req.body;
    
    switch (req.method) {
      case 'GET':
        return handleGetSecurityStats(req, res);
      case 'POST':
        return handleSecurityAction(req, res, action, ip);
      case 'DELETE':
        return handleRemoveFromList(req, res, action, ip);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Security management error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process security management request'
    });
  }
}

async function handleGetSecurityStats(req, res) {
  try {
    const stats = IPManagement.getStats();
    
    // Get recent security logs from database (if implemented)
    const { data: recentLogs, error: logsError } = await supabase
      .from('security_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    const response = {
      stats,
      recentLogs: recentLogs || [],
      timestamp: new Date().toISOString()
    };
    
    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting security stats:', error);
    res.status(500).json({ error: 'Failed to retrieve security statistics' });
  }
}

async function handleSecurityAction(req, res, action, ip) {
  if (!action || !ip) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Action and IP address are required'
    });
  }
  
  // Validate IP address format
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return res.status(400).json({
      error: 'Invalid IP address',
      message: 'Please provide a valid IPv4 address'
    });
  }
  
  let message;
  switch (action) {
    case 'blacklist':
      IPManagement.addToBlacklist(ip);
      message = `IP ${ip} added to blacklist`;
      await logSecurityAction('blacklist_add', ip, req);
      break;
      
    case 'whitelist':
      IPManagement.addToWhitelist(ip);
      message = `IP ${ip} added to whitelist`;
      await logSecurityAction('whitelist_add', ip, req);
      break;
      
    default:
      return res.status(400).json({
        error: 'Invalid action',
        message: 'Supported actions: blacklist, whitelist'
      });
  }
  
  res.status(200).json({
    success: true,
    message,
    stats: IPManagement.getStats()
  });
}

async function handleRemoveFromList(req, res, action, ip) {
  if (!action || !ip) {
    return res.status(400).json({
      error: 'Missing parameters',
      message: 'Action and IP address are required'
    });
  }
  
  let message;
  switch (action) {
    case 'blacklist':
      IPManagement.removeFromBlacklist(ip);
      message = `IP ${ip} removed from blacklist`;
      await logSecurityAction('blacklist_remove', ip, req);
      break;
      
    case 'whitelist':
      IPManagement.removeFromWhitelist(ip);
      message = `IP ${ip} removed from whitelist`;
      await logSecurityAction('whitelist_remove', ip, req);
      break;
      
    default:
      return res.status(400).json({
        error: 'Invalid action',
        message: 'Supported actions: blacklist, whitelist'
      });
  }
  
  res.status(200).json({
    success: true,
    message,
    stats: IPManagement.getStats()
  });
}

async function logSecurityAction(action, ip, req) {
  try {
    const { data: user } = await supabase.auth.getUser(
      req.headers.authorization?.replace('Bearer ', '')
    );
    
    // Log to database (create security_logs table if it doesn't exist)
    await supabase
      .from('security_logs')
      .insert({
        action,
        target_ip: ip,
        admin_user_id: user?.user?.id,
        source_ip: getClientIP(req),
        user_agent: req.headers['user-agent'],
        created_at: new Date().toISOString()
      });
  } catch (error) {
    console.error('Failed to log security action:', error);
    // Don't fail the main request if logging fails
  }
}

function getClientIP(req) {
  return req.headers['cf-connecting-ip'] ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

// Export with security headers and rate limiting for admin endpoints
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'admin-security')(securityManagementHandler)
);