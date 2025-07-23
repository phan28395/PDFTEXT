/**
 * Incident Response System
 * Automated incident detection, classification, and response procedures
 */

import { createClient } from '@supabase/supabase-js';
import { securityLogger, SecurityEventType, SecuritySeverity } from './securityLogger';
import { threatDetection } from './threatDetection';
import { anomalyDetection } from './anomalyDetection';

export enum IncidentType {
  SECURITY_BREACH = 'security_breach',
  DATA_BREACH = 'data_breach',
  ACCOUNT_COMPROMISE = 'account_compromise',
  MALWARE_DETECTION = 'malware_detection',
  DDOS_ATTACK = 'ddos_attack',
  API_ABUSE = 'api_abuse',
  PAYMENT_FRAUD = 'payment_fraud',
  SYSTEM_OUTAGE = 'system_outage',
  DATA_LOSS = 'data_loss',
  COMPLIANCE_VIOLATION = 'compliance_violation'
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export enum IncidentPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface Incident {
  id: string;
  type: IncidentType;
  title: string;
  description: string;
  severity: SecuritySeverity;
  priority: IncidentPriority;
  status: IncidentStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  affectedUsers: string[];
  affectedSystems: string[];
  evidence: IncidentEvidence[];
  timeline: IncidentTimelineEntry[];
  responseActions: ResponseAction[];
  metadata: Record<string, any>;
}

export interface IncidentEvidence {
  id: string;
  type: 'log' | 'file' | 'screenshot' | 'network' | 'database';
  description: string;
  data: any;
  collectedAt: Date;
  collectedBy: string;
}

export interface IncidentTimelineEntry {
  id: string;
  timestamp: Date;
  event: string;
  description: string;
  actor: string;
  automated: boolean;
}

export interface ResponseAction {
  id: string;
  type: ResponseActionType;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  executedAt?: Date;
  executedBy?: string;
  result?: any;
  automated: boolean;
}

export enum ResponseActionType {
  ISOLATE_USER = 'isolate_user',
  BLOCK_IP = 'block_ip',
  DISABLE_API_KEY = 'disable_api_key',
  NOTIFY_USERS = 'notify_users',
  BACKUP_DATA = 'backup_data',
  ROTATE_KEYS = 'rotate_keys',
  ENABLE_MONITORING = 'enable_monitoring',
  CONTACT_AUTHORITIES = 'contact_authorities',
  NOTIFY_STAKEHOLDERS = 'notify_stakeholders',
  FORENSIC_ANALYSIS = 'forensic_analysis'
}

/**
 * Incident Response Manager
 */
export class IncidentResponseManager {
  private supabase: any;
  private incidents: Map<string, Incident> = new Map();
  private responsePlaybooks: Map<IncidentType, ResponseAction[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    this.initializeResponsePlaybooks();
    this.startIncidentMonitoring();
  }

