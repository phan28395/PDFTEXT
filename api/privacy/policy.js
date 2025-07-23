import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';

/**
 * Privacy Policy API endpoint
 * Returns the current privacy policy content for GDPR compliance
 */
export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported'
    });
  }

  const privacyPolicy = {
    version: '1.0',
    effective_date: '2024-01-01',
    last_updated: '2024-01-01',
    language: 'en',
    jurisdiction: 'EU/GDPR',
    
    data_controller: {
      name: 'PDF-to-Text SaaS Platform',
      email: 'privacy@pdftotext.com',
      address: 'Contact via email for physical address',
      dpo_email: 'dpo@pdftotext.com'
    },

    sections: {
      introduction: {
        title: 'Introduction',
        content: `This Privacy Policy explains how PDF-to-Text SaaS Platform ("we", "our", or "us") collects, uses, and protects your personal information when you use our PDF text extraction service. We are committed to protecting your privacy and ensuring transparency about our data practices in compliance with the General Data Protection Regulation (GDPR) and other applicable privacy laws.`
      },

      data_we_collect: {
        title: 'Information We Collect',
        content: `We collect the following types of information:`,
        categories: [
          {
            category: 'Account Information',
            data_types: [
              'Email address (required for account creation)',
              'Password (encrypted and hashed)',
              'Full name (optional)',
              'Account creation and last login dates'
            ],
            legal_basis: 'Contract performance (Article 6.1.b GDPR)',
            retention: 'Until account deletion'
          },
          {
            category: 'Processing Data', 
            data_types: [
              'PDF files you upload for processing',
              'Extracted text content from your PDFs',
              'Processing metadata (file size, page count, processing time)',
              'Mathematical content and images detected in PDFs',
              'Document structure and formatting information'
            ],
            legal_basis: 'Contract performance (Article 6.1.b GDPR)',
            retention: 'Text content: 1 year, Metadata: 2 years'
          },
          {
            category: 'Usage Information',
            data_types: [
              'Pages processed and usage statistics',
              'Feature usage patterns',
              'Processing success/failure rates',
              'API usage and performance metrics'
            ],
            legal_basis: 'Legitimate interest (Article 6.1.f GDPR)',
            retention: '90 days'
          },
          {
            category: 'Technical Information',
            data_types: [
              'IP address',
              'Browser type and version',
              'Device information',
              'Session data and cookies'
            ],
            legal_basis: 'Legitimate interest (Article 6.1.f GDPR)',
            retention: '30 days for cookies, 1 year for security logs'
          },
          {
            category: 'Payment Information',
            data_types: [
              'Billing address',
              'Payment method details (processed by Stripe)',
              'Transaction history',
              'Subscription status and changes'
            ],
            legal_basis: 'Contract performance (Article 6.1.b GDPR)',
            retention: '7 years for tax compliance'
          }
        ]
      },

      how_we_use_data: {
        title: 'How We Use Your Information',
        purposes: [
          {
            purpose: 'Service Provision',
            description: 'To process your PDF files and extract text content',
            legal_basis: 'Contract performance'
          },
          {
            purpose: 'Account Management',
            description: 'To create and manage your user account, authenticate access',
            legal_basis: 'Contract performance'
          },
          {
            purpose: 'Payment Processing',
            description: 'To process payments and manage subscriptions',
            legal_basis: 'Contract performance'
          },
          {
            purpose: 'Service Improvement',
            description: 'To analyze usage patterns and improve our service quality',
            legal_basis: 'Legitimate interest'
          },
          {
            purpose: 'Security',
            description: 'To detect fraud, prevent abuse, and ensure platform security',
            legal_basis: 'Legitimate interest'
          },
          {
            purpose: 'Communications',
            description: 'To send service updates, security notifications (essential) and marketing (with consent)',
            legal_basis: 'Contract performance (essential) / Consent (marketing)'
          },
          {
            purpose: 'Legal Compliance',
            description: 'To comply with legal obligations and respond to legal requests',
            legal_basis: 'Legal obligation'
          }
        ]
      },

      data_sharing: {
        title: 'Data Sharing and Third Parties',
        content: `We do not sell, rent, or trade your personal information. We only share data with trusted third-party service providers who help us operate our service:`,
        third_parties: [
          {
            name: 'Google Cloud Platform',
            purpose: 'PDF text extraction via Document AI API',
            data_shared: 'PDF file content for processing',
            location: 'Global (with EU data residency options)',
            safeguards: 'Data Processing Agreement, Google Cloud Data Processing Terms'
          },
          {
            name: 'Stripe',
            purpose: 'Payment processing and subscription management', 
            data_shared: 'Billing information, payment details',
            location: 'Global',
            safeguards: 'PCI DSS compliance, Stripe Data Processing Agreement'
          },
          {
            name: 'Supabase',
            purpose: 'Database hosting and user authentication',
            data_shared: 'Account information, processing metadata',
            location: 'EU (Frankfurt)',
            safeguards: 'SOC 2 Type II, GDPR compliant'
          },
          {
            name: 'Vercel',
            purpose: 'Application hosting and content delivery',
            data_shared: 'Technical logs, performance metrics',
            location: 'Global',
            safeguards: 'Data Processing Agreement, SOC 2 compliance'
          }
        ]
      },

      your_rights: {
        title: 'Your Privacy Rights (GDPR)',
        rights: [
          {
            right: 'Right to Access',
            description: 'You can request a copy of all personal data we hold about you',
            how_to_exercise: 'Use the "Export My Data" feature in your account settings or contact privacy@pdftotext.com'
          },
          {
            right: 'Right to Rectification',
            description: 'You can correct inaccurate or incomplete personal data',
            how_to_exercise: 'Update your information in account settings or contact us'
          },
          {
            right: 'Right to Erasure',
            description: 'You can request deletion of your personal data',
            how_to_exercise: 'Use the "Delete Account" feature or contact privacy@pdftotext.com'
          },
          {
            right: 'Right to Restrict Processing',
            description: 'You can limit how we process your data in certain circumstances',
            how_to_exercise: 'Contact privacy@pdftotext.com with your request'
          },
          {
            right: 'Right to Data Portability',
            description: 'You can receive your data in a machine-readable format',
            how_to_exercise: 'Use the "Export My Data" feature for JSON format download'
          },
          {
            right: 'Right to Object',
            description: 'You can object to processing based on legitimate interests',
            how_to_exercise: 'Contact privacy@pdftotext.com or adjust consent settings'
          },
          {
            right: 'Right to Withdraw Consent',
            description: 'You can withdraw consent for marketing and analytics',
            how_to_exercise: 'Use the consent management in your privacy settings'
          },
          {
            right: 'Right to Lodge a Complaint',
            description: 'You can file a complaint with your local data protection authority',
            how_to_exercise: 'Contact your local DPA or the ICO (UK), CNIL (France), etc.'
          }
        ]
      },

      data_security: {
        title: 'Data Security',
        measures: [
          'Encryption in transit (TLS 1.3) and at rest (AES-256)',
          'Multi-factor authentication support',
          'Regular security audits and penetration testing',
          'Access controls and principle of least privilege',
          'Automated threat detection and response',
          'Regular security training for our team',
          'Incident response procedures',
          'Secure coding practices and code reviews'
        ]
      },

      data_retention: {
        title: 'Data Retention',
        policies: [
          {
            data_type: 'Account Information',
            retention_period: 'Until account deletion',
            reason: 'Required for service provision'
          },
          {
            data_type: 'PDF Text Content',
            retention_period: '1 year',
            reason: 'Allow re-download and processing history access'
          },
          {
            data_type: 'Processing Metadata',
            retention_period: '2 years',
            reason: 'Analytics and service improvement'
          },
          {
            data_type: 'Usage Logs',
            retention_period: '90 days',
            reason: 'Performance monitoring and troubleshooting'
          },
          {
            data_type: 'Security Logs',
            retention_period: '1 year',
            reason: 'Security monitoring and incident response'
          },
          {
            data_type: 'Payment Records',
            retention_period: '7 years',
            reason: 'Tax compliance and legal obligations'
          },
          {
            data_type: 'Privacy Audit Logs',
            retention_period: '7 years',
            reason: 'GDPR compliance demonstration'
          }
        ]
      },

      international_transfers: {
        title: 'International Data Transfers',
        content: `When we transfer personal data outside the European Economic Area, we ensure appropriate safeguards are in place:`,
        safeguards: [
          'Standard Contractual Clauses approved by the European Commission',
          'Adequacy decisions by the European Commission (where applicable)',
          'Binding Corporate Rules for multinational service providers',
          'Processor certification under approved certification schemes'
        ]
      },

      cookies: {
        title: 'Cookies and Tracking',
        types: [
          {
            type: 'Essential Cookies',
            purpose: 'Required for authentication and basic site functionality',
            consent_required: false,
            duration: 'Session or 30 days'
          },
          {
            type: 'Analytics Cookies',
            purpose: 'Help us understand how you use our service',
            consent_required: true,
            duration: '1 year'
          },
          {
            type: 'Preference Cookies',
            purpose: 'Remember your settings and preferences',
            consent_required: false,
            duration: '1 year'
          }
        ]
      },

      children_privacy: {
        title: "Children's Privacy",
        content: `Our service is not intended for children under 16 years of age. We do not knowingly collect personal information from children under 16. If you believe we have collected information from a child under 16, please contact us immediately at privacy@pdftotext.com.`
      },

      changes_to_policy: {
        title: 'Changes to This Privacy Policy',
        content: `We may update this Privacy Policy from time to time. When we make material changes, we will:`,
        notification_methods: [
          'Email notification to all registered users',
          'Prominent notice on our website',
          'Update the "Last Updated" date at the top of this policy',
          'Require re-consent for any new processing purposes'
        ]
      },

      contact_information: {
        title: 'Contact Information',
        content: `For any privacy-related questions, requests, or concerns, please contact us:`,
        contacts: [
          {
            type: 'General Privacy Inquiries',
            email: 'privacy@pdftotext.com',
            response_time: '72 hours'
          },
          {
            type: 'Data Protection Officer',
            email: 'dpo@pdftotext.com',
            response_time: '72 hours'
          },
          {
            type: 'GDPR Requests',
            email: 'gdpr@pdftotext.com',
            response_time: '30 days maximum (usually faster)'
          },
          {
            type: 'Security Issues',
            email: 'security@pdftotext.com',
            response_time: '24 hours'
          }
        ]
      }
    }
  };

  return res.status(200).json({
    privacy_policy: privacyPolicy,
    compliance_info: {
      gdpr_compliant: true,
      last_review_date: '2024-01-01',
      next_review_date: '2024-07-01',
      applicable_laws: ['GDPR', 'CCPA', 'UK DPA 2018'],
      certification: 'Self-certified GDPR compliance'
    }
  });
}