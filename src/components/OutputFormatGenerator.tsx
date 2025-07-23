import React, { useState } from 'react';
import { Download, FileText, FileIcon, File, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface OutputGeneratorProps {
  recordId: string;
  originalFilename: string;
  onDownloadGenerated?: (downloadUrl: string, format: string) => void;
}

interface GenerationOptions {
  includeMetadata: boolean;
  preserveFormatting: boolean;
  includeImages: boolean;
  includeTables: boolean;
  includeMathematics: boolean;
  customStyles: {
    headerPrefix?: string;
    tableStyle: 'simple' | 'grid' | 'markdown';
    mathFormat: 'latex' | 'unicode' | 'text';
  };
}

interface GeneratedDownload {
  format: string;
  filename: string;
  downloadUrl: string;
  expiresAt: string;
  size: number;
  mimeType: string;
}

export const OutputFormatGenerator: React.FC<OutputGeneratorProps> = ({
  recordId,
  originalFilename,
  onDownloadGenerated
}) => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [generatedDownloads, setGeneratedDownloads] = useState<GeneratedDownload[]>([]);
  const [options, setOptions] = useState<GenerationOptions>({
    includeMetadata: true,
    preserveFormatting: true,
    includeImages: true,
    includeTables: true,
    includeMathematics: true,
    customStyles: {
      tableStyle: 'grid',
      mathFormat: 'latex'
    }
  });

  const formats = [
    {
      key: 'txt',
      name: 'Plain Text',
      description: 'Simple text format with UTF-8 encoding',
      icon: FileText,
      mimeType: 'text/plain'
    },
    {
      key: 'markdown',
      name: 'Markdown',
      description: 'Structured markdown with tables and formatting',
      icon: FileIcon,
      mimeType: 'text/markdown'
    },
    {
      key: 'docx',
      name: 'Word Document',
      description: 'Rich document with formatting and images',
      icon: File,
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }
  ];

  const generateOutput = async (format: string) => {
    setIsGenerating(format);
    
    try {
      const response = await fetch('/api/generate-output', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('authToken')}`
        },
        body: JSON.stringify({
          recordId,
          format,
          options
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate output');
      }

      const result = await response.json();
      const downloadData: GeneratedDownload = {
        format,
        filename: result.data.filename,
        downloadUrl: result.data.downloadUrl,
        expiresAt: result.data.expiresAt,
        size: result.data.size,
        mimeType: result.data.mimeType
      };

      setGeneratedDownloads(prev => {
        const updated = prev.filter(item => item.format !== format);
        return [...updated, downloadData];
      });

      toast.success(`${format.toUpperCase()} format generated successfully!`);
      
      if (onDownloadGenerated) {
        onDownloadGenerated(downloadData.downloadUrl, format);
      }

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate output');
    } finally {
      setIsGenerating(null);
    }
  };

  const downloadFile = (downloadUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    link.click();
    
    toast.success('Download started!');
  };

  const formatFileSize = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getExistingDownload = (format: string) => {
    return generatedDownloads.find(item => item.format === format);
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Generate Output Formats
        </h3>
        <p className="text-sm text-gray-600">
          Convert your processed document to different formats for download
        </p>
      </div>

      {/* Generation Options */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-md font-medium text-gray-900 mb-3">Generation Options</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeMetadata}
                onChange={(e) => setOptions(prev => ({ ...prev, includeMetadata: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include metadata</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.preserveFormatting}
                onChange={(e) => setOptions(prev => ({ ...prev, preserveFormatting: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Preserve formatting</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeImages}
                onChange={(e) => setOptions(prev => ({ ...prev, includeImages: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include images</span>
            </label>
          </div>
          
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeTables}
                onChange={(e) => setOptions(prev => ({ ...prev, includeTables: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include tables</span>
            </label>
            
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={options.includeMathematics}
                onChange={(e) => setOptions(prev => ({ ...prev, includeMathematics: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Include mathematics</span>
            </label>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">
                Math Format
              </label>
              <select
                value={options.customStyles.mathFormat}
                onChange={(e) => setOptions(prev => ({
                  ...prev,
                  customStyles: {
                    ...prev.customStyles,
                    mathFormat: e.target.value as 'latex' | 'unicode' | 'text'
                  }
                }))}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="latex">LaTeX</option>
                <option value="unicode">Unicode</option>
                <option value="text">Plain Text</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Format Options */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {formats.map((format) => {
          const Icon = format.icon;
          const existingDownload = getExistingDownload(format.key);
          const isCurrentlyGenerating = isGenerating === format.key;
          
          return (
            <div
              key={format.key}
              className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
            >
              <div className="flex items-center mb-3">
                <Icon className="h-6 w-6 text-blue-600 mr-2" />
                <div>
                  <h4 className="text-sm font-medium text-gray-900">{format.name}</h4>
                  <p className="text-xs text-gray-500">{format.description}</p>
                </div>
              </div>

              {existingDownload && !isExpired(existingDownload.expiresAt) ? (
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-green-600">
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Generated
                  </div>
                  
                  <div className="text-xs text-gray-500">
                    <div>Size: {formatFileSize(existingDownload.size)}</div>
                    <div>
                      Expires: {new Date(existingDownload.expiresAt).toLocaleString()}
                    </div>
                  </div>
                  
                  <div className="flex space-x-2">
                    <button
                      onClick={() => downloadFile(existingDownload.downloadUrl, existingDownload.filename)}
                      className="flex-1 inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </button>
                    
                    <button
                      onClick={() => generateOutput(format.key)}
                      disabled={isCurrentlyGenerating}
                      className="px-3 py-2 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      Regenerate
                    </button>
                  </div>
                </div>
              ) : existingDownload && isExpired(existingDownload.expiresAt) ? (
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-red-600">
                    <AlertCircle className="h-4 w-4 mr-1" />
                    Expired
                  </div>
                  
                  <button
                    onClick={() => generateOutput(format.key)}
                    disabled={isCurrentlyGenerating}
                    className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {isCurrentlyGenerating ? (
                      <>
                        <Loader className="h-3 w-3 mr-1 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Regenerate'
                    )}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => generateOutput(format.key)}
                  disabled={isCurrentlyGenerating}
                  className="w-full inline-flex items-center justify-center px-3 py-2 border border-transparent text-xs font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                >
                  {isCurrentlyGenerating ? (
                    <>
                      <Loader className="h-3 w-3 mr-1 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    'Generate'
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {generatedDownloads.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <h4 className="text-sm font-medium text-blue-900 mb-2">
            Download Links
          </h4>
          <p className="text-xs text-blue-700">
            Generated files will be automatically cleaned up after 24 hours for security.
            Download them while they're available.
          </p>
        </div>
      )}
    </div>
  );
};

export default OutputFormatGenerator;