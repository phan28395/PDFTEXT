import React from 'react';
import { 
  AlertCircle, 
  TrendingUp, 
  Calendar,
  BarChart3,
  Clock,
  Info,
  Crown,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUsageMonitoring } from '@/hooks/useUsageTracking';

interface UsageDisplayProps {
  className?: string;
  showAlerts?: boolean;
  showDetails?: boolean;
  compact?: boolean;
}

export function UsageDisplay({ 
  className = '', 
  showAlerts = true, 
  showDetails = true,
  compact = false 
}: UsageDisplayProps) {
  const { 
    stats, 
    alerts, 
    loading, 
    error, 
    usagePercentage, 
    remainingPages, 
    usageStatus,
    isNearLimit,
    isAtLimit,
    hasAlerts,
    highPriorityAlerts
  } = useUsageMonitoring();

  if (loading) {
    return (
      <div className={`bg-white rounded-lg border ${className}`}>
        <div className="animate-pulse p-6">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
          <div className="h-3 bg-gray-200 rounded w-1/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center text-red-800">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span className="text-sm">Failed to load usage data</span>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'warning': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-green-600 bg-green-50 border-green-200';
    }
  };

  const getProgressColor = (status: string) => {
    switch (status) {
      case 'critical': return 'text-red-500';
      case 'warning': return 'text-yellow-500';
      default: return 'text-blue-500';
    }
  };

  if (compact) {
    return (
      <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
        <div className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-medium text-gray-900">Usage</h3>
            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(usageStatus)}`}>
              {Math.round(usagePercentage)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
            <div 
              className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(usageStatus)}`}
              style={{ width: `${Math.min(100, usagePercentage)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-xs text-gray-600">
            <span>
              {stats.subscription_plan === 'pro' ? stats.pages_used_this_month : stats.pages_used} used
            </span>
            <span>
              {remainingPages} remaining
            </span>
          </div>
          
          {hasAlerts && showAlerts && (
            <div className="mt-2 text-xs text-yellow-600 flex items-center">
              <AlertTriangle className="h-3 w-3 mr-1" />
              {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Usage Overview</h2>
          {stats.subscription_plan === 'pro' && (
            <div className="flex items-center text-sm text-yellow-600">
              <Crown className="h-4 w-4 mr-1" />
              Pro Plan
            </div>
          )}
        </div>

        {/* Main Usage Display */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {stats.subscription_plan === 'pro' ? 'Monthly Usage' : 'Lifetime Usage'}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {stats.subscription_plan === 'pro' ? stats.pages_used_this_month : stats.pages_used}
              <span className="text-sm font-normal text-gray-500 ml-1">
                / {stats.subscription_plan === 'pro' ? '1,000' : '10'} pages
              </span>
            </span>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${getProgressColor(usageStatus)}`}
              style={{ width: `${Math.min(100, usagePercentage)}%` }}
            ></div>
          </div>
          
          <div className="flex justify-between text-sm text-gray-600">
            <span>{Math.round(usagePercentage)}% used</span>
            <span className={remainingPages <= 0 ? 'text-red-600 font-medium' : ''}>
              {remainingPages} pages remaining
            </span>
          </div>
        </div>

        {/* Pro Plan Period Info */}
        {stats.subscription_plan === 'pro' && stats.period_end && (
          <div className="bg-blue-50 rounded-lg p-3 mb-4">
            <div className="flex items-center text-sm text-blue-800">
              <Calendar className="h-4 w-4 mr-2" />
              <span>
                Resets in {stats.days_until_reset} days 
                ({new Date(stats.period_end).toLocaleDateString()})
              </span>
            </div>
          </div>
        )}

        {/* Alerts */}
        {showAlerts && hasAlerts && (
          <div className="space-y-2 mb-4">
            {highPriorityAlerts.map((alert, index) => (
              <div key={index} className={`border rounded-lg p-3 ${getStatusColor(alert.severity)}`}>
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 mr-2 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.message}</p>
                    {alert.action_required && (
                      <p className="text-xs mt-1">{alert.action_required}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Additional Stats */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.total_documents_processed}
              </div>
              <div className="text-xs text-gray-600">Documents Processed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.recent_activity_30_days}
              </div>
              <div className="text-xs text-gray-600">Recent Activity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {stats.average_pages_per_document.toFixed(1)}
              </div>
              <div className="text-xs text-gray-600">Avg Pages/Doc</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {Math.floor((Date.now() - new Date(stats.account_created).getTime()) / (1000 * 60 * 60 * 24))}
              </div>
              <div className="text-xs text-gray-600">Days Active</div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4 border-t border-gray-200 mt-4">
          {isAtLimit && stats.subscription_plan !== 'pro' && (
            <Link
              to="/pricing"
              className="flex-1 bg-purple-600 text-white text-center py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
            >
              Upgrade Now
            </Link>
          )}
          
          <Link
            to="/history?tab=usage"
            className="flex-1 bg-gray-100 text-gray-700 text-center py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
          >
            View History
          </Link>
        </div>
      </div>
    </div>
  );
}

export default UsageDisplay;