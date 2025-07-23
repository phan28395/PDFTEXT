import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, FileText, Calendar } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

interface AnalyticsData {
  overview: {
    totalRevenue: number;
    monthlyRevenue: number;
    totalUsers: number;
    activeUsers: number;
    totalProcessing: number;
    conversionRate: number;
  };
  charts: {
    revenueOverTime: Array<{ date: string; revenue: number }>;
    userGrowth: Array<{ date: string; users: number }>;
    processingVolume: Array<{ date: string; pages: number }>;
    subscriptionBreakdown: Array<{ plan: string; count: number; percentage: number }>;
  };
  topMetrics: {
    topUsers: Array<{ email: string; pages: number; revenue: number }>;
    popularDays: Array<{ day: string; processing: number }>;
    conversionFunnel: Array<{ step: string; count: number; rate: number }>;
  };
}

export default function AnalyticsDashboard() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Mock data - in a real implementation, this would fetch from your analytics API
      const mockData: AnalyticsData = {
        overview: {
          totalRevenue: 45678.90,
          monthlyRevenue: 12345.67,
          totalUsers: 2847,
          activeUsers: 1256,
          totalProcessing: 125430,
          conversionRate: 12.4
        },
        charts: {
          revenueOverTime: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            revenue: Math.floor(Math.random() * 800) + 200
          })),
          userGrowth: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            users: Math.floor(Math.random() * 50) + 10
          })),
          processingVolume: Array.from({ length: 30 }, (_, i) => ({
            date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            pages: Math.floor(Math.random() * 2000) + 500
          })),
          subscriptionBreakdown: [
            { plan: 'Free', count: 2456, percentage: 86.3 },
            { plan: 'Pro', count: 391, percentage: 13.7 }
          ]
        },
        topMetrics: {
          topUsers: [
            { email: 'user1@example.com', pages: 8945, revenue: 199.8 },
            { email: 'user2@example.com', pages: 7823, revenue: 159.6 },
            { email: 'user3@example.com', pages: 6734, revenue: 139.7 },
            { email: 'user4@example.com', pages: 5892, revenue: 119.8 },
            { email: 'user5@example.com', pages: 5234, revenue: 99.9 }
          ],
          popularDays: [
            { day: 'Monday', processing: 18543 },
            { day: 'Tuesday', processing: 21234 },
            { day: 'Wednesday', processing: 19876 },
            { day: 'Thursday', processing: 22145 },
            { day: 'Friday', processing: 20987 }
          ],
          conversionFunnel: [
            { step: 'Visitors', count: 15430, rate: 100 },
            { step: 'Sign-ups', count: 2847, rate: 18.4 },
            { step: 'First Upload', count: 1923, rate: 67.5 },
            { step: 'Paid Subscription', count: 391, rate: 20.3 }
          ]
        }
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 800));
      
      setAnalyticsData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
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
          onClick={fetchAnalyticsData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analyticsData) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Analytics Dashboard</h2>
              <p className="text-sm text-gray-600">Business intelligence and key metrics</p>
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
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analyticsData.overview.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+12% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.overview.activeUsers.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+8% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Pages Processed</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.overview.totalProcessing.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+22% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${analyticsData.overview.monthlyRevenue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+15% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.overview.totalUsers.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+5% from last month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Conversion Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {analyticsData.overview.conversionRate}%
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+2.1% from last month</span>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Over Time */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue Over Time</h3>
          <div className="h-64 flex items-end space-x-1">
            {analyticsData.charts.revenueOverTime.slice(-14).map((data, index) => (
              <div
                key={index}
                className="flex-1 bg-green-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${(data.revenue / 1000) * 100}%` }}
                title={`${data.date}: $${data.revenue}`}
              ></div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center">Last 14 days</div>
        </div>

        {/* User Growth */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">User Growth</h3>
          <div className="h-64 flex items-end space-x-1">
            {analyticsData.charts.userGrowth.slice(-14).map((data, index) => (
              <div
                key={index}
                className="flex-1 bg-blue-500 rounded-t opacity-80 hover:opacity-100 transition-opacity"
                style={{ height: `${(data.users / 50) * 100}%` }}
                title={`${data.date}: ${data.users} users`}
              ></div>
            ))}
          </div>
          <div className="text-xs text-gray-500 mt-2 text-center">Daily new users (Last 14 days)</div>
        </div>
      </div>

      {/* Subscription Breakdown & Conversion Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subscription Breakdown */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Breakdown</h3>
          <div className="space-y-4">
            {analyticsData.charts.subscriptionBreakdown.map((sub, index) => (
              <div key={index}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-900">{sub.plan}</span>
                  <span className="text-gray-600">{sub.count.toLocaleString()} users ({sub.percentage}%)</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${sub.plan === 'Pro' ? 'bg-green-500' : 'bg-blue-500'}`}
                    style={{ width: `${sub.percentage}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Conversion Funnel */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Funnel</h3>
          <div className="space-y-3">
            {analyticsData.topMetrics.conversionFunnel.map((step, index) => (
              <div key={index} className="flex items-center space-x-4">
                <div className="w-16 text-right">
                  <span className="text-xs font-medium text-gray-600">{step.rate}%</span>
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-gray-900">{step.step}</span>
                    <span className="text-sm text-gray-600">{step.count.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-purple-500"
                      style={{ width: `${step.rate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Users & Popular Days */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Users */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Users by Revenue</h3>
          <div className="space-y-3">
            {analyticsData.topMetrics.topUsers.map((user, index) => (
              <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{user.email}</p>
                    <p className="text-xs text-gray-500">{user.pages.toLocaleString()} pages</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-green-600">${user.revenue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Days */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing Volume by Day</h3>
          <div className="space-y-3">
            {analyticsData.topMetrics.popularDays.map((day, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-900">{day.day}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      className="h-2 rounded-full bg-purple-500"
                      style={{ width: `${(day.processing / 25000) * 100}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 w-16 text-right">
                    {day.processing.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}