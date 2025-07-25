import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import {
  getUserProfile,
  updateUserProfile,
  canUserProcessPages,
  updateUserPagesUsage,
  createProcessingRecord,
  updateProcessingRecord,
  getUserProcessingHistory,
  getRecentProcessingActivity,
  getProcessingStats,
  completeProcessing,
  failProcessing,
  checkFileExists as checkExistingFile,
} from '@/lib/database';
import type {
  UserUpdate,
  UserWithStats,
  ProcessingRecord,
  ProcessingRecordInsert,
  ProcessingRecordUpdate,
  ProcessingRecordWithDuration,
  PaginatedResponse,
  ProcessingQueryFilters,
  DatabaseResponse,
} from '@/types';

// User operations hook
export const useUser = (userId?: string) => {
  const [user, setUser] = useState<UserWithStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUser = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    
    const response = await getUserProfile(id);
    
    if (response.error) {
      setError(response.error.message);
    } else {
      setUser(response.data);
    }
    
    setLoading(false);
  }, []);

  const updateUser = useCallback(async (id: string, updates: UserUpdate) => {
    setLoading(true);
    setError(null);
    
    const response = await updateUserProfile(id, updates);
    
    if (response.error) {
      setError(response.error.message);
      return false;
    } else {
      // Refetch user data after update
      if (response.data) {
        await fetchUser(id);
      }
      return true;
    }
  }, [fetchUser]);

  const checkCanProcessPages = useCallback(async (id: string, pageCount: number) => {
    const response = await canUserProcessPages(id, pageCount);
    return response.data || false;
  }, []);

  const updatePagesUsage = useCallback(async (id: string, pageCount: number) => {
    setLoading(true);
    setError(null);
    
    const response = await updateUserPagesUsage(id, pageCount);
    
    if (response.error) {
      setError(response.error.message);
      setLoading(false);
      return false;
    }
    
    // Refetch user data after usage update
    await fetchUser(id);
    return response.data || false;
  }, [fetchUser]);

  useEffect(() => {
    if (userId && userId !== 'undefined') {
      fetchUser(userId);
    }
  }, [userId, fetchUser]);

  return {
    user,
    loading,
    error,
    refreshUser: () => userId ? fetchUser(userId) : null,
    updateUser,
    checkCanProcessPages,
    updatePagesUsage,
  };
};

