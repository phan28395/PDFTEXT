import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import formidable from 'formidable';
import fs from 'fs';

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
    
    const request = {
      name: processorName,
      rawDocument: {
        content: fileBuffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    };

    // Process the document
    const startTime = Date.now();
    const [result] = await client.processDocument(request);
    const processingTime = Date.now() - startTime;

    // Extract text and page count
    const document = result.document;
    const text = document.text || '';
    const pages = document.pages ? document.pages.length : 1;
    const confidence = document.pages?.[0]?.detectedLanguages?.[0]?.confidence || 0.95;

    // Clean up temporary file
    fs.unlinkSync(file.filepath);

    // Return the response in the format the frontend expects
    return res.status(200).json({
      success: true,
      data: {
        text: text,
        pages: pages,
        processingTime: processingTime,
        confidence: confidence,
        usage: {
          current: 1, // This should be calculated from database
          limit: 5,
          remaining: 4
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