/**
 * Comprehensive Security Incident Response Plan
 * Automated incident detection, classification, and response system
 */

export interface SecurityIncident {
  id: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  title: string;
  description: string;
  detectedAt: string;
  detectionMethod: string;
  affectedSystems: string[];
  sourceIP?: string;
  userAgent?: string;
  payload?: any;
  evidence: Evidence[];
  timeline: TimelineEvent[];
  assignedTo?: string;
  escalationLevel: number;
  estimatedImpact: ImpactAssessment;
  mitigationActions: MitigationAction[];
  containmentStatus: ContainmentStatus;
  recoveryActions: RecoveryAction[];
  postIncidentActions: PostIncidentAction[];
  lessons: string[];
  createdBy: string;
  lastUpdated: string;
}

export enum IncidentType {
  DDoS_ATTACK = 'ddos_attack',
  DATA_BREACH = 'data_breach',
  MALWARE_DETECTION = 'malware_detection',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  SQL_INJECTION = 'sql_injection',
  XSS_ATTACK = 'xss_attack',
  BRUTE_FORCE = 'brute_force',
  INSIDER_THREAT = 'insider_threat',
  SYSTEM_COMPROMISE = 'system_compromise',
  PHISHING_ATTACK = 'phishing_attack',
  API_ABUSE = 'api_abuse',
  CONFIGURATION_ERROR = 'configuration_error',
  OTHER = 'other'
}

export enum IncidentSeverity {
  CRITICAL = 'critical',    // System down, data breach, active attack
  HIGH = 'high',           // Major security issue, partial system impact
  MEDIUM = 'medium',       // Moderate security concern, limited impact
  LOW = 'low',            // Minor security issue, minimal impact
  INFO = 'info'           // Information only, no immediate threat
}

export enum IncidentStatus {
  NEW = 'new',
  INVESTIGATING = 'investigating',
  CONFIRMED = 'confirmed',
  CONTAINED = 'contained',
  ERADICATED = 'eradicated',
  RECOVERING = 'recovering',
  CLOSED = 'closed',
  FALSE_POSITIVE = 'false_positive'
}

export enum ContainmentStatus {
  NOT_CONTAINED = 'not_contained',
  PARTIALLY_CONTAINED = 'partially_contained',
  FULLY_CONTAINED = 'fully_contained'
}

export interface Evidence {
  id: string;
  type: 'log' | 'screenshot' | 'network_capture' | 'memory_dump' | 'file' | 'other';
  description: string;
  location: string;
  collectedAt: string;
  collectedBy: string;
  hash?: string;
  size?: number;
  metadata?: any;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  details: string;
  source: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface ImpactAssessment {
  confidentiality: 'none' | 'low' | 'medium' | 'high' | 'critical';
  integrity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  availability: 'none' | 'low' | 'medium' | 'high' | 'critical';
  estimatedCost: number;
  affectedUsers: number;
  dataAtRisk: boolean;
  complianceImpact: string[];
  reputationImpact: 'none' | 'low' | 'medium' | 'high' | 'critical';
}

export interface MitigationAction {
  id: string;
  description: string;
  implementedAt?: string;
  implementedBy?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  effectiveness: 'unknown' | 'low' | 'medium' | 'high';
  notes?: string;
}

export interface RecoveryAction {
  id: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedTime: number; // in minutes
  dependencies: string[];
  assignedTo?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedAt?: string;
}

export interface PostIncidentAction {
  id: string;
  type: 'security_update' | 'policy_change' | 'training' | 'monitoring' | 'documentation' | 'other';
  description: string;
  dueDate: string;
  assignedTo: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface ResponseTeam {
  incidentCommander: string;
  securityLead: string;
  technicalLead: string;
  communicationsLead: string;
  legalCounsel?: string;
  externalContacts: ExternalContact[];
}

export interface ExternalContact {
  name: string;
  organization: string;
  role: string;
  phone: string;
  email: string;
  escalationLevel: number;
}

class SecurityIncidentResponseSystem {
  private incidents = new Map<string, SecurityIncident>();
  private responseTeam: ResponseTeam;
  private automatedResponses = new Map<IncidentType, Function[]>();
  private escalationRules = new Map<IncidentSeverity, number>(); // severity -> max response time in minutes

  constructor() {
    this.initializeEscalationRules();
    this.initializeAutomatedResponses();
    this.initializeResponseTeam();
  }

