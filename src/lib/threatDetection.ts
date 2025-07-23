/**
 * Real-time Security Monitoring and Threat Detection System
 * Advanced threat detection with pattern analysis and automated responses
 */

import { securityLogger, SecurityEventType, SecuritySeverity, logSuspiciousActivity } from './securityLogger';

export interface ThreatPattern {
  id: string;
  name: string;
  description: string;
  severity: SecuritySeverity;
  conditions: ThreatCondition[];
  timeWindow: number; // in milliseconds
  threshold: number;
  actions: ThreatAction[];
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
}

export interface ThreatCondition {
  field: string; // 'eventType', 'ipAddress', 'userId', etc.
  operator: 'equals' | 'contains' | 'startsWith' | 'greaterThan' | 'lessThan' | 'in';
  value: any;
}

export interface ThreatAction {
  type: 'log' | 'block_ip' | 'suspend_user' | 'alert' | 'rate_limit';
  parameters: Record<string, any>;
}

export interface ThreatAlert {
  id: string;
  pattern: ThreatPattern;
  triggeredAt: Date;
  events: any[];
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

/**
 * Real-time Threat Detection Engine
 */
export class ThreatDetectionEngine {
  private patterns: Map<string, ThreatPattern> = new Map();
  private eventBuffer: Map<string, any[]> = new Map();
  private blockedIPs: Set<string> = new Set();
  private suspendedUsers: Set<string> = new Set();
  private alerts: Map<string, ThreatAlert> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultPatterns();
    this.startRealTimeMonitoring();
  }

  /**
   * Initialize default threat detection patterns
   */
  private initializeDefaultPatterns(): void {
    // Brute force login attempts
    this.addPattern({
      id: 'brute_force_login',
      name: 'Brute Force Login Attempts',
      description: 'Multiple failed login attempts from the same IP',
      severity: SecuritySeverity.HIGH,
      conditions: [
        { field: 'eventType', operator: 'equals', value: SecurityEventType.AUTH_LOGIN_FAILED },
        { field: 'ipAddress', operator: 'equals', value: '${ipAddress}' } // Dynamic value
      ],
      timeWindow: 15 * 60 * 1000, // 15 minutes
      threshold: 5,
      actions: [
        { type: 'block_ip', parameters: { duration: 60 * 60 * 1000 } }, // 1 hour
        { type: 'alert', parameters: { severity: 'high', channel: 'security' } },
        { type: 'log', parameters: { message: 'IP blocked for brute force attempts' } }
      ],
      isActive: true,
      triggerCount: 0
    });

    // Rapid API requests (potential DDoS)
    this.addPattern({
      id: 'rapid_api_requests',
      name: 'Rapid API Requests',
      description: 'Unusually high number of API requests from single source',
      severity: SecuritySeverity.HIGH,
      conditions: [
        { field: 'source', operator: 'equals', value: 'API' },
        { field: 'ipAddress', operator: 'equals', value: '${ipAddress}' }
      ],
      timeWindow: 5 * 60 * 1000, // 5 minutes
      threshold: 100,
      actions: [
        { type: 'rate_limit', parameters: { duration: 30 * 60 * 1000, limit: 10 } },
        { type: 'alert', parameters: { severity: 'high', channel: 'security' } },
        { type: 'log', parameters: { message: 'Rate limiting applied for excessive requests' } }
      ],
      isActive: true,
      triggerCount: 0
    });

    // Multiple CSP violations
    this.addPattern({
      id: 'csp_violation_pattern',
      name: 'Multiple CSP Violations',
      description: 'Multiple CSP violations indicating potential XSS attack',
      severity: SecuritySeverity.CRITICAL,
      conditions: [
        { field: 'eventType', operator: 'equals', value: SecurityEventType.CSP_VIOLATION },
        { field: 'ipAddress', operator: 'equals', value: '${ipAddress}' }
      ],
      timeWindow: 10 * 60 * 1000, // 10 minutes
      threshold: 3,
      actions: [
        { type: 'block_ip', parameters: { duration: 24 * 60 * 60 * 1000 } }, // 24 hours
        { type: 'alert', parameters: { severity: 'critical', channel: 'security' } },
        { type: 'log', parameters: { message: 'Critical: Potential XSS attack detected' } }
      ],
      isActive: true,
      triggerCount: 0
    });

    // Suspicious file upload patterns
    this.addPattern({
      id: 'suspicious_file_uploads',
      name: 'Suspicious File Upload Pattern',
      description: 'Multiple suspicious file uploads or malware detection',
      severity: SecuritySeverity.CRITICAL,
      conditions: [
        { field: 'eventType', operator: 'in', value: [SecurityEventType.MALWARE_DETECTED, SecurityEventType.FILE_UPLOAD] },
        { field: 'userId', operator: 'equals', value: '${userId}' }
      ],
      timeWindow: 30 * 60 * 1000, // 30 minutes
      threshold: 3,
      actions: [
        { type: 'suspend_user', parameters: { duration: 24 * 60 * 60 * 1000 } },
        { type: 'alert', parameters: { severity: 'critical', channel: 'security' } },
        { type: 'log', parameters: { message: 'User suspended for suspicious file activity' } }
      ],
      isActive: true,
      triggerCount: 0
    });

    // Admin action anomalies
    this.addPattern({
      id: 'admin_action_anomaly',
      name: 'Unusual Admin Activity',
      description: 'Unusual patterns in admin actions',
      severity: SecuritySeverity.HIGH,
      conditions: [
        { field: 'eventType', operator: 'equals', value: SecurityEventType.ADMIN_ACTION },
        { field: 'userId', operator: 'equals', value: '${userId}' }
      ],
      timeWindow: 60 * 60 * 1000, // 1 hour
      threshold: 10,
      actions: [
        { type: 'alert', parameters: { severity: 'high', channel: 'admin' } },
        { type: 'log', parameters: { message: 'High volume of admin actions detected' } }
      ],
      isActive: true,
      triggerCount: 0
    });

    // Payment fraud indicators
    this.addPattern({
      id: 'payment_fraud_pattern',
      name: 'Payment Fraud Indicators',
      description: 'Multiple failed payments indicating potential fraud',
      severity: SecuritySeverity.HIGH,
      conditions: [
        { field: 'eventType', operator: 'equals', value: SecurityEventType.PAYMENT_FAILED },
        { field: 'ipAddress', operator: 'equals', value: '${ipAddress}' }
      ],
      timeWindow: 30 * 60 * 1000, // 30 minutes
      threshold: 3,
      actions: [
        { type: 'block_ip', parameters: { duration: 4 * 60 * 60 * 1000 } }, // 4 hours
        { type: 'alert', parameters: { severity: 'high', channel: 'fraud' } },
        { type: 'log', parameters: { message: 'Potential payment fraud detected' } }
      ],
      isActive: true,
      triggerCount: 0
    });
  }

