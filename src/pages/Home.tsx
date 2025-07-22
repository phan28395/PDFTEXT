import { Link } from 'react-router-dom';
import { FileText, Upload, Download, Zap } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="ml-2 text-xl font-bold text-gray-900">PDF to Text</span>
            </div>
            <div className="flex space-x-4">
              <Link to="/login" className="text-gray-700 hover:text-gray-900">Sign In</Link>
              <Link 
                to="/register" 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 sm:text-6xl">
            Convert PDF to Text with
            <span className="text-blue-600"> AI Power</span>
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-3xl mx-auto">
            Extract text from PDF documents with 99.9% accuracy using Google's advanced Document AI technology. 
            Fast, secure, and reliable processing.
          </p>
          
          <div className="mt-10">
            <Link 
              to="/register" 
              className="bg-blue-600 text-white px-8 py-4 rounded-lg text-lg font-medium hover:bg-blue-700 inline-flex items-center"
            >
              Start Free Trial
              <Zap className="ml-2 h-5 w-5" />
            </Link>
          </div>

          <div className="mt-20 grid grid-cols-1 gap-8 sm:grid-cols-3">
            <div className="bg-white p-6 rounded-lg shadow-md">
              <Upload className="h-12 w-12 text-blue-600 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Upload PDF</h3>
              <p className="mt-2 text-gray-600">Drag and drop your PDF file or click to upload</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <Zap className="h-12 w-12 text-blue-600 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">AI Processing</h3>
              <p className="mt-2 text-gray-600">Advanced OCR and AI extract text with high accuracy</p>
            </div>
            <div className="bg-white p-6 rounded-lg shadow-md">
              <Download className="h-12 w-12 text-blue-600 mx-auto" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">Download Text</h3>
              <p className="mt-2 text-gray-600">Get your text in multiple formats: TXT, Markdown, DOCX</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}