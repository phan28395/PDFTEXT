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
      title: "End-to-End Encryption",
      description: "All data is encrypted in transit using TLS 1.3 and at rest using AES-256 encryption. Your documents are never stored in plain text."
    },
    {
      icon: Trash2,
      title: "Automatic Data Deletion",
      description: "Uploaded documents and processed text are automatically deleted from our servers within 1 hour of processing completion."
    },
    {
      icon: Eye,
      title: "Zero Access Policy",
      description: "Our staff cannot access your documents or extracted text. All processing is automated with no human intervention."
    },
    {
      icon: Server,
      title: "Secure Infrastructure",
      description: "Hosted on enterprise-grade cloud infrastructure with 99.9% uptime, regular security audits, and 24/7 monitoring."
    },
    {
      icon: Key,
      title: "API Key Authentication",
      description: "Secure API access with unique keys, rate limiting, and the ability to revoke access immediately if needed."
    },
    {
      icon: Globe,
      title: "GDPR Compliance",
      description: "Fully compliant with GDPR, CCPA, and other privacy regulations. Data processing agreements available for enterprise customers."
    }
  ];

  const certifications = [
    {
      title: "SOC 2 Type II",
      description: "Certified for security, availability, and confidentiality controls"
    },
    {
      title: "ISO 27001",
      description: "Information security management system certification"
    },
    {
      title: "GDPR Compliant",
      description: "Fully compliant with European data protection regulations"
    },
    {
      title: "HIPAA Ready",
      description: "Architecture supports HIPAA compliance for healthcare customers"
    }
  ];

  const dataFlow = [
    {
      step: 1,
      title: "Upload",
      description: "Document encrypted during upload using TLS 1.3"
    },
    {
      step: 2,
      title: "Processing",
      description: "AI processing in isolated, secure containers"
    },
    {
      step: 3,
      title: "Extraction",
      description: "Text extracted and encrypted immediately"
    },
    {
      step: 4,
      title: "Delivery",
      description: "Results delivered securely to your application"
    },
    {
      step: 5,
      title: "Deletion",
      description: "All data permanently deleted within 1 hour"
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

        {/* Data Flow */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Secure Data Processing Flow
            </h2>
            <div className="relative">
              <div className="flex flex-col md:flex-row justify-between items-center space-y-8 md:space-y-0 md:space-x-4">
                {dataFlow.map((step, index) => (
                  <div key={index} className="flex flex-col items-center text-center max-w-xs">
                    <div className="bg-blue-600 text-white w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-4">
                      {step.step}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">{step.title}</h3>
                    <p className="text-gray-600 text-sm">{step.description}</p>
                    {index < dataFlow.length - 1 && (
                      <div className="hidden md:block absolute top-6 transform translate-x-24 w-16 h-0.5 bg-blue-300" 
                           style={{ left: `${(index + 1) * 20}%` }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Certifications */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Certifications & Compliance
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {certifications.map((cert, index) => (
                <div key={index} className="bg-white rounded-lg border shadow-sm p-6 text-center">
                  <div className="bg-green-100 w-12 h-12 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{cert.title}</h3>
                  <p className="text-gray-600 text-sm">{cert.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Technical Security Details */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
              Technical Security Details
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Database className="h-6 w-6 text-blue-600 mr-2" />
                  Data Protection
                </h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>AES-256 encryption for data at rest</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>TLS 1.3 encryption for data in transit</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Secure key management with rotation</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Encrypted database backups</span>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                  <Server className="h-6 w-6 text-blue-600 mr-2" />
                  Infrastructure Security
                </h3>
                <ul className="space-y-3 text-gray-600">
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Multi-region deployment with failover</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Network isolation and VPC security</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>Regular security patches and updates</span>
                  </li>
                  <li className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                    <span>24/7 monitoring and incident response</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Contact for Security */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold text-gray-900 mb-6">
              Security Questions?
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Our security team is available to answer questions and provide additional documentation
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a 
                href="mailto:security@pdftotext.com"
                className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors inline-flex items-center justify-center"
              >
                Contact Security Team
              </a>
              <a 
                href="/contact"
                className="bg-gray-100 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-200 transition-colors inline-flex items-center justify-center"
              >
                General Contact
              </a>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}