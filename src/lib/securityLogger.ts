/**
 * Comprehensive Security Logging System
 * Advanced logging for security monitoring, threat detection, and compliance
 */

import { createClient } from '@supabase/supabase-js';

export enum SecurityEventType {
  AUTH_LOGIN = 'auth_login',
  AUTH_LOGIN_FAILED = 'auth_login_failed',
  AUTH_LOGOUT = 'auth_logout',
  AUTH_REGISTER = 'auth_register',
  AUTH_PASSWORD_RESET = 'auth_password_reset',
  API_KEY_ROTATION = 'api_key_rotation',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CSP_VIOLATION = 'csp_violation',
  FILE_UPLOAD = 'file_upload',
  FILE_PROCESSING = 'file_processing',
  PAYMENT_INITIATED = 'payment_initiated',
  PAYMENT_COMPLETED = 'payment_completed',
  PAYMENT_FAILED = 'payment_failed',
  ADMIN_ACTION = 'admin_action',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  SECURITY_BREACH = 'security_breach',
  DATA_ACCESS = 'data_access',
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
  SYSTEM_ERROR = 'system_error',
  MALWARE_DETECTED = 'malware_detected',
  IP_BLOCKED = 'ip_blocked',
  USER_SUSPENDED = 'user_suspended'
}

export enum SecuritySeverity {
  INFO = 'info',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface SecurityEvent {
  id?: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  message: string;
  details: Record<string, any>;
  fingerprint?: string; // For deduplication
  environment: string;
  source: string; // API, Frontend, System, etc.
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  tags: string[];
  metadata: Record<string, any>;
}

export interface SecurityMetrics {
  totalEvents: number;
  eventsBySeverity: Record<SecuritySeverity, number>;
  eventsByType: Record<SecurityEventType, number>;
  uniqueIPs: number;
  uniqueUsers: number;
  topThreats: Array<{
    type: SecurityEventType;
    count: number;
    severity: SecuritySeverity;
  }>;
  timeRange: {
    from: Date;
    to: Date;
  };
}

/**
 * Security Logger Class
 */
export class SecurityLogger {
  private supabase: any;
  private logBuffer: SecurityEvent[] = [];
  private bufferSize = 100;
  private flushInterval = 5000; // 5 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.startPeriodicFlush();
  }

  /**
   * Log a security event
   */
  async logEvent(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'environment' | 'fingerprint'>): Promise<void> {
    const securityEvent: SecurityEvent = {
      ...event,
      timestamp: new Date(),
      environment: process.env.NODE_ENV || 'development',
      fingerprint: this.generateFingerprint(event)
    };

    // Add to buffer for batch processing
    this.logBuffer.push(securityEvent);

    // Log critical events immediately
    if (event.severity === SecuritySeverity.CRITICAL) {
      await this.flushBufferImmediately();
      await this.triggerCriticalAlert(securityEvent);
    } else if (this.logBuffer.length >= this.bufferSize) {
      await this.flushBufferImmediately();
    }

    // Also log to console in development
    if (process.env.NODE_ENV === 'development') {
      this.logToConsole(securityEvent);
    }
  }

  /**
   * Generate fingerprint for event deduplication
   */
  private generateFingerprint(event: Omit<SecurityEvent, 'id' | 'timestamp' | 'environment' | 'fingerprint'>): string {
    const key = `${event.eventType}_${event.ipAddress}_${event.userId || 'anonymous'}_${event.endpoint || ''}`;
    return Buffer.from(key).toString('base64');
  }

  /**
   * Flush log buffer to database
   */
  private async flushBuffer(): Promise<void> {
    if (this.logBuffer.length === 0) return;

    try {
      const events = [...this.logBuffer];
      this.logBuffer = [];

      const { error } = await this.supabase
        .from('security_events')
        .insert(events);

      if (error) {
        console.error('Failed to flush security events:', error);
        // Put events back in buffer for retry
        this.logBuffer.unshift(...events);
      } else {
        console.log(`✅ Flushed ${events.length} security events to database`);
      }
    } catch (error) {
      console.error('Error flushing security log buffer:', error);
    }
  }

  /**
   * Flush buffer immediately (for critical events)
   */
  private async flushBufferImmediately(): Promise<void> {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    await this.flushBuffer();
    this.startPeriodicFlush();
  }

