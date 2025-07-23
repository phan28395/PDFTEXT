import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

interface UsageStats {
  user_id: string;
  subscription_plan: string;
  subscription_status: string;
  pages_used: number;
  account_created: string;
  total_documents_processed: number;
  average_pages_per_document: number;
  recent_activity_30_days: number;
  pages_used_this_month?: number;
  monthly_limit?: number;
  monthly_usage_percentage?: number;
  period_start?: string;
  period_end?: string;
  days_until_reset?: number;
  lifetime_limit?: number;
  lifetime_usage_percentage?: number;
  pages_remaining?: number;
}

interface UsageAlert {
  type: string;
  severity: 'low' | 'medium' | 'high';
  message: string;
  pages_used?: number;
  pages_remaining?: number;
  pages_used_this_month?: number;
  period_end?: string;
  action_required?: string;
}

interface UsageAlertsResponse {
  user_id: string;
  alert_count: number;
  alerts: UsageAlert[];
}

interface UsageHistoryRecord {
  id: string;
  action: string;
  pages_count: number;
  pages_before: number;
  pages_after: number;
  subscription_plan: string;
  created_at: string;
  metadata: Record<string, any>;
}

interface UsageHistoryResponse {
  total_count: number;
  page_limit: number;
  page_offset: number;
  has_more: boolean;
  records: UsageHistoryRecord[];
}

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('supabase.auth.token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${JSON.parse(token).access_token}` : '',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data || data;
}

export function useUsageStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [alerts, setAlerts] = useState<UsageAlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await apiRequest<UsageStats & { alerts: UsageAlertsResponse }>('/api/usage-stats');
      
      setStats(data);
      setAlerts(data.alerts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage stats');
      console.error('Error fetching usage stats:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [user]);

  return {
    stats,
    alerts,
    loading,
    error,
    refetch: fetchStats,
  };
}

export function useUsageHistory(page = 0, limit = 20, actionFilter?: string) {
  const { user } = useAuth();
  const [history, setHistory] = useState<UsageHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(actionFilter && { action: actionFilter }),
      });
      
      const data = await apiRequest<UsageHistoryResponse>(`/api/usage-history?${params}`);
      setHistory(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch usage history');
      console.error('Error fetching usage history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [user, page, limit, actionFilter]);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory,
  };
}

export function useUsageAlerts() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<UsageAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAlerts = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      const data = await apiRequest<UsageStats & { alerts: UsageAlertsResponse }>('/api/usage-stats');
      setAlerts(data.alerts?.alerts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check usage alerts');
      console.error('Error checking usage alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAlerts();
    
    // Set up periodic checks (every 5 minutes)
    const interval = setInterval(checkAlerts, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [user]);

  return {
    alerts,
    loading,
    error,
    refetch: checkAlerts,
    hasAlerts: alerts.length > 0,
    highPriorityAlerts: alerts.filter(alert => alert.severity === 'high'),
  };
}

// Hook for real-time usage monitoring
export function useUsageMonitoring() {
  const { stats, loading, error, refetch } = useUsageStats();
  const { alerts, hasAlerts, highPriorityAlerts } = useUsageAlerts();

  // Helper functions for usage analysis
  const getUsagePercentage = () => {
    if (!stats) return 0;
    
    if (stats.subscription_plan === 'pro' && stats.pages_used_this_month !== undefined) {
      return (stats.pages_used_this_month / 1000) * 100;
    } else {
      return (stats.pages_used / 10) * 100;
    }
  };

  const getRemainingPages = () => {
    if (!stats) return 0;
    
    if (stats.subscription_plan === 'pro' && stats.pages_used_this_month !== undefined) {
      return Math.max(0, 1000 - stats.pages_used_this_month);
    } else {
      return Math.max(0, 10 - stats.pages_used);
    }
  };

  const getUsageStatus = () => {
    const percentage = getUsagePercentage();
    
    if (percentage >= 90) return 'critical';
    if (percentage >= 70) return 'warning';
    return 'good';
  };

  const isNearLimit = () => getUsagePercentage() >= 80;
  const isAtLimit = () => getRemainingPages() <= 0;

  return {
    stats,
    alerts,
    loading,
    error,
    hasAlerts,
    highPriorityAlerts,
    usagePercentage: getUsagePercentage(),
    remainingPages: getRemainingPages(),
    usageStatus: getUsageStatus(),
    isNearLimit: isNearLimit(),
    isAtLimit: isAtLimit(),
    refetch,
  };
}