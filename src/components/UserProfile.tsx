import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { User, Mail, Lock, Trash2, Save, Edit, X, Shield, Calendar } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase, handleSupabaseError } from '@/lib/supabase';
import { User as UserType } from '@/types/database';
import { LoadingSpinner } from './LoadingSpinner';

interface UserProfile {
  full_name: string | null;
  email: string;
  created_at: string;
  subscription_status: string;
  subscription_plan: string;
  pages_used: number;
  pages_limit: number;
  pages_processed_this_month: number;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

interface AccountDeletionData {
  password: string;
  confirmDeletion: string;
  reason: string;
}

const UserProfileComponent: React.FC = () => {
  const { user: authUser, logout } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'account'>('profile');
  
  // Profile editing states
  const [isEditing, setIsEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState<{ full_name: string; email: string }>({ full_name: '', email: '' });
  const [saving, setSaving] = useState(false);
  
  // Password change states
  const [passwordData, setPasswordData] = useState<PasswordChangeData>({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Account deletion states
  const [showDeletionModal, setShowDeletionModal] = useState(false);
  const [deletionData, setDeletionData] = useState<AccountDeletionData>({ password: '', confirmDeletion: '', reason: '' });
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Load user profile data
  useEffect(() => {
    const loadUserProfile = async () => {
      if (!authUser) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (error) {
          console.error('Error loading profile:', error);
          toast.error('Failed to load profile');
          return;
        }

        if (data) {
          setUserProfile(data);
          setEditedProfile({
            full_name: data.full_name || '',
            email: data.email || ''
          });
        }
      } catch (error) {
        console.error('Profile loading error:', error);
        toast.error('Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, [authUser]);

  // Save profile changes
  const handleSaveProfile = async () => {
    if (!authUser || !userProfile) return;
    
    setSaving(true);
    try {
      // Update profile in database
      const { error: profileError } = await supabase
        .from('users')
        .update({
          full_name: editedProfile.full_name.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', authUser.id);

      if (profileError) {
        throw profileError;
      }

      // Update email if changed (requires Supabase auth update)
      if (editedProfile.email !== userProfile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: editedProfile.email
        });

        if (emailError) {
          throw emailError;
        }
        
        toast.success('Profile updated! Please check your email to verify the new email address.');
      } else {
        toast.success('Profile updated successfully!');
      }

      // Update local state
      setUserProfile({
        ...userProfile,
        full_name: editedProfile.full_name.trim() || null,
        email: editedProfile.email
      });
      setIsEditing(false);

    } catch (error: any) {
      console.error('Profile update error:', error);
      toast.error(handleSupabaseError(error, 'profile update'));
    } finally {
      setSaving(false);
    }
  };

  // Handle password change
  const handlePasswordChange = async () => {
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 8) {
      toast.error('New password must be at least 8 characters long');
      return;
    }

    setChangingPassword(true);
    try {
      // First verify current password by attempting to sign in
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userProfile?.email || '',
        password: passwordData.currentPassword
      });

      if (verifyError) {
        toast.error('Current password is incorrect');
        setChangingPassword(false);
        return;
      }

      // Update password
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword
      });

      if (error) {
        throw error;
      }

      toast.success('Password updated successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });

    } catch (error: any) {
      console.error('Password change error:', error);
      toast.error(handleSupabaseError(error, 'password change'));
    } finally {
      setChangingPassword(false);
    }
  };

  // Handle account deletion
  const handleAccountDeletion = async () => {
    if (!authUser || !userProfile) return;

    if (deletionData.confirmDeletion !== 'DELETE') {
      toast.error('Please type "DELETE" to confirm account deletion');
      return;
    }

    if (!deletionData.password) {
      toast.error('Please enter your password to confirm deletion');
      return;
    }

    setDeletingAccount(true);
    try {
      // Verify password first
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: userProfile.email,
        password: deletionData.password
      });

      if (verifyError) {
        toast.error('Password is incorrect');
        setDeletingAccount(false);
        return;
      }

      // Call account deletion API
      const response = await fetch('/api/user/delete-account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          reason: deletionData.reason,
          user_id: authUser.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to delete account');
      }

      toast.success('Account deleted successfully');
      
      // Sign out user
      await logout();
      window.location.href = '/';

    } catch (error: any) {
      console.error('Account deletion error:', error);
      toast.error('Failed to delete account. Please contact support.');
    } finally {
      setDeletingAccount(false);
      setShowDeletionModal(false);
    }
  };

  if (loading) {
    return <LoadingSpinner size="lg" />;
  }

  if (!userProfile) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-600">Unable to load profile information</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        {/* Header */}
        <div className="p-6 border-b">
          <h1 className="text-2xl font-bold text-gray-900 flex items-center">
            <User className="mr-3 h-6 w-6 text-blue-600" />
            User Profile
          </h1>
          <p className="text-gray-600 mt-1">Manage your account settings and preferences</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b">
          <nav className="flex">
            <button
              onClick={() => setActiveTab('profile')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'profile' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Profile Information
            </button>
            <button
              onClick={() => setActiveTab('password')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'password' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Change Password
            </button>
            <button
              onClick={() => setActiveTab('account')}
              className={`px-6 py-3 text-sm font-medium border-b-2 ${
                activeTab === 'account' 
                  ? 'border-blue-600 text-blue-600' 
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Account Settings
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
                  <p className="text-gray-600">Update your personal details and contact information.</p>
                </div>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit Profile
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={editedProfile.full_name}
                      onChange={(e) => setEditedProfile({...editedProfile, full_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={editedProfile.email}
                      onChange={(e) => setEditedProfile({...editedProfile, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your email address"
                    />
                    <p className="text-sm text-gray-500 mt-1">Changing your email will require verification of the new address.</p>
                  </div>
                  <div className="flex space-x-4">
                    <button
                      onClick={handleSaveProfile}
                      disabled={saving}
                      className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {saving ? <LoadingSpinner size="sm" /> : <Save className="mr-2 h-4 w-4" />}
                      Save Changes
                    </button>
                    <button
                      onClick={() => {
                        setIsEditing(false);
                        setEditedProfile({
                          full_name: userProfile.full_name || '',
                          email: userProfile.email
                        });
                      }}
                      className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Full Name</label>
                    <p className="mt-1 text-lg text-gray-900">{userProfile.full_name || 'Not provided'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email Address</label>
                    <p className="mt-1 text-lg text-gray-900 flex items-center">
                      <Mail className="mr-2 h-4 w-4 text-gray-400" />
                      {userProfile.email}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Member Since</label>
                    <p className="mt-1 text-lg text-gray-900 flex items-center">
                      <Calendar className="mr-2 h-4 w-4 text-gray-400" />
                      {new Date(userProfile.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Subscription Status</label>
                    <p className="mt-1 text-lg text-gray-900 flex items-center">
                      <Shield className="mr-2 h-4 w-4 text-gray-400" />
                      <span className={`capitalize px-2 py-1 rounded-full text-sm ${
                        userProfile.subscription_status === 'pro' || userProfile.subscription_status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {userProfile.subscription_plan} Plan
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Change Password</h3>
                <p className="text-gray-600">Update your password to keep your account secure.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your current password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter your new password"
                  />
                  <p className="text-sm text-gray-500 mt-1">Password must be at least 8 characters long.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Confirm your new password"
                  />
                </div>
                <button
                  onClick={handlePasswordChange}
                  disabled={changingPassword}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {changingPassword ? <LoadingSpinner size="sm" /> : <Lock className="mr-2 h-4 w-4" />}
                  Update Password
                </button>
              </div>
            </div>
          )}

          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Account Settings</h3>
                <p className="text-gray-600">Manage your account preferences and deletion options.</p>
              </div>

              {/* Usage Statistics Summary */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="text-md font-medium text-gray-900 mb-4">Usage Summary</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Pages Used (Lifetime)</p>
                    <p className="text-2xl font-bold text-gray-900">{userProfile.pages_used}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Current Limit</p>
                    <p className="text-2xl font-bold text-gray-900">{userProfile.pages_limit}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">This Month</p>
                    <p className="text-2xl font-bold text-gray-900">{userProfile.pages_processed_this_month}</p>
                  </div>
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border-t pt-6">
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h4 className="text-md font-medium text-red-800 mb-2">Danger Zone</h4>
                  <p className="text-sm text-red-600 mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                  </p>
                  <button
                    onClick={() => setShowDeletionModal(true)}
                    className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Account Deletion Modal */}
      {showDeletionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-red-800 mb-4">Delete Account</h3>
            <p className="text-gray-600 mb-4">
              This action cannot be undone. All your data, including processing history and account information, will be permanently deleted.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input
                  type="password"
                  value={deletionData.password}
                  onChange={(e) => setDeletionData({...deletionData, password: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="Enter your password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type "DELETE" to confirm
                </label>
                <input
                  type="text"
                  value={deletionData.confirmDeletion}
                  onChange={(e) => setDeletionData({...deletionData, confirmDeletion: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="DELETE"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason (Optional)</label>
                <textarea
                  value={deletionData.reason}
                  onChange={(e) => setDeletionData({...deletionData, reason: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  rows={3}
                  placeholder="Tell us why you're leaving (optional)"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-4 mt-6">
              <button
                onClick={() => setShowDeletionModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleAccountDeletion}
                disabled={deletingAccount}
                className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deletingAccount ? <LoadingSpinner size="sm" /> : <Trash2 className="mr-2 h-4 w-4" />}
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserProfileComponent;