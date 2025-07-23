import { 
  Shield, 
  Lock, 
  Key, 
  Server, 
  Eye, 
  Trash2,
  CheckCircle,
  Globe,
  Database,
  FileCheck
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function Security() {
  const securityFeatures = [
    {
      icon: Lock,
      title: "Data Encryption",
      description: "All data is encrypted in transit using HTTPS/TLS. Your documents are transmitted securely to our processing infrastructure."
    },
    {
      icon: Eye,
      title: "Privacy Focused",
      description: "We don't store your documents permanently. Processing is automated without human access to your content."
    },
    {
      icon: Server,
      title: "Cloud Infrastructure",
      description: "Built on secure cloud infrastructure with industry-standard security practices and monitoring."
    },
    {
      icon: Key,
      title: "Secure Access",
      description: "API access protected with authentication keys and rate limiting for your account security."
    },
    {
      icon: Globe,
      title: "Privacy Regulations",
      description: "Designed with privacy regulations like GDPR in mind. See our Privacy Policy for detailed information."
    }
  ];

  const securityPrinciples = [
    {
      title: "Encryption",
      description: "Data encrypted during transmission and processing"
    },
    {
      title: "Privacy",
      description: "No permanent storage of your document content"
    },
    {
      title: "Access Control",
      description: "Secure authentication and authorization systems"
    },
    {
      title: "Monitoring",
      description: "Continuous monitoring for security and performance"
    }
  ];

  return (
    <PublicLayout>
      <div className="bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-blue-600 rounded-full p-4">
                <Shield className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
              Enterprise-Grade Security
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Your documents and data are protected by industry-leading security measures 
              and compliance standards
            </p>
          </div>
        </section>

        {/* Security Features */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Security Features
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {securityFeatures.map((feature, index) => {
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
        </section>

        {/* Security Principles */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Security Principles
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {securityPrinciples.map((principle, index) => (
                <div key={index} className="bg-white rounded-lg border shadow-sm p-6 text-center">
                  <div className="bg-blue-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{principle.title}</h3>
                  <p className="text-gray-600 text-sm">{principle.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Infrastructure Details */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Infrastructure & Processing
            </h2>
            <div className="bg-gray-50 rounded-lg p-8">
              <p className="text-gray-600 mb-6 leading-relaxed">
                We are committed to implementing and maintaining the highest security standards for our service. 
                However, since our document processing relies on external cloud services, the complete security 
                posture includes both our application-level security measures and the infrastructure security 
                provided by our cloud service partners.
              </p>
              <p className="text-gray-600 mb-6 leading-relaxed">
                While we ensure secure transmission, authentication, and privacy controls on our end, 
                aspects such as enterprise certifications (SOC 2, ISO 27001), infrastructure-level 
                encryption, and compliance measures are provided by our underlying cloud infrastructure. 
                For comprehensive details about these enterprise-grade security features, certifications, 
                and compliance standards, please refer to our cloud service provider's security documentation.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="https://cloud.google.com/security/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
                >
                  View Cloud Infrastructure Security
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
                <a 
                  href="https://cloud.google.com/security/compliance/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gray-100 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center justify-center"
                >
                  View Compliance Details
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Contact for Security */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Security Questions?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Have questions about our security practices? We're here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="/contact"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
              >
                Contact Us
              </a>
              <a 
                href="/privacy"
                className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center justify-center"
              >
                Privacy Policy
              </a>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}