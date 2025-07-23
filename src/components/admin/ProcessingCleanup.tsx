import { useState, useEffect } from 'react';
import {
  Trash2,
  Database,
  Calendar,
  Clock,
  HardDrive,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Settings,
  BarChart3
} from 'lucide-react';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import toast from 'react-hot-toast';

interface CleanupStats {
  total_records: number;
  records_with_text: number;
  records_without_text: number;
  records_older_than_1_year: number;
  records_older_than_2_years: number;
  total_text_size: number;
  old_text_size: number;
  potential_space_savings: number;
}

interface CleanupSummary {
  recent_cleanup_history: any[];
  current_stats: CleanupStats;
  last_automatic_cleanup: string | null;
  next_scheduled_cleanup: string | null;
}

interface CleanupManagementProps {
  className?: string;
}

export default function ProcessingCleanup({ className = '' }: CleanupManagementProps) {
  const [stats, setStats] = useState<CleanupStats | null>(null);
  const [summary, setSummary] = useState<CleanupSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [retentionDays, setRetentionDays] = useState(365);
  const [error, setError] = useState<string | null>(null);

  const fetchCleanupData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('supabase.auth.token');
      
      const response = await fetch('/api/admin/processing-cleanup?action=stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch cleanup data');
      }

      const data = await response.json();
      setStats(data.data.stats);
      setSummary(data.data.summary);
      setError(null);
    } catch (err) {
      console.error('Error fetching cleanup data:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
      toast.error('Failed to load cleanup data');
    } finally {
      setLoading(false);
    }
  };

  const executeManualCleanup = async () => {
    try {
      setExecuting(true);
      const token = localStorage.getItem('supabase.auth.token');
      
      const response = await fetch('/api/admin/processing-cleanup', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          retention_days: retentionDays,
          force: true
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Cleanup failed');
      }

      await response.json();
      toast.success('Manual cleanup executed successfully');
      
      // Refresh data after cleanup
      await fetchCleanupData();
      
    } catch (err) {
      console.error('Error executing cleanup:', err);
      toast.error(err instanceof Error ? err.message : 'Cleanup failed');
    } finally {
      setExecuting(false);
    }
  };

  const runScheduledCleanup = async () => {
    try {
      setExecuting(true);
      const token = localStorage.getItem('supabase.auth.token');
      
      const response = await fetch('/api/admin/processing-cleanup?action=schedule', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to run scheduled cleanup');
      }

      const data = await response.json();
      
      if (data.data.executed) {
        toast.success('Scheduled cleanup executed');
      } else {
        toast.success(data.data.reason || 'Cleanup check completed');
      }
      
      // Refresh data
      await fetchCleanupData();
      
    } catch (err) {
      console.error('Error running scheduled cleanup:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to run scheduled cleanup');
    } finally {
      setExecuting(false);
    }
  };

  useEffect(() => {
    fetchCleanupData();
  }, []);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className={`${className} bg-white rounded-lg shadow p-6`}>
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-2">Loading cleanup data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className} bg-white rounded-lg shadow p-6`}>
        <div className="text-center text-red-600">
          <AlertTriangle className="h-12 w-12 mx-auto mb-4" />
          <h3 className="text-lg font-medium mb-2">Error Loading Cleanup Data</h3>
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchCleanupData}
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} space-y-6`}>
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Database className="h-6 w-6 mr-2 text-blue-600" />
              Processing History Cleanup
            </h2>
            <p className="text-gray-600 mt-1">
              Manage automatic cleanup of old processing records to optimize storage
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchCleanupData}
              className="bg-gray-100 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors inline-flex items-center text-sm"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-100">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.total_records?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-yellow-100">
              <Clock className="h-6 w-6 text-yellow-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Old Records (1+ year)</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.records_older_than_1_year?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-red-100">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Very Old (2+ years)</p>
              <p className="text-2xl font-semibold text-gray-900">
                {stats?.records_older_than_2_years?.toLocaleString() || '0'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-100">
              <HardDrive className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Potential Savings</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatBytes(stats?.potential_space_savings || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cleanup Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Cleanup Schedule</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Last Automatic Cleanup:</span>
              <span className="text-sm font-medium">
                {formatDate(summary?.last_automatic_cleanup || null)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Next Scheduled Cleanup:</span>
              <span className="text-sm font-medium">
                {formatDate(summary?.next_scheduled_cleanup || null)}
              </span>
            </div>
            <div className="pt-4 border-t">
              <button
                onClick={runScheduledCleanup}
                disabled={executing}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
              >
                <Calendar className="h-4 w-4 mr-2" />
                {executing ? 'Running...' : 'Run Scheduled Cleanup'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Manual Cleanup</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Retention Period (days)
              </label>
              <select
                value={retentionDays}
                onChange={(e) => setRetentionDays(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={180}>6 months</option>
                <option value={365}>1 year (default)</option>
                <option value={730}>2 years</option>
                <option value={1095}>3 years</option>
                <option value={2555}>7 years (compliance)</option>
              </select>
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-start">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium">Warning</p>
                  <p>This will permanently remove text content from records older than the selected period.</p>
                </div>
              </div>
            </div>
            <button
              onClick={executeManualCleanup}
              disabled={executing}
              className="w-full bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 inline-flex items-center justify-center"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {executing ? 'Executing...' : 'Execute Manual Cleanup'}
            </button>
          </div>
        </div>
      </div>

      {/* Storage Details */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Storage Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600">
              {formatBytes(stats?.total_text_size || 0)}
            </div>
            <div className="text-sm text-gray-600 mt-1">Total Text Storage</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-yellow-600">
              {formatBytes(stats?.old_text_size || 0)}
            </div>
            <div className="text-sm text-gray-600 mt-1">Old Text Storage</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600">
              {((stats?.old_text_size || 0) / Math.max(stats?.total_text_size || 1, 1) * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-gray-600 mt-1">Storage Reduction Potential</div>
          </div>
        </div>
      </div>

      {/* Recent Cleanup History */}
      {summary?.recent_cleanup_history && summary.recent_cleanup_history.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Cleanup History</h3>
          <div className="space-y-3">
            {summary.recent_cleanup_history.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                <div className="p-1 rounded-full bg-gray-200">
                  {item.action === 'system_cleanup' ? (
                    <CheckCircle className="h-4 w-4 text-green-600" />
                  ) : item.action === 'system_cleanup_error' ? (
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  ) : (
                    <Settings className="h-4 w-4 text-blue-600" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">
                      {item.action.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </p>
                    <span className="text-xs text-gray-500">
                      {formatDate(item.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{item.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}