import { createClient } from '@supabase/supabase-js';
import { OutputFormatGenerator } from '../src/lib/outputFormats.js';
import { downloadManager } from '../src/lib/downloadManager.js';
import { withRateLimit, RateLimitConfigs } from '../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../src/lib/securityHeaders.js';

// Initialize Supabase client
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

async function getProcessingRecord(recordId, userId) {
  const { data, error } = await supabase
    .from('processing_history')
    .select('*')
    .eq('id', recordId)
    .eq('user_id', userId)
    .single();
    
  if (error || !data) {
    throw new Error('Processing record not found or access denied');
  }
  
  return data;
}

async function generateOutputHandler(req, res) {
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
    
    // Parse request body
    const { 
      recordId, 
      format, 
      options = {} 
    } = req.body;
    
    // Validate required fields
    if (!recordId || typeof recordId !== 'string') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Processing record ID is required'
      });
    }
    
    if (!format || !['txt', 'markdown', 'docx'].includes(format)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Format must be one of: txt, markdown, docx'
      });
    }
    
    // Validate options
    const validatedOptions = validateGenerationOptions(format, options);
    if (!validatedOptions.valid) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid generation options',
        details: validatedOptions.errors
      });
    }
    
    // Get processing record
    let processingRecord;
    try {
      processingRecord = await getProcessingRecord(recordId, user.id);
    } catch (error) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Processing record not found or access denied'
      });
    }
    
    // Reconstruct processed document from stored data
    const processedDocument = {
      text: processingRecord.text_content,
      pages: processingRecord.pages_processed,
      confidence: processingRecord.confidence_score || 0.95,
      processingTime: processingRecord.processing_time || 0,
      entities: processingRecord.extracted_content?.entities,
      structure: processingRecord.extracted_content?.structure,
      mathematics: processingRecord.extracted_content?.mathematics,
      images: processingRecord.extracted_content?.images,
      formatting: processingRecord.extracted_content?.formatting
    };
    
    // Generate output
    const generator = new OutputFormatGenerator(processedDocument);
    
    const generationOptions = {
      format,
      includeMetadata: options.includeMetadata !== false,
      preserveFormatting: options.preserveFormatting !== false,
      includeImages: options.includeImages !== false,
      includeTables: options.includeTables !== false,
      includeMathematics: options.includeMathematics !== false,
      customStyles: options.customStyles || {}
    };
    
    let generatedOutput;
    try {
      generatedOutput = await generator.generate(generationOptions);
    } catch (generateError) {
      console.error('Output generation error:', generateError);
      return res.status(422).json({
        error: 'Generation error',
        message: 'Failed to generate output in requested format',
        details: process.env.NODE_ENV === 'development' ? generateError.message : undefined
      });
    }
    
    // Create secure download link
    let downloadLink;
    try {
      downloadLink = await downloadManager.createDownloadLink(
        generatedOutput,
        user.id,
        recordId
      );
    } catch (downloadError) {
      console.error('Download link creation error:', downloadError);
      return res.status(500).json({
        error: 'Download error',
        message: 'Failed to create download link',
        details: process.env.NODE_ENV === 'development' ? downloadError.message : undefined
      });
    }
    
    // Log successful generation
    console.log('Output generated successfully:', {
      userId: user.id,
      recordId,
      format,
      filename: generatedOutput.filename,
      size: generatedOutput.size,
      linkId: downloadLink.id,
      timestamp: new Date().toISOString()
    });
    
    // Return success response
    res.status(200).json({
      success: true,
      data: {
        recordId,
        format,
        filename: generatedOutput.filename,
        size: generatedOutput.size,
        mimeType: generatedOutput.mimeType,
        downloadUrl: downloadLink.downloadUrl,
        expiresAt: downloadLink.expiresAt,
        metadata: generatedOutput.metadata,
        generation: {
          includeMetadata: generationOptions.includeMetadata,
          preserveFormatting: generationOptions.preserveFormatting,
          includeImages: generationOptions.includeImages,
          includeTables: generationOptions.includeTables,
          includeMathematics: generationOptions.includeMathematics
        }
      }
    });
    
  } catch (error) {
    console.error('Generate output API error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while generating output',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Validate generation options based on format
 */
function validateGenerationOptions(format, options) {
  const errors = [];
  
  // Validate boolean options
  const booleanOptions = [
    'includeMetadata', 'preserveFormatting', 'includeImages', 
    'includeTables', 'includeMathematics'
  ];
  
  for (const option of booleanOptions) {
    if (options[option] !== undefined && typeof options[option] !== 'boolean') {
      errors.push(`${option} must be a boolean`);
    }
  }
  
  // Validate custom styles
  if (options.customStyles && typeof options.customStyles !== 'object') {
    errors.push('customStyles must be an object');
  } else if (options.customStyles) {
    const { customStyles } = options;
    
    if (customStyles.headerPrefix && typeof customStyles.headerPrefix !== 'string') {
      errors.push('customStyles.headerPrefix must be a string');
    }
    
    if (customStyles.tableStyle && !['simple', 'grid', 'markdown'].includes(customStyles.tableStyle)) {
      errors.push('customStyles.tableStyle must be one of: simple, grid, markdown');
    }
    
    if (customStyles.mathFormat && !['latex', 'unicode', 'text'].includes(customStyles.mathFormat)) {
      errors.push('customStyles.mathFormat must be one of: latex, unicode, text');
    }
  }
  
  // Format-specific validations
  if (format === 'txt') {
    if (options.preserveFormatting === true) {
      errors.push('preserveFormatting is not supported for TXT format');
    }
  }
  
  if (format === 'markdown') {
    if (options.customStyles?.tableStyle && options.customStyles.tableStyle !== 'markdown') {
      // Override to markdown style for consistency
      options.customStyles.tableStyle = 'markdown';
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

// Export with security middleware
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'generate-output')(generateOutputHandler)
);