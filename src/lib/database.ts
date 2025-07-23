import { supabase, handleSupabaseError } from './supabase';
import type { 
  User, 
  UserUpdate, 
  UserWithStats,
  ProcessingRecord, 
  ProcessingRecordInsert, 
  ProcessingRecordUpdate,
  ProcessingRecordWithDuration,
  DatabaseResponse,
  PaginatedResponse,
  ProcessingQueryFilters,
  ProcessingStatus,
  SubscriptionStatus 
} from '@/types/database';

// ================================
// USER OPERATIONS
// ================================

/**
 * Get current user profile with calculated stats
 */
export const getUserProfile = async (userId: string): Promise<DatabaseResponse<UserWithStats>> => {
  try {
    // Get user data
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) throw userError;
    if (!user) return { data: null, error: { code: 'USER_NOT_FOUND', message: 'User not found' } };

    // Get total files processed count
    const { count: totalFiles } = await supabase
      .from('processing_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('processing_status', 'completed');

    // Calculate stats
    const pages_remaining = Math.max(0, user.pages_limit - user.pages_used);
    const usage_percentage = user.pages_limit > 0 ? (user.pages_used / user.pages_limit) * 100 : 0;
    const can_upload = user.subscription_status === 'pro' || pages_remaining > 0;

    const userWithStats: UserWithStats = {
      ...user,
      pages_remaining,
      usage_percentage,
      can_upload,
      total_files_processed: totalFiles || 0,
    };

    return { data: userWithStats, error: null };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'DATABASE_ERROR', 
        message: handleSupabaseError(error, 'get user profile') 
      } 
    };
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (userId: string, updates: UserUpdate): Promise<DatabaseResponse<User>> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'UPDATE_ERROR', 
        message: handleSupabaseError(error, 'update user profile') 
      } 
    };
  }
};

/**
 * Check if user can process specified number of pages
 */
export const canUserProcessPages = async (userId: string, pageCount: number): Promise<DatabaseResponse<boolean>> => {
  try {
    const { data, error } = await supabase
      .rpc('can_user_process_pages', { 
        user_uuid: userId, 
        pages_count: pageCount 
      });

    if (error) throw error;

    return { data: data || false, error: null };
  } catch (error: any) {
    return { 
      data: false, 
      error: { 
        code: error.code || 'PERMISSION_CHECK_ERROR', 
        message: handleSupabaseError(error, 'check user permissions') 
      } 
    };
  }
};

/**
 * Update user pages usage (with validation)
 */
export const updateUserPagesUsage = async (userId: string, pageCount: number): Promise<DatabaseResponse<boolean>> => {
  try {
    const { data, error } = await supabase
      .rpc('update_user_pages_usage', { 
        user_uuid: userId, 
        pages_count: pageCount 
      });

    if (error) throw error;

    return { data: data || false, error: null };
  } catch (error: any) {
    return { 
      data: false, 
      error: { 
        code: error.code || 'USAGE_UPDATE_ERROR', 
        message: handleSupabaseError(error, 'update pages usage') 
      } 
    };
  }
};

/**
 * Upgrade user to pro subscription
 */
export const upgradeUserToPro = async (userId: string, stripeCustomerId: string): Promise<DatabaseResponse<User>> => {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ 
        subscription_status: 'pro' as SubscriptionStatus,
        stripe_customer_id: stripeCustomerId,
        pages_limit: 999999, // Effectively unlimited for pro users
        updated_at: new Date().toISOString()
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'UPGRADE_ERROR', 
        message: handleSupabaseError(error, 'upgrade user to pro') 
      } 
    };
  }
};

// ================================
// PROCESSING HISTORY OPERATIONS
// ================================

/**
 * Create a new processing record
 */
export const createProcessingRecord = async (record: ProcessingRecordInsert): Promise<DatabaseResponse<ProcessingRecord>> => {
  try {
    const { data, error } = await supabase
      .from('processing_history')
      .insert(record)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'CREATE_ERROR', 
        message: handleSupabaseError(error, 'create processing record') 
      } 
    };
  }
};

/**
 * Update processing record status
 */
export const updateProcessingRecord = async (
  recordId: string, 
  updates: ProcessingRecordUpdate
): Promise<DatabaseResponse<ProcessingRecord>> => {
  try {
    const { data, error } = await supabase
      .from('processing_history')
      .update(updates)
      .eq('id', recordId)
      .select()
      .single();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'UPDATE_ERROR', 
        message: handleSupabaseError(error, 'update processing record') 
      } 
    };
  }
};

/**
 * Mark processing as completed
 */
export const completeProcessing = async (
  recordId: string, 
  processingTimeMs: number
): Promise<DatabaseResponse<ProcessingRecord>> => {
  try {
    const updates: ProcessingRecordUpdate = {
      processing_status: 'completed' as ProcessingStatus,
      completed_at: new Date().toISOString(),
      processing_time_ms: processingTimeMs,
    };

    return await updateProcessingRecord(recordId, updates);
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: 'COMPLETION_ERROR', 
        message: handleSupabaseError(error, 'complete processing') 
      } 
    };
  }
};

/**
 * Mark processing as failed
 */
