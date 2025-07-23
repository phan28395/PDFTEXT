import { createClient } from '@supabase/supabase-js';
import { Parser } from 'json2csv';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Rate limiting
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10; // 10 export requests per minute per IP

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

function formatProcessingTime(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function prepareDataForExport(records, format) {
  const exportData = records.map(record => ({
    id: record.id,
    filename: record.filename,
    status: record.status,
    pages_processed: record.pages_processed || 0,
    processing_time: record.processing_time ? formatProcessingTime(record.processing_time) : 'N/A',
    created_at: new Date(record.created_at).toISOString(),
    completed_at: record.completed_at ? new Date(record.completed_at).toISOString() : null,
    error_message: record.error_message || '',
    file_size: record.file_size || 0,
    text_length: record.text_content ? record.text_content.length : 0,
    has_text_content: !!record.text_content
  }));

  if (format === 'csv') {
    const fields = [
      'id',
      'filename', 
      'status',
      'pages_processed',
      'processing_time',
      'created_at',
      'completed_at',
      'error_message',
      'file_size',
      'text_length',
      'has_text_content'
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(exportData);
  }
  
  return JSON.stringify(exportData, null, 2);
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
      message: `Method ${req.method} is not supported`
    });
  }
  
  try {
    // Rate limiting
    const clientIP = getClientIP(req);
    if (!checkRateLimit(clientIP)) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many export requests. Please try again later.',
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
    
    // Get query parameters
    const { 
      format = 'json', 
      status, 
      search, 
      start_date, 
      end_date,
      include_text = 'false' 
    } = req.query;
    
    // Validate format
    if (!['json', 'csv'].includes(format)) {
      return res.status(400).json({
        error: 'Invalid format',
        message: 'Format must be either "json" or "csv"'
      });
    }
    
    // Build query
    let query = supabase
      .from('processing_history')
      .select(include_text === 'true' ? '*' : '*, text_content')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }
    
    if (search) {
      query = query.ilike('filename', `%${search}%`);
    }
    
    if (start_date) {
      query = query.gte('created_at', start_date);
    }
    
    if (end_date) {
      query = query.lte('created_at', end_date);
    }
    
    // Limit to prevent abuse (max 1000 records)
    query = query.limit(1000);
    
    const { data: records, error } = await query;
    
    if (error) {
      console.error('Error fetching processing history for export:', error);
      return res.status(500).json({
        error: 'Database error',
        message: 'Failed to fetch processing history for export'
      });
    }
    
    if (!records || records.length === 0) {
      return res.status(404).json({
        error: 'No data found',
        message: 'No processing history found matching your criteria'
      });
    }
    
    // Remove text content for export unless specifically requested
    if (include_text !== 'true') {
      records.forEach(record => {
        delete record.text_content;
      });
    }
    
    // Prepare export data
    const exportContent = prepareDataForExport(records, format);
    
    // Set appropriate headers for download
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `processing-history-${timestamp}.${format}`;
    
    res.setHeader('Content-Type', format === 'csv' ? 'text/csv' : 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('X-Total-Records', records.length.toString());
    
    res.status(200).send(exportContent);
    
  } catch (error) {
    console.error('Export history API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred during export',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}