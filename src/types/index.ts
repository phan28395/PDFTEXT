// User and Authentication Types
export interface User {
  id: string;
  email: string;
  created_at: string;
  subscription_status: 'free' | 'pro';
  pages_used: number;
  pages_limit: number;
  stripe_customer_id?: string;
}

// Processing History Types
export interface ProcessingRecord {
  id: string;
  user_id: string;
  filename: string;
  pages_processed: number;
  output_format: 'txt' | 'markdown' | 'docx';
  created_at: string;
  download_url?: string;
}

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