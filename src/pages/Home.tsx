import { useState } from 'react';
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
  Lock,
  BookOpen,
  Calculator,
  Receipt,
  PenTool,
  Languages,
  Tabs
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function Home() {
  const [activeExample, setActiveExample] = useState('academic');
  const [activeFormat, setActiveFormat] = useState('markdown');

  const examples = {
    academic: {
      title: 'Academic Papers & Math',
      description: 'Extract text from research papers with citations, formulas, and mathematical equations',
      icon: BookOpen,
      input: 'Research papers with citations, footnotes, and complex mathematical formulas',
      outputs: {
        markdown: `# Machine Learning in Natural Language Processing

## Abstract
This paper presents a comprehensive study of machine learning applications in natural language processing...

## 1. Mathematical Foundation
The derivative of a function f(x) at point x is defined as:

$$\\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}$$

### 1.1 Neural Network Optimization
The gradient descent algorithm updates weights using:

$$w_{t+1} = w_t - \\alpha \\nabla J(w_t)$$

## References
[1] Smith, J. et al. (2023). "Deep Learning for NLP", *Journal of AI Research*, 45(2), 123-145.`,
        txt: `Machine Learning in Natural Language Processing

Abstract
This paper presents a comprehensive study of machine learning applications in natural language processing...

1. Mathematical Foundation
The derivative of a function f(x) at point x is defined as:
lim(h→0) [f(x+h) - f(x)]/h

1.1 Neural Network Optimization
The gradient descent algorithm updates weights using:
w(t+1) = w(t) - α∇J(w(t))

References
[1] Smith, J. et al. (2023). "Deep Learning for NLP", Journal of AI Research, 45(2), 123-145.`,
        docx: 'Academic paper with preserved citations, mathematical equations, and proper formatting ready for Word processing.'
      }
    },
    batch: {
      title: 'Batch Processing',
      description: 'Process hundreds of documents at once with automated workflows',
      icon: Users,
      input: 'Multiple PDFs uploaded simultaneously for bulk processing',
      outputs: {
        markdown: `# Batch Processing Results

## Processing Summary
- **Total Files:** 247 documents
- **Successfully Processed:** 245 documents  
- **Processing Time:** 4 minutes 32 seconds
- **Average Accuracy:** 99.7%

## File Results
| Filename | Pages | Status | Format |
|----------|-------|---------|---------|
| research_paper_01.pdf | 15 | ✅ Complete | MD, TXT, DOCX |
| invoice_batch_02.pdf | 3 | ✅ Complete | MD, TXT, DOCX |
| meeting_notes_03.pdf | 8 | ✅ Complete | MD, TXT, DOCX |
| technical_report_04.pdf | 42 | ✅ Complete | MD, TXT, DOCX |

## Download Options
- Individual files or bulk ZIP download
- Multiple format export (TXT, MD, DOCX)
- Processing history and analytics`,
        txt: `Batch Processing Results

Processing Summary:
- Total Files: 247 documents
- Successfully Processed: 245 documents
- Processing Time: 4 minutes 32 seconds
- Average Accuracy: 99.7%

File Results:
research_paper_01.pdf - 15 pages - Complete - MD, TXT, DOCX
invoice_batch_02.pdf - 3 pages - Complete - MD, TXT, DOCX
meeting_notes_03.pdf - 8 pages - Complete - MD, TXT, DOCX
technical_report_04.pdf - 42 pages - Complete - MD, TXT, DOCX

Download Options:
- Individual files or bulk ZIP download
- Multiple format export (TXT, MD, DOCX)
- Processing history and analytics`,
        docx: 'Batch processing results formatted as a professional report with tables, statistics, and download links in Word format.'
      }
    },
    invoice: {
      title: 'Invoices & Receipts',
      description: 'Extract structured data for accounting and expense tracking',
      icon: Receipt,
      input: 'Scanned receipts, invoices, and financial documents',
      outputs: {
        markdown: `# Invoice #INV-2024-001

**From:** Tech Solutions Inc.  
**To:** ABC Corporation  
**Date:** January 15, 2024  
**Due:** February 14, 2024  

## Items
| Description | Quantity | Rate | Amount |
|-------------|----------|------|--------|
| Web Development | 40 hrs | $125.00 | $5,000.00 |
| UI/UX Design | 20 hrs | $100.00 | $2,000.00 |
| Project Management | 10 hrs | $150.00 | $1,500.00 |

**Subtotal:** $8,500.00  
**Tax (8.5%):** $722.50  
**Total:** $9,222.50`,
        txt: `Invoice #INV-2024-001

From: Tech Solutions Inc.
To: ABC Corporation
Date: January 15, 2024
Due: February 14, 2024

Items:
Web Development - 40 hrs @ $125.00 = $5,000.00
UI/UX Design - 20 hrs @ $100.00 = $2,000.00
Project Management - 10 hrs @ $150.00 = $1,500.00

Subtotal: $8,500.00
Tax (8.5%): $722.50
Total: $9,222.50`,
        docx: 'Structured invoice data formatted as a professional document table in Word format, ready for accounting software import.'
      }
    },
    handwritten: {
      title: 'Handwritten Notes',
      description: 'Digitize handwriting from meeting notes, forms, and documents',
      icon: PenTool,
      input: 'Handwritten meeting notes, forms, and personal documents',
      outputs: {
        markdown: `# Project Meeting Notes
**Date:** March 10, 2024  
**Attendees:** Sarah, Mike, Alex, Jennifer  

## Action Items
- [ ] Complete user research by March 15th (Sarah)
- [ ] Design mockups for mobile app (Mike)  
- [ ] Set up development environment (Alex)
- [ ] Schedule client review meeting (Jennifer)

## Key Decisions
1. Move deadline to March 30th
2. Add dark mode feature to scope
3. Use React Native for mobile development

## Next Meeting
**Date:** March 17, 2024  
**Time:** 2:00 PM EST`,
        txt: `Project Meeting Notes
Date: March 10, 2024
Attendees: Sarah, Mike, Alex, Jennifer

Action Items:
- Complete user research by March 15th (Sarah)
- Design mockups for mobile app (Mike)
- Set up development environment (Alex)
- Schedule client review meeting (Jennifer)

Key Decisions:
1. Move deadline to March 30th
2. Add dark mode feature to scope
3. Use React Native for mobile development

Next Meeting:
Date: March 17, 2024
Time: 2:00 PM EST`,
        docx: 'Clean, formatted meeting notes in Word document format with checkboxes, bullet points, and professional structure.'
      }
    }
  };

  const stats = [
    { label: 'Documents Processed', value: '500K+' },
    { label: 'Accuracy Rate', value: '99.5%' },
    { label: 'Avg Processing Time', value: '3 sec' },
    { label: 'Languages Supported', value: '100+' }
  ];

  return (
    <PublicLayout className="bg-white">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl md:text-5xl lg:text-6xl">
              Extract Text from Any Document
              <span className="text-blue-600"> with AI Precision</span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-3xl mx-auto leading-relaxed">
              Convert PDFs, images, and scanned documents to editable text in multiple formats. 
              Perfect for academic papers, invoices, handwritten notes, and mathematical formulas.
            </p>
            
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                to="/register" 
                className="bg-blue-600 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-medium hover:bg-blue-700 transform transition-all duration-200 hover:scale-105 inline-flex items-center shadow-lg"
              >
                Try Now
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-2xl md:text-3xl font-bold text-blue-600">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Visual Examples Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-4">
              See What You Can Extract
            </h2>
            <p className="text-lg text-gray-600">
              From complex academic papers to handwritten notes - see real examples of our AI in action
            </p>
          </div>

          {/* Example Type Selector */}
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            {Object.entries(examples).map(([key, example]) => {
              const IconComponent = example.icon;
              return (
                <button
                  key={key}
                  onClick={() => setActiveExample(key)}
                  className={`flex items-center px-6 py-3 rounded-lg font-medium transition-all ${
                    activeExample === key
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <IconComponent className="h-5 w-5 mr-2" />
                  {example.title}
                </button>
              );
            })}
          </div>

          {/* Before/After Showcase */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Before - Input */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Upload className="h-5 w-5 mr-2 text-gray-600" />
                Input Document
              </h3>
              <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <div className="text-gray-400 mb-4">
                  <FileText className="h-16 w-16 mx-auto" />
                </div>
                <p className="text-gray-600">{examples[activeExample].input}</p>
                <div className="mt-4 text-sm text-gray-500">
                  [Placeholder for actual document image]
                </div>
              </div>
            </div>

            {/* After - Output */}
            <div className="bg-gray-50 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Download className="h-5 w-5 mr-2 text-green-600" />
                Extracted Text
              </h3>

              {/* Format Selector */}
              <div className="flex space-x-2 mb-4">
                {Object.keys(examples[activeExample].outputs).map((format) => (
                  <button
                    key={format}
                    onClick={() => setActiveFormat(format)}
                    className={`px-3 py-1 rounded text-sm font-medium ${
                      activeFormat === format
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {format.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* Output Content */}
              <div className="bg-white rounded border p-4 max-h-96 overflow-y-auto">
                <pre className="text-sm text-gray-800 whitespace-pre-wrap font-mono">
                  {examples[activeExample].outputs[activeFormat]}
                </pre>
              </div>
            </div>
          </div>

          {/* Example Description */}
          <div className="text-center bg-blue-50 rounded-lg p-6">
            <p className="text-lg text-gray-700">
              <strong>{examples[activeExample].title}:</strong> {examples[activeExample].description}
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Demo Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl mb-8">
            Try It Yourself
          </h2>
          <p className="text-lg text-gray-600 mb-12">
            Upload your own document and see our AI in action
          </p>

          {/* Upload Demo Area */}
          <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-12 mb-8">
            <Upload className="h-16 w-16 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Drop your PDF here or click to browse
            </h3>
            <p className="text-gray-600 mb-6">
              Supports PDF, JPG, PNG up to 10MB • 100% secure and private
            </p>
            <Link
              to="/register"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center"
            >
              <Zap className="mr-2 h-5 w-5" />
              Start Free Trial
            </Link>
          </div>

          {/* Features List */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center">
              <Shield className="h-6 w-6 text-green-500 mr-3" />
              <span className="text-gray-700">Enterprise Security</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-6 w-6 text-blue-500 mr-3" />
              <span className="text-gray-700">Lightning Fast Processing</span>
            </div>
            <div className="flex items-center">
              <Languages className="h-6 w-6 text-purple-500 mr-3" />
              <span className="text-gray-700">100+ Languages</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-1 text-yellow-400 mb-4">
            {[...Array(5)].map((_, i) => (
              <Star key={i} className="h-6 w-6 fill-current" />
            ))}
            <span className="ml-2 text-gray-600 text-lg">4.9/5 from 1,200+ users</span>
          </div>
          <p className="text-gray-600 text-lg">
            "This tool saved me hours of manual transcription work. The accuracy is incredible!"
          </p>
          <p className="text-gray-500 mt-2">— Sarah Johnson, Research Assistant</p>
        </div>
      </section>

    </PublicLayout>
  );
}