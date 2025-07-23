/**
 * Advanced DDoS Protection and Traffic Analysis
 * Provides enterprise-grade protection against distributed denial-of-service attacks
 */

export interface DDoSConfig {
  windowMs: number;
  maxRequestsPerWindow: number;
  maxConcurrentConnections: number;
  suspiciousThreshold: number;
  blockDuration: number;
  enableGeoBlocking?: boolean;
  trustedProxies?: string[];
  rateLimitByUserAgent?: boolean;
}

export interface TrafficPattern {
  ip: string;
  userAgent: string;
  requestCount: number;
  errorRate: number;
  avgResponseTime: number;
  geoLocation?: string;
  firstSeen: number;
  lastSeen: number;
  riskScore: number;
  blocked: boolean;
}

export interface DDoSResult {
  allowed: boolean;
  riskScore: number;
  reason?: string;
  blockDuration?: number;
  mitigation?: string;
}

class DDoSProtectionEngine {
  private trafficPatterns = new Map<string, TrafficPattern>();
  private blockedIPs = new Map<string, number>(); // IP -> blocked until timestamp
  private connectionCounts = new Map<string, number>();
  private suspiciousCountries = new Set(['CN', 'RU', 'KP', 'IR']); // Configurable
  
  private config: DDoSConfig = {
    windowMs: 60 * 1000, // 1 minute
    maxRequestsPerWindow: 100,
    maxConcurrentConnections: 10,
    suspiciousThreshold: 80,
    blockDuration: 15 * 60 * 1000, // 15 minutes
    enableGeoBlocking: false,
    rateLimitByUserAgent: true
  };

  constructor(config?: Partial<DDoSConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    
    // Cleanup blocked IPs every 5 minutes
    setInterval(() => {
      this.cleanupExpiredBlocks();
    }, 5 * 60 * 1000);
    
    // Cleanup old traffic patterns every hour
    setInterval(() => {
      this.cleanupOldPatterns();
    }, 60 * 60 * 1000);
  }

  /**
   * Analyze incoming request for DDoS patterns
   */
  analyzeRequest(req: any): DDoSResult {
    const ip = this.getClientIP(req);
    const userAgent = req.headers['user-agent'] || 'unknown';
    const now = Date.now();

    // Check if IP is currently blocked
    if (this.isBlocked(ip)) {
      const blockUntil = this.blockedIPs.get(ip) || 0;
      return {
        allowed: false,
        riskScore: 100,
        reason: 'IP temporarily blocked due to suspicious activity',
        blockDuration: Math.max(0, blockUntil - now)
      };
    }

    // Get or create traffic pattern for this IP
    const pattern = this.getTrafficPattern(ip, userAgent, now);
    
    // Update connection count
    this.updateConnectionCount(ip, 1);

    // Calculate risk score
    const riskScore = this.calculateRiskScore(pattern, req);

    // Check various DDoS indicators
    const analysis = this.performThreatAnalysis(pattern, req, riskScore);

    // Apply mitigation if needed
    if (analysis.riskScore >= this.config.suspiciousThreshold) {
      return this.applyMitigation(ip, analysis);
    }

    return {
      allowed: true,
      riskScore: analysis.riskScore
    };
  }

  /**
   * Record request completion for pattern analysis
   */
  recordRequestComplete(req: any, responseTime: number, statusCode: number) {
    const ip = this.getClientIP(req);
    const pattern = this.trafficPatterns.get(ip);
    
    if (pattern) {
      // Update response time average
      pattern.avgResponseTime = (pattern.avgResponseTime + responseTime) / 2;
      
      // Update error rate
      if (statusCode >= 400) {
        pattern.errorRate = Math.min(100, pattern.errorRate + 1);
      } else {
        pattern.errorRate = Math.max(0, pattern.errorRate - 0.5);
      }
      
      pattern.lastSeen = Date.now();
    }

    // Decrease connection count
    this.updateConnectionCount(ip, -1);
  }

