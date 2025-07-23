import formidable from 'formidable';
import { createClient } from '@supabase/supabase-js';
import { processDocument, processDocumentWithOCR, validateFile, handleProcessingError } from '../src/lib/documentai.js';
import { validateFileSecurity, sanitizeFilename, createSecureTempFilename } from '../src/lib/security.js';
import { withRateLimit, RateLimitConfigs, recordFailedRequest } from '../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs, validateRequestHeaders } from '../src/lib/securityHeaders.js';
import fs from 'fs';

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

async function atomicProcessUserPages(userId, pageCount, recordId, clientIP, userAgent) {
  const { data, error } = await supabase.rpc('atomic_update_user_pages_usage', {
    user_uuid: userId,
    pages_count: pageCount,
    processing_record_id: recordId,
    client_ip: clientIP,
    client_user_agent: userAgent
  });
  
  if (error) {
    console.error('Error updating user usage:', error);
    throw new Error('Failed to update usage statistics: ' + error.message);
  }
  
  return data;
}

async function saveProcessingRecord(userId, filename, pageCount, processingTime, processedDoc) {
  // Prepare the enhanced data for storage
  const recordData = {
    user_id: userId,
    filename,
    pages_processed: pageCount,
    processing_time: processingTime,
    status: 'completed',
    text_content: processedDoc.text,
    confidence_score: processedDoc.confidence,
    created_at: new Date().toISOString()
  };

  // Add enhanced content as JSON if available
  if (processedDoc.structure || processedDoc.mathematics || processedDoc.images || processedDoc.formatting) {
    recordData.extracted_content = {
      structure: processedDoc.structure,
      mathematics: processedDoc.mathematics,
      images: processedDoc.images,
      formatting: processedDoc.formatting,
      entities: processedDoc.entities
    };
  }

  const { data, error } = await supabase
    .from('processing_history')
    .insert(recordData)
    .select()
    .single();
    
  if (error) {
    console.error('Error saving processing record:', error);
    throw new Error('Failed to save processing record');
  }
  
  return data;
}

