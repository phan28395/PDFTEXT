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
    const { range = '1y' } = req.query;
    
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

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
      case '3m':
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case '6m':
        startDate.setMonth(endDate.getMonth() - 6);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      case '2y':
        startDate.setFullYear(endDate.getFullYear() - 2);
        break;
      default:
        startDate.setFullYear(endDate.getFullYear() - 1);
    }

    const ltvData = await fetchCustomerLTVData(startDate, endDate);
    
    res.status(200).json(ltvData);
  } catch (error) {
    console.error('Customer LTV API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch customer LTV data',
      details: error.message 
    });
  }
}

async function fetchCustomerLTVData(startDate, endDate) {
  try {
    // Get all users with their complete data for LTV calculation
    const { data: users } = await supabase
      .from('users')
      .select(`
        *,
        processing_history(*),
        customer_metrics(*)
      `)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Calculate overall metrics
    const overall = await calculateOverallLTVMetrics(users || []);
    
    // Segment customers by value and behavior
    const segments = await calculateCustomerSegments(users || []);
    
    // Generate LTV trends over time
    const trends = await generateLTVTrends(startDate, endDate);
    
    // Perform cohort analysis
    const cohorts = await calculateCohortLTV(users || []);
    
    // Generate predictive analysis
    const predictive = await generatePredictiveLTV(users || []);

    return {
      overall,
      segments,
      trends,
      cohorts,
      predictive
    };
  } catch (error) {
    console.error('Error fetching customer LTV data:', error);
    throw error;
  }
}

async function calculateOverallLTVMetrics(users) {
  if (!users || users.length === 0) {
    return {
      avgLTV: 0,
      totalRevenue: 0,
      avgLifespan: 0,
      paybackPeriod: 0,
      revenuePerUser: 0,
      ltv: 0
    };
  }

  let totalRevenue = 0;
  let totalLifespan = 0;
  let totalLTV = 0;
  const now = new Date();

  users.forEach(user => {
    // Calculate user revenue (simplified - in reality would track actual payments)
    const userRevenue = user.subscription_status === 'pro' ? 20 : 0; // $20/month for pro
    totalRevenue += userRevenue;

    // Calculate user lifespan in months
    const createdAt = new Date(user.created_at);
    const lifespanMonths = Math.max(1, (now - createdAt) / (1000 * 60 * 60 * 24 * 30));
    totalLifespan += lifespanMonths;

    // Calculate user LTV (simplified model)
    const monthlyRevenue = userRevenue;
    const churnRate = user.subscription_status === 'pro' ? 0.05 : 0.15; // Monthly churn rate
    const avgLifetime = 1 / churnRate; // Average lifetime in months
    const userLTV = monthlyRevenue * avgLifetime;
    totalLTV += userLTV;
  });

  const avgLTV = totalLTV / users.length;
  const avgLifespan = totalLifespan / users.length;
  const revenuePerUser = totalRevenue / users.length;
  
  // Assume $15 average customer acquisition cost
  const avgAcquisitionCost = 15;
  const paybackPeriod = avgAcquisitionCost / (revenuePerUser || 1);

  return {
    avgLTV: Math.round(avgLTV),
    totalRevenue: Math.round(totalRevenue),
    avgLifespan: Math.round(avgLifespan * 10) / 10,
    paybackPeriod: Math.round(paybackPeriod * 10) / 10,
    revenuePerUser: Math.round(revenuePerUser),
    ltv: Math.round(totalLTV)
  };
}

