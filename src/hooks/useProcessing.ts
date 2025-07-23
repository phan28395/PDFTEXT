import { useState, useEffect, useCallback } from 'react';
import { 
  getProcessingHistory, 
  deleteProcessingRecord, 
  ProcessingRecord, 
  ProcessingHistoryResponse,
  ProcessingError 
} from '@/api/processing';
import { useAuth } from './useAuth';
import toast from 'react-hot-toast';

export interface UseProcessingHistoryOptions {
  autoFetch?: boolean;
  pageSize?: number;
}

export interface UseProcessingHistoryReturn {
  // Data
  records: ProcessingRecord[];
  pagination: ProcessingHistoryResponse['pagination'] | null;
  
  // State
  loading: boolean;
  error: ProcessingError | null;
  
  // Actions
  fetchHistory: (page?: number, filters?: { status?: string; search?: string }) => Promise<void>;
  deleteRecord: (recordId: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
  
  // Filters
  setStatusFilter: (status: string) => void;
  setSearchFilter: (search: string) => void;
  statusFilter: string;
  searchFilter: string;
}

/**
 * Hook for managing processing history
 */
export function useProcessingHistory(options: UseProcessingHistoryOptions = {}): UseProcessingHistoryReturn {
  const { autoFetch = true, pageSize = 10 } = options;
  const { user, loading: authLoading } = useAuth();
  
  // State
  const [records, setRecords] = useState<ProcessingRecord[]>([]);
  const [pagination, setPagination] = useState<ProcessingHistoryResponse['pagination'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ProcessingError | null>(null);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Fetch processing history
  const fetchHistory = useCallback(async (
    page: number = currentPage, 
    filters: { status?: string; search?: string } = {}
  ) => {
    if (!user || authLoading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const status = filters.status ?? statusFilter;
      const search = filters.search ?? searchFilter;
      
      const response = await getProcessingHistory(
        page,
        pageSize,
        status !== 'all' ? status : undefined,
        search || undefined
      );
      
      setRecords(response.records);
      setPagination(response.pagination);
      setCurrentPage(page);
      
    } catch (err: any) {
      console.error('Failed to fetch processing history:', err);
      setError(err);
      toast.error(err.message || 'Failed to load processing history');
    } finally {
      setLoading(false);
    }
  }, [user, authLoading, currentPage, pageSize, statusFilter, searchFilter]);

  // Delete a processing record
  const deleteRecord = useCallback(async (recordId: string) => {
    if (!user) return;
    
    try {
      await deleteProcessingRecord(recordId);
      
      // Remove the record from the local state
      setRecords(prev => prev.filter(record => record.id !== recordId));
      
      // Update pagination if needed
      if (pagination) {
        setPagination(prev => prev ? {
          ...prev,
          total: prev.total - 1
        } : null);
      }
      
      toast.success('Processing record deleted successfully');
      
      // Refresh if the current page is now empty
      if (records.length === 1 && pagination && pagination.page > 1) {
        await fetchHistory(pagination.page - 1);
      }
      
    } catch (err: any) {
      console.error('Failed to delete processing record:', err);
      toast.error(err.message || 'Failed to delete processing record');
    }
  }, [user, records, pagination, fetchHistory]);

  // Refresh history (reload current page)
  const refreshHistory = useCallback(async () => {
    await fetchHistory(currentPage);
  }, [fetchHistory, currentPage]);

  // Auto-fetch on mount and when dependencies change
  useEffect(() => {
    if (autoFetch && user && !authLoading) {
      fetchHistory();
    }
  }, [user, authLoading, autoFetch, fetchHistory]);

  // Fetch when filters change
  useEffect(() => {
    if (user && !authLoading) {
      fetchHistory(1, { status: statusFilter, search: searchFilter });
    }
  }, [statusFilter, searchFilter, user, authLoading]);

  return {
    // Data
    records,
    pagination,
    
    // State
    loading,
    error,
    
    // Actions
    fetchHistory,
    deleteRecord,
    refreshHistory,
    
    // Filters
    setStatusFilter,
    setSearchFilter,
    statusFilter,
    searchFilter,
  };
}

export interface UseRecentProcessingReturn {
  recentRecords: ProcessingRecord[];
  loading: boolean;
  error: ProcessingError | null;
  refreshRecent: () => Promise<void>;
}

/**
 * Hook for getting recent processing records (last 5)
 */
export function useRecentProcessing(): UseRecentProcessingReturn {
  const { user, loading: authLoading } = useAuth();
  const [recentRecords, setRecentRecords] = useState<ProcessingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ProcessingError | null>(null);

  const refreshRecent = useCallback(async () => {
    if (!user || authLoading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const response = await getProcessingHistory(1, 5);
      setRecentRecords(response.records);
      
    } catch (err: any) {
      console.error('Failed to fetch recent processing records:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user && !authLoading) {
      refreshRecent();
    }
  }, [user, authLoading, refreshRecent]);

  return {
    recentRecords,
    loading,
    error,
    refreshRecent
  };
}

export interface ProcessingStats {
  totalFiles: number;
  totalPages: number;
  thisMonth: {
    files: number;
    pages: number;
  };
  averageProcessingTime: number;
  successRate: number;
}

export interface UseProcessingStatsReturn {
  stats: ProcessingStats | null;
  loading: boolean;
  error: ProcessingError | null;
  refreshStats: () => Promise<void>;
}

/**
 * Hook for processing statistics
 */
export function useProcessingStats(): UseProcessingStatsReturn {
  const { user, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<ProcessingStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ProcessingError | null>(null);

  const refreshStats = useCallback(async () => {
    if (!user || authLoading) return;
    
    try {
      setLoading(true);
      setError(null);
      
      // Get all processing history for stats calculation
      const response = await getProcessingHistory(1, 1000); // Large limit to get all records
      const records = response.records;
      
      if (records.length === 0) {
        setStats({
          totalFiles: 0,
          totalPages: 0,
          thisMonth: { files: 0, pages: 0 },
          averageProcessingTime: 0,
          successRate: 0
        });
        return;
      }

      // Calculate stats
      const now = new Date();
      const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      
      const totalFiles = records.length;
      const totalPages = records.reduce((sum, record) => sum + (record.pages_processed || 0), 0);
      
      const thisMonthRecords = records.filter(record => 
        new Date(record.created_at) >= thisMonth
      );
      const thisMonthFiles = thisMonthRecords.length;
      const thisMonthPages = thisMonthRecords.reduce((sum, record) => sum + (record.pages_processed || 0), 0);
      
      const completedRecords = records.filter(record => record.status === 'completed');
      const avgProcessingTime = completedRecords.length > 0
        ? completedRecords.reduce((sum, record) => sum + (record.processing_time || 0), 0) / completedRecords.length
        : 0;
      
      const successRate = records.length > 0 
        ? (completedRecords.length / records.length) * 100
        : 0;

      setStats({
        totalFiles,
        totalPages,
        thisMonth: {
          files: thisMonthFiles,
          pages: thisMonthPages
        },
        averageProcessingTime: avgProcessingTime,
        successRate: Math.round(successRate * 10) / 10
      });
      
    } catch (err: any) {
      console.error('Failed to fetch processing stats:', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    if (user && !authLoading) {
      refreshStats();
    }
  }, [user, authLoading, refreshStats]);

  return {
    stats,
    loading,
    error,
    refreshStats
  };
}