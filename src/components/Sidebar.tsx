import { Link, useLocation } from 'react-router-dom';
import { FileText, Sparkles, FileSearch } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { useDocumentMode } from '@/contexts/DocumentModeContext';
import { DocumentType } from '@/components/DocumentTypeSelector';

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ className = '', isOpen = true, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { user: userData } = useUser(user?.id);
  const { documentMode, setDocumentMode } = useDocumentMode();


  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && onClose && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 shadow-sm
        transform transition-transform duration-300 ease-in-out
        lg:transform-none lg:static lg:inset-0
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        ${className}
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <FileText className="h-6 w-6 text-blue-600" />
              <span className="text-lg font-semibold text-gray-900">PDFtoText</span>
            </div>
          </div>

          {/* User Info - Click to go to dashboard */}
          {user && (
            <Link to="/dashboard" className="block p-6 border-b border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-blue-600 font-semibold text-sm">
                    {user.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.email}
                  </p>
                  <p className="text-xs text-gray-500">
                    {userData ? (
                      <>
                        ${((userData.credit_balance || 0) / 100).toFixed(2)} • {' '}
                        {(userData.free_pages_remaining || 0) + Math.floor((userData.credit_balance || 0) / 1.2)} pages left
                      </>
                    ) : (
                      'Loading...'
                    )}
                  </p>
                </div>
              </div>
            </Link>
          )}

          {/* Document Mode Tabs */}
          <div className="p-4 space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Document Mode
            </h3>

            <button
              onClick={() => setDocumentMode('latex')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                documentMode === 'latex'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Sparkles className={`h-5 w-5 ${
                documentMode === 'latex' ? 'text-purple-600' : 'text-gray-400'
              }`} />
              <span className="font-medium">Math/LaTeX</span>
            </button>
            
            <button
              onClick={() => setDocumentMode('standard')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                documentMode === 'standard'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileText className={`h-5 w-5 ${
                documentMode === 'standard' ? 'text-blue-600' : 'text-gray-400'
              }`} />
              <span className="font-medium">Text Document</span>
            </button>
          
            
            <button
              onClick={() => setDocumentMode('forms')}
              className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all ${
                documentMode === 'forms'
                  ? 'bg-green-50 text-green-700 border border-green-200'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <FileSearch className={`h-5 w-5 ${
                documentMode === 'forms' ? 'text-green-600' : 'text-gray-400'
              }`} />
              <span className="font-medium">Forms & Tables</span>
            </button>
            
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                {documentMode === 'standard' && 'Optimized for regular text documents, articles, and books.'}
                {documentMode === 'latex' && 'Enhanced processing for mathematical formulas and academic papers.'}
                {documentMode === 'forms' && 'Specialized extraction for forms, tables, and structured data.'}
              </p>
            </div>
          </div>
          
          {/* Spacer */}
          <div className="flex-1"></div>

        </div>
      </aside>
    </>
  );
}