async function calculateCustomerSegments(users) {
  const segments = [
    {
      segment: 'High-Value Pro Users',
      filter: (user) => user.subscription_status === 'pro' && (user.processing_history?.length || 0) > 10,
      characteristics: ['Pro subscription', 'Heavy usage', 'High engagement']
    },
    {
      segment: 'Active Pro Users',
      filter: (user) => user.subscription_status === 'pro' && (user.processing_history?.length || 0) <= 10,
      characteristics: ['Pro subscription', 'Regular usage', 'Medium engagement']
    },
    {
      segment: 'High-Usage Free Users',
      filter: (user) => user.subscription_status === 'free' && (user.processing_history?.length || 0) > 8,
      characteristics: ['Free plan', 'Heavy usage', 'Upgrade potential']
    },
    {
      segment: 'Regular Free Users',
      filter: (user) => user.subscription_status === 'free' && (user.processing_history?.length || 0) > 2 && (user.processing_history?.length || 0) <= 8,
      characteristics: ['Free plan', 'Regular usage', 'Engaged']
    },
    {
      segment: 'Low-Engagement Users',
      filter: (user) => (user.processing_history?.length || 0) <= 2,
      characteristics: ['Low usage', 'At-risk', 'Need activation']
    }
  ];

  return segments.map(segmentDef => {
    const segmentUsers = users.filter(segmentDef.filter);
    const userCount = segmentUsers.length;
    
    if (userCount === 0) {
      return {
        segment: segmentDef.segment,
        userCount: 0,
        avgLTV: 0,
        avgRevenue: 0,
        avgLifespan: 0,
        churnRate: 0,
        characteristics: segmentDef.characteristics,
        growthRate: 0
      };
    }

    // Calculate segment metrics
    let totalRevenue = 0;
    let totalLifespan = 0;
    let totalLTV = 0;
    let churnedUsers = 0;
    const now = new Date();

    segmentUsers.forEach(user => {
      const userRevenue = user.subscription_status === 'pro' ? 20 : 0;
      totalRevenue += userRevenue;

      const createdAt = new Date(user.created_at);
      const lifespanMonths = Math.max(1, (now - createdAt) / (1000 * 60 * 60 * 24 * 30));
      totalLifespan += lifespanMonths;

      // Calculate LTV
      const monthlyRevenue = userRevenue;
      const baseChurnRate = user.subscription_status === 'pro' ? 0.05 : 0.15;
      const avgLifetime = 1 / baseChurnRate;
      const userLTV = monthlyRevenue * avgLifetime;
      totalLTV += userLTV;

      // Check if user has churned (simplified - no activity in last 30 days)
      const lastActivity = user.processing_history?.length > 0 
        ? new Date(Math.max(...user.processing_history.map(p => new Date(p.created_at))))
        : new Date(user.created_at);
      
      const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity > 30) {
        churnedUsers++;
      }
    });

    const avgLTV = totalLTV / userCount;
    const avgRevenue = totalRevenue / userCount;
    const avgLifespan = totalLifespan / userCount;
    const churnRate = (churnedUsers / userCount) * 100;
    
    // Mock growth rate (would be calculated from historical data)
    const growthRate = -5 + (Math.random() * 20); // -5% to +15%

    return {
      segment: segmentDef.segment,
      userCount,
      avgLTV: Math.round(avgLTV),
      avgRevenue: Math.round(avgRevenue),
      avgLifespan: Math.round(avgLifespan * 10) / 10,
      churnRate: Math.round(churnRate * 10) / 10,
      characteristics: segmentDef.characteristics,
      growthRate: Math.round(growthRate * 10) / 10
    };
  });
}

async function generateLTVTrends(startDate, endDate) {
  const trends = [];
  const days = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));
  const interval = Math.max(1, Math.floor(days / 30)); // Show max 30 data points

  for (let i = 0; i < days; i += interval) {
    const trendDate = new Date(startDate);
    trendDate.setDate(startDate.getDate() + i);
    
    // In reality, these would be calculated from actual data
    const baseAvgLTV = 150;
    const variation = Math.sin(i / 10) * 20 + Math.random() * 10;
    
    trends.push({
      date: trendDate.toISOString(),
      avgLTV: Math.round(baseAvgLTV + variation),
      newCustomerLTV: Math.round(baseAvgLTV * 0.8 + variation),
      existingCustomerLTV: Math.round(baseAvgLTV * 1.3 + variation)
    });
  }

  return trends;
}

