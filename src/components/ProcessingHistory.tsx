import { useState } from 'react';
import { 
  FileText, 
  Download, 
  Trash2, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  Copy,
  FileDown
} from 'lucide-react';
import { useProcessingHistory } from '@/hooks/useProcessing';
import { downloadTextFile, formatProcessingTime } from '@/api/processing';
import { ProcessingRecord } from '@/api/processing';
import toast from 'react-hot-toast';
import { LoadingSpinner } from './LoadingSpinner';

interface ProcessingHistoryProps {
  className?: string;
}

interface RecordDetailsModalProps {
  record: ProcessingRecord | null;
  isOpen: boolean;
  onClose: () => void;
}

function RecordDetailsModal({ record, isOpen, onClose }: RecordDetailsModalProps) {
  if (!isOpen || !record) return null;

  const handleDownload = () => {
    if (record.text_content) {
      downloadTextFile(record.text_content, record.filename);
      toast.success('Text file downloaded successfully!');
    }
  };

  const handleCopyText = () => {
    if (record.text_content) {
      navigator.clipboard.writeText(record.text_content);
      toast.success('Text copied to clipboard!');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Processing Details</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XCircle className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 overflow-y-auto">
          <div className="space-y-6">
            {/* File Information */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">File Information</h4>
              <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
                <div>
                  <span className="text-xs text-gray-500">Filename</span>
                  <p className="text-sm font-medium text-gray-900 truncate">{record.filename}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Pages Processed</span>
                  <p className="text-sm font-medium text-gray-900">{record.pages_processed}</p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Processing Time</span>
                  <p className="text-sm font-medium text-gray-900">
                    {formatProcessingTime(record.processing_time || 0)}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500">Created</span>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(record.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Extracted Text */}
            {record.text_content && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-900">Extracted Text</h4>
                  <div className="flex space-x-2">
                    <button
                      onClick={handleCopyText}
                      className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded hover:bg-blue-200 transition-colors inline-flex items-center"
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </button>
                    <button
                      onClick={handleDownload}
                      className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200 transition-colors inline-flex items-center"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Download
                    </button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <pre className="text-sm text-gray-700 whitespace-pre-wrap font-mono">
                    {record.text_content}
                  </pre>
                </div>
              </div>
            )}

            {/* Error Message */}
            {record.error_message && (
              <div>
                <h4 className="text-sm font-medium text-red-900 mb-3">Error Details</h4>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-700">{record.error_message}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-gray-200">
          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
            {record.text_content && (
              <button
                onClick={handleDownload}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Text
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProcessingHistory({ className = '' }: ProcessingHistoryProps) {
  const {
    records,
    pagination,
    loading,
    error,
    fetchHistory,
    deleteRecord,
    setStatusFilter,
    setSearchFilter,
    statusFilter,
    searchFilter
  } = useProcessingHistory();

  const [selectedRecord, setSelectedRecord] = useState<ProcessingRecord | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [localSearch, setLocalSearch] = useState(searchFilter);
  const [exporting, setExporting] = useState(false);

  const handleSearch = () => {
    setSearchFilter(localSearch);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleDelete = async (record: ProcessingRecord) => {
    if (confirm(`Are you sure you want to delete "${record.filename}"?`)) {
      await deleteRecord(record.id);
    }
  };

  const handleViewDetails = (record: ProcessingRecord) => {
    setSelectedRecord(record);
    setShowDetailsModal(true);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      const token = localStorage.getItem('supabase.auth.token');
      if (!token) {
        toast.error('Authentication required');
        return;
      }

      const params = new URLSearchParams({
        format,
        ...(statusFilter !== 'all' && { status: statusFilter }),
        ...(searchFilter && { search: searchFilter })
      });

      const response = await fetch(`/api/export-history?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Export failed');
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('Content-Disposition');
      const filename = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `processing-history.${format}`;

      // Create download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`History exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error(error instanceof Error ? error.message : 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (error) {
    return (
      <div className={`${className}`}>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center text-red-800">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span className="font-medium">Failed to load processing history</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="bg-white rounded-lg shadow">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Processing History</h2>
              <p className="text-sm text-gray-600 mt-1">
                {pagination ? `${pagination.total} total records` : 'View your processing history'}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative">
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center text-sm disabled:opacity-50"
                  disabled={exporting || records.length === 0}
                  onClick={() => {
                    const menu = document.getElementById('export-menu');
                    menu?.classList.toggle('hidden');
                  }}
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  {exporting ? 'Exporting...' : 'Export'}
                </button>
                <div id="export-menu" className="hidden absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                  <div className="py-1">
                    <button
                      onClick={() => {
                        handleExport('csv');
                        document.getElementById('export-menu')?.classList.add('hidden');
                      }}
                      className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      Export as CSV
                    </button>
                    <button
                      onClick={() => {
                        handleExport('json');
                        document.getElementById('export-menu')?.classList.add('hidden');
                      }}
                      className="block w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 text-left"
                    >
                      Export as JSON
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="flex">
                <input
                  type="text"
                  placeholder="Search by filename..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors"
                >
                  <Search className="h-4 w-4 text-gray-600" />
                </button>
              </div>
            </div>

            {/* Status Filter */}
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="processing">Processing</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="text-center py-8">
              <LoadingSpinner size="lg" />
              <p className="text-gray-600 mt-2">Loading processing history...</p>
            </div>
          ) : records.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No processing history</h3>
              <p className="text-gray-600">
                {searchFilter || statusFilter !== 'all' 
                  ? 'No records match your current filters' 
                  : 'Start by uploading and processing your first PDF file'
                }
              </p>
            </div>
          ) : (
            <>
              {/* Records Table */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        File
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Pages
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {records.map((record) => (
                      <tr key={record.id} className="hover:bg-gray-50">
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            <FileText className="h-5 w-5 text-gray-400 mr-3" />
                            <div>
                              <p className="text-sm font-medium text-gray-900 truncate max-w-xs">
                                {record.filename}
                              </p>
                              {record.processing_time && (
                                <p className="text-xs text-gray-500">
                                  {formatProcessingTime(record.processing_time)}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            {getStatusIcon(record.status)}
                            <span className={`ml-2 px-2 py-1 text-xs rounded-full ${getStatusColor(record.status)}`}>
                              {record.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-900">{record.pages_processed || 0}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-900">
                            {new Date(record.created_at).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right space-x-2">
                          <button
                            onClick={() => handleViewDetails(record)}
                            className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-100 transition-colors"
                            title="View details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {record.text_content && (
                            <button
                              onClick={() => downloadTextFile(record.text_content!, record.filename)}
                              className="text-green-600 hover:text-green-800 p-1 rounded hover:bg-green-100 transition-colors"
                              title="Download text"
                            >
                              <Download className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(record)}
                            className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100 transition-colors"
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex items-center justify-between">
                  <div className="text-sm text-gray-700">
                    Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => fetchHistory(pagination.page - 1)}
                      disabled={!pagination.hasPrev}
                      className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-3 py-1 text-sm bg-gray-100 rounded">
                      {pagination.page} of {pagination.totalPages}
                    </span>
                    <button
                      onClick={() => fetchHistory(pagination.page + 1)}
                      disabled={!pagination.hasNext}
                      className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Details Modal */}
      <RecordDetailsModal
        record={selectedRecord}
        isOpen={showDetailsModal}
        onClose={() => setShowDetailsModal(false)}
      />
    </div>
  );
}