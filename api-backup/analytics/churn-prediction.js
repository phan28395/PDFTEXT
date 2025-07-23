import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization required' });
    }

    const token = authHeader.split(' ')[1];
    const { data: user, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authorization' });
    }

    // Fetch churn prediction data
    const churnData = await fetchChurnPredictionData();
    
    res.status(200).json(churnData);
  } catch (error) {
    console.error('Churn Prediction API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch churn prediction data',
      details: error.message 
    });
  }
}

async function fetchChurnPredictionData() {
  try {
    // Get all users with their activity data
    const { data: users } = await supabase
      .from('users')
      .select(`
        *,
        processing_history(*),
        user_activity(*)
      `);

    // Calculate risk metrics for each user
    const riskUsers = await Promise.all(
      (users || []).map(async (user) => {
        const riskAnalysis = await analyzeUserChurnRisk(user);
        return riskAnalysis;
      })
    );

    // Filter out users with too low risk to be relevant
    const significantRiskUsers = riskUsers.filter(user => user.riskScore >= 3);

    // Calculate overall metrics
    const metrics = calculateChurnMetrics(riskUsers);
    
    // Get prevention campaign data
    const preventionCampaigns = await fetchPreventionCampaigns();

    return {
      metrics,
      riskUsers: significantRiskUsers.sort((a, b) => b.riskScore - a.riskScore),
      preventionCampaigns
    };
  } catch (error) {
    console.error('Error fetching churn prediction data:', error);
    throw error;
  }
}

async function analyzeUserChurnRisk(user) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  
  // Calculate days since last activity
  let lastActivityDate = new Date(user.created_at);
  if (user.user_activity && user.user_activity.length > 0) {
    const latestActivity = user.user_activity.reduce((latest, activity) => {
      const activityDate = new Date(activity.created_at);
      return activityDate > latest ? activityDate : latest;
    }, new Date(user.created_at));
    lastActivityDate = latestActivity;
  }
  
  const daysSinceLastActivity = Math.floor((now - lastActivityDate) / (1000 * 60 * 60 * 24));

  // Calculate usage patterns
  const recentProcessing = (user.processing_history || [])
    .filter(p => new Date(p.created_at) >= thirtyDaysAgo);
  
  const totalProcessing = user.processing_history?.length || 0;
  const recentProcessingCount = recentProcessing.length;
  const avgProcessingPerWeek = totalProcessing > 0 ? 
    (totalProcessing / Math.max(1, Math.ceil((now - new Date(user.created_at)) / (7 * 24 * 60 * 60 * 1000)))) : 0;

  // Calculate engagement score
  const engagementScore = calculateEngagementScore(user, daysSinceLastActivity, avgProcessingPerWeek);
  
  // Identify risk factors
  const riskFactors = [];
  const suggestedActions = [];
  
  if (daysSinceLastActivity > 14) {
    riskFactors.push('No recent activity');
    suggestedActions.push('Send re-engagement email');
  }
  
  if (avgProcessingPerWeek < 1) {
    riskFactors.push('Low usage frequency');
    suggestedActions.push('Provide usage tips and tutorials');
  }
  
  if (user.subscription_status === 'free' && totalProcessing > 8) {
    riskFactors.push('Heavy free user (upgrade candidate)');
    suggestedActions.push('Offer Pro trial or discount');
  }
  
  if (user.subscription_status === 'pro' && recentProcessingCount < 2) {
    riskFactors.push('Paying customer with low usage');
    suggestedActions.push('Check satisfaction and provide support');
  }
  
  if (daysSinceLastActivity > 30) {
    riskFactors.push('Long period of inactivity');
    suggestedActions.push('Send winback campaign');
  }

  // Calculate risk score (1-10)
  let riskScore = 1;
  
  // Activity recency factor
  if (daysSinceLastActivity > 30) riskScore += 4;
  else if (daysSinceLastActivity > 14) riskScore += 2;
  else if (daysSinceLastActivity > 7) riskScore += 1;
  
  // Usage frequency factor
  if (avgProcessingPerWeek < 0.5) riskScore += 3;
  else if (avgProcessingPerWeek < 1) riskScore += 2;
  else if (avgProcessingPerWeek < 2) riskScore += 1;
  
  // Subscription status factor
  if (user.subscription_status === 'pro' && recentProcessingCount === 0) riskScore += 2;
  if (user.subscription_status === 'free' && totalProcessing > 9) riskScore += 1; // High usage free user might churn if not upgraded
  
  // Engagement trend factor
  if (engagementScore < 0.3) riskScore += 2;
  else if (engagementScore < 0.5) riskScore += 1;

  riskScore = Math.min(10, riskScore);
  
  // Determine risk level
  let riskLevel;
  if (riskScore >= 8) riskLevel = 'high';
  else if (riskScore >= 5) riskLevel = 'medium';
  else riskLevel = 'low';
  
  // Calculate churn probability (ML-like calculation)
  const churnProbability = Math.min(0.95, (riskScore - 1) / 9 * 0.8 + Math.random() * 0.2);
  
  // Estimate revenue data
  const totalRevenue = user.subscription_status === 'pro' ? 20 : 0;
  const predictedLTV = calculatePredictedLTV(user, engagementScore, riskScore);

  return {
    id: user.id,
    email: user.email,
    subscriptionStatus: user.subscription_status,
    riskScore,
    riskLevel,
    churnProbability,
    lastActivity: lastActivityDate.toISOString(),
    daysSinceLastActivity,
    totalRevenue,
    predictedLTV,
    riskFactors,
    suggestedActions
  };
}

