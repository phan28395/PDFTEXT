import { Link } from 'react-router-dom';

export default function QuickDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Quick Dashboard Access</h1>
        
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          <p className="text-lg mb-4">Use these direct links to navigate:</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              to="/dashboard" 
              className="block p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-center font-medium"
            >
              Go to Dashboard
            </Link>
            
            <Link 
              to="/login" 
              className="block p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 text-center font-medium"
            >
              Go to Login
            </Link>
            
            <Link 
              to="/" 
              className="block p-4 bg-gray-600 text-white rounded-lg hover:bg-gray-700 text-center font-medium"
            >
              Go to Home
            </Link>
            
            <a 
              href="/dashboard" 
              className="block p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-center font-medium"
            >
              Dashboard (Direct Link)
            </a>
          </div>
          
          <div className="mt-8 p-4 bg-yellow-50 rounded-lg">
            <h2 className="font-bold mb-2">If dashboard is not accessible:</h2>
            <ol className="list-decimal list-inside space-y-2">
              <li>Clear your browser cache and cookies</li>
              <li>Try accessing in incognito/private mode</li>
              <li>Check browser console for errors (F12)</li>
              <li>Make sure you're logged in via the login page</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}