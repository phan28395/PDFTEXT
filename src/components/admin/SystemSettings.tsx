import { useState, useEffect } from 'react';
import { Settings, Save, RefreshCw, AlertTriangle, CheckCircle, Eye, EyeOff } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

interface SystemConfig {
  general: {
    siteName: string;
    supportEmail: string;
    maintenanceMode: boolean;
    allowRegistrations: boolean;
    maxFileSize: number; // in MB
    defaultPlan: 'free' | 'pro';
  };
  limits: {
    freePageLimit: number;
    proPageLimit: number;
    uploadRateLimit: number; // per minute
    apiRateLimit: number; // per minute
    maxConcurrentProcessing: number;
  };
  security: {
    enableTwoFactor: boolean;
    passwordMinLength: number;
    sessionTimeout: number; // in hours
    maxLoginAttempts: number;
    lockoutDuration: number; // in minutes
  };
  email: {
    smtpEnabled: boolean;
    smtpHost: string;
    smtpPort: number;
    smtpUser: string;
    smtpPassword: string;
    fromEmail: string;
    fromName: string;
  };
  payments: {
    stripePublishableKey: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    enableTestMode: boolean;
    freeTierDescription: string;
    proTierDescription: string;
    proPrice: number; // in cents
  };
  processing: {
    googleProjectId: string;
    googleCredentials: string;
    processTimeout: number; // in seconds
    enableOCR: boolean;
    ocrLanguages: string[];
    maxRetries: number;
  };
}