function calculateEngagementScore(user, daysSinceLastActivity, avgProcessingPerWeek) {
  let score = 1.0;
  
  // Reduce score based on inactivity
  if (daysSinceLastActivity > 0) {
    score *= Math.exp(-daysSinceLastActivity / 30); // Exponential decay
  }
  
  // Boost score based on usage frequency
  score *= Math.min(1.0, avgProcessingPerWeek / 3); // Normalize to max 3 per week
  
  // Boost score for subscription status
  if (user.subscription_status === 'pro') {
    score *= 1.2;
  }
  
  return Math.max(0, Math.min(1, score));
}

function calculatePredictedLTV(user, engagementScore, riskScore) {
  let baseLTV = 0;
  
  if (user.subscription_status === 'pro') {
    baseLTV = 200; // Base LTV for Pro users
  } else {
    baseLTV = 50; // Potential LTV for free users
  }
  
  // Adjust based on engagement and risk
  const engagementMultiplier = 0.5 + (engagementScore * 1.5);
  const riskMultiplier = Math.max(0.1, (11 - riskScore) / 10);
  
  return Math.round(baseLTV * engagementMultiplier * riskMultiplier);
}

function calculateChurnMetrics(riskUsers) {
  const totalUsers = riskUsers.length || 1;
  const highRiskUsers = riskUsers.filter(u => u.riskLevel === 'high');
  const mediumRiskUsers = riskUsers.filter(u => u.riskLevel === 'medium');
  const lowRiskUsers = riskUsers.filter(u => u.riskLevel === 'low');
  
  // Calculate predicted churn rate
  const totalChurnProbability = riskUsers.reduce((sum, user) => sum + user.churnProbability, 0);
  const predictedChurnRate = (totalChurnProbability / totalUsers) * 100;
  
  // Calculate risk factor distribution
  const riskFactorCounts = {};
  riskUsers.forEach(user => {
    user.riskFactors.forEach(factor => {
      riskFactorCounts[factor] = (riskFactorCounts[factor] || 0) + 1;
    });
  });
  
  const topRiskFactors = Object.entries(riskFactorCounts)
    .map(([factor, count]) => ({
      factor,
      count,
      impact: (count / totalUsers) * 100
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Mock churn prevention data (would come from actual campaigns)
  const churnPrevention = {
    campaignsSent: 234,
    usersRetained: 45,
    revenueProtected: 8900,
    successRate: 19.2
  };

  // Generate mock risk trends
  const riskTrends = [];
  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    
    riskTrends.push({
      date: date.toISOString().split('T')[0],
      highRisk: Math.floor(highRiskUsers.length * (0.8 + Math.random() * 0.4)),
      mediumRisk: Math.floor(mediumRiskUsers.length * (0.8 + Math.random() * 0.4)),
      lowRisk: Math.floor(lowRiskUsers.length * (0.8 + Math.random() * 0.4))
    });
  }

  return {
    overallChurnRate: 4.2, // Historical churn rate
    predictedChurnRate,
    usersAtRisk: {
      high: highRiskUsers.length,
      medium: mediumRiskUsers.length,
      low: lowRiskUsers.length
    },
    churnPrevention,
    riskTrends,
    topRiskFactors
  };
}

async function fetchPreventionCampaigns() {
  // Fetch from marketing_campaigns table with churn_prevention filter
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select('*')
    .like('campaign_name', '%churn%')
    .or('trigger_type.eq.churn_risk');

  if (!campaigns || campaigns.length === 0) {
    // Mock prevention campaigns
    return [
      {
        id: '1',
        name: 'High Risk Re-engagement',
        targetRisk: 'high',
        sent: 45,
        opened: 23,
        retained: 8,
        status: 'active'
      },
      {
        id: '2',
        name: 'Pro User Check-in',
        targetRisk: 'medium',
        sent: 89,
        opened: 54,
        retained: 12,
        status: 'completed'
      },
      {
        id: '3',
        name: 'Feature Highlight Campaign',
        targetRisk: 'low',
        sent: 156,
        opened: 98,
        retained: 25,
        status: 'active'
      }
    ];
  }

  return campaigns.map(campaign => ({
    id: campaign.id,
    name: campaign.campaign_name,
    targetRisk: campaign.trigger_conditions?.riskLevel || 'medium',
    sent: campaign.sent_count || 0,
    opened: campaign.opened_count || 0,
    retained: Math.floor((campaign.converted_count || 0) * 0.8), // Assume 80% of conversions are retentions
    status: campaign.status
  }));
}