/**
 * Comprehensive Rate Limiting System
 * Provides protection against abuse, DDoS, and ensures fair usage
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: any) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableWhitelist?: boolean;
  enableBlacklist?: boolean;
  exponentialBackoff?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
  reason?: string;
}

export interface RequestInfo {
  ip: string;
  userAgent: string;
  endpoint: string;
  userId?: string;
  timestamp: number;
  success: boolean;
}

class RateLimitStore {
  private requests = new Map<string, number[]>();
  private failures = new Map<string, number[]>();
  private blacklist = new Set<string>();
  private whitelist = new Set<string>();
  private suspiciousIPs = new Map<string, { count: number; lastSeen: number }>();
  
  // Cleanup old entries every 5 minutes
  private cleanupInterval: NodeJS.Timeout;
  
  constructor() {
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }
  
  private cleanup() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    // Clean up old request records
    for (const [key, timestamps] of this.requests.entries()) {
      const filtered = timestamps.filter(t => t > oneHourAgo);
      if (filtered.length === 0) {
        this.requests.delete(key);
      } else {
        this.requests.set(key, filtered);
      }
    }
    
    // Clean up old failure records
    for (const [key, timestamps] of this.failures.entries()) {
      const filtered = timestamps.filter(t => t > oneHourAgo);
      if (filtered.length === 0) {
        this.failures.delete(key);
      } else {
        this.failures.set(key, filtered);
      }
    }
    
    // Clean up suspicious IPs that haven't been seen recently
    for (const [ip, info] of this.suspiciousIPs.entries()) {
      if (now - info.lastSeen > oneHourAgo) {
        this.suspiciousIPs.delete(ip);
      }
    }
  }
  
  addRequest(key: string, timestamp: number = Date.now()) {
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    this.requests.get(key)!.push(timestamp);
  }
  
  addFailure(key: string, timestamp: number = Date.now()) {
    if (!this.failures.has(key)) {
      this.failures.set(key, []);
    }
    this.failures.get(key)!.push(timestamp);
  }
  
  getRequestCount(key: string, windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const requests = this.requests.get(key) || [];
    
    return requests.filter(t => t > windowStart).length;
  }
  
  getFailureCount(key: string, windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;
    const failures = this.failures.get(key) || [];
    
    return failures.filter(t => t > windowStart).length;
  }
  
  addToBlacklist(ip: string) {
    this.blacklist.add(ip);
  }
  
  removeFromBlacklist(ip: string) {
    this.blacklist.delete(ip);
  }
  
  addToWhitelist(ip: string) {
    this.whitelist.add(ip);
  }
  
  removeFromWhitelist(ip: string) {
    this.whitelist.delete(ip);
  }
  
  isBlacklisted(ip: string): boolean {
    return this.blacklist.has(ip);
  }
  
  isWhitelisted(ip: string): boolean {
    return this.whitelist.has(ip);
  }
  
  markSuspiciousActivity(ip: string) {
    const current = this.suspiciousIPs.get(ip) || { count: 0, lastSeen: 0 };
    this.suspiciousIPs.set(ip, {
      count: current.count + 1,
      lastSeen: Date.now()
    });
    
    // Auto-blacklist if too many suspicious activities
    if (current.count >= 10) {
      this.addToBlacklist(ip);
    }
  }
  
  getSuspiciousActivity(ip: string): { count: number; lastSeen: number } | null {
    return this.suspiciousIPs.get(ip) || null;
  }
  
  getStats() {
    return {
      totalRequests: Array.from(this.requests.values()).reduce((sum, arr) => sum + arr.length, 0),
      totalFailures: Array.from(this.failures.values()).reduce((sum, arr) => sum + arr.length, 0),
      blacklistedIPs: this.blacklist.size,
      whitelistedIPs: this.whitelist.size,
      suspiciousIPs: this.suspiciousIPs.size,
      activeKeys: this.requests.size
    };
  }
  
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// Global rate limit store
const globalStore = new RateLimitStore();

/**
 * Default rate limit configurations for different endpoint types
 */
export const RateLimitConfigs = {
  // High-resource endpoints (PDF processing)
  PROCESSING: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 requests per minute
    exponentialBackoff: true
  } as RateLimitConfig,
  
  // Authentication endpoints
  AUTH: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
    exponentialBackoff: true
  } as RateLimitConfig,
  
  // Payment endpoints
  PAYMENT: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
    exponentialBackoff: false
  } as RateLimitConfig,
  
  // General API endpoints
  GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
    exponentialBackoff: false
  } as RateLimitConfig,
  
  // Public endpoints (no auth required)
  PUBLIC: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
    exponentialBackoff: false
  } as RateLimitConfig,
  
  // Download endpoints
  DOWNLOAD: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 downloads per minute
    exponentialBackoff: false
  } as RateLimitConfig
};

/**
 * Extract client IP from request headers
 */
export function getClientIP(req: any): string {
  return (
    req.headers['cf-connecting-ip'] || // Cloudflare
    req.headers['x-forwarded-for']?.split(',')[0] || // Proxy
    req.headers['x-real-ip'] || // Nginx
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress ||
    '127.0.0.1'
  );
}

