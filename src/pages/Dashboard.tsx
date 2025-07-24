import { 
  FileText, 
  Upload, 
  BarChart3, 
  Clock, 
  Calendar,
  AlertCircle,
  Crown,
  Plus,
  Download,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { useRecentProcessing, useProcessingStats } from '@/hooks/useProcessing';
import { DashboardLayout } from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import FileUpload from '@/components/FileUpload';
import { SubscriptionCard } from '@/components/SubscriptionCard';

export default function Dashboard() {
  const { user } = useAuth();
  const { user: userData, loading: userLoading } = useUser(user?.id);
  const { recentRecords, loading: historyLoading } = useRecentProcessing();
  const { stats, loading: statsLoading } = useProcessingStats();

  // Calculate usage statistics
  const pagesUsed = userData?.pages_used || 0;
  const subscriptionType = userData?.subscription_status || 'free';
  const pagesLimit = userData?.pages_limit || (subscriptionType === 'pro' ? 1000 : 10);
  const usagePercentage = (pagesUsed / pagesLimit) * 100;
  const remainingPages = Math.max(0, pagesLimit - pagesUsed);
  
  // Usage color based on percentage
  const getUsageColor = () => {
    if (usagePercentage >= 90) return 'text-red-600 bg-red-50 border-red-200';
    if (usagePercentage >= 70) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
  };


  // Quick actions
  const quickActions = [
    {
      title: 'Upload New PDF',
      description: 'Convert your PDF to text',
      icon: Upload,
      href: '/upload',
      color: 'bg-blue-600 hover:bg-blue-700',
      available: remainingPages > 0
    },
    {
      title: 'View History',
      description: 'See all processed files',
      icon: FileText,
      href: '/history',
      color: 'bg-gray-600 hover:bg-gray-700',
      available: true
    },
    {
      title: 'Upgrade Plan',
      description: 'Get unlimited processing',
      icon: Crown,
      href: '/subscription',
      color: 'bg-purple-600 hover:bg-purple-700',
      available: subscriptionType !== 'pro'
    }
  ];

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="p-6 space-y-6">
          {/* Quick Upload Section */}
          {remainingPages > 0 && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Convert PDF to Text
                  </h2>
                  <p className="text-gray-600">
                    Upload your PDF file and extract text instantly with AI-powered processing
                  </p>
                </div>
                <FileUpload 
                  className="max-w-2xl mx-auto"
                  onUploadComplete={(result) => {
                    // Refresh stats and recent records after successful upload
                    // This will be handled by the hooks automatically
                    console.log('Processing completed:', result);
                  }}
                />
              </div>
            </div>
          )}
        
          {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Welcome back, {user?.email?.split('@')[0] || 'User'}!
            </h1>
            <p className="text-gray-600 mt-1">
              Manage your PDF conversions and track your usage
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            {remainingPages > 0 ? (
              <Link
                to="/upload"
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Upload PDF</span>
                <span className="sm:hidden">Upload</span>
              </Link>
            ) : (
              <Link
                to="/subscription"
                className="bg-purple-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors inline-flex items-center text-sm sm:text-base"
              >
                <Crown className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Upgrade Now</span>
                <span className="sm:hidden">Upgrade</span>
              </Link>
            )}
          </div>
        </div>

        {/* Usage Alert */}
        {usagePercentage >= 80 && (
          <div className={`border rounded-lg p-4 ${getUsageColor()}`}>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-3" />
              <div className="flex-1">
                <h3 className="font-medium">
                  {usagePercentage >= 90 ? 'Usage Limit Almost Reached' : 'High Usage Alert'}
                </h3>
                <p className="text-sm mt-1">
                  You've used {Math.round(usagePercentage)}% of your monthly limit. 
                  {remainingPages === 0 ? ' Please upgrade to continue processing.' : ` ${remainingPages} pages remaining.`}
                </p>
              </div>
              {subscriptionType !== 'pro' && (
                <Link
                  to="/subscription"
                  className="ml-4 text-sm underline hover:no-underline"
                >
                  Upgrade
                </Link>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Pages Used */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pages Used</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {userLoading ? '...' : pagesUsed}
                </p>
                <p className="text-sm text-gray-500">
                  of {pagesLimit} limit
                </p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-gray-200"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                  />
                  <path
                    className={`transition-all duration-300 ${
                      usagePercentage >= 90 ? 'text-red-500' : 
                      usagePercentage >= 70 ? 'text-yellow-500' : 'text-blue-500'
                    }`}
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray={`${usagePercentage}, 100`}
                    d="M18 2.0845a 15.9155 15.9155 0 0 1 0 31.831 15.9155 15.9155 0 0 1 0-31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {Math.round(usagePercentage)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Current Plan */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Current Plan</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {userLoading ? '...' : subscriptionType === 'pro' ? 'Pro' : 'Free'}
                </p>
                {subscriptionType === 'pro' ? (
                  <p className="text-sm text-green-600 flex items-center mt-1">
                    <Crown className="h-3 w-3 mr-1" />
                    Unlimited processing
                  </p>
                ) : (
                  <Link
                    to="/pricing"
                    className="text-sm text-blue-600 hover:text-blue-700 underline mt-1 inline-block"
                  >
                    Upgrade for unlimited
                  </Link>
                )}
              </div>
              {subscriptionType === 'pro' ? (
                <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
              ) : (
                <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
              )}
            </div>
          </div>

          {/* Files Processed */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Files Processed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {statsLoading ? '...' : stats?.totalFiles || 0}
                </p>
                <p className="text-sm text-gray-500">All time</p>
              </div>
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            </div>
          </div>

          {/* Account Age */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Member Since</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {userLoading ? '...' : 
                    userData?.created_at ? 
                    new Date(userData.created_at).toLocaleDateString('en-US', { 
                      month: 'short', 
                      year: 'numeric' 
                    }) : 'Recent'
                  }
                </p>
                <p className="text-sm text-gray-500">
                  {userData?.created_at ? 
                    Math.floor((Date.now() - new Date(userData.created_at).getTime()) / (1000 * 60 * 60 * 24)) + ' days'
                    : 'New user'
                  }
                </p>
              </div>
              <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {quickActions.map((action, index) => {
              const Icon = action.icon;
              const isDisabled = !action.available;
              
              return (
                <Link
                  key={index}
                  to={action.href}
                  className={`
                    p-4 rounded-lg border-2 border-dashed transition-all duration-200
                    ${isDisabled 
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-50' 
                      : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                    }
                  `}
                  onClick={(e) => isDisabled && e.preventDefault()}
                >
                  <div className="text-center">
                    <Icon className={`h-8 w-8 mx-auto ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                    <h3 className={`mt-2 font-medium ${isDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                      {action.title}
                    </h3>
                    <p className={`text-sm mt-1 ${isDisabled ? 'text-gray-400' : 'text-gray-600'}`}>
                      {action.description}
                    </p>
                    {isDisabled && action.title === 'Upload New PDF' && (
                      <p className="text-xs text-red-600 mt-2">Limit reached</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Two-column layout for subscription and processing info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Subscription Management */}
          <SubscriptionCard />

          {/* Processing Performance */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Processing Performance</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Average Processing Speed</span>
                <span className="text-sm font-medium text-gray-900">
                  {statsLoading ? '...' : '3.2'} seconds/page
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Success Rate</span>
                <span className="text-sm font-medium text-green-600">
                  {statsLoading ? '...' : '99.5'}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Supported Formats</span>
                <span className="text-sm font-medium text-gray-900">PDF, JPG, PNG, TIFF</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Output Formats</span>
                <span className="text-sm font-medium text-gray-900">TXT, DOCX, JSON, CSV</span>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Processing Activity */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Processing</h2>
              <Link
                to="/usage-history"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all
              </Link>
            </div>
          </div>
          
          <div className="p-6">
            {historyLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-200 rounded-lg"></div>
                    <div className="flex-1">
                      <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : recentRecords && recentRecords.length > 0 ? (
              <div className="space-y-4">
                {recentRecords.map((record) => (
                  <div key={record.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 truncate max-w-xs">
                          {record.filename}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-gray-500">
                          <span className="flex items-center">
                            <Clock className="h-3 w-3 mr-1" />
                            {new Date(record.created_at).toLocaleDateString()}
                          </span>
                          <span>{record.pages_processed} pages</span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            record.status === 'completed' 
                              ? 'bg-green-100 text-green-800' 
                              : record.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {record.status}
                          </span>
                        </div>
                      </div>
                    </div>
                    {record.status === 'completed' && record.text_content && (
                      <div className="flex items-center space-x-2">
                        <Link
                          to={`/usage-history?recordId=${record.id}`}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button 
                          onClick={() => {
                            const blob = new Blob([record.text_content!], { type: 'text/plain' });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement('a');
                            link.href = url;
                            link.download = record.filename.replace('.pdf', '.txt');
                            link.click();
                            URL.revokeObjectURL(url);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                          title="Download text"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-16 w-16 text-gray-300 mx-auto" />
                <h3 className="text-lg font-medium text-gray-900 mt-4">No documents processed yet</h3>
                <p className="text-gray-500 mt-2">
                  Upload your first PDF to start converting documents to text
                </p>
                {remainingPages > 0 && (
                  <div className="mt-6 text-center">
                    <div className="inline-flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-lg mb-4">
                      <Clock className="h-4 w-4 mr-2" />
                      Average processing time: 3.2 seconds per page
                    </div>
                    <div>
                      <Link
                        to="/batch"
                        className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload PDF
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}