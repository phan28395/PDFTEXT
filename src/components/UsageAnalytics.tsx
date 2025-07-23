import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Calendar,
  Clock,
  FileText,
  Users,
  Target,
  AlertCircle
} from 'lucide-react';
import { useUsageStats, useUsageHistory } from '@/hooks/useUsageTracking';

interface AnalyticsProps {
  className?: string;
  showDetailedCharts?: boolean;
}

export function UsageAnalytics({ 
  className = '',
  showDetailedCharts = false
}: AnalyticsProps) {
  const { stats, loading: statsLoading, error: statsError } = useUsageStats();
  const { history, loading: historyLoading, error: historyError } = useUsageHistory(0, 100);
  
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Calculate analytics from the data
  const analytics = useMemo(() => {
    if (!stats || !history) return null;

    const now = new Date();
    const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '30d' ? 30 : 90;
    const periodStart = new Date(now.getTime() - (periodDays * 24 * 60 * 60 * 1000));
    
    const recentRecords = history.records.filter(
      record => new Date(record.created_at) >= periodStart
    );

    const processedRecords = recentRecords.filter(record => record.action === 'page_processed');
    const limitExceededRecords = recentRecords.filter(record => record.action === 'limit_exceeded');

    // Group by day for trend analysis
    const dailyUsage = new Map<string, number>();
    const dailyDocuments = new Map<string, number>();
    
    processedRecords.forEach(record => {
      const date = new Date(record.created_at).toISOString().split('T')[0];
      dailyUsage.set(date, (dailyUsage.get(date) || 0) + record.pages_count);
      dailyDocuments.set(date, (dailyDocuments.get(date) || 0) + 1);
    });

    // Calculate trends
    const totalPages = processedRecords.reduce((sum, record) => sum + record.pages_count, 0);
    const totalDocuments = processedRecords.length;
    const avgPagesPerDay = totalPages / periodDays;
    const avgDocsPerDay = totalDocuments / periodDays;
    const limitExceededCount = limitExceededRecords.length;

    // Compare with previous period
    const previousPeriodStart = new Date(periodStart.getTime() - (periodDays * 24 * 60 * 60 * 1000));
    const previousPeriodRecords = history.records.filter(
      record => {
        const recordDate = new Date(record.created_at);
        return recordDate >= previousPeriodStart && recordDate < periodStart && record.action === 'page_processed';
      }
    );
    const previousTotalPages = previousPeriodRecords.reduce((sum, record) => sum + record.pages_count, 0);
    const pagesTrend = previousTotalPages > 0 ? ((totalPages - previousTotalPages) / previousTotalPages) * 100 : 0;

    return {
      totalPages,
      totalDocuments,
      avgPagesPerDay,
      avgDocsPerDay,
      limitExceededCount,
      pagesTrend,
      dailyUsage: Array.from(dailyUsage.entries()).sort(),
      dailyDocuments: Array.from(dailyDocuments.entries()).sort(),
      periodDays,
      recentActivity: recentRecords.slice(0, 10)
    };
  }, [stats, history, selectedPeriod]);

  if (statsLoading || historyLoading) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
        <div className="animate-pulse p-6">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-8 bg-gray-200 rounded w-2/3"></div>
                <div className="h-3 bg-gray-200 rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (statsError || historyError) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center text-red-800">
          <AlertCircle className="h-6 w-6 mr-3" />
          <div>
            <h3 className="font-medium">Analytics Error</h3>
            <p className="text-sm mt-1">
              {statsError || historyError || 'Failed to load analytics data'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Usage Analytics</h2>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value as any)}
            className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      <div className="p-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-5 w-5 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Total Pages</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalPages}</p>
                {analytics.pagesTrend !== 0 && (
                  <div className={`flex items-center text-xs ${
                    analytics.pagesTrend > 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {analytics.pagesTrend > 0 ? (
                      <TrendingUp className="h-3 w-3 mr-1" />
                    ) : (
                      <TrendingDown className="h-3 w-3 mr-1" />
                    )}
                    {Math.abs(analytics.pagesTrend).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Activity className="h-5 w-5 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Documents</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.totalDocuments}</p>
                <p className="text-xs text-gray-500">
                  {analytics.avgDocsPerDay.toFixed(1)}/day avg
                </p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <BarChart3 className="h-5 w-5 text-purple-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Daily Average</p>
                <p className="text-2xl font-bold text-gray-900">
                  {analytics.avgPagesPerDay.toFixed(1)}
                </p>
                <p className="text-xs text-gray-500">pages/day</p>
              </div>
            </div>
          </div>

          <div className="bg-yellow-50 rounded-lg p-4">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-600">Limit Exceeded</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.limitExceededCount}</p>
                <p className="text-xs text-gray-500">attempts blocked</p>
              </div>
            </div>
          </div>
        </div>

        {/* Usage Efficiency */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Usage Efficiency</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {stats.average_pages_per_document.toFixed(1)}
              </div>
              <div className="text-gray-600">Avg Pages/Doc</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {stats.subscription_plan === 'pro' 
                  ? ((stats.pages_used_this_month || 0) / 1000 * 100).toFixed(1)
                  : (stats.pages_used / 10 * 100).toFixed(1)
                }%
              </div>
              <div className="text-gray-600">Plan Utilization</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {analytics.limitExceededCount === 0 ? '100' : 
                  ((analytics.totalDocuments / (analytics.totalDocuments + analytics.limitExceededCount)) * 100).toFixed(1)
                }%
              </div>
              <div className="text-gray-600">Success Rate</div>
            </div>
          </div>
        </div>

        {/* Simple Usage Chart */}
        {analytics.dailyUsage.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Daily Usage Trend</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-end justify-between h-32 space-x-1">
                {analytics.dailyUsage.slice(-14).map(([date, pages], index) => {
                  const maxPages = Math.max(...analytics.dailyUsage.map(([, p]) => p));
                  const height = maxPages > 0 ? (pages / maxPages) * 100 : 0;
                  
                  return (
                    <div key={date} className="flex flex-col items-center flex-1">
                      <div 
                        className="bg-blue-500 rounded-t w-full min-h-[2px] transition-all duration-300 hover:bg-blue-600"
                        style={{ height: `${height}%` }}
                        title={`${date}: ${pages} pages`}
                      ></div>
                      <div className="text-xs text-gray-500 mt-2 transform -rotate-45 origin-center">
                        {new Date(date).getDate()}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="text-center text-xs text-gray-500 mt-2">
                Last 14 days (hover for details)
              </div>
            </div>
          </div>
        )}

        {/* Plan Status */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">
                Current Plan: {stats.subscription_plan === 'pro' ? 'Pro' : 'Free'}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                {stats.subscription_plan === 'pro' 
                  ? `${stats.pages_used_this_month || 0} of 1,000 pages used this month`
                  : `${stats.pages_used} of 10 pages used (lifetime)`
                }
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                stats.subscription_plan === 'pro'
                  ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {stats.subscription_plan === 'pro' ? '👑 Pro' : '🆓 Free'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UsageAnalytics;