/**
 * Generate rate limit key
 */
export function generateRateLimitKey(req: any, endpoint: string): string {
  const ip = getClientIP(req);
  const userAgent = req.headers['user-agent'] || 'unknown';
  
  // Create a hash of IP + endpoint for the key
  return `${ip}:${endpoint}`;
}

/**
 * Calculate exponential backoff delay
 */
function calculateBackoffDelay(failureCount: number): number {
  return Math.min(Math.pow(2, failureCount) * 1000, 30000); // Max 30 seconds
}

/**
 * Detect potential DDoS patterns
 */
function detectDDoSPattern(ip: string, requestCount: number, failureCount: number): boolean {
  // High request volume from single IP
  if (requestCount > 100) return true;
  
  // High failure rate
  if (failureCount > 20) return true;
  
  // Suspicious activity pattern
  const suspicious = globalStore.getSuspiciousActivity(ip);
  if (suspicious && suspicious.count > 5) return true;
  
  return false;
}

/**
 * Main rate limiting function
 */
export function checkRateLimit(req: any, endpoint: string, config: RateLimitConfig): RateLimitResult {
  const ip = getClientIP(req);
  const now = Date.now();
  
  // Check whitelist first
  if (config.enableWhitelist && globalStore.isWhitelisted(ip)) {
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetTime: now + config.windowMs
    };
  }
  
  // Check blacklist
  if (config.enableBlacklist && globalStore.isBlacklisted(ip)) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + config.windowMs,
      retryAfter: 3600, // 1 hour
      reason: 'IP blacklisted due to suspicious activity'
    };
  }
  
  const key = config.keyGenerator ? config.keyGenerator(req) : generateRateLimitKey(req, endpoint);
  const windowStart = now - config.windowMs;
  
  const requestCount = globalStore.getRequestCount(key, config.windowMs);
  const failureCount = globalStore.getFailureCount(key, config.windowMs);
  
  // DDoS detection
  if (detectDDoSPattern(ip, requestCount, failureCount)) {
    globalStore.markSuspiciousActivity(ip);
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + config.windowMs,
      retryAfter: 3600,
      reason: 'DDoS protection activated'
    };
  }
  
  // Apply exponential backoff for failed requests
  if (config.exponentialBackoff && failureCount > 0) {
    const backoffDelay = calculateBackoffDelay(failureCount);
    const lastFailure = globalStore.failures.get(key)?.slice(-1)[0] || 0;
    
    if (now - lastFailure < backoffDelay) {
      return {
        allowed: false,
        remaining: config.maxRequests - requestCount,
        resetTime: now + config.windowMs,
        retryAfter: Math.ceil(backoffDelay / 1000),
        reason: 'Exponential backoff in effect'
      };
    }
  }
  
  // Check request limit
  if (requestCount >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: now + config.windowMs,
      retryAfter: Math.ceil(config.windowMs / 1000),
      reason: 'Rate limit exceeded'
    };
  }
  
  // Request allowed
  globalStore.addRequest(key, now);
  
  return {
    allowed: true,
    remaining: config.maxRequests - requestCount - 1,
    resetTime: now + config.windowMs
  };
}

/**
 * Record failed request for exponential backoff
 */
export function recordFailedRequest(req: any, endpoint: string, config: RateLimitConfig) {
  const key = config.keyGenerator ? config.keyGenerator(req) : generateRateLimitKey(req, endpoint);
  globalStore.addFailure(key);
  
  // Mark as suspicious activity
  const ip = getClientIP(req);
  globalStore.markSuspiciousActivity(ip);
}

/**
 * Middleware wrapper for Vercel functions
 */
export function withRateLimit(config: RateLimitConfig, endpoint: string) {
  return function rateLimitMiddleware(handler: Function) {
    return async function(req: any, res: any) {
      const result = checkRateLimit(req, endpoint, config);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', config.maxRequests);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
      
      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }
        
        return res.status(429).json({
          error: 'Too Many Requests',
          message: result.reason || 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          resetTime: result.resetTime
        });
      }
      
      try {
        return await handler(req, res);
      } catch (error) {
        // Record failure for exponential backoff
        if (config.exponentialBackoff) {
          recordFailedRequest(req, endpoint, config);
        }
        throw error;
      }
    };
  };
}

/**
 * IP management functions
 */
export const IPManagement = {
  addToBlacklist: (ip: string) => globalStore.addToBlacklist(ip),
  removeFromBlacklist: (ip: string) => globalStore.removeFromBlacklist(ip),
  addToWhitelist: (ip: string) => globalStore.addToWhitelist(ip),
  removeFromWhitelist: (ip: string) => globalStore.removeFromWhitelist(ip),
  isBlacklisted: (ip: string) => globalStore.isBlacklisted(ip),
  isWhitelisted: (ip: string) => globalStore.isWhitelisted(ip),
  getStats: () => globalStore.getStats()
};

export default {
  checkRateLimit,
  withRateLimit,
  RateLimitConfigs,
  IPManagement,
  getClientIP,
  generateRateLimitKey,
  recordFailedRequest
};