  /**
   * Add a new threat detection pattern
   */
  addPattern(pattern: ThreatPattern): void {
    this.patterns.set(pattern.id, pattern);
  }

  /**
   * Remove a threat detection pattern
   */
  removePattern(patternId: string): void {
    this.patterns.delete(patternId);
  }

  /**
   * Process a security event for threat detection
   */
  async processEvent(event: any): Promise<void> {
    try {
      // Add event to buffer for pattern matching
      const eventKey = this.generateEventKey(event);
      if (!this.eventBuffer.has(eventKey)) {
        this.eventBuffer.set(eventKey, []);
      }
      this.eventBuffer.get(eventKey)!.push(event);

      // Check all active patterns
      for (const [patternId, pattern] of this.patterns) {
        if (!pattern.isActive) continue;
        
        const matches = await this.evaluatePattern(pattern, event);
        if (matches.length >= pattern.threshold) {
          await this.triggerPattern(pattern, matches);
        }
      }

      // Clean up old events from buffer
      this.cleanupEventBuffer();
    } catch (error) {
      console.error('Error processing event for threat detection:', error);
    }
  }

  /**
   * Generate a key for event buffering based on pattern conditions
   */
  private generateEventKey(event: any): string {
    // Use IP address and user ID as primary grouping keys
    return `${event.ipAddress || 'unknown'}_${event.userId || 'anonymous'}`;
  }

  /**
   * Evaluate if a pattern matches current events
   */
  private async evaluatePattern(pattern: ThreatPattern, newEvent: any): Promise<any[]> {
    const cutoffTime = Date.now() - pattern.timeWindow;
    const matchingEvents: any[] = [];

    // Get events from buffer that match the pattern conditions
    for (const [eventKey, events] of this.eventBuffer) {
      const recentEvents = events.filter(event => 
        new Date(event.timestamp).getTime() > cutoffTime
      );

      for (const event of recentEvents) {
        if (this.eventMatchesConditions(event, pattern.conditions, newEvent)) {
          matchingEvents.push(event);
        }
      }
    }

    return matchingEvents;
  }

