import formidable from 'formidable';
import { createClient } from '@supabase/supabase-js';
import { processDocument, processDocumentWithOCR, validateFile, handleProcessingError } from '../../src/lib/documentai.js';
import { validateFileSecurity } from '../../src/lib/security.js';
import { withRateLimit, RateLimitConfigs } from '../../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../../src/lib/securityHeaders.js';
import crypto from 'crypto';
import fs from 'fs';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

async function verifyApiKey(apiKey) {
  if (!apiKey || !apiKey.startsWith('pdftxt_')) {
    throw new Error('Invalid API key format');
  }
  
  const hashedKey = hashApiKey(apiKey);
  const { data: keyData, error } = await supabase
    .from('api_keys')
    .select('id, user_id, name, usage_count, is_active')
    .eq('key_hash', hashedKey)
    .eq('is_active', true)
    .single();
  
  if (error || !keyData) {
    throw new Error('Invalid or inactive API key');
  }
  
  return keyData;
}

async function updateApiKeyUsage(keyId) {
  await supabase.rpc('increment_api_key_usage', {
    key_id: keyId,
    last_used_at: new Date().toISOString()
  });
}

async function checkApiRateLimit(userId, keyId) {
  // Check usage limits based on subscription
  const { data: userPlan, error } = await supabase.rpc('get_user_plan_limits', {
    user_uuid: userId
  });
  
  if (error) {
    throw new Error('Failed to check usage limits');
  }
  
  // API-specific rate limits
  const apiLimits = {
    free: { requestsPerHour: 60, requestsPerDay: 500 },
    pro: { requestsPerHour: 600, requestsPerDay: 10000 }
  };
  
  const plan = userPlan?.subscription_plan === 'pro' ? 'pro' : 'free';
  const limits = apiLimits[plan];
  
  // Check hourly limit
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: hourlyCount } = await supabase
    .from('api_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyId)
    .gte('created_at', hourAgo);
  
  if (hourlyCount >= limits.requestsPerHour) {
    throw new Error(`Hourly API limit exceeded (${limits.requestsPerHour} requests/hour)`);
  }
  
  // Check daily limit
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabase
    .from('api_usage_logs')
    .select('*', { count: 'exact', head: true })
    .eq('api_key_id', keyId)
    .gte('created_at', dayAgo);
  
  if (dailyCount >= limits.requestsPerDay) {
    throw new Error(`Daily API limit exceeded (${limits.requestsPerDay} requests/day)`);
  }
  
  return { plan, limits, hourlyUsage: hourlyCount, dailyUsage: dailyCount };
}

async function logApiUsage(keyId, userId, endpoint, processingTime, pages, success, errorMessage = null) {
  await supabase
    .from('api_usage_logs')
    .insert({
      api_key_id: keyId,
      user_id: userId,
      endpoint,
      processing_time: processingTime,
      pages_processed: pages,
      success,
      error_message: errorMessage,
      created_at: new Date().toISOString()
    });
}

