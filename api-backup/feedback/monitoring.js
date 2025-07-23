/**
 * User Feedback Monitoring and Response System
 * Handles feedback collection, analysis, and automated response coordination
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Feedback monitoring configuration
const FEEDBACK_CONFIG = {
  RESPONSE_TIME_TARGET: 4 * 60 * 60 * 1000, // 4 hours
  ESCALATION_THRESHOLD: 24 * 60 * 60 * 1000, // 24 hours
  SENTIMENT_THRESHOLD: 0.3, // Below this is negative sentiment
  AUTO_RESPONSE_ENABLED: true,
  PRIORITY_KEYWORDS: ['bug', 'error', 'broken', 'not working', 'crash', 'security', 'payment', 'billing']
};

/**
 * Main feedback monitoring endpoint
 */
export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { action } = req.query;

    switch (action) {
      case 'submit':
        return await handleFeedbackSubmission(req, res);
      case 'monitor':
        return await handleFeedbackMonitoring(req, res);
      case 'respond':
        return await handleFeedbackResponse(req, res);
      case 'analytics':
        return await handleFeedbackAnalytics(req, res);
      case 'escalate':
        return await handleFeedbackEscalation(req, res);
      default:
        return await handleFeedbackMonitoring(req, res);
    }
  } catch (error) {
    console.error('Feedback monitoring error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Feedback monitoring system error',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Handle new feedback submission
 */
async function handleFeedbackSubmission(req, res) {
  try {
    const {
      user_id,
      feedback_type = 'general',
      title,
      message,
      rating = null,
      metadata = {}
    } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: 'Message is required'
      });
    }

    // Analyze feedback sentiment and priority
    const analysis = await analyzeFeedback(message, title);
    
    const feedback = {
      user_id: user_id || null,
      feedback_type,
      title: title || 'User Feedback',
      message,
      rating: rating ? parseInt(rating) : null,
      sentiment_score: analysis.sentiment,
      priority: analysis.priority,
      category: analysis.category,
      keywords: analysis.keywords,
      metadata: {
        ...metadata,
        user_agent: req.headers['user-agent'],
        ip_address: getClientIP(req),
        timestamp: new Date().toISOString()
      },
      status: 'new',
      created_at: new Date().toISOString()
    };

    // Store feedback in database
    const { data: savedFeedback, error } = await supabase
      .from('user_feedback')
      .insert([feedback])
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Send automated acknowledgment if enabled
    if (FEEDBACK_CONFIG.AUTO_RESPONSE_ENABLED) {
      await sendFeedbackAcknowledgment(savedFeedback);
    }

    // Escalate high-priority feedback immediately
    if (analysis.priority === 'high' || analysis.priority === 'critical') {
      await escalateFeedback(savedFeedback);
    }

    // Track feedback submission analytics
    await trackFeedbackMetrics(savedFeedback);

    return res.status(200).json({
      success: true,
      feedback_id: savedFeedback.id,
      message: 'Feedback submitted successfully',
      estimated_response_time: getEstimatedResponseTime(analysis.priority)
    });

  } catch (error) {
    console.error('Feedback submission error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to submit feedback'
    });
  }
}

/**
 * Monitor feedback queue and response times
 */
async function handleFeedbackMonitoring(req, res) {
  try {
    const { timeframe = '24h', status = 'all' } = req.query;
    const timeStart = getTimeframeStart(timeframe);

    // Build query
    let query = supabase
      .from('user_feedback')
      .select('*')
      .gte('created_at', timeStart)
      .order('created_at', { ascending: false });

    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: feedback } = await query;

    // Calculate monitoring metrics
    const metrics = calculateFeedbackMetrics(feedback || []);
    
    // Check for overdue responses
    const overdueItems = findOverdueFeedback(feedback || []);

    // Generate alerts for critical issues
    const alerts = generateFeedbackAlerts(feedback || [], metrics);

    return res.status(200).json({
      success: true,
      metrics,
      feedback: feedback || [],
      overdue_items: overdueItems,
      alerts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feedback monitoring error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to monitor feedback'
    });
  }
}

/**
 * Handle feedback response
 */
