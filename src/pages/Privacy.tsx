import React, { useState, useEffect } from 'react';
import { Shield, Mail, Clock, Globe, Lock, Eye, Users, FileText } from 'lucide-react';

interface PrivacyPolicyData {
  version: string;
  effective_date: string;
  last_updated: string;
  data_controller: {
    name: string;
    email: string;
    address: string;
    dpo_email: string;
  };
  sections: any;
}

const Privacy: React.FC = () => {
  const [privacyPolicy, setPrivacyPolicy] = useState<PrivacyPolicyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('introduction');

  useEffect(() => {
    fetchPrivacyPolicy();
  }, []);

  const fetchPrivacyPolicy = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/privacy/policy');
      
      if (!response.ok) {
        throw new Error('Failed to fetch privacy policy');
      }

      const data = await response.json();
      setPrivacyPolicy(data.privacy_policy);
    } catch (error) {
      console.error('Error fetching privacy policy:', error);
    } finally {
      setLoading(false);
    }
  };

  const sectionIcons: Record<string, React.ReactNode> = {
    introduction: <Shield className="w-5 h-5" />,
    data_we_collect: <FileText className="w-5 h-5" />,
    how_we_use_data: <Users className="w-5 h-5" />,
    data_sharing: <Globe className="w-5 h-5" />,
    your_rights: <Lock className="w-5 h-5" />,
    data_security: <Shield className="w-5 h-5" />,
    data_retention: <Clock className="w-5 h-5" />,
    international_transfers: <Globe className="w-5 h-5" />,
    cookies: <Eye className="w-5 h-5" />,
    children_privacy: <Users className="w-5 h-5" />,
    changes_to_policy: <FileText className="w-5 h-5" />,
    contact_information: <Mail className="w-5 h-5" />
  };

  const sectionTitles: Record<string, string> = {
    introduction: 'Introduction',
    data_we_collect: 'Data We Collect',
    how_we_use_data: 'How We Use Data',
    data_sharing: 'Data Sharing',
    your_rights: 'Your Rights',
    data_security: 'Data Security',
    data_retention: 'Data Retention',
    international_transfers: 'International Transfers',
    cookies: 'Cookies & Tracking',
    children_privacy: "Children's Privacy",
    changes_to_policy: 'Policy Changes',
    contact_information: 'Contact Information'
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!privacyPolicy) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Privacy Policy Unavailable</h1>
          <p className="text-gray-600">Unable to load privacy policy. Please try again later.</p>
        </div>
      </div>
    );
  }

  const renderSection = (sectionKey: string, sectionData: any) => {
    switch (sectionKey) {
      case 'data_we_collect':
        return (
          <div className="space-y-6">
            <p className="text-gray-700">{sectionData.content}</p>
            {sectionData.categories?.map((category: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-2">{category.category}</h4>
                <ul className="space-y-1 mb-3">
                  {category.data_types.map((type: string, typeIndex: number) => (
                    <li key={typeIndex} className="text-sm text-gray-600 flex items-start">
                      <span className="w-2 h-2 bg-blue-600 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                      {type}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center space-x-4 text-xs">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                    {category.legal_basis}
                  </span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded">
                    Retention: {category.retention}
                  </span>
                </div>
              </div>
            ))}
          </div>
        );

      case 'how_we_use_data':
        return (
          <div className="space-y-4">
            {sectionData.purposes?.map((purpose: any, index: number) => (
              <div key={index} className="border-l-4 border-blue-600 pl-4">
                <h4 className="font-semibold text-gray-900">{purpose.purpose}</h4>
                <p className="text-gray-600 text-sm mt-1">{purpose.description}</p>
                <span className="inline-block text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded mt-2">
                  {purpose.legal_basis}
                </span>
              </div>
            ))}
          </div>
        );

      case 'data_sharing':
        return (
          <div className="space-y-6">
            <p className="text-gray-700">{sectionData.content}</p>
            <div className="grid gap-4">
              {sectionData.third_parties?.map((party: any, index: number) => (
                <div key={index} className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2">{party.name}</h4>
                  <p className="text-sm text-gray-600 mb-2">{party.purpose}</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="font-medium">Data Shared:</span> {party.data_shared}
                    </div>
                    <div>
                      <span className="font-medium">Location:</span> {party.location}
                    </div>
                    <div>
                      <span className="font-medium">Safeguards:</span> {party.safeguards}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 'your_rights':
        return (
          <div className="space-y-4">
            {sectionData.rights?.map((right: any, index: number) => (
              <div key={index} className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">{right.right}</h4>
                <p className="text-blue-800 text-sm mb-2">{right.description}</p>
                <p className="text-xs text-blue-700">
                  <strong>How to exercise:</strong> {right.how_to_exercise}
                </p>
              </div>
            ))}
          </div>
        );

      case 'data_retention':
        return (
          <div className="space-y-4">
            {sectionData.policies?.map((policy: any, index: number) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <h4 className="font-medium text-gray-900">{policy.data_type}</h4>
                  <p className="text-sm text-gray-600">{policy.reason}</p>
                </div>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                  {policy.retention_period}
                </span>
              </div>
            ))}
          </div>
        );

      case 'cookies':
        return (
          <div className="space-y-4">
            {sectionData.types?.map((cookie: any, index: number) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{cookie.type}</h4>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      cookie.consent_required 
                        ? 'bg-yellow-100 text-yellow-800' 
                        : 'bg-green-100 text-green-800'
                    }`}>
                      {cookie.consent_required ? 'Consent Required' : 'Essential'}
                    </span>
                    <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
                      {cookie.duration}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{cookie.purpose}</p>
              </div>
            ))}
          </div>
        );

      case 'contact_information':
        return (
          <div className="space-y-6">
            <p className="text-gray-700">{sectionData.content}</p>
            <div className="grid gap-4">
              {sectionData.contacts?.map((contact: any, index: number) => (
                <div key={index} className="bg-green-50 rounded-lg p-4">
                  <h4 className="font-semibold text-green-900 mb-2">{contact.type}</h4>
                  <div className="flex items-center justify-between">
                    <a 
                      href={`mailto:${contact.email}`}
                      className="text-green-700 hover:text-green-800 font-medium"
                    >
                      {contact.email}
                    </a>
                    <span className="text-sm text-green-600">
                      Response: {contact.response_time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        if (typeof sectionData === 'object' && sectionData.content) {
          return <p className="text-gray-700 leading-relaxed">{sectionData.content}</p>;
        }
        return <p className="text-gray-700 leading-relaxed">{sectionData}</p>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center space-x-3">
            <Shield className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
              <p className="text-gray-600 mt-1">
                Version {privacyPolicy.version} • Effective {new Date(privacyPolicy.effective_date).toLocaleDateString()} • 
                Last updated {new Date(privacyPolicy.last_updated).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Navigation Sidebar */}
          <div className="lg:w-80 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-8">
              <h3 className="font-semibold text-gray-900 mb-4">Table of Contents</h3>
              <nav className="space-y-2">
                {Object.entries(privacyPolicy.sections).map(([key, section]: [string, any]) => (
                  <button
                    key={key}
                    onClick={() => setActiveSection(key)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-md text-left transition-colors ${
                      activeSection === key
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {sectionIcons[key]}
                    <span className="text-sm">{sectionTitles[key] || section.title}</span>
                  </button>
                ))}
              </nav>
              
              {/* Contact Info */}
              <div className="mt-6 pt-6 border-t border-gray-200">
                <h4 className="font-medium text-gray-900 mb-2">Data Protection Contact</h4>
                <div className="space-y-2 text-sm">
                  <a 
                    href={`mailto:${privacyPolicy.data_controller.email}`}
                    className="text-blue-600 hover:text-blue-700 block"
                  >
                    {privacyPolicy.data_controller.email}
                  </a>
                  <a 
                    href={`mailto:${privacyPolicy.data_controller.dpo_email}`}
                    className="text-blue-600 hover:text-blue-700 block"
                  >
                    {privacyPolicy.data_controller.dpo_email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
              {privacyPolicy.sections[activeSection] && (
                <>
                  <div className="flex items-center space-x-3 mb-6">
                    {sectionIcons[activeSection]}
                    <h2 className="text-2xl font-bold text-gray-900">
                      {sectionTitles[activeSection] || privacyPolicy.sections[activeSection].title}
                    </h2>
                  </div>
                  
                  <div className="prose max-w-none">
                    {renderSection(activeSection, privacyPolicy.sections[activeSection])}
                  </div>
                </>
              )}
            </div>

            {/* GDPR Compliance Badge */}
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center space-x-3">
                <Shield className="w-6 h-6 text-green-600" />
                <div>
                  <h3 className="font-semibold text-green-900">GDPR Compliant</h3>
                  <p className="text-green-700 text-sm">
                    This privacy policy complies with the General Data Protection Regulation (GDPR) 
                    and other applicable privacy laws.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;