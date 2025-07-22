import { FileText, Upload, BarChart3, Settings } from 'lucide-react';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">PDF to Text</span>
            </div>
            <div className="flex items-center space-x-4">
              <button className="text-gray-700 hover:text-gray-900">
                <Settings className="h-6 w-6" />
              </button>
              <button className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700">
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="border-4 border-dashed border-gray-200 rounded-lg p-8">
            <div className="text-center">
              <Upload className="h-16 w-16 text-gray-400 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Upload PDF Document</h3>
              <p className="mt-2 text-gray-600">Drag and drop your PDF file here, or click to browse</p>
              <button className="mt-4 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
                Choose File
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <BarChart3 className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Pages Used</p>
                  <p className="text-2xl font-bold text-gray-900">0 / 10</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Plan</p>
                  <p className="text-2xl font-bold text-gray-900">Free</p>
                </div>
              </div>
            </div>
            <div className="bg-white p-6 rounded-lg shadow">
              <div className="flex items-center">
                <Upload className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Processed Files</p>
                  <p className="text-2xl font-bold text-gray-900">0</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Processing History
              </h3>
              <div className="mt-2 max-w-xl text-sm text-gray-500">
                <p>Your recently processed documents will appear here.</p>
              </div>
              <div className="mt-5">
                <div className="text-center py-12">
                  <FileText className="h-16 w-16 text-gray-300 mx-auto" />
                  <p className="mt-4 text-gray-500">No documents processed yet</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}