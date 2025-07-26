import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client with error handling
let supabase;
try {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  console.log('Initializing Supabase with:', {
    hasUrl: !!supabaseUrl,
    hasKey: !!supabaseKey,
    urlPrefix: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'not set'
  });
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase environment variables not found:', {
      VITE_SUPABASE_URL: !!process.env.VITE_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    });
  } else {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('Supabase client initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Supabase:', error);
}

// Initialize Google Document AI client using JSON credentials from environment
let client;
let initError = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    // Use location from environment or default to 'us'
    const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us';
    const apiEndpoint = `${location}-documentai.googleapis.com`;
    
    client = new DocumentProcessorServiceClient({
      credentials: credentials,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      clientOptions: {
        apiEndpoint: apiEndpoint
      }
    });
    console.log(`Google Document AI client initialized successfully with endpoint: ${apiEndpoint}`);
  } else {
    initError = 'Google credentials environment variable not found';
    throw new Error(initError);
  }
} catch (error) {
  initError = error.message;
  console.error('Failed to initialize Google Document AI:', error);
}

export const config = {
  api: {
    bodyParser: false, // We handle parsing with formidable
  },
}

export default async function handler(req, res) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: `This endpoint only accepts POST requests. Received: ${req.method}`,
      hint: 'To process a PDF, please use the application interface at https://pdf-text1.vercel.app'
    });
  }

  if (!client) {
    // For development/testing: provide mock response when Google AI not configured
    console.log('Google Document AI not configured, using mock response. Error:', initError);
    
    try {
      const form = formidable({
        maxFileSize: 50 * 1024 * 1024, // 50MB limit
        keepExtensions: true,
      });

      const [fields, files] = await form.parse(req);
      const file = files.file?.[0];

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      // Mock successful response for testing
      const mockText = `This is a mock response for testing purposes.
      
Your PDF file "${file.originalFilename}" has been received successfully.

File size: ${(file.size / 1024).toFixed(2)} KB

Since Google Document AI is not configured, this is a simulated response.
To enable actual text extraction, please configure the following environment variables:
- GOOGLE_APPLICATION_CREDENTIALS_JSON
- GOOGLE_CLOUD_PROJECT_ID
- GOOGLE_DOCUMENT_AI_PROCESSOR_ID

Page 1 content would appear here...
Page 2 content would appear here...
`;

      // Clean up the uploaded file
      if (fs.existsSync(file.filepath)) {
        fs.unlinkSync(file.filepath);
      }

      return res.status(200).json({
        success: true,
        data: {
          text: mockText,
          pages: 2,
          processingTime: 500,
          confidence: 0.95,
          usage: {
            current: 1,
            limit: 999999,
            remaining: 999998
          },
          // Add expected fields for frontend
          recordId: uuidv4(),
          filename: file.originalFilename || 'document.pdf',
          originalText: mockText,
          outputFormat: fields.outputFormat?.[0] || 'text',
          documentType: fields.documentType?.[0] || 'standard',
          downloadFormat: fields.downloadFormat?.[0] || 'combined',
          downloadUrls: []
        }
      });
    } catch (error) {
      console.error('Mock processing error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to process upload'
      });
    }
  }

  try {
    // Parse the uploaded file
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      keepExtensions: true,
    });

    const [fields, files] = await form.parse(req);
    const file = files.file?.[0];

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file uploaded'
      });
    }

    // Read the file
    const fileBuffer = fs.readFileSync(file.filepath);
    
    // Prepare the document for Google Document AI
    const location = process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us';
    const processorName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/${location}/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
    
    // Extract form fields for new parameters
    const documentType = fields.documentType?.[0] || 'standard';
    const downloadFormat = fields.downloadFormat?.[0] || 'combined';
    const processIndividually = fields.processIndividually?.[0] === 'true';
    const outputFormat = fields.outputFormat?.[0] || 'text';
    const startPage = parseInt(fields.startPage?.[0]) || 1;
    const endPage = parseInt(fields.endPage?.[0]) || null;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    // Check if Supabase is initialized
    if (!supabase) {
      console.error('Supabase client not initialized');
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection not available',
        message: 'The server is not properly configured. Please check environment variables.',
        debug: {
          hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL || !!process.env.NEXT_PUBLIC_SUPABASE_URL || !!process.env.SUPABASE_URL,
          hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY
        }
      });
    }
    
    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return res.status(401).json({ success: false, error: 'Invalid authentication' });
    }
    
    const userId = user.id;
    
    // Create initial processing record
    const recordId = uuidv4();
    const { error: recordError } = await supabase
      .from('processing_history')
      .insert({
        id: recordId,
        user_id: userId,
        filename: file.originalFilename || 'document.pdf',
        original_filename: file.originalFilename || 'document.pdf',
        file_size: file.size,
        pages_processed: 1, // Set to 1 initially to satisfy constraint, will update after processing
        output_format: 'txt',
        processing_status: 'processing',
        document_type: documentType,
        was_paid: false, // Will update after charging
        payment_amount: 0 // Will update after charging
      });
    
    if (recordError) {
      console.error('Failed to create processing record:', {
        error: recordError,
        details: recordError.details,
        message: recordError.message,
        code: recordError.code,
        userId: userId,
        hasSupabase: !!supabase
      });
      return res.status(500).json({ 
        success: false, 
        error: 'Failed to create processing record',
        details: recordError.message || 'Database connection error',
        hint: recordError.code === '42501' ? 'Permission denied - check RLS policies' : undefined
      });
    }
    
    const startTime = Date.now();
    
    let processedPages = [];
    let totalText = '';
    let totalPages = 0;
    let totalConfidence = 0;
    
    // First, get total page count to validate range
    let documentPageCount = 0;
    try {
      const countRequest = {
        name: processorName,
        rawDocument: {
          content: fileBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      };
      const [countResult] = await client.processDocument(countRequest);
      documentPageCount = countResult.document.pages ? countResult.document.pages.length : 1;
    } catch (error) {
      console.error('Error getting page count:', error);
      documentPageCount = 1; // Default fallback
    }
    
    // Validate and adjust page range
    const actualEndPage = endPage || documentPageCount;
    const validStartPage = Math.max(1, Math.min(startPage, documentPageCount));
    const validEndPage = Math.max(validStartPage, Math.min(actualEndPage, documentPageCount));
    const pagesToProcess = validEndPage - validStartPage + 1;
    
    if (processIndividually) {
      // Process pages individually with page range support
      const processedData = await processDocumentIndividually(
        fileBuffer, 
        processorName, 
        client, 
        documentType,
        validStartPage,
        validEndPage
      );
      
      processedPages = processedData.pages;
      totalText = processedData.combinedText;
      totalPages = pagesToProcess;
      totalConfidence = processedData.averageConfidence;
    } else {
      // Process entire document at once, then filter pages
      const request = {
        name: processorName,
        rawDocument: {
          content: fileBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
        // Add document type specific hints
        processOptions: getProcessingOptionsForType(documentType)
      };
      
      const [result] = await client.processDocument(request);
      const document = result.document;
      
      // Filter pages based on range
      if (document.pages && validStartPage !== 1 || validEndPage !== documentPageCount) {
        const selectedPages = document.pages.slice(validStartPage - 1, validEndPage);
        totalText = selectedPages.map(page => page.paragraphs?.map(p => p.layout?.textAnchor?.content || '').join('\n') || '').join('\n\n');
        totalPages = pagesToProcess;
        totalConfidence = selectedPages[0]?.detectedLanguages?.[0]?.confidence || 0.95;
        processedPages = selectedPages.map((page, index) => ({
          pageNumber: validStartPage + index,
          text: page.paragraphs?.map(p => p.layout?.textAnchor?.content || '').join('\n') || '',
          confidence: page.detectedLanguages?.[0]?.confidence || 0.95
        }));
      } else {
        totalText = document.text || '';
        totalPages = pagesToProcess;
        totalConfidence = document.pages?.[0]?.detectedLanguages?.[0]?.confidence || 0.95;
        processedPages = [{ pageNumber: 1, text: totalText, confidence: totalConfidence }];
      }
      
      // Log entities if Math OCR was enabled (for LaTeX mode) - for debugging
      if (document.entities && documentType === 'latex') {
        console.log(`[LaTeX Mode] Found ${document.entities.length} entities in full document processing`);
        // Just log but don't modify the output - keep it pure from Google
        document.entities.forEach((entity, index) => {
          console.log(`Entity ${index}: type=${entity.type || entity.type_}, text=${entity.mentionText || entity.mention_text}`);
        });
      }
    }
    
    const processingTime = Date.now() - startTime;
    
    // Check if user can afford this processing
    const { data: canProcess } = await supabase
      .rpc('can_user_process_pages', {
        user_uuid: userId,
        pages_count: totalPages,
        cost_per_page: 1.2
      });
    
    if (!canProcess) {
      // Update record as failed
      await supabase
        .from('processing_history')
        .update({
          processing_status: 'failed',
          error_message: 'Insufficient credits',
          completed_at: new Date().toISOString()
        })
        .eq('id', recordId);
        
      return res.status(402).json({
        success: false,
        error: 'Insufficient credits',
        message: 'Please add credits to process this document'
      });
    }
    
    // Charge user for processing
    const { data: chargeResult, error: chargeError } = await supabase
      .rpc('charge_user_credits', {
        user_uuid: userId,
        pages_count: totalPages,
        cost_per_page: 1.2
      });
    
    if (chargeError || !chargeResult?.success) {
      await supabase
        .from('processing_history')
        .update({
          processing_status: 'failed',
          error_message: 'Payment processing failed',
          completed_at: new Date().toISOString()
        })
        .eq('id', recordId);
        
      return res.status(402).json({
        success: false,
        error: 'Payment processing failed'
      });
    }
    
    // Generate download URLs based on format
    let downloadUrls = [];
    if (downloadFormat === 'separated' || downloadFormat === 'individual') {
      downloadUrls = await generateMultipleDownloads(processedPages, downloadFormat, recordId);
    }
    
    // Convert text to requested output format
    const convertedContent = await convertTextToFormat(totalText, outputFormat, processedPages);
    
    // Update processing record as completed
    await supabase
      .from('processing_history')
      .update({
        pages_processed: totalPages,
        output_format: outputFormat,
        processing_status: 'completed',
        processing_time: processingTime,
        was_paid: chargeResult.credits_charged > 0,
        payment_amount: chargeResult.credits_charged || 0,
        text_content: totalText
      })
      .eq('id', recordId);

    // Clean up temporary file
    fs.unlinkSync(file.filepath);

    // Get updated user data for usage stats
    const { data: userData } = await supabase
      .from('users')
      .select('pages_used, credit_balance, free_pages_remaining')
      .eq('id', userId)
      .single();
    
    // Return the response in the format the frontend expects
    return res.status(200).json({
      success: true,
      data: {
        recordId: recordId,
        filename: file.originalFilename || 'document.pdf',
        text: convertedContent.content,
        originalText: totalText,
        outputFormat: outputFormat,
        pages: totalPages,
        confidence: totalConfidence,
        processingTime: processingTime,
        documentType: documentType,
        downloadFormat: downloadFormat,
        downloadUrls: downloadUrls,
        usage: {
          current: userData?.pages_used || 0,
          limit: 999999, // No limit in pay-per-use model
          remaining: Math.floor((userData?.credit_balance || 0) / 1.2) + (userData?.free_pages_remaining || 0),
          freePagesUsed: chargeResult.free_pages_used || 0,
          creditsCharged: chargeResult.credits_charged || 0
        }
      }
    });

  } catch (error) {
    console.error('Processing error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      details: error.details,
      name: error.name
    });
    
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Processing failed',
      debug: {
        hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON,
        hasProjectId: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        hasProcessorId: !!process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID,
        clientInitialized: !!client
      }
    });
  }
}