export const failProcessing = async (
  recordId: string, 
  errorMessage: string
): Promise<DatabaseResponse<ProcessingRecord>> => {
  try {
    const updates: ProcessingRecordUpdate = {
      processing_status: 'failed' as ProcessingStatus,
      completed_at: new Date().toISOString(),
      error_message: errorMessage,
    };

    return await updateProcessingRecord(recordId, updates);
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: 'FAILURE_ERROR', 
        message: handleSupabaseError(error, 'mark processing as failed') 
      } 
    };
  }
};

/**
 * Get user's processing history with pagination
 */
export const getUserProcessingHistory = async (
  userId: string,
  filters: ProcessingQueryFilters = {}
): Promise<DatabaseResponse<PaginatedResponse<ProcessingRecordWithDuration>>> => {
  try {
    const { 
      page = 1, 
      per_page = 10, 
      sort_by = 'created_at', 
      sort_order = 'desc',
      status,
      output_format,
      search 
    } = filters;

    let query = supabase
      .from('processing_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId);

    // Apply filters
    if (status) {
      query = query.eq('processing_status', status);
    }

    if (output_format) {
      query = query.eq('output_format', output_format);
    }

    if (search) {
      query = query.or(`filename.ilike.%${search}%,original_filename.ilike.%${search}%`);
    }

    // Apply sorting and pagination
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    const { data, error, count } = await query
      .order(sort_by, { ascending: sort_order === 'asc' })
      .range(from, to);

    if (error) throw error;

    // Format data with calculated fields
    const formattedData: ProcessingRecordWithDuration[] = (data || []).map(record => ({
      ...record,
      processing_duration: record.processing_time_ms 
        ? formatDuration(record.processing_time_ms)
        : undefined,
      file_size_formatted: formatFileSize(record.file_size),
      is_recent: isRecent(record.created_at),
    }));

    const totalPages = Math.ceil((count || 0) / per_page);

    return { 
      data: {
        data: formattedData,
        count: count || 0,
        page,
        per_page,
        total_pages: totalPages,
      }, 
      error: null 
    };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'QUERY_ERROR', 
        message: handleSupabaseError(error, 'get processing history') 
      } 
    };
  }
};

/**
 * Get recent processing activity for dashboard
 */
export const getRecentProcessingActivity = async (userId: string, limit = 5): Promise<DatabaseResponse<ProcessingRecord[]>> => {
  try {
    const { data, error } = await supabase
      .from('processing_history')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return { data: data || [], error: null };
  } catch (error: any) {
    return { 
      data: [], 
      error: { 
        code: error.code || 'QUERY_ERROR', 
        message: handleSupabaseError(error, 'get recent activity') 
      } 
    };
  }
};

/**
 * Get processing statistics for user
 */
export const getProcessingStats = async (userId: string): Promise<DatabaseResponse<{
  total_files: number;
  total_pages: number;
  successful_files: number;
  failed_files: number;
  avg_processing_time: number;
}>> => {
  try {
    const { data, error } = await supabase
      .from('processing_history')
      .select('processing_status, pages_processed, processing_time_ms')
      .eq('user_id', userId);

    if (error) throw error;

    const stats = (data || []).reduce(
      (acc, record) => {
        acc.total_files += 1;
        acc.total_pages += record.pages_processed;
        
        if (record.processing_status === 'completed') {
          acc.successful_files += 1;
          if (record.processing_time_ms) {
            acc.total_processing_time += record.processing_time_ms;
            acc.processing_time_count += 1;
          }
        } else if (record.processing_status === 'failed') {
          acc.failed_files += 1;
        }
        
        return acc;
      },
      {
        total_files: 0,
        total_pages: 0,
        successful_files: 0,
        failed_files: 0,
        total_processing_time: 0,
        processing_time_count: 0,
      }
    );

    return { 
      data: {
        total_files: stats.total_files,
        total_pages: stats.total_pages,
        successful_files: stats.successful_files,
        failed_files: stats.failed_files,
        avg_processing_time: stats.processing_time_count > 0 
          ? Math.round(stats.total_processing_time / stats.processing_time_count)
          : 0,
      }, 
      error: null 
    };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'STATS_ERROR', 
        message: handleSupabaseError(error, 'get processing stats') 
      } 
    };
  }
};

// ================================
// UTILITY FUNCTIONS
// ================================

/**
 * Format file size in human readable format
 */
export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${Math.round(size * 100) / 100} ${units[unitIndex]}`;
};

/**
 * Format duration in human readable format
 */
export const formatDuration = (milliseconds: number): string => {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }

  const seconds = Math.floor(milliseconds / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

/**
 * Check if a timestamp is recent (within last 24 hours)
 */
export const isRecent = (timestamp: string): boolean => {
  const now = new Date();
  const recordTime = new Date(timestamp);
  const diffHours = (now.getTime() - recordTime.getTime()) / (1000 * 60 * 60);
  return diffHours <= 24;
};

/**
 * Validate file hash for deduplication
 */
export const checkFileExists = async (userId: string, fileHash: string): Promise<DatabaseResponse<ProcessingRecord | null>> => {
  try {
    const { data, error } = await supabase
      .from('processing_history')
      .select('*')
      .eq('user_id', userId)
      .eq('file_hash', fileHash)
      .eq('processing_status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return { data, error: null };
  } catch (error: any) {
    return { 
      data: null, 
      error: { 
        code: error.code || 'CHECK_ERROR', 
        message: handleSupabaseError(error, 'check file exists') 
      } 
    };
  }
};