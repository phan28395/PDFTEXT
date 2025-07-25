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
import FileUploadDashboard from '@/components/FileUploadDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  const { user: userData, loading: userLoading } = useUser(user?.id);

  // Calculate usage statistics - pay per use model with free trial
  const creditBalance = userData?.credit_balance || 0; // Credits in cents
  const freePages = userData?.free_pages_remaining || 5; // Default 5 free pages
  const costPerPage = 1.2; // 1.2 cents per page ($0.012)
  const hasCredits = creditBalance >= costPerPage || freePages > 0;
  const isTrialUser = freePages > 0;
  
  // Calculate derived statistics
  const totalAvailablePages = freePages + Math.floor(creditBalance / costPerPage);
  const pagesUsed = userData?.pages_processed || 0;
  const stats = { totalFiles: userData?.files_processed || 0 };
  const statsLoading = userLoading;

  // Helper function for credit balance styling
  const getCreditColor = () => {
    if (creditBalance < 100) return 'bg-red-50 border-red-200 text-red-600';
    if (creditBalance < 500) return 'bg-yellow-50 border-yellow-200 text-yellow-600';
    return 'bg-green-50 border-green-200 text-green-600';
  };

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
                <FileUploadDashboard 
                  className="max-w-7xl mx-auto"
                  onUploadComplete={(result) => {
                    // Refresh stats and recent records after successful upload
                    // This will be handled by the hooks automatically
                    console.log('Processing completed:', result);
                  }}
                />
              </div>
            </div>
          )}
        

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



        {/* No Credits Message */}
        {!hasCredits && (
          <div className="bg-gray-50 rounded-lg p-8 text-center">
            <div className="max-w-md mx-auto">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {isTrialUser ? 'Free Trial Completed' : 'No Credits Available'}
              </h3>
              <p className="text-gray-600 mb-6">
                {isTrialUser ? 
                  'You\'ve used all your free pages. Add credits to continue processing PDFs at just $0.012 per page.' :
                  'You need credits to process PDF files. Add credits to get started.'
                }
              </p>
              <Link
                to="/account-settings"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Credits Now
              </Link>
            </div>
          </div>
        )}

        </div>
      </ErrorBoundary>
    </DashboardLayout>
  );
}