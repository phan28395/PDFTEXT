// API endpoint for uploading files to a batch job
// Handles file uploads and updates batch job status

import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { validatePDFFile, scanFileForMalware } from '../../src/lib/security.js';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Configure formidable for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting (10 uploads per minute)
  const rateLimitResult = await applyRateLimit(req, res, 'processing');
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    // Get user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    // Parse the multipart form data
    const form = formidable({
      maxFileSize: 50 * 1024 * 1024, // 50MB limit
      maxFiles: 100, // Maximum 100 files per upload
      keepExtensions: true,
      uploadDir: '/tmp',
    });

    const [fields, files] = await form.parse(req);
    const batchJobId = Array.isArray(fields.batchJobId) ? fields.batchJobId[0] : fields.batchJobId;

    if (!batchJobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing batchJobId in form data'
      });
    }

    // Verify batch job exists and belongs to user
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .select('id, user_id, status, name')
      .eq('id', batchJobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !batchJob) {
      return res.status(404).json({
        success: false,
        error: 'Batch job not found or access denied'
      });
    }

    if (batchJob.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: 'Cannot upload files to a batch job that is not in pending status'
      });
    }

    // Process uploaded files
    const uploadedFiles = Object.values(files).flat();
    const processedFiles = [];
    const errors = [];

    for (const file of uploadedFiles) {
      try {
        // Validate file
        const validation = await validatePDFFile(file.filepath);
        if (!validation.isValid) {
          errors.push({
            filename: file.originalFilename,
            error: validation.error
          });
          continue;
        }

        // Scan for malware if API key is available
        if (process.env.VIRUSTOTAL_API_KEY) {
          const scanResult = await scanFileForMalware(file.filepath);
          if (!scanResult.isSafe) {
            errors.push({
              filename: file.originalFilename,
              error: 'File failed malware scan'
            });
            continue;
          }
        }

        // Find corresponding batch file record
        const { data: batchFile, error: batchFileError } = await supabase
          .from('batch_files')
          .select('id, status')
          .eq('batch_job_id', batchJobId)
          .eq('original_filename', file.originalFilename)
          .single();

        if (batchFileError || !batchFile) {
          errors.push({
            filename: file.originalFilename,
            error: 'File not found in batch job'
          });
          continue;
        }

        if (batchFile.status !== 'pending') {
          errors.push({
            filename: file.originalFilename,
            error: 'File already processed or in progress'
          });
          continue;
        }

        // Create unique filename for storage
        const fileExtension = path.extname(file.originalFilename);
        const uniqueFilename = `batch_${batchJobId}_${batchFile.id}_${Date.now()}${fileExtension}`;
        const storagePath = `/tmp/batch_uploads/${uniqueFilename}`;

        // Ensure upload directory exists
        const uploadDir = path.dirname(storagePath);
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }

        // Move file to permanent location
        fs.renameSync(file.filepath, storagePath);

        // Update batch file record with file path
        const { error: updateError } = await supabase
          .from('batch_files')
          .update({
            file_path: storagePath,
            status: 'uploaded'
          })
          .eq('id', batchFile.id);

        if (updateError) {
          errors.push({
            filename: file.originalFilename,
            error: 'Failed to update file record'
          });
          // Clean up uploaded file
          if (fs.existsSync(storagePath)) {
            fs.unlinkSync(storagePath);
          }
          continue;
        }

        processedFiles.push({
          filename: file.originalFilename,
          fileId: batchFile.id,
          size: file.size,
          status: 'uploaded'
        });

      } catch (error) {
        console.error(`Error processing file ${file.originalFilename}:`, error);
        errors.push({
          filename: file.originalFilename,
          error: 'File processing failed'
        });
      }
    }

    // Check if all files in the batch job are uploaded
    const { data: allFiles, error: allFilesError } = await supabase
      .from('batch_files')
      .select('id, status')
      .eq('batch_job_id', batchJobId);

    if (!allFilesError && allFiles) {
      const allUploaded = allFiles.every(file => file.status === 'uploaded');
      
      if (allUploaded) {
        // Update batch job status to ready for processing
        await supabase
          .from('batch_jobs')
          .update({
            status: 'ready',
            updated_at: new Date().toISOString()
          })
          .eq('id', batchJobId);
      }
    }

    // Return results
    return res.status(200).json({
      success: true,
      data: {
        batchJobId,
        processedFiles,
        errors,
        summary: {
          totalFiles: uploadedFiles.length,
          successfulUploads: processedFiles.length,
          failedUploads: errors.length
        }
      }
    });

  } catch (error) {
    console.error('Unexpected error in batch file upload:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}