  private initializeEscalationRules() {
    this.escalationRules.set(IncidentSeverity.CRITICAL, 15); // 15 minutes
    this.escalationRules.set(IncidentSeverity.HIGH, 60);     // 1 hour
    this.escalationRules.set(IncidentSeverity.MEDIUM, 240);  // 4 hours
    this.escalationRules.set(IncidentSeverity.LOW, 1440);    // 24 hours
    this.escalationRules.set(IncidentSeverity.INFO, 4320);   // 3 days
  }

  private initializeAutomatedResponses() {
    // DDoS Attack Response
    this.automatedResponses.set(IncidentType.DDoS_ATTACK, [
      this.activateDDoSProtection,
      this.blockSuspiciousIPs,
      this.enableRateLimiting,
      this.notifyNetworkTeam
    ]);

    // Data Breach Response
    this.automatedResponses.set(IncidentType.DATA_BREACH, [
      this.isolateAffectedSystems,
      this.preserveEvidence,
      this.notifyLegalTeam,
      this.activateBreachProtocol
    ]);

    // Malware Detection Response
    this.automatedResponses.set(IncidentType.MALWARE_DETECTION, [
      this.quarantineAffectedFiles,
      this.runFullSystemScan,
      this.updateAntimalwareSignatures,
      this.notifySecurityTeam
    ]);

    // Brute Force Response
    this.automatedResponses.set(IncidentType.BRUTE_FORCE, [
      this.blockAttackerIPs,
      this.increaseAuthenticationSecurity,
      this.alertAccountOwners,
      this.temporaryAccountLockdown
    ]);
  }

  private initializeResponseTeam() {
    this.responseTeam = {
      incidentCommander: 'security@company.com',
      securityLead: 'ciso@company.com',
      technicalLead: 'tech-lead@company.com',
      communicationsLead: 'comms@company.com',
      legalCounsel: 'legal@company.com',
      externalContacts: [
        {
          name: 'FBI Cyber Division',
          organization: 'FBI',
          role: 'Law Enforcement',
          phone: '+1-855-292-3937',
          email: 'cyber@fbi.gov',
          escalationLevel: 1
        },
        {
          name: 'CISA',
          organization: 'Cybersecurity and Infrastructure Security Agency',
          role: 'Government Agency',
          phone: '+1-888-282-0870',
          email: 'central@cisa.dhs.gov',
          escalationLevel: 2
        }
      ]
    };
  }

  /**
   * Create and register a new security incident
   */
  async createIncident(
    type: IncidentType,
    severity: IncidentSeverity,
    title: string,
    description: string,
    detectionMethod: string,
    sourceData?: any
  ): Promise<SecurityIncident> {
    const incidentId = this.generateIncidentId();
    const now = new Date().toISOString();

    const incident: SecurityIncident = {
      id: incidentId,
      type,
      severity,
      status: IncidentStatus.NEW,
      title,
      description,
      detectedAt: now,
      detectionMethod,
      affectedSystems: [],
      sourceIP: sourceData?.ip,
      userAgent: sourceData?.userAgent,
      payload: sourceData?.payload,
      evidence: [],
      timeline: [{
        timestamp: now,
        event: 'Incident Created',
        details: `Security incident created via ${detectionMethod}`,
        source: 'automated_detection',
        severity: 'info'
      }],
      escalationLevel: 0,
      estimatedImpact: this.calculateInitialImpact(type, severity),
      mitigationActions: [],
      containmentStatus: ContainmentStatus.NOT_CONTAINED,
      recoveryActions: [],
      postIncidentActions: [],
      lessons: [],
      createdBy: 'system',
      lastUpdated: now
    };

    // Store the incident
    this.incidents.set(incidentId, incident);

    // Start automated response
    await this.initiateAutomatedResponse(incident);

    // Send immediate notifications
    await this.sendIncidentNotifications(incident);

    // Start escalation timer
    this.scheduleEscalation(incident);

    return incident;
  }

  /**
   * Update incident status and add timeline event
   */
  async updateIncident(
    incidentId: string,
    updates: Partial<SecurityIncident>,
    eventDescription?: string
  ): Promise<SecurityIncident | null> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return null;

    // Update incident fields
    Object.assign(incident, updates, { lastUpdated: new Date().toISOString() });

