import { useState, useEffect } from 'react';
import { TrendingDown, Users, Target, ArrowDown, AlertCircle, Zap } from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface FunnelStep {
  id: string;
  name: string;
  description: string;
  users: number;
  conversionRate: number;
  dropOffRate: number;
  timeToConvert: number; // Average time in hours
  topDropOffReasons: string[];
}

interface FunnelAnalytics {
  steps: FunnelStep[];
  overallConversionRate: number;
  totalUsers: number;
  avgTimeToConvert: number;
  conversionTrends: Array<{
    date: string;
    conversionRate: number;
    users: number;
  }>;
  segmentPerformance: Array<{
    segment: string;
    conversionRate: number;
    users: number;
  }>;
  optimizationSuggestions: Array<{
    step: string;
    issue: string;
    suggestion: string;
    potentialImpact: string;
  }>;
}

export default function ConversionFunnelAnalytics() {
  const [analytics, setAnalytics] = useState<FunnelAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchFunnelAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/analytics/conversion-funnel?range=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch conversion funnel data');
      }
      
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnelAnalytics();
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
          onClick={fetchFunnelAnalytics}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!analytics) return null;

  const getStepColor = (index: number) => {
    const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-red-500'];
    return colors[index % colors.length];
  };

  const getDropOffSeverity = (dropOffRate: number) => {
    if (dropOffRate > 70) return 'text-red-600 bg-red-50';
    if (dropOffRate > 50) return 'text-yellow-600 bg-yellow-50';
    return 'text-green-600 bg-green-50';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <Target className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Conversion Funnel Analytics</h2>
              <p className="text-sm text-gray-600">Track user journey and optimize conversion points</p>
            </div>
          </div>
          
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Overall Conversion</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.overallConversionRate.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {analytics.totalUsers.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Zap className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Time to Convert</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.round(analytics.avgTimeToConvert)}h
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Biggest Drop-off</p>
              <p className="text-2xl font-bold text-gray-900">
                {Math.max(...analytics.steps.map(s => s.dropOffRate)).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Conversion Funnel</h3>
        <div className="space-y-6">
          {analytics.steps.map((step, index) => (
            <div key={step.id} className="relative">
              {/* Step Card */}
              <div className="flex items-center space-x-6 p-4 bg-gray-50 rounded-lg">
                {/* Step Number */}
                <div className={`w-12 h-12 rounded-full ${getStepColor(index)} flex items-center justify-center text-white font-bold`}>
                  {index + 1}
                </div>
                
                {/* Step Details */}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold text-gray-900">{step.name}</h4>
                      <p className="text-sm text-gray-600">{step.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-gray-900">
                        {step.users.toLocaleString()}
                      </div>
                      <div className="text-sm text-gray-600">users</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Conversion Rate:</span>
                      <span className="font-medium text-green-600">{step.conversionRate.toFixed(1)}%</span>
                    </div>
                    
                    {step.dropOffRate > 0 && (
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600">Drop-off:</span>
                        <span className={`font-medium px-2 py-1 rounded text-xs ${getDropOffSeverity(step.dropOffRate)}`}>
                          {step.dropOffRate.toFixed(1)}%
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Avg Time:</span>
                      <span className="font-medium text-gray-900">{step.timeToConvert.toFixed(1)}h</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${getStepColor(index)}`}
                      style={{ width: `${step.conversionRate}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              
              {/* Drop-off Arrow */}
              {index < analytics.steps.length - 1 && step.dropOffRate > 0 && (
                <div className="flex justify-center my-2">
                  <div className="flex items-center space-x-2 text-red-600">
                    <ArrowDown className="h-4 w-4" />
                    <span className="text-xs font-medium">
                      {step.dropOffRate.toFixed(1)}% drop-off
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Conversion Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Conversion Trends</h3>
          <div className="h-64 flex items-end space-x-2">
            {analytics.conversionTrends.map((trend, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                  style={{ height: `${(trend.conversionRate / 20) * 100}%` }}
                  title={`${trend.date}: ${trend.conversionRate.toFixed(1)}% conversion rate`}
                ></div>
                <div className="text-xs text-gray-500 mt-1 transform rotate-45 origin-bottom-left">
                  {new Date(trend.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Segment Performance</h3>
          <div className="space-y-4">
            {analytics.segmentPerformance.map((segment, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${getStepColor(index)}`}></div>
                  <span className="font-medium text-gray-900">{segment.segment}</span>
                </div>
                <div className="text-right">
                  <div className="font-medium text-gray-900">{segment.conversionRate.toFixed(1)}%</div>
                  <div className="text-sm text-gray-600">{segment.users} users</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Optimization Suggestions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Optimization Suggestions</h3>
        <div className="space-y-4">
          {analytics.optimizationSuggestions.map((suggestion, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{suggestion.step}</h4>
                    <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {suggestion.potentialImpact}
                    </span>
                  </div>
                  <p className="text-sm text-red-600 mb-2">
                    <strong>Issue:</strong> {suggestion.issue}
                  </p>
                  <p className="text-sm text-gray-700">
                    <strong>Suggestion:</strong> {suggestion.suggestion}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}