import { ProcessingError } from '@/api/processing';

export interface ErrorInfo {
  code: string;
  message: string;
  userMessage: string;
  retryable: boolean;
  details?: any;
  statusCode?: number;
}

// Error categories
export const ERROR_CODES = {
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  
  // Authentication errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Authorization errors
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  
  // Validation errors
  INVALID_FILE: 'INVALID_FILE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  
  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
  USAGE_LIMIT_EXCEEDED: 'USAGE_LIMIT_EXCEEDED',
  
  // Processing errors
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  DOCUMENT_AI_ERROR: 'DOCUMENT_AI_ERROR',
  SECURITY_SCAN_FAILED: 'SECURITY_SCAN_FAILED',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  RECORD_NOT_FOUND: 'RECORD_NOT_FOUND',
  
  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Unknown
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
} as const;

/**
 * Maps HTTP status codes to error categories
 */
function getErrorCodeFromStatus(status: number): string {
  switch (status) {
    case 400:
      return ERROR_CODES.INVALID_FILE;
    case 401:
      return ERROR_CODES.UNAUTHORIZED;
    case 403:
      return ERROR_CODES.FORBIDDEN;
    case 404:
      return ERROR_CODES.RECORD_NOT_FOUND;
    case 413:
      return ERROR_CODES.FILE_TOO_LARGE;
    case 422:
      return ERROR_CODES.PROCESSING_FAILED;
    case 429:
      return ERROR_CODES.RATE_LIMITED;
    case 500:
      return ERROR_CODES.INTERNAL_ERROR;
    case 502:
    case 503:
    case 504:
      return ERROR_CODES.SERVICE_UNAVAILABLE;
    default:
      return ERROR_CODES.UNKNOWN_ERROR;
  }
}

/**
 * Determines if an error is retryable
 */
function isRetryableError(code: string, statusCode?: number): boolean {
  const retryableCodes = [
    ERROR_CODES.NETWORK_ERROR,
    ERROR_CODES.TIMEOUT,
    ERROR_CODES.CONNECTION_FAILED,
    ERROR_CODES.SERVICE_UNAVAILABLE,
    ERROR_CODES.INTERNAL_ERROR
  ];
  
  // Also retry on 500-level errors
  if (statusCode && statusCode >= 500) {
    return true;
  }
  
  return retryableCodes.includes(code as any);
}

/**
 * Gets user-friendly error message
 */
