import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Supabase configuration
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables - provide helpful warnings instead of crashing
if (!supabaseUrl) {
  console.warn('Missing VITE_SUPABASE_URL environment variable. Some features may not work.');
}

if (!supabaseAnonKey) {
  console.warn('Missing VITE_SUPABASE_ANON_KEY environment variable. Some features may not work.');
}

// Use dummy values for development if not provided
const fallbackUrl = supabaseUrl || 'https://dummy-project.supabase.co';
const fallbackKey = supabaseAnonKey || 'dummy-key';

// Create Supabase client with type safety
export const supabase = createClient<Database>(fallbackUrl, fallbackKey, {
  auth: {
    // Enable automatic session refresh
    autoRefreshToken: true,
    // Persist session in localStorage (HTTPOnly cookies would be handled server-side)
    persistSession: true,
    // Detect session from URL (for email verification, password reset)
    detectSessionInUrl: true,
    // Set session storage key
    storageKey: 'pdf-to-text-auth-token',
    // Flow type for PKCE (more secure)
    flowType: 'pkce',
  },
  realtime: {
    // Disable realtime for better performance (we don't need it)
    params: {
      eventsPerSecond: 2,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'pdf-to-text-saas@0.0.1',
    },
  },
});

// Helper function to check if user is authenticated
export const isAuthenticated = () => {
  return supabase.auth.getSession().then(({ data: { session } }) => !!session);
};

// Helper function to get current user
export const getCurrentUser = () => {
  return supabase.auth.getUser();
};

// Helper function to get current session
export const getCurrentSession = () => {
  return supabase.auth.getSession();
};

// Auth state change listener setup
export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  return supabase.auth.onAuthStateChange(callback);
};

// Logout helper
export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw new Error(`Logout failed: ${error.message}`);
  }
};

// Error handler for Supabase operations
export const handleSupabaseError = (error: any, operation: string) => {
  console.error(`Supabase ${operation} error:`, error);
  
  // Map common error codes to user-friendly messages
  const errorMessages: Record<string, string> = {
    'invalid_credentials': 'Invalid email or password',
    'email_not_confirmed': 'Please check your email and click the confirmation link',
    'signup_disabled': 'New registrations are currently disabled',
    'email_address_invalid': 'Please enter a valid email address',
    'password_too_short': 'Password must be at least 8 characters',
    'user_already_exists': 'An account with this email already exists',
    'rate_limit_exceeded': 'Too many requests. Please try again later',
  };
  
  return errorMessages[error.code] || error.message || `${operation} failed. Please try again.`;
};

export default supabase;