  private getClientIP(req: any): string {
    // Handle trusted proxies
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && this.config.trustedProxies) {
      const ips = forwarded.split(',').map((ip: string) => ip.trim());
      return ips[0]; // First IP in chain
    }

    return (
      req.headers['cf-connecting-ip'] ||
      req.headers['x-real-ip'] ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      '127.0.0.1'
    );
  }

  private getTrafficPattern(ip: string, userAgent: string, now: number): TrafficPattern {
    if (!this.trafficPatterns.has(ip)) {
      this.trafficPatterns.set(ip, {
        ip,
        userAgent,
        requestCount: 0,
        errorRate: 0,
        avgResponseTime: 0,
        firstSeen: now,
        lastSeen: now,
        riskScore: 0,
        blocked: false
      });
    }

    const pattern = this.trafficPatterns.get(ip)!;
    pattern.requestCount++;
    pattern.lastSeen = now;
    
    return pattern;
  }

  private updateConnectionCount(ip: string, delta: number) {
    const current = this.connectionCounts.get(ip) || 0;
    const newCount = Math.max(0, current + delta);
    
    if (newCount === 0) {
      this.connectionCounts.delete(ip);
    } else {
      this.connectionCounts.set(ip, newCount);
    }
  }

  private calculateRiskScore(pattern: TrafficPattern, req: any): number {
    let score = 0;

    // High request frequency
    const windowStart = Date.now() - this.config.windowMs;
    if (pattern.lastSeen > windowStart && pattern.requestCount > this.config.maxRequestsPerWindow) {
      score += 30;
    }

    // Too many concurrent connections
    const connections = this.connectionCounts.get(pattern.ip) || 0;
    if (connections > this.config.maxConcurrentConnections) {
      score += 25;
    }

    // High error rate indicates scanning/probing
    if (pattern.errorRate > 50) {
      score += 20;
    }

    // Suspicious user agent patterns
    const userAgent = req.headers['user-agent'] || '';
    if (this.isSuspiciousUserAgent(userAgent)) {
      score += 15;
    }

    // Missing common headers (indicates bot traffic)
    if (!req.headers['accept-language'] || !req.headers['accept-encoding']) {
      score += 10;
    }

    // Rapid-fire requests (very short intervals)
    const timeSinceFirst = Date.now() - pattern.firstSeen;
    if (timeSinceFirst < 10000 && pattern.requestCount > 20) { // 20+ requests in 10 seconds
      score += 25;
    }

    // Geographic location (if enabled and detected)
    if (this.config.enableGeoBlocking && pattern.geoLocation) {
      if (this.suspiciousCountries.has(pattern.geoLocation)) {
        score += 10;
      }
    }

    return Math.min(100, score);
  }

  private performThreatAnalysis(pattern: TrafficPattern, req: any, baseScore: number): { riskScore: number; threatType?: string } {
    let riskScore = baseScore;
    let threatType: string | undefined;

    // Volumetric attack detection
    if (pattern.requestCount > this.config.maxRequestsPerWindow * 2) {
      riskScore += 20;
      threatType = 'volumetric_attack';
    }

    // Protocol attack detection (malformed requests)
    if (this.detectProtocolAnomaly(req)) {
      riskScore += 15;
      threatType = 'protocol_attack';
    }

    // Application layer attack detection
    if (this.detectApplicationAttack(req)) {
      riskScore += 25;
      threatType = 'application_attack';
    }

    // Botnet detection (coordinated attacks from multiple IPs)
    if (this.detectBotnetActivity(pattern)) {
      riskScore += 30;
      threatType = 'botnet_attack';
    }

    return { riskScore: Math.min(100, riskScore), threatType };
  }

  private applyMitigation(ip: string, analysis: { riskScore: number; threatType?: string }): DDoSResult {
    // Progressive mitigation based on risk score
    if (analysis.riskScore >= 90) {
      // High risk - block immediately
      this.blockIP(ip, this.config.blockDuration);
      return {
        allowed: false,
        riskScore: analysis.riskScore,
        reason: `High-risk traffic detected: ${analysis.threatType || 'multiple_indicators'}`,
        blockDuration: this.config.blockDuration,
        mitigation: 'ip_block'
      };
    } else if (analysis.riskScore >= this.config.suspiciousThreshold) {
      // Medium risk - apply rate limiting
      return {
        allowed: false,
        riskScore: analysis.riskScore,
        reason: 'Suspicious traffic pattern detected',
        mitigation: 'rate_limit'
      };
    }

    return {
      allowed: true,
      riskScore: analysis.riskScore
    };
  }

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot|crawler|spider|scraper/i,
      /curl|wget|python|java|ruby/i,
      /^$/,
      /.{200,}/, // Extremely long user agents
      /(\w)\1{10,}/, // Repeated characters
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private detectProtocolAnomaly(req: any): boolean {
    // Check for malformed HTTP headers
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'host'
    ];

    for (const header of suspiciousHeaders) {
      const value = req.headers[header];
      if (value && typeof value === 'string') {
        // Check for header injection attempts
        if (value.includes('\n') || value.includes('\r')) {
          return true;
        }
        // Check for extremely long headers
        if (value.length > 1000) {
          return true;
        }
      }
    }

    return false;
  }

  private detectApplicationAttack(req: any): boolean {
    const url = req.url || '';
    const body = req.body || '';

    // SQL injection patterns
    const sqlPatterns = [
      /union.*select/i,
      /drop.*table/i,
      /insert.*into/i,
      /'.*or.*'.*=/i
    ];

    // XSS patterns
    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i
    ];

    // Path traversal patterns
    const pathTraversalPatterns = [
      /\.\.\//,
      /\.\.\\/,
      /%2e%2e%2f/i,
      /%2e%2e%5c/i
    ];

    const allPatterns = [...sqlPatterns, ...xssPatterns, ...pathTraversalPatterns];
    const testString = url + JSON.stringify(body);

    return allPatterns.some(pattern => pattern.test(testString));
  }

  private detectBotnetActivity(pattern: TrafficPattern): boolean {
    // Check if multiple IPs from same network are attacking
    const subnet = pattern.ip.split('.').slice(0, 3).join('.');
    let sameSubnetCount = 0;

    for (const [ip, p] of this.trafficPatterns.entries()) {
      if (ip.startsWith(subnet) && p.riskScore > 50) {
        sameSubnetCount++;
      }
    }

    return sameSubnetCount > 5; // 5+ suspicious IPs from same subnet
  }

  private blockIP(ip: string, duration: number) {
    const blockUntil = Date.now() + duration;
    this.blockedIPs.set(ip, blockUntil);
    
    const pattern = this.trafficPatterns.get(ip);
    if (pattern) {
      pattern.blocked = true;
    }

    // Log the blocking event
    console.warn(`DDoS Protection: Blocked IP ${ip} for ${duration}ms due to suspicious activity`);
  }

  private isBlocked(ip: string): boolean {
    const blockUntil = this.blockedIPs.get(ip);
    if (!blockUntil) return false;

    if (Date.now() > blockUntil) {
      this.blockedIPs.delete(ip);
      const pattern = this.trafficPatterns.get(ip);
      if (pattern) {
        pattern.blocked = false;
      }
      return false;
    }

    return true;
  }

  private cleanupExpiredBlocks() {
    const now = Date.now();
    for (const [ip, blockUntil] of this.blockedIPs.entries()) {
      if (now > blockUntil) {
        this.blockedIPs.delete(ip);
        const pattern = this.trafficPatterns.get(ip);
        if (pattern) {
          pattern.blocked = false;
        }
      }
    }
  }

  private cleanupOldPatterns() {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    for (const [ip, pattern] of this.trafficPatterns.entries()) {
      if (pattern.lastSeen < cutoff && !pattern.blocked) {
        this.trafficPatterns.delete(ip);
      }
    }
  }

  /**
   * Get current statistics for monitoring
   */
  getStats() {
    return {
      activePatterns: this.trafficPatterns.size,
      blockedIPs: this.blockedIPs.size,
      activeConnections: Array.from(this.connectionCounts.values()).reduce((sum, count) => sum + count, 0),
      highRiskIPs: Array.from(this.trafficPatterns.values()).filter(p => p.riskScore > 70).length,
      config: this.config
    };
  }

  /**
   * Manually block/unblock IPs
   */
  manualBlock(ip: string, duration: number = this.config.blockDuration) {
    this.blockIP(ip, duration);
  }

  manualUnblock(ip: string) {
    this.blockedIPs.delete(ip);
    const pattern = this.trafficPatterns.get(ip);
    if (pattern) {
      pattern.blocked = false;
    }
  }
}

