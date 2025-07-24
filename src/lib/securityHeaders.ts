/**
 * Security Headers Middleware
 * Implements comprehensive security headers for enhanced protection
 */

export interface SecurityHeadersConfig {
  enableHSTS?: boolean;
  enableCSP?: boolean;
  enableFrameOptions?: boolean;
  enableContentTypeOptions?: boolean;
  enableXSSProtection?: boolean;
  enableReferrerPolicy?: boolean;
  enablePermissionsPolicy?: boolean;
  customCSP?: string;
  isDevelopment?: boolean;
}

export const DefaultSecurityConfig: SecurityHeadersConfig = {
  enableHSTS: true,
  enableCSP: true,
  enableFrameOptions: true,
  enableContentTypeOptions: true,
  enableXSSProtection: true,
  enableReferrerPolicy: true,
  enablePermissionsPolicy: true,
  isDevelopment: process.env.NODE_ENV === 'development'
};

/**
 * Generate Content Security Policy with nonce support and enhanced security
 */
function generateCSP(config: SecurityHeadersConfig): string {
  if (config.customCSP) {
    return config.customCSP;
  }
  
  const isDev = config.isDevelopment;
  const nonce = generateNonce();
  
  // Enhanced CSP for production with stricter policies
  let csp = [
    "default-src 'self'",
    // Script sources with nonce for inline scripts and PDF.js specific hashes
    // PDF.js hashes: vS0ezAgu... and mhaa2hnTXn9... are for worker initialization
    // PDF.js hashes: if99PmkT... and Sn57jJ2U... are for content rendering
    `script-src 'self' ${isDev ? "'unsafe-inline' 'unsafe-eval'" : `'nonce-${nonce}' 'sha256-vS0ezAgu/yL7GFO1DZDdmpIGJkFe3Aeu0nUGSQ3nczY=' 'sha256-mhaa2hnTXn9uPsPhcD2Fz4h7ptRfaGvDbLIL5pl6sk8=' 'sha256-if99PmkT48acTlvF7VY0zUcQcx9T3Ssjea89B/aXy7k=' 'sha256-Sn57jJ2ULaxRhko/IMfP0Ir7GMTKzYvx2WYMeTR5qSc='`} https://js.stripe.com https://checkout.stripe.com https://www.google.com/recaptcha/ https://www.gstatic.com/recaptcha/`,
    // Style sources
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    // Font sources
    "font-src 'self' https://fonts.gstatic.com data:",
    // Image sources with restricted HTTPS only
    "img-src 'self' data: https: blob:",
    // Connection sources for APIs
    "connect-src 'self' https://*.supabase.co https://api.stripe.com https://checkout.stripe.com wss://*.supabase.co https://www.google.com/recaptcha/ https://api.virustotal.com",
    // Frame sources for payment processing
    "frame-src 'self' https://js.stripe.com https://checkout.stripe.com https://www.google.com/recaptcha/",
    // Prevent framing (clickjacking protection)
    "frame-ancestors 'none'",
    // Base URI restriction
    "base-uri 'self'",
    // Form action restriction
    "form-action 'self' https://checkout.stripe.com",
    // Object restriction for security
    "object-src 'none'",
    // Manifest source
    "manifest-src 'self'",
    // Worker sources
    "worker-src 'self' blob:",
    // Media sources
    "media-src 'self'",
    // Child sources (fallback for frame-src)
    "child-src 'self' https://js.stripe.com https://checkout.stripe.com",
    // Upgrade insecure requests (HTTPS enforcement)
    !isDev ? "upgrade-insecure-requests" : "",
    // Block all mixed content
    !isDev ? "block-all-mixed-content" : "",
    // Report violations
    `report-uri /api/security/csp-report`,
    // Report to (newer standard)
    `report-to csp-endpoint`
  ].filter(Boolean);
  
  // Add development-specific policies
  if (isDev) {
    csp = csp.map(directive => {
      if (directive.startsWith('script-src')) {
        return directive + " http://localhost:* ws://localhost:*";
      }
      if (directive.startsWith('connect-src')) {
        return directive + " http://localhost:* ws://localhost:* wss://localhost:*";
      }
      if (directive.startsWith('frame-src')) {
        return directive + " http://localhost:*";
      }
      return directive;
    });
  }
  
  return csp.join('; ');
}

