import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * GDPR-compliant data export endpoint
 * Allows users to download all their personal data in JSON format
 */
export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting (5 requests per hour for data export)
  const rateLimitResult = await applyRateLimit(req, res, {
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 requests per hour
    message: 'Too many data export requests. Please try again later.',
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

    // Log the data export request for audit purposes
    const { error: auditError } = await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: userId,
        action: 'data_export_requested',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { timestamp: new Date().toISOString() }
      });

    if (auditError) {
      console.error('Failed to log data export request:', auditError);
    }

    // Collect all user data from different tables
    const userData = {
      export_info: {
        user_id: userId,
        export_date: new Date().toISOString(),
        export_type: 'complete_user_data',
        version: '1.0'
      },
      personal_data: {},
      processing_history: [],
      subscription_data: {},
      usage_statistics: {},
      audit_logs: [],
      batch_processing: [],
      security_logs: []
    };

    // 1. Get user profile data
    const { data: profileData, error: profileError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    } else {
      userData.personal_data = {
        id: profileData.id,
        email: profileData.email,
        full_name: profileData.full_name,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
        subscription_status: profileData.subscription_status,
        subscription_tier: profileData.subscription_tier,
        pages_used_lifetime: profileData.pages_used_lifetime,
        pages_used_this_month: profileData.pages_used_this_month,
        stripe_customer_id: profileData.stripe_customer_id ? '[REDACTED - Contact support for billing data]' : null,
        subscription_id: profileData.subscription_id ? '[REDACTED - Contact support for billing data]' : null
      };
    }

    // 2. Get processing history
    const { data: processingData, error: processingError } = await supabase
      .from('processing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (processingError) {
      console.error('Error fetching processing history:', processingError);
    } else {
      userData.processing_history = processingData.map(record => ({
        id: record.id,
        filename: record.filename,
        pages_processed: record.pages_processed,
        status: record.status,
        extracted_text: record.extracted_text,
        error_message: record.error_message,
        processing_time_ms: record.processing_time_ms,
        file_size_bytes: record.file_size_bytes,
        created_at: record.created_at,
        updated_at: record.updated_at,
        structured_content: record.structured_content,
        mathematical_content: record.mathematical_content,
        images: record.images,
        quality_metrics: record.quality_metrics
      }));
    }

    // 3. Get batch processing data
    const { data: batchJobs, error: batchError } = await supabase
      .from('batch_jobs')
      .select(`
        *,
        batch_files(*),
        batch_outputs(*)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (batchError) {
      console.error('Error fetching batch processing data:', batchError);
    } else {
      userData.batch_processing = batchJobs.map(job => ({
        id: job.id,
        name: job.name,
        status: job.status,
        total_files: job.total_files,
        completed_files: job.completed_files,
        failed_files: job.failed_files,
        total_pages: job.total_pages,
        processed_pages: job.processed_pages,
        priority: job.priority,
        created_at: job.created_at,
        updated_at: job.updated_at,
        completed_at: job.completed_at,
        files: job.batch_files || [],
        outputs: job.batch_outputs || []
      }));
    }

    // 4. Get usage audit logs (last 90 days for privacy)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: auditData, error: auditDataError } = await supabase
      .from('usage_audit_log')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (auditDataError) {
      console.error('Error fetching audit logs:', auditDataError);
    } else {
      userData.audit_logs = auditData.map(log => ({
        id: log.id,
        action: log.action,
        pages_processed: log.pages_processed,
        processing_record_id: log.processing_record_id,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at,
        metadata: log.metadata
      }));
    }

    // 5. Get privacy audit logs
    const { data: privacyAuditData, error: privacyAuditError } = await supabase
      .from('privacy_audit_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(100); // Last 100 privacy actions

    if (privacyAuditError) {
      console.error('Error fetching privacy audit logs:', privacyAuditError);
    } else {
      userData.privacy_actions = privacyAuditData.map(log => ({
        id: log.id,
        action: log.action,
        ip_address: log.ip_address,
        user_agent: log.user_agent,
        created_at: log.created_at,
        metadata: log.metadata
      }));
    }

    // 6. Calculate usage statistics
    const totalProcessingRecords = userData.processing_history.length;
    const totalPagesProcessed = userData.processing_history.reduce((sum, record) => sum + (record.pages_processed || 0), 0);
    const successfulProcessing = userData.processing_history.filter(record => record.status === 'completed').length;
    const failedProcessing = userData.processing_history.filter(record => record.status === 'failed').length;

    userData.usage_statistics = {
      total_processing_records: totalProcessingRecords,
      total_pages_processed: totalPagesProcessed,
      successful_processing: successfulProcessing,
      failed_processing: failedProcessing,
      success_rate: totalProcessingRecords > 0 ? (successfulProcessing / totalProcessingRecords * 100).toFixed(2) + '%' : '0%',
      account_age_days: Math.floor((new Date() - new Date(userData.personal_data.created_at)) / (1000 * 60 * 60 * 24)),
      last_activity: userData.processing_history.length > 0 ? userData.processing_history[0].created_at : userData.personal_data.created_at
    };

    // 7. Add data retention information
    userData.data_retention_info = {
      text_content_retention_days: 365,
      metadata_retention_days: 730,
      audit_log_retention_days: 90,
      privacy_audit_retention_days: 2555, // 7 years for compliance
      automatic_cleanup_enabled: true,
      next_cleanup_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // Next week
    };

    // 8. Add GDPR rights information
    userData.gdpr_rights = {
      right_to_access: 'Fulfilled by this export',
      right_to_rectification: 'Available through account settings',
      right_to_erasure: 'Available through account deletion',
      right_to_restrict_processing: 'Contact support@pdftotext.com',
      right_to_data_portability: 'Fulfilled by this export',
      right_to_object: 'Contact support@pdftotext.com',
      right_to_withdraw_consent: 'Available through privacy settings'
    };

    // Log successful data export
    const { error: successAuditError } = await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: userId,
        action: 'data_export_completed',
        ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: { 
          timestamp: new Date().toISOString(),
          records_exported: {
            processing_history: userData.processing_history.length,
            batch_jobs: userData.batch_processing.length,
            audit_logs: userData.audit_logs.length,
            privacy_actions: userData.privacy_actions?.length || 0
          }
        }
      });

    if (successAuditError) {
      console.error('Failed to log successful data export:', successAuditError);
    }

    // Set appropriate headers for file download
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="user-data-export-${userId}-${new Date().toISOString().split('T')[0]}.json"`);
    
    return res.status(200).json(userData);

  } catch (error) {
    console.error('Data export error:', error);

    // Log the failed export attempt
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
              action: 'data_export_failed',
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
      console.error('Failed to log failed export attempt:', auditError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to export user data. Please try again later.'
    });
  }
}