function getUserMessage(code: string, originalMessage?: string): string {
  const messages: Record<string, string> = {
    [ERROR_CODES.NETWORK_ERROR]: 'Network connection failed. Please check your internet connection and try again.',
    [ERROR_CODES.TIMEOUT]: 'Request timed out. Please try again with a smaller file or better connection.',
    [ERROR_CODES.CONNECTION_FAILED]: 'Unable to connect to the server. Please try again later.',
    
    [ERROR_CODES.UNAUTHORIZED]: 'Authentication failed. Please log in and try again.',
    [ERROR_CODES.INVALID_TOKEN]: 'Your session has expired. Please log in again.',
    [ERROR_CODES.SESSION_EXPIRED]: 'Your session has expired. Please log in again.',
    
    [ERROR_CODES.FORBIDDEN]: 'Access denied. You don\'t have permission to perform this action.',
    [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions to complete this action.',
    
    [ERROR_CODES.INVALID_FILE]: 'Invalid file format or corrupted file. Please check your file and try again.',
    [ERROR_CODES.FILE_TOO_LARGE]: 'File size exceeds the maximum limit. Please use a smaller file.',
    [ERROR_CODES.INVALID_FILE_TYPE]: 'Invalid file type. Only PDF files are supported.',
    
    [ERROR_CODES.RATE_LIMITED]: 'Too many requests. Please wait a moment before trying again.',
    [ERROR_CODES.USAGE_LIMIT_EXCEEDED]: 'Usage limit exceeded. Please upgrade your plan to continue.',
    
    [ERROR_CODES.PROCESSING_FAILED]: 'PDF processing failed. The file may be corrupted or contain unsupported content.',
    [ERROR_CODES.DOCUMENT_AI_ERROR]: 'Document processing service is temporarily unavailable. Please try again later.',
    [ERROR_CODES.SECURITY_SCAN_FAILED]: 'Security scan failed. Please try again or use a different file.',
    
    [ERROR_CODES.DATABASE_ERROR]: 'Database error occurred. Please try again later.',
    [ERROR_CODES.RECORD_NOT_FOUND]: 'Requested record not found.',
    
    [ERROR_CODES.INTERNAL_ERROR]: 'An internal server error occurred. Please try again later.',
    [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable. Please try again later.',
    
    [ERROR_CODES.UNKNOWN_ERROR]: 'An unexpected error occurred. Please try again.'
  };
  
  return originalMessage && originalMessage.length < 200 
    ? originalMessage 
    : messages[code] || messages[ERROR_CODES.UNKNOWN_ERROR];
}

/**
 * Standardizes error objects from various sources
 */
export function normalizeError(error: any): ErrorInfo {
  console.error('Normalizing error:', error);
  
  // Already normalized ProcessingError
  if (error.error && error.message) {
    const code = error.error === 'Usage limit exceeded' 
      ? ERROR_CODES.USAGE_LIMIT_EXCEEDED
      : error.error === 'Rate limit exceeded'
      ? ERROR_CODES.RATE_LIMITED
      : error.error === 'Security validation failed'
      ? ERROR_CODES.SECURITY_SCAN_FAILED
      : error.error === 'Processing failed'
      ? ERROR_CODES.PROCESSING_FAILED
      : ERROR_CODES.UNKNOWN_ERROR;
      
    return {
      code,
      message: error.message,
      userMessage: getUserMessage(code, error.message),
      retryable: isRetryableError(code),
      details: error.details || error.usage,
      statusCode: error.status
    };
  }
  
  // Network/Fetch errors
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return {
      code: ERROR_CODES.NETWORK_ERROR,
      message: 'Network request failed',
      userMessage: getUserMessage(ERROR_CODES.NETWORK_ERROR),
      retryable: true
    };
  }
  
  // Timeout errors
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return {
      code: ERROR_CODES.TIMEOUT,
      message: 'Request timed out',
      userMessage: getUserMessage(ERROR_CODES.TIMEOUT),
      retryable: true
    };
  }
  
  // HTTP Response errors
  if (error.response) {
    const status = error.response.status;
    const code = getErrorCodeFromStatus(status);
    const responseData = error.response.data || {};
    
    return {
      code,
      message: responseData.message || error.message || `HTTP ${status} error`,
      userMessage: getUserMessage(code, responseData.message),
      retryable: isRetryableError(code, status),
      details: responseData.details,
      statusCode: status
    };
  }
  
  // Supabase errors
  if (error.code && typeof error.code === 'string') {
    const supabaseCode = error.code.toUpperCase();
    let code: string = ERROR_CODES.DATABASE_ERROR;
    
    // Map common Supabase error codes
    if (supabaseCode.includes('AUTH')) {
      code = ERROR_CODES.UNAUTHORIZED;
    } else if (supabaseCode.includes('NETWORK')) {
      code = ERROR_CODES.NETWORK_ERROR;
    } else if (supabaseCode.includes('TIMEOUT')) {
      code = ERROR_CODES.TIMEOUT;
    }
    
    return {
      code,
      message: error.message || 'Database error',
      userMessage: getUserMessage(code, error.message),
      retryable: isRetryableError(code),
      details: error.details
    };
  }
  
  // Generic JavaScript errors
  if (error instanceof Error) {
    let code: string = ERROR_CODES.UNKNOWN_ERROR;
    
    // Try to categorize based on error message
    const message = error.message.toLowerCase();
    if (message.includes('network') || message.includes('fetch')) {
      code = ERROR_CODES.NETWORK_ERROR;
    } else if (message.includes('timeout')) {
      code = ERROR_CODES.TIMEOUT;
    } else if (message.includes('unauthorized') || message.includes('auth')) {
      code = ERROR_CODES.UNAUTHORIZED;
    } else if (message.includes('forbidden') || message.includes('permission')) {
      code = ERROR_CODES.FORBIDDEN;
    } else if (message.includes('file') || message.includes('pdf')) {
      code = ERROR_CODES.INVALID_FILE;
    }
    
    return {
      code,
      message: error.message,
      userMessage: getUserMessage(code, error.message),
      retryable: isRetryableError(code),
      details: { stack: error.stack }
    };
  }
  
  // Fallback for unknown error types
  return {
    code: ERROR_CODES.UNKNOWN_ERROR,
    message: error?.toString() || 'Unknown error occurred',
    userMessage: getUserMessage(ERROR_CODES.UNKNOWN_ERROR),
    retryable: false,
    details: error
  };
}

/**
 * Creates a ProcessingError from normalized error info
 */
export function createProcessingError(errorInfo: ErrorInfo): ProcessingError {
  return {
    error: errorInfo.code,
    message: errorInfo.userMessage,
    details: errorInfo.details
  };
}

/**
 * Logs error with appropriate level and context
 */
export function logError(error: ErrorInfo, context?: string) {
  const logLevel = error.retryable ? 'warn' : 'error';
  const prefix = context ? `[${context}]` : '';
  
  console[logLevel](`${prefix} ${error.code}: ${error.message}`, {
    userMessage: error.userMessage,
    retryable: error.retryable,
    statusCode: error.statusCode,
    details: error.details
  });
}

/**
 * High-level error handler that normalizes, logs, and optionally shows toast
 */
export function handleError(
  error: any, 
  context?: string, 
  showToast: boolean = true
): ErrorInfo {
  const errorInfo = normalizeError(error);
  logError(errorInfo, context);
  
  if (showToast) {
    // Import toast dynamically to avoid circular dependencies
    import('react-hot-toast').then(({ default: toast }) => {
      if (errorInfo.retryable) {
        toast.error(errorInfo.userMessage, {
          duration: 5000,
          id: `error-${errorInfo.code}` // Prevent duplicate toasts
        });
      } else {
        toast.error(errorInfo.userMessage, {
          duration: 7000,
          id: `error-${errorInfo.code}`
        });
      }
    });
  }
  
  return errorInfo;
}

/**
 * Retry wrapper with exponential backoff
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  context?: string
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const errorInfo = normalizeError(error);
      
      logError(errorInfo, `${context} (attempt ${attempt}/${maxRetries})`);
      
      // Don't retry if error is not retryable
      if (!errorInfo.retryable) {
        throw error;
      }
      
      // Don't retry on last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s, etc.
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}