async function processHandler(req, res) {
  const startTime = Date.now();
  let apiKeyData = null;
  let processingPages = 0;
  
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'POST') {
    return res.status(405).json({
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }
  
  try {
    // Verify API key
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return res.status(401).json({
        error: 'Missing API key',
        message: 'X-API-Key header is required'
      });
    }
    
    apiKeyData = await verifyApiKey(apiKey);
    
    // Check rate limits
    const rateLimitInfo = await checkApiRateLimit(apiKeyData.user_id, apiKeyData.id);
    
    // Parse form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      maxFields: 15,
      maxFieldsSize: 2 * 1024 * 1024,
      allowEmptyFiles: false,
      minFileSize: 1024,
    });
    
    const [fields, files] = await form.parse(req);
    
    // Validate file upload
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile) {
      await logApiUsage(apiKeyData.id, apiKeyData.user_id, 'process', Date.now() - startTime, 0, false, 'No file uploaded');
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please provide a PDF file to process'
      });
    }
    
    // Read and validate file
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const filename = uploadedFile.originalFilename || 'document.pdf';
    
    const validation = validateFile(fileBuffer, filename);
    if (!validation.valid) {
      await logApiUsage(apiKeyData.id, apiKeyData.user_id, 'process', Date.now() - startTime, 0, false, validation.error);
      return res.status(400).json({
        error: 'Invalid file',
        message: validation.error
      });
    }
    
    // Security validation
    const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const securityValidation = await validateFileSecurity(fileBuffer, filename, clientIP);
    if (!securityValidation.safe) {
      await logApiUsage(apiKeyData.id, apiKeyData.user_id, 'process', Date.now() - startTime, 0, false, 'Security validation failed');
      return res.status(422).json({
        error: 'Security validation failed',
        message: 'File failed security validation'
      });
    }
    
    // Process document
    const enableAdvancedOCR = fields.enableAdvancedOCR?.[0] === 'true';
    const enableFormParsing = fields.enableFormParsing?.[0] === 'true';
    const includeMetadata = fields.includeMetadata?.[0] !== 'false'; // Default true
    
    let processedDoc;
    try {
      if (enableAdvancedOCR || enableFormParsing) {
        processedDoc = await processDocumentWithOCR(fileBuffer, enableFormParsing);
      } else {
        processedDoc = await processDocument(fileBuffer);
      }
      processingPages = processedDoc.pages;
    } catch (processingError) {
      console.error('Document processing error:', processingError);
      const enhancedError = handleProcessingError(processingError);
      await logApiUsage(apiKeyData.id, apiKeyData.user_id, 'process', Date.now() - startTime, 0, false, enhancedError.message);
      
      return res.status(422).json({
        error: enhancedError.code,
        message: enhancedError.message,
        retryable: ['NETWORK_ERROR', 'TIMEOUT', 'QUOTA_EXCEEDED'].includes(enhancedError.code)
      });
    }
    
    // Update API key usage
    await updateApiKeyUsage(apiKeyData.id);
    
    // Log successful usage
    const processingTime = Date.now() - startTime;
    await logApiUsage(apiKeyData.id, apiKeyData.user_id, 'process', processingTime, processingPages, true);
    
    // Clean up temporary file
    try {
      fs.unlinkSync(uploadedFile.filepath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary file:', cleanupError);
    }
    
    // Prepare response
    const responseData = {
      text: processedDoc.text,
      pages: processedDoc.pages,
      confidence: processedDoc.confidence,
      processingTime: processedDoc.processingTime
    };
    
    // Add metadata if requested
    if (includeMetadata) {
      responseData.metadata = {
        language: processedDoc.language,
        ocrQuality: processedDoc.ocrQuality,
        entities: processedDoc.entities,
        structure: processedDoc.structure,
        mathematics: processedDoc.mathematics,
        images: processedDoc.images,
        formatting: processedDoc.formatting,
        forms: processedDoc.forms
      };
    }
    
    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit-Hourly', rateLimitInfo.limits.requestsPerHour);
    res.setHeader('X-RateLimit-Remaining-Hourly', rateLimitInfo.limits.requestsPerHour - rateLimitInfo.hourlyUsage - 1);
    res.setHeader('X-RateLimit-Limit-Daily', rateLimitInfo.limits.requestsPerDay);
    res.setHeader('X-RateLimit-Remaining-Daily', rateLimitInfo.limits.requestsPerDay - rateLimitInfo.dailyUsage - 1);
    res.setHeader('X-User-Plan', rateLimitInfo.plan);
    
    res.status(200).json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('API error:', error);
    
    // Log failed usage if we have API key data
    if (apiKeyData) {
      await logApiUsage(apiKeyData.id, apiKeyData.user_id, 'process', Date.now() - startTime, processingPages, false, error.message);
    }
    
    // Clean up temporary files on error
    try {
      const form = formidable();
      const [, files] = await form.parse(req);
      const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
      if (uploadedFile && fs.existsSync(uploadedFile.filepath)) {
        fs.unlinkSync(uploadedFile.filepath);
      }
    } catch (cleanupError) {
      console.warn('Cleanup error:', cleanupError);
    }
    
    if (error.message.includes('API limit') || error.message.includes('rate limit')) {
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: error.message
      });
    } else if (error.message.includes('Invalid API key') || error.message.includes('Missing API key')) {
      res.status(401).json({
        error: 'Unauthorized',
        message: error.message
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: 'An unexpected error occurred while processing your request'
      });
    }
  }
}

export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.API, 'api-process')(processHandler)
);