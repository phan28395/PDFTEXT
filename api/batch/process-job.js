// API endpoint for processing batch jobs
// Handles batch job processing queue and individual file processing

import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { extractTextFromPDF } from '../../src/lib/documentai.js';
import { categorizeError } from '../../src/lib/errorHandler.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting (specific for processing operations)
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
    const { batchJobId } = req.body;

    if (!batchJobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing batchJobId'
      });
    }

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

    // Verify batch job exists and belongs to user
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batchJobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !batchJob) {
      return res.status(404).json({
        success: false,
        error: 'Batch job not found or access denied'
      });
    }

    // Check if job is in a processable state
    if (!['pending', 'ready', 'processing'].includes(batchJob.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot process batch job with status: ${batchJob.status}`
      });
    }

    // Update job status to processing if not already
    if (batchJob.status !== 'processing') {
      await supabase
        .from('batch_jobs')
        .update({
          status: 'processing',
          started_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', batchJobId);
    }

    // Get files ready for processing
    const { data: filesToProcess, error: filesError } = await supabase
      .from('batch_files')
      .select('*')
      .eq('batch_job_id', batchJobId)
      .in('status', ['uploaded', 'pending'])
      .order('created_at');

    if (filesError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch files for processing'
      });
    }

    if (!filesToProcess || filesToProcess.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No files available for processing'
      });
    }

    // Process files sequentially (can be made parallel if needed)
    const processedFiles = [];
    const failedFiles = [];
    let totalProcessedPages = 0;

    for (const file of filesToProcess) {
      try {
        // Update file status to processing
        await supabase
          .from('batch_files')
          .update({
            status: 'processing',
            processing_started_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', file.id);

        // Process the PDF file
        const result = await extractTextFromPDF(file.file_path);

        if (result.success) {
          // Create processing history record
          const { data: processingRecord, error: recordError } = await supabase
            .from('processing_history')
            .insert({
              user_id: user.id,
              filename: file.original_filename,
              file_size: file.file_size,
              pages_processed: result.pages || file.estimated_pages,
              extracted_text: result.text,
              extracted_images: result.images || [],
              extracted_tables: result.tables || [],
              extracted_math: result.mathematics || [],
              processing_metadata: {
                confidence: result.confidence,
                processing_time: result.processing_time,
                document_structure: result.document_structure,
                batch_job_id: batchJobId,
                batch_file_id: file.id
              },
              status: 'completed'
            })
            .select()
            .single();

          if (recordError) {
            throw new Error('Failed to create processing record');
          }

          // Update batch file with success
          await supabase
            .from('batch_files')
            .update({
              status: 'completed',
              processing_record_id: processingRecord.id,
              actual_pages: result.pages || file.estimated_pages,
              processing_completed_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', file.id);

          totalProcessedPages += result.pages || file.estimated_pages;
          processedFiles.push({
            fileId: file.id,
            filename: file.original_filename,
            pages: result.pages || file.estimated_pages,
            processingRecordId: processingRecord.id
          });

        } else {
          throw new Error(result.error || 'Processing failed');
        }

      } catch (error) {
        console.error(`Error processing file ${file.original_filename}:`, error);
        
        const errorCategory = categorizeError(error);
        
        // Update batch file with failure
        await supabase
          .from('batch_files')
          .update({
            status: 'failed',
            error_message: errorCategory.userMessage,
            error_code: errorCategory.category,
            processing_completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', file.id);

        failedFiles.push({
          fileId: file.id,
          filename: file.original_filename,
          error: errorCategory.userMessage,
          errorCode: errorCategory.category
        });
      }
    }

    // Update user page usage
    if (totalProcessedPages > 0) {
      const { error: usageError } = await supabase.rpc(
        'atomic_update_user_pages_usage',
        {
          p_user_id: user.id,
          p_pages_to_add: totalProcessedPages,
          p_processing_record_id: null // Batch processing doesn't use single record ID
        }
      );

      if (usageError) {
        console.error('Error updating user page usage:', usageError);
      }
    }

    // Update batch job progress
    await supabase.rpc('update_batch_job_progress', {
      p_batch_job_id: batchJobId
    });

    // Check if all files are completed
    const { data: remainingFiles, error: remainingError } = await supabase
      .from('batch_files')
      .select('status')
      .eq('batch_job_id', batchJobId)
      .not('status', 'in', '(completed,failed,skipped)');

    const allCompleted = !remainingError && (!remainingFiles || remainingFiles.length === 0);

    if (allCompleted) {
      // If merge output is requested, trigger merge process
      if (batchJob.merge_output && batchJob.merge_format) {
        // This would trigger a separate merge process
        // For now, we'll just update the status
        await supabase
          .from('batch_jobs')
          .update({
            status: 'merging',
            updated_at: new Date().toISOString()
          })
          .eq('id', batchJobId);
      } else {
        // Mark job as completed
        await supabase
          .from('batch_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', batchJobId);
      }
    }

    // Return processing results
    return res.status(200).json({
      success: true,
      data: {
        batchJobId,
        processedFiles,
        failedFiles,
        totalProcessedPages,
        summary: {
          totalFiles: filesToProcess.length,
          successfulProcessing: processedFiles.length,
          failedProcessing: failedFiles.length,
          totalPages: totalProcessedPages,
          allCompleted
        }
      }
    });

  } catch (error) {
    console.error('Unexpected error in batch processing:', error);
    
    // Update batch job status to failed if we have the ID
    if (req.body.batchJobId) {
      try {
        await supabase
          .from('batch_jobs')
          .update({
            status: 'failed',
            error_details: { error: error.message },
            updated_at: new Date().toISOString()
          })
          .eq('id', req.body.batchJobId);
      } catch (updateError) {
        console.error('Failed to update batch job status:', updateError);
      }
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}