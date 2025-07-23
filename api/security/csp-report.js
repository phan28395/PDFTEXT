/**
 * CSP Violation Reporting Endpoint
 * Collects and processes Content Security Policy violations
 */

import { applySecurityHeaders } from '../../src/lib/securityHeaders.ts';

export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  
  try {
    const violation = req.body['csp-report'] || req.body;
    
    // Validate the violation report
    if (!violation || typeof violation !== 'object') {
      res.status(400).json({ error: 'Invalid CSP report format' });
      return;
    }
    
    // Log the violation with detailed information
    const violationLog = {
      timestamp: new Date().toISOString(),
      type: 'csp_violation',
      violation: {
        documentUri: violation['document-uri'] || violation.documentUri,
        referrer: violation.referrer,
        violatedDirective: violation['violated-directive'] || violation.violatedDirective,
        effectiveDirective: violation['effective-directive'] || violation.effectiveDirective,
        originalPolicy: violation['original-policy'] || violation.originalPolicy,
        blockedUri: violation['blocked-uri'] || violation.blockedUri,
        statusCode: violation['status-code'] || violation.statusCode,
        lineNumber: violation['line-number'] || violation.lineNumber,
        columnNumber: violation['column-number'] || violation.columnNumber,
        sourceFile: violation['source-file'] || violation.sourceFile
      },
      clientInfo: {
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'] || 'Unknown',
        referer: req.headers.referer || 'Direct',
        acceptLanguage: req.headers['accept-language'] || 'Unknown'
      },
      severity: categorizeViolation(violation)
    };
    
    // In production, you would store this in a database or send to a monitoring service
    // For now, we'll log to console with structured data
    if (process.env.NODE_ENV === 'development') {
      console.warn('🚨 CSP Violation:', JSON.stringify(violationLog, null, 2));
    } else {
      // In production, send to monitoring service (e.g., Sentry, LogRocket, DataDog)
      await logToSecurityMonitoring(violationLog);
      
      // Also log to console for server logs
      console.warn('CSP Violation:', JSON.stringify(violationLog));
    }
    
    // Check if this is a high-severity violation that needs immediate attention
    if (violationLog.severity === 'critical') {
      await alertSecurityTeam(violationLog);
    }
    
    // Respond with success (don't give away too much information)
    res.status(204).end();
    
  } catch (error) {
    console.error('Error processing CSP report:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Get client IP address
 */
function getClientIP(req) {
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
 * Categorize CSP violation severity
 */
function categorizeViolation(violation) {
  const blockedUri = violation['blocked-uri'] || violation.blockedUri || '';
  const violatedDirective = violation['violated-directive'] || violation.violatedDirective || '';
  
  // Critical violations (potential XSS attempts)
  if (blockedUri.includes('javascript:') || 
      blockedUri.includes('data:text/html') ||
      violatedDirective.includes('script-src') && blockedUri.includes('eval')) {
    return 'critical';
  }
  
  // High severity violations
  if (violatedDirective.includes('script-src') || 
      violatedDirective.includes('object-src') ||
      violatedDirective.includes('frame-src')) {
    return 'high';
  }
  
  // Medium severity violations
  if (violatedDirective.includes('style-src') ||
      violatedDirective.includes('img-src') ||
      violatedDirective.includes('connect-src')) {
    return 'medium';
  }
  
  // Low severity violations
  return 'low';
}

/**
 * Log to security monitoring service (placeholder for production implementation)
 */
async function logToSecurityMonitoring(violationLog) {
  // TODO: Implement integration with your preferred monitoring service
  // Examples:
  // - Sentry: Sentry.captureMessage('CSP Violation', 'warning', { extra: violationLog });
  // - DataDog: dogapi.metric.send('csp.violation', 1, { tags: [...] });
  // - Custom API: await fetch('/api/monitoring/security', { method: 'POST', body: JSON.stringify(violationLog) });
  
  console.log('Security monitoring log:', violationLog);
}

/**
 * Alert security team for critical violations (placeholder)
 */
async function alertSecurityTeam(violationLog) {
  // TODO: Implement alerting mechanism
  // Examples:
  // - Slack webhook
  // - Email notification
  // - PagerDuty integration
  // - Discord webhook
  
  console.error('🔥 CRITICAL CSP VIOLATION - Security team should be alerted:', violationLog);
}

/**
 * Additional security monitoring for trends and patterns
 */
export class CSPViolationAnalyzer {
  static violations = new Map();
  
  static analyzePattern(violation) {
    const key = `${violation.clientInfo.ip}_${violation.violation.violatedDirective}`;
    const existing = this.violations.get(key) || { count: 0, firstSeen: Date.now() };
    existing.count++;
    existing.lastSeen = Date.now();
    this.violations.set(key, existing);
    
    // Check for patterns that might indicate an attack
    if (existing.count > 10 && (existing.lastSeen - existing.firstSeen) < 60000) { // 10 violations in 1 minute
      return {
        suspicious: true,
        pattern: 'rapid_violations',
        details: existing
      };
    }
    
    return { suspicious: false };
  }
  
  static getViolationStats() {
    const stats = {
      totalViolations: 0,
      uniqueSources: this.violations.size,
      topViolatedDirectives: {},
      suspiciousIPs: []
    };
    
    this.violations.forEach((data, key) => {
      stats.totalViolations += data.count;
      const directive = key.split('_')[1];
      stats.topViolatedDirectives[directive] = (stats.topViolatedDirectives[directive] || 0) + data.count;
      
      if (data.count > 5) {
        stats.suspiciousIPs.push({
          ip: key.split('_')[0],
          count: data.count,
          directive
        });
      }
    });
    
    return stats;
  }
}