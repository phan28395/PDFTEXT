/**
 * Test script for privacy API endpoints
 * This file can be used to verify privacy functionality works correctly
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Test data export endpoint
export const testDataExport = async (userId, token) => {
  try {
    console.log('Testing data export for user:', userId);
    
    const response = await fetch('/api/privacy/export-data', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Data export successful');
      console.log('- Export contains:', Object.keys(data));
      console.log('- Processing records:', data.processing_history?.length || 0);
      console.log('- Batch jobs:', data.batch_processing?.length || 0);
      console.log('- Audit logs:', data.audit_logs?.length || 0);
      return { success: true, data };
    } else {
      const error = await response.json();
      console.log('❌ Data export failed:', error.message);
      return { success: false, error };
    }
  } catch (error) {
    console.log('❌ Data export error:', error.message);
    return { success: false, error: error.message };
  }
};

// Test consent management endpoint
export const testConsentManagement = async (userId, token) => {
  try {
    console.log('Testing consent management for user:', userId);
    
    // Get current consent settings
    const getResponse = await fetch('/api/privacy/consent', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (getResponse.ok) {
      const consentData = await getResponse.json();
      console.log('✅ Consent retrieval successful');
      console.log('- Consent settings:', consentData.consent_settings?.length || 0);
      
      // Test updating consent (analytics)
      const updateResponse = await fetch('/api/privacy/consent', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consent_type: 'analytics',
          consented: true,
          privacy_policy_version: '1.0'
        })
      });

      if (updateResponse.ok) {
        const updateData = await updateResponse.json();
        console.log('✅ Consent update successful');
        console.log('- Updated consent type:', updateData.consent_type);
        console.log('- New consent status:', updateData.consented);
        return { success: true, data: { get: consentData, update: updateData } };
      } else {
        const updateError = await updateResponse.json();
        console.log('❌ Consent update failed:', updateError.message);
        return { success: false, error: updateError };
      }
    } else {
      const error = await getResponse.json();
      console.log('❌ Consent retrieval failed:', error.message);
      return { success: false, error };
    }
  } catch (error) {
    console.log('❌ Consent management error:', error.message);
    return { success: false, error: error.message };
  }
};

// Test privacy policy endpoint
export const testPrivacyPolicy = async () => {
  try {
    console.log('Testing privacy policy endpoint');
    
    const response = await fetch('/api/privacy/policy');
    
    if (response.ok) {
      const data = await response.json();
      console.log('✅ Privacy policy retrieval successful');
      console.log('- Policy version:', data.privacy_policy?.version);
      console.log('- Sections count:', Object.keys(data.privacy_policy?.sections || {}).length);
      console.log('- GDPR compliant:', data.compliance_info?.gdpr_compliant);
      return { success: true, data };
    } else {
      const error = await response.json();
      console.log('❌ Privacy policy failed:', error.message);
      return { success: false, error };
    }
  } catch (error) {
    console.log('❌ Privacy policy error:', error.message);
    return { success: false, error: error.message };
  }
};

// Test privacy audit log creation
export const testPrivacyAuditLog = async (userId, action = 'privacy_test') => {
  try {
    console.log('Testing privacy audit log creation');
    
    const { error } = await supabase
      .from('privacy_audit_log')
      .insert({
        user_id: userId,
        action: action,
        ip_address: '127.0.0.1',
        user_agent: 'Test Suite',
        metadata: {
          test: true,
          timestamp: new Date().toISOString(),
          description: 'Automated privacy functionality test'
        }
      });

    if (!error) {
      console.log('✅ Privacy audit log creation successful');
      
      // Retrieve the log to verify
      const { data: logs, error: retrieveError } = await supabase
        .from('privacy_audit_log')
        .select('*')
        .eq('user_id', userId)
        .eq('action', action)
        .order('created_at', { ascending: false })
        .limit(1);

      if (!retrieveError && logs && logs.length > 0) {
        console.log('✅ Privacy audit log retrieval successful');
        console.log('- Log ID:', logs[0].id);
        console.log('- Action:', logs[0].action);
        console.log('- Created at:', logs[0].created_at);
        return { success: true, data: logs[0] };
      } else {
        console.log('❌ Privacy audit log retrieval failed:', retrieveError?.message);
        return { success: false, error: retrieveError };
      }
    } else {
      console.log('❌ Privacy audit log creation failed:', error.message);
      return { success: false, error };
    }
  } catch (error) {
    console.log('❌ Privacy audit log error:', error.message);
    return { success: false, error: error.message };
  }
};

// Run all privacy tests
export const runPrivacyTests = async (userId, token) => {
  console.log('🧪 Starting Privacy Functionality Tests');
  console.log('=====================================');
  
  const results = {};
  
  // Test 1: Privacy Policy
  console.log('\n📄 Test 1: Privacy Policy Endpoint');
  results.privacyPolicy = await testPrivacyPolicy();
  
  // Test 2: Consent Management
  if (userId && token) {
    console.log('\n🔒 Test 2: Consent Management');
    results.consentManagement = await testConsentManagement(userId, token);
    
    // Test 3: Data Export
    console.log('\n📥 Test 3: Data Export');
    results.dataExport = await testDataExport(userId, token);
    
    // Test 4: Privacy Audit Log
    console.log('\n📝 Test 4: Privacy Audit Log');
    results.auditLog = await testPrivacyAuditLog(userId, 'privacy_functionality_test');
  } else {
    console.log('\n⚠️  Skipping authenticated tests - no user ID or token provided');
  }
  
  console.log('\n📊 Test Results Summary');
  console.log('=======================');
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(result => result.success).length;
  
  console.log(`Total tests: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${totalTests - passedTests}`);
  
  Object.entries(results).forEach(([testName, result]) => {
    console.log(`${result.success ? '✅' : '❌'} ${testName}`);
  });
  
  if (passedTests === totalTests) {
    console.log('\n🎉 All privacy tests passed!');
  } else {
    console.log('\n⚠️  Some privacy tests failed. Check logs above for details.');
  }
  
  return results;
};

// Export for use in other test files
export default {
  testDataExport,
  testConsentManagement,
  testPrivacyPolicy,
  testPrivacyAuditLog,
  runPrivacyTests
};