// API endpoint for managing batch jobs
// Handles CRUD operations for batch processing jobs

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

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(req, res, 'general');
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter
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

  try {
    switch (req.method) {
      case 'GET':
        return await handleGetJobs(req, res, user);
      case 'PUT':
        return await handleUpdateJob(req, res, user);
      case 'DELETE':
        return await handleDeleteJob(req, res, user);
      default:
        return res.status(405).json({
          success: false,
          error: 'Method not allowed'
        });
    }
  } catch (error) {
    console.error('Unexpected error in batch jobs API:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// Handle GET requests - fetch user's batch jobs
async function handleGetJobs(req, res, user) {
  const {
    page = 1,
    limit = 20,
    status = null,
    sortBy = 'created_at',
    sortOrder = 'desc'
  } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(limit);

  // Build query
  let query = supabase
    .from('batch_jobs')
    .select(`
      id,
      name,
      description,
      status,
      priority,
      total_files,
      processed_files,
      failed_files,
      total_pages,
      processed_pages,
      estimated_pages,
      merge_output,
      merge_format,
      started_at,
      completed_at,
      created_at,
      updated_at,
      batch_files!inner(count)
    `)
    .eq('user_id', user.id);

  // Apply status filter if provided
  if (status && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
    query = query.eq('status', status);
  }

  // Apply sorting
  const validSortFields = ['created_at', 'updated_at', 'name', 'status', 'priority'];
  const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
  const order = sortOrder === 'asc' ? false : true; // Supabase uses ascending boolean

  query = query.order(sortField, { ascending: !order });

  // Apply pagination
  query = query.range(offset, offset + parseInt(limit) - 1);

  const { data: jobs, error: jobsError } = await query;

  if (jobsError) {
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch batch jobs'
    });
  }

  // Get total count for pagination
  let countQuery = supabase
    .from('batch_jobs')
    .select('id', { count: 'exact' })
    .eq('user_id', user.id);

  if (status && ['pending', 'processing', 'completed', 'failed', 'cancelled'].includes(status)) {
    countQuery = countQuery.eq('status', status);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    return res.status(500).json({
      success: false,
      error: 'Failed to get total count'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      jobs: jobs || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        totalPages: Math.ceil(count / parseInt(limit))
      }
    }
  });
}

// Handle PUT requests - update batch job
async function handleUpdateJob(req, res, user) {
  const { jobId, name, description, priority, status } = req.body;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Missing jobId'
    });
  }

  // Verify job belongs to user
  const { data: existingJob, error: fetchError } = await supabase
    .from('batch_jobs')
    .select('id, status, user_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !existingJob) {
    return res.status(404).json({
      success: false,
      error: 'Batch job not found or access denied'
    });
  }

  // Build update object
  const updates = {
    updated_at: new Date().toISOString()
  };

  if (name !== undefined) {
    updates.name = name.trim();
  }

  if (description !== undefined) {
    updates.description = description?.trim() || null;
  }

  if (priority !== undefined) {
    if (priority < 1 || priority > 10) {
      return res.status(400).json({
        success: false,
        error: 'Priority must be between 1 and 10'
      });
    }
    updates.priority = priority;
  }

  // Handle status updates with validation
  if (status !== undefined) {
    const validTransitions = {
      'pending': ['processing', 'cancelled'],
      'processing': ['completed', 'failed', 'cancelled'],
      'completed': [], // Cannot change from completed
      'failed': ['pending'], // Can retry failed jobs
      'cancelled': ['pending'] // Can restart cancelled jobs
    };

    const allowedStatuses = validTransitions[existingJob.status] || [];
    
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot change status from ${existingJob.status} to ${status}`
      });
    }

    updates.status = status;

    // Set timestamps based on status changes
    if (status === 'processing' && existingJob.status === 'pending') {
      updates.started_at = new Date().toISOString();
    } else if (['completed', 'failed', 'cancelled'].includes(status)) {
      updates.completed_at = new Date().toISOString();
    } else if (status === 'pending') {
      // Reset timestamps when restarting
      updates.started_at = null;
      updates.completed_at = null;
    }
  }

  // Perform update
  const { data: updatedJob, error: updateError } = await supabase
    .from('batch_jobs')
    .update(updates)
    .eq('id', jobId)
    .select()
    .single();

  if (updateError) {
    return res.status(500).json({
      success: false,
      error: 'Failed to update batch job'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      job: updatedJob
    }
  });
}

// Handle DELETE requests - delete batch job
async function handleDeleteJob(req, res, user) {
  const { jobId } = req.query;

  if (!jobId) {
    return res.status(400).json({
      success: false,
      error: 'Missing jobId parameter'
    });
  }

  // Verify job belongs to user and get current status
  const { data: existingJob, error: fetchError } = await supabase
    .from('batch_jobs')
    .select('id, status, user_id')
    .eq('id', jobId)
    .eq('user_id', user.id)
    .single();

  if (fetchError || !existingJob) {
    return res.status(404).json({
      success: false,
      error: 'Batch job not found or access denied'
    });
  }

  // Check if job can be deleted (don't allow deletion of processing jobs)
  if (existingJob.status === 'processing') {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete a job that is currently processing'
    });
  }

  // Delete the job (CASCADE will handle related records)
  const { error: deleteError } = await supabase
    .from('batch_jobs')
    .delete()
    .eq('id', jobId)
    .eq('user_id', user.id);

  if (deleteError) {
    return res.status(500).json({
      success: false,
      error: 'Failed to delete batch job'
    });
  }

  return res.status(200).json({
    success: true,
    data: {
      message: 'Batch job deleted successfully',
      jobId
    }
  });
}