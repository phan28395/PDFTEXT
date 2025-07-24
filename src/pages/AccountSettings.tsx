import React, { useState } from 'react';
import { 
  User, 
  CreditCard, 
  BarChart3, 
  FileText, 
  MessageCircle, 
  Settings as SettingsIcon,
  Shield,
  Bell,
  Download
} from 'lucide-react';
import UserProfile from '@/components/UserProfile';
import BillingHistory from '@/components/BillingHistory';
import UsageStatsDashboard from '@/components/UsageStatsDashboard';
import CustomerSupport from '@/components/CustomerSupport';
import PrivacySettings from '@/components/PrivacySettings';

type SettingsTab = 'profile' | 'billing' | 'usage' | 'support' | 'privacy' | 'notifications';

interface TabConfig {
  id: SettingsTab;
  name: string;
  icon: React.ComponentType<any>;
  description: string;
}

const SETTINGS_TABS: TabConfig[] = [
  {
    id: 'profile',
    name: 'Profile',
    icon: User,
    description: 'Personal information and account details'
  },
  {
    id: 'billing',
    name: 'Billing History',
    icon: FileText,
    description: 'View invoices and payment history'
  },
  {
    id: 'usage',
    name: 'Usage Statistics',
    icon: BarChart3,
    description: 'Detailed usage analytics and trends'
  },
  {
    id: 'support',
    name: 'Support',
    icon: MessageCircle,
    description: 'Get help and contact customer support'
  },
  {
    id: 'privacy',
    name: 'Privacy & Data',
    icon: Shield,
    description: 'Privacy settings and data management'
  },
  {
    id: 'notifications',
    name: 'Notifications',
    icon: Bell,
    description: 'Email and notification preferences'
  }
];

const SecuritySettings: React.FC = () => {
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [loginAlerts, setLoginAlerts] = useState(true);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Shield className="mr-3 h-6 w-6 text-green-600" />
            Security Settings
          </h2>
          <p className="text-gray-600 mt-1">Manage your account security and privacy settings</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Two-Factor Authentication */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={twoFactorEnabled}
                  onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Email Security Notifications */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Email Security Notifications</h3>
              <p className="text-sm text-gray-600">Receive emails about security-related activities</p>
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={(e) => setEmailNotifications(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Login Alerts */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium text-gray-900">Login Alerts</h3>
              <p className="text-sm text-gray-600">Get notified when someone logs into your account</p>
            </div>
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={loginAlerts}
                  onChange={(e) => setLoginAlerts(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium text-gray-900 mb-4">Active Sessions</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div>
                  <p className="font-medium text-gray-900">Current Session</p>
                  <p className="text-sm text-gray-600">Chrome on Windows • Your current session</p>
                </div>
                <span className="text-sm text-green-600 font-medium">Active</span>
              </div>
            </div>
            <button className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm">
              Sign Out All Other Sessions
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotificationSettings: React.FC = () => {
  const [emailDigest, setEmailDigest] = useState(true);
  const [usageAlerts, setUsageAlerts] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);
  const [processingComplete, setProcessingComplete] = useState(true);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900 flex items-center">
            <Bell className="mr-3 h-6 w-6 text-blue-600" />
            Notification Preferences
          </h2>
          <p className="text-gray-600 mt-1">Choose what notifications you want to receive</p>
        </div>

        <div className="p-6 space-y-6">
          {/* Email Notifications */}
          <div>
            <h3 className="font-medium text-gray-900 mb-4">Email Notifications</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Processing Complete</h4>
                  <p className="text-sm text-gray-600">Get notified when your PDF processing is complete</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={processingComplete}
                    onChange={(e) => setProcessingComplete(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Usage Alerts</h4>
                  <p className="text-sm text-gray-600">Get notified when you're approaching your limits</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usageAlerts}
                    onChange={(e) => setUsageAlerts(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Weekly Digest</h4>
                  <p className="text-sm text-gray-600">Weekly summary of your usage and activity</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={emailDigest}
                    onChange={(e) => setEmailDigest(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">Product Updates & Tips</h4>
                  <p className="text-sm text-gray-600">Learn about new features and helpful tips</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={marketingEmails}
                    onChange={(e) => setMarketingEmails(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const AccountSettings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return <UserProfile />;
      case 'billing':
        return <BillingHistory />;
      case 'usage':
        return <UsageStatsDashboard />;
      case 'support':
        return <CustomerSupport />;
      case 'privacy':
        return <PrivacySettings />;
      case 'notifications':
        return <NotificationSettings />;
      default:
        return <UserProfile />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 p-6">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border p-6 sticky top-6">
              <div className="flex items-center mb-6">
                <SettingsIcon className="h-6 w-6 text-blue-600 mr-3" />
                <h1 className="text-xl font-bold text-gray-900">Account Settings</h1>
              </div>
              
              <nav className="space-y-2">
                {SETTINGS_TABS.map((tab) => {
                  const IconComponent = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-3 py-3 text-left rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <IconComponent className={`h-5 w-5 mr-3 ${
                        activeTab === tab.id ? 'text-blue-700' : 'text-gray-400'
                      }`} />
                      <div>
                        <p className="font-medium">{tab.name}</p>
                        <p className="text-xs opacity-75">{tab.description}</p>
                      </div>
                    </button>
                  );
                })}
              </nav>

              {/* Quick Actions */}
              <div className="mt-8 pt-6 border-t">
                <h3 className="text-sm font-medium text-gray-900 mb-3">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </button>
                  <button 
                    onClick={() => setActiveTab('support')}
                    className="w-full flex items-center px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Contact Support
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AccountSettings;