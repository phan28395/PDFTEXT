import { supabase } from '@/lib/supabase';

export interface ProcessingResult {
  recordId: string;
  filename: string;
  text: string;
  pages: number;
  confidence: number;
  processingTime: number;
  documentType: 'standard' | 'latex' | 'forms';
  downloadFormat: 'combined' | 'separated' | 'individual';
  downloadUrls?: string[]; // For separated/individual formats
  entities?: Array<{
    type: string;
    mention_text: string;
    confidence: number;
  }>;
  usage: {
    current: number;
    limit: number;
    remaining: number;
    freePagesUsed: number;
    creditsCharged: number;
  };
}

export interface ProcessingRecord {
  id: string;
  filename: string;
  pages_processed: number;
  processing_time: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  text_content?: string;
  created_at: string;
  error_message?: string;
}

export interface ProcessingHistoryResponse {
  records: ProcessingRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ProcessingError {
  error: string;
  message: string;
  details?: any;
  usage?: {
    current: number;
    limit: number;
    remaining: number;
    requested: number;
  };
  retryAfter?: number;
}

/**
 * Get authorization header with current user token
 */
async function getAuthHeader(): Promise<string> {
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error || !session?.access_token) {
    throw new Error('Authentication required. Please log in.');
  }
  
  return `Bearer ${session.access_token}`;
}

/**
 * Process a PDF file and extract text with document type and download format options
 */
export async function processPDF(
  file: File, 
  documentType: 'standard' | 'latex' | 'forms',
  downloadFormat: 'combined' | 'separated' | 'individual' = 'combined',
  onProgress?: (progress: number) => void
): Promise<ProcessingResult> {
  try {
    const authHeader = await getAuthHeader();
    
    // Create FormData
    const formData = new FormData();
    formData.append('file', file);
    formData.append('documentType', documentType);
    formData.append('downloadFormat', downloadFormat);
    formData.append('processIndividually', 'true'); // Process pages individually
    
    // Create XMLHttpRequest for progress tracking
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      // Track upload progress
      if (onProgress) {
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const progress = (event.loaded / event.total) * 100;
            onProgress(Math.round(progress));
          }
        });
      }
      
      xhr.addEventListener('load', () => {
        try {
          const response = JSON.parse(xhr.responseText);
          
          if (xhr.status === 200) {
            resolve(response.data);
          } else {
            reject(response as ProcessingError);
          }
        } catch (parseError) {
          reject({
            error: 'Parse error',
            message: 'Failed to parse server response',
            details: parseError
          });
        }
      });
      
      xhr.addEventListener('error', () => {
        reject({
          error: 'Network error',
          message: 'Failed to connect to processing server'
        });
      });
      
      xhr.addEventListener('timeout', () => {
        reject({
          error: 'Timeout',
          message: 'Processing request timed out. Please try again with a smaller file.'
        });
      });
      
      // Set timeout (15 minutes for individual page processing)
      xhr.timeout = 15 * 60 * 1000;
      
      // Configure request
      xhr.open('POST', '/api/process-pdf');
      xhr.setRequestHeader('Authorization', authHeader);
      
      // Send request
      xhr.send(formData);
    });
    
  } catch (error) {
    console.error('Process PDF error:', error);
    throw {
      error: 'Processing failed',
      message: error instanceof Error ? error.message : 'An unexpected error occurred',
      details: error
    } as ProcessingError;
  }
}

/**
 * Get processing history with pagination and filtering
 */
export async function getProcessingHistory(
  page: number = 1,
  limit: number = 10,
  status?: string,
  search?: string
): Promise<ProcessingHistoryResponse> {
  try {
    const authHeader = await getAuthHeader();
    
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    
    if (status && status !== 'all') {
      params.append('status', status);
    }
    
    if (search) {
      params.append('search', search);
    }
    
    const response = await fetch(`/api/processing-history?${params}`, {
      method: 'GET',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw result as ProcessingError;
    }
    
    return result.data;
    
  } catch (error) {
    console.error('Get processing history error:', error);
    throw error;
  }
}

/**
 * Delete a processing record
 */
export async function deleteProcessingRecord(recordId: string): Promise<void> {
  try {
    const authHeader = await getAuthHeader();
    
    const response = await fetch(`/api/processing-history?recordId=${recordId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw result as ProcessingError;
    }
    
  } catch (error) {
    console.error('Delete processing record error:', error);
    throw error;
  }
}

/**
 * Download processing result as text file
 */
export function downloadTextFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.replace('.pdf', '.txt');
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Validate file before processing
 */
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return { valid: false, error: 'Only PDF files are supported' };
  }
  
  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }
  
  // Check minimum file size
  const minSize = 1024; // 1KB
  if (file.size < minSize) {
    return { valid: false, error: 'File is too small or corrupted' };
  }
  
  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format processing time for display
 */
export function formatProcessingTime(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  
  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (remainingSeconds === 0) {
    return `${minutes}m`;
  }
  
  return `${minutes}m ${remainingSeconds}s`;
}