import { promises as fs } from 'fs';
import path from 'path';
import { downloadManager } from './downloadManager';

export interface CleanupConfig {
  tempDirectory: string;
  maxAge: number; // in milliseconds
  maxSize: number; // in bytes
  schedulingInterval: number; // in milliseconds
  cleanupOnStartup: boolean;
  retainDownloadFiles: number; // hours to retain download files
  retainTempFiles: number; // hours to retain temporary files
}

export interface CleanupStats {
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
  duration: number;
  timestamp: Date;
}

export interface FileCleanupResult {
  success: boolean;
  stats: CleanupStats;
  errors: string[];
}

/**
 * Automated file cleanup system for temporary files and downloads
 */
export class FileCleanupManager {
  private config: CleanupConfig;
  private isRunning: boolean = false;
  private cleanupInterval?: NodeJS.Timeout;
  private lastCleanup?: Date;
  private totalCleanupsRun: number = 0;

  constructor(config: Partial<CleanupConfig> = {}) {
    this.config = {
      tempDirectory: process.env.TEMP_STORAGE_DIR || './temp',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      maxSize: 1024 * 1024 * 1024, // 1GB total size limit
      schedulingInterval: 60 * 60 * 1000, // 1 hour
      cleanupOnStartup: true,
      retainDownloadFiles: 24, // 24 hours
      retainTempFiles: 2, // 2 hours
      ...config
    };

    if (this.config.cleanupOnStartup) {
      // Run cleanup after a brief delay on startup
      setTimeout(() => this.performCleanup(), 30000); // 30 seconds delay
    }
  }

  /**
   * Start the automated cleanup scheduler
   */
  startScheduler(): void {
    if (this.isRunning) {
      console.warn('File cleanup scheduler is already running');
      return;
    }

    this.isRunning = true;
    
    this.cleanupInterval = setInterval(() => {
      this.performCleanup().catch(error => {
        console.error('Scheduled cleanup failed:', error);
      });
    }, this.config.schedulingInterval);

    console.log(`File cleanup scheduler started (interval: ${this.config.schedulingInterval}ms)`);
  }

