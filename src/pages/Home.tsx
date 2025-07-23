import { Link } from 'react-router-dom';
import { 
  Upload, 
  Download, 
  Zap, 
  Shield, 
  Clock, 
  Star, 
  Check, 
  ArrowRight,
  Users,
  FileText,
  Globe,
  Lock
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function Home() {
  return (
    <PublicLayout className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-6xl lg:text-7xl">
              Convert PDF to Text with
              <span className="text-blue-600"> AI Precision</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Extract text from PDF documents with 99.9% accuracy using Google's advanced Document AI. 
              Trusted by thousands for fast, secure, and reliable processing.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                to="/register" 
                className="bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-medium hover:bg-blue-700 transform transition-all duration-200 hover:scale-105 inline-flex items-center shadow-lg"
              >
                <span className="hidden sm:inline">Start Free - 10 Pages Included</span>
                <span className="sm:hidden">Start Free</span>
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
              <div className="text-xs sm:text-sm text-gray-600 flex flex-col sm:flex-row items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <span className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-1" />
                  No credit card required
                </span>
                <span className="flex items-center">
                  <Check className="h-4 w-4 text-green-500 mr-1" />
                  Enterprise security
                </span>
              </div>
            </div>

            {/* Social Proof */}
            <div className="mt-16 flex flex-col items-center">
              <div className="flex items-center space-x-1 text-yellow-400 mb-2">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
                <span className="ml-2 text-gray-600">4.9/5 from 1,200+ users</span>
              </div>
              <p className="text-gray-500">Trusted by startups to Fortune 500 companies</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              How It Works
            </h2>
            <p className="mt-4 text-lg text-gray-600">
              Three simple steps to convert your PDF to editable text
            </p>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="text-center group">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-blue-200 transition-colors">
                <Upload className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">1. Upload Your PDF</h3>
              <p className="text-gray-600">
                Drag and drop your PDF file or click to browse. Support for files up to 100MB 
                with enterprise-grade security.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-green-200 transition-colors">
                <Zap className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">2. AI Processing</h3>
              <p className="text-gray-600">
                Our Google Document AI technology analyzes your document with OCR and 
                machine learning for maximum accuracy.
              </p>
            </div>

            <div className="text-center group">
              <div className="bg-purple-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:bg-purple-200 transition-colors">
                <Download className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">3. Download Results</h3>
              <p className="text-gray-600">
                Get your extracted text in multiple formats: plain text, Markdown, or DOCX. 
                Ready to use instantly.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Why Choose PDFtoText?
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="text-center">
              <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise Security</h3>
              <p className="text-gray-600">GDPR compliant with end-to-end encryption and automatic data deletion</p>
            </div>

            <div className="text-center">
              <Clock className="h-12 w-12 text-green-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Lightning Fast</h3>
              <p className="text-gray-600">Process documents in seconds, not minutes. Average processing time under 10 seconds</p>
            </div>

            <div className="text-center">
              <Users className="h-12 w-12 text-purple-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Collaboration</h3>
              <p className="text-gray-600">Share results with your team and manage processing history across projects</p>
            </div>

            <div className="text-center">
              <Globe className="h-12 w-12 text-orange-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Multi-Language</h3>
              <p className="text-gray-600">Supports 100+ languages with advanced character recognition technology</p>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-8">
            Simple, Transparent Pricing
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="border-2 border-gray-200 rounded-lg p-8 bg-white">
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Free Plan</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">
                $0<span className="text-lg text-gray-600">/lifetime</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>10 pages included</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Basic text extraction</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Standard support</span>
                </li>
              </ul>
              <Link
                to="/register"
                className="w-full bg-gray-100 text-gray-900 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-block"
              >
                Get Started Free
              </Link>
            </div>

            {/* Pro Plan */}
            <div className="border-2 border-blue-500 rounded-lg p-8 bg-blue-50 relative">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Pro Plan</h3>
              <div className="text-4xl font-bold text-gray-900 mb-4">
                $9.99<span className="text-lg text-gray-600">/month</span>
              </div>
              <ul className="space-y-3 mb-8">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>1,000 pages per month</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Advanced AI processing</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Priority support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Team collaboration</span>
                </li>
              </ul>
              <Link
                to="/register"
                className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-block"
              >
                Start Pro Trial
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-blue-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white sm:text-4xl mb-6">
            Ready to Convert Your First PDF?
          </h2>
          <p className="text-xl text-blue-100 mb-10 max-w-2xl mx-auto">
            Join thousands of users who trust PDFtoText for accurate, secure, and fast document processing.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/register"
              className="bg-white text-blue-600 px-8 py-4 rounded-lg text-lg font-medium hover:bg-gray-100 transition-colors inline-flex items-center justify-center"
            >
              <FileText className="mr-2 h-5 w-5" />
              Start Converting Now
            </Link>
            <div className="flex items-center justify-center text-blue-100">
              <Lock className="h-4 w-4 mr-2" />
              <span>No credit card required • 30-second setup</span>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}