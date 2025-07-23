import React, { useState } from 'react';
import { 
  Clock, 
  Calendar, 
  FileText, 
  BarChart3,
  Filter,
  Download,
  RefreshCw,
  TrendingUp,
  AlertCircle
} from 'lucide-react';
import { DashboardLayout } from '@/components/Layout';
import { UsageDisplay } from '@/components/UsageDisplay';
import { UsageAnalytics } from '@/components/UsageAnalytics';
import { UsageAuditLog } from '@/components/UsageAuditLog';
import { UsageAlertBanner } from '@/components/UsageNotifications';

export default function UsageHistory() {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'audit' | 'alerts'>('overview');

  const tabs = [
    {
      id: 'overview',
      label: 'Overview',
      icon: BarChart3,
      description: 'Current usage and limits'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: TrendingUp,
      description: 'Usage trends and insights'
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: Clock,
      description: 'Detailed activity history'
    },
    {
      id: 'alerts',
      label: 'Alerts',
      icon: AlertCircle,
      description: 'Usage alerts and notifications'
    }
  ];

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Usage Tracking</h1>
            <p className="text-gray-600 mt-1">
              Monitor your PDF processing usage, limits, and activity history
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            <div className="relative">
              <button 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center text-sm"
                onClick={() => {
                  const menu = document.getElementById('usage-export-menu');
                  menu?.classList.toggle('hidden');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Export Report
              </button>
              <div id="usage-export-menu" className="hidden absolute right-0 mt-2 w-56 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => {
                      window.open('/api/export-history?format=csv', '_blank');
                      document.getElementById('usage-export-menu')?.classList.add('hidden');
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                    Export Processing History (CSV)
                  </button>
                  <button
                    onClick={() => {
                      window.open('/api/export-history?format=json', '_blank');
                      document.getElementById('usage-export-menu')?.classList.add('hidden');
                    }}
                    className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                  >
                    Export Processing History (JSON)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Alert Banner */}
        <UsageAlertBanner />

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Tab Content */}
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <UsageDisplay showDetails={true} showAlerts={true} />
                  
                  <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Tips</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                        <div>
                          <p className="font-medium text-gray-900">Optimize document size</p>
                          <p className="text-gray-600">Smaller files process faster and use fewer resources</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                        <div>
                          <p className="font-medium text-gray-900">Batch processing</p>
                          <p className="text-gray-600">Process multiple documents at once to save time</p>
                        </div>
                      </div>
                      <div className="flex items-start">
                        <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-3"></div>
                        <div>
                          <p className="font-medium text-gray-900">Pro plan benefits</p>
                          <p className="text-gray-600">Upgrade for 1000 pages/month and priority processing</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="bg-white rounded-lg border p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity Summary</h3>
                  <UsageAuditLog 
                    maxHeight="max-h-64" 
                    showFilters={false} 
                  />
                </div>
              </div>
            )}

            {activeTab === 'analytics' && (
              <div className="space-y-6">
                <UsageAnalytics showDetailedCharts={true} />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Insights</h3>
                    <div className="space-y-4 text-sm">
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="text-gray-600">Peak usage hour</span>
                        <span className="font-medium">2:00 PM - 3:00 PM</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="text-gray-600">Most active day</span>
                        <span className="font-medium">Tuesday</span>
                      </div>
                      <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="text-gray-600">Average processing time</span>
                        <span className="font-medium">2.3 seconds</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Usage Recommendations</h3>
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-green-50 rounded border border-green-200">
                        <p className="font-medium text-green-800">✓ Good usage pattern</p>
                        <p className="text-green-600 mt-1">You're using the service efficiently</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded border border-blue-200">
                        <p className="font-medium text-blue-800">💡 Tip</p>
                        <p className="text-blue-600 mt-1">Consider upgrading for higher limits</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'audit' && (
              <div className="space-y-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600">
                    <strong>Audit Log:</strong> Complete history of all usage-related activities including 
                    page processing, limit checks, and subscription changes. All activities are logged with 
                    timestamps and user context for security and compliance.
                  </p>
                </div>
                
                <UsageAuditLog 
                  showFilters={true} 
                  maxHeight="max-h-96"
                />
              </div>
            )}

            {activeTab === 'alerts' && (
              <div className="space-y-6">
                <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                  <div className="flex items-center text-yellow-800">
                    <AlertCircle className="h-5 w-5 mr-2" />
                    <div>
                      <p className="font-medium">Usage Alerts & Notifications</p>
                      <p className="text-sm mt-1">
                        Manage how you receive notifications about usage limits and account status
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Settings</h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Limit warnings</p>
                          <p className="text-sm text-gray-600">Alert when approaching usage limits</p>
                        </div>
                        <input type="checkbox" checked readOnly className="rounded border-gray-300" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Daily summaries</p>
                          <p className="text-sm text-gray-600">Daily usage summary emails</p>
                        </div>
                        <input type="checkbox" className="rounded border-gray-300" />
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">Subscription alerts</p>
                          <p className="text-sm text-gray-600">Billing and subscription notifications</p>
                        </div>
                        <input type="checkbox" checked readOnly className="rounded border-gray-300" />
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-lg border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Thresholds</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Warning threshold
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                          <option>70% of limit</option>
                          <option>80% of limit</option>
                          <option>90% of limit</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Critical threshold
                        </label>
                        <select className="w-full px-3 py-2 border border-gray-300 rounded-lg">
                          <option>85% of limit</option>
                          <option>90% of limit</option>
                          <option>95% of limit</option>
                        </select>
                      </div>
                    </div>
                    
                    <button className="w-full mt-6 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
                      Save Preferences
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}