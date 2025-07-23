/**
 * Anomaly Detection System for Usage Patterns
 * Detects unusual behavior patterns that might indicate abuse or security threats
 */

import { createClient } from '@supabase/supabase-js';
import { securityLogger, SecurityEventType, SecuritySeverity, logSuspiciousActivity } from './securityLogger';

export interface UsagePattern {
  userId: string;
  timeWindow: string; // hourly, daily, weekly
  metric: string; // pages_processed, login_count, api_requests, etc.
  value: number;
  timestamp: Date;
  baseline: number;
  deviation: number;
  anomalyScore: number;
}

export interface AnomalyAlert {
  id: string;
  userId: string;
  type: AnomalyType;
  severity: SecuritySeverity;
  description: string;
  patterns: UsagePattern[];
  detectedAt: Date;
  metadata: Record<string, any>;
  resolved: boolean;
  resolvedAt?: Date;
}

export enum AnomalyType {
  USAGE_SPIKE = 'usage_spike',
  UNUSUAL_TIMING = 'unusual_timing',
  GEOGRAPHIC_ANOMALY = 'geographic_anomaly',
  BEHAVIOR_CHANGE = 'behavior_change',
  VOLUME_ANOMALY = 'volume_anomaly',
  PAYMENT_PATTERN = 'payment_pattern',
  API_ABUSE = 'api_abuse',
  ACCOUNT_TAKEOVER = 'account_takeover'
}

/**
 * Anomaly Detection Engine
 */
export class AnomalyDetectionEngine {
  private supabase: any;
  private userBaselines: Map<string, Record<string, number>> = new Map();
  private alerts: Map<string, AnomalyAlert> = new Map();
  private analysisInterval?: NodeJS.Timeout;