  /**
   * Stop the automated cleanup scheduler
   */
  stopScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    
    this.isRunning = false;
    console.log('File cleanup scheduler stopped');
  }

  /**
   * Perform comprehensive file cleanup
   */
  async performCleanup(): Promise<FileCleanupResult> {
    const startTime = Date.now();
    const stats: CleanupStats = {
      filesDeleted: 0,
      bytesFreed: 0,
      errors: [],
      duration: 0,
      timestamp: new Date()
    };

    try {
      console.log('Starting automated file cleanup...');

      // Clean up temporary files
      await this.cleanupTempFiles(stats);

      // Clean up download files (coordinate with download manager)
      await this.cleanupDownloadFiles(stats);

      // Clean up orphaned files
      await this.cleanupOrphanedFiles(stats);

      // Check total directory size and enforce limits
      await this.enforceSizeLimits(stats);

      stats.duration = Date.now() - startTime;
      this.lastCleanup = new Date();
      this.totalCleanupsRun++;

      console.log(`File cleanup completed: ${stats.filesDeleted} files deleted, ${this.formatBytes(stats.bytesFreed)} freed in ${stats.duration}ms`);

      return {
        success: true,
        stats,
        errors: stats.errors
      };

    } catch (error) {
      stats.duration = Date.now() - startTime;
      stats.errors.push(error instanceof Error ? error.message : String(error));

      console.error('File cleanup failed:', error);

      return {
        success: false,
        stats,
        errors: stats.errors
      };
    }
  }

  /**
   * Clean up temporary files older than configured age
   */
  private async cleanupTempFiles(stats: CleanupStats): Promise<void> {
    const tempDir = this.config.tempDirectory;
    const maxAge = this.config.retainTempFiles * 60 * 60 * 1000; // Convert hours to milliseconds
    const cutoffTime = Date.now() - maxAge;

    try {
      // Ensure directory exists
      await fs.mkdir(tempDir, { recursive: true });

      const files = await fs.readdir(tempDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(tempDir, file.name);
          
          try {
            const fileStat = await fs.stat(filePath);
            
            // Check if file is older than cutoff time
            if (fileStat.mtime.getTime() < cutoffTime) {
              // Skip files that might be in use by download manager
              if (this.isDownloadFile(file.name)) {
                continue;
              }
              
              await fs.unlink(filePath);
              stats.filesDeleted++;
              stats.bytesFreed += fileStat.size;
              
              console.log(`Deleted temp file: ${file.name} (${this.formatBytes(fileStat.size)})`);
            }
          } catch (fileError) {
            stats.errors.push(`Failed to process temp file ${file.name}: ${fileError}`);
          }
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to clean temp directory: ${error}`);
    }
  }

  /**
   * Clean up download files in coordination with download manager
   */
  private async cleanupDownloadFiles(stats: CleanupStats): Promise<void> {
    try {
      // Let the download manager handle its own cleanup
      // We just check for any files that might have been missed
      
      const tempDir = this.config.tempDirectory;
      const files = await fs.readdir(tempDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && file.name.endsWith('.data')) {
          const filePath = path.join(tempDir, file.name);
          
          try {
            const fileStat = await fs.stat(filePath);
            const linkId = file.name.replace('.data', '');
            
            // Check if this file has a corresponding download link
            const validation = await downloadManager.validateAndGetFile(linkId, 'dummy-token');
            
            if (!validation.valid && validation.error?.includes('not found')) {
              // This is an orphaned download file
              await fs.unlink(filePath);
              stats.filesDeleted++;
              stats.bytesFreed += fileStat.size;
              
              console.log(`Deleted orphaned download file: ${file.name} (${this.formatBytes(fileStat.size)})`);
            }
          } catch (fileError) {
            stats.errors.push(`Failed to process download file ${file.name}: ${fileError}`);
          }
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to clean download files: ${error}`);
    }
  }

  /**
   * Clean up orphaned files that don't match expected patterns
   */
  private async cleanupOrphanedFiles(stats: CleanupStats): Promise<void> {
    const tempDir = this.config.tempDirectory;
    const maxAge = 6 * 60 * 60 * 1000; // 6 hours for orphaned files
    const cutoffTime = Date.now() - maxAge;

    try {
      const files = await fs.readdir(tempDir, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(tempDir, file.name);
          
          try {
            const fileStat = await fs.stat(filePath);
            
            // Check if file matches expected patterns
            const isExpectedPattern = this.isExpectedFilePattern(file.name);
            
            if (!isExpectedPattern && fileStat.mtime.getTime() < cutoffTime) {
              await fs.unlink(filePath);
              stats.filesDeleted++;
              stats.bytesFreed += fileStat.size;
              
              console.log(`Deleted orphaned file: ${file.name} (${this.formatBytes(fileStat.size)})`);
            }
          } catch (fileError) {
            stats.errors.push(`Failed to process orphaned file ${file.name}: ${fileError}`);
          }
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to clean orphaned files: ${error}`);
    }
  }

  /**
   * Enforce total directory size limits
   */
  private async enforceSizeLimits(stats: CleanupStats): Promise<void> {
    try {
      const tempDir = this.config.tempDirectory;
      const totalSize = await this.calculateDirectorySize(tempDir);
      
      if (totalSize > this.config.maxSize) {
        console.log(`Directory size (${this.formatBytes(totalSize)}) exceeds limit (${this.formatBytes(this.config.maxSize)}), enforcing cleanup`);
        
        // Get all files sorted by modification time (oldest first)
        const files = await this.getFilesByAge(tempDir);
        
        let currentSize = totalSize;
        for (const file of files) {
          if (currentSize <= this.config.maxSize * 0.8) { // Clean to 80% of limit
            break;
          }
          
          try {
            await fs.unlink(file.path);
            currentSize -= file.size;
            stats.filesDeleted++;
            stats.bytesFreed += file.size;
            
            console.log(`Deleted for size limit: ${file.name} (${this.formatBytes(file.size)})`);
          } catch (fileError) {
            stats.errors.push(`Failed to delete file for size limit ${file.name}: ${fileError}`);
          }
        }
      }
    } catch (error) {
      stats.errors.push(`Failed to enforce size limits: ${error}`);
    }
  }

  /**
   * Calculate total size of directory
   */
  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let totalSize = 0;
    
    try {
      const files = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile()) {
          const filePath = path.join(dirPath, file.name);
          const fileStat = await fs.stat(filePath);
          totalSize += fileStat.size;
        }
      }
    } catch (error) {
      console.warn('Failed to calculate directory size:', error);
    }
    
    return totalSize;
  }

  /**
   * Get files sorted by age (oldest first)
   */
  private async getFilesByAge(dirPath: string): Promise<Array<{
    name: string;
    path: string;
    size: number;
    mtime: Date;
  }>> {
    const files: Array<{ name: string; path: string; size: number; mtime: Date }> = [];
    
    try {
      const dirFiles = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const file of dirFiles) {
        if (file.isFile()) {
          const filePath = path.join(dirPath, file.name);
          const fileStat = await fs.stat(filePath);
          
          files.push({
            name: file.name,
            path: filePath,
            size: fileStat.size,
            mtime: fileStat.mtime
          });
        }
      }
    } catch (error) {
      console.warn('Failed to get files by age:', error);
    }
    
    // Sort by modification time (oldest first)
    return files.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
  }

  /**
   * Check if filename matches expected patterns
   */
  private isExpectedFilePattern(filename: string): boolean {
    const patterns = [
      /^[a-zA-Z0-9_]+\.data$/, // Download files
      /^temp_[a-zA-Z0-9_]+\.(pdf|txt|md|docx)$/, // Temporary processing files
      /^upload_[a-zA-Z0-9_]+\.pdf$/, // Upload files
    ];
    
    return patterns.some(pattern => pattern.test(filename));
  }

  /**
   * Check if file is a download file managed by download manager
   */
  private isDownloadFile(filename: string): boolean {
    return filename.endsWith('.data') && /^[a-zA-Z0-9_]+\.data$/.test(filename);
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Get cleanup statistics
   */
  getStats(): {
    isRunning: boolean;
    lastCleanup: Date | undefined;
    totalCleanupsRun: number;
    config: CleanupConfig;
  } {
    return {
      isRunning: this.isRunning,
      lastCleanup: this.lastCleanup,
      totalCleanupsRun: this.totalCleanupsRun,
      config: { ...this.config }
    };
  }

  /**
   * Force cleanup immediately
   */
  async forceCleanup(): Promise<FileCleanupResult> {
    console.log('Force cleanup requested');
    return await this.performCleanup();
  }
}

// Global cleanup manager instance
export const fileCleanupManager = new FileCleanupManager();

// Auto-start scheduler
fileCleanupManager.startScheduler();