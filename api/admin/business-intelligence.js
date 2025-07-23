import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { range = '30d' } = req.query;
    
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

    // Check if user is admin
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email')
      .eq('id', user.user.id)
      .single();

    if (userError || !userData || !userData.email.includes('admin')) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (range) {
      case '7d':
        startDate.setDate(endDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(endDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(endDate.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate.setDate(endDate.getDate() - 30);
    }

    // Fetch comprehensive business intelligence data
    const businessMetrics = await fetchBusinessIntelligenceData(startDate, endDate);
    
    res.status(200).json(businessMetrics);
  } catch (error) {
    console.error('Business Intelligence API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch business intelligence data',
      details: error.message 
    });
  }
}

async function fetchBusinessIntelligenceData(startDate, endDate) {
  try {
    // Get overview metrics
    const overview = await fetchOverviewMetrics(startDate, endDate);
    
    // Get conversion funnel data
    const conversionFunnel = await fetchConversionFunnelData(startDate, endDate);
    
    // Get cohort analysis
    const cohortAnalysis = await fetchCohortAnalysis();
    
    // Get churn prediction data
    const churnPrediction = await fetchChurnPredictionData();
    
    // Get revenue segments
    const revenueSegments = await fetchRevenueSegments(startDate, endDate);
    
    // Get campaign performance
    const campaignPerformance = await fetchCampaignPerformance(startDate, endDate);
    
    // Get A/B test results
    const abTestResults = await fetchABTestResults();

    return {
      overview,
      conversionFunnel,
      cohortAnalysis,
      churnPrediction,
      revenueSegments,
      campaignPerformance,
      abTestResults
    };
  } catch (error) {
    console.error('Error fetching business intelligence data:', error);
    throw error;
  }
}

async function fetchOverviewMetrics(startDate, endDate) {
  // Get current period metrics
  const { data: currentUsers } = await supabase
    .from('users')
    .select('*')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: allUsers } = await supabase
    .from('users')
    .select('*');

  const { data: currentProcessing } = await supabase
    .from('processing_history')
    .select('pages_processed')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: allProcessing } = await supabase
    .from('processing_history')
    .select('pages_processed');

  // Calculate previous period for growth comparison
  const prevStartDate = new Date(startDate);
  const prevEndDate = new Date(endDate);
  const periodLength = endDate - startDate;
  prevStartDate.setTime(startDate.getTime() - periodLength);
  prevEndDate.setTime(endDate.getTime() - periodLength);

  const { data: prevUsers } = await supabase
    .from('users')
    .select('*')
    .gte('created_at', prevStartDate.toISOString())
    .lte('created_at', prevEndDate.toISOString());

  // Calculate metrics
  const totalUsers = allUsers?.length || 0;
  const newUsers = currentUsers?.length || 0;
  const prevNewUsers = prevUsers?.length || 0;
  const userGrowth = prevNewUsers > 0 ? ((newUsers - prevNewUsers) / prevNewUsers) * 100 : 0;

  const totalProcessing = allProcessing?.reduce((sum, record) => sum + (record.pages_processed || 0), 0) || 0;
  const activeUsers = Math.floor(totalUsers * 0.45); // Estimate based on typical SaaS metrics

  // Mock revenue data (would come from Stripe in real implementation)
  const monthlyRevenue = 12500 + Math.floor(Math.random() * 5000);
  const totalRevenue = monthlyRevenue * 8; // Estimated total revenue
  const revenueGrowth = 8.5 + Math.random() * 10; // Mock growth

  const conversionRate = totalUsers > 0 ? (newUsers / totalUsers) * 100 : 0;
  const churnRate = 3.2 + Math.random() * 2; // Mock churn rate
  const avgLifetimeValue = 180 + Math.random() * 120; // Mock LTV

  return {
    totalRevenue,
    monthlyRevenue,
    totalUsers,
    activeUsers,
    totalProcessing,
    conversionRate,
    churnRate,
    avgLifetimeValue,
    revenueGrowth,
    userGrowth
  };
}

async function fetchConversionFunnelData(startDate, endDate) {
  // In a real implementation, this would track actual conversion events
  // For now, we'll use estimated funnel metrics
  
  const { data: totalVisitors } = await supabase
    .from('user_activity')
    .select('user_id')
    .eq('activity_type', 'page_view')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: signups } = await supabase
    .from('users')
    .select('id')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: firstUploads } = await supabase
    .from('processing_history')
    .select('user_id')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const { data: paidUsers } = await supabase
    .from('users')
    .select('id')
    .eq('subscription_status', 'pro')
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  const visitors = totalVisitors?.length || 1500;
  const signupCount = signups?.length || 285;
  const uploadCount = new Set(firstUploads?.map(u => u.user_id)).size || 192;
  const paidCount = paidUsers?.length || 39;

  return [
    {
      step: 'Website Visitors',
      users: visitors,
      conversionRate: 100,
      dropOffRate: 0
    },
    {
      step: 'Sign-ups',
      users: signupCount,
      conversionRate: (signupCount / visitors) * 100,
      dropOffRate: ((visitors - signupCount) / visitors) * 100
    },
    {
      step: 'First Upload',
      users: uploadCount,
      conversionRate: (uploadCount / signupCount) * 100,
      dropOffRate: ((signupCount - uploadCount) / signupCount) * 100
    },
    {
      step: 'Paid Subscription',
      users: paidCount,
      conversionRate: (paidCount / uploadCount) * 100,
      dropOffRate: ((uploadCount - paidCount) / uploadCount) * 100
    }
  ];
}

