/**
 * Analytics and Conversion Tracking API
 * Tracks user behavior, conversions, and business metrics
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Analytics configuration
const ANALYTICS_CONFIG = {
  SESSION_TIMEOUT: 30 * 60 * 1000, // 30 minutes
  BATCH_SIZE: 100,
  FLUSH_INTERVAL: 60000, // 1 minute
  RETENTION_DAYS: 90
};

// In-memory analytics buffer
let analyticsBuffer = [];
let conversionBuffer = [];

/**
 * Main analytics endpoint
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
      case 'track':
        return await handleEventTracking(req, res);
      case 'conversion':
        return await handleConversionTracking(req, res);
      case 'session':
        return await handleSessionTracking(req, res);
      case 'metrics':
        return await handleMetricsRetrieval(req, res);
      case 'funnel':
        return await handleFunnelAnalysis(req, res);
      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid action specified'
        });
    }
  } catch (error) {
    console.error('Analytics tracking error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Analytics tracking failed',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Track user events and behaviors
 */
async function handleEventTracking(req, res) {
  try {
    const {
      event_type,
      user_id,
      session_id,
      properties = {},
      timestamp = new Date().toISOString()
    } = req.body;

    if (!event_type) {
      return res.status(400).json({
        success: false,
        error: 'event_type is required'
      });
    }

    const event = {
      event_type,
      user_id: user_id || null,
      session_id: session_id || generateSessionId(),
      properties: {
        ...properties,
        user_agent: req.headers['user-agent'],
        ip_address: getClientIP(req),
        referrer: req.headers.referer || null,
        timestamp
      },
      created_at: timestamp
    };

    // Add to buffer for batch processing
    analyticsBuffer.push(event);

    // Flush buffer if it's getting full
    if (analyticsBuffer.length >= ANALYTICS_CONFIG.BATCH_SIZE) {
      await flushAnalyticsBuffer();
    }

    // Track specific event types for real-time processing
    await processRealTimeEvent(event);

    return res.status(200).json({
      success: true,
      event_id: generateEventId(),
      message: 'Event tracked successfully'
    });

  } catch (error) {
    console.error('Event tracking error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track event'
    });
  }
}

/**
 * Track conversion events
 */
async function handleConversionTracking(req, res) {
  try {
    const {
      conversion_type,
      user_id,
      session_id,
      value = 0,
      currency = 'USD',
      properties = {}
    } = req.body;

    if (!conversion_type || !user_id) {
      return res.status(400).json({
        success: false,
        error: 'conversion_type and user_id are required'
      });
    }

    const conversion = {
      conversion_type,
      user_id,
      session_id,
      value: parseFloat(value),
      currency,
      properties: {
        ...properties,
        timestamp: new Date().toISOString(),
        source: req.headers.referer || 'direct'
      },
      created_at: new Date().toISOString()
    };

    // Store conversion immediately (important for revenue tracking)
    const { error } = await supabase
      .from('conversions')
      .insert([conversion]);

    if (error) {
      throw error;
    }

    // Update user metrics
    await updateUserConversionMetrics(user_id, conversion);

    // Track in real-time dashboard
    await updateRealTimeMetrics('conversion', conversion);

    return res.status(200).json({
      success: true,
      conversion_id: generateConversionId(),
      message: 'Conversion tracked successfully'
    });

  } catch (error) {
    console.error('Conversion tracking error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track conversion'
    });
  }
}

/**
 * Track user sessions
 */
async function handleSessionTracking(req, res) {
  try {
    const {
      session_id,
      user_id,
      action = 'start', // start, update, end
      properties = {}
    } = req.body;

    const sessionData = {
      session_id: session_id || generateSessionId(),
      user_id: user_id || null,
      action,
      properties: {
        ...properties,
        user_agent: req.headers['user-agent'],
        ip_address: getClientIP(req),
        timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };

    // Store session data
    const { error } = await supabase
      .from('user_sessions')
      .upsert([sessionData], { onConflict: 'session_id' });

    if (error) {
      throw error;
    }

    // Update active user metrics
    if (action === 'start') {
      await updateActiveUserMetrics(user_id, sessionData);
    }

    return res.status(200).json({
      success: true,
      session_id: sessionData.session_id,
      message: 'Session tracked successfully'
    });

  } catch (error) {
    console.error('Session tracking error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to track session'
    });
  }
}

/**
 * Retrieve analytics metrics
 */
async function handleMetricsRetrieval(req, res) {
  try {
    const {
      timeframe = '24h',
      metric_type = 'overview',
      user_id = null
    } = req.query;

    const timeStart = getTimeframeStart(timeframe);
    
    let metrics = {};

    switch (metric_type) {
      case 'overview':
        metrics = await getOverviewMetrics(timeStart, user_id);
        break;
      case 'conversions':
        metrics = await getConversionMetrics(timeStart, user_id);
        break;
      case 'users':
        metrics = await getUserMetrics(timeStart);
        break;
      case 'sessions':
        metrics = await getSessionMetrics(timeStart);
        break;
      case 'revenue':
        metrics = await getRevenueMetrics(timeStart);
        break;
      default:
        metrics = await getOverviewMetrics(timeStart, user_id);
    }

    return res.status(200).json({
      success: true,
      metrics,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Metrics retrieval error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve metrics'
    });
  }
}

/**
 * Analyze conversion funnels
 */
