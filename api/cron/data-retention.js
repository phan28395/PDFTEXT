import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * Data Retention Manager
 * Automatically manages data retention according to privacy policy
 * Should be run as a scheduled job (daily/weekly)
 */

/**
 * Clean up expired text content while preserving metadata
 */
async function cleanupProcessingHistory() {
  console.log('🧹 Starting processing history cleanup...');
  
  try {
    // Get retention settings
    const { data: retentionSettings } = await supabase
      .from('data_retention_settings')
      .select('*')
      .eq('data_type', 'processing_text_content')
      .eq('is_active', true)
      .single();

    if (!retentionSettings) {
      console.log('❌ No retention settings found for processing text content');
      return { success: false, error: 'No retention settings' };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionSettings.retention_days);

    console.log(`📅 Text content cutoff date: ${cutoffDate.toISOString()}`);

    // Update processing records to remove text content
    const { data: updatedRecords, error: updateError } = await supabase
      .from('processing_history')
      .update({
        extracted_text: null,
        structured_content: null,
        mathematical_content: null,
        images: null
      })
      .lt('created_at', cutoffDate.toISOString())
      .not('extracted_text', 'is', null)
      .select('id');

    if (updateError) {
      console.log('❌ Error cleaning up processing history:', updateError.message);
      return { success: false, error: updateError.message };
    }

    const cleanedCount = updatedRecords?.length || 0;
    console.log(`✅ Cleaned text content from ${cleanedCount} processing records`);

    // Log the cleanup action
    await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: null, // System action
        action: 'data_retention_processing_history_cleanup',
        metadata: {
          timestamp: new Date().toISOString(),
          cutoff_date: cutoffDate.toISOString(),
          records_cleaned: cleanedCount,
          retention_days: retentionSettings.retention_days,
          automated: true
        }
      });

    return { success: true, recordsCleaned: cleanedCount };
  } catch (error) {
    console.log('❌ Processing history cleanup error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old usage audit logs
 */
async function cleanupUsageAuditLogs() {
  console.log('🧹 Starting usage audit logs cleanup...');
  
  try {
    const { data: retentionSettings } = await supabase
      .from('data_retention_settings')
      .select('*')
      .eq('data_type', 'usage_audit_logs')
      .eq('is_active', true)
      .single();

    if (!retentionSettings) {
      console.log('❌ No retention settings found for usage audit logs');
      return { success: false, error: 'No retention settings' };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionSettings.retention_days);

    console.log(`📅 Usage audit logs cutoff date: ${cutoffDate.toISOString()}`);

    // Delete old usage audit logs
    const { data: deletedRecords, error: deleteError } = await supabase
      .from('usage_audit_log')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (deleteError) {
      console.log('❌ Error cleaning up usage audit logs:', deleteError.message);
      return { success: false, error: deleteError.message };
    }

    const deletedCount = deletedRecords?.length || 0;
    console.log(`✅ Deleted ${deletedCount} old usage audit log records`);

    // Log the cleanup action
    await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: null, // System action
        action: 'data_retention_usage_audit_cleanup',
        metadata: {
          timestamp: new Date().toISOString(),
          cutoff_date: cutoffDate.toISOString(),
          records_deleted: deletedCount,
          retention_days: retentionSettings.retention_days,
          automated: true
        }
      });

    return { success: true, recordsDeleted: deletedCount };
  } catch (error) {
    console.log('❌ Usage audit logs cleanup error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old security logs
 */
async function cleanupSecurityLogs() {
  console.log('🧹 Starting security logs cleanup...');
  
  try {
    const { data: retentionSettings } = await supabase
      .from('data_retention_settings')
      .select('*')
      .eq('data_type', 'security_logs')
      .eq('is_active', true)
      .single();

    if (!retentionSettings) {
      console.log('❌ No retention settings found for security logs');
      return { success: false, error: 'No retention settings' };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionSettings.retention_days);

    console.log(`📅 Security logs cutoff date: ${cutoffDate.toISOString()}`);

    // Delete old security logs (if the table exists)
    const { data: deletedRecords, error: deleteError } = await supabase
      .from('security_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString())
      .select('id');

    if (deleteError && !deleteError.message.includes('relation "security_logs" does not exist')) {
      console.log('❌ Error cleaning up security logs:', deleteError.message);
      return { success: false, error: deleteError.message };
    }

    const deletedCount = deletedRecords?.length || 0;
    console.log(`✅ Deleted ${deletedCount} old security log records`);

    // Log the cleanup action
    await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: null, // System action
        action: 'data_retention_security_logs_cleanup',
        metadata: {
          timestamp: new Date().toISOString(),
          cutoff_date: cutoffDate.toISOString(),
          records_deleted: deletedCount,
          retention_days: retentionSettings.retention_days,
          automated: true
        }
      });

    return { success: true, recordsDeleted: deletedCount };
  } catch (error) {
    console.log('❌ Security logs cleanup error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up old batch processing data
 */
async function cleanupBatchProcessingData() {
  console.log('🧹 Starting batch processing data cleanup...');
  
  try {
    const { data: retentionSettings } = await supabase
      .from('data_retention_settings')
      .select('*')
      .eq('data_type', 'batch_processing_data')
      .eq('is_active', true)
      .single();

    if (!retentionSettings) {
      console.log('❌ No retention settings found for batch processing data');
      return { success: false, error: 'No retention settings' };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionSettings.retention_days);

    console.log(`📅 Batch processing data cutoff date: ${cutoffDate.toISOString()}`);

    // Get old batch jobs
    const { data: oldJobs } = await supabase
      .from('batch_jobs')
      .select('id')
      .lt('created_at', cutoffDate.toISOString());

    if (!oldJobs || oldJobs.length === 0) {
      console.log('✅ No old batch processing data to clean up');
      return { success: true, recordsDeleted: 0 };
    }

    const jobIds = oldJobs.map(job => job.id);

    // Delete batch outputs
    const { error: outputsError } = await supabase
      .from('batch_outputs')
      .delete()
      .in('job_id', jobIds);

    if (outputsError) {
      console.log('❌ Error deleting batch outputs:', outputsError.message);
    }

    // Delete batch files
    const { error: filesError } = await supabase
      .from('batch_files')
      .delete()
      .in('job_id', jobIds);

    if (filesError) {
      console.log('❌ Error deleting batch files:', filesError.message);
    }

    // Delete batch jobs
    const { data: deletedJobs, error: jobsError } = await supabase
      .from('batch_jobs')
      .delete()
      .in('id', jobIds)
      .select('id');

    if (jobsError) {
      console.log('❌ Error deleting batch jobs:', jobsError.message);
      return { success: false, error: jobsError.message };
    }

    const deletedCount = deletedJobs?.length || 0;
    console.log(`✅ Deleted ${deletedCount} old batch processing jobs and associated data`);

    // Log the cleanup action
    await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: null, // System action
        action: 'data_retention_batch_processing_cleanup',
        metadata: {
          timestamp: new Date().toISOString(),
          cutoff_date: cutoffDate.toISOString(),
          jobs_deleted: deletedCount,
          retention_days: retentionSettings.retention_days,
          automated: true
        }
      });

    return { success: true, recordsDeleted: deletedCount };
  } catch (error) {
    console.log('❌ Batch processing data cleanup error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generate data retention compliance report
 */
async function generateComplianceReport() {
  console.log('📊 Generating data retention compliance report...');
  
  try {
    const report = {
      generated_at: new Date().toISOString(),
      retention_policies: [],
      compliance_status: 'compliant',
      recommendations: []
    };

    // Get all retention settings
    const { data: retentionSettings } = await supabase
      .from('data_retention_settings')
      .select('*')
      .eq('is_active', true)
      .order('data_type');

    for (const setting of retentionSettings || []) {
      const policyReport = {
        data_type: setting.data_type,
        retention_days: setting.retention_days,
        description: setting.description,
        last_cleanup: null,
        expired_records_estimated: 0,
        status: 'compliant'
      };

      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - setting.retention_days);

      // Get estimated expired records count
      let expiredCount = 0;
      
      try {
        switch (setting.data_type) {
          case 'processing_text_content':
            const { count: processingCount } = await supabase
              .from('processing_history')
              .select('id', { count: 'exact' })
              .lt('created_at', cutoffDate.toISOString())
              .not('extracted_text', 'is', null);
            expiredCount = processingCount || 0;
            break;
            
          case 'usage_audit_logs':
            const { count: auditCount } = await supabase
              .from('usage_audit_log')
              .select('id', { count: 'exact' })
              .lt('created_at', cutoffDate.toISOString());
            expiredCount = auditCount || 0;
            break;
            
          case 'batch_processing_data':
            const { count: batchCount } = await supabase
              .from('batch_jobs')
              .select('id', { count: 'exact' })
              .lt('created_at', cutoffDate.toISOString());
            expiredCount = batchCount || 0;
            break;
        }
      } catch (error) {
        console.log(`⚠️  Could not count expired records for ${setting.data_type}:`, error.message);
      }

      policyReport.expired_records_estimated = expiredCount;
      
      if (expiredCount > 0) {
        policyReport.status = 'action_needed';
        report.compliance_status = 'action_needed';
        report.recommendations.push(`Clean up ${expiredCount} expired records for ${setting.data_type}`);
      }

      // Get last cleanup date from audit logs
      const { data: lastCleanup } = await supabase
        .from('privacy_audit_log')
        .select('created_at')
        .eq('action', `data_retention_${setting.data_type.replace('_', '_')}_cleanup`)
        .order('created_at', { ascending: false })
        .limit(1);

      if (lastCleanup && lastCleanup[0]) {
        policyReport.last_cleanup = lastCleanup[0].created_at;
      }

      report.retention_policies.push(policyReport);
    }

    // Log the compliance report generation
    await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: null, // System action
        action: 'data_retention_compliance_report_generated',
        metadata: {
          timestamp: new Date().toISOString(),
          compliance_status: report.compliance_status,
          policies_checked: report.retention_policies.length,
          recommendations_count: report.recommendations.length,
          automated: true
        }
      });

    console.log(`✅ Compliance report generated with status: ${report.compliance_status}`);
    return { success: true, report };
  } catch (error) {
    console.log('❌ Compliance report generation error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main data retention job
 */
export default async function runDataRetentionJob() {
  console.log('🚀 Starting automated data retention job');
  console.log('=========================================');
  
  const startTime = new Date();
  const results = {
    processing_history: null,
    usage_audit_logs: null,
    security_logs: null,
    batch_processing: null,
    compliance_report: null
  };

  // Run all cleanup tasks
  results.processing_history = await cleanupProcessingHistory();
  results.usage_audit_logs = await cleanupUsageAuditLogs();
  results.security_logs = await cleanupSecurityLogs();
  results.batch_processing = await cleanupBatchProcessingData();
  results.compliance_report = await generateComplianceReport();

  const endTime = new Date();
  const duration = endTime - startTime;

  // Calculate summary
  const totalRecordsCleaned = Object.values(results)
    .filter(result => result && result.success)
    .reduce((total, result) => total + (result.recordsCleaned || result.recordsDeleted || 0), 0);

  const failedTasks = Object.values(results).filter(result => result && !result.success).length;

  console.log('\n📈 Data Retention Job Summary');
  console.log('============================');
  console.log(`Duration: ${duration}ms`);
  console.log(`Total records cleaned: ${totalRecordsCleaned}`);
  console.log(`Failed tasks: ${failedTasks}`);
  
  Object.entries(results).forEach(([taskName, result]) => {
    if (result) {
      const status = result.success ? '✅' : '❌';
      const details = result.recordsCleaned || result.recordsDeleted || 'N/A';
      console.log(`${status} ${taskName}: ${details} records`);
    }
  });

  // Log the job completion
  await supabase
    .from('privacy_audit_log')
    .insert({
      user_id: null, // System action
      action: 'data_retention_job_completed',
      metadata: {
        timestamp: new Date().toISOString(),
        duration_ms: duration,
        total_records_cleaned: totalRecordsCleaned,
        failed_tasks: failedTasks,
        task_results: results,
        automated: true
      }
    });

  if (failedTasks === 0) {
    console.log('\n🎉 Data retention job completed successfully!');
  } else {
    console.log('\n⚠️  Data retention job completed with some failures. Check logs for details.');
  }

  return {
    success: failedTasks === 0,
    duration,
    totalRecordsCleaned,
    failedTasks,
    results
  };
}

// Export individual functions for testing
export {
  cleanupProcessingHistory,
  cleanupUsageAuditLogs,
  cleanupSecurityLogs,
  cleanupBatchProcessingData,
  generateComplianceReport
};