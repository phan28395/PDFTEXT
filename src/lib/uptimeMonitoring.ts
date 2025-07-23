// Uptime monitoring system
// Monitors service availability and performance

export interface UptimeCheck {
  id: string;
  serviceName: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  expectedStatus: number;
  timeout: number;
  interval: number; // in milliseconds
  enabled: boolean;
  headers?: Record<string, string>;
  body?: string;
  metadata?: Record<string, any>;
}

export interface UptimeResult {
  id: string;
  checkId: string;
  timestamp: Date;
  isAvailable: boolean;
  responseTime: number;
  statusCode?: number;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface ServiceStatus {
  serviceName: string;
  isAvailable: boolean;
  lastCheck: Date;
  responseTime: number;
  uptime: number; // percentage
  incidentCount: number;
  lastIncident?: Date;
}

export interface UptimeAlert {
  id: string;
  serviceName: string;
  alertType: 'service_down' | 'slow_response' | 'service_recovered' | 'high_error_rate';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

class UptimeMonitoringService {
  private checks = new Map<string, UptimeCheck>();
  private results = new Map<string, UptimeResult[]>();
  private intervals = new Map<string, NodeJS.Timeout>();
  private alerts: UptimeAlert[] = [];
  private maxResultsPerCheck = 1000;

  // Default service checks
  private defaultChecks: Omit<UptimeCheck, 'id'>[] = [
    {
      serviceName: 'PDF Processing API',
      endpoint: '/api/health/processing',
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
      interval: 60000, // 1 minute
      enabled: true
    },
    {
      serviceName: 'Authentication Service',
      endpoint: '/api/health/auth',
      method: 'GET',
      expectedStatus: 200,
      timeout: 3000,
      interval: 30000, // 30 seconds
      enabled: true
    },
    {
      serviceName: 'Database Connection',
      endpoint: '/api/health/database',
      method: 'GET',
      expectedStatus: 200,
      timeout: 5000,
      interval: 60000, // 1 minute
      enabled: true
    },
    {
      serviceName: 'Stripe Integration',
      endpoint: '/api/health/stripe',
      method: 'GET',
      expectedStatus: 200,
      timeout: 10000,
      interval: 300000, // 5 minutes
      enabled: true
    },
    {
      serviceName: 'Document AI Service',
      endpoint: '/api/health/document-ai',
      method: 'GET',
      expectedStatus: 200,
      timeout: 15000,
      interval: 300000, // 5 minutes
      enabled: true
    }
  ];

  constructor() {
    this.initializeDefaultChecks();
  }

  // Initialize default health checks
  private initializeDefaultChecks(): void {
    this.defaultChecks.forEach(check => {
      this.addCheck(check);
    });
  }

  // Add a new uptime check
  addCheck(checkData: Omit<UptimeCheck, 'id'>): string {
    const check: UptimeCheck = {
      ...checkData,
      id: `check_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.checks.set(check.id, check);
    this.results.set(check.id, []);

    if (check.enabled) {
      this.startMonitoring(check.id);
    }

    return check.id;
  }

  // Update an existing check
  updateCheck(checkId: string, updates: Partial<UptimeCheck>): boolean {
    const existingCheck = this.checks.get(checkId);
    if (!existingCheck) return false;

    const updatedCheck = { ...existingCheck, ...updates };
    this.checks.set(checkId, updatedCheck);

    // Restart monitoring if interval or enabled status changed
    if (updates.interval !== undefined || updates.enabled !== undefined) {
      this.stopMonitoring(checkId);
      if (updatedCheck.enabled) {
        this.startMonitoring(checkId);
      }
    }

    return true;
  }

  // Remove a check
  removeCheck(checkId: string): boolean {
    this.stopMonitoring(checkId);
    this.checks.delete(checkId);
    this.results.delete(checkId);
    return true;
  }

  // Start monitoring a specific check
  private startMonitoring(checkId: string): void {
    const check = this.checks.get(checkId);
    if (!check || !check.enabled) return;

    // Clear existing interval
    this.stopMonitoring(checkId);

    // Perform initial check
    this.performCheck(checkId);

    // Schedule recurring checks
    const interval = setInterval(() => {
      this.performCheck(checkId);
    }, check.interval);

    this.intervals.set(checkId, interval);
  }

  // Stop monitoring a specific check
  private stopMonitoring(checkId: string): void {
    const interval = this.intervals.get(checkId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(checkId);
    }
  }

  // Perform a single health check
  private async performCheck(checkId: string): Promise<UptimeResult> {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new Error(`Check ${checkId} not found`);
    }

    const startTime = Date.now();
    const result: UptimeResult = {
      id: `result_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      checkId,
      timestamp: new Date(),
      isAvailable: false,
      responseTime: 0
    };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), check.timeout);

