import React, { useState, useEffect } from 'react';
import { Shield, Download, Trash2, Eye, Settings, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ConsentSetting {
  consent_type: string;
  consented: boolean;
  consent_date: string | null;
  privacy_policy_version: string;
  can_withdraw: boolean;
  name: string;
  description: string;
  required: boolean;
  category: string;
  can_modify: boolean;
}

interface PrivacySettingsProps {
  className?: string;
}

const PrivacySettings: React.FC<PrivacySettingsProps> = ({ className = '' }) => {
  const [consentSettings, setConsentSettings] = useState<ConsentSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchConsentSettings();
  }, []);

  const fetchConsentSettings = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('supabase.auth.token');
      
      const response = await fetch('/api/privacy/consent', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch consent settings');
      }

      const data = await response.json();
      setConsentSettings(data.consent_settings || []);
    } catch (error) {
      console.error('Error fetching consent settings:', error);
      toast.error('Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const updateConsent = async (consentType: string, consented: boolean) => {
    try {
      setUpdating(consentType);
      const token = localStorage.getItem('supabase.auth.token');

      const response = await fetch('/api/privacy/consent', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          consent_type: consentType,
          consented: consented,
          privacy_policy_version: '1.0'
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      const data = await response.json();
      
      // Update local state
      setConsentSettings(prev => 
        prev.map(setting => 
          setting.consent_type === consentType 
            ? { ...setting, consented, consent_date: new Date().toISOString() }
            : setting
        )
      );

      toast.success(`Consent ${consented ? 'granted' : 'withdrawn'} successfully`);
    } catch (error) {
      console.error('Error updating consent:', error);
      toast.error('Failed to update consent setting');
      
      // Revert optimistic update
      setConsentSettings(prev => 
        prev.map(setting => 
          setting.consent_type === consentType 
            ? { ...setting, consented: !consented }
            : setting
        )
      );
    } finally {
      setUpdating(null);
    }
  };

  const exportData = async () => {
    try {
      setIsExporting(true);
      const token = localStorage.getItem('supabase.auth.token');

      const response = await fetch('/api/privacy/export-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export data');
      }

      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1].replace(/"/g, '')
        : `user-data-export-${new Date().toISOString().split('T')[0]}.json`;

      // Download the file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('Data exported successfully');
      setShowExportModal(false);
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const deleteAccount = async () => {
    if (deleteConfirmation !== 'DELETE_ALL_MY_DATA') {
      toast.error('Please type the exact confirmation phrase');
      return;
    }

    if (!deletePassword) {
      toast.error('Please enter your password');
      return;
    }

    try {
      setIsDeleting(true);
      const token = localStorage.getItem('supabase.auth.token');

      const response = await fetch('/api/privacy/delete-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: deletePassword,
          confirmDeletion: deleteConfirmation
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete account');
      }

      const data = await response.json();
      toast.success('Account deleted successfully');
      
      // Clear local storage and redirect
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete account');
    } finally {
      setIsDeleting(false);
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'necessary': return <Shield className="w-5 h-5 text-green-600" />;
      case 'analytics': return <Eye className="w-5 h-5 text-blue-600" />;
      case 'marketing': return <Settings className="w-5 h-5 text-purple-600" />;
      default: return <Settings className="w-5 h-5 text-gray-600" />;
    }
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Privacy Settings Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <Shield className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowExportModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Export Data</span>
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              <span>Delete Account</span>
            </button>
          </div>
        </div>
        <p className="text-gray-600">
          Manage your privacy preferences and exercise your data rights under GDPR.
        </p>
      </div>

      {/* Consent Management */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consent Management</h3>
        <div className="space-y-4">
          {consentSettings.map((setting) => (
            <div key={setting.consent_type} className="flex items-start justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-start space-x-3 flex-1">
                {getCategoryIcon(setting.category)}
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h4 className="font-medium text-gray-900">{setting.name}</h4>
                    {setting.required && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{setting.description}</p>
                  {setting.consent_date && (
                    <p className="text-xs text-gray-500 mt-2">
                      {setting.consented ? 'Consented' : 'Withdrawn'} on {new Date(setting.consent_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                {setting.consented ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                
                {setting.can_modify && (
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={setting.consented}
                      disabled={updating === setting.consent_type}
                      onChange={(e) => updateConsent(setting.consent_type, e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                )}
                
                {updating === setting.consent_type && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* GDPR Rights Information */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Privacy Rights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Access</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Rectification</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Erasure</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Data Portability</span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Restrict Processing</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Object</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Withdraw Consent</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium">Right to Lodge a Complaint</span>
            </div>
          </div>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Contact:</strong> For privacy inquiries, contact privacy@pdftotext.com. 
            We respond to all requests within 72 hours and fulfill data requests within 30 days.
          </p>
        </div>
      </div>

      {/* Data Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Your Data</h3>
            <p className="text-gray-600 mb-4">
              This will download all your personal data in JSON format, including:
            </p>
            <ul className="text-sm text-gray-600 space-y-1 mb-6">
              <li>• Account information</li>
              <li>• Processing history</li>
              <li>• Usage statistics</li>
              <li>• Batch processing data</li>
              <li>• Audit logs (last 90 days)</li>
            </ul>
            <div className="flex space-x-3">
              <button
                onClick={exportData}
                disabled={isExporting}
                className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isExporting ? 'Exporting...' : 'Download Data'}
              </button>
              <button
                onClick={() => setShowExportModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Account Deletion Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
            </div>
            
            <div className="mb-4 p-4 bg-red-50 rounded-lg">
              <p className="text-sm text-red-800 font-medium mb-2">
                ⚠️ This action is irreversible and will permanently delete:
              </p>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• All your account data</li>
                <li>• Processing history and files</li>
                <li>• Usage statistics</li>
                <li>• Subscription information</li>
              </ul>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enter your password:
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Your account password"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type "DELETE_ALL_MY_DATA" to confirm:
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="DELETE_ALL_MY_DATA"
                />
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={deleteAccount}
                disabled={isDeleting || deleteConfirmation !== 'DELETE_ALL_MY_DATA' || !deletePassword}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassword('');
                  setDeleteConfirmation('');
                }}
                className="flex-1 bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PrivacySettings;