  // Thresholds for anomaly detection
  private readonly ANOMALY_THRESHOLDS = {
    mild: 2.0,      // 2 standard deviations
    moderate: 3.0,  // 3 standard deviations
    severe: 4.0,    // 4 standard deviations
    critical: 5.0   // 5 standard deviations
  };

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.startPeriodicAnalysis();
  }

  /**
   * Start periodic analysis of usage patterns
   */
  private startPeriodicAnalysis(): void {
    // Run anomaly detection every 30 minutes
    this.analysisInterval = setInterval(async () => {
      try {
        await this.runAnomalyAnalysis();
      } catch (error) {
        console.error('Error running anomaly analysis:', error);
      }
    }, 30 * 60 * 1000); // 30 minutes

    console.log('✅ Anomaly detection engine started');
  }

  /**
   * Run comprehensive anomaly analysis
   */
  async runAnomalyAnalysis(): Promise<void> {
    console.log('🔍 Running anomaly analysis...');

    await Promise.all([
      this.analyzeUsagePatterns(),
      this.analyzeLoginPatterns(),
      this.analyzePaymentPatterns(),
      this.analyzeAPIUsagePatterns(),
      this.analyzeBehavioralChanges()
    ]);

    console.log('✅ Anomaly analysis completed');
  }

  /**
   * Analyze usage patterns for anomalies
   */
  private async analyzeUsagePatterns(): Promise<void> {
    try {
      // Get usage data for the last 7 days
      const { data: usageData, error } = await this.supabase
        .from('processing_history')
        .select(`
          user_id,
          pages_processed,
          created_at,
          users!inner(subscription_tier)
        `)
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by user and analyze patterns
      const userUsage = this.groupUsageByUser(usageData || []);
      
      for (const [userId, usage] of userUsage) {
        const patterns = await this.detectUsageAnomalies(userId, usage);
        
        for (const pattern of patterns) {
          if (pattern.anomalyScore > this.ANOMALY_THRESHOLDS.moderate) {
            await this.createAnomalyAlert(
              userId,
              AnomalyType.USAGE_SPIKE,
              this.getAnomalySeverity(pattern.anomalyScore),
              `Unusual spike in page processing: ${pattern.value} pages (${pattern.deviation}x normal)`,
              [pattern]
            );
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing usage patterns:', error);
    }
  }

  /**
   * Analyze login patterns for anomalies
   */
  private async analyzeLoginPatterns(): Promise<void> {
    try {
      // Get login events from security logs
      const { data: loginEvents, error } = await this.supabase
        .from('security_events')
        .select('user_id, ip_address, timestamp, user_agent')
        .eq('event_type', 'auth_login')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const userLogins = this.groupLoginsByUser(loginEvents || []);
      
      for (const [userId, logins] of userLogins) {
        // Detect unusual login times
        const timeAnomalies = this.detectTimeAnomalies(userId, logins);
        if (timeAnomalies.length > 0) {
          await this.createAnomalyAlert(
            userId,
            AnomalyType.UNUSUAL_TIMING,
            SecuritySeverity.MEDIUM,
            `Unusual login timing detected: logins at ${timeAnomalies.join(', ')}`,
            []
          );
        }

        // Detect multiple IP addresses
        const uniqueIPs = new Set(logins.map(l => l.ip_address));
        if (uniqueIPs.size > 3) { // More than 3 different IPs in 24h
          await this.createAnomalyAlert(
            userId,
            AnomalyType.GEOGRAPHIC_ANOMALY,
            SecuritySeverity.HIGH,
            `Multiple IP addresses detected: ${uniqueIPs.size} different IPs in 24h`,
            []
          );
        }

        // Detect unusual user agents
        const uniqueUserAgents = new Set(logins.map(l => l.user_agent));
        if (uniqueUserAgents.size > 2) { // More than 2 different user agents
          await this.createAnomalyAlert(
            userId,
            AnomalyType.ACCOUNT_TAKEOVER,
            SecuritySeverity.HIGH,
            `Multiple user agents detected: possible account compromise`,
            []
          );
        }
      }
    } catch (error) {
      console.error('Error analyzing login patterns:', error);
    }
  }

  /**
   * Analyze payment patterns for anomalies
   */
  private async analyzePaymentPatterns(): Promise<void> {
    try {
      // Get payment events from security logs
      const { data: paymentEvents, error } = await this.supabase
        .from('security_events')
        .select('user_id, ip_address, timestamp, details')
        .in('event_type', ['payment_initiated', 'payment_completed', 'payment_failed'])
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const userPayments = this.groupPaymentsByUser(paymentEvents || []);
      
      for (const [userId, payments] of userPayments) {
        // Detect rapid payment attempts
        const rapidAttempts = this.detectRapidPaymentAttempts(payments);
        if (rapidAttempts > 0) {
          await this.createAnomalyAlert(
            userId,
            AnomalyType.PAYMENT_PATTERN,
            SecuritySeverity.HIGH,
            `Rapid payment attempts detected: ${rapidAttempts} attempts in short timeframe`,
            []
          );
        }

        // Detect payment failures pattern
        const failureRate = this.calculatePaymentFailureRate(payments);
        if (failureRate > 0.5) { // More than 50% failure rate
          await this.createAnomalyAlert(
            userId,
            AnomalyType.PAYMENT_PATTERN,
            SecuritySeverity.MEDIUM,
            `High payment failure rate: ${Math.round(failureRate * 100)}%`,
            []
          );
        }
      }
    } catch (error) {
      console.error('Error analyzing payment patterns:', error);
    }
  }

  /**
   * Analyze API usage patterns for anomalies
   */
  private async analyzeAPIUsagePatterns(): Promise<void> {
    try {
      // Get API request events from security logs
      const { data: apiEvents, error } = await this.supabase
        .from('security_events')
        .select('user_id, ip_address, timestamp, endpoint, method')
        .eq('source', 'API')
        .gte('timestamp', new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()) // Last 6 hours
        .order('timestamp', { ascending: false });

      if (error) throw error;

      const userAPIUsage = this.groupAPIUsageByUser(apiEvents || []);
      
      for (const [userId, usage] of userAPIUsage) {
        // Detect API abuse patterns
        const requestCount = usage.length;
        const timeSpan = this.calculateTimeSpan(usage);
        const requestRate = requestCount / (timeSpan / (60 * 1000)); // requests per minute

        if (requestRate > 10) { // More than 10 requests per minute
          await this.createAnomalyAlert(
            userId,
            AnomalyType.API_ABUSE,
            SecuritySeverity.HIGH,
            `High API request rate: ${Math.round(requestRate)} requests/minute`,
            []
          );
        }

        // Detect unusual endpoint patterns
        const endpointCounts = this.countEndpoints(usage);
        const suspiciousEndpoints = Object.entries(endpointCounts)
          .filter(([endpoint, count]) => count > 50) // More than 50 requests to same endpoint
          .map(([endpoint, count]) => ({ endpoint, count }));

        if (suspiciousEndpoints.length > 0) {
          await this.createAnomalyAlert(
            userId,
            AnomalyType.API_ABUSE,
            SecuritySeverity.MEDIUM,
            `Suspicious endpoint usage: ${suspiciousEndpoints.map(s => `${s.endpoint} (${s.count})`).join(', ')}`,
            []
          );
        }
      }
    } catch (error) {
      console.error('Error analyzing API usage patterns:', error);
    }
  }

  /**
   * Analyze behavioral changes over time
   */
  private async analyzeBehavioralChanges(): Promise<void> {
    try {
      // Compare current week vs previous week patterns
      const currentWeek = await this.getUserBehaviorMetrics(7);
      const previousWeek = await this.getUserBehaviorMetrics(14, 7);

      for (const userId of new Set([...Object.keys(currentWeek), ...Object.keys(previousWeek)])) {
        const current = currentWeek[userId] || {};
        const previous = previousWeek[userId] || {};

        const changes = this.calculateBehaviorChanges(current, previous);
        
        if (changes.significantChanges.length > 0) {
          await this.createAnomalyAlert(
            userId,
            AnomalyType.BEHAVIOR_CHANGE,
            SecuritySeverity.MEDIUM,
            `Significant behavior changes detected: ${changes.significantChanges.join(', ')}`,
            []
          );
        }
      }
    } catch (error) {
      console.error('Error analyzing behavioral changes:', error);
    }
  }

  /**
   * Group usage data by user
   */
  private groupUsageByUser(usageData: any[]): Map<string, any[]> {
    const grouped = new Map();
    
    for (const record of usageData) {
      if (!grouped.has(record.user_id)) {
        grouped.set(record.user_id, []);
      }
      grouped.get(record.user_id).push(record);
    }
    
    return grouped;
  }

  /**
   * Group login events by user
   */
  private groupLoginsByUser(loginEvents: any[]): Map<string, any[]> {
    const grouped = new Map();
    
    for (const event of loginEvents) {
      if (!event.user_id) continue;
      
      if (!grouped.has(event.user_id)) {
        grouped.set(event.user_id, []);
      }
      grouped.get(event.user_id).push(event);
    }
    
    return grouped;
  }

  /**
   * Group payment events by user
   */
  private groupPaymentsByUser(paymentEvents: any[]): Map<string, any[]> {
    const grouped = new Map();
    
    for (const event of paymentEvents) {
      if (!event.user_id) continue;
      
      if (!grouped.has(event.user_id)) {
        grouped.set(event.user_id, []);
      }
      grouped.get(event.user_id).push(event);
    }
    
    return grouped;
  }

  /**
   * Group API usage by user
   */
  private groupAPIUsageByUser(apiEvents: any[]): Map<string, any[]> {
    const grouped = new Map();
    
    for (const event of apiEvents) {
      const userId = event.user_id || 'anonymous';
      
      if (!grouped.has(userId)) {
        grouped.set(userId, []);
      }
      grouped.get(userId).push(event);
    }
    
    return grouped;
  }

  /**
   * Detect usage anomalies for a user
   */
  private async detectUsageAnomalies(userId: string, usage: any[]): Promise<UsagePattern[]> {
    const baseline = await this.getUserBaseline(userId, 'pages_processed');
    const patterns: UsagePattern[] = [];
    
    // Analyze daily usage patterns
    const dailyUsage = this.aggregateUsageByDay(usage);
    
    for (const [date, totalPages] of dailyUsage) {
      const deviation = baseline > 0 ? totalPages / baseline : 1;
      const anomalyScore = this.calculateAnomalyScore(totalPages, baseline);
      
      if (anomalyScore > this.ANOMALY_THRESHOLDS.mild) {
        patterns.push({
          userId,
          timeWindow: 'daily',
          metric: 'pages_processed',
          value: totalPages,
          timestamp: new Date(date),
          baseline,
          deviation,
          anomalyScore
        });
      }
    }
    
    return patterns;
  }

  /**
   * Detect unusual login times
   */
  private detectTimeAnomalies(userId: string, logins: any[]): string[] {
    const unusualTimes: string[] = [];
    const hourCounts = new Array(24).fill(0);
    
    // Count logins by hour
    for (const login of logins) {
      const hour = new Date(login.timestamp).getHours();
      hourCounts[hour]++;
    }
    
    // Check for logins during unusual hours (2 AM - 6 AM)
    for (let hour = 2; hour <= 6; hour++) {
      if (hourCounts[hour] > 0) {
        unusualTimes.push(`${hour}:00`);
      }
    }
    
    return unusualTimes;
  }

  /**
   * Detect rapid payment attempts
   */
  private detectRapidPaymentAttempts(payments: any[]): number {
    let rapidAttempts = 0;
    
    for (let i = 1; i < payments.length; i++) {
      const current = new Date(payments[i].timestamp);
      const previous = new Date(payments[i - 1].timestamp);
      const timeDiff = Math.abs(current.getTime() - previous.getTime());
      
      if (timeDiff < 60000) { // Less than 1 minute between attempts
        rapidAttempts++;
      }
    }
    
    return rapidAttempts;
  }

  /**
   * Calculate payment failure rate
   */
  private calculatePaymentFailureRate(payments: any[]): number {
    if (payments.length === 0) return 0;
    
    const failures = payments.filter(p => p.event_type === 'payment_failed').length;
    return failures / payments.length;
  }

  /**
   * Calculate time span of events
   */
  private calculateTimeSpan(events: any[]): number {
    if (events.length < 2) return 60000; // Default to 1 minute
    
    const timestamps = events.map(e => new Date(e.timestamp).getTime());
    return Math.max(...timestamps) - Math.min(...timestamps);
  }

  /**
   * Count endpoint usage
   */
  private countEndpoints(apiEvents: any[]): Record<string, number> {
    const counts: Record<string, number> = {};
    
    for (const event of apiEvents) {
      const endpoint = event.endpoint || 'unknown';
      counts[endpoint] = (counts[endpoint] || 0) + 1;
    }
    
    return counts;
  }

  /**
   * Get user behavior metrics for a time period
   */
  private async getUserBehaviorMetrics(days: number, offset = 0): Promise<Record<string, any>> {
    const startDate = new Date(Date.now() - (days + offset) * 24 * 60 * 60 * 1000);
    const endDate = new Date(Date.now() - offset * 24 * 60 * 60 * 1000);
    
    try {
      const { data, error } = await this.supabase
        .from('processing_history')
        .select('user_id, pages_processed, created_at')
        .gte('created_at', startDate.toISOString())
        .lt('created_at', endDate.toISOString());
      
      if (error) throw error;
      
      const metrics: Record<string, any> = {};
      
      for (const record of data || []) {
        const userId = record.user_id;
        if (!metrics[userId]) {
          metrics[userId] = {
            totalPages: 0,
            sessionCount: 0,
            avgPagesPerSession: 0
          };
        }
        
        metrics[userId].totalPages += record.pages_processed;
        metrics[userId].sessionCount++;
      }
      
      // Calculate averages
      for (const userId of Object.keys(metrics)) {
        metrics[userId].avgPagesPerSession = 
          metrics[userId].totalPages / metrics[userId].sessionCount;
      }
      
      return metrics;
    } catch (error) {
      console.error('Error getting user behavior metrics:', error);
      return {};
    }
  }

  /**
   * Calculate behavior changes between periods
   */
  private calculateBehaviorChanges(current: any, previous: any): { significantChanges: string[] } {
    const changes: string[] = [];
    
    // Compare total pages
    if (previous.totalPages && current.totalPages) {
      const change = (current.totalPages - previous.totalPages) / previous.totalPages;
      if (Math.abs(change) > 2.0) { // 200% change
        changes.push(`pages processed ${change > 0 ? 'increased' : 'decreased'} by ${Math.round(Math.abs(change) * 100)}%`);
      }
    }
    
    // Compare session patterns
    if (previous.sessionCount && current.sessionCount) {
      const change = (current.sessionCount - previous.sessionCount) / previous.sessionCount;
      if (Math.abs(change) > 1.0) { // 100% change
        changes.push(`session frequency ${change > 0 ? 'increased' : 'decreased'} by ${Math.round(Math.abs(change) * 100)}%`);
      }
    }
    
    return { significantChanges: changes };
  }

  /**
   * Get user baseline for a metric
   */
  private async getUserBaseline(userId: string, metric: string): Promise<number> {
    // Check cache first
    const cached = this.userBaselines.get(userId)?.[metric];
    if (cached) return cached;
    
    // Calculate baseline from historical data (last 30 days)
    try {
      const { data, error } = await this.supabase
        .from('processing_history')
        .select('pages_processed')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      
      if (error) throw error;
      
      const values = (data || []).map(d => d.pages_processed);
      const average = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      
      // Cache the baseline
      if (!this.userBaselines.has(userId)) {
        this.userBaselines.set(userId, {});
      }
      this.userBaselines.get(userId)![metric] = average;
      
      return average;
    } catch (error) {
      console.error('Error calculating user baseline:', error);
      return 0;
    }
  }

  /**
   * Aggregate usage by day
   */
  private aggregateUsageByDay(usage: any[]): Map<string, number> {
    const dailyUsage = new Map();
    
    for (const record of usage) {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      const current = dailyUsage.get(date) || 0;
      dailyUsage.set(date, current + record.pages_processed);
    }
    
    return dailyUsage;
  }

  /**
   * Calculate anomaly score using z-score
   */
  private calculateAnomalyScore(value: number, baseline: number): number {
    if (baseline === 0) return value > 0 ? 5 : 0;
    return Math.abs((value - baseline) / baseline);
  }

  /**
   * Get severity based on anomaly score
   */
  private getAnomalySeverity(score: number): SecuritySeverity {
    if (score >= this.ANOMALY_THRESHOLDS.critical) return SecuritySeverity.CRITICAL;
    if (score >= this.ANOMALY_THRESHOLDS.severe) return SecuritySeverity.HIGH;
    if (score >= this.ANOMALY_THRESHOLDS.moderate) return SecuritySeverity.MEDIUM;
    return SecuritySeverity.LOW;
  }

  /**
   * Create an anomaly alert
   */
  private async createAnomalyAlert(
    userId: string,
    type: AnomalyType,
    severity: SecuritySeverity,
    description: string,
    patterns: UsagePattern[]
  ): Promise<void> {
    const alertId = `anomaly_${type}_${userId}_${Date.now()}`;
    
    const alert: AnomalyAlert = {
      id: alertId,
      userId,
      type,
      severity,
      description,
      patterns,
      detectedAt: new Date(),
      metadata: {
        detectionEngine: 'anomaly_detection',
        patternsCount: patterns.length
      },
      resolved: false
    };
    
    this.alerts.set(alertId, alert);
    
    // Log the anomaly detection
    await logSuspiciousActivity(
      `Anomaly detected: ${description}`,
      userId,
      '127.0.0.1', // System IP
      'AnomalyDetectionEngine',
      {
        anomalyType: type,
        alertId,
        patternsCount: patterns.length,
        patterns: patterns.map(p => ({
          metric: p.metric,
          value: p.value,
          baseline: p.baseline,
          anomalyScore: p.anomalyScore
        }))
      }
    );
    
    console.log(`🚨 Anomaly alert created: ${type} for user ${userId}`, {
      severity,
      description,
      alertId
    });
  }

  /**
   * Get all active anomaly alerts
   */
  getActiveAlerts(): AnomalyAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Resolve an anomaly alert
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
   * Get anomaly statistics
   */
  getStatistics(): any {
    const alerts = Array.from(this.alerts.values());
    const activeAlerts = alerts.filter(a => !a.resolved);
    
    return {
      totalAlerts: alerts.length,
      activeAlerts: activeAlerts.length,
      alertsBySeverity: activeAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      alertsByType: activeAlerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      usersMonitored: this.userBaselines.size
    };
  }

  /**
   * Force run anomaly detection manually
   */
  async runManualAnalysis(): Promise<void> {
    console.log('🔍 Running manual anomaly analysis...');
    await this.runAnomalyAnalysis();
  }

  /**
   * Stop the anomaly detection engine
   */
  destroy(): void {
    if (this.analysisInterval) {
      clearInterval(this.analysisInterval);
    }
    console.log('Anomaly detection engine stopped');
  }
}

// Singleton instance
export const anomalyDetection = new AnomalyDetectionEngine();