import crypto from 'crypto';

// Rate limiting for security scans
const scanRateLimit = new Map<string, number[]>();
const SCAN_RATE_LIMIT = 4; // 4 scans per minute (VirusTotal limit)
const SCAN_RATE_WINDOW = 60 * 1000; // 1 minute

export interface SecurityScanResult {
  safe: boolean;
  scanId?: string;
  threats?: string[];
  details?: {
    engines: number;
    positives: number;
    scanned: boolean;
    permalink?: string;
  };
  error?: string;
}

/**
 * Check rate limit for security scans
 */
function checkScanRateLimit(ip: string): boolean {
  const now = Date.now();
  const windowStart = now - SCAN_RATE_WINDOW;
  
  if (!scanRateLimit.has(ip)) {
    scanRateLimit.set(ip, []);
  }
  
  const requests = scanRateLimit.get(ip)!;
  
  // Remove old requests outside the window
  while (requests.length > 0 && requests[0] < windowStart) {
    requests.shift();
  }
  
  // Check if rate limit exceeded
  if (requests.length >= SCAN_RATE_LIMIT) {
    return false;
  }
  
  // Add current request
  requests.push(now);
  return true;
}

/**
 * Calculate file hash for VirusTotal lookup
 */
export function calculateFileHash(fileBuffer: Buffer): string {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Validate file headers and structure for PDF files
 */
export function validatePDFStructure(fileBuffer: Buffer): { valid: boolean; error?: string } {
  try {
    // Check minimum file size
    if (fileBuffer.length < 1024) {
      return { valid: false, error: 'File too small to be a valid PDF' };
    }
    
    // Check PDF header
    const pdfHeader = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
    if (!fileBuffer.subarray(0, 4).equals(pdfHeader)) {
      return { valid: false, error: 'Invalid PDF header' };
    }
    
    // Check for PDF version
    const headerString = fileBuffer.subarray(0, 8).toString('ascii');
    const versionMatch = headerString.match(/%PDF-(\d\.\d)/);
    if (!versionMatch) {
      return { valid: false, error: 'Invalid PDF version header' };
    }
    
    const version = parseFloat(versionMatch[1]);
    if (version < 1.0 || version > 2.0) {
      return { valid: false, error: 'Unsupported PDF version' };
    }
    
    // Check for EOF marker
    const fileEnd = fileBuffer.subarray(-1024).toString('ascii');
    if (!fileEnd.includes('%%EOF')) {
      return { valid: false, error: 'Invalid PDF structure - missing EOF marker' };
    }
    
    // Basic structure validation - look for key PDF elements
    const fileContent = fileBuffer.toString('ascii', 0, Math.min(fileBuffer.length, 10240));
    
    // Check for suspicious JavaScript or Forms (potential security risks)
    const suspiciousPatterns = [
      '/JavaScript',
      '/JS',
      '/OpenAction',
      '/AA',
      '/XFA',
      'eval(',
      'unescape(',
      'String.fromCharCode('
    ];
    
    for (const pattern of suspiciousPatterns) {
      if (fileContent.includes(pattern)) {
        console.warn(`PDF contains potentially suspicious element: ${pattern}`);
        // Log but don't block - Document AI can handle these safely
      }
    }
    
    return { valid: true };
    
  } catch (error) {
    console.error('PDF validation error:', error);
    return { valid: false, error: 'Failed to validate PDF structure' };
  }
}

/**
 * Scan file with VirusTotal API
 * Note: This requires VIRUSTOTAL_API_KEY environment variable
 */
export async function scanWithVirusTotal(fileBuffer: Buffer, clientIP: string): Promise<SecurityScanResult> {
  try {
    // Check rate limit
    if (!checkScanRateLimit(clientIP)) {
      return {
        safe: true, // Allow through if rate limited
        error: 'Rate limit exceeded for security scans'
      };
    }
    
    const apiKey = process.env.VIRUSTOTAL_API_KEY;
    if (!apiKey) {
      console.warn('VirusTotal API key not configured - skipping malware scan');
      return { safe: true };
    }
    
    const fileHash = calculateFileHash(fileBuffer);
    
    // First, try to get existing scan results
    const reportResponse = await fetch(`https://www.virustotal.com/api/v3/files/${fileHash}`, {
      method: 'GET',
      headers: {
        'x-apikey': apiKey
      }
    });
    
    if (reportResponse.ok) {
      const reportData = await reportResponse.json();
      const stats = reportData.data?.attributes?.last_analysis_stats;
      
      if (stats) {
        const positives = stats.malicious || 0;
        const total = stats.malicious + stats.clean + stats.undetected + stats.suspicious;
        
        return {
          safe: positives === 0,
          threats: positives > 0 ? ['Malware detected by multiple engines'] : undefined,
          details: {
            engines: total,
            positives,
            scanned: true,
            permalink: `https://www.virustotal.com/gui/file/${fileHash}`
          }
        };
      }
    }
    
    // If no existing results, submit for scanning (but don't wait)
    try {
      const formData = new FormData();
      formData.append('file', new Blob([fileBuffer]));
      
      const uploadResponse = await fetch('https://www.virustotal.com/api/v3/files', {
        method: 'POST',
        headers: {
          'x-apikey': apiKey
        },
        body: formData
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        return {
          safe: true, // Allow through while scanning
          scanId: uploadData.data?.id,
          details: {
            engines: 0,
            positives: 0,
            scanned: false
          }
        };
      }
    } catch (uploadError) {
      console.warn('VirusTotal upload failed:', uploadError);
    }
    
    // Default to safe if scanning fails
    return { safe: true };
    
  } catch (error) {
    console.error('VirusTotal scan error:', error);
    // Default to safe on error - don't block legitimate files
    return { 
      safe: true,
      error: 'Security scan failed - file allowed through'
    };
  }
}

/**
 * Comprehensive file security validation
 */
export async function validateFileSecurity(
  fileBuffer: Buffer, 
  filename: string, 
  clientIP: string
): Promise<{ safe: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // 1. File extension validation
    const allowedExtensions = ['.pdf'];
    const extension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
    if (!allowedExtensions.includes(extension)) {
      errors.push('Only PDF files are allowed');
    }
    
    // 2. Filename security validation
    const dangerousChars = /[<>:"|?*\x00-\x1f]/;
    if (dangerousChars.test(filename)) {
      errors.push('Filename contains potentially dangerous characters');
    }
    
    if (filename.length > 255) {
      errors.push('Filename is too long');
    }
    
    // Check for path traversal attempts
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      errors.push('Filename contains invalid path characters');
    }
    
    // 3. File size validation
    const maxSize = 50 * 1024 * 1024; // 50MB
    const minSize = 1024; // 1KB
    
    if (fileBuffer.length > maxSize) {
      errors.push(`File size exceeds maximum limit of 50MB`);
    }
    
    if (fileBuffer.length < minSize) {
      errors.push('File is too small or corrupted');
    }
    
    // 4. PDF structure validation
    const pdfValidation = validatePDFStructure(fileBuffer);
    if (!pdfValidation.valid) {
      errors.push(pdfValidation.error || 'PDF structure validation failed');
    }
    
    // 5. Malware scanning (if API key available)
    if (process.env.VIRUSTOTAL_API_KEY) {
      try {
        const scanResult = await scanWithVirusTotal(fileBuffer, clientIP);
        if (!scanResult.safe && scanResult.threats) {
          errors.push(...scanResult.threats);
        } else if (scanResult.error) {
          warnings.push(scanResult.error);
        }
      } catch (scanError) {
        warnings.push('Malware scan failed - proceeding with caution');
      }
    } else {
      warnings.push('Malware scanning disabled - API key not configured');
    }
    
    // 6. Check for embedded content that might be problematic
    const fileContent = fileBuffer.toString('ascii', 0, Math.min(fileBuffer.length, 10240));
    
    // Look for potentially dangerous PDF features
    const riskyFeatures = [
      '/JavaScript',
      '/JS',
      '/OpenAction',
      '/AA',
      '/GoToE',
      '/Launch',
      '/ImportData'
    ];
    
    for (const feature of riskyFeatures) {
      if (fileContent.includes(feature)) {
        warnings.push(`PDF contains ${feature} - processed with extra security measures`);
      }
    }
    
    return {
      safe: errors.length === 0,
      errors,
      warnings
    };
    
  } catch (error) {
    console.error('File security validation error:', error);
    return {
      safe: false,
      errors: ['Security validation failed'],
      warnings: ['Unexpected error during security validation']
    };
  }
}

/**
 * Sanitize filename for safe storage and processing
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const basename = filename.replace(/^.*[\\\/]/, '');
  
  // Replace dangerous characters with underscores
  const sanitized = basename
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
  
  // Ensure it has a proper extension
  if (!sanitized.toLowerCase().endsWith('.pdf')) {
    return sanitized + '.pdf';
  }
  
  // Limit length
  if (sanitized.length > 100) {
    const extension = sanitized.substring(sanitized.lastIndexOf('.'));
    const name = sanitized.substring(0, 100 - extension.length);
    return name + extension;
  }
  
  return sanitized;
}

/**
 * Create secure temporary filename
 */
export function createSecureTempFilename(originalFilename: string): string {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  const sanitizedName = sanitizeFilename(originalFilename);
  const extension = sanitizedName.substring(sanitizedName.lastIndexOf('.'));
  
  return `${timestamp}_${random}${extension}`;
}