async function fetchCohortAnalysis() {
  // Mock cohort data - in reality this would be calculated from user_cohorts table
  return [
    {
      cohortMonth: '2024-01',
      totalUsers: 145,
      retentionRates: [100, 85, 72, 68, 65, 62],
      revenue: 2890
    },
    {
      cohortMonth: '2024-02',
      totalUsers: 198,
      retentionRates: [100, 88, 76, 71, 68],
      revenue: 3960
    },
    {
      cohortMonth: '2024-03',
      totalUsers: 223,
      retentionRates: [100, 91, 79, 74],
      revenue: 4460
    }
  ];
}

async function fetchChurnPredictionData() {
  // Mock churn prediction data based on customer_metrics table
  const { data: customerMetrics } = await supabase
    .from('customer_metrics')
    .select('churn_probability, churn_risk_score');

  if (!customerMetrics) {
    return {
      highRiskUsers: 23,
      mediumRiskUsers: 67,
      lowRiskUsers: 412,
      predictedChurnRate: 4.8
    };
  }

  const highRisk = customerMetrics.filter(m => m.churn_risk_score >= 8).length;
  const mediumRisk = customerMetrics.filter(m => m.churn_risk_score >= 5 && m.churn_risk_score < 8).length;
  const lowRisk = customerMetrics.filter(m => m.churn_risk_score < 5).length;

  const avgChurnProb = customerMetrics.reduce((sum, m) => sum + (m.churn_probability || 0), 0) / customerMetrics.length;

  return {
    highRiskUsers: highRisk,
    mediumRiskUsers: mediumRisk,
    lowRiskUsers: lowRisk,
    predictedChurnRate: avgChurnProb * 100
  };
}

async function fetchRevenueSegments(startDate, endDate) {
  // Mock revenue segments based on user subscription data
  return [
    {
      segment: 'High Value (Pro)',
      users: 89,
      revenue: 17800,
      avgLifetimeValue: 380
    },
    {
      segment: 'Medium Value (Active Free)',
      users: 234,
      revenue: 0,
      avgLifetimeValue: 45
    },
    {
      segment: 'Low Value (Inactive)',
      users: 178,
      revenue: 0,
      avgLifetimeValue: 12
    }
  ];
}

async function fetchCampaignPerformance(startDate, endDate) {
  // Fetch from marketing_campaigns and campaign_interactions tables
  const { data: campaigns } = await supabase
    .from('marketing_campaigns')
    .select(`
      *,
      campaign_interactions(*)
    `)
    .gte('created_at', startDate.toISOString())
    .lte('created_at', endDate.toISOString());

  if (!campaigns || campaigns.length === 0) {
    // Mock data for demonstration
    return [
      {
        campaignName: 'Welcome Email Series',
        sent: 1250,
        opened: 687,
        clicked: 156,
        converted: 23,
        roi: 12.4
      },
      {
        campaignName: 'Upgrade Reminder',
        sent: 892,
        opened: 445,
        clicked: 89,
        converted: 18,
        roi: 8.7
      },
      {
        campaignName: 'Feature Announcement',
        sent: 2340,
        opened: 1456,
        clicked: 234,
        converted: 12,
        roi: 3.2
      }
    ];
  }

  return campaigns.map(campaign => ({
    campaignName: campaign.campaign_name,
    sent: campaign.sent_count || 0,
    opened: campaign.opened_count || 0,
    clicked: campaign.clicked_count || 0,
    converted: campaign.converted_count || 0,
    roi: calculateCampaignROI(campaign)
  }));
}

async function fetchABTestResults() {
  const { data: tests } = await supabase
    .from('ab_tests')
    .select(`
      *,
      ab_test_variants(*),
      ab_test_assignments(*)
    `)
    .in('status', ['active', 'completed']);

  if (!tests || tests.length === 0) {
    // Mock A/B test data
    return [
      {
        testName: 'Homepage CTA Button Color',
        status: 'active',
        variants: [
          {
            name: 'Control (Blue)',
            users: 524,
            conversionRate: 12.4,
            confidence: 95.2
          },
          {
            name: 'Variant (Green)',
            users: 518,
            conversionRate: 14.8,
            confidence: 97.1
          }
        ]
      },
      {
        testName: 'Pricing Page Layout',
        status: 'completed',
        variants: [
          {
            name: 'Control',
            users: 892,
            conversionRate: 8.9,
            confidence: 99.1
          },
          {
            name: 'Variant',
            users: 887,
            conversionRate: 11.2,
            confidence: 99.3
          }
        ]
      }
    ];
  }

  return tests.map(test => ({
    testName: test.test_name,
    status: test.status,
    variants: test.ab_test_variants.map(variant => ({
      name: variant.variant_name,
      users: test.ab_test_assignments.filter(a => a.variant_id === variant.id).length,
      conversionRate: calculateVariantConversionRate(variant, test.ab_test_assignments),
      confidence: calculateStatisticalConfidence(variant, test.ab_test_assignments)
    }))
  }));
}

function calculateCampaignROI(campaign) {
  // Simple ROI calculation - in reality this would be more complex
  const revenue = (campaign.converted_count || 0) * 20; // Assume $20 per conversion
  const cost = (campaign.sent_count || 0) * 0.1; // Assume $0.1 per email sent
  return cost > 0 ? ((revenue - cost) / cost) * 100 : 0;
}

function calculateVariantConversionRate(variant, assignments) {
  // Mock calculation - in reality this would track actual conversions
  return 8 + Math.random() * 8; // Random conversion rate between 8-16%
}

function calculateStatisticalConfidence(variant, assignments) {
  // Mock confidence calculation - in reality this would use proper statistical methods
  return 85 + Math.random() * 14; // Random confidence between 85-99%
}