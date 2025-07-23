import { FileText, Scale, Shield, AlertTriangle } from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function Terms() {
  return (
    <PublicLayout>
      <div className="bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="bg-blue-600 rounded-full p-4">
                <Scale className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
              Terms of Service
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Please read these terms carefully before using our services
            </p>
            <div className="mt-6 text-sm text-gray-500">
              Last updated: January 15, 2024
            </div>
          </div>
        </section>

        {/* Terms Content */}
        <section className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="prose prose-lg max-w-none">
              
              {/* 1. Acceptance of Terms */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <FileText className="h-6 w-6 text-blue-600 mr-2" />
                  1. Acceptance of Terms
                </h2>
                <p className="text-gray-600 mb-4">
                  By accessing and using PDFtoText ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. These Terms of Service ("Terms") govern your use of our document processing service operated by PDFtoText Inc. ("us", "we", or "our").
                </p>
                <p className="text-gray-600">
                  If you do not agree to abide by the above, please do not use this service.
                </p>
              </div>

              {/* 2. Description of Service */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">2. Description of Service</h2>
                <p className="text-gray-600 mb-4">
                  PDFtoText provides AI-powered document text extraction services that convert PDF files and images into editable text formats. Our service includes:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>PDF to text conversion</li>
                  <li>Image-based document processing</li>
                  <li>Multiple output formats (TXT, Markdown, DOCX)</li>
                  <li>API access for developers</li>
                  <li>Batch processing capabilities</li>
                </ul>
              </div>

              {/* 3. User Accounts */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">3. User Accounts</h2>
                <p className="text-gray-600 mb-4">
                  To access certain features of the Service, you must register for an account. When creating an account, you agree to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Provide accurate, complete, and current information</li>
                  <li>Maintain and update your information to keep it accurate</li>
                  <li>Keep your account credentials secure and confidential</li>
                  <li>Accept responsibility for all activities under your account</li>
                  <li>Notify us immediately of any unauthorized use</li>
                </ul>
              </div>

              {/* 4. Acceptable Use */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <Shield className="h-6 w-6 text-blue-600 mr-2" />
                  4. Acceptable Use Policy
                </h2>
                <p className="text-gray-600 mb-4">
                  You agree not to use the Service for any unlawful or prohibited activities, including but not limited to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Processing documents that violate copyright laws</li>
                  <li>Uploading malicious files or content</li>
                  <li>Attempting to reverse engineer or breach our systems</li>
                  <li>Sharing your account credentials with others</li>
                  <li>Exceeding rate limits or usage quotas</li>
                  <li>Processing documents containing illegal content</li>
                </ul>
              </div>

              {/* 5. Data and Privacy */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Data and Privacy</h2>
                <p className="text-gray-600 mb-4">
                  We take data protection seriously. When using our Service:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Uploaded documents are processed and deleted within 1 hour</li>
                  <li>We do not store or access your document content</li>
                  <li>All data transmission is encrypted using industry standards</li>
                  <li>You retain all rights to your uploaded content</li>
                  <li>Our Privacy Policy provides detailed information about data handling</li>
                </ul>
              </div>

              {/* 6. Payment Terms */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Payment Terms</h2>
                <p className="text-gray-600 mb-4">
                  For paid services:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Subscription fees are billed monthly in advance</li>
                  <li>All fees are non-refundable unless required by law</li>
                  <li>Price changes will be communicated 30 days in advance</li>
                  <li>Accounts may be suspended for non-payment</li>
                  <li>Usage-based billing is calculated monthly</li>
                </ul>
              </div>

              {/* 7. Service Availability */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Service Availability</h2>
                <p className="text-gray-600 mb-4">
                  While we strive for maximum uptime, we cannot guarantee uninterrupted service. We reserve the right to:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Perform scheduled maintenance with advance notice</li>
                  <li>Implement emergency updates as needed</li>
                  <li>Modify or discontinue features with reasonable notice</li>
                  <li>Suspend service for violations of these Terms</li>
                </ul>
              </div>

              {/* 8. Intellectual Property */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Intellectual Property</h2>
                <p className="text-gray-600 mb-4">
                  The Service and its original content, features, and functionality are owned by PDFtoText Inc. and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
                </p>
                <p className="text-gray-600">
                  You retain ownership of any content you upload to our Service. By using our Service, you grant us a limited license to process your content solely for the purpose of providing our services.
                </p>
              </div>

              {/* 9. Limitation of Liability */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <AlertTriangle className="h-6 w-6 text-yellow-600 mr-2" />
                  9. Limitation of Liability
                </h2>
                <p className="text-gray-600 mb-4">
                  To the maximum extent permitted by law, PDFtoText Inc. shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses.
                </p>
                <p className="text-gray-600">
                  Our total liability shall not exceed the amount paid by you for the Service in the 12 months preceding the claim.
                </p>
              </div>

              {/* 10. Termination */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">10. Termination</h2>
                <p className="text-gray-600 mb-4">
                  Either party may terminate this agreement at any time:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>You may cancel your account at any time through your dashboard</li>
                  <li>We may terminate accounts for violations of these Terms</li>
                  <li>Upon termination, your access to the Service will cease immediately</li>
                  <li>We will delete your account data according to our Privacy Policy</li>
                </ul>
              </div>

              {/* 11. Changes to Terms */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">11. Changes to Terms</h2>
                <p className="text-gray-600 mb-4">
                  We reserve the right to modify these Terms at any time. We will notify users of material changes by:
                </p>
                <ul className="list-disc pl-6 text-gray-600 space-y-2">
                  <li>Email notification to registered users</li>
                  <li>Prominent notice on our website</li>
                  <li>In-app notifications</li>
                </ul>
                <p className="text-gray-600 mt-4">
                  Continued use of the Service after changes constitutes acceptance of the new Terms.
                </p>
              </div>

              {/* 12. Governing Law */}
              <div className="mb-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">12. Governing Law</h2>
                <p className="text-gray-600">
                  These Terms shall be interpreted and governed by the laws of Delaware, United States, without regard to its conflict of law provisions. Any disputes shall be resolved in the courts of Delaware.
                </p>
              </div>

              {/* Contact Information */}
              <div className="bg-gray-50 rounded-lg p-8 mt-12">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Information</h2>
                <p className="text-gray-600 mb-4">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <ul className="text-gray-600 space-y-2">
                  <li><strong>Email:</strong> legal@pdftotext.com</li>
                  <li><strong>Address:</strong> PDFtoText Inc., 123 Main Street, San Francisco, CA 94105</li>
                  <li><strong>Phone:</strong> +1 (555) 123-4567</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </PublicLayout>
  );
}