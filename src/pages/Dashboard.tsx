import { 
  FileText, 
  Upload, 
  BarChart3, 
  Clock, 
  Calendar,
  AlertCircle,
  Crown,
  Plus
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { DashboardLayout } from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import FileUpload from '@/components/FileUpload';

export default function Dashboard() {
  const { user } = useAuth();
  const { user: userData, loading: userLoading } = useUser(user?.id);

  // Calculate usage statistics - pay per use model with free trial
  const creditBalance = userData?.credit_balance || 0; // Credits in cents
  const freePages = userData?.free_pages_remaining || 5; // Default 5 free pages
  const costPerPage = 1.2; // 1.2 cents per page ($0.012)
  const hasCredits = creditBalance >= costPerPage || freePages > 0;
  const isTrialUser = freePages > 0;

  return (
    <DashboardLayout>
      <ErrorBoundary>
        <div className="p-6 space-y-6">
          {/* Quick Upload Section */}
          {hasCredits && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-100">
              <div className="max-w-3xl mx-auto">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Convert PDF to Text
                  </h2>
                  <p className="text-gray-600">
                    {isTrialUser ? 
                      `Try for free! ${freePages} pages remaining, then $0.012 per page` :
                      'Upload your PDF file and extract text instantly with AI-powered processing'
                    }
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
              {isTrialUser ? 
                `${freePages} free pages remaining, then $0.012 per page` :
                'Process PDFs with our pay-per-use model at $0.012 per page'
              }
            </p>
          </div>
          <div className="mt-4 sm:mt-0">
            {hasCredits ? (
              <Link
                to="/batch"
                className="bg-blue-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Upload PDF</span>
                <span className="sm:hidden">Upload</span>
              </Link>
            ) : (
              <Link
                to="/account-settings"
                className="bg-green-600 text-white px-4 sm:px-6 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center text-sm sm:text-base"
              >
                <Crown className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Add Credits</span>
                <span className="sm:hidden">Add Credits</span>
              </Link>
            )}
          </div>
        </div>

        {/* Free Trial or Credit Balance Alert */}
        {isTrialUser && freePages <= 2 && (
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200 text-blue-600">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-3" />
              <div className="flex-1">
                <h3 className="font-medium">
                  {freePages === 0 ? 'Free Trial Completed' : `${freePages} Free Pages Remaining`}
                </h3>
                <p className="text-sm mt-1">
                  {freePages === 0 ? 
                    'Add credits to continue processing at just $0.012 per page.' :
                    `Try our service risk-free! After your free pages, processing costs just $0.012 per page.`
                  }
                </p>
              </div>
              <Link
                to="/account-settings"
                className="ml-4 text-sm underline hover:no-underline"
              >
                Add Credits
              </Link>
            </div>
          </div>
        )}
        {!isTrialUser && creditBalance < 500 && (
          <div className={`border rounded-lg p-4 ${getCreditColor()}`}>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-3" />
              <div className="flex-1">
                <h3 className="font-medium">
                  {creditBalance < 100 ? 'Low Credit Balance' : 'Credit Balance Running Low'}
                </h3>
                <p className="text-sm mt-1">
                  You have ${(creditBalance / 100).toFixed(2)} in credits remaining. 
                  {creditBalance < costPerPage ? ' Add credits to continue processing.' : ` Enough for ${Math.floor(creditBalance / costPerPage)} pages.`}
                </p>
              </div>
              <Link
                to="/account-settings"
                className="ml-4 text-sm underline hover:no-underline"
              >
                Add Credits
              </Link>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Available Pages */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Available Pages</p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900">
                  {userLoading ? '...' : totalAvailablePages}
                </p>
                <div className="text-sm text-gray-500">
                  {isTrialUser ? (
                    <>
                      <span className="text-green-600 font-medium">{freePages} free</span>
                      {creditBalance > 0 && <span> + {Math.floor(creditBalance / costPerPage)} paid</span>}
                    </>
                  ) : (
                    <span>${(creditBalance / 100).toFixed(2)} balance</span>
                  )}
                </div>
              </div>
              <div className={`p-3 rounded-lg ${
                isTrialUser ? 'bg-green-100' :
                creditBalance < 100 ? 'bg-red-100' : 
                creditBalance < 500 ? 'bg-yellow-100' : 'bg-green-100'
              }`}>
                <Crown className={`h-6 w-6 sm:h-8 sm:w-8 ${
                  isTrialUser ? 'text-green-600' :
                  creditBalance < 100 ? 'text-red-600' : 
                  creditBalance < 500 ? 'text-yellow-600' : 'text-green-600'
                }`} />
              </div>
            </div>
          </div>

          {/* Pages Processed */}
          <div className="bg-white p-4 sm:p-6 rounded-lg shadow-sm border">
            <div className="flex items-center">
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-600">Pages Processed</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">
                  {userLoading ? '...' : pagesUsed}
                </p>
                <p className="text-sm text-green-600 mt-1">
                  Total lifetime pages
                </p>
              </div>
              <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
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



        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}