import { 
  Zap, 
  Shield, 
  Clock, 
  Users, 
  Globe, 
  FileText,
  Download,
  Upload,
  Languages,
  Lock,
  CheckCircle,
  BarChart3,
  Workflow,
  Cloud
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function Features() {
  const features = [
    {
      category: "AI-Powered Processing",
      items: [
        {
          icon: Zap,
          title: "Advanced OCR Technology",
          description: "State-of-the-art optical character recognition for maximum accuracy across all document types."
        },
        {
          icon: Languages,
          title: "Multi-Language Support",
          description: "Process documents in 100+ languages with native character recognition and proper encoding."
        },
        {
          icon: FileText,
          title: "Smart Format Detection",
          description: "Automatically recognizes document structure, tables, headers, and formatting elements."
        }
      ]
    },
    {
      category: "Output Formats",
      items: [
        {
          icon: Download,
          title: "Multiple Export Options",
          description: "Export to TXT, Markdown, DOCX, or custom formats to fit your workflow needs."
        },
        {
          icon: CheckCircle,
          title: "Preserved Formatting",
          description: "Maintain original document structure, headings, lists, and table layouts."
        },
        {
          icon: BarChart3,
          title: "Structured Data Extraction",
          description: "Extract tables, forms, and structured data as CSV or JSON for easy processing."
        }
      ]
    },
    {
      category: "Enterprise Features",
      items: [
        {
          icon: Users,
          title: "Batch Processing",
          description: "Upload and process hundreds of documents simultaneously with automated workflows."
        },
        {
          icon: Workflow,
          title: "API Integration",
          description: "RESTful API for seamless integration with your existing systems and applications."
        },
        {
          icon: Cloud,
          title: "Cloud Storage",
          description: "Direct integration with Google Drive, Dropbox, and other cloud storage providers."
        }
      ]
    },
    {
      category: "Security & Performance",
      items: [
        {
          icon: Shield,
          title: "Enterprise Security",
          description: "GDPR compliant with end-to-end encryption and automatic data deletion after processing."
        },
        {
          icon: Clock,
          title: "Lightning Fast",
          description: "Average processing time under 3 seconds per page with 99.5% accuracy guarantee."
        },
        {
          icon: Lock,
          title: "Private Processing",
          description: "Your documents are processed securely and never stored permanently on our servers."
        }
      ]
    }
  ];

  return (
    <PublicLayout>
      <div className="bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
              Powerful Features for Document Processing
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Everything you need to extract, convert, and process text from any document type
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {features.map((category, categoryIndex) => (
              <div key={categoryIndex} className="mb-20">
                <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
                  {category.category}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {category.items.map((feature, index) => {
                    const IconComponent = feature.icon;
                    return (
                      <div key={index} className="bg-white rounded-lg border shadow-sm p-8 hover:shadow-md transition-shadow">
                        <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mb-6">
                          <IconComponent className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">
                          {feature.title}
                        </h3>
                        <p className="text-gray-600 leading-relaxed">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Technical Specifications */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Technical Specifications
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              <div className="bg-white rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">10MB</div>
                <div className="text-gray-600">Max File Size</div>
              </div>
              <div className="bg-white rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-green-600 mb-2">99.5%</div>
                <div className="text-gray-600">Accuracy Rate</div>
              </div>
              <div className="bg-white rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-purple-600 mb-2">100+</div>
                <div className="text-gray-600">Languages</div>
              </div>
              <div className="bg-white rounded-lg p-6 text-center">
                <div className="text-3xl font-bold text-orange-600 mb-2">3s</div>
                <div className="text-gray-600">Avg Processing Time</div>
              </div>
            </div>
          </div>
        </section>

        {/* Supported Formats */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Supported Formats
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Input Formats</h3>
                <div className="grid grid-cols-2 gap-4">
                  {['PDF', 'JPG', 'PNG', 'TIFF', 'BMP', 'GIF', 'WEBP', 'SVG'].map((format) => (
                    <div key={format} className="bg-gray-100 rounded-lg p-3 text-center font-medium text-gray-700">
                      {format}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Output Formats</h3>
                <div className="grid grid-cols-2 gap-4">
                  {['TXT', 'Markdown', 'DOCX', 'CSV', 'JSON', 'HTML', 'RTF', 'PDF'].map((format) => (
                    <div key={format} className="bg-blue-100 rounded-lg p-3 text-center font-medium text-blue-700">
                      {format}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}