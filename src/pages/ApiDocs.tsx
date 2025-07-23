import { 
  Code, 
  Key, 
  Send, 
  Download, 
  AlertCircle,
  CheckCircle,
  Copy,
  ExternalLink
} from 'lucide-react';
import { PublicLayout } from '@/components/Layout';

export default function ApiDocs() {
  return (
    <PublicLayout>
      <div className="bg-white">
        {/* Hero Section */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-100 py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h1 className="text-4xl font-bold text-gray-900 sm:text-5xl mb-6">
              API Documentation
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl">
              Integrate PDF text extraction into your applications with our powerful REST API
            </p>
          </div>
        </section>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Sidebar Navigation */}
            <div className="lg:col-span-1">
              <nav className="sticky top-8">
                <h3 className="font-semibold text-gray-900 mb-4">Contents</h3>
                <ul className="space-y-2 text-sm">
                  <li><a href="#getting-started" className="text-blue-600 hover:text-blue-800">Getting Started</a></li>
                  <li><a href="#authentication" className="text-blue-600 hover:text-blue-800">Authentication</a></li>
                  <li><a href="#endpoints" className="text-blue-600 hover:text-blue-800">API Endpoints</a></li>
                  <li><a href="#examples" className="text-blue-600 hover:text-blue-800">Code Examples</a></li>
                  <li><a href="#response-format" className="text-blue-600 hover:text-blue-800">Response Format</a></li>
                  <li><a href="#error-codes" className="text-blue-600 hover:text-blue-800">Error Codes</a></li>
                  <li><a href="#rate-limits" className="text-blue-600 hover:text-blue-800">Rate Limits</a></li>
                </ul>
              </nav>
            </div>

            {/* Main Content */}
            <div className="lg:col-span-3 space-y-12">
              {/* Getting Started */}
              <section id="getting-started">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Getting Started</h2>
                <div className="prose max-w-none">
                  <p className="text-gray-600 mb-4">
                    Our REST API allows you to extract text from PDF documents programmatically. 
                    You'll need an API key to get started.
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-blue-600 mr-2" />
                      <span className="font-medium text-blue-900">Base URL:</span>
                    </div>
                    <code className="text-blue-800 font-mono">https://api.pdftotext.com/v1</code>
                  </div>
                </div>
              </section>

              {/* Authentication */}
              <section id="authentication">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Authentication</h2>
                <p className="text-gray-600 mb-4">
                  All API requests require authentication using an API key. Include your API key in the Authorization header.
                </p>
                <div className="bg-gray-900 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Headers</span>
                    <button className="text-gray-400 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="text-green-400 font-mono text-sm">
{`Authorization: Bearer your-api-key-here
Content-Type: multipart/form-data`}
                  </pre>
                </div>
              </section>

              {/* API Endpoints */}
              <section id="endpoints">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">API Endpoints</h2>
                
                <div className="space-y-8">
                  {/* Process PDF Endpoint */}
                  <div className="border rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-medium mr-3">POST</span>
                      <code className="text-lg font-mono">/process</code>
                    </div>
                    <p className="text-gray-600 mb-4">Extract text from a PDF document</p>
                    
                    <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-2 font-mono text-sm">file</td>
                            <td className="px-4 py-2 text-sm">File</td>
                            <td className="px-4 py-2 text-sm">Yes</td>
                            <td className="px-4 py-2 text-sm">PDF file to process (max 10MB)</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 font-mono text-sm">format</td>
                            <td className="px-4 py-2 text-sm">String</td>
                            <td className="px-4 py-2 text-sm">No</td>
                            <td className="px-4 py-2 text-sm">Output format: txt, markdown, docx (default: txt)</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 font-mono text-sm">language</td>
                            <td className="px-4 py-2 text-sm">String</td>
                            <td className="px-4 py-2 text-sm">No</td>
                            <td className="px-4 py-2 text-sm">Document language code (auto-detected if not specified)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Batch Process Endpoint */}
                  <div className="border rounded-lg p-6">
                    <div className="flex items-center mb-4">
                      <span className="bg-green-100 text-green-800 px-3 py-1 rounded text-sm font-medium mr-3">POST</span>
                      <code className="text-lg font-mono">/batch</code>
                    </div>
                    <p className="text-gray-600 mb-4">Process multiple PDF documents at once</p>
                    
                    <h4 className="font-semibold text-gray-900 mb-2">Parameters</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200 mb-4">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Parameter</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Required</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-2 font-mono text-sm">files</td>
                            <td className="px-4 py-2 text-sm">File[]</td>
                            <td className="px-4 py-2 text-sm">Yes</td>
                            <td className="px-4 py-2 text-sm">Array of PDF files (max 100 files)</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 font-mono text-sm">format</td>
                            <td className="px-4 py-2 text-sm">String</td>
                            <td className="px-4 py-2 text-sm">No</td>
                            <td className="px-4 py-2 text-sm">Output format for all files</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </section>

              {/* Code Examples */}
              <section id="examples">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Code Examples</h2>
                
                <div className="space-y-6">
                  {/* JavaScript Example */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">JavaScript (Node.js)</h3>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">JavaScript</span>
                        <button className="text-gray-400 hover:text-white">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <pre className="text-gray-300 font-mono text-sm overflow-x-auto">
{`const FormData = require('form-data');
const fs = require('fs');

const form = new FormData();
form.append('file', fs.createReadStream('document.pdf'));
form.append('format', 'markdown');

fetch('https://api.pdftotext.com/v1/process', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer your-api-key-here',
    ...form.getHeaders()
  },
  body: form
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`}
                      </pre>
                    </div>
                  </div>

                  {/* Python Example */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Python</h3>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Python</span>
                        <button className="text-gray-400 hover:text-white">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <pre className="text-gray-300 font-mono text-sm overflow-x-auto">
{`import requests

url = 'https://api.pdftotext.com/v1/process'
headers = {
    'Authorization': 'Bearer your-api-key-here'
}

with open('document.pdf', 'rb') as file:
    files = {'file': file}
    data = {'format': 'markdown'}
    
    response = requests.post(url, headers=headers, files=files, data=data)
    result = response.json()
    print(result)`}
                      </pre>
                    </div>
                  </div>

                  {/* cURL Example */}
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">cURL</h3>
                    <div className="bg-gray-900 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Bash</span>
                        <button className="text-gray-400 hover:text-white">
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      <pre className="text-gray-300 font-mono text-sm overflow-x-auto">
{`curl -X POST https://api.pdftotext.com/v1/process \\
  -H "Authorization: Bearer your-api-key-here" \\
  -F "file=@document.pdf" \\
  -F "format=markdown"`}
                      </pre>
                    </div>
                  </div>
                </div>
              </section>

              {/* Response Format */}
              <section id="response-format">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Response Format</h2>
                <p className="text-gray-600 mb-4">All API responses are returned in JSON format.</p>
                
                <div className="bg-gray-900 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-400 text-sm">Success Response</span>
                    <button className="text-gray-400 hover:text-white">
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                  <pre className="text-gray-300 font-mono text-sm overflow-x-auto">
{`{
  "success": true,
  "data": {
    "text": "Extracted text content...",
    "pages": 5,
    "processingTime": 2341,
    "confidence": 0.987,
    "language": "en",
    "format": "markdown"
  }
}`}
                  </pre>
                </div>
              </section>

              {/* Error Codes */}
              <section id="error-codes">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Error Codes</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-4 py-2 font-mono text-sm">400</td>
                        <td className="px-4 py-2 text-sm">Bad Request</td>
                        <td className="px-4 py-2 text-sm">Invalid request parameters or missing file</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-sm">401</td>
                        <td className="px-4 py-2 text-sm">Unauthorized</td>
                        <td className="px-4 py-2 text-sm">Invalid or missing API key</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-sm">413</td>
                        <td className="px-4 py-2 text-sm">Payload Too Large</td>
                        <td className="px-4 py-2 text-sm">File size exceeds 10MB limit</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-sm">429</td>
                        <td className="px-4 py-2 text-sm">Too Many Requests</td>
                        <td className="px-4 py-2 text-sm">Rate limit exceeded</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2 font-mono text-sm">500</td>
                        <td className="px-4 py-2 text-sm">Internal Server Error</td>
                        <td className="px-4 py-2 text-sm">Processing failed due to server error</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>

              {/* Rate Limits */}
              <section id="rate-limits">
                <h2 className="text-3xl font-bold text-gray-900 mb-6">Rate Limits</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Free Plan</h3>
                    <ul className="text-gray-600 space-y-1">
                      <li>• 10 requests per day</li>
                      <li>• 1 request per minute</li>
                      <li>• Max 1MB file size</li>
                    </ul>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-2">Pro Plan</h3>
                    <ul className="text-gray-600 space-y-1">
                      <li>• 1,000 requests per day</li>
                      <li>• 60 requests per minute</li>
                      <li>• Max 10MB file size</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}