const { withSecurityHeaders, SecurityConfigs } = require('../../src/lib/securityHeaders.js');
const { withRateLimit, RateLimitConfigs } = require('../../src/lib/rateLimit.js');

/**
 * Security Incident Management API
 * Provides endpoints for creating, updating, and managing security incidents
 */

// Simulate incident storage (in production, use database)
const incidents = new Map();
let incidentCounter = 1;

async function incidentManagementHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Verify authentication for all incident management operations
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required for incident management'
      });
    }

    switch (req.method) {
      case 'GET':
        return await handleGetIncidents(req, res);
      case 'POST':
        return await handleCreateIncident(req, res);
      case 'PUT':
        return await handleUpdateIncident(req, res);
      case 'DELETE':
        return await handleDeleteIncident(req, res);
      default:
        res.setHeader('Allow', 'GET, POST, PUT, DELETE, OPTIONS');
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Incident management error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process incident management request'
    });
  }
}

async function handleGetIncidents(req, res) {
  const { 
    id, 
    status, 
    severity, 
    type, 
    page = 1, 
    limit = 50,
    sortBy = 'detectedAt',
    sortOrder = 'desc'
  } = req.query;

  try {
    let incidentList = Array.from(incidents.values());

    // Filter by specific incident ID
    if (id) {
      const incident = incidents.get(id);
      if (!incident) {
        return res.status(404).json({
          error: 'Not found',
          message: 'Incident not found'
        });
      }
      return res.status(200).json({
        success: true,
        data: incident
      });
    }

    // Apply filters
    if (status) {
      incidentList = incidentList.filter(incident => incident.status === status);
    }
    if (severity) {
      incidentList = incidentList.filter(incident => incident.severity === severity);
    }
    if (type) {
      incidentList = incidentList.filter(incident => incident.type === type);
    }

    // Apply sorting
    incidentList.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      const comparison = sortOrder === 'asc' ? 
        (aVal > bVal ? 1 : -1) : 
        (aVal < bVal ? 1 : -1);
      return comparison;
    });

    // Apply pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const startIndex = (pageNum - 1) * limitNum;
    const endIndex = startIndex + limitNum;
    const paginatedIncidents = incidentList.slice(startIndex, endIndex);

    return res.status(200).json({
      success: true,
      data: {
        incidents: paginatedIncidents,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: incidentList.length,
          pages: Math.ceil(incidentList.length / limitNum)
        },
        filters: { status, severity, type },
        sorting: { sortBy, sortOrder }
      }
    });

  } catch (error) {
    console.error('Error retrieving incidents:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to retrieve incidents'
    });
  }
}

async function handleCreateIncident(req, res) {
  const {
    type,
    severity,
    title,
    description,
    sourceIP,
    userAgent,
    affectedSystems = [],
    evidence = []
  } = req.body;

  // Validate required fields
  if (!type || !severity || !title || !description) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Missing required fields: type, severity, title, description'
    });
  }

  // Validate enum values
  const validTypes = [
    'ddos_attack', 'data_breach', 'malware_detection', 'unauthorized_access',
    'sql_injection', 'xss_attack', 'brute_force', 'insider_threat',
    'system_compromise', 'phishing_attack', 'api_abuse', 'configuration_error', 'other'
  ];
  
  const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];

  if (!validTypes.includes(type)) {
    return res.status(400).json({
      error: 'Invalid incident type',
      message: `Type must be one of: ${validTypes.join(', ')}`
    });
  }

  if (!validSeverities.includes(severity)) {
    return res.status(400).json({
      error: 'Invalid severity level',
      message: `Severity must be one of: ${validSeverities.join(', ')}`
    });
  }

  try {
    const incidentId = `INC-${Date.now()}-${incidentCounter++}`;
    const now = new Date().toISOString();

    const newIncident = {
      id: incidentId,
      type,
      severity,
      status: 'new',
      title,
      description,
      detectedAt: now,
      detectionMethod: 'manual_report',
      affectedSystems,
      sourceIP,
      userAgent,
      evidence: evidence.map((ev, index) => ({
        id: `EVD-${Date.now()}-${index}`,
        ...ev,
        collectedAt: now
      })),
      timeline: [{
        timestamp: now,
        event: 'Incident Created',
        details: 'Security incident manually created via API',
        source: 'manual_api',
        severity: 'info'
      }],
      escalationLevel: 0,
      estimatedImpact: calculateImpact(type, severity),
      mitigationActions: [],
      containmentStatus: 'not_contained',
      recoveryActions: [],
      postIncidentActions: [],
      lessons: [],
      createdBy: 'api_user', // In production, get from JWT token
      lastUpdated: now
    };

    // Store the incident
    incidents.set(incidentId, newIncident);

    // Log incident creation
    console.log(`New security incident created: ${incidentId} - ${title}`);

    // In production, trigger automated response here
    await triggerAutomatedResponse(newIncident);

    return res.status(201).json({
      success: true,
      message: 'Security incident created successfully',
      data: newIncident
    });

  } catch (error) {
    console.error('Error creating incident:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create security incident'
    });
  }
}

