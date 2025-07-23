// API endpoint for creating batch processing jobs
// Handles job creation, file validation, and cost estimation

import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting (5 requests per minute for batch operations)
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
    const {
      name,
      description,
      files,
      priority = 5,
      mergeOutput = false,
      mergeFormat = null,
      outputOptions = {}
    } = req.body;

    // Validate input
    if (!name || !files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name and files array'
      });
    }

    if (files.length > 100) {
      return res.status(400).json({
        success: false,
        error: 'Maximum 100 files allowed per batch job'
      });
    }

    // Validate priority
    if (priority < 1 || priority > 10) {
      return res.status(400).json({
        success: false,
        error: 'Priority must be between 1 and 10'
      });
    }

    // Validate merge format if merging is enabled
    if (mergeOutput && mergeFormat && !['txt', 'md', 'docx'].includes(mergeFormat)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid merge format. Must be txt, md, or docx'
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

    // Validate all files
    let totalEstimatedPages = 0;
    const validatedFiles = [];

    for (const file of files) {
      if (!file.name || !file.size) {
        return res.status(400).json({
          success: false,
          error: 'Each file must have name and size properties'
        });
      }

      // Validate file extension
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({
          success: false,
          error: `Invalid file type: ${file.name}. Only PDF files are allowed.`
        });
      }

      // Validate file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          error: `File too large: ${file.name}. Maximum size is 50MB.`
        });
      }

      // Estimate pages (rough estimate: 1 page per 50KB)
      const estimatedPages = Math.max(1, Math.ceil(file.size / (50 * 1024)));
      totalEstimatedPages += estimatedPages;

      validatedFiles.push({
        name: file.name,
        size: file.size,
        estimatedPages
      });
    }

    // Check user's usage limits and estimate cost
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('pages_used, subscription_type, subscription_status')
      .eq('id', user.id)
      .single();

    if (userError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch user data'
      });
    }

    const currentUsage = userData.pages_used || 0;
    const subscriptionType = userData.subscription_type || 'free';
    const pageLimit = subscriptionType === 'pro' ? 1000 : 10;
    const pagesRemaining = Math.max(0, pageLimit - currentUsage);

    // Check if user can process this batch
    if (totalEstimatedPages > pagesRemaining) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient page limit for this batch job',
        details: {
          requiredPages: totalEstimatedPages,
          availablePages: pagesRemaining,
          currentUsage,
          pageLimit,
          subscriptionType,
          requiresUpgrade: subscriptionType === 'free'
        }
      });
    }

    // Create batch job
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        priority,
        estimated_pages: totalEstimatedPages,
        merge_output: mergeOutput,
        merge_format: mergeOutput ? mergeFormat : null,
        output_options: outputOptions,
        status: 'pending'
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating batch job:', jobError);
      return res.status(500).json({
        success: false,
        error: 'Failed to create batch job'
      });
    }

    // Create batch file records
    const batchFiles = validatedFiles.map(file => ({
      batch_job_id: batchJob.id,
      original_filename: file.name,
      file_size: file.size,
      estimated_pages: file.estimatedPages,
      status: 'pending'
    }));

    const { error: filesError } = await supabase
      .from('batch_files')
      .insert(batchFiles);

    if (filesError) {
      console.error('Error creating batch files:', filesError);
      
      // Cleanup the batch job if file creation failed
      await supabase
        .from('batch_jobs')
        .delete()
        .eq('id', batchJob.id);

      return res.status(500).json({
        success: false,
        error: 'Failed to create batch file records'
      });
    }

    // Update batch job with total files count
    await supabase
      .from('batch_jobs')
      .update({ total_files: validatedFiles.length })
      .eq('id', batchJob.id);

    // Return success response with job details
    return res.status(200).json({
      success: true,
      data: {
        batchJob: {
          id: batchJob.id,
          name: batchJob.name,
          description: batchJob.description,
          status: batchJob.status,
          priority: batchJob.priority,
          totalFiles: validatedFiles.length,
          estimatedPages: totalEstimatedPages,
          mergeOutput: batchJob.merge_output,
          mergeFormat: batchJob.merge_format,
          createdAt: batchJob.created_at
        },
        costEstimate: {
          estimatedPages: totalEstimatedPages,
          estimatedCostUSD: (totalEstimatedPages * 0.01).toFixed(4),
          currentUsage,
          pagesRemaining,
          subscriptionType
        }
      }
    });

  } catch (error) {
    console.error('Unexpected error in batch job creation:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}