async function handleFeedbackResponse(req, res) {
  try {
    const {
      feedback_id,
      response_message,
      resolution_type = 'resolved',
      internal_notes = '',
      follow_up_required = false
    } = req.body;

    if (!feedback_id || !response_message) {
      return res.status(400).json({
        success: false,
        error: 'feedback_id and response_message are required'
      });
    }

    // Get original feedback
    const { data: originalFeedback, error: fetchError } = await supabase
      .from('user_feedback')
      .select('*')
      .eq('id', feedback_id)
      .single();

    if (fetchError || !originalFeedback) {
      return res.status(404).json({
        success: false,
        error: 'Feedback not found'
      });
    }

    // Create response record
    const response = {
      feedback_id,
      response_message,
      resolution_type,
      internal_notes,
      response_time: calculateResponseTime(originalFeedback.created_at),
      responder_id: req.user?.id || 'system',
      created_at: new Date().toISOString()
    };

    const { error: responseError } = await supabase
      .from('feedback_responses')
      .insert([response]);

    if (responseError) {
      throw responseError;
    }

    // Update feedback status
    const newStatus = follow_up_required ? 'pending_follow_up' : 'resolved';
    const { error: updateError } = await supabase
      .from('user_feedback')
      .update({
        status: newStatus,
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', feedback_id);

    if (updateError) {
      throw updateError;
    }

    // Send response to user if they provided contact info
    if (originalFeedback.user_id) {
      await sendFeedbackResponse(originalFeedback, response_message);
    }

    // Update response time metrics
    await updateResponseTimeMetrics(response.response_time);

    return res.status(200).json({
      success: true,
      message: 'Response sent successfully',
      response_time: response.response_time
    });

  } catch (error) {
    console.error('Feedback response error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to send response'
    });
  }
}

/**
 * Generate feedback analytics
 */
async function handleFeedbackAnalytics(req, res) {
  try {
    const { timeframe = '30d' } = req.query;
    const timeStart = getTimeframeStart(timeframe);

    // Get feedback data
    const { data: feedback } = await supabase
      .from('user_feedback')
      .select('*')
      .gte('created_at', timeStart);

    // Get response data
    const { data: responses } = await supabase
      .from('feedback_responses')
      .select('*')
      .gte('created_at', timeStart);

    const analytics = {
      overview: {
        total_feedback: feedback?.length || 0,
        total_responses: responses?.length || 0,
        response_rate: feedback?.length > 0 ? 
          ((responses?.length || 0) / feedback.length * 100).toFixed(2) + '%' : '0%',
        average_response_time: calculateAverageResponseTime(responses || [])
      },
      
      sentiment: analyzeFeedbackSentiment(feedback || []),
      
      categories: groupFeedbackByCategory(feedback || []),
      
      priorities: groupFeedbackByPriority(feedback || []),
      
      trends: calculateFeedbackTrends(feedback || []),
      
      satisfaction: calculateSatisfactionMetrics(feedback || []),
      
      keywords: extractTopKeywords(feedback || []),
      
      timeframe,
      timestamp: new Date().toISOString()
    };

    return res.status(200).json({
      success: true,
      analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Feedback analytics error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate analytics'
    });
  }
}

/**
 * Helper Functions
 */

async function analyzeFeedback(message, title = '') {
  const text = `${title} ${message}`.toLowerCase();
  
  // Sentiment analysis (simple keyword-based)
  const positiveWords = ['good', 'great', 'excellent', 'love', 'perfect', 'amazing', 'helpful'];
  const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'broken', 'useless', 'slow'];
  
  const positiveCount = positiveWords.filter(word => text.includes(word)).length;
  const negativeCount = negativeWords.filter(word => text.includes(word)).length;
  
  const sentiment = (positiveCount - negativeCount) / Math.max(positiveCount + negativeCount, 1);
  
  // Priority detection
  let priority = 'low';
  if (FEEDBACK_CONFIG.PRIORITY_KEYWORDS.some(keyword => text.includes(keyword))) {
    priority = 'high';
  } else if (sentiment < FEEDBACK_CONFIG.SENTIMENT_THRESHOLD) {
    priority = 'medium';
  }
  
  // Category detection
  let category = 'general';
  if (text.includes('bug') || text.includes('error')) category = 'bug_report';
  else if (text.includes('feature') || text.includes('suggestion')) category = 'feature_request';
  else if (text.includes('payment') || text.includes('billing')) category = 'billing';
  else if (text.includes('security') || text.includes('privacy')) category = 'security';
  
  // Extract keywords
  const keywords = FEEDBACK_CONFIG.PRIORITY_KEYWORDS.filter(keyword => text.includes(keyword));
  
  return {
    sentiment,
    priority,
    category,
    keywords
  };
}