async function handleUpdateIncident(req, res) {
  const { id } = req.query;
  const updates = req.body;

  if (!id) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Incident ID is required'
    });
  }

  const incident = incidents.get(id);
  if (!incident) {
    return res.status(404).json({
      error: 'Not found',
      message: 'Incident not found'
    });
  }

  try {
    const now = new Date().toISOString();
    const updateDescription = req.body.updateDescription || 'Incident updated via API';

    // Apply updates
    Object.assign(incident, updates, { lastUpdated: now });

    // Add timeline event
    incident.timeline.push({
      timestamp: now,
      event: 'Incident Updated',
      details: updateDescription,
      source: 'manual_api',
      severity: 'info'
    });

    // Handle status transitions
    if (updates.status) {
      await handleStatusTransition(incident, updates.status);
    }

    console.log(`Security incident updated: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Security incident updated successfully',
      data: incident
    });

  } catch (error) {
    console.error('Error updating incident:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update security incident'
    });
  }
}

async function handleDeleteIncident(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Incident ID is required'
    });
  }

  const incident = incidents.get(id);
  if (!incident) {
    return res.status(404).json({
      error: 'Not found',
      message: 'Incident not found'
    });
  }

  try {
    // Only allow deletion of closed or false positive incidents
    if (!['closed', 'false_positive'].includes(incident.status)) {
      return res.status(400).json({
        error: 'Cannot delete active incident',
        message: 'Only closed or false positive incidents can be deleted'
      });
    }

    incidents.delete(id);
    console.log(`Security incident deleted: ${id}`);

    return res.status(200).json({
      success: true,
      message: 'Security incident deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting incident:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete security incident'
    });
  }
}

function calculateImpact(type, severity) {
  const baseImpact = {
    confidentiality: 'none',
    integrity: 'none',
    availability: 'none',
    estimatedCost: 0,
    affectedUsers: 0,
    dataAtRisk: false,
    complianceImpact: [],
    reputationImpact: 'none'
  };

  // Adjust based on incident type
  switch (type) {
    case 'data_breach':
      baseImpact.confidentiality = severity === 'critical' ? 'critical' : 'high';
      baseImpact.dataAtRisk = true;
      baseImpact.complianceImpact = ['GDPR', 'CCPA'];
      baseImpact.estimatedCost = severity === 'critical' ? 100000 : 50000;
      break;
    
    case 'ddos_attack':
      baseImpact.availability = severity === 'critical' ? 'critical' : 'high';
      baseImpact.affectedUsers = severity === 'critical' ? 10000 : 1000;
      baseImpact.estimatedCost = severity === 'critical' ? 25000 : 10000;
      break;
    
    case 'system_compromise':
      baseImpact.integrity = 'high';
      baseImpact.confidentiality = 'medium';
      baseImpact.availability = 'medium';
      baseImpact.estimatedCost = 75000;
      break;

    default:
      baseImpact.estimatedCost = severity === 'critical' ? 50000 : 10000;
  }

  return baseImpact;
}

async function triggerAutomatedResponse(incident) {
  // Simulate automated response actions
  console.log(`Triggering automated response for ${incident.type} incident`);
  
  const automatedActions = [];

  switch (incident.type) {
    case 'ddos_attack':
      automatedActions.push('Activate DDoS protection');
      automatedActions.push('Block suspicious IPs');
      automatedActions.push('Enable rate limiting');
      break;
    
    case 'brute_force':
      automatedActions.push('Block attacker IPs');
      automatedActions.push('Increase authentication security');
      automatedActions.push('Alert account owners');
      break;
    
    case 'malware_detection':
      automatedActions.push('Quarantine affected files');
      automatedActions.push('Run full system scan');
      automatedActions.push('Update antimalware signatures');
      break;
  }

  // Add automated actions to incident
  for (const action of automatedActions) {
    incident.mitigationActions.push({
      id: `AUTO-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      description: action,
      implementedAt: new Date().toISOString(),
      implementedBy: 'automated_system',
      status: 'completed',
      effectiveness: 'unknown'
    });

    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'Automated Action Executed',
      details: action,
      source: 'automated_response',
      severity: 'info'
    });
  }
}

async function handleStatusTransition(incident, newStatus) {
  const transitions = {
    'contained': () => {
      incident.containmentStatus = 'fully_contained';
      console.log(`Incident ${incident.id} contained - initiating recovery phase`);
    },
    'closed': () => {
      console.log(`Incident ${incident.id} closed - initiating post-incident review`);
      // Generate post-incident actions
      incident.postIncidentActions = [
        {
          id: `POST-${Date.now()}-1`,
          type: 'documentation',
          description: 'Complete incident report and lessons learned',
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: 'security_team',
          status: 'pending'
        },
        {
          id: `POST-${Date.now()}-2`,
          type: 'security_update',
          description: 'Review and update security controls',
          dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          assignedTo: 'technical_team',
          status: 'pending'
        }
      ];
    }
  };

  const handler = transitions[newStatus];
  if (handler) {
    handler();
  }
}

// Apply security headers and rate limiting
const handler = withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'incident-management')(incidentManagementHandler)
);

module.exports = handler;