import { useAuth } from '@/hooks/useAuth';
import { Link } from 'react-router-dom';

export default function AuthDebug() {
  const { user, session, loading } = useAuth();
  
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow p-6">
        <h1 className="text-2xl font-bold mb-4">Auth Debug Info</h1>
        
        <div className="space-y-2">
          <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
          <p><strong>Authenticated:</strong> {user ? 'Yes' : 'No'}</p>
          <p><strong>User Email:</strong> {user?.email || 'Not logged in'}</p>
          <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
          <p><strong>Session:</strong> {session ? 'Active' : 'None'}</p>
        </div>
        
        <div className="mt-6 space-y-2">
          {!user ? (
            <>
              <Link to="/login" className="block text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
                Go to Login
              </Link>
              <Link to="/register" className="block text-center bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
                Register New Account
              </Link>
            </>
          ) : (
            <Link to="/dashboard" className="block text-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
              Go to Dashboard
            </Link>
          )}
        </div>
        
        <div className="mt-6 text-sm text-gray-600">
          <p>Environment:</p>
          <ul className="list-disc ml-5">
            <li>Supabase URL: {import.meta.env.VITE_SUPABASE_URL ? '✓ Set' : '✗ Missing'}</li>
            <li>Supabase Anon Key: {import.meta.env.VITE_SUPABASE_ANON_KEY ? '✓ Set' : '✗ Missing'}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}