async function processPDFHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
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
    // Validate request headers for security threats
    const headerValidation = validateRequestHeaders(req);
    if (!headerValidation.valid) {
      console.warn('Suspicious request headers detected:', headerValidation.issues);
      recordFailedRequest(req, 'process-pdf', RateLimitConfigs.PROCESSING);
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Request contains suspicious content'
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
    
    // Parse form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      maxFields: 10,
      maxFieldsSize: 2 * 1024 * 1024, // 2MB for fields
      allowEmptyFiles: false,
      minFileSize: 1024, // 1KB minimum
    });
    
    const [fields, files] = await form.parse(req);
    
    // Validate file upload
    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a PDF file to process'
      });
    }
    
    // Read file buffer
    const fileBuffer = fs.readFileSync(uploadedFile.filepath);
    const filename = uploadedFile.originalFilename || 'document.pdf';
    
    // Validate file format and content
    const validation = validateFile(fileBuffer, filename);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid file',
        message: validation.error
      });
    }

    // Security scanning and validation
    const securityValidation = await validateFileSecurity(fileBuffer, filename, clientIP);
    if (!securityValidation.safe) {
      console.warn('Security validation failed:', securityValidation.errors);
      return res.status(422).json({
        error: 'Security validation failed',
        message: 'File failed security validation',
        details: securityValidation.errors
      });
    }

    // Log security warnings if any
    if (securityValidation.warnings.length > 0) {
      console.warn('Security warnings for file:', filename, securityValidation.warnings);
    }
    
    // Check for advanced processing options
    const enableAdvancedOCR = fields.enableAdvancedOCR?.[0] === 'true';
    const enableFormParsing = fields.enableFormParsing?.[0] === 'true';
    
    // Process document to get page count first (for usage checking)
    let processedDoc;
    try {
      if (enableAdvancedOCR || enableFormParsing) {
        processedDoc = await processDocumentWithOCR(fileBuffer, enableFormParsing);
      } else {
        processedDoc = await processDocument(fileBuffer);
      }
    } catch (processingError) {
      console.error('Document processing error:', processingError);
      
      // Use enhanced error handling
      const enhancedError = handleProcessingError(processingError);
      
      return res.status(422).json({
        error: enhancedError.code,
        message: enhancedError.message,
        details: process.env.NODE_ENV === 'development' ? enhancedError.details : undefined,
        retryable: ['NETWORK_ERROR', 'TIMEOUT', 'QUOTA_EXCEEDED'].includes(enhancedError.code)
      });
    }
    
    // Save processing record first to get ID
    const record = await saveProcessingRecord(
      user.id,
      filename,
      processedDoc.pages,
      processedDoc.processingTime,
      processedDoc
    );
    
    // Atomically update user usage with race condition protection
    const usageResult = await atomicProcessUserPages(
      user.id, 
      processedDoc.pages, 
      record.id,
      clientIP,
      req.headers['user-agent'] || 'Unknown'
    );
    
    // Check if usage update was successful
    if (!usageResult.success) {
      // Delete the processing record since we couldn't update usage
      await supabase
        .from('processing_history')
        .delete()
        .eq('id', record.id);
        
      return res.status(403).json({
        error: usageResult.error,
        message: usageResult.message,
        usage: {
          current: usageResult.pages_used_before || 0,
          limit: usageResult.error === 'monthly_limit_exceeded' ? 1000 : 10,
          remaining: Math.max(0, (usageResult.error === 'monthly_limit_exceeded' ? 1000 : 10) - (usageResult.pages_used_before || 0)),
          requested: processedDoc.pages,
          subscription_plan: usageResult.subscription_plan,
          period_end: usageResult.period_end
        }
      });
    }
    
    // Track Document AI cost for this processing
    try {
      const costPerPage = 0.015; // Document AI pricing
      const totalCost = processedDoc.pages * costPerPage;
      
      await supabase.rpc('track_api_cost', {
        p_user_id: user.id,
        p_service: 'document-ai',
        p_operation: 'process-document',
        p_cost_amount: totalCost,
        p_units_consumed: processedDoc.pages,
        p_unit_type: 'pages',
        p_processing_record_id: record.id,
        p_metadata: {
          filename: filename,
          confidence: processedDoc.confidence,
          processing_time: processedDoc.processingTime,
          cost_per_page: costPerPage
        }
      });
    } catch (costError) {
      console.error('Failed to track processing cost:', costError);
      // Don't fail the request if cost tracking fails
    }
    
    // Clean up temporary file
    try {
      fs.unlinkSync(uploadedFile.filepath);
    } catch (cleanupError) {
      console.warn('Failed to cleanup temporary file:', cleanupError);
    }
    
    // Return successful response with detailed usage info and extracted content
    const responseData = {
      recordId: record.id,
      filename,
      text: processedDoc.text,
      pages: processedDoc.pages,
      confidence: processedDoc.confidence,
      processingTime: processedDoc.processingTime,
      language: processedDoc.language,
      ocrQuality: processedDoc.ocrQuality,
      entities: processedDoc.entities,
      structure: processedDoc.structure,
      mathematics: processedDoc.mathematics,
      images: processedDoc.images,
      formatting: processedDoc.formatting,
      forms: processedDoc.forms,
      usage: {
        pages_processed: processedDoc.pages,
        pages_used_before: usageResult.pages_used_before,
        pages_used_after: usageResult.pages_used_after,
        subscription_plan: usageResult.subscription_plan,
        subscription_status: usageResult.subscription_status
      }
    };
    
    // Add plan-specific usage details
    if (usageResult.pages_used_this_month_before !== undefined) {
      responseData.usage.pages_used_this_month_before = usageResult.pages_used_this_month_before;
      responseData.usage.pages_used_this_month_after = usageResult.pages_used_this_month_after;
      responseData.usage.monthly_limit = usageResult.monthly_limit;
      responseData.usage.period_end = usageResult.period_end;
      responseData.usage.remaining_this_month = usageResult.monthly_limit - usageResult.pages_used_this_month_after;
    } else {
      responseData.usage.lifetime_limit = usageResult.lifetime_limit;
      responseData.usage.remaining_lifetime = usageResult.lifetime_limit - usageResult.pages_used_after;
    }
    
    res.status(200).json({
      success: true,
      data: responseData
    });
    
  } catch (error) {
    console.error('API error:', error);
    
    // Clean up any temporary files on error
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
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Export with comprehensive security middleware
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.PROCESSING, 'process-pdf')(processPDFHandler)
);