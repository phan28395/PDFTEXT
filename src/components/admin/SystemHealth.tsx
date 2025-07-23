import { useState, useEffect } from 'react';
import { Activity, Server, Database, Cloud, Zap, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  lastChecked: string;
  uptime: number;
  details?: string;
}

interface SystemMetrics {
  cpu: number;
  memory: number;
  disk: number;
  requests_per_minute: number;
  active_connections: number;
  queue_size: number;
}

interface HealthData {
  services: HealthCheck[];
  metrics: SystemMetrics;
  alerts: Array<{
    level: 'info' | 'warning' | 'critical';
    message: string;
    timestamp: string;
  }>;
}

export default function SystemHealth() {
  const [healthData, setHealthData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealthData = async () => {
    try {
      setError(null);
      
      // Mock data - in a real implementation, this would fetch from your health check API
      const mockData: HealthData = {
        services: [
          {
            service: 'Vercel Functions',
            status: 'healthy',
            responseTime: 145,
            lastChecked: new Date().toISOString(),
            uptime: 99.9,
            details: 'All functions operational'
          },
          {
            service: 'Supabase Database',
            status: 'healthy',
            responseTime: 52,
            lastChecked: new Date().toISOString(),
            uptime: 99.95,
            details: 'Connection pool: 8/100'
          },
          {
            service: 'Google Document AI',
            status: 'healthy',
            responseTime: 892,
            lastChecked: new Date().toISOString(),
            uptime: 99.8,
            details: 'API quota: 75% used'
          },
          {
            service: 'Stripe API',
            status: 'healthy',
            responseTime: 234,
            lastChecked: new Date().toISOString(),
            uptime: 99.99,
            details: 'All webhooks active'
          },
          {
            service: 'Rate Limiting Service',
            status: 'degraded',
            responseTime: 1200,
            lastChecked: new Date().toISOString(),
            uptime: 98.2,
            details: 'High memory usage detected'
          },
          {
            service: 'File Storage',
            status: 'healthy',
            responseTime: 89,
            lastChecked: new Date().toISOString(),
            uptime: 99.5,
            details: 'Storage usage: 45%'
          }
        ],
        metrics: {
          cpu: 45,
          memory: 68,
          disk: 32,
          requests_per_minute: 1247,
          active_connections: 89,
          queue_size: 3
        },
        alerts: [
          {
            level: 'warning',
            message: 'Rate limiting service showing elevated response times',
            timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString()
          },
          {
            level: 'info',
            message: 'System backup completed successfully',
            timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString()
          }
        ]
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setHealthData(mockData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 border-green-200';
      case 'degraded': return 'bg-yellow-100 border-yellow-200';
      case 'down': return 'bg-red-100 border-red-200';
      default: return 'bg-gray-100 border-gray-200';
    }
  };

  const getMetricColor = (value: number, thresholds: { warning: number; critical: number }) => {
    if (value >= thresholds.critical) return 'text-red-600';
    if (value >= thresholds.warning) return 'text-yellow-600';
    return 'text-green-600';
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
            <h3 className="text-lg font-medium text-red-800">Error Loading Health Data</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={fetchHealthData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!healthData) return null;

  const overallHealth = healthData.services.every(s => s.status === 'healthy') ? 'healthy' :
                      healthData.services.some(s => s.status === 'down') ? 'down' : 'degraded';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <Activity className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">System Health</h2>
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  overallHealth === 'healthy' ? 'bg-green-500' :
                  overallHealth === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                }`}></div>
                <span className={`text-sm font-medium ${getStatusColor(overallHealth)}`}>
                  System {overallHealth}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-600">Auto-refresh</span>
            </label>
            <button
              onClick={fetchHealthData}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* System Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className={`text-2xl font-bold ${getMetricColor(healthData.metrics.cpu, { warning: 70, critical: 90 })}`}>
                {healthData.metrics.cpu}%
              </p>
            </div>
            <Server className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Memory Usage</p>
              <p className={`text-2xl font-bold ${getMetricColor(healthData.metrics.memory, { warning: 80, critical: 95 })}`}>
                {healthData.metrics.memory}%
              </p>
            </div>
            <Database className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Disk Usage</p>
              <p className={`text-2xl font-bold ${getMetricColor(healthData.metrics.disk, { warning: 80, critical: 95 })}`}>
                {healthData.metrics.disk}%
              </p>
            </div>
            <Cloud className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Requests/min</p>
              <p className="text-2xl font-bold text-blue-600">
                {healthData.metrics.requests_per_minute.toLocaleString()}
              </p>
            </div>
            <Zap className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Connections</p>
              <p className="text-2xl font-bold text-green-600">
                {healthData.metrics.active_connections}
              </p>
            </div>
            <Activity className="h-8 w-8 text-indigo-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queue Size</p>
              <p className={`text-2xl font-bold ${getMetricColor(healthData.metrics.queue_size, { warning: 10, critical: 25 })}`}>
                {healthData.metrics.queue_size}
              </p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Service Status */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {healthData.services.map((service, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg border-2 ${getStatusBg(service.status)}`}
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{service.service}</h4>
                <div className="flex items-center space-x-2">
                  {service.status === 'healthy' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  {service.status === 'degraded' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                  {service.status === 'down' && <AlertTriangle className="h-5 w-5 text-red-600" />}
                  <span className={`text-sm font-medium ${getStatusColor(service.status)}`}>
                    {service.status.toUpperCase()}
                  </span>
                </div>
              </div>
              
              <div className="space-y-1 text-sm text-gray-600">
                <div className="flex justify-between">
                  <span>Response Time:</span>
                  <span className="font-medium">{service.responseTime}ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Uptime:</span>
                  <span className="font-medium">{service.uptime}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Last Checked:</span>
                  <span className="font-medium">
                    {new Date(service.lastChecked).toLocaleTimeString()}
                  </span>
                </div>
                {service.details && (
                  <div className="mt-2 pt-2 border-t border-gray-200">
                    <p className="text-xs text-gray-500">{service.details}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Alerts */}
      {healthData.alerts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Alerts</h3>
          <div className="space-y-3">
            {healthData.alerts.map((alert, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  alert.level === 'critical' ? 'bg-red-50 border-red-200' :
                  alert.level === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                  'bg-blue-50 border-blue-200'
                }`}
              >
                <div className="flex items-start space-x-3">
                  <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                    alert.level === 'critical' ? 'text-red-600' :
                    alert.level === 'warning' ? 'text-yellow-600' :
                    'text-blue-600'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${
                      alert.level === 'critical' ? 'text-red-800' :
                      alert.level === 'warning' ? 'text-yellow-800' :
                      'text-blue-800'
                    }`}>
                      {alert.message}
                    </p>
                    <p className={`text-xs mt-1 ${
                      alert.level === 'critical' ? 'text-red-600' :
                      alert.level === 'warning' ? 'text-yellow-600' :
                      'text-blue-600'
                    }`}>
                      {new Date(alert.timestamp).toLocaleString()}
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