      const response = await fetch(check.endpoint, {
        method: check.method,
        headers: {
          'Content-Type': 'application/json',
          ...check.headers
        },
        body: check.body,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      result.responseTime = Date.now() - startTime;
      result.statusCode = response.status;
      result.isAvailable = response.status === check.expectedStatus;

      if (!result.isAvailable) {
        result.errorMessage = `Unexpected status code: ${response.status}`;
      }

    } catch (error) {
      result.responseTime = Date.now() - startTime;
      result.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.isAvailable = false;

      if (error instanceof Error && error.name === 'AbortError') {
        result.errorMessage = `Request timeout after ${check.timeout}ms`;
      }
    }

    // Store result
    this.storeResult(checkId, result);

    // Check for alerts
    this.checkForAlerts(check, result);

    // Send to API
    this.sendResultToAPI(result);

    return result;
  }

  // Store check result
  private storeResult(checkId: string, result: UptimeResult): void {
    const results = this.results.get(checkId) || [];
    results.push(result);

    // Keep only recent results
    if (results.length > this.maxResultsPerCheck) {
      results.shift();
    }

    this.results.set(checkId, results);
  }

  // Check for alert conditions
  private checkForAlerts(check: UptimeCheck, result: UptimeResult): void {
    const recentResults = this.getRecentResults(check.id, 5); // Last 5 checks
    
    // Service down alert
    if (!result.isAvailable) {
      const consecutiveFailures = this.getConsecutiveFailures(recentResults);
      if (consecutiveFailures >= 2) {
        this.createAlert({
          serviceName: check.serviceName,
          alertType: 'service_down',
          severity: 'critical',
          message: `${check.serviceName} has been down for ${consecutiveFailures} consecutive checks`,
          metadata: {
            checkId: check.id,
            endpoint: check.endpoint,
            lastError: result.errorMessage,
            consecutiveFailures
          }
        });
      }
    }

    // Service recovered alert
    if (result.isAvailable && recentResults.length > 1) {
      const previousResult = recentResults[recentResults.length - 2];
      if (!previousResult.isAvailable) {
        this.createAlert({
          serviceName: check.serviceName,
          alertType: 'service_recovered',
          severity: 'low',
          message: `${check.serviceName} has recovered and is now available`,
          metadata: {
            checkId: check.id,
            endpoint: check.endpoint,
            responseTime: result.responseTime
          }
        });

        // Mark previous alerts as resolved
        this.resolveServiceAlerts(check.serviceName);
      }
    }

    // Slow response alert
    if (result.isAvailable && result.responseTime > check.timeout * 0.8) {
      this.createAlert({
        serviceName: check.serviceName,
        alertType: 'slow_response',
        severity: 'medium',
        message: `${check.serviceName} is responding slowly (${result.responseTime}ms)`,
        metadata: {
          checkId: check.id,
          endpoint: check.endpoint,
          responseTime: result.responseTime,
          threshold: check.timeout * 0.8
        }
      });
    }

    // High error rate alert
    const errorRate = this.calculateErrorRate(recentResults);
    if (errorRate > 0.5) { // More than 50% error rate
      this.createAlert({
        serviceName: check.serviceName,
        alertType: 'high_error_rate',
        severity: 'high',
        message: `${check.serviceName} has a high error rate (${Math.round(errorRate * 100)}%)`,
        metadata: {
          checkId: check.id,
          endpoint: check.endpoint,
          errorRate: errorRate,
          recentChecks: recentResults.length
        }
      });
    }
  }

  // Get recent results for a check
  private getRecentResults(checkId: string, count: number): UptimeResult[] {
    const results = this.results.get(checkId) || [];
    return results.slice(-count);
  }

  // Count consecutive failures
  private getConsecutiveFailures(results: UptimeResult[]): number {
    let count = 0;
    for (let i = results.length - 1; i >= 0; i--) {
      if (!results[i].isAvailable) {
        count++;
      } else {
        break;
      }
    }
    return count;
  }

  // Calculate error rate
  private calculateErrorRate(results: UptimeResult[]): number {
    if (results.length === 0) return 0;
    const errors = results.filter(r => !r.isAvailable).length;
    return errors / results.length;
  }

  // Create alert
  private createAlert(alertData: Omit<UptimeAlert, 'id' | 'timestamp' | 'resolved'>): void {
    // Check if similar unresolved alert already exists
    const existingAlert = this.alerts.find(alert => 
      !alert.resolved &&
      alert.serviceName === alertData.serviceName &&
      alert.alertType === alertData.alertType
    );

    if (existingAlert) {
      // Update existing alert timestamp
      existingAlert.timestamp = new Date();
      existingAlert.metadata = { ...existingAlert.metadata, ...alertData.metadata };
      return;
    }

    const alert: UptimeAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      resolved: false
    };

