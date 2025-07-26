import { 
  FileText, 
  Upload, 
  BarChart3, 
  Clock, 
  Calendar,
  AlertCircle,
  Crown,
  Plus,
  Sparkles,
  FileSearch
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { DashboardLayout } from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import FileUploadDashboard from '@/components/FileUploadDashboard';
import { useDocumentMode } from '@/contexts/DocumentModeContext';

export default function Dashboard() {
  const { user } = useAuth();
  const { user: userData, loading: userLoading, refreshUser } = useUser(user?.id);
  const { documentMode } = useDocumentMode();

  // Debug logging
  console.log('Dashboard userData:', {
    userData,
    free_pages_remaining: userData?.free_pages_remaining,
    loading: userLoading
  });

  // Calculate usage statistics - pay per use model with free trial
  const creditBalance = userData?.credit_balance || 0; // Credits in cents
  const freePages = userData?.free_pages_remaining ?? 0; // Use actual value, even if 0
  
  // Different costs per page based on document mode
  const getCostPerPage = () => {
    switch (documentMode) {
      case 'latex':
        return 2.4; // 2.4 cents per page ($0.024) - Math OCR premium feature
      case 'forms':
        return 1.8; // 1.8 cents per page ($0.018) - Form parser features
      default:
        return 1.2; // 1.2 cents per page ($0.012) - Standard OCR
    }
  };
  
  const costPerPage = getCostPerPage();
  const hasCredits = creditBalance >= costPerPage || freePages > 0;
  const isTrialUser = freePages > 0;
  
  // Calculate derived statistics
  const totalAvailablePages = freePages + Math.floor(creditBalance / costPerPage);
  const pagesUsed = userData?.pages_processed || 0;
  const stats = { totalFiles: userData?.files_processed || 0 };
  const statsLoading = userLoading;

  // Get dynamic content based on document mode
  const getModeContent = () => {
    switch (documentMode) {
      case 'latex':
        return {
          icon: Sparkles,
          title: 'Extract Text with LaTeX Formula Preservation',
          description: 'For any document containing mathematical symbols or equations - preserves formulas in LaTeX format',
          color: 'purple',
          price: '$0.024/page'
        };
      case 'forms':
        return {
          icon: FileSearch,
          title: 'Extract Structured Data from Forms',
          description: 'Optimized for forms, tables, invoices, and structured documents',
          color: 'green',
          price: '$0.018/page'
        };
      default: // 'standard'
        return {
          icon: FileText,
          title: 'Convert PDF to Text with AI',
          description: 'Extract text from books, articles, reports, and general documents',
          color: 'blue',
          price: '$0.012/page'
        };
    }
  };

  const modeContent = getModeContent();


  return (
      <DashboardLayout>
        <ErrorBoundary>
          <div className="p-3 lg:p-4 space-y-4 max-w-[1600px] mx-auto">
            {/* Quick Upload Section */}
            {(userLoading || hasCredits) && (
            <div className="">
              <div className="text-center mb-4">
                <div className="flex items-center justify-center mb-2">
                  <modeContent.icon className={`h-8 w-8 mr-3 ${
                    modeContent.color === 'purple' ? 'text-purple-600' :
                    modeContent.color === 'green' ? 'text-green-600' :
                    'text-blue-600'
                  }`} />
                  <h1 className="text-2xl font-bold text-gray-900">
                    {modeContent.title}
                  </h1>
                </div>
                <p className="text-gray-600 mb-2 max-w-2xl mx-auto">
                  {modeContent.description}
                </p>
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                    modeContent.color === 'purple' ? 'bg-purple-100 text-purple-700' :
                    modeContent.color === 'green' ? 'bg-green-100 text-green-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {modeContent.price}
                  </span>
                  {documentMode !== 'standard' && (
                    <span className="text-xs text-gray-500">
                      (Premium features enabled)
                    </span>
                  )}
                </div>
                {!userLoading && isTrialUser && (
                  <p className="text-sm mt-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-medium">
                        {freePages} free pages remaining
                      </span>
                      <span className="text-gray-600">Then ${(costPerPage / 100).toFixed(3)} per page</span>
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
                  `You've used all your free pages. Add credits to continue processing PDFs at just $${(costPerPage / 100).toFixed(3)} per page.` :
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