import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RateLimitConfigs } from '../../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../../src/lib/securityHeaders.js';
import crypto from 'crypto';

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

function generateApiKey() {
  const prefix = 'pdftxt_';
  const randomPart = crypto.randomBytes(32).toString('hex');
  return prefix + randomPart;
}

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function apiKeysHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    // Verify authentication
    const authHeader = req.headers.authorization;
    const user = await verifyUserAuth(authHeader);
    
    switch (req.method) {
      case 'GET':
        return await handleGetApiKeys(req, res, user);
      case 'POST':
        return await handleCreateApiKey(req, res, user);
      case 'DELETE':
        return await handleDeleteApiKey(req, res, user);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('API Keys error:', error);
    res.status(401).json({
      error: 'Unauthorized',
      message: error.message
    });
  }
}

async function handleGetApiKeys(req, res, user) {
  const { data: apiKeys, error } = await supabase
    .from('api_keys')
    .select('id, name, created_at, last_used_at, usage_count, is_active')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error fetching API keys:', error);
    return res.status(500).json({
      error: 'Failed to fetch API keys',
      message: 'An error occurred while retrieving your API keys'
    });
  }
  
  res.json({
    success: true,
    data: { apiKeys }
  });
}

async function handleCreateApiKey(req, res, user) {
  const { name, description } = req.body;
  
  if (!name || name.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid input',
      message: 'API key name is required'
    });
  }
  
  // Check API key limits
  const { count: existingCount } = await supabase
    .from('api_keys')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);
  
  const maxKeys = 10; // Limit per user
  if (existingCount >= maxKeys) {
    return res.status(400).json({
      error: 'API key limit reached',
      message: `You can have a maximum of ${maxKeys} active API keys`
    });
  }
  
  // Generate new API key
  const apiKey = generateApiKey();
  const hashedKey = hashApiKey(apiKey);
  
  const { data: newApiKey, error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description?.trim() || '',
      key_hash: hashedKey,
      created_at: new Date().toISOString(),
      is_active: true,
      usage_count: 0
    })
    .select('id, name, created_at, is_active')
    .single();
  
  if (error) {
    console.error('Error creating API key:', error);
    return res.status(500).json({
      error: 'Failed to create API key',
      message: 'An error occurred while creating your API key'
    });
  }
  
  res.status(201).json({
    success: true,
    data: {
      apiKey: {
        ...newApiKey,
        key: apiKey // Only return the actual key once during creation
      }
    }
  });
}

async function handleDeleteApiKey(req, res, user) {
  const { keyId } = req.query;
  
  if (!keyId) {
    return res.status(400).json({
      error: 'Missing parameter',
      message: 'API key ID is required'
    });
  }
  
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false, deleted_at: new Date().toISOString() })
    .eq('id', keyId)
    .eq('user_id', user.id);
  
  if (error) {
    console.error('Error deleting API key:', error);
    return res.status(500).json({
      error: 'Failed to delete API key',
      message: 'An error occurred while deleting your API key'
    });
  }
  
  res.json({
    success: true,
    message: 'API key deleted successfully'
  });
}

export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.AUTH, 'api-keys')(apiKeysHandler)
);