    this.alerts.push(alert);
    this.sendAlertToAPI(alert);
  }

  // Resolve alerts for a service
  private resolveServiceAlerts(serviceName: string): void {
    this.alerts
      .filter(alert => alert.serviceName === serviceName && !alert.resolved)
      .forEach(alert => {
        alert.resolved = true;
        this.sendAlertToAPI(alert);
      });
  }

  // Send result to API
  private async sendResultToAPI(result: UptimeResult): Promise<void> {
    try {
      await fetch('/api/monitoring/uptime', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(result)
      });
    } catch (error) {
      console.warn('Failed to send uptime result to API:', error);
    }
  }

  // Send alert to API
  private async sendAlertToAPI(alert: UptimeAlert): Promise<void> {
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alert)
      });
    } catch (error) {
      console.warn('Failed to send uptime alert to API:', error);
    }
  }

  // Get service status
  getServiceStatus(serviceName?: string): ServiceStatus[] {
    const services = new Map<string, ServiceStatus>();

    this.checks.forEach(check => {
      if (serviceName && check.serviceName !== serviceName) return;

      const results = this.results.get(check.id) || [];
      const recentResults = results.slice(-100); // Last 100 checks
      
      if (recentResults.length === 0) return;

      const lastResult = recentResults[recentResults.length - 1];
      const availableResults = recentResults.filter(r => r.isAvailable);
      const uptime = availableResults.length / recentResults.length;
      const avgResponseTime = availableResults.length > 0 
        ? availableResults.reduce((sum, r) => sum + r.responseTime, 0) / availableResults.length
        : 0;

      const incidents = recentResults.filter(r => !r.isAvailable);
      const lastIncident = incidents.length > 0 ? incidents[incidents.length - 1].timestamp : undefined;

      services.set(check.serviceName, {
        serviceName: check.serviceName,
        isAvailable: lastResult.isAvailable,
        lastCheck: lastResult.timestamp,
        responseTime: avgResponseTime,
        uptime: uptime * 100,
        incidentCount: incidents.length,
        lastIncident
      });
    });

    return Array.from(services.values());
  }

  // Get all checks
  getAllChecks(): UptimeCheck[] {
    return Array.from(this.checks.values());
  }

  // Get all alerts
  getAllAlerts(): UptimeAlert[] {
    return [...this.alerts].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // Get unresolved alerts
  getUnresolvedAlerts(): UptimeAlert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  // Get results for a specific check
  getCheckResults(checkId: string, limit = 100): UptimeResult[] {
    const results = this.results.get(checkId) || [];
    return results.slice(-limit);
  }

  // Start all enabled checks
  startAll(): void {
    this.checks.forEach((check, checkId) => {
      if (check.enabled) {
        this.startMonitoring(checkId);
      }
    });
  }

  // Stop all monitoring
  stopAll(): void {
    this.intervals.forEach(interval => clearInterval(interval));
    this.intervals.clear();
  }

  // Get overall system health
  getSystemHealth(): {
    overallStatus: 'healthy' | 'degraded' | 'down';
    servicesUp: number;
    servicesTotal: number;
    averageUptime: number;
    criticalAlerts: number;
  } {
    const statuses = this.getServiceStatus();
    const servicesUp = statuses.filter(s => s.isAvailable).length;
    const servicesTotal = statuses.length;
    const averageUptime = servicesTotal > 0 
      ? statuses.reduce((sum, s) => sum + s.uptime, 0) / servicesTotal 
      : 100;

    const criticalAlerts = this.alerts.filter(
      alert => !alert.resolved && alert.severity === 'critical'
    ).length;

    let overallStatus: 'healthy' | 'degraded' | 'down' = 'healthy';
    if (criticalAlerts > 0 || servicesUp === 0) {
      overallStatus = 'down';
    } else if (servicesUp < servicesTotal || averageUptime < 95) {
      overallStatus = 'degraded';
    }

    return {
      overallStatus,
      servicesUp,
      servicesTotal,
      averageUptime,
      criticalAlerts
    };
  }
}

// Global uptime monitoring instance
export const uptimeMonitor = new UptimeMonitoringService();

// Auto-start monitoring when module loads
if (typeof window !== 'undefined') {
  // Start monitoring after a short delay to allow app initialization
  setTimeout(() => {
    uptimeMonitor.startAll();
  }, 5000);
}