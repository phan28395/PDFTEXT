// Cost summary API endpoint
// Provides cost summaries and budget information for users

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get user from authentication
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }

    const { userId, days = 30 } = req.query;

    // Ensure user can only access their own data (unless admin)
    const isAdmin = user.user_metadata?.role === 'admin';
    if (!isAdmin && userId !== user.id) {
      return res.status(403).json({ error: 'Cannot access other users\' cost data' });
    }

    const targetUserId = userId || user.id;
    const targetDays = Math.min(parseInt(days), 365); // Max 1 year

    // Get cost summary from database
    const { data: costSummary, error: costError } = await supabase
      .rpc('get_user_cost_summary', {
        user_uuid: targetUserId,
        days: targetDays
      });

    if (costError) {
      console.error('Error getting cost summary:', costError);
      return res.status(500).json({ error: 'Failed to get cost summary' });
    }

    const summary = costSummary[0] || {
      total_cost: 0,
      document_ai_cost: 0,
      total_pages_processed: 0,
      avg_cost_per_page: 0,
      daily_costs: []
    };

    // Get budget status
    const budgetStatus = await getBudgetStatus(targetUserId);

    // Get recent alerts
    const recentAlerts = await getRecentAlerts(targetUserId);

    // Calculate trends
    const trends = await calculateCostTrends(targetUserId, targetDays);

    // Generate recommendations
    const recommendations = generateRecommendations(summary, budgetStatus, trends);

    return res.status(200).json({
      success: true,
      summary: {
        totalCost: parseFloat(summary.total_cost || 0),
        documentAICost: parseFloat(summary.document_ai_cost || 0),
        totalPagesProcessed: parseInt(summary.total_pages_processed || 0),
        avgCostPerPage: parseFloat(summary.avg_cost_per_page || 0),
        dailyCosts: summary.daily_costs || [],
        budgetStatus,
        trends,
        recommendations
      },
      alerts: recentAlerts
    });

  } catch (error) {
    console.error('Error in cost summary:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Get budget status for all periods
async function getBudgetStatus(userId) {
  try {
    const budgetLimits = {
      daily: 10.0,
      weekly: 50.0,
      monthly: 200.0
    };

    const [dailyCosts, weeklyCosts, monthlyCosts] = await Promise.all([
      getCostForPeriod(userId, 1),
      getCostForPeriod(userId, 7),
      getCostForPeriod(userId, 30)
    ]);

    return {
      daily: {
        used: dailyCosts,
        limit: budgetLimits.daily,
        percentage: (dailyCosts / budgetLimits.daily) * 100
      },
      weekly: {
        used: weeklyCosts,
        limit: budgetLimits.weekly,
        percentage: (weeklyCosts / budgetLimits.weekly) * 100
      },
      monthly: {
        used: monthlyCosts,
        limit: budgetLimits.monthly,
        percentage: (monthlyCosts / budgetLimits.monthly) * 100
      }
    };

  } catch (error) {
    console.error('Error getting budget status:', error);
    return {
      daily: { used: 0, limit: 10, percentage: 0 },
      weekly: { used: 0, limit: 50, percentage: 0 },
      monthly: { used: 0, limit: 200, percentage: 0 }
    };
  }
}

// Get cost for a specific period
async function getCostForPeriod(userId, days) {
  try {
    const { data, error } = await supabase
      .from('api_cost_tracking')
      .select('cost_amount')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

    if (error) {
      console.error('Error getting cost for period:', error);
      return 0;
    }

    return data.reduce((total, row) => total + parseFloat(row.cost_amount), 0);

  } catch (error) {
    console.error('Error in getCostForPeriod:', error);
    return 0;
  }
}

// Get recent budget alerts
async function getRecentAlerts(userId) {
  try {
    const { data, error } = await supabase
      .from('cost_alerts')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error getting recent alerts:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Error in getRecentAlerts:', error);
    return [];
  }
}

// Calculate cost trends
async function calculateCostTrends(userId, days) {
  try {
    const { data, error } = await supabase
      .from('api_cost_tracking')
      .select('cost_amount, created_at, service')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error || !data || data.length === 0) {
      return {
        totalChange: 0,
        weeklyChange: 0,
        documentAITrend: 'stable',
        peakUsageDays: [],
        costEfficiency: 0
      };
    }

    // Calculate weekly trends
    const now = Date.now();
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = now - (14 * 24 * 60 * 60 * 1000);

    const thisWeekCosts = data.filter(row => 
      new Date(row.created_at).getTime() > oneWeekAgo
    ).reduce((sum, row) => sum + parseFloat(row.cost_amount), 0);

    const lastWeekCosts = data.filter(row => {
      const timestamp = new Date(row.created_at).getTime();
      return timestamp > twoWeeksAgo && timestamp <= oneWeekAgo;
    }).reduce((sum, row) => sum + parseFloat(row.cost_amount), 0);

    const weeklyChange = lastWeekCosts > 0 ? ((thisWeekCosts - lastWeekCosts) / lastWeekCosts) * 100 : 0;

    // Calculate Document AI trend
    const documentAICosts = data.filter(row => row.service === 'document-ai');
    const documentAITrend = documentAICosts.length > 1 ? 
      (documentAICosts[documentAICosts.length - 1].cost_amount > documentAICosts[0].cost_amount ? 'increasing' : 'decreasing') 
      : 'stable';

    // Find peak usage days
    const dailyCosts = {};
    data.forEach(row => {
      const date = new Date(row.created_at).toISOString().split('T')[0];
      dailyCosts[date] = (dailyCosts[date] || 0) + parseFloat(row.cost_amount);
    });

    const peakUsageDays = Object.entries(dailyCosts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .map(([date, cost]) => ({ date, cost }));

    return {
      totalChange: weeklyChange,
      weeklyChange,
      documentAITrend,
      peakUsageDays,
      costEfficiency: thisWeekCosts > 0 ? (lastWeekCosts / thisWeekCosts) : 1
    };

  } catch (error) {
    console.error('Error calculating cost trends:', error);
    return {
      totalChange: 0,
      weeklyChange: 0,
      documentAITrend: 'stable',
      peakUsageDays: [],
      costEfficiency: 0
    };
  }
}

// Generate cost recommendations
function generateRecommendations(summary, budgetStatus, trends) {
  const recommendations = [];

  // High monthly usage
  if (budgetStatus.monthly.percentage > 75) {
    recommendations.push({
      type: 'budget',
      priority: 'high',
      message: 'You\'re approaching your monthly budget limit. Consider batch processing to reduce costs.',
      action: 'Switch to batch processing for remaining documents'
    });
  }

  // High cost per page
  if (summary.avgCostPerPage > 0.02) {
    recommendations.push({
      type: 'efficiency',
      priority: 'medium',
      message: 'Your cost per page is above average. Batch processing can reduce costs by 50%.',
      action: 'Use batch processing for multiple documents'
    });
  }

  // Increasing trend
  if (trends.weeklyChange > 50) {
    recommendations.push({
      type: 'trend',
      priority: 'medium',
      message: 'Your costs have increased significantly this week. Review your usage patterns.',
      action: 'Analyze recent processing to identify cost drivers'
    });
  }

  // Low usage
  if (summary.totalPagesProcessed < 10) {
    recommendations.push({
      type: 'usage',
      priority: 'low',
      message: 'You have plenty of budget remaining. Consider processing more documents.',
      action: 'Upload more PDFs to maximize your subscription value'
    });
  }

  // Cost efficiency
  if (trends.costEfficiency < 0.8) {
    recommendations.push({
      type: 'efficiency',
      priority: 'medium',
      message: 'Your processing efficiency has decreased. Check for failed operations.',
      action: 'Review processing history for errors and retries'
    });
  }

  return recommendations;
}