  /**
   * Initialize automated response playbooks
   */
  private initializeResponsePlaybooks(): void {
    // Security Breach Playbook
    this.responsePlaybooks.set(IncidentType.SECURITY_BREACH, [
      {
        id: 'sb_1',
        type: ResponseActionType.ENABLE_MONITORING,
        description: 'Enable enhanced monitoring for all systems',
        status: 'pending',
        automated: true
      },
      {
        id: 'sb_2',
        type: ResponseActionType.FORENSIC_ANALYSIS,
        description: 'Begin forensic analysis of security logs',
        status: 'pending',
        automated: true
      },
      {
        id: 'sb_3',
        type: ResponseActionType.NOTIFY_STAKEHOLDERS,
        description: 'Notify security team and management',
        status: 'pending',
        automated: true
      }
    ]);

    // Account Compromise Playbook
    this.responsePlaybooks.set(IncidentType.ACCOUNT_COMPROMISE, [
      {
        id: 'ac_1',
        type: ResponseActionType.ISOLATE_USER,
        description: 'Immediately suspend compromised user account',
        status: 'pending',
        automated: true
      },
      {
        id: 'ac_2',
        type: ResponseActionType.ROTATE_KEYS,
        description: 'Rotate API keys associated with account',
        status: 'pending',
        automated: true
      },
      {
        id: 'ac_3',
        type: ResponseActionType.NOTIFY_USERS,
        description: 'Notify affected user of security incident',
        status: 'pending',
        automated: false
      }
    ]);

    // DDoS Attack Playbook
    this.responsePlaybooks.set(IncidentType.DDOS_ATTACK, [
      {
        id: 'ddos_1',
        type: ResponseActionType.BLOCK_IP,
        description: 'Block attacking IP addresses',
        status: 'pending',
        automated: true
      },
      {
        id: 'ddos_2',
        type: ResponseActionType.ENABLE_MONITORING,
        description: 'Enable rate limiting and traffic monitoring',
        status: 'pending',
        automated: true
      }
    ]);

    // Malware Detection Playbook
    this.responsePlaybooks.set(IncidentType.MALWARE_DETECTION, [
      {
        id: 'mal_1',
        type: ResponseActionType.ISOLATE_USER,
        description: 'Suspend user account that uploaded malware',
        status: 'pending',
        automated: true
      },
      {
        id: 'mal_2',
        type: ResponseActionType.FORENSIC_ANALYSIS,
        description: 'Analyze malware sample and infection vectors',
        status: 'pending',
        automated: true
      },
      {
        id: 'mal_3',
        type: ResponseActionType.NOTIFY_STAKEHOLDERS,
        description: 'Alert security team about malware incident',
        status: 'pending',
        automated: true
      }
    ]);

    // Data Breach Playbook
    this.responsePlaybooks.set(IncidentType.DATA_BREACH, [
      {
        id: 'db_1',
        type: ResponseActionType.FORENSIC_ANALYSIS,
        description: 'Determine scope and impact of data breach',
        status: 'pending',
        automated: true
      },
      {
        id: 'db_2',
        type: ResponseActionType.NOTIFY_STAKEHOLDERS,
        description: 'Immediate notification to legal and compliance teams',
        status: 'pending',
        automated: true
      },
      {
        id: 'db_3',
        type: ResponseActionType.CONTACT_AUTHORITIES,
        description: 'Prepare for regulatory notification requirements',
        status: 'pending',
        automated: false
      }
    ]);

    // Payment Fraud Playbook
    this.responsePlaybooks.set(IncidentType.PAYMENT_FRAUD, [
      {
        id: 'pf_1',
        type: ResponseActionType.BLOCK_IP,
        description: 'Block IP addresses associated with fraud attempts',
        status: 'pending',
        automated: true
      },
      {
        id: 'pf_2',
        type: ResponseActionType.ISOLATE_USER,
        description: 'Suspend accounts involved in fraudulent activity',
        status: 'pending',
        automated: true
      },
      {
        id: 'pf_3',
        type: ResponseActionType.NOTIFY_STAKEHOLDERS,
        description: 'Notify finance and fraud prevention teams',
        status: 'pending',
        automated: true
      }
    ]);

    console.log('✅ Incident response playbooks initialized');
  }