/**
 * Process document pages individually using Google Document AI
 */
async function processDocumentIndividually(fileBuffer, processorName, client, documentType, startPage = 1, endPage = null) {
  try {
    // For now, we'll process the entire document and simulate individual processing
    // In a full implementation, you would split the PDF into individual pages first
    const request = {
      name: processorName,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
      // Add document type specific hints
      processOptions: getProcessingOptionsForType(documentType)
    };

    const [result] = await client.processDocument(request);
    const document = result.document;
    
    if (!document.pages) {
      return {
        pages: [{ pageNumber: 1, text: document.text || '', confidence: 0.95 }],
        combinedText: document.text || '',
        pageCount: 1,
        averageConfidence: 0.95
      };
    }
    
    // Process each page's content within the specified range
    const processedPages = [];
    let combinedText = '';
    let totalConfidence = 0;
    
    const actualEndPage = endPage || document.pages.length;
    const pageStart = Math.max(0, startPage - 1); // Convert to 0-based index
    const pageEnd = Math.min(document.pages.length, actualEndPage);
    
    for (let i = pageStart; i < pageEnd; i++) {
      const page = document.pages[i];
      const pageNumber = i + 1; // Convert back to 1-based for display
      
      // Extract text for this page
      let pageText = '';
      
      // Extract paragraphs
      if (page.paragraphs) {
        for (const paragraph of page.paragraphs) {
          const paragraphText = extractTextFromLayout(paragraph.layout, document.text);
          pageText += paragraphText + '\n';
        }
      }
      
      // Extract form fields and tables if Forms mode
      if (page.formFields) {
        pageText += '\n\n--- Form Fields ---\n';
        for (const field of page.formFields) {
          const fieldName = extractTextFromLayout(field.fieldName.textAnchor, document.text);
          const fieldValue = extractTextFromLayout(field.fieldValue.textAnchor, document.text);
          pageText += `${fieldName}: ${fieldValue}\n`;
        }
      }
      
      if (page.tables) {
        pageText += '\n\n--- Tables ---\n';
        for (const table of page.tables) {
          // Extract table content
          for (const row of table.bodyRows || []) {
            for (const cell of row.cells || []) {
              const cellText = extractTextFromLayout(cell.layout, document.text);
              pageText += cellText + '\t';
            }
            pageText += '\n';
          }
        }
      }
      
      // If no paragraphs, try to extract from tokens or use fallback
      if (!pageText && page.tokens) {
        for (const token of page.tokens) {
          const tokenText = extractTextFromLayout(token.layout, document.text);
          pageText += tokenText + ' ';
        }
      }
      
      // Fallback to basic text extraction
      if (!pageText) {
        const startIndex = i * Math.floor(document.text.length / document.pages.length);
        const endIndex = (i + 1) * Math.floor(document.text.length / document.pages.length);
        pageText = document.text.substring(startIndex, endIndex);
      }
      
      const confidence = page.detectedLanguages?.[0]?.confidence || 0.95;
      
      processedPages.push({
        pageNumber: pageNumber,
        text: pageText.trim(),
        confidence: confidence
      });
      
      combinedText += pageText + '\n\n';
      totalConfidence += confidence;
    }
    
    // Log entities if Math OCR was enabled (for LaTeX mode) - for debugging
    if (document.entities && documentType === 'latex') {
      console.log(`[LaTeX Mode] Found ${document.entities.length} entities in document`);
      // Just log but don't modify the output - keep it pure from Google
      document.entities.forEach((entity, index) => {
        console.log(`Entity ${index}: type=${entity.type || entity.type_}, text=${entity.mentionText || entity.mention_text}`);
      });
    }
    
    const actualProcessedCount = pageEnd - pageStart;
    return {
      pages: processedPages,
      combinedText: combinedText.trim(),
      pageCount: actualProcessedCount,
      averageConfidence: actualProcessedCount > 0 ? totalConfidence / actualProcessedCount : 0
    };
    
  } catch (error) {
    console.error('Individual processing error:', error);
    throw error;
  }
}

