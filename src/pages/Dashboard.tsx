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
  const { user: userData, loading: userLoading, refreshUser } = useUser(user?.id);

  // Debug logging
  console.log('Dashboard userData:', {
    userData,
    free_pages_remaining: userData?.free_pages_remaining,
    loading: userLoading
  });

  // Calculate usage statistics - pay per use model with free trial
  const creditBalance = userData?.credit_balance || 0; // Credits in cents
  const freePages = userData?.free_pages_remaining ?? 0; // Use actual value, even if 0
  const costPerPage = 1.2; // 1.2 cents per page ($0.012)
  const hasCredits = creditBalance >= costPerPage || freePages > 0;
  const isTrialUser = freePages > 0;
  
  // Calculate derived statistics
  const totalAvailablePages = freePages + Math.floor(creditBalance / costPerPage);
  const pagesUsed = userData?.pages_processed || 0;
  const stats = { totalFiles: userData?.files_processed || 0 };
  const statsLoading = userLoading;


  return (
      <DashboardLayout>
        <ErrorBoundary>
          <div className="p-3 lg:p-4 space-y-4 max-w-[1600px] mx-auto">
            {/* Quick Upload Section */}
            {(userLoading || hasCredits) && (
            <div className="">
              <div className="text-center mb-3">
                <h1 className="text-xl font-bold text-gray-900 mb-1">
                  Convert PDF to Text with AI
                </h1>
                {!userLoading && isTrialUser && (
                  <p className="text-sm mt-1">
                    <span className="inline-flex items-center gap-2">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {freePages} free pages remaining
                      </span>
                      <span className="text-gray-600">Then just $0.012 per page</span>
                    </span>
                  </p>
                )}
              </div>
              <FileUploadDashboard 
                className="w-full"
                onUploadComplete={async (result) => {
                  console.log('Processing completed:', result);
                  // Refresh user data to update the free pages display
                  await refreshUser();
                }}
              />
            </div>
          )}
        




        {/* No Credits Message */}
        {!userLoading && !hasCredits && (
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