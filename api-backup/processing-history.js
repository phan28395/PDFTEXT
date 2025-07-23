import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute per IP

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, DELETE, OPTIONS');
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
        message: 'Too many requests. Please try again later.',
        retryAfter: 60
      });
    }
    
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
      // Get processing history
      const { page = '1', limit = '10', status, search } = req.query;
      const pageNum = parseInt(page);
      const limitNum = Math.min(parseInt(limit), 50); // Max 50 items per page
      const offset = (pageNum - 1) * limitNum;
      
      let query = supabase
        .from('processing_history')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      // Apply filters
      if (status && status !== 'all') {
        query = query.eq('status', status);
      }
      
      if (search) {
        query = query.ilike('filename', `%${search}%`);
      }
      
      // Add pagination
      query = query.range(offset, offset + limitNum - 1);
      
      const { data: records, error, count } = await query;
      
      if (error) {
        console.error('Error fetching processing history:', error);
        return res.status(500).json({
          error: 'Database error',
          message: 'Failed to fetch processing history'
        });
      }
      
      // Get total count for pagination
      let totalCount = count;
      if (totalCount === null) {
        const { count: totalCountResult } = await supabase
          .from('processing_history')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id);
        totalCount = totalCountResult || 0;
      }
      
      const totalPages = Math.ceil(totalCount / limitNum);
      
      res.status(200).json({
        success: true,
        data: {
          records: records || [],
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: totalCount,
            totalPages,
            hasNext: pageNum < totalPages,
            hasPrev: pageNum > 1
          }
        }
      });
      
    } else if (req.method === 'DELETE') {
      // Delete a specific processing record
      const { recordId } = req.query;
      
      if (!recordId) {
        return res.status(400).json({
          error: 'Missing record ID',
          message: 'Record ID is required for deletion'
        });
      }
      
      // Verify the record belongs to the user
      const { data: record, error: fetchError } = await supabase
        .from('processing_history')
        .select('id, user_id')
        .eq('id', recordId)
        .eq('user_id', user.id)
        .single();
        
      if (fetchError || !record) {
        return res.status(404).json({
          error: 'Record not found',
          message: 'Processing record not found or access denied'
        });
      }
      
      // Delete the record
      const { error: deleteError } = await supabase
        .from('processing_history')
        .delete()
        .eq('id', recordId)
        .eq('user_id', user.id);
        
      if (deleteError) {
        console.error('Error deleting processing record:', deleteError);
        return res.status(500).json({
          error: 'Delete failed',
          message: 'Failed to delete processing record'
        });
      }
      
      res.status(200).json({
        success: true,
        message: 'Processing record deleted successfully'
      });
      
    } else {
      res.status(405).json({
        error: 'Method not allowed',
        message: `Method ${req.method} is not supported`
      });
    }
    
  } catch (error) {
    console.error('Processing history API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}