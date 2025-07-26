import { Link, useLocation } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';

interface SidebarProps {
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ className = '', isOpen = true, onClose }: SidebarProps) {
  const location = useLocation();
  const { user } = useAuth();
  const { user: userData } = useUser(user?.id);


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

          {/* Empty space where navigation was */}
          <div className="flex-1"></div>

        </div>
      </aside>
    </>
  );
}