  /**
   * Check if an event matches the pattern conditions
   */
  private eventMatchesConditions(event: any, conditions: ThreatCondition[], contextEvent: any): boolean {
    return conditions.every(condition => {
      let targetValue = condition.value;
      
      // Handle dynamic values (e.g., ${ipAddress})
      if (typeof targetValue === 'string' && targetValue.startsWith('${') && targetValue.endsWith('}')) {
        const field = targetValue.slice(2, -1);
        targetValue = contextEvent[field];
      }

      const eventValue = event[condition.field];

      switch (condition.operator) {
        case 'equals':
          return eventValue === targetValue;
        case 'contains':
          return typeof eventValue === 'string' && eventValue.includes(targetValue);
        case 'startsWith':
          return typeof eventValue === 'string' && eventValue.startsWith(targetValue);
        case 'greaterThan':
          return typeof eventValue === 'number' && eventValue > targetValue;
        case 'lessThan':
          return typeof eventValue === 'number' && eventValue < targetValue;
        case 'in':
          return Array.isArray(targetValue) && targetValue.includes(eventValue);
        default:
          return false;
      }
    });
  }

  /**
   * Trigger a threat pattern and execute actions
   */
  private async triggerPattern(pattern: ThreatPattern, matchingEvents: any[]): Promise<void> {
    try {
      // Update pattern statistics
      pattern.lastTriggered = new Date();
      pattern.triggerCount++;

      // Create alert
      const alertId = `alert_${pattern.id}_${Date.now()}`;
      const alert: ThreatAlert = {
        id: alertId,
        pattern,
        triggeredAt: new Date(),
        events: matchingEvents,
        metadata: this.extractAlertMetadata(matchingEvents),
        resolved: false
      };

      this.alerts.set(alertId, alert);

      // Execute actions
      for (const action of pattern.actions) {
        await this.executeAction(action, matchingEvents, alert);
      }

      // Log the pattern trigger
      await securityLogger.logEvent({
        eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
        severity: pattern.severity,
        ipAddress: matchingEvents[0]?.ipAddress || '0.0.0.0',
        userAgent: matchingEvents[0]?.userAgent || 'Unknown',
        userId: matchingEvents[0]?.userId,
        message: `Threat pattern triggered: ${pattern.name}`,
        details: {
          patternId: pattern.id,
          matchingEventsCount: matchingEvents.length,
          threshold: pattern.threshold,
          timeWindow: pattern.timeWindow,
          alertId
        },
        source: 'threat_detection',
        tags: ['threat_detection', 'pattern_match', pattern.id],
        metadata: { alert }
      });

      console.log(`🚨 Threat pattern triggered: ${pattern.name}`, {
        alertId,
        eventCount: matchingEvents.length,
        severity: pattern.severity
      });

    } catch (error) {
      console.error('Error triggering threat pattern:', error);
    }
  }

  /**
   * Execute a threat action
   */
  private async executeAction(action: ThreatAction, events: any[], alert: ThreatAlert): Promise<void> {
    try {
      switch (action.type) {
        case 'block_ip':
          await this.blockIP(events[0]?.ipAddress, action.parameters.duration);
          break;
        case 'suspend_user':
          await this.suspendUser(events[0]?.userId, action.parameters.duration);
          break;
        case 'rate_limit':
          await this.applyRateLimit(events[0]?.ipAddress, action.parameters);
          break;
        case 'alert':
          await this.sendAlert(alert, action.parameters);
          break;
        case 'log':
          await this.logAction(action.parameters.message, events, alert);
          break;
        default:
          console.warn('Unknown threat action type:', action.type);
      }
    } catch (error) {
      console.error('Error executing threat action:', error);
    }
  }

  /**
   * Block an IP address
   */
  private async blockIP(ipAddress: string, duration: number): Promise<void> {
    if (!ipAddress) return;

    this.blockedIPs.add(ipAddress);
    console.log(`🚫 Blocked IP: ${ipAddress} for ${duration}ms`);

    // Auto-unblock after duration
    setTimeout(() => {
      this.blockedIPs.delete(ipAddress);
      console.log(`✅ Unblocked IP: ${ipAddress}`);
    }, duration);

    // Log the IP blocking
    await securityLogger.logEvent({
      eventType: SecurityEventType.IP_BLOCKED,
      severity: SecuritySeverity.HIGH,
      ipAddress,
      userAgent: 'System',
      message: `IP address blocked by threat detection`,
      details: { duration, reason: 'threat_pattern_match' },
      source: 'threat_detection',
      tags: ['ip_blocking', 'automated_response'],
      metadata: {}
    });
  }

