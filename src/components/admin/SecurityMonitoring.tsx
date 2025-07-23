import { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Eye, TrendingUp, Clock, Activity } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';

interface SecurityStats {
  rateLimiting: {
    totalRequests: number;
    blockedRequests: number;
    blacklistedIPs: number;
    whitelistedIPs: number;
    suspiciousIPs: number;
  };
  security: {
    totalEvents: number;
    eventsByType: { [key: string]: number };
    recentThreats: Array<{
      id: string;
      action: string;
      target_ip: string;
      created_at: string;
    }>;
  };
  processing: {
    totalAttempts: number;
    successRate: number;
    topIPs: Array<{ ip: string; requests: number }>;
    failurePattern: { [hour: string]: number };
  };
  alerts: Array<{
    level: string;
    type: string;
    message: string;
  }>;
}

export default function SecurityMonitoring() {
  const [stats, setStats] = useState<SecurityStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState('24h');
  const [activeView, setActiveView] = useState<'overview' | 'threats' | 'performance' | 'alerts'>('overview');
  const { user } = useAuth();

  const fetchSecurityData = async (view: string = 'overview') => {
    try {
      setLoading(true);
      setError(null);

      const token = await user?.getIdToken?.() || localStorage.getItem('supabase.auth.token');
      
      const response = await fetch(`/api/admin/security-monitoring?type=${view}&timeframe=${timeframe}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch security data');
      console.error('Security monitoring error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityData(activeView);
  }, [timeframe, activeView]);

  const handleIPManagement = async (action: 'blacklist' | 'whitelist', ip: string) => {
    try {
      const token = await user?.getIdToken?.() || localStorage.getItem('supabase.auth.token');
      
      const response = await fetch('/api/admin/security-management', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ip }),
      });

      if (!response.ok) {
        throw new Error('Failed to manage IP');
      }

      // Refresh data after action
      await fetchSecurityData(activeView);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to manage IP');
    }
  };

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
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Security Data</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={() => fetchSecurityData(activeView)}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-4 mb-4 sm:mb-0">
          <Shield className="h-6 w-6 text-blue-600" />
          <h2 className="text-xl font-semibold text-gray-900">Security Monitoring</h2>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <button
            onClick={() => fetchSecurityData(activeView)}
            className="bg-blue-600 text-white px-4 py-1 rounded-md text-sm hover:bg-blue-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* View Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', name: 'Overview', icon: Eye },
            { id: 'threats', name: 'Threats', icon: AlertTriangle },
            { id: 'performance', name: 'Performance', icon: TrendingUp },
            { id: 'alerts', name: 'Alerts', icon: Activity },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeView === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Overview Content */}
      {activeView === 'overview' && stats && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Rate Limiting Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limiting</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Requests</span>
                <span className="text-sm font-medium text-gray-900">{stats.rateLimiting.totalRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Blocked Requests</span>
                <span className="text-sm font-medium text-red-600">{stats.rateLimiting.blockedRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Blacklisted IPs</span>
                <span className="text-sm font-medium text-red-600">{stats.rateLimiting.blacklistedIPs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Suspicious IPs</span>
                <span className="text-sm font-medium text-yellow-600">{stats.rateLimiting.suspiciousIPs}</span>
              </div>
            </div>
          </div>

          {/* Security Events */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Events</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Events</span>
                <span className="text-sm font-medium text-gray-900">{stats.security.totalEvents}</span>
              </div>
              {Object.entries(stats.security.eventsByType).map(([type, count]) => (
                <div key={type} className="flex justify-between">
                  <span className="text-sm text-gray-600 capitalize">{type.replace('_', ' ')}</span>
                  <span className="text-sm font-medium text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Processing Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Processing</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Total Attempts</span>
                <span className="text-sm font-medium text-gray-900">{stats.processing.totalAttempts.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className={`text-sm font-medium ${stats.processing.successRate >= 95 ? 'text-green-600' : stats.processing.successRate >= 85 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {stats.processing.successRate}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Threats */}
      {stats?.security.recentThreats && stats.security.recentThreats.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Security Threats</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.security.recentThreats.map((threat, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {threat.action.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                      {threat.target_ip}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(threat.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      <button
                        onClick={() => handleIPManagement('blacklist', threat.target_ip)}
                        className="text-red-600 hover:text-red-900 text-xs bg-red-50 px-2 py-1 rounded"
                      >
                        Blacklist
                      </button>
                      <button
                        onClick={() => handleIPManagement('whitelist', threat.target_ip)}
                        className="text-green-600 hover:text-green-900 text-xs bg-green-50 px-2 py-1 rounded"
                      >
                        Whitelist
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Security Alerts */}
      {stats?.alerts && stats.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Alerts</h3>
          <div className="space-y-3">
            {stats.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  alert.level === 'critical' ? 'bg-red-50 border-red-200' :
                  alert.level === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 mr-3 ${
                    alert.level === 'critical' ? 'text-red-600' :
                    alert.level === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <div>
                    <h4 className={`font-medium ${
                      alert.level === 'critical' ? 'text-red-800' :
                      alert.level === 'warning' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      {alert.type.replace('_', ' ').toUpperCase()}
                    </h4>
                    <p className={`text-sm ${
                      alert.level === 'critical' ? 'text-red-700' :
                      alert.level === 'warning' ? 'text-yellow-700' :
                      'text-blue-700'
                    }`}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}