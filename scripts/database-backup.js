#!/usr/bin/env node

/**
 * Production Database Backup Script for PDF-to-Text SaaS
 * 
 * This script handles:
 * - Automated Supabase database backups
 * - Backup validation and verification
 * - Backup retention management
 * - Disaster recovery preparation
 * - Backup monitoring and alerting
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

class DatabaseBackupManager {
  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.backupDir = process.env.BACKUP_DIR || './backups';
    this.retentionDays = parseInt(process.env.BACKUP_RETENTION_DAYS) || 30;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '✓',
      warn: '⚠',
      error: '✗',
      progress: '⏳'
    }[type] || 'ℹ';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
    
    // Also log to file for monitoring
    const logFile = path.join(this.backupDir, 'backup.log');
    const logEntry = `${timestamp} [${type.toUpperCase()}] ${message}\n`;
    
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    fs.appendFileSync(logFile, logEntry);
  }

  async validateBackupEnvironment() {
    this.log('Validating backup environment...', 'progress');
    
    const requiredEnvVars = [
      'VITE_SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    const missing = requiredEnvVars.filter(envVar => !process.env[envVar]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
    
    // Test Supabase connection
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('count(*)')
        .limit(1);
      
      if (error) {
        throw new Error(`Supabase connection test failed: ${error.message}`);
      }
      
      this.log('Supabase connection validated successfully');
    } catch (error) {
      throw new Error(`Database connection validation failed: ${error.message}`);
    }
  }

  async createDataSnapshot() {
    this.log('Creating database snapshot...', 'progress');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const snapshotDir = path.join(this.backupDir, `snapshot-${timestamp}`);
    
    if (!fs.existsSync(snapshotDir)) {
      fs.mkdirSync(snapshotDir, { recursive: true });
    }
    
    const tables = [
      'users',
      'processing_history',
      'subscriptions',
      'usage_tracking',
      'audit_logs',
      'admin_audit_logs',
      'security_events',
      'system_metrics'
    ];
    
    const snapshot = {
      timestamp: new Date().toISOString(),
      tables: {},
      metadata: {
        totalRecords: 0,
        backupVersion: '1.0',
        environment: process.env.NODE_ENV || 'development'
      }
    };
    
    for (const table of tables) {
      try {
        this.log(`Backing up table: ${table}`);
        
        const { data, error } = await this.supabase
          .from(table)
          .select('*');
        
        if (error) {
          this.log(`Warning: Failed to backup table ${table}: ${error.message}`, 'warn');
          continue;
        }
        
        snapshot.tables[table] = data || [];
        snapshot.metadata.totalRecords += (data || []).length;
        
        // Save individual table backup
        const tableFile = path.join(snapshotDir, `${table}.json`);
        fs.writeFileSync(tableFile, JSON.stringify(data, null, 2));
        
        this.log(`✓ Backed up ${(data || []).length} records from ${table}`);
      } catch (error) {
        this.log(`Error backing up table ${table}: ${error.message}`, 'error');
      }
    }
    
    // Save complete snapshot
    const snapshotFile = path.join(snapshotDir, 'complete-snapshot.json');
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
    
    // Create compressed backup
    try {
      const zipFile = `${snapshotDir}.zip`;
      execSync(`zip -r "${zipFile}" "${snapshotDir}"`, { stdio: 'inherit' });
      this.log(`Compressed backup created: ${zipFile}`);
      
      // Remove uncompressed directory to save space
      fs.rmSync(snapshotDir, { recursive: true });
    } catch (error) {
      this.log(`Warning: Failed to compress backup: ${error.message}`, 'warn');
    }
    
    this.log(`Database snapshot completed. Total records: ${snapshot.metadata.totalRecords}`);
    return snapshot;
  }

  async createSchemaBackup() {
    this.log('Creating database schema backup...', 'progress');
    
    try {
      // Get database schema information
      const { data: tables, error: tablesError } = await this.supabase
        .rpc('get_table_info');
      
      if (tablesError) {
        this.log(`Warning: Could not retrieve schema info: ${tablesError.message}`, 'warn');
        return null;
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const schemaFile = path.join(this.backupDir, `schema-${timestamp}.json`);
      
      const schemaBackup = {
        timestamp: new Date().toISOString(),
        tables: tables || [],
        metadata: {
          backupVersion: '1.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };
      
      fs.writeFileSync(schemaFile, JSON.stringify(schemaBackup, null, 2));
      this.log(`Schema backup saved: ${schemaFile}`);
      
      return schemaBackup;
    } catch (error) {
      this.log(`Error creating schema backup: ${error.message}`, 'error');
      return null;
    }
  }

  async validateBackup(snapshotData) {
    this.log('Validating backup integrity...', 'progress');
    
    let isValid = true;
    const validationResults = [];
    
    // Check if backup has data
    if (!snapshotData || !snapshotData.tables) {
      validationResults.push('ERROR: Backup data is empty or invalid');
      isValid = false;
    }
    
    // Validate critical tables
    const criticalTables = ['users', 'processing_history', 'subscriptions'];
    
    for (const table of criticalTables) {
      if (!snapshotData.tables[table]) {
        validationResults.push(`WARNING: Critical table ${table} is missing from backup`);
        isValid = false;
      } else if (snapshotData.tables[table].length === 0) {
        validationResults.push(`INFO: Table ${table} is empty (this may be normal)`);
      }
    }
    
    // Check for recent data
    const recentThreshold = new Date();
    recentThreshold.setHours(recentThreshold.getHours() - 24);
    
    if (snapshotData.tables.users && snapshotData.tables.users.length > 0) {
      const recentUsers = snapshotData.tables.users.filter(user => 
        new Date(user.created_at) > recentThreshold
      );
      
      if (recentUsers.length === 0) {
        validationResults.push('INFO: No recent user registrations found (last 24h)');
      }
    }
    
    validationResults.forEach(result => {
      const type = result.startsWith('ERROR') ? 'error' : 
                   result.startsWith('WARNING') ? 'warn' : 'info';
      this.log(result, type);
    });
    
    if (isValid) {
      this.log('✓ Backup validation passed');
    } else {
      this.log('✗ Backup validation failed', 'error');
    }
    
    return { isValid, results: validationResults };
  }

  async cleanupOldBackups() {
    this.log('Cleaning up old backups...', 'progress');
    
    if (!fs.existsSync(this.backupDir)) {
      return;
    }
    
    const files = fs.readdirSync(this.backupDir);
    const now = new Date();
    const cutoffDate = new Date(now.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000));
    
    let deletedCount = 0;
    
    for (const file of files) {
      const filePath = path.join(this.backupDir, file);
      const stats = fs.statSync(filePath);
      
      if (stats.isFile() && stats.mtime < cutoffDate) {
        if (file.startsWith('snapshot-') || file.startsWith('schema-')) {
          fs.unlinkSync(filePath);
          deletedCount++;
          this.log(`Deleted old backup: ${file}`);
        }
      }
    }
    
    this.log(`Cleanup completed. Deleted ${deletedCount} old backup files`);
  }

  async generateBackupReport(snapshotData, validationResults) {
    const report = {
      timestamp: new Date().toISOString(),
      success: validationResults.isValid,
      totalRecords: snapshotData?.metadata?.totalRecords || 0,
      tables: Object.keys(snapshotData?.tables || {}),
      validation: validationResults.results,
      retentionPolicy: `${this.retentionDays} days`,
      nextScheduledBackup: this.getNextScheduledBackup(),
      backupSize: this.getBackupDirectorySize(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    const reportFile = path.join(this.backupDir, 'latest-backup-report.json');
    fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
    
    this.log(`Backup report generated: ${reportFile}`);
    return report;
  }

  getNextScheduledBackup() {
    const schedule = process.env.BACKUP_SCHEDULE || '0 2 * * *'; // Default: 2 AM daily
    // This would typically use a cron parser, but for simplicity:
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0);
    return tomorrow.toISOString();
  }

  getBackupDirectorySize() {
    if (!fs.existsSync(this.backupDir)) {
      return '0 MB';
    }
    
    try {
      const output = execSync(`du -sh "${this.backupDir}"`, { encoding: 'utf8' });
      return output.split('\t')[0];
    } catch {
      return 'Unknown';
    }
  }

  async runBackup() {
    this.log('Starting database backup process...', 'progress');
    
    try {
      await this.validateBackupEnvironment();
      
      const snapshotData = await this.createDataSnapshot();
      await this.createSchemaBackup();
      
      const validationResults = await this.validateBackup(snapshotData);
      
      await this.cleanupOldBackups();
      
      const report = await this.generateBackupReport(snapshotData, validationResults);
      
      if (report.success) {
        this.log('🎉 Database backup completed successfully!');
        this.log(`📊 Backed up ${report.totalRecords} records across ${report.tables.length} tables`);
      } else {
        this.log('❌ Database backup completed with warnings/errors', 'warn');
      }
      
      return report;
      
    } catch (error) {
      this.log(`Fatal backup error: ${error.message}`, 'error');
      throw error;
    }
  }
}

// Run backup if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const backupManager = new DatabaseBackupManager();
  backupManager.runBackup()
    .then(report => {
      console.log('Backup completed successfully');
      process.exit(0);
    })
    .catch(error => {
      console.error('Backup failed:', error);
      process.exit(1);
    });
}

export default DatabaseBackupManager;