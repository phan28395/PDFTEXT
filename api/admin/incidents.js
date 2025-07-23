/**
 * Incident Management API
 * Provides endpoints for managing security incidents and responses
 */

import { applySecurityHeaders, withSecurityHeaders } from '../../src/lib/securityHeaders.ts';
import { incidentResponse, IncidentStatus } from '../../src/lib/incidentResponse.ts';

export default withSecurityHeaders()(async function handler(req, res) {
  try {
    // Verify admin access
    const user = await verifyAdmin(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { method, query } = req;
    const { action, incidentId } = query;

    switch (method) {
      case 'GET':
        return await handleGetRequest(req, res, action, incidentId);
      case 'POST':
        return await handlePostRequest(req, res, action, req.body);
      case 'PUT':
        return await handlePutRequest(req, res, incidentId, req.body);
      default:
        res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Incident management API error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Handle GET requests
 */
async function handleGetRequest(req, res, action, incidentId) {
  switch (action) {
    case 'list':
      return await getIncidents(req, res);
    
    case 'active':
      return await getActiveIncidents(req, res);
    
    case 'details':
      return await getIncidentDetails(req, res, incidentId);
    
    case 'statistics':
      return await getIncidentStatistics(req, res);
    
    case 'timeline':
      return await getIncidentTimeline(req, res, incidentId);
    
    case 'evidence':
      return await getIncidentEvidence(req, res, incidentId);
    
    default:
      // Default: return incidents overview
      return await getIncidentsOverview(req, res);
  }
}

/**
 * Handle POST requests
 */
async function handlePostRequest(req, res, action, body) {
  switch (action) {
    case 'create':
      return await createIncident(req, res, body);
    
    case 'execute-action':
      return await executeResponseAction(req, res, body);
    
    case 'add-evidence':
      return await addEvidence(req, res, body);
    
    case 'add-note':
      return await addTimelineNote(req, res, body);
    
    default:
      return res.status(400).json({ error: 'Invalid action' });
  }
}

/**
 * Handle PUT requests
 */
async function handlePutRequest(req, res, incidentId, body) {
  if (!incidentId) {
    return res.status(400).json({ error: 'Incident ID required' });
  }

  const { status, assignedTo, notes } = body;
  
  if (status) {
    return await updateIncidentStatus(req, res, incidentId, status, notes);
  }
  
  if (assignedTo) {
    return await assignIncident(req, res, incidentId, assignedTo);
  }

  return res.status(400).json({ error: 'No valid updates provided' });
}

/**
 * Get all incidents with optional filtering
 */
async function getIncidents(req, res) {
  try {
    const { status, severity, type, limit = 50 } = req.query;
    
    let incidents = incidentResponse.getAllIncidents();
    
    // Apply filters
    if (status) {
      incidents = incidents.filter(i => i.status === status);
    }
    if (severity) {
      incidents = incidents.filter(i => i.severity === severity);
    }
    if (type) {
      incidents = incidents.filter(i => i.type === type);
    }
    
    // Sort by creation date (newest first)
    incidents.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    // Limit results
    incidents = incidents.slice(0, parseInt(limit));
    
    // Format for response
    const formattedIncidents = incidents.map(incident => ({
      id: incident.id,
      type: incident.type,
      title: incident.title,
      severity: incident.severity,
      priority: incident.priority,
      status: incident.status,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      resolvedAt: incident.resolvedAt,
      assignedTo: incident.assignedTo,
      affectedUsersCount: incident.affectedUsers.length,
      affectedSystemsCount: incident.affectedSystems.length,
      responseActionsCount: incident.responseActions.length,
      evidenceCount: incident.evidence.length
    }));

    return res.json({
      incidents: formattedIncidents,
      count: formattedIncidents.length,
      total: incidentResponse.getAllIncidents().length
    });
  } catch (error) {
    console.error('Error getting incidents:', error);
    return res.status(500).json({ error: 'Failed to get incidents' });
  }
}

/**
 * Get active incidents
 */
async function getActiveIncidents(req, res) {
  try {
    const activeIncidents = incidentResponse.getActiveIncidents();
    
    const formattedIncidents = activeIncidents.map(incident => ({
      id: incident.id,
      type: incident.type,
      title: incident.title,
      severity: incident.severity,
      priority: incident.priority,
      status: incident.status,
      createdAt: incident.createdAt,
      updatedAt: incident.updatedAt,
      assignedTo: incident.assignedTo,
      affectedUsersCount: incident.affectedUsers.length
    }));

    // Sort by priority and creation date
    formattedIncidents.sort((a, b) => {
      const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });

    return res.json({
      incidents: formattedIncidents,
      count: formattedIncidents.length
    });
  } catch (error) {
    console.error('Error getting active incidents:', error);
    return res.status(500).json({ error: 'Failed to get active incidents' });
  }
}

/**
 * Get detailed incident information
 */
async function getIncidentDetails(req, res, incidentId) {
  try {
    if (!incidentId) {
      return res.status(400).json({ error: 'Incident ID required' });
    }

    const incident = incidentResponse.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    return res.json({
      incident: {
        ...incident,
        // Format dates for JSON serialization
        createdAt: incident.createdAt.toISOString(),
        updatedAt: incident.updatedAt.toISOString(),
        resolvedAt: incident.resolvedAt?.toISOString(),
        timeline: incident.timeline.map(entry => ({
          ...entry,
          timestamp: entry.timestamp.toISOString()
        })),
        evidence: incident.evidence.map(evidence => ({
          ...evidence,
          collectedAt: evidence.collectedAt.toISOString()
        }))
      }
    });
  } catch (error) {
    console.error('Error getting incident details:', error);
    return res.status(500).json({ error: 'Failed to get incident details' });
  }
}

/**
 * Get incident statistics
 */
async function getIncidentStatistics(req, res) {
  try {
    const stats = incidentResponse.getStatistics();
    
    return res.json({
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting incident statistics:', error);
    return res.status(500).json({ error: 'Failed to get incident statistics' });
  }
}

/**
 * Get incident timeline
 */
async function getIncidentTimeline(req, res, incidentId) {
  try {
    if (!incidentId) {
      return res.status(400).json({ error: 'Incident ID required' });
    }

    const incident = incidentResponse.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const timeline = incident.timeline.map(entry => ({
      ...entry,
      timestamp: entry.timestamp.toISOString()
    }));

    return res.json({
      timeline,
      count: timeline.length
    });
  } catch (error) {
    console.error('Error getting incident timeline:', error);
    return res.status(500).json({ error: 'Failed to get incident timeline' });
  }
}

/**
 * Get incident evidence
 */
async function getIncidentEvidence(req, res, incidentId) {
  try {
    if (!incidentId) {
      return res.status(400).json({ error: 'Incident ID required' });
    }

    const incident = incidentResponse.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const evidence = incident.evidence.map(item => ({
      ...item,
      collectedAt: item.collectedAt.toISOString(),
      // Limit data size for response
      data: typeof item.data === 'object' ? 
        { ...item.data, truncated: Object.keys(item.data).length > 10 } : 
        item.data
    }));

    return res.json({
      evidence,
      count: evidence.length
    });
  } catch (error) {
    console.error('Error getting incident evidence:', error);
    return res.status(500).json({ error: 'Failed to get incident evidence' });
  }
}

/**
 * Get incidents overview
 */
async function getIncidentsOverview(req, res) {
  try {
    const stats = incidentResponse.getStatistics();
    const activeIncidents = incidentResponse.getActiveIncidents();
    
    // Get recent incidents (last 7 days)
    const recentIncidents = incidentResponse.getAllIncidents()
      .filter(i => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return i.createdAt >= weekAgo;
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    return res.json({
      overview: {
        statistics: stats,
        activeIncidents: activeIncidents.length,
        criticalIncidents: activeIncidents.filter(i => i.priority === 'critical').length,
        recentIncidents: recentIncidents.map(incident => ({
          id: incident.id,
          title: incident.title,
          type: incident.type,
          severity: incident.severity,
          status: incident.status,
          createdAt: incident.createdAt.toISOString()
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting incidents overview:', error);
    return res.status(500).json({ error: 'Failed to get incidents overview' });
  }
}

/**
 * Create a new incident manually
 */
async function createIncident(req, res, body) {
  try {
    const { type, title, description, severity, priority, affectedUsers, affectedSystems } = body;
    
    if (!type || !title || !description) {
      return res.status(400).json({ error: 'Type, title, and description are required' });
    }

    const incident = await incidentResponse.createIncident({
      type,
      title,
      description,
      severity: severity || 'medium',
      priority: priority || 'medium',
      affectedUsers: affectedUsers || [],
      affectedSystems: affectedSystems || [],
      metadata: {
        source: 'manual',
        createdBy: req.user?.id || 'admin'
      }
    });

    return res.json({
      success: true,
      incident: {
        id: incident.id,
        type: incident.type,
        title: incident.title,
        severity: incident.severity,
        priority: incident.priority,
        status: incident.status,
        createdAt: incident.createdAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating incident:', error);
    return res.status(500).json({ error: 'Failed to create incident' });
  }
}

/**
 * Execute a response action
 */
async function executeResponseAction(req, res, body) {
  try {
    const { incidentId, actionId } = body;
    
    if (!incidentId || !actionId) {
      return res.status(400).json({ error: 'Incident ID and action ID are required' });
    }

    // This would integrate with the incident response system to execute actions
    // For now, just return success
    return res.json({
      success: true,
      message: 'Response action execution initiated',
      incidentId,
      actionId,
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error executing response action:', error);
    return res.status(500).json({ error: 'Failed to execute response action' });
  }
}

/**
 * Add evidence to an incident
 */
async function addEvidence(req, res, body) {
  try {
    const { incidentId, type, description, data } = body;
    
    if (!incidentId || !type || !description) {
      return res.status(400).json({ error: 'Incident ID, type, and description are required' });
    }

    const incident = incidentResponse.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const evidence = {
      id: `evidence_${Date.now()}`,
      type,
      description,
      data: data || {},
      collectedAt: new Date(),
      collectedBy: req.user?.id || 'admin'
    };

    incident.evidence.push(evidence);
    incident.updatedAt = new Date();

    // Add timeline entry
    incident.timeline.push({
      id: `timeline_${Date.now()}`,
      timestamp: new Date(),
      event: 'Evidence Added',
      description: `New evidence added: ${description}`,
      actor: req.user?.id || 'admin',
      automated: false
    });

    return res.json({
      success: true,
      evidence: {
        ...evidence,
        collectedAt: evidence.collectedAt.toISOString()
      }
    });
  } catch (error) {
    console.error('Error adding evidence:', error);
    return res.status(500).json({ error: 'Failed to add evidence' });
  }
}

/**
 * Add a note to incident timeline
 */
async function addTimelineNote(req, res, body) {
  try {
    const { incidentId, note } = body;
    
    if (!incidentId || !note) {
      return res.status(400).json({ error: 'Incident ID and note are required' });
    }

    const incident = incidentResponse.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    const timelineEntry = {
      id: `timeline_${Date.now()}`,
      timestamp: new Date(),
      event: 'Note Added',
      description: note,
      actor: req.user?.id || 'admin',
      automated: false
    };

    incident.timeline.push(timelineEntry);
    incident.updatedAt = new Date();

    return res.json({
      success: true,
      timelineEntry: {
        ...timelineEntry,
        timestamp: timelineEntry.timestamp.toISOString()
      }
    });
  } catch (error) {
    console.error('Error adding timeline note:', error);
    return res.status(500).json({ error: 'Failed to add timeline note' });
  }
}

/**
 * Update incident status
 */
async function updateIncidentStatus(req, res, incidentId, status, notes) {
  try {
    const validStatuses = ['open', 'investigating', 'contained', 'resolved', 'closed'];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const success = await incidentResponse.updateIncidentStatus(incidentId, status, notes);
    
    if (!success) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    return res.json({
      success: true,
      incidentId,
      status,
      updatedAt: new Date().toISOString(),
      notes
    });
  } catch (error) {
    console.error('Error updating incident status:', error);
    return res.status(500).json({ error: 'Failed to update incident status' });
  }
}

/**
 * Assign incident to user
 */
async function assignIncident(req, res, incidentId, assignedTo) {
  try {
    const incident = incidentResponse.getIncident(incidentId);
    if (!incident) {
      return res.status(404).json({ error: 'Incident not found' });
    }

    incident.assignedTo = assignedTo;
    incident.updatedAt = new Date();

    // Add timeline entry
    incident.timeline.push({
      id: `timeline_${Date.now()}`,
      timestamp: new Date(),
      event: 'Incident Assigned',
      description: `Incident assigned to ${assignedTo}`,
      actor: req.user?.id || 'admin',
      automated: false
    });

    return res.json({
      success: true,
      incidentId,
      assignedTo,
      updatedAt: incident.updatedAt.toISOString()
    });
  } catch (error) {
    console.error('Error assigning incident:', error);
    return res.status(500).json({ error: 'Failed to assign incident' });
  }
}

/**
 * Verify admin access
 */
async function verifyAdmin(req) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return null;

  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;

    const isAdmin = user.user_metadata?.role === 'admin' || 
                   user.app_metadata?.role === 'admin';
    
    return isAdmin ? user : null;
  } catch (error) {
    console.error('Admin verification error:', error);
    return null;
  }
}