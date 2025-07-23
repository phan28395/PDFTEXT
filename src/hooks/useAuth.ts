import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, handleSupabaseError } from '@/lib/supabase';

// Types for authentication hooks
interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  confirmPassword: string;
}

interface PasswordStrength {
  isValid: boolean;
  score: number;
  feedback: string[];
}

// Password validation function
export const validatePasswordStrength = (password: string): PasswordStrength => {
  const feedback: string[] = [];
  let score = 0;

  // Check length
  if (password.length < 8) {
    feedback.push('Password must be at least 8 characters long');
  } else {
    score += 20;
  }

  // Check for lowercase letters
  if (!/[a-z]/.test(password)) {
    feedback.push('Password must contain at least one lowercase letter');
  } else {
    score += 20;
  }

  // Check for uppercase letters
  if (!/[A-Z]/.test(password)) {
    feedback.push('Password must contain at least one uppercase letter');
  } else {
    score += 20;
  }

  // Check for numbers
  if (!/\d/.test(password)) {
    feedback.push('Password must contain at least one number');
  } else {
    score += 20;
  }

  // Check for special characters
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    feedback.push('Password must contain at least one special character');
  } else {
    score += 20;
  }

  // Additional checks for very strong passwords
  if (password.length >= 12) {
    score += 10;
  }

  return {
    isValid: feedback.length === 0 && password.length >= 8,
    score: Math.min(score, 100),
    feedback,
  };
};

// Email validation function
export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Main authentication hook
export const useAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  });

  useEffect(() => {
    let mounted = true;

    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (mounted) {
          setAuthState({
            user: session?.user ?? null,
            session,
            loading: false,
          });
        }
      } catch (error) {
        console.error('Error getting initial session:', error);
        if (mounted) {
          setAuthState({
            user: null,
            session: null,
            loading: false,
          });
        }
      }
    };

    // Set a timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      if (mounted) {
        console.warn('Auth initialization taking too long, setting loading to false');
        setAuthState(prev => ({
          ...prev,
          loading: false,
        }));
      }
    }, 5000); // 5 second timeout

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (process.env.NODE_ENV === 'development') {
          console.log('Auth state changed:', event, session?.user?.email);
        }
        if (mounted) {
          setAuthState({
            user: session?.user ?? null,
            session,
            loading: false,
          });
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  // Login function
  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const { email, password } = credentials;

      // Client-side validation
      if (!validateEmail(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      if (!password) {
        return { success: false, error: 'Password is required' };
      }

      // Attempt login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: handleSupabaseError(error, 'login') };
      }

      if (!data.user) {
        return { success: false, error: 'Login failed. Please try again.' };
      }

      // Immediately update auth state to prevent spinning wheel
      setAuthState({
        user: data.user,
        session: data.session,
        loading: false,
      });

      return { success: true };
    } catch (error: any) {
      console.error('Login error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  // Register function
  const register = async (credentials: RegisterCredentials): Promise<{ success: boolean; error?: string }> => {
    try {
      const { email, password, confirmPassword } = credentials;

      // Client-side validation
      if (!validateEmail(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.isValid) {
        return { success: false, error: passwordValidation.feedback[0] };
      }

      if (password !== confirmPassword) {
        return { success: false, error: 'Passwords do not match' };
      }

      // Attempt registration
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          // Redirect URL for email verification
          emailRedirectTo: `${window.location.origin}/login?verified=true`,
        },
      });

      if (error) {
        return { success: false, error: handleSupabaseError(error, 'registration') };
      }

      // Check if user needs to verify email
      if (!data.user?.email_confirmed_at) {
        return {
          success: true,
          error: 'Please check your email and click the verification link to complete registration.',
        };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Registration error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  // Logout function
  const logout = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { success: false, error: handleSupabaseError(error, 'logout') };
      }
      return { success: true };
    } catch (error: any) {
      console.error('Logout error:', error);
      return { success: false, error: 'An unexpected error occurred during logout.' };
    }
  };

  // Request password reset
  const resetPassword = async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      if (!validateEmail(email)) {
        return { success: false, error: 'Please enter a valid email address' };
      }

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        return { success: false, error: handleSupabaseError(error, 'password reset') };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Password reset error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  // Google sign-in function
  const signInWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (error) {
        return { success: false, error: handleSupabaseError(error, 'Google sign-in') };
      }

      return { success: true };
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { success: false, error: 'An unexpected error occurred. Please try again.' };
    }
  };

  return {
    ...authState,
    login,
    register,
    logout,
    resetPassword,
    signInWithGoogle,
    isAuthenticated: !!authState.user,
  };
};

// Hook for checking authentication status
export const useAuthGuard = () => {
  const { user, loading } = useAuth();
  
  return {
    isAuthenticated: !!user,
    isLoading: loading,
    user,
  };
};