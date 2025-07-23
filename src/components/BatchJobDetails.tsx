import React, { useState, useEffect } from 'react';
import { 
  X, 
  FileText, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Download, 
  RefreshCw,
  AlertTriangle,
  Calendar,
  User,
  Settings,
  BarChart3,
  FileArchive
} from 'lucide-react';
import toast from 'react-hot-toast';

interface BatchFile {
  id: string;
  original_filename: string;
  file_size: number;
  estimated_pages: number;
  actual_pages?: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  error_message?: string;
  error_code?: string;
  processing_started_at?: string;
  processing_completed_at?: string;
  created_at: string;
  processing_record_id?: string;
}

interface BatchJob {
  id: string;
  name: string;
  description?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  total_files: number;
  processed_files: number;
  failed_files: number;
  total_pages: number;
  processed_pages: number;
  estimated_pages: number;
  merge_output: boolean;
  merge_format?: string;
  output_options: any;
  error_details?: any;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface BatchJobDetailsProps {
  job: BatchJob;
  files: BatchFile[];
  isOpen: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onRetryFile: (fileId: string) => Promise<void>;
  onDownloadFile: (fileId: string) => void;
  onDownloadMerged: () => void;
  loading?: boolean;
}

export function BatchJobDetails({
  job,
  files,
  isOpen,
  onClose,
  onRefresh,
  onRetryFile,
  onDownloadFile,
  onDownloadMerged,
  loading = false
}: BatchJobDetailsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'files' | 'settings' | 'logs'>('overview');
  const [fileFilter, setFileFilter] = useState('all');

  // Filter files based on status
  const filteredFiles = files.filter(file => {
    if (fileFilter === 'all') return true;
    return file.status === fileFilter;
  });

  // Calculate statistics
  const stats = {
    totalSize: files.reduce((sum, file) => sum + file.file_size, 0),
    completedFiles: files.filter(f => f.status === 'completed').length,
    failedFiles: files.filter(f => f.status === 'failed').length,
    processingFiles: files.filter(f => f.status === 'processing').length,
    pendingFiles: files.filter(f => f.status === 'pending').length,
    avgFileSize: files.length > 0 ? files.reduce((sum, file) => sum + file.file_size, 0) / files.length : 0,
    successRate: files.length > 0 ? (files.filter(f => f.status === 'completed').length / files.length) * 100 : 0
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Format duration
  const formatDuration = (startTime: string, endTime?: string): string => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const duration = Math.round((end - start) / 1000);
    
    if (duration < 60) return `${duration}s`;
    if (duration < 3600) return `${Math.round(duration / 60)}m`;
    return `${Math.round(duration / 3600)}h`;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" onClick={onClose}></div>

        <div className="inline-block w-full max-w-6xl my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-lg">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">{job.name}</h2>
              <p className="text-sm text-gray-500 mt-1">Job ID: {job.id}</p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={onRefresh}
                disabled={loading}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6">
              {[
                { id: 'overview', label: 'Overview', icon: BarChart3 },
                { id: 'files', label: 'Files', icon: FileText },
                { id: 'settings', label: 'Settings', icon: Settings },
                { id: 'logs', label: 'Logs', icon: Clock }
              ].map(tab => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 inline mr-2" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 max-h-96 overflow-y-auto">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Status and Progress */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-500">Status</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </span>
                    </div>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">
                      {job.processed_files}/{job.total_files}
                    </p>
                    <p className="text-xs text-gray-500">Files Processed</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-500">Pages</h3>
                      <FileText className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">
                      {job.processed_pages}
                    </p>
                    <p className="text-xs text-gray-500">of ~{job.estimated_pages} estimated</p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-500">Success Rate</h3>
                      <CheckCircle className="w-4 h-4 text-gray-400" />
                    </div>
                    <p className="text-2xl font-semibold text-gray-900 mt-2">
                      {stats.successRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">{stats.completedFiles} of {files.length} files</p>
                  </div>
                </div>

                {/* Progress Bar */}
                {job.status === 'processing' && (
                  <div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                      <span>Processing Progress</span>
                      <span>{Math.round((job.processed_files / job.total_files) * 100)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${(job.processed_files / job.total_files) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* File Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-lg font-semibold text-green-600">{stats.completedFiles}</p>
                    <p className="text-xs text-green-600">Completed</p>
                  </div>
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-lg font-semibold text-blue-600">{stats.processingFiles}</p>
                    <p className="text-xs text-blue-600">Processing</p>
                  </div>
                  <div className="text-center p-3 bg-yellow-50 rounded-lg">
                    <p className="text-lg font-semibold text-yellow-600">{stats.pendingFiles}</p>
                    <p className="text-xs text-yellow-600">Pending</p>
                  </div>
                  <div className="text-center p-3 bg-red-50 rounded-lg">
                    <p className="text-lg font-semibold text-red-600">{stats.failedFiles}</p>
                    <p className="text-xs text-red-600">Failed</p>
                  </div>
                </div>

                {/* Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Job Information</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Created:</dt>
                        <dd className="text-sm text-gray-900">{new Date(job.created_at).toLocaleString()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Priority:</dt>
                        <dd className="text-sm text-gray-900">
                          {job.priority} ({job.priority <= 3 ? 'High' : job.priority <= 7 ? 'Normal' : 'Low'})
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Total Size:</dt>
                        <dd className="text-sm text-gray-900">{formatFileSize(stats.totalSize)}</dd>
                      </div>
                      {job.started_at && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Duration:</dt>
                          <dd className="text-sm text-gray-900">
                            {formatDuration(job.started_at, job.completed_at)}
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  <div>
                    <h3 className="text-lg font-medium text-gray-900 mb-3">Output Options</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-sm text-gray-500">Merge Output:</dt>
                        <dd className="text-sm text-gray-900">{job.merge_output ? 'Yes' : 'No'}</dd>
                      </div>
                      {job.merge_output && (
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Format:</dt>
                          <dd className="text-sm text-gray-900">{job.merge_format?.toUpperCase()}</dd>
                        </div>
                      )}
                      {job.description && (
                        <div>
                          <dt className="text-sm text-gray-500 mb-1">Description:</dt>
                          <dd className="text-sm text-gray-900">{job.description}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                {/* Download Actions */}
                {job.status === 'completed' && job.merge_output && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm font-medium text-green-800">Merged Output Ready</h3>
                        <p className="text-sm text-green-600">Your batch processing is complete and merged output is available for download.</p>
                      </div>
                      <button
                        onClick={onDownloadMerged}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Download
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'files' && (
              <div className="space-y-4">
                {/* File Filter */}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Files ({filteredFiles.length})</h3>
                  <select
                    value={fileFilter}
                    onChange={(e) => setFileFilter(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                  >
                    <option value="all">All Files</option>
                    <option value="completed">Completed</option>
                    <option value="processing">Processing</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {/* Files List */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {filteredFiles.length === 0 ? (
                    <div className="p-8 text-center">
                      <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                      <p className="text-gray-500">No files found for the selected filter.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredFiles.map((file) => (
                        <div key={file.id} className="p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-medium text-gray-900 truncate">
                                {file.original_filename}
                              </h4>
                              <div className="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                                <span>{formatFileSize(file.file_size)}</span>
                                <span>~{file.estimated_pages} pages</span>
                                {file.actual_pages && (
                                  <span>({file.actual_pages} actual)</span>
                                )}
                                {file.processing_started_at && (
                                  <span>
                                    {formatDuration(file.processing_started_at, file.processing_completed_at)} duration
                                  </span>
                                )}
                              </div>
                              {file.error_message && (
                                <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs">
                                  <div className="flex items-center text-red-600">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Error: {file.error_message}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center space-x-2 ml-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(file.status)}`}>
                                {file.status}
                              </span>

                              {file.status === 'completed' && file.processing_record_id && (
                                <button
                                  onClick={() => onDownloadFile(file.processing_record_id!)}
                                  className="p-1 text-blue-600 hover:text-blue-700"
                                  title="Download extracted text"
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                              )}

                              {file.status === 'failed' && (
                                <button
                                  onClick={() => onRetryFile(file.id)}
                                  className="p-1 text-green-600 hover:text-green-700"
                                  title="Retry processing"
                                >
                                  <RefreshCw className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-gray-900">Job Settings</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Job Name</label>
                      <p className="mt-1 text-sm text-gray-900">{job.name}</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Priority</label>
                      <p className="mt-1 text-sm text-gray-900">
                        {job.priority} ({job.priority <= 3 ? 'High' : job.priority <= 7 ? 'Normal' : 'Low'})
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Merge Output</label>
                      <p className="mt-1 text-sm text-gray-900">{job.merge_output ? 'Enabled' : 'Disabled'}</p>
                    </div>

                    {job.merge_output && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Output Format</label>
                        <p className="mt-1 text-sm text-gray-900">{job.merge_format?.toUpperCase()}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Created</label>
                      <p className="mt-1 text-sm text-gray-900">{new Date(job.created_at).toLocaleString()}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700">Last Updated</label>
                      <p className="mt-1 text-sm text-gray-900">{new Date(job.updated_at).toLocaleString()}</p>
                    </div>

                    {job.description && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <p className="mt-1 text-sm text-gray-900">{job.description}</p>
                      </div>
                    )}
                  </div>
                </div>

                {job.output_options && Object.keys(job.output_options).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Output Options</label>
                    <pre className="bg-gray-50 p-3 rounded-md text-xs text-gray-700 overflow-auto">
                      {JSON.stringify(job.output_options, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'logs' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900">Processing Logs</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 text-sm">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-500">{new Date(job.created_at).toLocaleString()}</span>
                    <span className="text-gray-900">Job created</span>
                  </div>

                  {job.started_at && (
                    <div className="flex items-center space-x-3 text-sm">
                      <Clock className="w-4 h-4 text-blue-400" />
                      <span className="text-gray-500">{new Date(job.started_at).toLocaleString()}</span>
                      <span className="text-gray-900">Processing started</span>
                    </div>
                  )}

                  {files.filter(f => f.processing_completed_at).map(file => (
                    <div key={file.id} className="flex items-center space-x-3 text-sm">
                      {file.status === 'completed' ? (
                        <CheckCircle className="w-4 h-4 text-green-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-gray-500">{new Date(file.processing_completed_at!).toLocaleString()}</span>
                      <span className="text-gray-900">
                        {file.original_filename} - {file.status}
                        {file.actual_pages && ` (${file.actual_pages} pages)`}
                      </span>
                    </div>
                  ))}

                  {job.completed_at && (
                    <div className="flex items-center space-x-3 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-400" />
                      <span className="text-gray-500">{new Date(job.completed_at).toLocaleString()}</span>
                      <span className="text-gray-900">Job completed</span>
                    </div>
                  )}
                </div>

                {job.error_details && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Error Details</label>
                    <pre className="bg-red-50 border border-red-200 p-3 rounded-md text-xs text-red-700 overflow-auto">
                      {JSON.stringify(job.error_details, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}