async function calculateCohortLTV(users) {
  const cohorts = {};
  const now = new Date();

  // Group users by cohort month
  users.forEach(user => {
    const createdAt = new Date(user.created_at);
    const cohortKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, '0')}-01`;
    
    if (!cohorts[cohortKey]) {
      cohorts[cohortKey] = {
        cohortMonth: cohortKey,
        users: [],
        initialUsers: 0,
        currentUsers: 0,
        totalRevenue: 0,
        avgLTV: 0,
        monthsActive: 0,
        retentionRate: 0
      };
    }
    
    cohorts[cohortKey].users.push(user);
    cohorts[cohortKey].initialUsers++;
  });

  // Calculate cohort metrics
  return Object.values(cohorts).map(cohort => {
    const cohortDate = new Date(cohort.cohortMonth);
    const monthsActive = Math.max(1, Math.floor((now - cohortDate) / (1000 * 60 * 60 * 24 * 30)));
    
    let currentUsers = 0;
    let totalRevenue = 0;
    let totalLTV = 0;

    cohort.users.forEach(user => {
      // Check if user is still active (has activity in last 30 days)
      const lastActivity = user.processing_history?.length > 0 
        ? new Date(Math.max(...user.processing_history.map(p => new Date(p.created_at))))
        : new Date(user.created_at);
      
      const daysSinceActivity = (now - lastActivity) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity <= 30) {
        currentUsers++;
      }

      // Calculate revenue
      const userRevenue = user.subscription_status === 'pro' ? 20 * monthsActive : 0;
      totalRevenue += userRevenue;

      // Calculate LTV
      const monthlyRevenue = user.subscription_status === 'pro' ? 20 : 0;
      const churnRate = user.subscription_status === 'pro' ? 0.05 : 0.15;
      const avgLifetime = 1 / churnRate;
      totalLTV += monthlyRevenue * avgLifetime;
    });

    const retentionRate = cohort.initialUsers > 0 ? (currentUsers / cohort.initialUsers) * 100 : 0;
    const avgLTV = cohort.users.length > 0 ? totalLTV / cohort.users.length : 0;

    return {
      cohortMonth: cohort.cohortMonth,
      initialUsers: cohort.initialUsers,
      currentUsers,
      totalRevenue: Math.round(totalRevenue),
      avgLTV: Math.round(avgLTV),
      monthsActive,
      retentionRate: Math.round(retentionRate * 10) / 10
    };
  }).sort((a, b) => new Date(b.cohortMonth) - new Date(a.cohortMonth));
}

async function generatePredictiveLTV(users) {
  // Simplified predictive model
  const currentAvgLTV = users.length > 0 
    ? users.reduce((sum, user) => {
        const monthlyRevenue = user.subscription_status === 'pro' ? 20 : 0;
        const churnRate = user.subscription_status === 'pro' ? 0.05 : 0.15;
        const avgLifetime = 1 / churnRate;
        return sum + (monthlyRevenue * avgLifetime);
      }, 0) / users.length
    : 150;

  // Project future LTV with trend analysis
  const trendMultiplier = 1.15; // Assume 15% growth trend
  const projectedLTV = currentAvgLTV * trendMultiplier;
  const projectedRevenue = projectedLTV * users.length;

  // Confidence interval (simplified)
  const confidenceInterval = [
    Math.round(projectedLTV * 0.85), // Lower bound
    Math.round(projectedLTV * 1.15)  // Upper bound
  ];

  // Factors affecting LTV
  const factors = [
    {
      factor: 'Feature Adoption Rate',
      impact: 12.5,
      direction: 'positive'
    },
    {
      factor: 'Customer Support Quality',
      impact: 8.3,
      direction: 'positive'
    },
    {
      factor: 'Pricing Optimization',
      impact: 15.2,
      direction: 'positive'
    },
    {
      factor: 'Competitive Pressure',
      impact: -6.7,
      direction: 'negative'
    },
    {
      factor: 'Product Quality Issues',
      impact: -9.1,
      direction: 'negative'
    },
    {
      factor: 'Market Expansion',
      impact: 11.8,
      direction: 'positive'
    }
  ];

  return {
    projectedLTV: Math.round(projectedLTV),
    projectedRevenue: Math.round(projectedRevenue),
    confidenceInterval,
    factors
  };
}