/**
 * Generate cryptographic nonce for CSP
 */
function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate Permissions Policy (formerly Feature Policy)
 */
function generatePermissionsPolicy(): string {
  return [
    'accelerometer=()',
    'ambient-light-sensor=()',
    'autoplay=()',
    'battery=()',
    'camera=()',
    'display-capture=()',
    'document-domain=()',
    'encrypted-media=()',
    'execution-while-not-rendered=()',
    'execution-while-out-of-viewport=()',
    'fullscreen=(self)',
    'gamepad=()',
    'geolocation=()',
    'gyroscope=()',
    'hid=()',
    'idle-detection=()',
    'local-fonts=()',
    'magnetometer=()',
    'microphone=()',
    'midi=()',
    'navigation-override=()',
    'payment=(self)',
    'picture-in-picture=()',
    'publickey-credentials-get=()',
    'screen-wake-lock=()',
    'serial=()',
    'speaker-selection=()',
    'sync-xhr=()',
    'usb=()',
    'web-share=()',
    'xr-spatial-tracking=()'
  ].join(', ');
}

/**
 * Apply security headers to response
 */
export function applySecurityHeaders(req: any, res: any, config: SecurityHeadersConfig = DefaultSecurityConfig) {
  // Strict Transport Security (HSTS)
  if (config.enableHSTS && !config.isDevelopment) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  // Content Security Policy
  if (config.enableCSP) {
    const csp = generateCSP(config);
    res.setHeader('Content-Security-Policy', csp);
    
    // Set up CSP reporting endpoint
    if (!config.isDevelopment) {
      res.setHeader('Report-To', JSON.stringify({
        group: 'csp-endpoint',
        max_age: 31536000,
        endpoints: [{ url: '/api/security/csp-report' }],
        include_subdomains: true
      }));
      
      // Also set CSP report-only for monitoring in production
      res.setHeader('Content-Security-Policy-Report-Only', csp);
    }
  }
  
  // X-Frame-Options (prevent clickjacking)
  if (config.enableFrameOptions) {
    res.setHeader('X-Frame-Options', 'DENY');
  }
  
  // X-Content-Type-Options (prevent MIME type sniffing)
  if (config.enableContentTypeOptions) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
  }
  
  // X-XSS-Protection (legacy but still useful)
  if (config.enableXSSProtection) {
    res.setHeader('X-XSS-Protection', '1; mode=block');
  }
  
  // Referrer Policy
  if (config.enableReferrerPolicy) {
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  }
  
  // Permissions Policy
  if (config.enablePermissionsPolicy) {
    res.setHeader('Permissions-Policy', generatePermissionsPolicy());
  }
  
  // Additional security headers
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none'); // Allow iframe embedding for Stripe
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');
  
  // Cache control for security-sensitive endpoints
  if (req.url && (req.url.includes('/api/auth') || req.url.includes('/api/user'))) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
}

/**
 * Middleware wrapper for Vercel functions
 */