// Processing history hook
export const useProcessingHistory = (userId?: string, initialFilters?: ProcessingQueryFilters) => {
  const [history, setHistory] = useState<PaginatedResponse<ProcessingRecordWithDuration> | null>(null);
  const [recentActivity, setRecentActivity] = useState<ProcessingRecord[]>([]);
  const [stats, setStats] = useState<{
    total_files: number;
    total_pages: number;
    successful_files: number;
    failed_files: number;
    avg_processing_time: number;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (id: string, filters?: ProcessingQueryFilters) => {
    setLoading(true);
    setError(null);
    
    const response = await getUserProcessingHistory(id, filters);
    
    if (response.error) {
      setError(response.error.message);
    } else {
      setHistory(response.data);
    }
    
    setLoading(false);
  }, []);

  const fetchRecentActivity = useCallback(async (id: string, limit = 5) => {
    const response = await getRecentProcessingActivity(id, limit);
    
    if (response.error) {
      setError(response.error.message);
    } else {
      setRecentActivity(response.data || []);
    }
  }, []);

  const fetchStats = useCallback(async (id: string) => {
    const response = await getProcessingStats(id);
    
    if (response.error) {
      setError(response.error.message);
    } else {
      setStats(response.data);
    }
  }, []);

  const createRecord = useCallback(async (record: ProcessingRecordInsert) => {
    setLoading(true);
    setError(null);
    
    const response = await createProcessingRecord(record);
    
    if (response.error) {
      setError(response.error.message);
      setLoading(false);
      return null;
    }
    
    // Refresh data after creating record
    if (userId) {
      await Promise.all([
        fetchHistory(userId, initialFilters),
        fetchRecentActivity(userId),
        fetchStats(userId),
      ]);
    }
    
    setLoading(false);
    return response.data;
  }, [userId, initialFilters, fetchHistory, fetchRecentActivity, fetchStats]);

  const updateRecord = useCallback(async (recordId: string, updates: ProcessingRecordUpdate) => {
    setLoading(true);
    setError(null);
    
    const response = await updateProcessingRecord(recordId, updates);
    
    if (response.error) {
      setError(response.error.message);
      setLoading(false);
      return null;
    }
    
    // Refresh data after updating record
    if (userId) {
      await Promise.all([
        fetchHistory(userId, initialFilters),
        fetchRecentActivity(userId),
      ]);
    }
    
    setLoading(false);
    return response.data;
  }, [userId, initialFilters, fetchHistory, fetchRecentActivity]);

  const markCompleted = useCallback(async (recordId: string, processingTimeMs: number) => {
    const response = await completeProcessing(recordId, processingTimeMs);
    
    if (response.error) {
      setError(response.error.message);
      return false;
    }
    
    // Refresh data after completion
    if (userId) {
      await Promise.all([
        fetchHistory(userId, initialFilters),
        fetchRecentActivity(userId),
        fetchStats(userId),
      ]);
    }
    
    return true;
  }, [userId, initialFilters, fetchHistory, fetchRecentActivity, fetchStats]);

  const markFailed = useCallback(async (recordId: string, errorMessage: string) => {
    const response = await failProcessing(recordId, errorMessage);
    
    if (response.error) {
      setError(response.error.message);
      return false;
    }
    
    // Refresh data after failure
    if (userId) {
      await Promise.all([
        fetchHistory(userId, initialFilters),
        fetchRecentActivity(userId),
        fetchStats(userId),
      ]);
    }
    
    return true;
  }, [userId, initialFilters, fetchHistory, fetchRecentActivity, fetchStats]);

  const checkFileExists = useCallback(async (id: string, fileHash: string) => {
    const response = await checkExistingFile(id, fileHash);
    return response.data;
  }, []);

  useEffect(() => {
    if (userId) {
      Promise.all([
        fetchHistory(userId, initialFilters),
        fetchRecentActivity(userId),
        fetchStats(userId),
      ]);
    }
  }, [userId, fetchHistory, fetchRecentActivity, fetchStats, initialFilters]);

  return {
    history,
    recentActivity,
    stats,
    loading,
    error,
    refreshHistory: (filters?: ProcessingQueryFilters) => 
      userId ? fetchHistory(userId, filters || initialFilters) : null,
    refreshRecentActivity: () => userId ? fetchRecentActivity(userId) : null,
    refreshStats: () => userId ? fetchStats(userId) : null,
    createRecord,
    updateRecord,
    markCompleted,
    markFailed,
    checkFileExists,
  };
};

// Generic database operation hook with loading states
export const useAsyncOperation = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const execute = useCallback(async <T>(
    operation: () => Promise<DatabaseResponse<T>>
  ): Promise<T | null> => {
    setLoading(true);
    setError(null);

    try {
      const response = await operation();
      
      if (response.error) {
        setError(response.error.message);
        return null;
      }
      
      return response.data;
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    execute,
    clearError,
  };
};

// Connection test hook
export const useConnectionTest = () => {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [testing, setTesting] = useState(false);

  const testConnection = useCallback(async () => {
    setTesting(true);
    
    try {
      // Simple query to test database connection
      const { error } = await supabase
        .from('users')
        .select('count', { count: 'exact', head: true })
        .limit(0);

      setIsConnected(!error);
    } catch {
      setIsConnected(false);
    } finally {
      setTesting(false);
    }
  }, []);

  useEffect(() => {
    testConnection();
  }, [testConnection]);

  return {
    isConnected,
    testing,
    testConnection,
  };
};

// Export utility functions for direct use
export {
  formatFileSize,
  formatDuration,
  isRecent,
} from '@/lib/database';