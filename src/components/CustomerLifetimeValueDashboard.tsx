import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Calendar,
  Clock,
  Target,
  BarChart3,
  PieChart,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface CustomerSegment {
  segment: string;
  userCount: number;
  avgLTV: number;
  avgRevenue: number;
  avgLifespan: number; // in months
  churnRate: number;
  characteristics: string[];
  growthRate: number;
}

interface LTVMetrics {
  overall: {
    avgLTV: number;
    totalRevenue: number;
    avgLifespan: number;
    paybackPeriod: number; // months to recoup acquisition cost
    revenuePerUser: number;
    ltv: number; // Current total LTV
  };
  segments: CustomerSegment[];
  trends: Array<{
    date: string;
    avgLTV: number;
    newCustomerLTV: number;
    existingCustomerLTV: number;
  }>;
  cohorts: Array<{
    cohortMonth: string;
    initialUsers: number;
    currentUsers: number;
    totalRevenue: number;
    avgLTV: number;
    monthsActive: number;
    retentionRate: number;
  }>;
  predictive: {
    projectedLTV: number;
    projectedRevenue: number;
    confidenceInterval: [number, number];
    factors: Array<{
      factor: string;
      impact: number;
      direction: 'positive' | 'negative';
    }>;
  };
}

export default function CustomerLifetimeValueDashboard() {
  const [data, setData] = useState<LTVMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '1y' | '2y'>('1y');
  const [refreshing, setRefreshing] = useState(false);

  const fetchLTVData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/customer-ltv?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch LTV data');
      }
      
      const ltvData = await response.json();
      setData(ltvData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch LTV data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const refreshLTVCalculation = async () => {
    setRefreshing(true);
    try {
      const response = await fetch('/api/analytics/customer-ltv/recalculate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (response.ok) {
        await fetchLTVData();
      }
    } catch (err) {
      console.error('Failed to recalculate LTV:', err);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLTVData();
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
          onClick={fetchLTVData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600';
    if (growth < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getGrowthIcon = (growth: number) => {
    return growth > 0 ? ArrowUp : ArrowDown;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <DollarSign className="h-6 w-6 text-green-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Customer Lifetime Value Analytics</h2>
              <p className="text-sm text-gray-600">Track customer value and revenue optimization</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="3m">Last 3 months</option>
              <option value="6m">Last 6 months</option>
              <option value="1y">Last year</option>
              <option value="2y">Last 2 years</option>
            </select>
            
            <button
              onClick={refreshLTVCalculation}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Recalculate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key LTV Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Average LTV</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.overall.avgLTV.toFixed(0)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-green-600">
            Per customer value
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Revenue</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.overall.totalRevenue.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            From existing customers
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Lifespan</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.overall.avgLifespan.toFixed(1)}m
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Customer retention period
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Payback Period</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.overall.paybackPeriod.toFixed(1)}m
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            To recoup acquisition cost
          </div>
        </div>
      </div>

      {/* LTV Trends */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">LTV Trends Over Time</h3>
        <div className="h-64">
          <div className="flex items-end justify-between h-full space-x-2">
            {data.trends.map((trend, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="flex flex-col items-center space-y-1 mb-2">
                  {/* New Customer LTV Bar */}
                  <div
                    className="w-full bg-blue-500 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ height: `${(trend.newCustomerLTV / 300) * 100}%` }}
                    title={`New Customer LTV: $${trend.newCustomerLTV.toFixed(0)}`}
                  ></div>
                  
                  {/* Existing Customer LTV Bar */}
                  <div
                    className="w-full bg-green-500 opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                    style={{ height: `${(trend.existingCustomerLTV / 300) * 100}%` }}
                    title={`Existing Customer LTV: $${trend.existingCustomerLTV.toFixed(0)}`}
                  ></div>
                </div>
                
                <div className="text-xs text-gray-500 transform rotate-45 origin-bottom-left">
                  {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex justify-center items-center space-x-6 mt-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded"></div>
            <span className="text-sm text-gray-600">New Customers</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span className="text-sm text-gray-600">Existing Customers</span>
          </div>
        </div>
      </div>

      {/* Customer Segments */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Customer Segments by LTV</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {data.segments.map((segment, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{segment.segment}</h4>
                <div className="flex items-center space-x-1">
                  {(() => {
                    const GrowthIcon = getGrowthIcon(segment.growthRate);
                    return (
                      <>
                        <GrowthIcon className={`h-4 w-4 ${getGrowthColor(segment.growthRate)}`} />
                        <span className={`text-sm ${getGrowthColor(segment.growthRate)}`}>
                          {segment.growthRate > 0 ? '+' : ''}{segment.growthRate.toFixed(1)}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="text-lg font-bold text-gray-900">${segment.avgLTV.toFixed(0)}</div>
                  <div className="text-sm text-gray-600">Avg LTV</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{segment.userCount}</div>
                  <div className="text-sm text-gray-600">Users</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{segment.avgLifespan.toFixed(1)}m</div>
                  <div className="text-sm text-gray-600">Lifespan</div>
                </div>
                <div>
                  <div className="text-lg font-bold text-gray-900">{segment.churnRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">Churn Rate</div>
                </div>
              </div>
              
              <div className="mb-3">
                <div className="text-sm font-medium text-gray-700 mb-2">Characteristics:</div>
                <div className="flex flex-wrap gap-1">
                  {segment.characteristics.map((char, charIndex) => (
                    <span
                      key={charIndex}
                      className="inline-block px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                    >
                      {char}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-green-400 to-green-600"
                  style={{ width: `${Math.min(100, (segment.avgLTV / 500) * 100)}%` }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cohort Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Cohort LTV Analysis</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cohort Month
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Initial Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Current Users
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Retention Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg LTV
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Months Active
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.cohorts.map((cohort, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {new Date(cohort.cohortMonth).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cohort.initialUsers.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cohort.currentUsers.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className={`font-medium ${
                      cohort.retentionRate >= 80 ? 'text-green-600' :
                      cohort.retentionRate >= 60 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {cohort.retentionRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${cohort.totalRevenue.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${cohort.avgLTV.toFixed(0)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {cohort.monthsActive}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Predictive LTV Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Projected LTV */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Projected LTV</h3>
          <div className="text-center mb-6">
            <div className="text-3xl font-bold text-green-600 mb-2">
              ${data.predictive.projectedLTV.toFixed(0)}
            </div>
            <div className="text-sm text-gray-600">
              Expected LTV (95% confidence: ${data.predictive.confidenceInterval[0].toFixed(0)} - ${data.predictive.confidenceInterval[1].toFixed(0)})
            </div>
          </div>
          
          <div className="mb-4">
            <div className="text-lg font-semibold text-gray-900">
              ${data.predictive.projectedRevenue.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">Projected Revenue</div>
          </div>
        </div>

        {/* LTV Impact Factors */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">LTV Impact Factors</h3>
          <div className="space-y-3">
            {data.predictive.factors.map((factor, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    factor.direction === 'positive' ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm font-medium text-gray-900">{factor.factor}</span>
                </div>
                <div className="flex items-center space-x-2">
                  {(() => {
                    const ImpactIcon = factor.direction === 'positive' ? ArrowUp : ArrowDown;
                    return (
                      <>
                        <ImpactIcon className={`h-4 w-4 ${
                          factor.direction === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`} />
                        <span className={`text-sm font-medium ${
                          factor.direction === 'positive' ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {factor.impact.toFixed(1)}%
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}