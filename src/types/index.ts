// Re-export database types for cleaner imports
export type { 
  User, 
  UserInsert, 
  UserUpdate, 
  UserWithStats,
  ProcessingRecord, 
  ProcessingRecordInsert, 
  ProcessingRecordUpdate,
  ProcessingRecordWithDuration,
  UserStatus,
  OutputFormat,
  ProcessingStatus,
  DatabaseResponse,
  PaginatedResponse,
  AuthUser,
  AuthSession,
  Database,
  ProcessingQueryFilters,
  UserQueryFilters,
  QueryFilters
} from './database';

// File Processing Types
export interface FileUpload {
  file: File;
  progress: number;
  status: 'uploading' | 'processing' | 'completed' | 'error';
  error?: string;
}

export interface ProcessingResult {
  success: boolean;
  text_content?: string;
  pages_count: number;
  download_url?: string;
  error?: string;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Supabase Types
export interface SupabaseUser {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  user_metadata?: Record<string, any>;
}

// Stripe Types
export interface SubscriptionData {
  id: string;
  status: string;
  current_period_end: number;
  customer: string;
}