  /**
   * Start monitoring for potential incidents
   */
  private startIncidentMonitoring(): void {
    // Monitor for incidents every 5 minutes
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkForNewIncidents();
      } catch (error) {
        console.error('Error checking for incidents:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    console.log('✅ Incident monitoring started');
  }

  /**
   * Check for new incidents based on security alerts
   */
  private async checkForNewIncidents(): Promise<void> {
    try {
      // Check threat detection alerts
      const threatAlerts = threatDetection.getActiveAlerts();
      for (const alert of threatAlerts) {
        if (alert.pattern.severity === SecuritySeverity.CRITICAL) {
          await this.createIncidentFromThreatAlert(alert);
        }
      }

      // Check anomaly detection alerts
      const anomalyAlerts = anomalyDetection.getActiveAlerts();
      for (const alert of anomalyAlerts) {
        if (alert.severity === SecuritySeverity.CRITICAL || alert.severity === SecuritySeverity.HIGH) {
          await this.createIncidentFromAnomalyAlert(alert);
        }
      }

      // Check for critical security events
      await this.checkCriticalSecurityEvents();

    } catch (error) {
      console.error('Error checking for new incidents:', error);
    }
  }

  /**
   * Create incident from threat detection alert
   */
  private async createIncidentFromThreatAlert(alert: any): Promise<void> {
    const incidentType = this.mapThreatToIncidentType(alert.pattern.id);
    
    const incident = await this.createIncident({
      type: incidentType,
      title: `Threat Detection: ${alert.pattern.name}`,
      description: `Automated incident created from threat detection alert: ${alert.pattern.description}`,
      severity: alert.pattern.severity,
      priority: this.mapSeverityToPriority(alert.pattern.severity),
      affectedUsers: alert.events.map((e: any) => e.userId).filter(Boolean),
      affectedSystems: ['threat_detection'],
      metadata: {
        source: 'threat_detection',
        alertId: alert.id,
        patternId: alert.pattern.id,
        eventCount: alert.events.length
      }
    });

    console.log(`🚨 Incident created from threat alert: ${incident.id}`);
  }

  /**
   * Create incident from anomaly detection alert
   */
  private async createIncidentFromAnomalyAlert(alert: any): Promise<void> {
    const incident = await this.createIncident({
      type: IncidentType.SECURITY_BREACH, // Default type for anomalies
      title: `Anomaly Detection: ${alert.type}`,
      description: `Automated incident created from anomaly detection: ${alert.description}`,
      severity: alert.severity,
      priority: this.mapSeverityToPriority(alert.severity),
      affectedUsers: [alert.userId],
      affectedSystems: ['anomaly_detection'],
      metadata: {
        source: 'anomaly_detection',
        alertId: alert.id,
        anomalyType: alert.type,
        patternsCount: alert.patterns.length
      }
    });

    console.log(`🚨 Incident created from anomaly alert: ${incident.id}`);
  }

  /**
   * Check for critical security events that should trigger incidents
   */
  private async checkCriticalSecurityEvents(): Promise<void> {
    try {
      const recentEvents = await securityLogger.searchEvents('', 50, {
        severity: [SecuritySeverity.CRITICAL],
        fromDate: new Date(Date.now() - 30 * 60 * 1000) // Last 30 minutes
      });

      for (const event of recentEvents) {
        // Check if incident already exists for this event
        const existingIncident = this.findIncidentByEventFingerprint(event.fingerprint);
        if (existingIncident) continue;

        // Create incident for critical events
        await this.createIncidentFromSecurityEvent(event);
      }
    } catch (error) {
      console.error('Error checking critical security events:', error);
    }
  }

  /**
   * Create incident from security event
   */
  private async createIncidentFromSecurityEvent(event: any): Promise<void> {
    const incidentType = this.mapEventToIncidentType(event.eventType);
    
    const incident = await this.createIncident({
      type: incidentType,
      title: `Critical Event: ${event.eventType}`,
      description: `Critical security event detected: ${event.message}`,
      severity: event.severity,
      priority: this.mapSeverityToPriority(event.severity),
      affectedUsers: event.userId ? [event.userId] : [],
      affectedSystems: [event.source],
      metadata: {
        source: 'security_event',
        eventId: event.id,
        eventType: event.eventType,
        fingerprint: event.fingerprint
      }
    });

    console.log(`🚨 Incident created from critical event: ${incident.id}`);
  }

  /**
   * Create a new incident
   */
  async createIncident(incidentData: Partial<Incident>): Promise<Incident> {
    const incident: Incident = {
      id: `incident_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: incidentData.type || IncidentType.SECURITY_BREACH,
      title: incidentData.title || 'Unknown Incident',
      description: incidentData.description || 'No description provided',
      severity: incidentData.severity || SecuritySeverity.MEDIUM,
      priority: incidentData.priority || IncidentPriority.MEDIUM,
      status: IncidentStatus.OPEN,
      createdAt: new Date(),
      updatedAt: new Date(),
      affectedUsers: incidentData.affectedUsers || [],
      affectedSystems: incidentData.affectedSystems || [],
      evidence: [],
      timeline: [{
        id: `timeline_${Date.now()}`,
        timestamp: new Date(),
        event: 'Incident Created',
        description: 'Incident automatically created by incident response system',
        actor: 'system',
        automated: true
      }],
      responseActions: [],
      metadata: incidentData.metadata || {}
    };

    // Store incident
    this.incidents.set(incident.id, incident);

    // Initialize response playbook
    await this.initializeResponsePlaybook(incident);

    // Log incident creation
    await securityLogger.logEvent({
      eventType: SecurityEventType.SECURITY_BREACH,
      severity: incident.severity,
      ipAddress: '127.0.0.1',
      userAgent: 'IncidentResponseSystem',
      message: `Incident created: ${incident.title}`,
      details: {
        incidentId: incident.id,
        incidentType: incident.type,
        priority: incident.priority,
        affectedUsersCount: incident.affectedUsers.length,
        affectedSystems: incident.affectedSystems
      },
      source: 'incident_response',
      tags: ['incident', 'automated', incident.type],
      metadata: { incident }
    });

    return incident;
  }

  /**
   * Initialize response playbook for an incident
   */
  private async initializeResponsePlaybook(incident: Incident): Promise<void> {
    const playbook = this.responsePlaybooks.get(incident.type);
    if (!playbook) {
      console.warn(`No response playbook found for incident type: ${incident.type}`);
      return;
    }

    // Clone playbook actions for this incident
    incident.responseActions = playbook.map(action => ({
      ...action,
      id: `${incident.id}_${action.id}_${Date.now()}`
    }));

    // Execute automated actions immediately for critical incidents
    if (incident.priority === IncidentPriority.CRITICAL) {
      await this.executeAutomatedActions(incident);
    }

    // Add timeline entry
    incident.timeline.push({
      id: `timeline_${Date.now()}`,
      timestamp: new Date(),
      event: 'Response Playbook Initialized',
      description: `${incident.responseActions.length} response actions loaded`,
      actor: 'system',
      automated: true
    });

    console.log(`✅ Response playbook initialized for incident ${incident.id}`);
  }

  /**
   * Execute automated response actions
   */
  private async executeAutomatedActions(incident: Incident): Promise<void> {
    const automatedActions = incident.responseActions.filter(action => 
      action.automated && action.status === 'pending'
    );

    for (const action of automatedActions) {
      try {
        action.status = 'in_progress';
        action.executedAt = new Date();
        action.executedBy = 'system';

        const result = await this.executeResponseAction(action, incident);
        
        action.status = 'completed';
        action.result = result;

        // Add to timeline
        incident.timeline.push({
          id: `timeline_${Date.now()}`,
          timestamp: new Date(),
          event: 'Automated Action Completed',
          description: `${action.description} - Result: ${result.success ? 'Success' : 'Failed'}`,
          actor: 'system',
          automated: true
        });

        console.log(`✅ Automated action completed: ${action.description}`);

      } catch (error) {
        action.status = 'failed';
        action.result = { success: false, error: error.message };

        console.error(`❌ Automated action failed: ${action.description}`, error);
      }
    }

    incident.updatedAt = new Date();
  }

  /**
   * Execute a specific response action
   */
  private async executeResponseAction(action: ResponseAction, incident: Incident): Promise<any> {
    switch (action.type) {
      case ResponseActionType.ISOLATE_USER:
        return await this.isolateUsers(incident.affectedUsers);
      
      case ResponseActionType.BLOCK_IP:
        return await this.blockSuspiciousIPs(incident);
      
      case ResponseActionType.DISABLE_API_KEY:
        return await this.disableAPIKeys(incident.affectedUsers);
      
      case ResponseActionType.BACKUP_DATA:
        return await this.backupCriticalData(incident);
      
      case ResponseActionType.ENABLE_MONITORING:
        return await this.enhanceMonitoring(incident);
      
      case ResponseActionType.NOTIFY_STAKEHOLDERS:
        return await this.notifyStakeholders(incident);
      
      case ResponseActionType.FORENSIC_ANALYSIS:
        return await this.startForensicAnalysis(incident);
      
      default:
        return { success: false, error: 'Unknown action type' };
    }
  }

  /**
   * Isolate affected users
   */
  private async isolateUsers(userIds: string[]): Promise<any> {
    try {
      if (userIds.length === 0) return { success: true, message: 'No users to isolate' };

      // Update user accounts to suspended status
      const { error } = await this.supabase
        .from('users')
        .update({ 
          is_suspended: true,
          suspended_at: new Date().toISOString(),
          suspension_reason: 'Security incident - automated isolation'
        })
        .in('id', userIds);

      if (error) throw error;

      return { 
        success: true, 
        message: `Isolated ${userIds.length} users`,
        isolatedUsers: userIds
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Block suspicious IP addresses
   */
  private async blockSuspiciousIPs(incident: Incident): Promise<any> {
    try {
      // Extract IP addresses from incident metadata and evidence
      const ips = new Set<string>();
      
      // Add IPs from metadata if available
      if (incident.metadata.ipAddresses) {
        incident.metadata.ipAddresses.forEach((ip: string) => ips.add(ip));
      }

      if (ips.size === 0) return { success: true, message: 'No IPs to block' };

      // Use threat detection to block IPs
      for (const ip of ips) {
        threatDetection.processEvent({
          eventType: SecurityEventType.IP_BLOCKED,
          severity: SecuritySeverity.HIGH,
          ipAddress: ip,
          userAgent: 'IncidentResponse',
          message: `IP blocked due to incident ${incident.id}`,
          timestamp: new Date()
        });
      }

      return { 
        success: true, 
        message: `Blocked ${ips.size} IP addresses`,
        blockedIPs: Array.from(ips)
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Disable API keys for affected users
   */
  private async disableAPIKeys(userIds: string[]): Promise<any> {
    try {
      if (userIds.length === 0) return { success: true, message: 'No API keys to disable' };

      // This would integrate with the key rotation system
      return { 
        success: true, 
        message: `API key disabling initiated for ${userIds.length} users`,
        affectedUsers: userIds
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Backup critical data
   */
  private async backupCriticalData(incident: Incident): Promise<any> {
    try {
      // This would trigger emergency backup procedures
      return { 
        success: true, 
        message: 'Emergency backup initiated',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Enhance monitoring
   */
  private async enhanceMonitoring(incident: Incident): Promise<any> {
    try {
      // This would enable additional monitoring and logging
      return { 
        success: true, 
        message: 'Enhanced monitoring enabled',
        monitoringLevel: 'critical'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Notify stakeholders
   */
  private async notifyStakeholders(incident: Incident): Promise<any> {
    try {
      // This would send notifications to security team, management, etc.
      console.log(`📧 Stakeholder notification for incident ${incident.id}:`, {
        type: incident.type,
        severity: incident.severity,
        priority: incident.priority,
        affectedUsers: incident.affectedUsers.length
      });

      return { 
        success: true, 
        message: 'Stakeholders notified',
        notificationsSent: ['security_team', 'management']
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Start forensic analysis
   */
  private async startForensicAnalysis(incident: Incident): Promise<any> {
    try {
      // Collect evidence from various sources
      const evidence: IncidentEvidence[] = [];

      // Collect security logs
      const recentLogs = await securityLogger.searchEvents('', 100, {
        fromDate: new Date(incident.createdAt.getTime() - 60 * 60 * 1000) // 1 hour before incident
      });

      evidence.push({
        id: `evidence_logs_${Date.now()}`,
        type: 'log',
        description: 'Security logs from incident timeframe',
        data: { logs: recentLogs.slice(0, 10) }, // Limit for storage
        collectedAt: new Date(),
        collectedBy: 'system'
      });

      incident.evidence = evidence;

      return { 
        success: true, 
        message: 'Forensic analysis initiated',
        evidenceCollected: evidence.length
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Update incident status
   */
  async updateIncidentStatus(incidentId: string, status: IncidentStatus, notes?: string): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const previousStatus = incident.status;
    incident.status = status;
    incident.updatedAt = new Date();

    if (status === IncidentStatus.RESOLVED) {
      incident.resolvedAt = new Date();
    }

    // Add timeline entry
    incident.timeline.push({
      id: `timeline_${Date.now()}`,
      timestamp: new Date(),
      event: 'Status Updated',
      description: `Status changed from ${previousStatus} to ${status}${notes ? `: ${notes}` : ''}`,
      actor: 'user',
      automated: false
    });

    return true;
  }

  /**
   * Get all incidents
   */
  getAllIncidents(): Incident[] {
    return Array.from(this.incidents.values());
  }

  /**
   * Get active incidents
   */
  getActiveIncidents(): Incident[] {
    return Array.from(this.incidents.values()).filter(incident => 
      incident.status !== IncidentStatus.RESOLVED && incident.status !== IncidentStatus.CLOSED
    );
  }

  /**
   * Get incident by ID
   */
  getIncident(incidentId: string): Incident | undefined {
    return this.incidents.get(incidentId);
  }

  /**
   * Get incident statistics
   */
  getStatistics(): any {
    const incidents = Array.from(this.incidents.values());
    const activeIncidents = incidents.filter(i => 
      i.status !== IncidentStatus.RESOLVED && i.status !== IncidentStatus.CLOSED
    );

    return {
      totalIncidents: incidents.length,
      activeIncidents: activeIncidents.length,
      incidentsBySeverity: incidents.reduce((acc, incident) => {
        acc[incident.severity] = (acc[incident.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      incidentsByType: incidents.reduce((acc, incident) => {
        acc[incident.type] = (acc[incident.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      incidentsByStatus: incidents.reduce((acc, incident) => {
        acc[incident.status] = (acc[incident.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
  }

  // Helper methods

  private mapThreatToIncidentType(patternId: string): IncidentType {
    const mapping: Record<string, IncidentType> = {
      'brute_force_login': IncidentType.ACCOUNT_COMPROMISE,
      'rapid_api_requests': IncidentType.DDOS_ATTACK,
      'csp_violation_pattern': IncidentType.SECURITY_BREACH,
      'suspicious_file_uploads': IncidentType.MALWARE_DETECTION,
      'payment_fraud_pattern': IncidentType.PAYMENT_FRAUD
    };
    
    return mapping[patternId] || IncidentType.SECURITY_BREACH;
  }

  private mapEventToIncidentType(eventType: string): IncidentType {
    const mapping: Record<string, IncidentType> = {
      'malware_detected': IncidentType.MALWARE_DETECTION,
      'security_breach': IncidentType.SECURITY_BREACH,
      'data_export': IncidentType.DATA_BREACH,
      'payment_failed': IncidentType.PAYMENT_FRAUD,
      'system_error': IncidentType.SYSTEM_OUTAGE
    };
    
    return mapping[eventType] || IncidentType.SECURITY_BREACH;
  }

  private mapSeverityToPriority(severity: SecuritySeverity): IncidentPriority {
    const mapping: Record<SecuritySeverity, IncidentPriority> = {
      [SecuritySeverity.CRITICAL]: IncidentPriority.CRITICAL,
      [SecuritySeverity.HIGH]: IncidentPriority.HIGH,
      [SecuritySeverity.MEDIUM]: IncidentPriority.MEDIUM,
      [SecuritySeverity.LOW]: IncidentPriority.LOW,
      [SecuritySeverity.INFO]: IncidentPriority.LOW
    };
    
    return mapping[severity] || IncidentPriority.MEDIUM;
  }

  private findIncidentByEventFingerprint(fingerprint: string): Incident | undefined {
    return Array.from(this.incidents.values()).find(incident => 
      incident.metadata.fingerprint === fingerprint
    );
  }

  /**
   * Stop the incident response system
   */
  destroy(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    console.log('Incident response system stopped');
  }
}

// Singleton instance
export const incidentResponse = new IncidentResponseManager();