function calculateFeedbackMetrics(feedback) {
  const now = Date.now();
  const newItems = feedback.filter(f => f.status === 'new').length;
  const inProgress = feedback.filter(f => f.status === 'in_progress').length;
  const resolved = feedback.filter(f => f.status === 'resolved').length;
  
  const averageRating = feedback.length > 0 ? 
    feedback.filter(f => f.rating).reduce((sum, f) => sum + f.rating, 0) / 
    feedback.filter(f => f.rating).length : 0;
  
  const overdue = feedback.filter(f => {
    const age = now - new Date(f.created_at).getTime();
    return f.status !== 'resolved' && age > FEEDBACK_CONFIG.RESPONSE_TIME_TARGET;
  }).length;
  
  return {
    total: feedback.length,
    new: newItems,
    in_progress: inProgress,
    resolved,
    overdue,
    average_rating: Math.round(averageRating * 10) / 10,
    resolution_rate: feedback.length > 0 ? (resolved / feedback.length * 100).toFixed(2) + '%' : '0%'
  };
}

function findOverdueFeedback(feedback) {
  const now = Date.now();
  return feedback.filter(f => {
    const age = now - new Date(f.created_at).getTime();
    return f.status !== 'resolved' && age > FEEDBACK_CONFIG.RESPONSE_TIME_TARGET;
  }).map(f => ({
    id: f.id,
    title: f.title,
    age_hours: Math.floor((now - new Date(f.created_at).getTime()) / (1000 * 60 * 60)),
    priority: f.priority
  }));
}

function generateFeedbackAlerts(feedback, metrics) {
  const alerts = [];
  
  // High overdue count
  if (metrics.overdue > 5) {
    alerts.push({
      type: 'overdue_responses',
      severity: 'high',
      message: `${metrics.overdue} feedback items are overdue for response`,
      action_required: 'Review and respond to overdue items'
    });
  }
  
  // Low satisfaction rating
  if (metrics.average_rating < 3.0 && metrics.average_rating > 0) {
    alerts.push({
      type: 'low_satisfaction',
      severity: 'medium',
      message: `Average rating is ${metrics.average_rating}/5.0`,
      action_required: 'Investigate common issues'
    });
  }
  
  // High volume of new feedback
  if (metrics.new > 20) {
    alerts.push({
      type: 'high_volume',
      severity: 'medium',
      message: `${metrics.new} new feedback items need attention`,
      action_required: 'Scale support team or prioritize responses'
    });
  }
  
  return alerts;
}

async function sendFeedbackAcknowledgment(feedback) {
  // In production, integrate with email service
  console.log(`Sending acknowledgment for feedback ${feedback.id}`);
  
  // Example email template
  const emailTemplate = {
    to: feedback.user_id,
    subject: 'Thank you for your feedback',
    body: `
      Hi there,

      Thank you for taking the time to share your feedback with us. We've received your message about "${feedback.title}" and appreciate you letting us know.

      We aim to respond to all feedback within ${getEstimatedResponseTime(feedback.priority)}.

      Your feedback helps us improve our service for everyone.

      Best regards,
      The PDF-to-Text Team
    `
  };
  
  // Would integrate with actual email service here
  return emailTemplate;
}

function getEstimatedResponseTime(priority) {
  switch (priority) {
    case 'critical':
      return '2 hours';
    case 'high':
      return '4 hours';
    case 'medium':
      return '24 hours';
    default:
      return '48 hours';
  }
}

function calculateResponseTime(createdAt) {
  const now = Date.now();
  const created = new Date(createdAt).getTime();
  return Math.floor((now - created) / (1000 * 60 * 60)); // Hours
}

function getTimeframeStart(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  }
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
}

function groupFeedbackByCategory(feedback) {
  return feedback.reduce((acc, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});
}

function groupFeedbackByPriority(feedback) {
  return feedback.reduce((acc, f) => {
    acc[f.priority] = (acc[f.priority] || 0) + 1;
    return acc;
  }, {});
}

function analyzeFeedbackSentiment(feedback) {
  const sentiments = feedback.map(f => f.sentiment_score).filter(s => s !== null);
  const avgSentiment = sentiments.length > 0 ? 
    sentiments.reduce((sum, s) => sum + s, 0) / sentiments.length : 0;
  
  const positive = sentiments.filter(s => s > 0.3).length;
  const neutral = sentiments.filter(s => s >= -0.3 && s <= 0.3).length;
  const negative = sentiments.filter(s => s < -0.3).length;
  
  return {
    average: Math.round(avgSentiment * 100) / 100,
    distribution: {
      positive,
      neutral,
      negative
    }
  };
}