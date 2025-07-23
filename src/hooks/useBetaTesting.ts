import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export interface BetaUser {
  id: string;
  user_id: string;
  invited_at: string;
  accepted_at?: string;
  status: 'invited' | 'active' | 'completed' | 'dropped_out';
  feedback_count: number;
  last_activity: string;
  invitation_code: string;
  user_type: 'individual' | 'business' | 'developer';
  testing_goals: string[];
  created_at: string;
  updated_at: string;
}

export interface BetaFeedback {
  id: string;
  user_id: string;
  feedback_type: 'bug_report' | 'feature_request' | 'usability' | 'performance' | 'general';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  page_url?: string;
  browser_info?: string;
  screenshot_url?: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  created_at: string;
  updated_at: string;
}

export interface BetaAnalytics {
  total_users: number;
  active_users: number;
  completion_rate: number;
  avg_session_duration: number;
  most_used_features: string[];
  common_issues: string[];
  satisfaction_score: number;
}

export function useBetaTesting() {
  const { user } = useAuth();
  const [isBetaUser, setIsBetaUser] = useState<boolean>(false);
  const [betaUserData, setBetaUserData] = useState<BetaUser | null>(null);
  const [feedback, setFeedback] = useState<BetaFeedback[]>([]);
  const [analytics, setAnalytics] = useState<BetaAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is a beta tester
  useEffect(() => {
    if (user) {
      checkBetaStatus();
    }
  }, [user]);

  const checkBetaStatus = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('beta_users')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking beta status:', error);
        return;
      }

      if (data) {
        setIsBetaUser(true);
        setBetaUserData(data);
      }
    } catch (error) {
      console.error('Error checking beta status:', error);
    } finally {
      setLoading(false);
    }
  };

  const joinBeta = async (invitationCode: string, userType: BetaUser['user_type'], testingGoals: string[]) => {
    if (!user) throw new Error('User must be logged in');

    try {
      // Verify invitation code and check if it's valid
      const { data: invitation, error: inviteError } = await supabase
        .from('beta_invitations')
        .select('*')
        .eq('code', invitationCode)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invitation) {
        throw new Error('Invalid or expired invitation code');
      }

      // Create beta user record
      const { data, error } = await supabase
        .from('beta_users')
        .insert([
          {
            user_id: user.id,
            invitation_code: invitationCode,
            user_type: userType,
            testing_goals: testingGoals,
            status: 'active',
            accepted_at: new Date().toISOString(),
            last_activity: new Date().toISOString()
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Update invitation status
      await supabase
        .from('beta_invitations')
        .update({ status: 'accepted', used_at: new Date().toISOString() })
        .eq('code', invitationCode);

      setIsBetaUser(true);
      setBetaUserData(data);
      
      return data;
    } catch (error) {
      console.error('Error joining beta:', error);
      throw error;
    }
  };

  const submitFeedback = async (feedbackData: Omit<BetaFeedback, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'status'>) => {
    if (!user || !isBetaUser) throw new Error('User must be a beta tester');

    try {
      const { data, error } = await supabase
        .from('beta_feedback')
        .insert([
          {
            ...feedbackData,
            user_id: user.id,
            status: 'open',
            browser_info: navigator.userAgent,
            page_url: window.location.href
          }
        ])
        .select()
        .single();

      if (error) throw error;

      // Update beta user activity and feedback count
      await supabase
        .from('beta_users')
        .update({
          last_activity: new Date().toISOString(),
          feedback_count: betaUserData!.feedback_count + 1
        })
        .eq('user_id', user.id);

      setFeedback(prev => [data, ...prev]);
      setBetaUserData(prev => prev ? { ...prev, feedback_count: prev.feedback_count + 1 } : null);

      return data;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  };

  const getFeedback = async () => {
    if (!user || !isBetaUser) return;

    try {
      const { data, error } = await supabase
        .from('beta_feedback')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setFeedback(data || []);
    } catch (error) {
      console.error('Error fetching feedback:', error);
    }
  };

  const getBetaAnalytics = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_beta_analytics');

      if (error) throw error;

      setAnalytics(data);
      return data;
    } catch (error) {
      console.error('Error fetching beta analytics:', error);
      throw error;
    }
  };

  const updateActivity = async () => {
    if (!user || !isBetaUser) return;

    try {
      await supabase
        .from('beta_users')
        .update({ last_activity: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  };

  const leaveBeta = async (reason?: string) => {
    if (!user || !isBetaUser) return;

    try {
      await supabase
        .from('beta_users')
        .update({
          status: 'dropped_out',
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id);

      // Log the reason if provided
      if (reason) {
        await supabase
          .from('beta_feedback')
          .insert([
            {
              user_id: user.id,
              feedback_type: 'general',
              title: 'Beta Program Exit',
              description: reason,
              severity: 'low',
              category: 'program_feedback',
              status: 'open'
            }
          ]);
      }

      setIsBetaUser(false);
      setBetaUserData(null);
      setFeedback([]);
    } catch (error) {
      console.error('Error leaving beta:', error);
      throw error;
    }
  };

  return {
    isBetaUser,
    betaUserData,
    feedback,
    analytics,
    loading,
    joinBeta,
    submitFeedback,
    getFeedback,
    getBetaAnalytics,
    updateActivity,
    leaveBeta,
    checkBetaStatus
  };
}

// Helper hook for beta feature flags
export function useBetaFeatures() {
  const { isBetaUser } = useBetaTesting();
  
  const isFeatureEnabled = (featureName: string): boolean => {
    // Check if beta testing is enabled in environment
    const betaEnabled = import.meta.env.VITE_BETA_TESTING_ENABLED === 'true';
    
    if (!betaEnabled || !isBetaUser) {
      return false;
    }

    // Define beta features that are available
    const betaFeatures = [
      'advanced_analytics',
      'batch_processing_v2',
      'ai_powered_extraction',
      'custom_templates',
      'api_access',
      'white_label_options'
    ];

    return betaFeatures.includes(featureName);
  };

  return {
    isFeatureEnabled,
    isBetaUser
  };
}