import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import formidable from 'formidable';
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import PDFParse from 'pdf2pic';
import path from 'path';
import archiver from 'archiver';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Initialize Google Document AI client using JSON credentials from environment
let client;
let initError = null;
try {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    client = new DocumentProcessorServiceClient({
      credentials: credentials,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      apiEndpoint: 'us-documentai.googleapis.com',
    });
    console.log('Google Document AI client initialized successfully');
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!client) {
    // Fallback to dummy processing if Google AI not configured
    console.log('Google Document AI not configured, using fallback. Error:', initError);
    return res.status(200).json({
      success: true,
      data: {
        text: `Google Document AI not configured. Error: ${initError}. Please check your environment variables.`,
        pages: 1,
        processingTime: 1000,
        confidence: 0.8,
        usage: {
          current: 1,
          limit: 5,
          remaining: 4
        }
      }
    });
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
    const processorName = `projects/${process.env.GOOGLE_CLOUD_PROJECT_ID}/locations/us/processors/${process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID}`;
    
    // Extract form fields for new parameters
    const documentType = fields.documentType?.[0] || 'standard';
    const downloadFormat = fields.downloadFormat?.[0] || 'combined';
    const processIndividually = fields.processIndividually?.[0] === 'true';
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    
    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
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
        pages_processed: 0, // Will update after processing
        output_format: 'txt',
        processing_status: 'processing',
        document_type: documentType,
        download_format: downloadFormat,
        was_paid: false, // Will update after charging
        payment_amount: 0 // Will update after charging
      });
    
    if (recordError) {
      console.error('Failed to create processing record:', recordError);
      return res.status(500).json({ success: false, error: 'Failed to create processing record' });
    }
    
    const startTime = Date.now();
    
    let processedPages = [];
    let totalText = '';
    let totalPages = 0;
    let totalConfidence = 0;
    
    if (processIndividually) {
      // Process pages individually
      const processedData = await processDocumentIndividually(
        fileBuffer, 
        processorName, 
        client, 
        documentType
      );
      
      processedPages = processedData.pages;
      totalText = processedData.combinedText;
      totalPages = processedData.pageCount;
      totalConfidence = processedData.averageConfidence;
    } else {
      // Process entire document at once (legacy mode)
      const request = {
        name: processorName,
        rawDocument: {
          content: fileBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
      };
      
      const [result] = await client.processDocument(request);
      const document = result.document;
      totalText = document.text || '';
      totalPages = document.pages ? document.pages.length : 1;
      totalConfidence = document.pages?.[0]?.detectedLanguages?.[0]?.confidence || 0.95;
      
      processedPages = [{ pageNumber: 1, text: totalText, confidence: totalConfidence }];
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
    
    // Update processing record as completed
    await supabase
      .from('processing_history')
      .update({
        pages_processed: totalPages,
        processing_status: 'completed',
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
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
        text: totalText,
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
async function processDocumentIndividually(fileBuffer, processorName, client, documentType) {
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
    
    // Process each page's content
    const processedPages = [];
    let combinedText = '';
    let totalConfidence = 0;
    
    for (let i = 0; i < document.pages.length; i++) {
      const page = document.pages[i];
      
      // Extract text for this page
      let pageText = '';
      if (page.paragraphs) {
        for (const paragraph of page.paragraphs) {
          const paragraphText = extractTextFromLayout(paragraph.layout, document.text);
          pageText += paragraphText + '\n';
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
        pageNumber: i + 1,
        text: pageText.trim(),
        confidence: confidence
      });
      
      combinedText += pageText + '\n\n';
      totalConfidence += confidence;
    }
    
    return {
      pages: processedPages,
      combinedText: combinedText.trim(),
      pageCount: document.pages.length,
      averageConfidence: totalConfidence / document.pages.length
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
 * Get processing options based on document type
 */
function getProcessingOptionsForType(documentType) {
  switch (documentType) {
    case 'latex':
      return {
        enableFormExtraction: false,
        enableTableExtraction: true,
        enableMathExtraction: true // This would be a custom option if available
      };
    case 'forms':
      return {
        enableFormExtraction: true,
        enableTableExtraction: true,
        enableEntityExtraction: true
      };
    case 'standard':
    default:
      return {
        enableFormExtraction: false,
        enableTableExtraction: false,
        enableEntityExtraction: false
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