async function handleFunnelAnalysis(req, res) {
  try {
    const { funnel_type = 'signup', timeframe = '7d' } = req.query;
    const timeStart = getTimeframeStart(timeframe);

    let funnelSteps = [];
    
    switch (funnel_type) {
      case 'signup':
        funnelSteps = await getSignupFunnel(timeStart);
        break;
      case 'conversion':
        funnelSteps = await getConversionFunnel(timeStart);
        break;
      case 'subscription':
        funnelSteps = await getSubscriptionFunnel(timeStart);
        break;
      default:
        funnelSteps = await getSignupFunnel(timeStart);
    }

    // Calculate conversion rates between steps
    const funnelAnalysis = calculateFunnelRates(funnelSteps);

    return res.status(200).json({
      success: true,
      funnel_type,
      steps: funnelAnalysis,
      timeframe,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Funnel analysis error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze funnel'
    });
  }
}

/**
 * Helper Functions
 */

async function flushAnalyticsBuffer() {
  if (analyticsBuffer.length === 0) return;

  try {
    const { error } = await supabase
      .from('user_events')
      .insert(analyticsBuffer);

    if (error) {
      console.error('Failed to flush analytics buffer:', error);
      return;
    }

    analyticsBuffer = [];
  } catch (error) {
    console.error('Analytics buffer flush error:', error);
  }
}

async function processRealTimeEvent(event) {
  // Process specific events for real-time updates
  switch (event.event_type) {
    case 'page_view':
      await updatePageViewMetrics(event);
      break;
    case 'file_upload':
      await updateFileUploadMetrics(event);
      break;
    case 'subscription_created':
      await updateSubscriptionMetrics(event);
      break;
    case 'payment_completed':
      await updateRevenueMetrics(event);
      break;
  }
}

async function getOverviewMetrics(timeStart, userId = null) {
  const baseQuery = supabase
    .from('user_events')
    .select('*')
    .gte('created_at', timeStart);

  if (userId) {
    baseQuery.eq('user_id', userId);
  }

  const { data: events } = await baseQuery;

  // Calculate key metrics
  const uniqueUsers = new Set(events?.map(e => e.user_id).filter(Boolean)).size;
  const totalEvents = events?.length || 0;
  const pageViews = events?.filter(e => e.event_type === 'page_view').length || 0;
  const fileUploads = events?.filter(e => e.event_type === 'file_upload').length || 0;

  return {
    unique_users: uniqueUsers,
    total_events: totalEvents,
    page_views: pageViews,
    file_uploads: fileUploads,
    events_by_type: groupEventsByType(events || []),
    hourly_distribution: groupEventsByHour(events || [])
  };
}

async function getConversionMetrics(timeStart, userId = null) {
  const baseQuery = supabase
    .from('conversions')
    .select('*')
    .gte('created_at', timeStart);

  if (userId) {
    baseQuery.eq('user_id', userId);
  }

  const { data: conversions } = await baseQuery;

  const totalConversions = conversions?.length || 0;
  const totalRevenue = conversions?.reduce((sum, c) => sum + c.value, 0) || 0;
  const conversionsByType = groupConversionsByType(conversions || []);

  return {
    total_conversions: totalConversions,
    total_revenue: totalRevenue,
    average_order_value: totalConversions > 0 ? totalRevenue / totalConversions : 0,
    conversions_by_type: conversionsByType,
    daily_revenue: groupConversionsByDay(conversions || [])
  };
}

async function getSignupFunnel(timeStart) {
  // Define funnel steps
  const steps = [
    { name: 'Landing Page Visit', event_type: 'page_view', filter: { page: '/' } },
    { name: 'Signup Page Visit', event_type: 'page_view', filter: { page: '/register' } },
    { name: 'Signup Form Started', event_type: 'form_started', filter: { form: 'signup' } },
    { name: 'Signup Completed', event_type: 'user_registered' },
    { name: 'Email Verified', event_type: 'email_verified' },
    { name: 'First File Upload', event_type: 'file_upload' }
  ];

  const funnelData = [];

  for (const step of steps) {
    const { data: events } = await supabase
      .from('user_events')
      .select('user_id')
      .eq('event_type', step.event_type)
      .gte('created_at', timeStart);

    funnelData.push({
      step: step.name,
      users: new Set(events?.map(e => e.user_id).filter(Boolean)).size,
      events: events?.length || 0
    });
  }

  return funnelData;
}

function calculateFunnelRates(steps) {
  return steps.map((step, index) => {
    const previousStep = steps[index - 1];
    const conversionRate = previousStep ? 
      (step.users / previousStep.users * 100).toFixed(2) : 100;

    return {
      ...step,
      conversion_rate: parseFloat(conversionRate),
      drop_off_rate: previousStep ? 
        ((previousStep.users - step.users) / previousStep.users * 100).toFixed(2) : 0
    };
  });
}

function groupEventsByType(events) {
  return events.reduce((acc, event) => {
    acc[event.event_type] = (acc[event.event_type] || 0) + 1;
    return acc;
  }, {});
}

function groupEventsByHour(events) {
  return events.reduce((acc, event) => {
    const hour = new Date(event.created_at).getHours();
    acc[hour] = (acc[hour] || 0) + 1;
    return acc;
  }, {});
}

function groupConversionsByType(conversions) {
  return conversions.reduce((acc, conversion) => {
    acc[conversion.conversion_type] = {
      count: (acc[conversion.conversion_type]?.count || 0) + 1,
      revenue: (acc[conversion.conversion_type]?.revenue || 0) + conversion.value
    };
    return acc;
  }, {});
}

function getTimeframeStart(timeframe) {
  const now = new Date();
  switch (timeframe) {
    case '1h':
      return new Date(now.getTime() - 60 * 60 * 1000).toISOString();
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

function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateEventId() {
  return `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function generateConversionId() {
  return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.headers['x-real-ip'] || 
         req.connection?.remoteAddress || 
         'unknown';
}

// Periodic buffer flush
setInterval(flushAnalyticsBuffer, ANALYTICS_CONFIG.FLUSH_INTERVAL);