  /**
   * Suspend a user
   */
  private async suspendUser(userId: string, duration: number): Promise<void> {
    if (!userId) return;

    this.suspendedUsers.add(userId);
    console.log(`⏸️  Suspended user: ${userId} for ${duration}ms`);

    // Auto-unsuspend after duration
    setTimeout(() => {
      this.suspendedUsers.delete(userId);
      console.log(`✅ Unsuspended user: ${userId}`);
    }, duration);

    // Log the user suspension
    await securityLogger.logEvent({
      eventType: SecurityEventType.USER_SUSPENDED,
      severity: SecuritySeverity.HIGH,
      ipAddress: '127.0.0.1',
      userAgent: 'System',
      userId,
      message: `User suspended by threat detection`,
      details: { duration, reason: 'threat_pattern_match' },
      source: 'threat_detection',
      tags: ['user_suspension', 'automated_response'],
      metadata: {}
    });
  }

  /**
   * Apply rate limiting
   */
  private async applyRateLimit(ipAddress: string, parameters: any): Promise<void> {
    if (!ipAddress) return;

    console.log(`⚡ Rate limiting applied to IP: ${ipAddress}`, parameters);
    // This would integrate with the existing rate limiting system
    // For now, just log the action
  }

  /**
   * Send alert
   */
  private async sendAlert(alert: ThreatAlert, parameters: any): Promise<void> {
    console.log(`📢 Security Alert: ${alert.pattern.name}`, {
      severity: parameters.severity,
      channel: parameters.channel,
      alertId: alert.id
    });

    // TODO: Implement actual alerting mechanisms:
    // - Email notifications
    // - Slack/Discord webhooks
    // - SMS alerts
    // - Push notifications
    // - Integration with incident management systems
  }

  /**
   * Log action
   */
  private async logAction(message: string, events: any[], alert: ThreatAlert): Promise<void> {
    await securityLogger.logEvent({
      eventType: SecurityEventType.ADMIN_ACTION,
      severity: SecuritySeverity.INFO,
      ipAddress: events[0]?.ipAddress || '127.0.0.1',
      userAgent: 'ThreatDetectionEngine',
      message: `Threat Detection Action: ${message}`,
      details: { eventCount: events.length, alertId: alert.id },
      source: 'threat_detection',
      tags: ['automated_action', 'threat_response'],
      metadata: {}
    });
  }

  /**
   * Extract metadata from matching events for alert
   */
  private extractAlertMetadata(events: any[]): Record<string, any> {
    const uniqueIPs = new Set(events.map(e => e.ipAddress)).size;
    const uniqueUsers = new Set(events.map(e => e.userId).filter(Boolean)).size;
    const timeSpan = events.length > 1 
      ? new Date(events[events.length - 1].timestamp).getTime() - new Date(events[0].timestamp).getTime()
      : 0;

    return {
      eventCount: events.length,
      uniqueIPs,
      uniqueUsers,
      timeSpanMs: timeSpan,
      firstEventTime: events[0]?.timestamp,
      lastEventTime: events[events.length - 1]?.timestamp
    };
  }

  /**
   * Clean up old events from buffer
   */
  private cleanupEventBuffer(): void {
    const maxAge = 2 * 60 * 60 * 1000; // 2 hours
    const cutoffTime = Date.now() - maxAge;

    for (const [key, events] of this.eventBuffer) {
      const recentEvents = events.filter(event => 
        new Date(event.timestamp).getTime() > cutoffTime
      );

      if (recentEvents.length === 0) {
        this.eventBuffer.delete(key);
      } else {
        this.eventBuffer.set(key, recentEvents);
      }
    }
  }

  /**
   * Start real-time monitoring
   */
  private startRealTimeMonitoring(): void {
    // Clean up buffer every 10 minutes
    this.monitoringInterval = setInterval(() => {
      this.cleanupEventBuffer();
    }, 10 * 60 * 1000);

    console.log('✅ Threat detection engine started with real-time monitoring');
  }

  /**
   * Check if an IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Check if a user is suspended
   */
  isUserSuspended(userId: string): boolean {
    return this.suspendedUsers.has(userId);
  }

  /**
   * Get current threat statistics
   */
  getThreatStatistics(): any {
    return {
      activePatterns: Array.from(this.patterns.values()).filter(p => p.isActive).length,
      totalPatterns: this.patterns.size,
      blockedIPs: this.blockedIPs.size,
      suspendedUsers: this.suspendedUsers.size,
      activeAlerts: Array.from(this.alerts.values()).filter(a => !a.resolved).length,
      totalAlerts: this.alerts.size,
      bufferSize: this.eventBuffer.size
    };
  }

  /**
   * Get all active alerts
   */
  getActiveAlerts(): ThreatAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolution?: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = new Date();
    if (resolution) {
      alert.metadata.resolution = resolution;
    }

    return true;
  }

  /**
   * Stop the threat detection engine
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('Threat detection engine stopped');
  }
}

// Singleton instance
export const threatDetection = new ThreatDetectionEngine();