/**
 * API Key Rotation System
 * Automated rotation and management of API keys for external services
 */

import { createClient } from '@supabase/supabase-js';

export interface APIKeyConfig {
  serviceName: string;
  currentKey: string;
  previousKey?: string;
  rotationDate: Date;
  nextRotationDate: Date;
  rotationIntervalDays: number;
  isActive: boolean;
  environment: 'development' | 'staging' | 'production';
}

export interface RotationResult {
  success: boolean;
  serviceName: string;
  newKey?: string;
  error?: string;
  rotationDate: Date;
}

/**
 * API Key Rotation Manager
 */
export class APIKeyRotationManager {
  private supabase: any;
  private encryptionKey: string;
  
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-key-change-in-production';
  }
  
  /**
   * Initialize key rotation system
   */
  async initialize(): Promise<void> {
    try {
      // Create the keys table if it doesn't exist
      const { error } = await this.supabase.rpc('create_api_keys_table_if_not_exists');
      if (error && !error.message.includes('already exists')) {
        throw error;
      }
      
      // Setup default configurations for all services
      await this.setupDefaultConfigurations();
      
      console.log('API Key Rotation system initialized successfully');
    } catch (error) {
      console.error('Failed to initialize API Key Rotation system:', error);
      throw error;
    }
  }
  
  /**
   * Setup default configurations for all external services
   */
  private async setupDefaultConfigurations(): Promise<void> {
    const services = [
      {
        serviceName: 'stripe',
        rotationIntervalDays: 90, // Rotate every 3 months
        currentKey: process.env.STRIPE_SECRET_KEY || '',
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production'
      },
      {
        serviceName: 'supabase',
        rotationIntervalDays: 180, // Rotate every 6 months
        currentKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production'
      },
      {
        serviceName: 'google-document-ai',
        rotationIntervalDays: 365, // Rotate yearly
        currentKey: process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production'
      },
      {
        serviceName: 'virustotal',
        rotationIntervalDays: 180, // Rotate every 6 months
        currentKey: process.env.VIRUSTOTAL_API_KEY || '',
        environment: process.env.NODE_ENV as 'development' | 'staging' | 'production'
      }
    ];
    
    for (const service of services) {
      await this.upsertKeyConfiguration(service);
    }
  }
  
  /**
   * Upsert key configuration
   */
  private async upsertKeyConfiguration(config: Partial<APIKeyConfig>): Promise<void> {
    const now = new Date();
    const nextRotation = new Date(now.getTime() + (config.rotationIntervalDays! * 24 * 60 * 60 * 1000));
    
    const keyConfig: APIKeyConfig = {
      serviceName: config.serviceName!,
      currentKey: this.encryptKey(config.currentKey!),
      rotationDate: now,
      nextRotationDate: nextRotation,
      rotationIntervalDays: config.rotationIntervalDays!,
      isActive: true,
      environment: config.environment!
    };
    
    const { error } = await this.supabase
      .from('api_keys')
      .upsert(keyConfig, { onConflict: 'service_name,environment' });
      
    if (error) {
      throw new Error(`Failed to upsert key configuration for ${config.serviceName}: ${error.message}`);
    }
  }
  
  /**
   * Check which keys need rotation
   */
  async getKeysNeedingRotation(): Promise<APIKeyConfig[]> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('*')
      .lte('next_rotation_date', new Date().toISOString())
      .eq('is_active', true)
      .eq('environment', process.env.NODE_ENV);
      
    if (error) {
      throw new Error(`Failed to get keys needing rotation: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Rotate API key for a specific service
   */
  async rotateServiceKey(serviceName: string): Promise<RotationResult> {
    try {
      const rotationDate = new Date();
      let newKey: string;
      
      switch (serviceName.toLowerCase()) {
        case 'stripe':
          newKey = await this.rotateStripeKey();
          break;
        case 'supabase':
          newKey = await this.rotateSupabaseKey();
          break;
        case 'google-document-ai':
          newKey = await this.rotateGoogleDocumentAIKey();
          break;
        case 'virustotal':
          newKey = await this.rotateVirusTotalKey();
          break;
        default:
          throw new Error(`Unsupported service: ${serviceName}`);
      }
      
      // Update the key in database
      await this.updateKeyInDatabase(serviceName, newKey);
      
      // Log the successful rotation
      await this.logKeyRotation(serviceName, true, 'Key rotated successfully');
      
      return {
        success: true,
        serviceName,
        newKey: this.maskKey(newKey),
        rotationDate
      };
      
    } catch (error) {
      // Log the failed rotation
      await this.logKeyRotation(serviceName, false, error.message);
      
      return {
        success: false,
        serviceName,
        error: error.message,
        rotationDate: new Date()
      };
    }
  }
  
  /**
   * Rotate all keys that are due for rotation
   */
  async rotateAllDueKeys(): Promise<RotationResult[]> {
    const keysNeedingRotation = await this.getKeysNeedingRotation();
    const results: RotationResult[] = [];
    
    for (const keyConfig of keysNeedingRotation) {
      const result = await this.rotateServiceKey(keyConfig.serviceName);
      results.push(result);
      
      // Add delay between rotations to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    
    return results;
  }
  
  /**
   * Stripe key rotation (placeholder - requires manual intervention)
   */
  private async rotateStripeKey(): Promise<string> {
    // Note: Stripe doesn't support automatic key rotation via API
    // This would require manual intervention or integration with a secrets manager
    throw new Error('Stripe key rotation requires manual intervention. Please rotate in Stripe dashboard and update environment variables.');
  }
  
  /**
   * Supabase key rotation (placeholder - requires manual intervention)
   */
  private async rotateSupabaseKey(): Promise<string> {
    // Note: Supabase service role keys require manual rotation
    throw new Error('Supabase key rotation requires manual intervention. Please generate new key in Supabase dashboard.');
  }
  
  /**
   * Google Document AI key rotation
   */
  private async rotateGoogleDocumentAIKey(): Promise<string> {
    // Note: Google service account keys should be rotated through Google Cloud Console
    // or using Google Cloud SDK programmatically
    throw new Error('Google Document AI key rotation requires Google Cloud Console access or SDK integration.');
  }
  
  /**
   * VirusTotal key rotation (placeholder)
   */
  private async rotateVirusTotalKey(): Promise<string> {
    // Note: VirusTotal doesn't support automatic key rotation
    throw new Error('VirusTotal key rotation requires manual intervention in VirusTotal console.');
  }
  
  /**
   * Update key in database
   */
  private async updateKeyInDatabase(serviceName: string, newKey: string): Promise<void> {
    const { data: currentConfig } = await this.supabase
      .from('api_keys')
      .select('*')
      .eq('service_name', serviceName)
      .eq('environment', process.env.NODE_ENV)
      .single();
      
    if (currentConfig) {
      const nextRotation = new Date();
      nextRotation.setDate(nextRotation.getDate() + currentConfig.rotation_interval_days);
      
      const { error } = await this.supabase
        .from('api_keys')
        .update({
          previous_key: currentConfig.current_key,
          current_key: this.encryptKey(newKey),
          rotation_date: new Date().toISOString(),
          next_rotation_date: nextRotation.toISOString()
        })
        .eq('service_name', serviceName)
        .eq('environment', process.env.NODE_ENV);
        
      if (error) {
        throw new Error(`Failed to update key in database: ${error.message}`);
      }
    }
  }
  
  /**
   * Log key rotation event
   */
  private async logKeyRotation(serviceName: string, success: boolean, message: string): Promise<void> {
    const logEntry = {
      service_name: serviceName,
      rotation_date: new Date().toISOString(),
      success,
      message,
      environment: process.env.NODE_ENV,
      user_id: 'system' // System-initiated rotation
    };
    
    const { error } = await this.supabase
      .from('key_rotation_logs')
      .insert(logEntry);
      
    if (error) {
      console.error('Failed to log key rotation:', error);
    }
  }
  
  /**
   * Get key rotation history
   */
  async getRotationHistory(serviceName?: string, limit = 50): Promise<any[]> {
    let query = this.supabase
      .from('key_rotation_logs')
      .select('*')
      .order('rotation_date', { ascending: false })
      .limit(limit);
      
    if (serviceName) {
      query = query.eq('service_name', serviceName);
    }
    
    const { data, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get rotation history: ${error.message}`);
    }
    
    return data || [];
  }
  
  /**
   * Encrypt API key for storage
   */
  private encryptKey(key: string): string {
    // Simple encryption - in production, use a proper encryption library
    const crypto = require('crypto');
    const cipher = crypto.createCipher('aes192', this.encryptionKey);
    let encrypted = cipher.update(key, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
  }
  
  /**
   * Decrypt API key from storage
   */
  private decryptKey(encryptedKey: string): string {
    const crypto = require('crypto');
    const decipher = crypto.createDecipher('aes192', this.encryptionKey);
    let decrypted = decipher.update(encryptedKey, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
  
  /**
   * Mask key for logging (show only last 4 characters)
   */
  private maskKey(key: string): string {
    if (key.length <= 4) return '****';
    return '*'.repeat(key.length - 4) + key.slice(-4);
  }
  
  /**
   * Test key validity
   */
  async testKeyValidity(serviceName: string, key?: string): Promise<boolean> {
    try {
      const testKey = key || await this.getActiveKey(serviceName);
      
      switch (serviceName.toLowerCase()) {
        case 'stripe':
          return await this.testStripeKey(testKey);
        case 'supabase':
          return await this.testSupabaseKey(testKey);
        case 'google-document-ai':
          return await this.testGoogleDocumentAIKey(testKey);
        case 'virustotal':
          return await this.testVirusTotalKey(testKey);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Failed to test key validity for ${serviceName}:`, error);
      return false;
    }
  }
  
  /**
   * Get active key for a service
   */
  async getActiveKey(serviceName: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('api_keys')
      .select('current_key')
      .eq('service_name', serviceName)
      .eq('environment', process.env.NODE_ENV)
      .eq('is_active', true)
      .single();
      
    if (error || !data) {
      throw new Error(`No active key found for ${serviceName}`);
    }
    
    return this.decryptKey(data.current_key);
  }
  
  /**
   * Test Stripe key validity
   */
  private async testStripeKey(key: string): Promise<boolean> {
    try {
      const response = await fetch('https://api.stripe.com/v1/account', {
        headers: {
          'Authorization': `Bearer ${key}`
        }
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Test Supabase key validity
   */
  private async testSupabaseKey(key: string): Promise<boolean> {
    try {
      const testClient = createClient(process.env.VITE_SUPABASE_URL!, key);
      const { error } = await testClient.from('users').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
  
  /**
   * Test Google Document AI key validity
   */
  private async testGoogleDocumentAIKey(key: string): Promise<boolean> {
    // This would require implementing Google Cloud authentication test
    // Placeholder for actual implementation
    return true;
  }
  
  /**
   * Test VirusTotal key validity
   */
  private async testVirusTotalKey(key: string): Promise<boolean> {
    try {
      const response = await fetch(`https://www.virustotal.com/vtapi/v2/file/report?apikey=${key}&resource=test`);
      return response.ok;
    } catch {
      return false;
    }
  }
  
  /**
   * Schedule automatic rotation check
   */
  setupRotationSchedule(): void {
    // Check for keys needing rotation every 24 hours
    setInterval(async () => {
      try {
        console.log('Running scheduled key rotation check...');
        const results = await this.rotateAllDueKeys();
        
        if (results.length > 0) {
          console.log('Key rotation results:', results);
          
          // Alert admins if there were any failures
          const failures = results.filter(r => !r.success);
          if (failures.length > 0) {
            await this.alertAdminsAboutRotationFailures(failures);
          }
        }
      } catch (error) {
        console.error('Scheduled key rotation failed:', error);
      }
    }, 24 * 60 * 60 * 1000); // 24 hours
  }
  
  /**
   * Alert administrators about rotation failures
   */
  private async alertAdminsAboutRotationFailures(failures: RotationResult[]): Promise<void> {
    // Implement alerting mechanism (email, Slack, etc.)
    console.error('🚨 Key rotation failures:', failures);
    // TODO: Implement actual alerting
  }
}

// Singleton instance
export const keyRotationManager = new APIKeyRotationManager();