import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Search, 
  Download, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  CheckCircle,
  File
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cloudStorageManager, CloudFile, CloudStorageProvider } from '../lib/cloudStorage';

interface CloudStoragePickerProps {
  onFileSelect: (file: Blob, filename: string) => void;
  className?: string;
}

const CloudStoragePicker: React.FC<CloudStoragePickerProps> = ({
  onFileSelect,
  className = ''
}) => {
  const [providers, setProviders] = useState<CloudStorageProvider[]>([]);
  const [files, setFiles] = useState<CloudFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    setProviders(cloudStorageManager.getAllProviders());
  }, []);

  useEffect(() => {
    if (cloudStorageManager.getConnectedProviders().length > 0) {
      loadFiles();
    }
  }, [providers, searchQuery]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      let results: CloudFile[] = [];
      
      if (selectedProvider === 'all') {
        results = await cloudStorageManager.searchAllProviders(searchQuery);
      } else {
        const provider = cloudStorageManager.getProvider(selectedProvider);
        if (provider && provider.isConnected) {
          results = await provider.listFiles(searchQuery);
        }
      }
      
      setFiles(results);
    } catch (error: any) {
      console.error('Error loading files:', error);
      toast.error('Failed to load files: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const connectProvider = async (providerId: string) => {
    setConnecting(providerId);
    try {
      const provider = cloudStorageManager.getProvider(providerId);
      if (provider) {
        await provider.connect();
        setProviders([...cloudStorageManager.getAllProviders()]);
        toast.success(`Connected to ${provider.name}`);
        loadFiles();
      }
    } catch (error: any) {
      console.error('Error connecting provider:', error);
      toast.error(`Failed to connect to ${providerId}: ${error.message}`);
    } finally {
      setConnecting(null);
    }
  };

  const disconnectProvider = async (providerId: string) => {
    try {
      const provider = cloudStorageManager.getProvider(providerId);
      if (provider) {
        await provider.disconnect();
        setProviders([...cloudStorageManager.getAllProviders()]);
        setFiles([]);
        toast.success(`Disconnected from ${provider.name}`);
      }
    } catch (error: any) {
      console.error('Error disconnecting provider:', error);
      toast.error(`Failed to disconnect: ${error.message}`);
    }
  };

  const selectFile = async (file: CloudFile) => {
    setLoading(true);
    try {
      const provider = cloudStorageManager.getProvider(file.provider);
      if (provider) {
        const blob = await provider.downloadFile(file.id);
        onFileSelect(blob, file.name);
        toast.success(`File "${file.name}" loaded successfully`);
      }
    } catch (error: any) {
      console.error('Error downloading file:', error);
      toast.error(`Failed to download file: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const connectedProviders = providers.filter(p => p.isConnected);
  const disconnectedProviders = providers.filter(p => !p.isConnected);

  return (
    <div className={`bg-white rounded-lg border ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Cloud className="h-5 w-5 text-blue-600 mr-2" />
            <h3 className="text-lg font-medium text-gray-900">Cloud Storage</h3>
          </div>
          {connectedProviders.length > 0 && (
            <button
              onClick={loadFiles}
              disabled={loading}
              className="p-2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>

        {/* Provider Connection Status */}
        <div className="space-y-2 mb-4">
          {providers.map((provider) => (
            <div key={provider.name} className="flex items-center justify-between p-2 bg-gray-50 rounded">
              <div className="flex items-center">
                {provider.isConnected ? (
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-gray-400 mr-2" />
                )}
                <span className="text-sm font-medium">{provider.name}</span>
              </div>
              {provider.isConnected ? (
                <button
                  onClick={() => disconnectProvider(provider.name.toLowerCase().replace(' ', '_'))}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connectProvider(provider.name.toLowerCase().replace(' ', '_'))}
                  disabled={connecting === provider.name.toLowerCase().replace(' ', '_')}
                  className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  {connecting === provider.name.toLowerCase().replace(' ', '_') ? 'Connecting...' : 'Connect'}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Search and Filter */}
        {connectedProviders.length > 0 && (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search PDF files..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {connectedProviders.length > 1 && (
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All connected providers</option>
                {connectedProviders.map((provider) => (
                  <option 
                    key={provider.name} 
                    value={provider.name.toLowerCase().replace(' ', '_')}
                  >
                    {provider.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>

      {/* File List */}
      <div className="max-h-96 overflow-y-auto">
        {connectedProviders.length === 0 ? (
          <div className="p-6 text-center">
            <Cloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No cloud storage connected</h3>
            <p className="text-sm text-gray-500 mb-4">
              Connect to Google Drive or Dropbox to access your PDF files
            </p>
            <div className="space-y-2">
              {disconnectedProviders.map((provider) => (
                <button
                  key={provider.name}
                  onClick={() => connectProvider(provider.name.toLowerCase().replace(' ', '_'))}
                  disabled={connecting === provider.name.toLowerCase().replace(' ', '_')}
                  className="w-full bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {connecting === provider.name.toLowerCase().replace(' ', '_') 
                    ? `Connecting to ${provider.name}...` 
                    : `Connect ${provider.name}`
                  }
                </button>
              ))}
            </div>
          </div>
        ) : loading ? (
          <div className="p-6 text-center">
            <RefreshCw className="mx-auto h-8 w-8 text-blue-600 animate-spin mb-2" />
            <p className="text-sm text-gray-600">Loading files...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-6 text-center">
            <File className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-sm font-medium text-gray-900 mb-2">No PDF files found</h3>
            <p className="text-sm text-gray-500">
              {searchQuery 
                ? `No files match "${searchQuery}"`
                : 'No PDF files in your connected cloud storage'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {files.map((file) => (
              <div
                key={`${file.provider}-${file.id}`}
                className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => selectFile(file)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center">
                      <File className="h-4 w-4 text-red-500 mr-2 flex-shrink-0" />
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {file.name}
                      </p>
                    </div>
                    <div className="mt-1 flex items-center text-xs text-gray-500 space-x-3">
                      <span>{formatFileSize(file.size)}</span>
                      <span>{formatDate(file.modifiedTime)}</span>
                      <span className="capitalize">
                        {file.provider.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <Download className="h-4 w-4 text-gray-400 ml-2 flex-shrink-0" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instructions */}
      {connectedProviders.length > 0 && files.length > 0 && (
        <div className="p-3 bg-blue-50 border-t border-blue-200">
          <p className="text-xs text-blue-600">
            Click on any PDF file to download and process it
          </p>
        </div>
      )}
    </div>
  );
};

export default CloudStoragePicker;