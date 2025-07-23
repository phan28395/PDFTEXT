import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { 
  Users, 
  Shield, 
  Activity, 
  BarChart3, 
  Settings, 
  Download,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  FileText
} from 'lucide-react';
import SecurityMonitoring from '../components/admin/SecurityMonitoring';
import UserManagement from '../components/admin/UserManagement';
import SystemHealth from '../components/admin/SystemHealth';
import AnalyticsDashboard from '../components/admin/AnalyticsDashboard';
import ReportExports from '../components/admin/ReportExports';
import SystemSettings from '../components/admin/SystemSettings';
import AuditLogging from '../components/admin/AuditLogging';
import ProcessingCleanup from '../components/admin/ProcessingCleanup';

type AdminTab = 'overview' | 'users' | 'security' | 'analytics' | 'health' | 'exports' | 'settings' | 'audit' | 'cleanup';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const { user } = useAuth();

  // Admin overview stats would be fetched from API
  const overviewStats = {
    totalUsers: 1250,
    activeSubscriptions: 345,
    monthlyRevenue: 3456.78,
    processingVolume: 12450,
    systemHealth: 98.5,
    securityEvents: 12
  };

  const tabs = [
    { id: 'overview' as AdminTab, name: 'Overview', icon: BarChart3 },
    { id: 'users' as AdminTab, name: 'User Management', icon: Users },
    { id: 'security' as AdminTab, name: 'Security', icon: Shield },
    { id: 'analytics' as AdminTab, name: 'Analytics', icon: TrendingUp },
    { id: 'health' as AdminTab, name: 'System Health', icon: Activity },
    { id: 'audit' as AdminTab, name: 'Audit Logs', icon: FileText },
    { id: 'cleanup' as AdminTab, name: 'Data Cleanup', icon: Database },
    { id: 'exports' as AdminTab, name: 'Reports', icon: Download },
    { id: 'settings' as AdminTab, name: 'Settings', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'users':
        return <UserManagement />;
      case 'security':
        return <SecurityMonitoring />;
      case 'analytics':
        return <AnalyticsDashboard />;
      case 'health':
        return <SystemHealth />;
      case 'audit':
        return <AuditLogging />;
      case 'cleanup':
        return <ProcessingCleanup />;
      case 'exports':
        return <ReportExports />;
      case 'settings':
        return <SystemSettings />;
      default:
        return renderOverview();
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>
            <p className="text-gray-600 mt-1">Welcome back, {user?.email}</p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Last updated: {new Date().toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{overviewStats.totalUsers.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+12% this month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{overviewStats.activeSubscriptions}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+8% this month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <BarChart3 className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Monthly Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${overviewStats.monthlyRevenue.toFixed(2)}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+15% this month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Processing Volume</p>
              <p className="text-2xl font-bold text-gray-900">{overviewStats.processingVolume.toLocaleString()}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">+22% this month</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Security Events</p>
              <p className="text-2xl font-bold text-gray-900">{overviewStats.securityEvents}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-500 mr-1" />
            <span className="text-yellow-600">3 requires attention</span>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">System Health</p>
              <p className="text-2xl font-bold text-gray-900">{overviewStats.systemHealth}%</p>
            </div>
          </div>
          <div className="mt-4 flex items-center text-sm">
            <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
            <span className="text-green-600">All systems operational</span>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[
              { action: 'New user registration', user: 'john.doe@example.com', time: '2 minutes ago', type: 'user' },
              { action: 'Payment processed', user: 'jane.smith@example.com', time: '5 minutes ago', type: 'payment' },
              { action: 'PDF processed', user: 'alice.johnson@example.com', time: '8 minutes ago', type: 'processing' },
              { action: 'Security alert resolved', user: 'System', time: '15 minutes ago', type: 'security' },
            ].map((activity, index) => (
              <div key={index} className="flex items-center space-x-3 py-2">
                <div className={`w-2 h-2 rounded-full ${
                  activity.type === 'user' ? 'bg-blue-500' :
                  activity.type === 'payment' ? 'bg-green-500' :
                  activity.type === 'processing' ? 'bg-purple-500' :
                  'bg-red-500'
                }`}></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{activity.action}</p>
                  <p className="text-xs text-gray-500">{activity.user}</p>
                </div>
                <div className="text-xs text-gray-400">{activity.time}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Alerts</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-yellow-800">High Usage Detected</p>
                <p className="text-xs text-yellow-700">Processing volume 20% above average</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-red-50 rounded-lg border border-red-200">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">Security Event</p>
                <p className="text-xs text-red-700">Multiple failed login attempts from 192.168.1.100</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <CheckCircle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-800">System Update</p>
                <p className="text-xs text-blue-700">Database backup completed successfully</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <Layout variant="admin">
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600 mt-1">Manage your PDF-to-text SaaS platform</p>
          </div>

          {/* Tab Navigation */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="flex-1">
            {renderTabContent()}
          </div>
        </div>
      </div>
    </Layout>
  );
}