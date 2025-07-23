import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader } from 'lucide-react';
import { useAuthGuard } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
  requireAuth?: boolean;
}

/**
 * Protected Route Component
 * 
 * This component protects routes based on authentication status.
 * - requireAuth = true (default): Redirects unauthenticated users to login
 * - requireAuth = false: Redirects authenticated users to dashboard (for login/register pages)
 */
export default function ProtectedRoute({ 
  children, 
  redirectTo = '/login',
  requireAuth = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthGuard();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Protect routes that require authentication
  if (requireAuth && !isAuthenticated) {
    // Save the attempted location for redirect after login
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Redirect authenticated users away from auth pages
  if (!requireAuth && isAuthenticated) {
    // Redirect to the originally requested page or dashboard
    const from = location.state?.from?.pathname || '/dashboard';
    return <Navigate to={from} replace />;
  }

  // Render the protected content
  return <>{children}</>;
}

/**
 * Higher-order component for creating protected routes
 */
export const withProtectedRoute = (
  Component: React.ComponentType<any>, 
  options: Omit<ProtectedRouteProps, 'children'> = {}
) => {
  return function ProtectedComponent(props: any) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
};

/**
 * Role-based protection component (for future use with role-based access)
 */
interface RoleProtectedRouteProps extends ProtectedRouteProps {
  allowedRoles?: string[];
  userRole?: string;
}

export function RoleProtectedRoute({ 
  children, 
  allowedRoles = [],
  userRole,
  ...protectedRouteProps 
}: RoleProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuthGuard();

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // First check if user is authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check role permissions (for future implementation)
  if (allowedRoles.length > 0 && userRole) {
    if (!allowedRoles.includes(userRole)) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
            <p className="text-gray-600">You don't have permission to access this page.</p>
          </div>
        </div>
      );
    }
  }

  return (
    <ProtectedRoute {...protectedRouteProps}>
      {children}
    </ProtectedRoute>
  );
}