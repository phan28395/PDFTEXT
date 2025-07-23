// Error tracking and alerting system
// Comprehensive error monitoring with real-time alerts and analytics

export interface ErrorReport {
  id: string;
  timestamp: Date;
  level: 'error' | 'warning' | 'info' | 'debug';
  message: string;
  stack?: string;
  userId?: string;
  url?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  fingerprint: string;
  tags: string[];
  context: {
    component?: string;
    action?: string;
    environment: string;
    release?: string;
  };
}

export interface ErrorAlert {
  id: string;
  errorFingerprint: string;
  alertType: 'new_error' | 'error_spike' | 'high_frequency' | 'critical_error';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  count: number;
  firstOccurrence: Date;
  lastOccurrence: Date;
  affectedUsers: number;
  resolved: boolean;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByLevel: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorRate: number;
  affectedUsers: number;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    count: number;
    lastOccurrence: Date;
  }>;
}

class ErrorTrackingService {
  private errors: ErrorReport[] = [];
  private alerts: ErrorAlert[] = [];
  private maxStoredErrors = 1000;
  private alertThresholds = {
    errorSpike: 10,      // More than 10 errors in 5 minutes
    highFrequency: 5,    // Same error 5+ times in 1 hour
    criticalError: 1,    // Any critical error
    newError: 1          // First occurrence of any error
  };

  // Report an error
  reportError(
    error: Error | string,
    level: ErrorReport['level'] = 'error',
    context?: Partial<ErrorReport['context']>,
    metadata?: Record<string, any>
  ): string {
    const errorMessage = error instanceof Error ? error.message : error;
    const stack = error instanceof Error ? error.stack : undefined;
    
    const report: ErrorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      level,
      message: errorMessage,
      stack,
      userId: this.getCurrentUserId(),
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      metadata,
      fingerprint: this.generateFingerprint(errorMessage, stack),
      tags: this.generateTags(errorMessage, context),
      context: {
        environment: process.env.NODE_ENV || 'development',
        release: process.env.VITE_APP_VERSION || 'unknown',
        ...context
      }
    };

    // Store locally
    this.errors.push(report);
    if (this.errors.length > this.maxStoredErrors) {
      this.errors.shift();
    }

    // Send to API
    this.sendErrorToAPI(report);

