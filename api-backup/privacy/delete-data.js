import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GDPR-compliant data deletion endpoint (Right to Erasure)
 * Allows users to permanently delete all their personal data
 */
export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting (3 requests per day for data deletion)
  const rateLimitResult = await applyRateLimit(req, res, {
    windowMs: 24 * 60 * 60 * 1000, // 24 hours
    max: 3, // 3 requests per day
    message: 'Too many deletion requests. Please contact support for assistance.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  if (!rateLimitResult.success) {
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST requests are supported'
    });
  }

  try {
    const { password, confirmDeletion } = req.body;

    if (!password || !confirmDeletion) {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Password and deletion confirmation are required'
      });
    }

    if (confirmDeletion !== 'DELETE_ALL_MY_DATA') {
      return res.status(400).json({
        error: 'Bad request',
        message: 'Invalid deletion confirmation phrase'
      });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    const userId = user.id;
    const userEmail = user.email;

    // Verify the password by attempting to sign in
    const { error: passwordError } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password: password
    });

    if (passwordError) {
      // Log failed deletion attempt
      await supabase
        .from('privacy_audit_log')
        .insert({
          user_id: userId,
          action: 'data_deletion_failed_auth',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { 
            timestamp: new Date().toISOString(),
            reason: 'invalid_password'
          }
        });

      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid password provided'
      });
    }

    // Log the deletion request initiation
    const { error: auditError } = await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: userId,
        action: 'data_deletion_initiated',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { 
          timestamp: new Date().toISOString(),
          user_email: userEmail
        }
      });

    if (auditError) {
      console.error('Failed to log deletion initiation:', auditError);
    }

    // Start transaction-like deletion process
    const deletionResults = {
      processing_history: 0,
      batch_jobs: 0,
      batch_files: 0,
      batch_outputs: 0,
      usage_audit_logs: 0,
      privacy_audit_logs: 0,
      user_profile: 0,
      errors: []
    };

    try {
      // 1. Delete processing history (this will cascade to related tables)
      const { data: processingData, error: processingDeleteError } = await supabase
        .from('processing_history')
        .delete()
        .eq('user_id', userId);

      if (processingDeleteError) {
        deletionResults.errors.push(`Processing history: ${processingDeleteError.message}`);
        console.error('Error deleting processing history:', processingDeleteError);
      } else {
        deletionResults.processing_history = processingData?.length || 0;
      }

      // 2. Delete batch processing data
      // First get batch job IDs to delete associated files and outputs
      const { data: batchJobIds } = await supabase
        .from('batch_jobs')
        .select('id')
        .eq('user_id', userId);

      if (batchJobIds && batchJobIds.length > 0) {
        const jobIds = batchJobIds.map(job => job.id);

        // Delete batch outputs
        const { data: batchOutputsData, error: batchOutputsError } = await supabase
          .from('batch_outputs')
          .delete()
          .in('job_id', jobIds);

        if (batchOutputsError) {
          deletionResults.errors.push(`Batch outputs: ${batchOutputsError.message}`);
          console.error('Error deleting batch outputs:', batchOutputsError);
        } else {
          deletionResults.batch_outputs = batchOutputsData?.length || 0;
        }

        // Delete batch files
        const { data: batchFilesData, error: batchFilesError } = await supabase
          .from('batch_files')
          .delete()
          .in('job_id', jobIds);

        if (batchFilesError) {
          deletionResults.errors.push(`Batch files: ${batchFilesError.message}`);
          console.error('Error deleting batch files:', batchFilesError);
        } else {
          deletionResults.batch_files = batchFilesData?.length || 0;
        }

        // Delete batch jobs
        const { data: batchJobsData, error: batchJobsError } = await supabase
          .from('batch_jobs')
          .delete()
          .eq('user_id', userId);

        if (batchJobsError) {
          deletionResults.errors.push(`Batch jobs: ${batchJobsError.message}`);
          console.error('Error deleting batch jobs:', batchJobsError);
        } else {
          deletionResults.batch_jobs = batchJobsData?.length || 0;
        }
      }

      // 3. Delete usage audit logs (keep minimal data for compliance)
      const { data: usageAuditData, error: usageAuditError } = await supabase
        .from('usage_audit_log')
        .delete()
        .eq('user_id', userId);

      if (usageAuditError) {
        deletionResults.errors.push(`Usage audit logs: ${usageAuditError.message}`);
        console.error('Error deleting usage audit logs:', usageAuditError);
      } else {
        deletionResults.usage_audit_logs = usageAuditData?.length || 0;
      }

      // 4. Handle Stripe subscription cancellation if exists
      let stripeCleanupResult = null;
      const { data: userData } = await supabase
        .from('users')
        .select('stripe_customer_id, subscription_id')
        .eq('id', userId)
        .single();

      if (userData?.stripe_customer_id && process.env.STRIPE_SECRET_KEY) {
        try {
          // Cancel active subscription
          if (userData.subscription_id) {
            const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
            await stripe.subscriptions.cancel(userData.subscription_id);
            stripeCleanupResult = 'Subscription cancelled';
          }
        } catch (stripeError) {
          console.error('Error cancelling Stripe subscription:', stripeError);
          deletionResults.errors.push(`Stripe cleanup: ${stripeError.message}`);
        }
      }

      // 5. Delete user profile (this should be done last)
      const { data: userDeleteData, error: userDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (userDeleteError) {
        deletionResults.errors.push(`User profile: ${userDeleteError.message}`);
        console.error('Error deleting user profile:', userDeleteError);
      } else {
        deletionResults.user_profile = 1;
      }

      // 6. Delete the auth user (this removes the ability to log in)
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);

      if (authDeleteError) {
        deletionResults.errors.push(`Auth user: ${authDeleteError.message}`);
        console.error('Error deleting auth user:', authDeleteError);
      }

      // 7. Create final audit log entry with anonymized data (for compliance)
      const finalAuditEntry = {
        user_id: null, // Anonymize
        action: 'data_deletion_completed',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: {
          timestamp: new Date().toISOString(),
          original_user_id: userId,
          user_email_hash: require('crypto').createHash('sha256').update(userEmail).digest('hex'),
          deletion_results: deletionResults,
          stripe_cleanup: stripeCleanupResult,
          compliance_note: 'User exercised right to erasure under GDPR Article 17'
        }
      };

      const { error: finalAuditError } = await supabase
        .from('privacy_audit_log')
        .insert(finalAuditEntry);

      if (finalAuditError) {
        console.error('Failed to create final audit log:', finalAuditError);
      }

      // Return success response
      return res.status(200).json({
        message: 'Account and all associated data have been permanently deleted',
        deletion_summary: {
          processing_records_deleted: deletionResults.processing_history,
          batch_jobs_deleted: deletionResults.batch_jobs,
          batch_files_deleted: deletionResults.batch_files,
          batch_outputs_deleted: deletionResults.batch_outputs,
          audit_logs_deleted: deletionResults.usage_audit_logs,
          user_profile_deleted: deletionResults.user_profile > 0,
          stripe_subscription_cancelled: stripeCleanupResult !== null,
          errors_encountered: deletionResults.errors.length,
          deletion_timestamp: new Date().toISOString()
        },
        compliance_info: {
          gdpr_article: 'Article 17 - Right to erasure',
          retention_policy: 'Anonymized audit logs retained for 7 years for compliance',
          data_controller: 'PDF-to-Text SaaS Platform',
          contact: 'privacy@pdftotext.com'
        }
      });

    } catch (deletionError) {
      console.error('Error during data deletion process:', deletionError);

      // Log the failed deletion
      await supabase
        .from('privacy_audit_log')
        .insert({
          user_id: userId,
          action: 'data_deletion_failed',
          ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
          user_agent: req.headers['user-agent'],
          metadata: { 
            timestamp: new Date().toISOString(),
            error: deletionError.message,
            partial_deletion_results: deletionResults
          }
        });

      return res.status(500).json({
        error: 'Deletion partially failed',
        message: 'Some data may have been deleted. Please contact support for assistance.',
        partial_results: deletionResults
      });
    }

  } catch (error) {
    console.error('Data deletion error:', error);

    // Log the failed deletion attempt
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          await supabase
            .from('privacy_audit_log')
            .insert({
              user_id: user.id,
              action: 'data_deletion_error',
              ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
              user_agent: req.headers['user-agent'],
              metadata: { 
                timestamp: new Date().toISOString(),
                error: error.message
              }
            });
        }
      }
    } catch (auditError) {
      console.error('Failed to log deletion error:', auditError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete user data. Please try again later or contact support.'
    });
  }
}