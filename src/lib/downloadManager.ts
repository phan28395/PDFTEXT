import { createHash, randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { GeneratedOutput } from './outputFormats';

export interface DownloadLink {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  expiresAt: Date;
  accessToken: string;
  downloadUrl: string;
  metadata?: any;
}

export interface DownloadManagerOptions {
  baseUrl: string;
  expirationHours: number;
  storageDirectory: string;
  maxFileSize: number;
  allowedMimeTypes: string[];
}

export class DownloadManager {
  private options: DownloadManagerOptions;
  private activeBonds: Map<string, DownloadLink> = new Map();

  constructor(options: Partial<DownloadManagerOptions> = {}) {
    this.options = {
      baseUrl: process.env.BASE_URL || 'http://localhost:3000',
      expirationHours: 24,
      storageDirectory: process.env.TEMP_STORAGE_DIR || './temp',
      maxFileSize: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: [
        'text/plain',
        'text/markdown',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ],
      ...options
    };

    // Ensure storage directory exists
    this.ensureStorageDirectory();
    
    // Start cleanup scheduler
    this.startCleanupScheduler();
  }

  /**
   * Create a secure download link for generated output
   */
  async createDownloadLink(
    output: GeneratedOutput,
    userId: string,
    processingRecordId: string
  ): Promise<DownloadLink> {
    // Validate output
    this.validateOutput(output);

    // Generate secure identifiers
    const linkId = this.generateSecureId();
    const accessToken = this.generateAccessToken(linkId, userId);
    
    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.options.expirationHours);

    // Store file securely
    const secureFilename = await this.storeFile(linkId, output);

    // Create download link
    const downloadLink: DownloadLink = {
      id: linkId,
      filename: output.filename,
      mimeType: output.mimeType,
      size: output.size,
      expiresAt,
      accessToken,
      downloadUrl: `${this.options.baseUrl}/api/download/${linkId}?token=${accessToken}`,
      metadata: {
        userId,
        processingRecordId,
        originalFilename: output.filename,
        createdAt: new Date(),
        ...output.metadata
      }
    };

    // Store in memory cache
    this.activeBonds.set(linkId, downloadLink);

    return downloadLink;
  }

  /**
   * Validate download link and return file path if valid
   */
  async validateAndGetFile(linkId: string, token: string): Promise<{
    valid: boolean;
    filePath?: string;
    downloadLink?: DownloadLink;
    error?: string;
  }> {
    // Check if link exists
    const downloadLink = this.activeBonds.get(linkId);
    if (!downloadLink) {
      return { valid: false, error: 'Download link not found or expired' };
    }

    // Check expiration
    if (downloadLink.expiresAt < new Date()) {
      // Clean up expired link
      await this.cleanupLink(linkId);
      return { valid: false, error: 'Download link has expired' };
    }

    // Validate access token
    if (!this.validateAccessToken(token, linkId, downloadLink.metadata.userId)) {
      return { valid: false, error: 'Invalid access token' };
    }

    // Get file path
    const filePath = path.join(this.options.storageDirectory, `${linkId}.data`);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (error) {
      await this.cleanupLink(linkId);
      return { valid: false, error: 'File not found' };
    }

    return {
      valid: true,
      filePath,
      downloadLink
    };
  }

  /**
   * Get file content for download
   */
  async getFileContent(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      throw new Error('Failed to read file content');
    }
  }

  /**
   * Cleanup specific download link
   */
  async cleanupLink(linkId: string): Promise<void> {
    // Remove from memory cache
    this.activeBonds.delete(linkId);

    // Remove file
    const filePath = path.join(this.options.storageDirectory, `${linkId}.data`);
    try {
      await fs.unlink(filePath);
    } catch (error) {
      // File might already be deleted, ignore error
      console.warn(`Failed to delete file ${filePath}:`, error);
    }
  }

  /**
   * Get statistics about active downloads
   */
  getStatistics(): {
    activeLinks: number;
    totalSize: number;
    oldestLink: Date | null;
    newestLink: Date | null;
  } {
    const links = Array.from(this.activeBonds.values());
    
    return {
      activeLinks: links.length,
      totalSize: links.reduce((sum, link) => sum + link.size, 0),
      oldestLink: links.length > 0 
        ? new Date(Math.min(...links.map(l => l.metadata.createdAt.getTime())))
        : null,
      newestLink: links.length > 0
        ? new Date(Math.max(...links.map(l => l.metadata.createdAt.getTime())))
        : null
    };
  }

  /**
   * List active download links for a user
   */
  getUserDownloadLinks(userId: string): DownloadLink[] {
    return Array.from(this.activeBonds.values())
      .filter(link => link.metadata.userId === userId)
      .sort((a, b) => b.metadata.createdAt.getTime() - a.metadata.createdAt.getTime());
  }

  /**
   * Validate output before creating download link
   */
  private validateOutput(output: GeneratedOutput): void {
    // Check file size
    if (output.size > this.options.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.options.maxFileSize} bytes`);
    }

    // Check MIME type
    if (!this.options.allowedMimeTypes.includes(output.mimeType)) {
      throw new Error(`MIME type ${output.mimeType} is not allowed`);
    }

    // Check content exists
    if (!output.content) {
      throw new Error('Output content is empty');
    }

    // Check filename
    if (!output.filename || output.filename.trim().length === 0) {
      throw new Error('Output filename is missing or empty');
    }

    // Validate filename for security
    if (this.containsInvalidCharacters(output.filename)) {
      throw new Error('Filename contains invalid characters');
    }
  }

  /**
   * Generate secure random ID
   */
  private generateSecureId(): string {
    const timestamp = Date.now().toString(36);
    const randomPart = randomBytes(16).toString('hex');
    return `${timestamp}_${randomPart}`;
  }

  /**
   * Generate access token for download link
   */
  private generateAccessToken(linkId: string, userId: string): string {
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const data = `${linkId}:${userId}:${Date.now()}`;
    
    return createHash('sha256')
      .update(data + secret)
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * Validate access token
   */
  private validateAccessToken(token: string, linkId: string, userId: string): boolean {
    // For simplicity, we'll use a time-independent comparison
    // In production, you might want to use timing-safe comparison
    const expectedToken = this.generateAccessToken(linkId, userId);
    
    // Simple constant-time comparison
    if (token.length !== expectedToken.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < token.length; i++) {
      result |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
    }
    
    return result === 0;
  }

  /**
   * Store file securely on disk
   */
  private async storeFile(linkId: string, output: GeneratedOutput): Promise<string> {
    const filename = `${linkId}.data`;
    const filePath = path.join(this.options.storageDirectory, filename);

    try {
      if (Buffer.isBuffer(output.content)) {
        await fs.writeFile(filePath, output.content);
      } else {
        await fs.writeFile(filePath, output.content, 'utf8');
      }
      
      return filename;
    } catch (error) {
      throw new Error(`Failed to store file: ${error}`);
    }
  }

  /**
   * Ensure storage directory exists
   */
  private async ensureStorageDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.options.storageDirectory, { recursive: true });
    } catch (error) {
      console.error('Failed to create storage directory:', error);
    }
  }

  /**
   * Check for invalid characters in filename
   */
  private containsInvalidCharacters(filename: string): boolean {
    // Check for path traversal attempts and invalid characters
    const invalidPatterns = [
      /\.\./,  // Path traversal
      /[<>:"|?*]/,  // Windows invalid characters
      /[\x00-\x1f]/,  // Control characters
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i  // Windows reserved names
    ];

    return invalidPatterns.some(pattern => pattern.test(filename));
  }

  /**
   * Start automated cleanup scheduler
   */
  private startCleanupScheduler(): void {
    // Run cleanup every hour
    setInterval(() => {
      this.performCleanup();
    }, 60 * 60 * 1000);

    // Run initial cleanup after 5 minutes
    setTimeout(() => {
      this.performCleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Perform cleanup of expired links and files
   */
  private async performCleanup(): Promise<void> {
    const now = new Date();
    const expiredLinks: string[] = [];

    // Find expired links
    for (const [linkId, downloadLink] of this.activeBonds.entries()) {
      if (downloadLink.expiresAt < now) {
        expiredLinks.push(linkId);
      }
    }

    // Clean up expired links
    const cleanupPromises = expiredLinks.map(linkId => this.cleanupLink(linkId));
    await Promise.allSettled(cleanupPromises);

    if (expiredLinks.length > 0) {
      console.log(`Cleaned up ${expiredLinks.length} expired download links`);
    }

    // Also clean up orphaned files (files without corresponding links)
    await this.cleanupOrphanedFiles();
  }

  /**
   * Clean up orphaned files that don't have corresponding links
   */
  private async cleanupOrphanedFiles(): Promise<void> {
    try {
      const files = await fs.readdir(this.options.storageDirectory);
      const dataFiles = files.filter(file => file.endsWith('.data'));
      
      for (const file of dataFiles) {
        const linkId = file.replace('.data', '');
        if (!this.activeBonds.has(linkId)) {
          // This is an orphaned file
          const filePath = path.join(this.options.storageDirectory, file);
          try {
            await fs.unlink(filePath);
            console.log(`Cleaned up orphaned file: ${file}`);
          } catch (error) {
            console.warn(`Failed to cleanup orphaned file ${file}:`, error);
          }
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup orphaned files:', error);
    }
  }
}

// Global download manager instance
export const downloadManager = new DownloadManager();

/**
 * Utility functions for download link management
 */
export class DownloadLinkUtils {
  /**
   * Generate a user-friendly filename with timestamp
   */
  static generateTimestampedFilename(originalName: string, format: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
    const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    return `${sanitizedName}_${timestamp}.${format}`;
  }

  /**
   * Calculate human-readable file size
   */
  static formatFileSize(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Validate download URL format
   */
  static validateDownloadUrl(url: string): boolean {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.pathname.includes('/api/download/') && 
             parsedUrl.searchParams.has('token');
    } catch (error) {
      return false;
    }
  }

  /**
   * Extract link ID from download URL
   */
  static extractLinkIdFromUrl(url: string): string | null {
    try {
      const parsedUrl = new URL(url);
      const pathParts = parsedUrl.pathname.split('/');
      const downloadIndex = pathParts.indexOf('download');
      
      if (downloadIndex !== -1 && downloadIndex + 1 < pathParts.length) {
        return pathParts[downloadIndex + 1];
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }
}