  /**
   * Start periodic buffer flush
   */
  private startPeriodicFlush(): void {
    this.flushTimer = setTimeout(async () => {
      await this.flushBuffer();
      this.startPeriodicFlush();
    }, this.flushInterval);
  }

  /**
   * Log to console for development
   */
  private logToConsole(event: SecurityEvent): void {
    const emoji = this.getSeverityEmoji(event.severity);
    const color = this.getSeverityColor(event.severity);
    
    console.log(
      `${color}${emoji} [${event.severity.toUpperCase()}] ${event.eventType}${'\x1b[0m'}`,
      {
        timestamp: event.timestamp.toISOString(),
        ip: event.ipAddress,
        user: event.userId || 'anonymous',
        message: event.message,
        details: event.details
      }
    );
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.INFO: return 'ℹ️ ';
      case SecuritySeverity.LOW: return '🟡';
      case SecuritySeverity.MEDIUM: return '🟠';
      case SecuritySeverity.HIGH: return '🔴';
      case SecuritySeverity.CRITICAL: return '🚨';
      default: return '🔍';
    }
  }

  /**
   * Get console color for severity level
   */
  private getSeverityColor(severity: SecuritySeverity): string {
    switch (severity) {
      case SecuritySeverity.INFO: return '\x1b[36m'; // Cyan
      case SecuritySeverity.LOW: return '\x1b[33m'; // Yellow
      case SecuritySeverity.MEDIUM: return '\x1b[35m'; // Magenta
      case SecuritySeverity.HIGH: return '\x1b[31m'; // Red
      case SecuritySeverity.CRITICAL: return '\x1b[41m\x1b[37m'; // Red background, white text
      default: return '\x1b[0m'; // Reset
    }
  }

  /**
   * Trigger critical alert
   */
  private async triggerCriticalAlert(event: SecurityEvent): Promise<void> {
    console.error('🚨 CRITICAL SECURITY EVENT:', event);
    
    // TODO: Implement alerting mechanisms:
    // - Send to monitoring service (DataDog, Sentry, etc.)
    // - Send Slack/Discord webhook
    // - Send email to security team
    // - Create incident in incident management system
    
    try {
      // For now, just log to monitoring endpoint
      await this.sendToMonitoringService(event);
    } catch (error) {
      console.error('Failed to send critical alert:', error);
    }
  }

  /**
   * Send event to external monitoring service
   */
  private async sendToMonitoringService(event: SecurityEvent): Promise<void> {
    // Placeholder for external monitoring integration
    // Examples: Sentry, DataDog, New Relic, LogRocket, etc.
    
    if (process.env.MONITORING_WEBHOOK_URL) {
      try {
        await fetch(process.env.MONITORING_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.MONITORING_API_KEY}`
          },
          body: JSON.stringify({
            alert_type: 'security_event',
            severity: event.severity,
            event_type: event.eventType,
            message: event.message,
            timestamp: event.timestamp.toISOString(),
            details: event
          })
        });
      } catch (error) {
        console.error('Failed to send to monitoring service:', error);
      }
    }
  }

  /**
   * Get security metrics for a time period
   */
  async getSecurityMetrics(
    fromDate: Date,
    toDate: Date,
    filters?: {
      severity?: SecuritySeverity[];
      eventTypes?: SecurityEventType[];
      userIds?: string[];
      ipAddresses?: string[];
    }
  ): Promise<SecurityMetrics> {
    try {
      let query = this.supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString());

      if (filters?.severity) {
        query = query.in('severity', filters.severity);
      }
      if (filters?.eventTypes) {
        query = query.in('event_type', filters.eventTypes);
      }
      if (filters?.userIds) {
        query = query.in('user_id', filters.userIds);
      }
      if (filters?.ipAddresses) {
        query = query.in('ip_address', filters.ipAddresses);
      }

      const { data: events, error } = await query;

      if (error) throw error;

      return this.calculateMetrics(events || [], fromDate, toDate);
    } catch (error) {
      console.error('Error getting security metrics:', error);
      throw error;
    }
  }

  /**
   * Calculate security metrics from events
   */
  private calculateMetrics(events: any[], fromDate: Date, toDate: Date): SecurityMetrics {
    const metrics: SecurityMetrics = {
      totalEvents: events.length,
      eventsBySeverity: {} as Record<SecuritySeverity, number>,
      eventsByType: {} as Record<SecurityEventType, number>,
      uniqueIPs: new Set(events.map(e => e.ip_address)).size,
      uniqueUsers: new Set(events.filter(e => e.user_id).map(e => e.user_id)).size,
      topThreats: [],
      timeRange: { from: fromDate, to: toDate }
    };

    // Initialize counters
    Object.values(SecuritySeverity).forEach(severity => {
      metrics.eventsBySeverity[severity] = 0;
    });
    Object.values(SecurityEventType).forEach(type => {
      metrics.eventsByType[type] = 0;
    });

    // Count events
    events.forEach(event => {
      metrics.eventsBySeverity[event.severity as SecuritySeverity]++;
      metrics.eventsByType[event.event_type as SecurityEventType]++;
    });

    // Calculate top threats
    metrics.topThreats = Object.entries(metrics.eventsByType)
      .map(([type, count]) => ({
        type: type as SecurityEventType,
        count,
        severity: this.getTypeSeverity(type as SecurityEventType)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return metrics;
  }

  /**
   * Get typical severity for event type
   */
  private getTypeSeverity(eventType: SecurityEventType): SecuritySeverity {
    const severityMap: Record<SecurityEventType, SecuritySeverity> = {
      [SecurityEventType.AUTH_LOGIN]: SecuritySeverity.INFO,
      [SecurityEventType.AUTH_LOGIN_FAILED]: SecuritySeverity.MEDIUM,
      [SecurityEventType.AUTH_LOGOUT]: SecuritySeverity.INFO,
      [SecurityEventType.AUTH_REGISTER]: SecuritySeverity.INFO,
      [SecurityEventType.AUTH_PASSWORD_RESET]: SecuritySeverity.MEDIUM,
      [SecurityEventType.API_KEY_ROTATION]: SecuritySeverity.INFO,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: SecuritySeverity.HIGH,
      [SecurityEventType.CSP_VIOLATION]: SecuritySeverity.HIGH,
      [SecurityEventType.FILE_UPLOAD]: SecuritySeverity.INFO,
      [SecurityEventType.FILE_PROCESSING]: SecuritySeverity.INFO,
      [SecurityEventType.PAYMENT_INITIATED]: SecuritySeverity.INFO,
      [SecurityEventType.PAYMENT_COMPLETED]: SecuritySeverity.INFO,
      [SecurityEventType.PAYMENT_FAILED]: SecuritySeverity.MEDIUM,
      [SecurityEventType.ADMIN_ACTION]: SecuritySeverity.HIGH,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: SecuritySeverity.HIGH,
      [SecurityEventType.SECURITY_BREACH]: SecuritySeverity.CRITICAL,
      [SecurityEventType.DATA_ACCESS]: SecuritySeverity.MEDIUM,
      [SecurityEventType.DATA_EXPORT]: SecuritySeverity.HIGH,
      [SecurityEventType.DATA_DELETION]: SecuritySeverity.HIGH,
      [SecurityEventType.SYSTEM_ERROR]: SecuritySeverity.MEDIUM,
      [SecurityEventType.MALWARE_DETECTED]: SecuritySeverity.CRITICAL,
      [SecurityEventType.IP_BLOCKED]: SecuritySeverity.HIGH,
      [SecurityEventType.USER_SUSPENDED]: SecuritySeverity.HIGH
    };

    return severityMap[eventType] || SecuritySeverity.MEDIUM;
  }

  /**
   * Search security events
   */
  async searchEvents(
    query: string,
    limit = 100,
    filters?: {
      severity?: SecuritySeverity[];
      eventTypes?: SecurityEventType[];
      fromDate?: Date;
      toDate?: Date;
    }
  ): Promise<SecurityEvent[]> {
    try {
      let dbQuery = this.supabase
        .from('security_events')
        .select('*')
        .or(`message.ilike.%${query}%,details.ilike.%${query}%`)
        .order('timestamp', { ascending: false })
        .limit(limit);

      if (filters?.severity) {
        dbQuery = dbQuery.in('severity', filters.severity);
      }
      if (filters?.eventTypes) {
        dbQuery = dbQuery.in('event_type', filters.eventTypes);
      }
      if (filters?.fromDate) {
        dbQuery = dbQuery.gte('timestamp', filters.fromDate.toISOString());
      }
      if (filters?.toDate) {
        dbQuery = dbQuery.lte('timestamp', filters.toDate.toISOString());
      }

      const { data, error } = await dbQuery;

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Error searching security events:', error);
      throw error;
    }
  }

  /**
   * Mark event as resolved
   */
  async resolveEvent(eventId: string, resolvedBy: string, resolution?: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('security_events')
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          resolved_by: resolvedBy,
          metadata: resolution ? { resolution } : undefined
        })
        .eq('id', eventId);

      if (error) throw error;
    } catch (error) {
      console.error('Error resolving security event:', error);
      throw error;
    }
  }

  /**
   * Cleanup old events (for compliance and performance)
   */
  async cleanupOldEvents(retentionDays = 365): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      const { data, error } = await this.supabase
        .from('security_events')
        .delete()
        .lt('timestamp', cutoffDate.toISOString());

      if (error) throw error;

      const deletedCount = Array.isArray(data) ? data.length : 0;
      console.log(`Cleaned up ${deletedCount} old security events`);
      
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up old security events:', error);
      throw error;
    }
  }

  /**
   * Export security events for compliance
   */
  async exportEvents(
    fromDate: Date,
    toDate: Date,
    format: 'json' | 'csv' = 'json'
  ): Promise<string> {
    try {
      const { data: events, error } = await this.supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', fromDate.toISOString())
        .lte('timestamp', toDate.toISOString())
        .order('timestamp', { ascending: true });

      if (error) throw error;

      if (format === 'csv') {
        return this.eventsToCSV(events || []);
      } else {
        return JSON.stringify(events || [], null, 2);
      }
    } catch (error) {
      console.error('Error exporting security events:', error);
      throw error;
    }
  }

  /**
   * Convert events to CSV format
   */
  private eventsToCSV(events: any[]): string {
    if (events.length === 0) return '';

    const headers = Object.keys(events[0]).join(',');
    const rows = events.map(event => 
      Object.values(event)
        .map(value => typeof value === 'string' ? `"${value}"` : value)
        .join(',')
    );

    return [headers, ...rows].join('\n');
  }

  /**
   * Destroy logger and cleanup
   */
  destroy(): void {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
    }
    // Flush remaining events
    this.flushBufferImmediately().catch(console.error);
  }
}

// Singleton instance
export const securityLogger = new SecurityLogger();

// Helper functions for common logging scenarios
export const logAuthEvent = async (
  type: SecurityEventType,
  userId: string | undefined,
  ipAddress: string,
  userAgent: string,
  success: boolean,
  details: Record<string, any> = {}
) => {
  await securityLogger.logEvent({
    eventType: type,
    severity: success ? SecuritySeverity.INFO : SecuritySeverity.MEDIUM,
    userId,
    ipAddress,
    userAgent,
    message: `Authentication ${type.replace('auth_', '')} ${success ? 'successful' : 'failed'}`,
    details: { success, ...details },
    source: 'auth',
    tags: ['authentication'],
    metadata: {}
  });
};

export const logAdminAction = async (
  action: string,
  userId: string,
  ipAddress: string,
  userAgent: string,
  details: Record<string, any> = {}
) => {
  await securityLogger.logEvent({
    eventType: SecurityEventType.ADMIN_ACTION,
    severity: SecuritySeverity.HIGH,
    userId,
    ipAddress,
    userAgent,
    message: `Admin action: ${action}`,
    details,
    source: 'admin',
    tags: ['admin', 'privileged'],
    metadata: {}
  });
};

export const logSuspiciousActivity = async (
  description: string,
  userId: string | undefined,
  ipAddress: string,
  userAgent: string,
  details: Record<string, any> = {}
) => {
  await securityLogger.logEvent({
    eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity: SecuritySeverity.HIGH,
    userId,
    ipAddress,
    userAgent,
    message: `Suspicious activity: ${description}`,
    details,
    source: 'threat_detection',
    tags: ['suspicious', 'security'],
    metadata: {}
  });
};