// Generated TypeScript types for Supabase database schema
// This file should be kept in sync with the database schema

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Database enums
export type UserStatus = 'free' | 'pay_per_use';
export type OutputFormat = 'txt' | 'markdown' | 'docx';
export type ProcessingStatus = 'processing' | 'completed' | 'failed' | 'cancelled';

// Database schema types
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          created_at: string;
          updated_at: string;
          user_status: UserStatus;
          pages_used: number;
          pages_limit: number;
          stripe_customer_id: string | null;
          full_name: string | null;
        };
        Insert: {
          id: string;
          email: string;
          created_at?: string;
          updated_at?: string;
          user_status?: UserStatus;
          pages_used?: number;
          pages_limit?: number;
          stripe_customer_id?: string | null;
          full_name?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          created_at?: string;
          updated_at?: string;
          user_status?: UserStatus;
          pages_used?: number;
          pages_limit?: number;
          stripe_customer_id?: string | null;
          full_name?: string | null;
        };
      };
      processing_history: {
        Row: {
          id: string;
          user_id: string;
          filename: string;
          original_filename: string;
          file_size: number;
          pages_processed: number;
          output_format: OutputFormat;
          processing_status: ProcessingStatus;
          error_message: string | null;
          created_at: string;
          completed_at: string | null;
          processing_time_ms: number | null;
          file_hash: string | null;
          was_paid: boolean;
          payment_amount: number;
          stripe_payment_intent_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          filename: string;
          original_filename: string;
          file_size: number;
          pages_processed: number;
          output_format: OutputFormat;
          processing_status?: ProcessingStatus;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
          processing_time_ms?: number | null;
          file_hash?: string | null;
          was_paid?: boolean;
          payment_amount?: number;
          stripe_payment_intent_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          filename?: string;
          original_filename?: string;
          file_size?: number;
          pages_processed?: number;
          output_format?: OutputFormat;
          processing_status?: ProcessingStatus;
          error_message?: string | null;
          created_at?: string;
          completed_at?: string | null;
          processing_time_ms?: number | null;
          file_hash?: string | null;
          was_paid?: boolean;
          payment_amount?: number;
          stripe_payment_intent_id?: string | null;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      update_user_pages_usage: {
        Args: {
          user_uuid: string;
          pages_count: number;
          is_paid?: boolean;
        };
        Returns: boolean;
      };
      can_user_process_pages_free: {
        Args: {
          user_uuid: string;
          pages_count: number;
        };
        Returns: boolean;
      };
    };
    Enums: {
      user_status: UserStatus;
      output_format: OutputFormat;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types for easier use in components
export type User = Database['public']['Tables']['users']['Row'];
export type UserInsert = Database['public']['Tables']['users']['Insert'];
export type UserUpdate = Database['public']['Tables']['users']['Update'];

export type ProcessingRecord = Database['public']['Tables']['processing_history']['Row'];
export type ProcessingRecordInsert = Database['public']['Tables']['processing_history']['Insert'];
export type ProcessingRecordUpdate = Database['public']['Tables']['processing_history']['Update'];

// Extended types with calculated fields
export type UserWithStats = User & {
  pages_remaining: number;
  usage_percentage: number;
  can_upload: boolean;
  total_files_processed: number;
};

export type ProcessingRecordWithDuration = ProcessingRecord & {
  processing_duration?: string;
  file_size_formatted: string;
  is_recent: boolean;
};

// API response types
export interface DatabaseError {
  code: string;
  message: string;
  details?: string;
  hint?: string;
}

export interface DatabaseResponse<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Auth types
export interface AuthUser {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: string;
}

export interface AuthSession {
  user: AuthUser;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

// Utility type for database operations
export type DatabaseTable = keyof Database['public']['Tables'];
export type DatabaseFunction = keyof Database['public']['Functions'];

// Query builder types for better TypeScript support
export interface QueryFilters {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  search?: string;
  status?: ProcessingStatus;
  date_from?: string;
  date_to?: string;
}

export interface UserQueryFilters extends QueryFilters {
  user_status?: UserStatus;
  min_pages_used?: number;
  max_pages_used?: number;
}

export interface ProcessingQueryFilters extends QueryFilters {
  output_format?: OutputFormat;
  min_pages?: number;
  max_pages?: number;
  user_id?: string;
}