// Global DDoS protection instance
const globalDDoSProtection = new DDoSProtectionEngine();

/**
 * Middleware wrapper for DDoS protection
 */
export function withDDoSProtection(config?: Partial<DDoSConfig>) {
  const engine = config ? new DDoSProtectionEngine(config) : globalDDoSProtection;

  return function ddosMiddleware(handler: Function) {
    return async function(req: any, res: any) {
      const startTime = Date.now();
      
      try {
        // Analyze the request
        const analysis = engine.analyzeRequest(req);

        if (!analysis.allowed) {
          // Set appropriate headers
          res.setHeader('X-DDoS-Protection', 'blocked');
          res.setHeader('X-Risk-Score', analysis.riskScore);
          
          if (analysis.blockDuration) {
            res.setHeader('Retry-After', Math.ceil(analysis.blockDuration / 1000));
          }

          return res.status(429).json({
            error: 'Request Blocked',
            message: analysis.reason,
            riskScore: analysis.riskScore,
            mitigation: analysis.mitigation,
            retryAfter: analysis.blockDuration ? Math.ceil(analysis.blockDuration / 1000) : undefined
          });
        }

        // Set protection headers
        res.setHeader('X-DDoS-Protection', 'active');
        res.setHeader('X-Risk-Score', analysis.riskScore);

        // Execute the handler
        const result = await handler(req, res);

        // Record successful completion
        const responseTime = Date.now() - startTime;
        engine.recordRequestComplete(req, responseTime, res.statusCode || 200);

        return result;

      } catch (error) {
        // Record failed request
        const responseTime = Date.now() - startTime;
        engine.recordRequestComplete(req, responseTime, 500);
        throw error;
      }
    };
  };
}

