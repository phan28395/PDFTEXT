import { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users, 
  DollarSign, 
  FileText, 
  Calendar,
  AlertTriangle,
  Target,
  Zap,
  RefreshCw,
  Filter,
  Download
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface BusinessMetrics {
  overview: {
    totalRevenue: number;
    monthlyRevenue: number;
    totalUsers: number;
    activeUsers: number;
    totalProcessing: number;
    conversionRate: number;
    churnRate: number;
    avgLifetimeValue: number;
    revenueGrowth: number;
    userGrowth: number;
  };
  cohortAnalysis: Array<{
    cohortMonth: string;
    totalUsers: number;
    retentionRates: number[];
    revenue: number;
  }>;
  conversionFunnel: Array<{
    step: string;
    users: number;
    conversionRate: number;
    dropOffRate: number;
  }>;
  churnPrediction: {
    highRiskUsers: number;
    mediumRiskUsers: number;
    lowRiskUsers: number;
    predictedChurnRate: number;
  };
  revenueSegments: Array<{
    segment: string;
    users: number;
    revenue: number;
    avgLifetimeValue: number;
  }>;
  campaignPerformance: Array<{
    campaignName: string;
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    roi: number;
  }>;
  abTestResults: Array<{
    testName: string;
    status: string;
    variants: Array<{
      name: string;
      users: number;
      conversionRate: number;
      confidence: number;
    }>;
  }>;
}

export default function BusinessIntelligenceDashboard() {
  const [metrics, setMetrics] = useState<BusinessMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchBusinessMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/admin/business-intelligence?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch business intelligence data');
      }
      
      const data = await response.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchBusinessMetrics();
  };

  const exportReport = async () => {
    try {
      const response = await fetch(`/api/admin/export-bi-report?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `business-intelligence-report-${timeRange}.pdf`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (err) {
      console.error('Failed to export report:', err);
    }
  };

  useEffect(() => {
    fetchBusinessMetrics();
  }, [timeRange]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchBusinessMetrics}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getGrowthIcon = (growth: number) => {
    return growth > 0 ? TrendingUp : TrendingDown;
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Business Intelligence Dashboard</h2>
              <p className="text-sm text-gray-600">Advanced analytics and business insights</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            
            <button
              onClick={refreshData}
              disabled={refreshing}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            
            <button
              onClick={exportReport}
              className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
            >
              <Download className="h-4 w-4" />
              <span>Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Monthly Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${metrics.overview.monthlyRevenue.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            {(() => {
              const GrowthIcon = getGrowthIcon(metrics.overview.revenueGrowth);
              return (
                <>
                  <GrowthIcon className={`h-4 w-4 mr-1 ${getGrowthColor(metrics.overview.revenueGrowth)}`} />
                  <span className={getGrowthColor(metrics.overview.revenueGrowth)}>
                    {metrics.overview.revenueGrowth > 0 ? '+' : ''}{metrics.overview.revenueGrowth.toFixed(1)}% from last period
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metrics.overview.activeUsers.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            {(() => {
              const GrowthIcon = getGrowthIcon(metrics.overview.userGrowth);
              return (
                <>
                  <GrowthIcon className={`h-4 w-4 mr-1 ${getGrowthColor(metrics.overview.userGrowth)}`} />
                  <span className={getGrowthColor(metrics.overview.userGrowth)}>
                    {metrics.overview.userGrowth > 0 ? '+' : ''}{metrics.overview.userGrowth.toFixed(1)}% from last period
                  </span>
                </>
              );
            })()}
          </div>
        </div>

        {/* Churn Rate */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Churn Rate</p>
                <p className="text-2xl font-bold text-gray-900">
                  {metrics.overview.churnRate.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            {metrics.churnPrediction.highRiskUsers} high-risk users
          </div>
        </div>

        {/* Average LTV */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Target className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm text-gray-600">Avg Lifetime Value</p>
                <p className="text-2xl font-bold text-gray-900">
                  ${metrics.overview.avgLifetimeValue.toFixed(0)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Based on current trends
          </div>
        </div>
      </div>

      {/* Conversion Funnel Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Conversion Funnel Analysis</h3>
        <div className="space-y-4">
          {metrics.conversionFunnel.map((step, index) => (
            <div key={index} className="flex items-center space-x-4">
              <div className="w-20 text-right">
                <span className="text-sm font-medium text-gray-900">{step.conversionRate.toFixed(1)}%</span>
                {index > 0 && (
                  <div className="text-xs text-red-600">
                    -{step.dropOffRate.toFixed(1)}% drop
                  </div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-900">{step.step}</span>
                  <span className="text-sm text-gray-600">{step.users.toLocaleString()} users</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="h-3 rounded-full bg-gradient-to-r from-blue-500 to-purple-600"
                    style={{ width: `${step.conversionRate}%` }}
                  ></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue Segments & Churn Risk */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Segments */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Segments</h3>
          <div className="space-y-4">
            {metrics.revenueSegments.map((segment, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{segment.segment}</div>
                  <div className="text-sm text-gray-600">{segment.users} users</div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-green-600">${segment.revenue.toLocaleString()}</div>
                  <div className="text-sm text-gray-600">LTV: ${segment.avgLifetimeValue}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Churn Risk Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Churn Risk Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="font-medium text-gray-900">High Risk</span>
              </div>
              <span className="text-red-600 font-medium">{metrics.churnPrediction.highRiskUsers} users</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Medium Risk</span>
              </div>
              <span className="text-yellow-600 font-medium">{metrics.churnPrediction.mediumRiskUsers} users</span>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Low Risk</span>
              </div>
              <span className="text-green-600 font-medium">{metrics.churnPrediction.lowRiskUsers} users</span>
            </div>
            
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-700">
                Predicted churn rate for next 30 days: <strong>{metrics.churnPrediction.predictedChurnRate.toFixed(1)}%</strong>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Performance */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Marketing Campaign Performance</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Campaign
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Opened
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Clicked
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Converted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ROI
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {metrics.campaignPerformance.map((campaign, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {campaign.campaignName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campaign.sent.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campaign.opened.toLocaleString()} ({((campaign.opened / campaign.sent) * 100).toFixed(1)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campaign.clicked.toLocaleString()} ({((campaign.clicked / campaign.sent) * 100).toFixed(1)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {campaign.converted.toLocaleString()} ({((campaign.converted / campaign.sent) * 100).toFixed(1)}%)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-medium ${campaign.roi > 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {campaign.roi > 0 ? '+' : ''}{campaign.roi.toFixed(1)}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* A/B Test Results */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">A/B Test Results</h3>
        <div className="space-y-6">
          {metrics.abTestResults.map((test, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">{test.testName}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  test.status === 'active' ? 'bg-green-100 text-green-800' :
                  test.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {test.status}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {test.variants.map((variant, vIndex) => (
                  <div key={vIndex} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium text-gray-900">{variant.name}</span>
                      <span className="text-sm text-gray-600">{variant.users} users</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Conversion: <span className="font-medium">{variant.conversionRate.toFixed(2)}%</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Confidence: <span className="font-medium">{variant.confidence.toFixed(1)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}