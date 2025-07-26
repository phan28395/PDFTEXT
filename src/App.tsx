import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { Toaster } from 'react-hot-toast';
import ErrorBoundary from './components/ErrorBoundary';
import LoadingSpinner from './components/LoadingSpinner';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import { DocumentModeProvider } from './contexts/DocumentModeContext';

// Lazy load components for code splitting
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Admin = lazy(() => import('./pages/Admin'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Privacy = lazy(() => import('./pages/Privacy'));
const BatchProcessing = lazy(() => import('./pages/BatchProcessing'));
const AccountSettings = lazy(() => import('./pages/AccountSettings'));
const UsageHistory = lazy(() => import('./pages/UsageHistory'));
const Features = lazy(() => import('./pages/Features'));
const ApiDocs = lazy(() => import('./pages/ApiDocs'));
const Security = lazy(() => import('./pages/Security'));
const About = lazy(() => import('./pages/About'));
const Terms = lazy(() => import('./pages/Terms'));
const Contact = lazy(() => import('./pages/Contact'));
const AuthDebug = lazy(() => import('./pages/AuthDebug'));
const UserProfile = lazy(() => import('./pages/UserProfile'));

function App() {
  return (
    <ErrorBoundary>
      <DocumentModeProvider>
        <div className="min-h-screen bg-gray-50">
          <Suspense fallback={<LoadingSpinner size="lg" />}>
            <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/features" element={<Features />} />
          <Route path="/api-docs" element={<ApiDocs />} />
          <Route path="/security" element={<Security />} />
          <Route path="/about" element={<About />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth-debug" element={<AuthDebug />} />
          
          {/* Auth routes - redirect to dashboard if already authenticated */}
          <Route 
            path="/login" 
            element={
              <ProtectedRoute requireAuth={false} redirectTo="/dashboard">
                <Login />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <ProtectedRoute requireAuth={false} redirectTo="/dashboard">
                <Register />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/forgot-password" 
            element={
              <ProtectedRoute requireAuth={false} redirectTo="/dashboard">
                <ForgotPassword />
              </ProtectedRoute>
            } 
          />
          
          {/* Protected routes - require authentication */}
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute requireAuth={true} redirectTo="/login">
                <Dashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/batch" 
            element={
              <ProtectedRoute requireAuth={true} redirectTo="/login">
                <BatchProcessing />
              </ProtectedRoute>
            } 
          />
          
          {/* Admin routes - require admin privileges */}
          <Route 
            path="/admin" 
            element={
              <AdminProtectedRoute>
                <Admin />
              </AdminProtectedRoute>
            } 
          />
          
          {/* Account Settings routes */}
          <Route 
            path="/account-settings" 
            element={
              <ProtectedRoute requireAuth={true} redirectTo="/login">
                <AccountSettings />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/usage-history" 
            element={
              <ProtectedRoute requireAuth={true} redirectTo="/login">
                <UsageHistory />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute requireAuth={true} redirectTo="/login">
                <UserProfile />
              </ProtectedRoute>
            } 
          />

          {/* Catch all route - redirect to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </div>
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: '#10B981',
              color: '#fff',
            },
          },
          error: {
            style: {
              background: '#EF4444',
              color: '#fff',
            },
          },
        }}
      />
      </DocumentModeProvider>
    </ErrorBoundary>
  );
}

export default App;