/**
 * DDoS protection configurations for different endpoint types
 */
export const DDoSConfigs = {
  // High-value endpoints (payment, processing)
  CRITICAL: {
    windowMs: 60 * 1000,
    maxRequestsPerWindow: 10,
    maxConcurrentConnections: 3,
    suspiciousThreshold: 60,
    blockDuration: 30 * 60 * 1000, // 30 minutes
    enableGeoBlocking: true,
    rateLimitByUserAgent: true
  } as DDoSConfig,

  // Authentication endpoints
  AUTH: {
    windowMs: 60 * 1000,
    maxRequestsPerWindow: 20,
    maxConcurrentConnections: 5,
    suspiciousThreshold: 70,
    blockDuration: 15 * 60 * 1000, // 15 minutes
    enableGeoBlocking: false,
    rateLimitByUserAgent: true
  } as DDoSConfig,

  // General API endpoints
  GENERAL: {
    windowMs: 60 * 1000,
    maxRequestsPerWindow: 60,
    maxConcurrentConnections: 10,
    suspiciousThreshold: 80,
    blockDuration: 10 * 60 * 1000, // 10 minutes
    enableGeoBlocking: false,
    rateLimitByUserAgent: false
  } as DDoSConfig,

  // Public endpoints
  PUBLIC: {
    windowMs: 60 * 1000,
    maxRequestsPerWindow: 100,
    maxConcurrentConnections: 15,
    suspiciousThreshold: 85,
    blockDuration: 5 * 60 * 1000, // 5 minutes
    enableGeoBlocking: false,
    rateLimitByUserAgent: false
  } as DDoSConfig
};

export default {
  withDDoSProtection,
  DDoSConfigs,
  globalDDoSProtection
};