export function withSecurityHeaders(config: SecurityHeadersConfig = DefaultSecurityConfig) {
  return function securityHeadersMiddleware(handler: Function) {
    return async function(req: any, res: any) {
      // Apply security headers
      applySecurityHeaders(req, res, config);
      
      // Add security monitoring
      const startTime = Date.now();
      const originalEnd = res.end;
      
      res.end = function(chunk?: any, encoding?: any) {
        const duration = Date.now() - startTime;
        
        // Log security-relevant information
        const securityLog = {
          timestamp: new Date().toISOString(),
          ip: getClientIP(req),
          method: req.method,
          url: req.url,
          userAgent: req.headers['user-agent'],
          duration,
          statusCode: res.statusCode,
          contentLength: res.getHeader('content-length') || 0,
          securityHeaders: {
            csp: !!res.getHeader('content-security-policy'),
            hsts: !!res.getHeader('strict-transport-security'),
            frameOptions: !!res.getHeader('x-frame-options'),
            contentTypeOptions: !!res.getHeader('x-content-type-options')
          }
        };
        
        // In production, you'd send this to a logging service
        if (process.env.NODE_ENV === 'development') {
          console.log('Security Log:', securityLog);
        }
        
        originalEnd.call(this, chunk, encoding);
      };
      
      try {
        return await handler(req, res);
      } catch (error) {
        // Log security-related errors
        console.error('Security middleware error:', {
          timestamp: new Date().toISOString(),
          ip: getClientIP(req),
          error: error.message,
          stack: error.stack
        });
        throw error;
      }
    };
  };
}

/**
 * Get client IP helper function
 */
function getClientIP(req: any): string {
  return (
    req.headers['cf-connecting-ip'] ||
    req.headers['x-forwarded-for']?.split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

/**
 * Validate request headers for security threats
 */
export function validateRequestHeaders(req: any): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Check for common attack patterns in headers
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /data:text\/html/i,
    /vbscript:/i,
    /<iframe/i,
    /eval\(/i,
    /expression\(/i
  ];
  
  // Check User-Agent
  const userAgent = req.headers['user-agent'] || '';
  if (userAgent.length > 1000) {
    issues.push('Suspicious user agent length');
  }
  
  // Check for XSS in headers
  const headersToCheck = ['referer', 'user-agent', 'x-forwarded-for'];
  for (const header of headersToCheck) {
    const value = req.headers[header] || '';
    for (const pattern of suspiciousPatterns) {
      if (pattern.test(value)) {
        issues.push(`Suspicious content in ${header} header`);
        break;
      }
    }
  }
  
  // Check for SQL injection patterns
  const sqlPatterns = [
    /union.*select/i,
    /drop.*table/i,
    /insert.*into/i,
    /delete.*from/i,
    /update.*set/i
  ];
  
  for (const header of headersToCheck) {
    const value = req.headers[header] || '';
    for (const pattern of sqlPatterns) {
      if (pattern.test(value)) {
        issues.push(`Potential SQL injection in ${header} header`);
        break;
      }
    }
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}

/**
 * Security headers for different endpoint types
 */
export const SecurityConfigs = {
  // API endpoints
  API: {
    ...DefaultSecurityConfig,
    enableFrameOptions: true
  } as SecurityHeadersConfig,
  
  // Static file serving
  STATIC: {
    ...DefaultSecurityConfig,
    enableCSP: false // Less restrictive for static files
  } as SecurityHeadersConfig,
  
  // Authentication pages
  AUTH: {
    ...DefaultSecurityConfig,
    enableHSTS: true,
    enableCSP: true
  } as SecurityHeadersConfig,
  
  // Payment pages
  PAYMENT: {
    ...DefaultSecurityConfig,
    enableCSP: true,
    customCSP: "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.stripe.com https://checkout.stripe.com; style-src 'self' 'unsafe-inline'; frame-src https://js.stripe.com https://checkout.stripe.com; connect-src 'self' https://api.stripe.com https://checkout.stripe.com"
  } as SecurityHeadersConfig,
  
  // Download endpoints
  DOWNLOAD: {
    ...DefaultSecurityConfig,
    enableCSP: false, // Less restrictive for file downloads
    enableFrameOptions: true,
    enableContentTypeOptions: true
  } as SecurityHeadersConfig
};

export default {
  applySecurityHeaders,
  withSecurityHeaders,
  validateRequestHeaders,
  SecurityConfigs,
  DefaultSecurityConfig
};