    // Add timeline event if description provided
    if (eventDescription) {
      incident.timeline.push({
        timestamp: new Date().toISOString(),
        event: 'Incident Updated',
        details: eventDescription,
        source: 'manual_update',
        severity: 'info'
      });
    }

    // Check for status changes that trigger actions
    if (updates.status) {
      await this.handleStatusChange(incident, updates.status);
    }

    return incident;
  }

  /**
   * Add evidence to incident
   */
  async addEvidence(
    incidentId: string,
    evidence: Omit<Evidence, 'id' | 'collectedAt'>
  ): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const evidenceItem: Evidence = {
      ...evidence,
      id: this.generateEvidenceId(),
      collectedAt: new Date().toISOString()
    };

    incident.evidence.push(evidenceItem);
    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'Evidence Added',
      details: `Evidence collected: ${evidence.description}`,
      source: 'evidence_collection',
      severity: 'info'
    });

    incident.lastUpdated = new Date().toISOString();
    return true;
  }

  /**
   * Execute mitigation action
   */
  async executeMitigationAction(
    incidentId: string,
    action: Omit<MitigationAction, 'id'>
  ): Promise<boolean> {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    const mitigationAction: MitigationAction = {
      ...action,
      id: this.generateActionId(),
      implementedAt: new Date().toISOString(),
      implementedBy: action.implementedBy || 'system'
    };

    incident.mitigationActions.push(mitigationAction);
    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'Mitigation Action Executed',
      details: `Action: ${action.description}`,
      source: 'mitigation',
      severity: 'info'
    });

    incident.lastUpdated = new Date().toISOString();
    return true;
  }

  private async initiateAutomatedResponse(incident: SecurityIncident) {
    const responses = this.automatedResponses.get(incident.type);
    if (!responses) return;

    for (const response of responses) {
      try {
        await response(incident);
      } catch (error) {
        console.error(`Automated response failed for incident ${incident.id}:`, error);
        incident.timeline.push({
          timestamp: new Date().toISOString(),
          event: 'Automated Response Failed',
          details: `Failed to execute: ${response.name}`,
          source: 'automated_response',
          severity: 'error'
        });
      }
    }
  }

  private calculateInitialImpact(type: IncidentType, severity: IncidentSeverity): ImpactAssessment {
    const baseImpact: ImpactAssessment = {
      confidentiality: 'none',
      integrity: 'none',
      availability: 'none',
      estimatedCost: 0,
      affectedUsers: 0,
      dataAtRisk: false,
      complianceImpact: [],
      reputationImpact: 'none'
    };

    // Adjust based on incident type and severity
    switch (type) {
      case IncidentType.DATA_BREACH:
        baseImpact.confidentiality = severity === IncidentSeverity.CRITICAL ? 'critical' : 'high';
        baseImpact.dataAtRisk = true;
        baseImpact.complianceImpact = ['GDPR', 'CCPA'];
        break;
      
      case IncidentType.DDoS_ATTACK:
        baseImpact.availability = severity === IncidentSeverity.CRITICAL ? 'critical' : 'high';
        baseImpact.affectedUsers = severity === IncidentSeverity.CRITICAL ? 10000 : 1000;
        break;
      
      case IncidentType.SYSTEM_COMPROMISE:
        baseImpact.integrity = 'high';
        baseImpact.confidentiality = 'medium';
        baseImpact.availability = 'medium';
        break;
    }

    return baseImpact;
  }

  private async sendIncidentNotifications(incident: SecurityIncident) {
    const notifications = [];

    // Always notify security team
    notifications.push(this.notifySecurityTeam(incident));

    // Critical incidents notify incident commander immediately
    if (incident.severity === IncidentSeverity.CRITICAL) {
      notifications.push(this.notifyIncidentCommander(incident));
    }

    // High severity incidents notify technical lead
    if ([IncidentSeverity.CRITICAL, IncidentSeverity.HIGH].includes(incident.severity)) {
      notifications.push(this.notifyTechnicalTeam(incident));
    }

    await Promise.all(notifications);
  }

  private scheduleEscalation(incident: SecurityIncident) {
    const escalationTime = this.escalationRules.get(incident.severity);
    if (!escalationTime) return;

    setTimeout(async () => {
      const currentIncident = this.incidents.get(incident.id);
      if (!currentIncident) return;

      // Check if incident is still unresolved
      if ([IncidentStatus.NEW, IncidentStatus.INVESTIGATING].includes(currentIncident.status)) {
        await this.escalateIncident(currentIncident);
      }
    }, escalationTime * 60 * 1000);
  }

  private async escalateIncident(incident: SecurityIncident) {
    incident.escalationLevel++;
    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'Incident Escalated',
      details: `Escalated to level ${incident.escalationLevel} due to response time threshold`,
      source: 'escalation_system',
      severity: 'warning'
    });

    // Notify higher level contacts based on escalation level
    if (incident.escalationLevel >= 2) {
      await this.notifyExternalContacts(incident);
    }
  }

  private async handleStatusChange(incident: SecurityIncident, newStatus: IncidentStatus) {
    switch (newStatus) {
      case IncidentStatus.CONTAINED:
        incident.containmentStatus = ContainmentStatus.FULLY_CONTAINED;
        await this.initiateRecoveryPhase(incident);
        break;
      
      case IncidentStatus.CLOSED:
        await this.initiatePostIncidentReview(incident);
        break;
    }
  }

  private async initiateRecoveryPhase(incident: SecurityIncident) {
    // Generate recovery actions based on incident type
    const recoveryActions = this.generateRecoveryActions(incident);
    incident.recoveryActions = recoveryActions;
    
    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'Recovery Phase Initiated',
      details: `${recoveryActions.length} recovery actions generated`,
      source: 'recovery_system',
      severity: 'info'
    });
  }

  private async initiatePostIncidentReview(incident: SecurityIncident) {
    // Generate post-incident actions
    const postActions = this.generatePostIncidentActions(incident);
    incident.postIncidentActions = postActions;

    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'Post-Incident Review Initiated',
      details: 'Post-incident review and improvement actions scheduled',
      source: 'post_incident_system',
      severity: 'info'
    });
  }

  private generateRecoveryActions(incident: SecurityIncident): RecoveryAction[] {
    const actions: RecoveryAction[] = [];

    switch (incident.type) {
      case IncidentType.DATA_BREACH:
        actions.push(
          {
            id: this.generateActionId(),
            description: 'Verify data integrity and completeness',
            priority: 'high',
            estimatedTime: 120,
            dependencies: [],
            status: 'pending'
          },
          {
            id: this.generateActionId(),
            description: 'Reset all potentially compromised credentials',
            priority: 'critical',
            estimatedTime: 60,
            dependencies: [],
            status: 'pending'
          }
        );
        break;

      case IncidentType.DDoS_ATTACK:
        actions.push(
          {
            id: this.generateActionId(),
            description: 'Gradually restore normal traffic flow',
            priority: 'high',
            estimatedTime: 30,
            dependencies: [],
            status: 'pending'
          },
          {
            id: this.generateActionId(),
            description: 'Monitor for continued attack patterns',
            priority: 'medium',
            estimatedTime: 240,
            dependencies: [],
            status: 'pending'
          }
        );
        break;
    }

    return actions;
  }

  private generatePostIncidentActions(incident: SecurityIncident): PostIncidentAction[] {
    const actions: PostIncidentAction[] = [];

    // Common post-incident actions
    actions.push(
      {
        id: this.generateActionId(),
        type: 'documentation',
        description: 'Complete incident report and lessons learned documentation',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: this.responseTeam.securityLead,
        status: 'pending'
      },
      {
        id: this.generateActionId(),
        type: 'security_update',
        description: 'Review and update security controls based on incident findings',
        dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
        assignedTo: this.responseTeam.technicalLead,
        status: 'pending'
      }
    );

    return actions;
  }

  // Automated response functions
  private async activateDDoSProtection(incident: SecurityIncident) {
    // Implementation would activate DDoS protection systems
    console.log(`Activating DDoS protection for incident ${incident.id}`);
  }

  private async blockSuspiciousIPs(incident: SecurityIncident) {
    if (incident.sourceIP) {
      console.log(`Blocking suspicious IP ${incident.sourceIP} for incident ${incident.id}`);
    }
  }

  private async enableRateLimiting(incident: SecurityIncident) {
    console.log(`Enabling enhanced rate limiting for incident ${incident.id}`);
  }

  private async notifyNetworkTeam(incident: SecurityIncident) {
    console.log(`Notifying network team about incident ${incident.id}`);
  }

  private async isolateAffectedSystems(incident: SecurityIncident) {
    console.log(`Isolating affected systems for incident ${incident.id}`);
  }

  private async preserveEvidence(incident: SecurityIncident) {
    console.log(`Preserving evidence for incident ${incident.id}`);
  }

  private async notifyLegalTeam(incident: SecurityIncident) {
    console.log(`Notifying legal team about incident ${incident.id}`);
  }

  private async activateBreachProtocol(incident: SecurityIncident) {
    console.log(`Activating data breach protocol for incident ${incident.id}`);
  }

  private async quarantineAffectedFiles(incident: SecurityIncident) {
    console.log(`Quarantining affected files for incident ${incident.id}`);
  }

  private async runFullSystemScan(incident: SecurityIncident) {
    console.log(`Running full system scan for incident ${incident.id}`);
  }

  private async updateAntimalwareSignatures(incident: SecurityIncident) {
    console.log(`Updating antimalware signatures for incident ${incident.id}`);
  }

  private async notifySecurityTeam(incident: SecurityIncident) {
    console.log(`Notifying security team about incident ${incident.id}`);
  }

  private async blockAttackerIPs(incident: SecurityIncident) {
    if (incident.sourceIP) {
      console.log(`Blocking attacker IP ${incident.sourceIP} for incident ${incident.id}`);
    }
  }

  private async increaseAuthenticationSecurity(incident: SecurityIncident) {
    console.log(`Increasing authentication security for incident ${incident.id}`);
  }

  private async alertAccountOwners(incident: SecurityIncident) {
    console.log(`Alerting account owners about incident ${incident.id}`);
  }

  private async temporaryAccountLockdown(incident: SecurityIncident) {
    console.log(`Implementing temporary account lockdown for incident ${incident.id}`);
  }

  private async notifyIncidentCommander(incident: SecurityIncident) {
    console.log(`Notifying incident commander about critical incident ${incident.id}`);
  }

  private async notifyTechnicalTeam(incident: SecurityIncident) {
    console.log(`Notifying technical team about incident ${incident.id}`);
  }

  private async notifyExternalContacts(incident: SecurityIncident) {
    console.log(`Notifying external contacts about escalated incident ${incident.id}`);
  }

  // Utility functions
  private generateIncidentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    return `INC-${timestamp}-${random}`.toUpperCase();
  }

  private generateEvidenceId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 3);
    return `EVD-${timestamp}-${random}`.toUpperCase();
  }

  private generateActionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 3);
    return `ACT-${timestamp}-${random}`.toUpperCase();
  }

  // Public API methods
  getIncident(incidentId: string): SecurityIncident | null {
    return this.incidents.get(incidentId) || null;
  }

  getAllIncidents(): SecurityIncident[] {
    return Array.from(this.incidents.values());
  }

  getIncidentsByStatus(status: IncidentStatus): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(i => i.status === status);
  }

  getIncidentsByType(type: IncidentType): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(i => i.type === type);
  }

  getIncidentsBySeverity(severity: IncidentSeverity): SecurityIncident[] {
    return Array.from(this.incidents.values()).filter(i => i.severity === severity);
  }

  getActiveIncidents(): SecurityIncident[] {
    const activeStatuses = [
      IncidentStatus.NEW,
      IncidentStatus.INVESTIGATING,
      IncidentStatus.CONFIRMED,
      IncidentStatus.CONTAINED,
      IncidentStatus.ERADICATED,
      IncidentStatus.RECOVERING
    ];
    return Array.from(this.incidents.values()).filter(i => activeStatuses.includes(i.status));
  }

  getIncidentStats() {
    const incidents = Array.from(this.incidents.values());
    return {
      total: incidents.length,
      active: this.getActiveIncidents().length,
      byStatus: Object.fromEntries(
        Object.values(IncidentStatus).map(status => [
          status,
          incidents.filter(i => i.status === status).length
        ])
      ),
      bySeverity: Object.fromEntries(
        Object.values(IncidentSeverity).map(severity => [
          severity,
          incidents.filter(i => i.severity === severity).length
        ])
      ),
      byType: Object.fromEntries(
        Object.values(IncidentType).map(type => [
          type,
          incidents.filter(i => i.type === type).length
        ])
      )
    };
  }
}

// Global incident response system
export const globalIncidentResponse = new SecurityIncidentResponseSystem();

export default {
  SecurityIncidentResponseSystem,
  globalIncidentResponse,
  IncidentType,
  IncidentSeverity,
  IncidentStatus,
  ContainmentStatus
};