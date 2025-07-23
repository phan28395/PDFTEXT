// Cost tracking API endpoint
// Handles cost tracking for Document AI and other services

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    const {
      user_id,
      service,
      operation,
      cost_amount,
      units_consumed,
      unit_type,
      processing_record_id,
      metadata
    } = req.body;

    // Validate required fields
    if (!user_id || !service || !operation || cost_amount === undefined || !units_consumed || !unit_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Ensure user can only track costs for themselves (unless admin)
    const isAdmin = user.user_metadata?.role === 'admin';
    if (!isAdmin && user_id !== user.id) {
      return res.status(403).json({ error: 'Cannot track costs for other users' });
    }

    // Track cost in database using the function
    const { data: costId, error: costError } = await supabase
      .rpc('track_api_cost', {
        p_user_id: user_id,
        p_service: service,
        p_operation: operation,
        p_cost_amount: parseFloat(cost_amount),
        p_units_consumed: parseInt(units_consumed),
        p_unit_type: unit_type,
        p_processing_record_id: processing_record_id || null,
        p_metadata: metadata || null
      });

    if (costError) {
      console.error('Error tracking cost:', costError);
      return res.status(500).json({ error: 'Failed to track cost' });
    }

    // Check for budget alerts
    const alerts = await checkBudgetAlerts(user_id);
    
    // Update user's cost statistics
    await updateUserCostStats(user_id);

    return res.status(200).json({ 
      success: true, 
      costId,
      alerts: alerts.length > 0 ? alerts : undefined
    });

  } catch (error) {
    console.error('Error in cost tracking:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Check for budget alerts
async function checkBudgetAlerts(userId) {
  try {
    const alerts = [];
    const now = new Date();
    
    // Get user's cost data for different periods
    const [dailyCosts, weeklyCosts, monthlyCosts] = await Promise.all([
      getCostSummaryForPeriod(userId, 1), // Last 24 hours
      getCostSummaryForPeriod(userId, 7), // Last 7 days
      getCostSummaryForPeriod(userId, 30) // Last 30 days
    ]);

    // Default budget limits (could be user-configurable)
    const budgetLimits = {
      daily: 10.0,    // $10 per day
      weekly: 50.0,   // $50 per week
      monthly: 200.0  // $200 per month
    };

    // Check daily budget
    if (dailyCosts.total_cost > 0) {
      const dailyPercentage = (dailyCosts.total_cost / budgetLimits.daily) * 100;
      
      if (dailyPercentage >= 100) {
        alerts.push({
          type: 'budget_exceeded',
          period: 'daily',
          threshold: budgetLimits.daily,
          current: dailyCosts.total_cost,
          percentage: dailyPercentage,
          severity: 'critical'
        });
      } else if (dailyPercentage >= 80) {
        alerts.push({
          type: 'budget_warning',
          period: 'daily',
          threshold: budgetLimits.daily,
          current: dailyCosts.total_cost,
          percentage: dailyPercentage,
          severity: 'warning'
        });
      }
    }

    // Check weekly budget
    if (weeklyCosts.total_cost > 0) {
      const weeklyPercentage = (weeklyCosts.total_cost / budgetLimits.weekly) * 100;
      
      if (weeklyPercentage >= 100) {
        alerts.push({
          type: 'budget_exceeded',
          period: 'weekly',
          threshold: budgetLimits.weekly,
          current: weeklyCosts.total_cost,
          percentage: weeklyPercentage,
          severity: 'critical'
        });
      } else if (weeklyPercentage >= 80) {
        alerts.push({
          type: 'budget_warning',
          period: 'weekly',
          threshold: budgetLimits.weekly,
          current: weeklyCosts.total_cost,
          percentage: weeklyPercentage,
          severity: 'warning'
        });
      }
    }

    // Check monthly budget
    if (monthlyCosts.total_cost > 0) {
      const monthlyPercentage = (monthlyCosts.total_cost / budgetLimits.monthly) * 100;
      
      if (monthlyPercentage >= 100) {
        alerts.push({
          type: 'budget_exceeded',
          period: 'monthly',
          threshold: budgetLimits.monthly,
          current: monthlyCosts.total_cost,
          percentage: monthlyPercentage,
          severity: 'critical'
        });
      } else if (monthlyPercentage >= 80) {
        alerts.push({
          type: 'budget_warning',
          period: 'monthly',
          threshold: budgetLimits.monthly,
          current: monthlyCosts.total_cost,
          percentage: monthlyPercentage,
          severity: 'warning'
        });
      }
    }

    // Store alerts in database if any
    if (alerts.length > 0) {
      for (const alert of alerts) {
        await supabase
          .from('cost_alerts')
          .insert({
            user_id: userId,
            alert_type: alert.type,
            period: alert.period,
            threshold: alert.threshold,
            current_amount: alert.current,
            percentage: alert.percentage,
            severity: alert.severity,
            created_at: now.toISOString()
          });
      }
    }

    return alerts;

  } catch (error) {
    console.error('Error checking budget alerts:', error);
    return [];
  }
}

// Get cost summary for a specific period
async function getCostSummaryForPeriod(userId, days) {
  try {
    const { data, error } = await supabase
      .rpc('get_user_cost_summary', {
        user_uuid: userId,
        days: days
      });

    if (error) {
      console.error('Error getting cost summary:', error);
      return { total_cost: 0, document_ai_cost: 0, total_pages_processed: 0 };
    }

    return data[0] || { total_cost: 0, document_ai_cost: 0, total_pages_processed: 0 };

  } catch (error) {
    console.error('Error in getCostSummaryForPeriod:', error);
    return { total_cost: 0, document_ai_cost: 0, total_pages_processed: 0 };
  }
}

// Update user's cost statistics
async function updateUserCostStats(userId) {
  try {
    // Get total costs for the user
    const { data: costSummary } = await supabase
      .rpc('get_user_cost_summary', {
        user_uuid: userId,
        days: 30
      });

    if (costSummary && costSummary[0]) {
      // Update user's cost statistics in their profile
      await supabase
        .from('users')
        .update({
          total_api_costs: costSummary[0].total_cost,
          document_ai_costs: costSummary[0].document_ai_cost,
          total_pages_processed: costSummary[0].total_pages_processed,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);
    }

  } catch (error) {
    console.error('Error updating user cost stats:', error);
  }
}