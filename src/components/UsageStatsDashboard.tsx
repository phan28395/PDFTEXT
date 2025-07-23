import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Calendar, 
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Activity,
  Target,
  Zap,
  AlertTriangle,
  RefreshCw,
  Download,
  PieChart
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from './LoadingSpinner';

interface UsageStats {
  overview: {
    total_pages_lifetime: number;
    pages_limit: number;
    pages_this_month: number;
    subscription_plan: string;
    subscription_status: string;
    member_since: string;
    usage_percentage: number;
    monthly_usage_percentage: number;
  };
  period_stats: {
    timeframe: string;
    documents_processed: number;
    pages_processed: number;
    success_rate: number;
    average_processing_time_ms: number;
    average_pages_per_document: number;
    average_file_size_bytes: number;
    successful_documents: number;
    failed_documents: number;
  };
  projections: {
    daily_average: number;
    projected_monthly_usage: number;
    days_remaining_in_month: number;
    projected_overage: number;
  };
  charts: {
    daily_usage: Array<{
      date: string;
      pages: number;
      documents: number;
      success: number;
      failed: number;
    }>;
    monthly_trend: Array<{
      month: string;
      pages: number;
      documents: number;
    }>;
    format_distribution: Array<{
      format: string;
      count: number;
      percentage: number;
    }>;
    success_failure_ratio: {
      successful: number;
      failed: number;
      success_rate: number;
    };
  };
  recent_activity: Array<{
    id: string;
    filename: string;
    pages: number;
    status: string;
    created_at: string;
    processing_time_ms: number;
    output_format: string;
  }>;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

const StatCard: React.FC<{ 
  title: string; 
  value: string | number; 
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon: React.ComponentType<any>;
  color: string;
  subtitle?: string;
}> = ({ title, value, change, changeType, icon: Icon, color, subtitle }) => {
  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-${color}-100`}>
          <Icon className={`h-6 w-6 text-${color}-600`} />
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-4 flex items-center">
          {changeType === 'increase' && (
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
          )}
          {changeType === 'decrease' && (
            <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
          )}
          <span className={`text-sm font-medium ${
            changeType === 'increase' ? 'text-green-600' : 
            changeType === 'decrease' ? 'text-red-600' : 
            'text-gray-600'
          }`}>
            {change > 0 ? '+' : ''}{change}%
          </span>
          <span className="text-sm text-gray-500 ml-1">vs last period</span>
        </div>
      )}
    </div>
  );
};

const ProgressBar: React.FC<{ 
  value: number; 
  max: number; 
  color?: string; 
  showValue?: boolean;
  warningThreshold?: number;
  dangerThreshold?: number;
}> = ({ 
  value, 
  max, 
  color = 'blue', 
  showValue = true, 
  warningThreshold = 80,
  dangerThreshold = 95 
}) => {
  const percentage = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  
  let barColor = `bg-${color}-500`;
  if (percentage >= dangerThreshold) {
    barColor = 'bg-red-500';
  } else if (percentage >= warningThreshold) {
    barColor = 'bg-orange-500';
  }

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-gray-600 mb-2">
        {showValue && (
          <span>{value.toLocaleString()} / {max.toLocaleString()}</span>
        )}
        <span>{percentage.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className={`h-3 rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

const SimpleChart: React.FC<{ 
  data: Array<{ date: string; pages: number; documents: number }>;
  type: 'daily' | 'monthly';
}> = ({ data, type }) => {
  if (!data || data.length === 0) return null;

  const maxPages = Math.max(...data.map(d => d.pages));
  const maxDocs = Math.max(...data.map(d => d.documents));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="font-medium text-gray-900">
          {type === 'daily' ? 'Daily Usage (Last 30 Days)' : 'Monthly Trend (Last 12 Months)'}
        </h4>
      </div>
      
      <div className="grid grid-cols-1 gap-4">
        {/* Pages Chart */}
        <div>
          <p className="text-sm text-gray-600 mb-2">Pages Processed</p>
          <div className="space-y-1">
            {data.slice(-10).map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 w-20 truncate">
                  {type === 'daily' 
                    ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : item.date
                  }
                </span>
                <div className="flex-1 bg-gray-200 rounded h-2">
                  <div 
                    className="bg-blue-500 h-2 rounded"
                    style={{ width: maxPages > 0 ? `${(item.pages / maxPages) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-8">{item.pages}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Documents Chart */}
        <div>
          <p className="text-sm text-gray-600 mb-2">Documents Processed</p>
          <div className="space-y-1">
            {data.slice(-10).map((item, index) => (
              <div key={index} className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 w-20 truncate">
                  {type === 'daily' 
                    ? new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                    : item.date
                  }
                </span>
                <div className="flex-1 bg-gray-200 rounded h-2">
                  <div 
                    className="bg-green-500 h-2 rounded"
                    style={{ width: maxDocs > 0 ? `${(item.documents / maxDocs) * 100}%` : '0%' }}
                  />
                </div>
                <span className="text-xs text-gray-600 w-8">{item.documents}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export const UsageStatsDashboard: React.FC = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('30d');
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    if (!user) return;

    try {
      setError(null);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`/api/usage/detailed-stats?timeframe=${timeframe}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch usage statistics');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      setStats(result.data);
    } catch (error: any) {
      console.error('Usage stats fetch error:', error);
      setError(error.message || 'Failed to load usage statistics');
      toast.error('Failed to load usage statistics');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user, timeframe]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
  };

  const handleExport = async () => {
    if (!stats) return;
    
    const exportData = {
      exported_at: new Date().toISOString(),
      user_id: user?.id,
      timeframe,
      ...stats
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-stats-${timeframe}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success('Usage statistics exported');
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading usage statistics...</p>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed to Load Statistics</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Usage Statistics</h1>
          <p className="text-gray-600">
            Comprehensive analysis of your PDF processing usage and trends.
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Timeframe Selector */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>

          <button
            onClick={handleExport}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Export
          </button>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Pages (Lifetime)"
          value={stats.overview.total_pages_lifetime.toLocaleString()}
          icon={FileText}
          color="blue"
          subtitle={`${stats.overview.usage_percentage.toFixed(1)}% of limit used`}
        />
        
        <StatCard
          title="This Month"
          value={stats.overview.pages_this_month.toLocaleString()}
          icon={Calendar}
          color="green"
          subtitle={`${stats.overview.monthly_usage_percentage.toFixed(1)}% of monthly limit`}
        />
        
        <StatCard
          title="Success Rate"
          value={`${stats.period_stats.success_rate.toFixed(1)}%`}
          icon={CheckCircle}
          color="emerald"
          subtitle={`${stats.period_stats.successful_documents} successful documents`}
        />
        
        <StatCard
          title="Avg Processing Time"
          value={formatDuration(stats.period_stats.average_processing_time_ms)}
          icon={Clock}
          color="purple"
          subtitle="Per document average"
        />
      </div>

      {/* Usage Progress Bars */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Lifetime Usage</h3>
          <ProgressBar 
            value={stats.overview.total_pages_lifetime}
            max={stats.overview.pages_limit}
            color="blue"
            warningThreshold={80}
            dangerThreshold={95}
          />
          <div className="mt-4 text-sm text-gray-600">
            <p>Plan: {stats.overview.subscription_plan.toUpperCase()}</p>
            <p>Member since: {new Date(stats.overview.member_since).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Usage Projection</h3>
          <ProgressBar 
            value={stats.projections.projected_monthly_usage}
            max={stats.overview.subscription_plan === 'pro' ? 1000 : 10}
            color="orange"
            warningThreshold={75}
            dangerThreshold={90}
          />
          <div className="mt-4 text-sm text-gray-600">
            <p>Daily average: {stats.projections.daily_average} pages</p>
            <p>Days remaining: {stats.projections.days_remaining_in_month}</p>
            {stats.projections.projected_overage > 0 && (
              <p className="text-orange-600 font-medium">
                Projected overage: {stats.projections.projected_overage} pages
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Period Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-white rounded-lg border p-4 text-center">
          <Activity className="h-8 w-8 text-blue-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.period_stats.documents_processed}</p>
          <p className="text-sm text-gray-600">Documents</p>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.period_stats.pages_processed}</p>
          <p className="text-sm text-gray-600">Pages</p>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <Target className="h-8 w-8 text-purple-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.period_stats.average_pages_per_document.toFixed(1)}</p>
          <p className="text-sm text-gray-600">Avg Pages/Doc</p>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <CheckCircle className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.period_stats.successful_documents}</p>
          <p className="text-sm text-gray-600">Successful</p>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{stats.period_stats.failed_documents}</p>
          <p className="text-sm text-gray-600">Failed</p>
        </div>
        
        <div className="bg-white rounded-lg border p-4 text-center">
          <Zap className="h-8 w-8 text-orange-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-gray-900">{formatBytes(stats.period_stats.average_file_size_bytes)}</p>
          <p className="text-sm text-gray-600">Avg Size</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Daily Usage Chart */}
        <div className="bg-white rounded-lg border p-6">
          <SimpleChart data={stats.charts.daily_usage} type="daily" />
        </div>

        {/* Format Distribution */}
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-medium text-gray-900 mb-4 flex items-center">
            <PieChart className="h-5 w-5 mr-2" />
            Output Format Distribution
          </h4>
          <div className="space-y-3">
            {stats.charts.format_distribution.map((format, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="text-sm text-gray-600 uppercase">{format.format}</span>
                <div className="flex items-center space-x-2">
                  <div className="w-16 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${format.percentage}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12">{format.count}</span>
                  <span className="text-xs text-gray-500 w-10">{format.percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        {stats.recent_activity.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Activity className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p>No recent activity</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Document
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pages
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Processing Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.recent_activity.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                        {activity.filename}
                      </div>
                      <div className="text-sm text-gray-500 uppercase">
                        {activity.output_format}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {activity.pages}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        activity.status === 'completed'
                          ? 'bg-green-100 text-green-800'
                          : activity.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {activity.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {activity.processing_time_ms ? formatDuration(activity.processing_time_ms) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(activity.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default UsageStatsDashboard;