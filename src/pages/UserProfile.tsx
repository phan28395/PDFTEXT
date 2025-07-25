import { useState } from 'react';
import { User, Mail, Calendar, FileText, CreditCard, Activity, Download, DollarSign, TrendingUp, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser, useProcessingHistory } from '@/hooks/useDatabase';
import { DashboardLayout } from '@/components/Layout';
import { formatFileSize } from '@/api/processing';

export default function UserProfile() {
  const { user } = useAuth();
  const { user: userData, loading: userLoading } = useUser(user?.id);
  const { stats, recentActivity, loading: statsLoading } = useProcessingHistory(user?.id);
  const [activeTab, setActiveTab] = useState<'overview' | 'usage' | 'billing'>('overview');

  if (!user) {
    return (
      <DashboardLayout>
        <div className="p-6 text-center">
          <p>Please log in to view your profile.</p>
        </div>
      </DashboardLayout>
    );
  }

  const costPerPage = 1.2; // cents
  const freePages = userData?.free_pages_remaining || 0;
  const creditBalance = userData?.credit_balance || 0;
  const totalPagesProcessed = userData?.pages_processed || 0;
  const joinDate = userData?.created_at ? new Date(userData.created_at) : new Date();

  // Calculate total spent
  const paidPagesProcessed = Math.max(0, totalPagesProcessed - (5 - freePages)); // 5 initial free pages
  const totalSpent = paidPagesProcessed * costPerPage;

  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{user.email?.split('@')[0]}</h1>
                <p className="text-gray-600 flex items-center mt-1">
                  <Mail className="h-4 w-4 mr-2" />
                  {user.email}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-500">Member since</p>
              <p className="font-medium text-gray-900">
                {joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'overview'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('usage')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'usage'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Usage Details
            </button>
            <button
              onClick={() => setActiveTab('billing')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'billing'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Billing & Credits
            </button>
          </nav>
        </div>

        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Current Balance</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(creditBalance / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {Math.floor(creditBalance / costPerPage)} pages available
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Free Pages</p>
                    <p className="text-2xl font-bold text-gray-900">{freePages}</p>
                    <p className="text-xs text-gray-500 mt-1">Remaining</p>
                  </div>
                  <CreditCard className="h-8 w-8 text-blue-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Processed</p>
                    <p className="text-2xl font-bold text-gray-900">{totalPagesProcessed}</p>
                    <p className="text-xs text-gray-500 mt-1">Pages</p>
                  </div>
                  <FileText className="h-8 w-8 text-purple-600" />
                </div>
              </div>

              <div className="bg-white rounded-lg border p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900">
                      ${(totalSpent / 100).toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Lifetime</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-indigo-600" />
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-lg border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                  <Activity className="h-5 w-5 mr-2" />
                  Recent Activity
                </h2>
              </div>
              <div className="divide-y">
                {recentActivity.length > 0 ? (
                  recentActivity.slice(0, 5).map((activity) => (
                    <div key={activity.id} className="p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{activity.filename}</p>
                          <p className="text-sm text-gray-500">
                            {activity.pages_processed} pages • {new Date(activity.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          activity.processing_status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : activity.processing_status === 'failed'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {activity.processing_status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500">
                    No recent activity
                  </div>
                )}
              </div>
              {recentActivity.length > 5 && (
                <div className="p-4 text-center border-t">
                  <Link to="/usage-history" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                    View all activity →
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-6">
            {/* Usage Stats */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Usage Statistics</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Processing Summary</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Files Processed</span>
                      <span className="font-medium">{stats?.total_files || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Total Pages Processed</span>
                      <span className="font-medium">{stats?.total_pages || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Successful Conversions</span>
                      <span className="font-medium text-green-600">{stats?.successful_files || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Failed Conversions</span>
                      <span className="font-medium text-red-600">{stats?.failed_files || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Processing Time</span>
                      <span className="font-medium">
                        {stats?.avg_processing_time ? `${(stats.avg_processing_time / 1000).toFixed(1)}s` : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-4">Usage Breakdown</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Free Pages Used</span>
                      <span className="font-medium">{5 - freePages} of 5</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Paid Pages Used</span>
                      <span className="font-medium">{paidPagesProcessed}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Average Pages per File</span>
                      <span className="font-medium">
                        {stats?.total_files ? Math.round(stats.total_pages / stats.total_files) : 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Usage Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-medium text-blue-900 mb-2 flex items-center">
                <AlertCircle className="h-5 w-5 mr-2" />
                Usage Tips
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li>• Process only the pages you need to save credits</li>
                <li>• Batch similar documents together for better organization</li>
                <li>• Download your results immediately - files are deleted after 24 hours</li>
                <li>• Your first 5 pages are always free!</li>
              </ul>
            </div>
          </div>
        )}

        {activeTab === 'billing' && (
          <div className="space-y-6">
            {/* Current Balance */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Credit Balance</h2>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <p className="text-3xl font-bold text-gray-900">${(creditBalance / 100).toFixed(2)}</p>
                  <p className="text-gray-600">Available credits</p>
                </div>
                <Link
                  to="/account-settings"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Add Credits
                </Link>
              </div>
              
              {/* Credit Breakdown */}
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Pages available</span>
                  <span className="font-medium">{Math.floor(creditBalance / costPerPage)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost per page</span>
                  <span className="font-medium">$0.012</span>
                </div>
                {freePages > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Free pages remaining</span>
                    <span className="font-medium text-green-600">{freePages}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Pricing Info */}
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Pay-As-You-Go Pricing</h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-5 w-5 text-green-500 mt-0.5">✓</div>
                  <div>
                    <p className="font-medium text-gray-900">No monthly fees</p>
                    <p className="text-sm text-gray-600">Only pay for what you use</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-5 w-5 text-green-500 mt-0.5">✓</div>
                  <div>
                    <p className="font-medium text-gray-900">$0.012 per page</p>
                    <p className="text-sm text-gray-600">Same low price for all document types</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-5 w-5 text-green-500 mt-0.5">✓</div>
                  <div>
                    <p className="font-medium text-gray-900">5 free pages to start</p>
                    <p className="text-sm text-gray-600">Try our service risk-free</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-5 w-5 text-green-500 mt-0.5">✓</div>
                  <div>
                    <p className="font-medium text-gray-900">Credits never expire</p>
                    <p className="text-sm text-gray-600">Use them whenever you need</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Download Data */}
            <div className="bg-gray-50 rounded-lg border p-6">
              <h3 className="font-medium text-gray-900 mb-3">Your Data</h3>
              <p className="text-sm text-gray-600 mb-4">
                You can download all your data at any time. We believe in data ownership and transparency.
              </p>
              <button className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 font-medium text-sm">
                <Download className="h-4 w-4" />
                <span>Export usage history (CSV)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}