    // Check for alerts
    this.checkForAlerts(report);

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.group(`🔥 Error Report (${level.toUpperCase()})`);
      console.error('Message:', errorMessage);
      if (stack) console.error('Stack:', stack);
      if (metadata) console.log('Metadata:', metadata);
      if (context) console.log('Context:', context);
      console.groupEnd();
    }

    return report.id;
  }

  // Report a handled exception
  reportException(error: Error, context?: Partial<ErrorReport['context']>, metadata?: Record<string, any>): string {
    return this.reportError(error, 'error', context, metadata);
  }

  // Report a warning
  reportWarning(message: string, context?: Partial<ErrorReport['context']>, metadata?: Record<string, any>): string {
    return this.reportError(message, 'warning', context, metadata);
  }

  // Report informational message
  reportInfo(message: string, context?: Partial<ErrorReport['context']>, metadata?: Record<string, any>): string {
    return this.reportError(message, 'info', context, metadata);
  }

  // Generate error fingerprint for grouping
  private generateFingerprint(message: string, stack?: string): string {
    // Extract the core error message without dynamic content
    const cleanMessage = message
      .replace(/\d+/g, 'N')                    // Replace numbers
      .replace(/[a-f0-9-]{36}/g, 'UUID')       // Replace UUIDs
      .replace(/https?:\/\/[^\s]+/g, 'URL')    // Replace URLs
      .replace(/'[^']*'/g, "'STRING'")         // Replace quoted strings
      .replace(/"[^"]*"/g, '"STRING"')         // Replace double-quoted strings
      .toLowerCase()
      .trim();

    // Extract the first few lines of stack trace for grouping
    const stackLines = stack?.split('\n').slice(0, 3).join('|') || '';
    const cleanStack = stackLines
      .replace(/:\d+:\d+/g, ':N:N')           // Replace line:column numbers
      .replace(/\?[^)]+/g, '')                // Remove query parameters
      .replace(/webpack:\/\/\./g, '');        // Clean webpack paths

    return this.hashString(`${cleanMessage}|${cleanStack}`);
  }

  // Generate tags for categorization
  private generateTags(message: string, context?: Partial<ErrorReport['context']>): string[] {
    const tags: string[] = [];

    // Component tags
    if (context?.component) {
      tags.push(`component:${context.component}`);
    }

    // Action tags
    if (context?.action) {
      tags.push(`action:${context.action}`);
    }

    // Error type tags
    if (message.includes('Network')) tags.push('network');
    if (message.includes('Permission') || message.includes('Unauthorized')) tags.push('auth');
    if (message.includes('Validation') || message.includes('Invalid')) tags.push('validation');
    if (message.includes('Database') || message.includes('SQL')) tags.push('database');
    if (message.includes('Payment') || message.includes('Stripe')) tags.push('payment');
    if (message.includes('PDF') || message.includes('Document')) tags.push('processing');

    // Browser tags
    if (typeof window !== 'undefined') {
      tags.push('client');
      if (/Mobile|Android|iPhone/i.test(navigator.userAgent)) {
        tags.push('mobile');
      }
    } else {
      tags.push('server');
    }

    return tags;
  }

  // Send error to API
  private async sendErrorToAPI(report: ErrorReport): Promise<void> {
    try {
      await fetch('/api/errors/report', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(report)
      });
    } catch (error) {
      // Avoid infinite recursion - don't report errors in error reporting
      console.warn('Failed to send error report to API:', error);
    }
  }

  // Check for alert conditions
  private checkForAlerts(report: ErrorReport): void {
    // Check for critical errors
    if (report.level === 'error' && this.isCriticalError(report)) {
      this.createAlert({
        errorFingerprint: report.fingerprint,
        alertType: 'critical_error',
        severity: 'critical',
        message: `Critical error: ${report.message}`,
        count: 1
      });
    }

    // Check for new errors
    const existingErrors = this.errors.filter(e => e.fingerprint === report.fingerprint);
    if (existingErrors.length === 1) { // First occurrence
      this.createAlert({
        errorFingerprint: report.fingerprint,
        alertType: 'new_error',
        severity: 'medium',
        message: `New error detected: ${report.message}`,
        count: 1
      });
    }

    // Check for error spikes
    const recentErrors = this.getRecentErrors(5); // Last 5 minutes
    if (recentErrors.length >= this.alertThresholds.errorSpike) {
      this.createAlert({
        errorFingerprint: 'spike',
        alertType: 'error_spike',
        severity: 'high',
        message: `Error spike detected: ${recentErrors.length} errors in 5 minutes`,
        count: recentErrors.length
      });
    }

    // Check for high frequency errors
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sameErrorsLastHour = this.errors.filter(
      e => e.fingerprint === report.fingerprint && e.timestamp > oneHourAgo
    );
    
    if (sameErrorsLastHour.length >= this.alertThresholds.highFrequency) {
      this.createAlert({
        errorFingerprint: report.fingerprint,
        alertType: 'high_frequency',
        severity: 'high',
        message: `High frequency error: ${report.message} (${sameErrorsLastHour.length} times in 1 hour)`,
        count: sameErrorsLastHour.length
      });
    }
  }

  // Determine if error is critical
  private isCriticalError(report: ErrorReport): boolean {
    const criticalPatterns = [
      /payment.*failed/i,
      /database.*connection/i,
      /auth.*failure/i,
      /security.*breach/i,
      /data.*corruption/i,
      /system.*crash/i,
      /memory.*leak/i,
      /deadlock/i
    ];

    return criticalPatterns.some(pattern => pattern.test(report.message));
  }

  // Create alert
  private createAlert(alertData: Partial<ErrorAlert>): void {
    const alert: ErrorAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      errorFingerprint: alertData.errorFingerprint!,
      alertType: alertData.alertType!,
      severity: alertData.severity!,
      message: alertData.message!,
      count: alertData.count!,
      firstOccurrence: new Date(),
      lastOccurrence: new Date(),
      affectedUsers: this.getAffectedUsersCount(alertData.errorFingerprint!),
      resolved: false
    };

    this.alerts.push(alert);

    // Send alert notification
    this.sendAlertNotification(alert);
  }

  // Get recent errors
  private getRecentErrors(minutes: number): ErrorReport[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.errors.filter(e => e.timestamp > cutoff);
  }

  // Get affected users count
  private getAffectedUsersCount(fingerprint: string): number {
    const uniqueUsers = new Set(
      this.errors
        .filter(e => e.fingerprint === fingerprint && e.userId)
        .map(e => e.userId)
    );
    return uniqueUsers.size;
  }

  // Send alert notification
  private async sendAlertNotification(alert: ErrorAlert): Promise<void> {
    try {
      await fetch('/api/errors/alert', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.warn('Failed to send alert notification:', error);
    }
  }

  // Get error metrics
  getErrorMetrics(hours = 24): ErrorMetrics {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentErrors = this.errors.filter(e => e.timestamp > cutoff);

    const errorsByLevel = recentErrors.reduce((acc, error) => {
      acc[error.level] = (acc[error.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const errorsByComponent = recentErrors.reduce((acc, error) => {
      const component = error.context.component || 'unknown';
      acc[component] = (acc[component] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const uniqueUsers = new Set(recentErrors.filter(e => e.userId).map(e => e.userId));

    const errorGroups = recentErrors.reduce((acc, error) => {
      if (!acc[error.fingerprint]) {
        acc[error.fingerprint] = {
          fingerprint: error.fingerprint,
          message: error.message,
          count: 0,
          lastOccurrence: error.timestamp
        };
      }
      acc[error.fingerprint].count++;
      if (error.timestamp > acc[error.fingerprint].lastOccurrence) {
        acc[error.fingerprint].lastOccurrence = error.timestamp;
      }
      return acc;
    }, {} as Record<string, any>);

    const topErrors = Object.values(errorGroups)
      .sort((a: any, b: any) => b.count - a.count)
      .slice(0, 10);

    return {
      totalErrors: recentErrors.length,
      errorsByLevel,
      errorsByComponent,
      errorRate: recentErrors.length / Math.max(1, hours),
      affectedUsers: uniqueUsers.size,
      topErrors
    };
  }

  // Get current user ID (implement based on your auth system)
  private getCurrentUserId(): string | undefined {
    // This should be implemented based on your authentication system
    // For now, return undefined
    return undefined;
  }

  // Simple hash function
  private hashString(str: string): string {
    let hash = 0;
    if (str.length === 0) return hash.toString();
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(36);
  }

  // Get all errors
  getAllErrors(): ErrorReport[] {
    return [...this.errors];
  }

  // Get all alerts
  getAllAlerts(): ErrorAlert[] {
    return [...this.alerts];
  }

  // Clear all data
  clearAll(): void {
    this.errors = [];
    this.alerts = [];
  }

  // Set alert thresholds
  setAlertThresholds(thresholds: Partial<typeof this.alertThresholds>): void {
    this.alertThresholds = { ...this.alertThresholds, ...thresholds };
  }
}

// Global error tracking instance
export const errorTracker = new ErrorTrackingService();

// Global error handler for unhandled errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    errorTracker.reportError(
      event.error || event.message,
      'error',
      { component: 'global', action: 'unhandled_error' },
      {
        filename: event.filename,
        line: event.lineno,
        column: event.colno
      }
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    errorTracker.reportError(
      event.reason instanceof Error ? event.reason : String(event.reason),
      'error',
      { component: 'global', action: 'unhandled_promise_rejection' }
    );
  });
}

// React Error Boundary integration
export function withErrorTracking<T extends (...args: any[]) => any>(
  fn: T,
  context?: Partial<ErrorReport['context']>
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);
      if (result instanceof Promise) {
        return result.catch(error => {
          errorTracker.reportError(error, 'error', context);
          throw error;
        });
      }
      return result;
    } catch (error) {
      errorTracker.reportError(error as Error, 'error', context);
      throw error;
    }
  }) as T;
}

// React hook for error tracking
export function useErrorTracking() {
  const reportError = (
    error: Error | string,
    level: ErrorReport['level'] = 'error',
    context?: Partial<ErrorReport['context']>,
    metadata?: Record<string, any>
  ) => {
    return errorTracker.reportError(error, level, context, metadata);
  };

  const reportException = (error: Error, context?: Partial<ErrorReport['context']>, metadata?: Record<string, any>) => {
    return errorTracker.reportException(error, context, metadata);
  };

  const reportWarning = (message: string, context?: Partial<ErrorReport['context']>, metadata?: Record<string, any>) => {
    return errorTracker.reportWarning(message, context, metadata);
  };

  const getMetrics = (hours = 24) => {
    return errorTracker.getErrorMetrics(hours);
  };

  return {
    reportError,
    reportException,
    reportWarning,
    getMetrics
  };
}