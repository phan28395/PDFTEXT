import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { toast } from 'react-hot-toast';

interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  last_used_at?: string;
  usage_count: number;
  is_active: boolean;
}

interface ApiKeyWithSecret extends ApiKey {
  key?: string;
}

const ApiKeyManager: React.FC = () => {
  const { session } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDescription, setNewKeyDescription] = useState('');
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);

  useEffect(() => {
    if (session) {
      fetchApiKeys();
    }
  }, [session]);

  const fetchApiKeys = async () => {
    try {
      const response = await fetch('/api/developer/api-keys', {
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch API keys');
      }

      const data = await response.json();
      setApiKeys(data.data.apiKeys);
    } catch (error) {
      console.error('Error fetching API keys:', error);
      toast.error('Failed to load API keys');
    } finally {
      setLoading(false);
    }
  };

  const createApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newKeyName.trim()) {
      toast.error('API key name is required');
      return;
    }

    setCreating(true);
    try {
      const response = await fetch('/api/developer/api-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newKeyName.trim(),
          description: newKeyDescription.trim()
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create API key');
      }

      const data = await response.json();
      const newKey = data.data.apiKey;
      
      // Show the new key to the user (only time they'll see it)
      setNewlyCreatedKey(newKey.key);
      
      // Add to list (without the actual key value)
      setApiKeys(prev => [{
        id: newKey.id,
        name: newKey.name,
        created_at: newKey.created_at,
        usage_count: 0,
        is_active: newKey.is_active
      }, ...prev]);
      
      // Reset form
      setNewKeyName('');
      setNewKeyDescription('');
      setShowCreateForm(false);
      
      toast.success('API key created successfully!');
    } catch (error: any) {
      console.error('Error creating API key:', error);
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const deleteApiKey = async (keyId: string, keyName: string) => {
    if (!confirm(`Are you sure you want to delete the API key "${keyName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/developer/api-keys?keyId=${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete API key');
      }

      setApiKeys(prev => prev.filter(key => key.id !== keyId));
      toast.success('API key deleted successfully');
    } catch (error) {
      console.error('Error deleting API key:', error);
      toast.error('Failed to delete API key');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success('Copied to clipboard!');
    }).catch(() => {
      toast.error('Failed to copy to clipboard');
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-lg font-medium text-gray-900">API Keys</h3>
            <p className="mt-1 text-sm text-gray-500">
              Manage your API keys for programmatic access to PDF processing
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(true)}
            disabled={apiKeys.length >= 10}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Create API Key
          </button>
        </div>
      </div>

      {/* Newly created key display */}
      {newlyCreatedKey && (
        <div className="p-6 bg-yellow-50 border-b border-yellow-200">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-medium text-yellow-800">
                Save your API key now!
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>This is the only time you'll be able to see your API key. Copy it and store it safely.</p>
                <div className="mt-3 flex items-center space-x-2">
                  <code className="bg-yellow-100 px-2 py-1 rounded text-xs font-mono break-all">
                    {newlyCreatedKey}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                    className="bg-yellow-600 text-white px-3 py-1 rounded text-xs hover:bg-yellow-700"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div className="mt-3">
                <button
                  onClick={() => setNewlyCreatedKey(null)}
                  className="text-yellow-800 hover:text-yellow-900 text-sm font-medium"
                >
                  I've saved my key ×
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create form */}
      {showCreateForm && (
        <div className="p-6 bg-gray-50 border-b border-gray-200">
          <form onSubmit={createApiKey} className="space-y-4">
            <div>
              <label htmlFor="keyName" className="block text-sm font-medium text-gray-700">
                API Key Name
              </label>
              <input
                type="text"
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production App, Development Testing"
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label htmlFor="keyDescription" className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <textarea
                id="keyDescription"
                value={newKeyDescription}
                onChange={(e) => setNewKeyDescription(e.target.value)}
                placeholder="Describe what this API key will be used for..."
                rows={2}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={creating}
                className="bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Key'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName('');
                  setNewKeyDescription('');
                }}
                className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* API Keys List */}
      <div className="p-6">
        {apiKeys.length === 0 ? (
          <div className="text-center py-8">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No API keys</h3>
            <p className="mt-1 text-sm text-gray-500">
              Create your first API key to start using the API
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div key={apiKey.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-gray-900">{apiKey.name}</h4>
                    <div className="mt-1 text-sm text-gray-500 space-y-1">
                      <p>Created: {formatDate(apiKey.created_at)}</p>
                      {apiKey.last_used_at && (
                        <p>Last used: {formatDate(apiKey.last_used_at)}</p>
                      )}
                      <p>Usage count: {apiKey.usage_count.toLocaleString()}</p>
                      <p className="font-mono text-xs">Key ID: {apiKey.id}</p>
                    </div>
                  </div>
                  <div className="flex space-x-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      apiKey.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {apiKey.is_active ? 'Active' : 'Inactive'}
                    </span>
                    <button
                      onClick={() => deleteApiKey(apiKey.id, apiKey.name)}
                      className="text-red-600 hover:text-red-800 text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Documentation section */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-900 mb-2">API Documentation</h4>
        <div className="text-sm text-gray-600 space-y-2">
          <p><strong>Endpoint:</strong> <code className="bg-gray-200 px-1 rounded">POST /api/developer/process</code></p>
          <p><strong>Authentication:</strong> Include your API key in the <code className="bg-gray-200 px-1 rounded">X-API-Key</code> header</p>
          <p><strong>Rate Limits:</strong> Free: 60/hour, 500/day | Pro: 600/hour, 10,000/day</p>
          <div className="mt-3">
            <details className="cursor-pointer">
              <summary className="font-medium">Example Usage</summary>
              <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
{`curl -X POST /api/developer/process \\
  -H "X-API-Key: your_api_key_here" \\
  -F "file=@document.pdf" \\
  -F "enableAdvancedOCR=true" \\
  -F "includeMetadata=true"`}
              </pre>
            </details>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyManager;