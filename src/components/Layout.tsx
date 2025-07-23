import { useState, ReactNode } from 'react';
import { Menu } from 'lucide-react';
import Header from './Header';
import Sidebar from './Sidebar';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
  showSidebar?: boolean;
  showFooter?: boolean;
  className?: string;
  variant?: 'default' | 'dashboard' | 'public' | 'auth' | 'admin';
}

export default function Layout({ 
  children, 
  showSidebar = false, 
  showFooter = true, 
  className = '',
  variant = 'default' 
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  return (
    <div className={`min-h-screen flex flex-col ${className}`}>
      {/* Header */}
      <Header />

      <div className="flex flex-1">
        {/* Sidebar */}
        {showSidebar && (
          <Sidebar 
            isOpen={isSidebarOpen}
            onClose={closeSidebar}
          />
        )}

        {/* Main Content */}
        <main className={`
          flex-1 flex flex-col
          ${showSidebar ? 'lg:ml-0' : ''}
        `}>
          {/* Mobile Sidebar Toggle */}
          {showSidebar && (
            <div className="lg:hidden p-4 border-b border-gray-200">
              <button
                onClick={toggleSidebar}
                className="flex items-center space-x-2 text-gray-600 hover:text-gray-900"
              >
                <Menu className="h-5 w-5" />
                <span>Menu</span>
              </button>
            </div>
          )}

          {/* Page Content */}
          <div className="flex-1">
            {children}
          </div>
        </main>
      </div>

      {/* Footer */}
      {showFooter && <Footer />}
    </div>
  );
}

// Specialized layout components
export function DashboardLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Layout 
      showSidebar={true} 
      showFooter={false} 
      className={className}
    >
      {children}
    </Layout>
  );
}

export function PublicLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Layout 
      showSidebar={false} 
      showFooter={true} 
      className={className}
    >
      {children}
    </Layout>
  );
}

export function AuthLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Layout 
      showSidebar={false} 
      showFooter={false} 
      className={className}
      variant="auth"
    >
      <div className="flex-1 flex items-center justify-center py-12">
        {children}
      </div>
    </Layout>
  );
}

export function AdminLayout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Layout 
      showSidebar={false} 
      showFooter={false} 
      className={className}
      variant="admin"
    >
      {children}
    </Layout>
  );
}