export default function SystemSettings() {
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<keyof SystemConfig>('general');
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [showSensitive, setShowSensitive] = useState<{[key: string]: boolean}>({});

  const tabs = [
    { id: 'general' as keyof SystemConfig, name: 'General', icon: '⚙️' },
    { id: 'limits' as keyof SystemConfig, name: 'Limits', icon: '🔢' },
    { id: 'security' as keyof SystemConfig, name: 'Security', icon: '🔒' },
    { id: 'email' as keyof SystemConfig, name: 'Email', icon: '📧' },
    { id: 'payments' as keyof SystemConfig, name: 'Payments', icon: '💳' },
    { id: 'processing' as keyof SystemConfig, name: 'Processing', icon: '🔄' },
  ];

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(null);

      // Mock config data - in a real implementation, this would fetch from your settings API
      const mockConfig: SystemConfig = {
        general: {
          siteName: 'PDF-to-Text SaaS',
          supportEmail: 'support@pdf-to-text.com',
          maintenanceMode: false,
          allowRegistrations: true,
          maxFileSize: 50,
          defaultPlan: 'free'
        },
        limits: {
          freePageLimit: 10,
          proPageLimit: 1000,
          uploadRateLimit: 10,
          apiRateLimit: 60,
          maxConcurrentProcessing: 5
        },
        security: {
          enableTwoFactor: false,
          passwordMinLength: 8,
          sessionTimeout: 24,
          maxLoginAttempts: 5,
          lockoutDuration: 15
        },
        email: {
          smtpEnabled: false,
          smtpHost: 'smtp.gmail.com',
          smtpPort: 587,
          smtpUser: '',
          smtpPassword: '',
          fromEmail: 'noreply@pdf-to-text.com',
          fromName: 'PDF-to-Text'
        },
        payments: {
          stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY || '',
          stripeSecretKey: '••••••••',
          stripeWebhookSecret: '••••••••',
          enableTestMode: true,
          freeTierDescription: '10 pages lifetime, basic features',
          proTierDescription: '1,000 pages monthly, advanced features, priority support',
          proPrice: 999 // $9.99
        },
        processing: {
          googleProjectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
          googleCredentials: '••••••••',
          processTimeout: 300,
          enableOCR: true,
          ocrLanguages: ['en', 'es', 'fr', 'de'],
          maxRetries: 3
        }
      };

      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API delay
      setConfig(mockConfig);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = (section: keyof SystemConfig, key: string, value: any) => {
    if (!config) return;
    
    setConfig(prev => ({
      ...prev!,
      [section]: {
        ...prev![section],
        [key]: value
      }
    }));
    setUnsavedChanges(true);
  };

  const saveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      setError(null);

      // Simulate API call to save config
      await new Promise(resolve => setTimeout(resolve, 1500));

      setUnsavedChanges(false);
      // Show success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const resetConfig = async () => {
    if (!confirm('Are you sure you want to reset all settings to default values? This action cannot be undone.')) {
      return;
    }
    
    await loadConfig();
    setUnsavedChanges(false);
  };

  const toggleSensitive = (key: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center">
          <AlertTriangle className="h-6 w-6 text-red-600 mr-3" />
          <div>
            <h3 className="text-lg font-medium text-red-800">Error Loading Settings</h3>
            <p className="text-red-700 mt-1">{error}</p>
          </div>
        </div>
        <button
          onClick={loadConfig}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!config) return null;

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Site Name</label>
        <input
          type="text"
          value={config.general.siteName}
          onChange={(e) => updateConfig('general', 'siteName', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Support Email</label>
        <input
          type="email"
          value={config.general.supportEmail}
          onChange={(e) => updateConfig('general', 'supportEmail', e.target.value)}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Maximum File Size (MB)</label>
        <input
          type="number"
          min="1"
          max="100"
          value={config.general.maxFileSize}
          onChange={(e) => updateConfig('general', 'maxFileSize', parseInt(e.target.value))}
          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="space-y-4">
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={config.general.maintenanceMode}
            onChange={(e) => updateConfig('general', 'maintenanceMode', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Maintenance Mode</span>
        </label>

        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={config.general.allowRegistrations}
            onChange={(e) => updateConfig('general', 'allowRegistrations', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Allow New Registrations</span>
        </label>
      </div>
    </div>
  );

  const renderLimitsSettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Free Plan Page Limit</label>
          <input
            type="number"
            min="1"
            value={config.limits.freePageLimit}
            onChange={(e) => updateConfig('limits', 'freePageLimit', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Pro Plan Page Limit (Monthly)</label>
          <input
            type="number"
            min="100"
            value={config.limits.proPageLimit}
            onChange={(e) => updateConfig('limits', 'proPageLimit', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload Rate Limit (per minute)</label>
          <input
            type="number"
            min="1"
            value={config.limits.uploadRateLimit}
            onChange={(e) => updateConfig('limits', 'uploadRateLimit', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">API Rate Limit (per minute)</label>
          <input
            type="number"
            min="10"
            value={config.limits.apiRateLimit}
            onChange={(e) => updateConfig('limits', 'apiRateLimit', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Concurrent Processing</label>
          <input
            type="number"
            min="1"
            max="20"
            value={config.limits.maxConcurrentProcessing}
            onChange={(e) => updateConfig('limits', 'maxConcurrentProcessing', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );

  const renderSecuritySettings = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Password Minimum Length</label>
          <input
            type="number"
            min="6"
            max="20"
            value={config.security.passwordMinLength}
            onChange={(e) => updateConfig('security', 'passwordMinLength', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Session Timeout (hours)</label>
          <input
            type="number"
            min="1"
            max="168"
            value={config.security.sessionTimeout}
            onChange={(e) => updateConfig('security', 'sessionTimeout', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Max Login Attempts</label>
          <input
            type="number"
            min="3"
            max="10"
            value={config.security.maxLoginAttempts}
            onChange={(e) => updateConfig('security', 'maxLoginAttempts', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Lockout Duration (minutes)</label>
          <input
            type="number"
            min="5"
            max="60"
            value={config.security.lockoutDuration}
            onChange={(e) => updateConfig('security', 'lockoutDuration', parseInt(e.target.value))}
            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="flex items-center space-x-3">
          <input
            type="checkbox"
            checked={config.security.enableTwoFactor}
            onChange={(e) => updateConfig('security', 'enableTwoFactor', e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <span className="text-sm font-medium text-gray-700">Enable Two-Factor Authentication</span>
        </label>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'general': return renderGeneralSettings();
      case 'limits': return renderLimitsSettings();
      case 'security': return renderSecuritySettings();
      case 'email':
      case 'payments':
      case 'processing':
        return (
          <div className="text-center py-8">
            <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">Settings for {activeTab} coming soon...</p>
            <p className="text-sm text-gray-400 mt-2">This section will be implemented in the next update.</p>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <Settings className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">System Settings</h2>
              <p className="text-sm text-gray-600">Configure your PDF-to-text platform</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {unsavedChanges && (
              <span className="text-sm text-yellow-600 flex items-center space-x-1">
                <AlertTriangle className="h-4 w-4" />
                <span>Unsaved changes</span>
              </span>
            )}
            <button
              onClick={resetConfig}
              className="text-gray-600 hover:text-gray-900 flex items-center space-x-1 text-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reset</span>
            </button>
            <button
              onClick={saveConfig}
              disabled={saving || !unsavedChanges}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <LoadingSpinner size="sm" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Settings Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
}