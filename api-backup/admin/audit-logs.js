import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RateLimitConfigs } from '../../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../../src/lib/securityHeaders.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Admin user verification
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
  
  if (!ADMIN_USER_IDS.includes(user.id)) {
    throw new Error('Insufficient permissions');
  }
  
  return user;
}

async function auditLogsHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Verify admin authentication
    const authHeader = req.headers.authorization;
    let adminUser;
    try {
      adminUser = await verifyAdminAuth(authHeader);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Admin access required'
      });
    }
    
    switch (req.method) {
      case 'GET':
        return handleGetAuditLogs(req, res);
      case 'POST':
        return handleCreateAuditLog(req, res, adminUser);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
  } catch (error) {
    console.error('Audit logs error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process audit logs request'
    });
  }
}

async function handleGetAuditLogs(req, res) {
  try {
    const { 
      type, 
      user_id, 
      action, 
      date_from, 
      date_to, 
      page = 1, 
      limit = 50,
      severity,
      search
    } = req.query;
    
    // Build the base query
    let query = supabase
      .from('admin_audit_logs')
      .select(`
        *,
        admin_user:admin_user_id(email),
        target_user:target_user_id(email)
      `, { count: 'exact' })
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (type) {
      query = query.eq('log_type', type);
    }
    
    if (user_id) {
      query = query.or(`admin_user_id.eq.${user_id},target_user_id.eq.${user_id}`);
    }
    
    if (action) {
      query = query.ilike('action', `%${action}%`);
    }
    
    if (date_from) {
      query = query.gte('created_at', date_from);
    }
    
    if (date_to) {
      query = query.lte('created_at', date_to);
    }
    
    if (severity) {
      query = query.eq('severity', severity);
    }
    
    if (search) {
      query = query.or(`action.ilike.%${search}%,details.ilike.%${search}%,resource.ilike.%${search}%`);
    }
    
    // Apply pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);
    query = query.range(offset, offset + parseInt(limit) - 1);
    
    const { data: logs, error, count } = await query;
    
    if (error) throw error;
    
    // Get summary statistics
    const stats = await getAuditLogsSummary(date_from, date_to);
    
    res.status(200).json({
      logs: logs || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count || 0,
        pages: Math.ceil((count || 0) / parseInt(limit))
      },
      summary: stats
    });
    
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    res.status(500).json({ error: 'Failed to fetch audit logs' });
  }
}

async function handleCreateAuditLog(req, res, adminUser) {
  try {
    const {
      log_type,
      action,
      resource,
      target_user_id,
      severity = 'info',
      details,
      metadata
    } = req.body;
    
    // Validate required fields
    if (!log_type || !action) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'log_type and action are required'
      });
    }
    
    // Create audit log entry
    const auditLog = {
      log_type,
      action,
      resource: resource || null,
      admin_user_id: adminUser.id,
      target_user_id: target_user_id || null,
      severity,
      details: details || null,
      metadata: metadata || null,
      ip_address: getClientIP(req),
      user_agent: req.headers['user-agent'] || null,
      created_at: new Date().toISOString()
    };
    
    const { data, error } = await supabase
      .from('admin_audit_logs')
      .insert(auditLog)
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      success: true,
      audit_log: data
    });
    
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ error: 'Failed to create audit log' });
  }
}

async function getAuditLogsSummary(dateFrom, dateTo) {
  try {
    // Build date filter
    let query = supabase.from('admin_audit_logs').select('*');
    
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }
    
    const { data: allLogs } = await query;
    
    if (!allLogs) return null;
    
    // Calculate summary statistics
    const summary = {
      total_logs: allLogs.length,
      by_type: {},
      by_severity: {},
      by_action: {},
      unique_admins: new Set(),
      unique_targets: new Set(),
      date_range: {
        from: dateFrom,
        to: dateTo
      }
    };
    
    allLogs.forEach(log => {
      // Count by type
      summary.by_type[log.log_type] = (summary.by_type[log.log_type] || 0) + 1;
      
      // Count by severity
      summary.by_severity[log.severity] = (summary.by_severity[log.severity] || 0) + 1;
      
      // Count by action (top 10)
      summary.by_action[log.action] = (summary.by_action[log.action] || 0) + 1;
      
      // Track unique users
      if (log.admin_user_id) summary.unique_admins.add(log.admin_user_id);
      if (log.target_user_id) summary.unique_targets.add(log.target_user_id);
    });
    
    // Convert sets to counts
    summary.unique_admins = summary.unique_admins.size;
    summary.unique_targets = summary.unique_targets.size;
    
    // Get top 10 actions
    summary.top_actions = Object.entries(summary.by_action)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([action, count]) => ({ action, count }));
    
    return summary;
    
  } catch (error) {
    console.error('Error getting audit logs summary:', error);
    return null;
  }
}

// Helper function to get client IP
function getClientIP(req) {
  return req.headers['cf-connecting-ip'] ||
         req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         '127.0.0.1';
}

// Export with security headers and rate limiting
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'admin-audit')(auditLogsHandler)
);