/**
 * Extract text from layout element
 */
function extractTextFromLayout(layout, fullText) {
  if (!layout || !layout.textAnchor || !layout.textAnchor.textSegments) {
    return '';
  }
  
  let extractedText = '';
  for (const segment of layout.textAnchor.textSegments) {
    const startIndex = parseInt(segment.startIndex) || 0;
    const endIndex = parseInt(segment.endIndex) || fullText.length;
    extractedText += fullText.substring(startIndex, endIndex);
  }
  
  return extractedText;
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Get processing options based on document type
 * Different modes have different costs:
 * - Standard: Basic OCR (lowest cost)
 * - LaTeX: Math OCR enabled (higher cost due to premium features)
 * - Forms: Form parser with table extraction (higher cost)
 */
function getProcessingOptionsForType(documentType) {
  switch (documentType) {
    case 'latex':
      // Enable Math OCR for LaTeX formula extraction (matching working script)
      return {
        ocrConfig: {
          premiumFeatures: {
            enableMathOcr: true  // Extract math formulas in LaTeX format
          }
        }
      };
    case 'forms':
      // Enable form parser features
      return {
        ocrConfig: {
          enableNativePdfParsing: true,
          enableImageQualityScores: true,
          premiumFeatures: {
            computeStyleInfo: false,
            enableMathOcr: false,
            enableSelectionMarkDetection: true  // For checkboxes in forms
          }
        }
      };
    case 'standard':
    default:
      // Basic OCR without premium features (lowest cost)
      return {
        ocrConfig: {
          enableNativePdfParsing: true,
          enableImageQualityScores: false,
          premiumFeatures: {
            computeStyleInfo: false,
            enableMathOcr: false,
            enableSelectionMarkDetection: false
          }
        }
      };
  }
}

/**
 * Generate multiple download files based on format
 */
async function generateMultipleDownloads(processedPages, downloadFormat, recordId) {
  const downloadUrls = [];
  
  try {
    // Create temporary directory for files
    const tempDir = path.join('/tmp', recordId);
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    
    if (downloadFormat === 'separated') {
      // Create individual text files for each page
      for (const page of processedPages) {
        const filename = `page_${page.pageNumber.toString().padStart(3, '0')}.txt`;
        const filepath = path.join(tempDir, filename);
        fs.writeFileSync(filepath, page.text);
        downloadUrls.push(`/api/download/${recordId}/${filename}`);
      }
    } else if (downloadFormat === 'individual') {
      // Create a zip file with individual page files
      const zipPath = path.join(tempDir, 'pages.zip');
      const output = fs.createWriteStream(zipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      output.on('close', () => {
        console.log(`Archive created: ${archive.pointer()} total bytes`);
      });
      
      archive.pipe(output);
      
      for (const page of processedPages) {
        const filename = `page_${page.pageNumber.toString().padStart(3, '0')}.txt`;
        archive.append(page.text, { name: filename });
      }
      
      await archive.finalize();
      downloadUrls.push(`/api/download/${recordId}/pages.zip`);
    }
    
    return downloadUrls;
  } catch (error) {
    console.error('Error generating downloads:', error);
    return [];
  }
}

/**
 * Convert text content to different output formats
 */
async function convertTextToFormat(text, outputFormat, processedPages) {
  try {
    switch (outputFormat) {
      case 'text':
        return {
          content: text,
          mimeType: 'text/plain',
          extension: 'txt'
        };
        
      case 'markdown':
        // Convert to markdown format
        const markdownContent = convertToMarkdown(text, processedPages);
        return {
          content: markdownContent,
          mimeType: 'text/markdown',
          extension: 'md'
        };
        
      case 'html':
        // Convert to HTML format
        const htmlContent = convertToHTML(text, processedPages);
        return {
          content: htmlContent,
          mimeType: 'text/html',
          extension: 'html'
        };
        
      case 'json':
        // Convert to structured JSON format
        const jsonContent = JSON.stringify({
          totalPages: processedPages.length,
          extractedText: text,
          pages: processedPages.map(page => ({
            pageNumber: page.pageNumber,
            text: page.text,
            confidence: page.confidence
          })),
          metadata: {
            extractedAt: new Date().toISOString(),
            format: 'json'
          }
        }, null, 2);
        return {
          content: jsonContent,
          mimeType: 'application/json',
          extension: 'json'
        };
        
      case 'docx':
        // For DOCX, we'll return formatted text for now
        // In a full implementation, you'd use a library like docx to create proper Word documents
        const docxContent = convertToDocxText(text, processedPages);
        return {
          content: docxContent,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          extension: 'docx',
          note: 'DOCX format returned as formatted text. Full DOCX generation requires additional libraries.'
        };
        
      default:
        return {
          content: text,
          mimeType: 'text/plain',
          extension: 'txt'
        };
    }
  } catch (error) {
    console.error('Error converting text format:', error);
    return {
      content: text,
      mimeType: 'text/plain',
      extension: 'txt'
    };
  }
}

/**
 * Convert text to Markdown format
 */
function convertToMarkdown(text, processedPages) {
  let markdown = '# Document Content\n\n';
  
  if (processedPages.length > 1) {
    processedPages.forEach(page => {
      markdown += `## Page ${page.pageNumber}\n\n`;
      markdown += page.text.replace(/\n\n+/g, '\n\n') + '\n\n';
      markdown += `*Confidence: ${(page.confidence * 100).toFixed(1)}%*\n\n---\n\n`;
    });
  } else {
    markdown += text.replace(/\n\n+/g, '\n\n');
  }
  
  return markdown;
}

/**
 * Convert text to HTML format
 */
function convertToHTML(text, processedPages) {
  let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Extracted Document Content</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        .page { margin-bottom: 40px; padding: 20px; border-left: 4px solid #3b82f6; }
        .page-header { color: #1f2937; border-bottom: 1px solid #e5e7eb; padding-bottom: 10px; margin-bottom: 15px; }
        .confidence { color: #6b7280; font-size: 0.9em; margin-top: 10px; }
        pre { white-space: pre-wrap; }
    </style>
</head>
<body>
    <h1>Document Content</h1>
`;

  if (processedPages.length > 1) {
    processedPages.forEach(page => {
      html += `    <div class="page">
        <div class="page-header">
            <h2>Page ${page.pageNumber}</h2>
        </div>
        <pre>${escapeHtml(page.text)}</pre>
        <div class="confidence">Confidence: ${(page.confidence * 100).toFixed(1)}%</div>
    </div>
`;
    });
  } else {
    html += `    <div class="page">
        <pre>${escapeHtml(text)}</pre>
    </div>
`;
  }
  
  html += `</body>
</html>`;
  
  return html;
}

/**
 * Convert text to formatted DOCX-style text
 */
function convertToDocxText(text, processedPages) {
  let docxText = 'DOCUMENT CONTENT\n';
  docxText += '='.repeat(50) + '\n\n';
  
  if (processedPages.length > 1) {
    processedPages.forEach(page => {
      docxText += `PAGE ${page.pageNumber}\n`;
      docxText += '-'.repeat(20) + '\n\n';
      docxText += page.text + '\n\n';
      docxText += `[Confidence: ${(page.confidence * 100).toFixed(1)}%]\n\n`;
    });
  } else {
    docxText += text;
  }
  
  return docxText;
}

/**
 * Escape HTML characters
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}