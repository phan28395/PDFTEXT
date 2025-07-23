import React, { useState, useEffect } from 'react';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Play, 
  Pause, 
  RotateCcw, 
  Trash2, 
  Download,
  Eye,
  MoreVertical,
  Filter,
  Search,
  FileText,
  Folder,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

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
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface BatchJobsListProps {
  jobs: BatchJob[];
  loading: boolean;
  onRefresh: () => void;
  onUpdateJob: (jobId: string, updates: Partial<BatchJob>) => Promise<void>;
  onDeleteJob: (jobId: string) => Promise<void>;
  onViewJob: (job: BatchJob) => void;
  onProcessJob: (jobId: string) => Promise<void>;
}

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  processing: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800'
};

const statusIcons = {
  pending: Clock,
  processing: Play,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Pause
};

export function BatchJobsList({
  jobs,
  loading,
  onRefresh,
  onUpdateJob,
  onDeleteJob,
  onViewJob,
  onProcessJob
}: BatchJobsListProps) {
  const [filteredJobs, setFilteredJobs] = useState<BatchJob[]>(jobs);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'updated_at' | 'name' | 'priority'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedJobs, setSelectedJobs] = useState<Set<string>>(new Set());
  const [showActions, setShowActions] = useState<string | null>(null);

  // Update filtered jobs when jobs or filters change
  useEffect(() => {
    let filtered = [...jobs];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(job => 
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (job.description && job.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aValue: any = a[sortBy];
      let bValue: any = b[sortBy];

      if (sortBy === 'created_at' || sortBy === 'updated_at') {
        aValue = new Date(aValue).getTime();
        bValue = new Date(bValue).getTime();
      }

      if (sortOrder === 'asc') {
        return aValue > bValue ? 1 : -1;
      } else {
        return aValue < bValue ? 1 : -1;
      }
    });

    setFilteredJobs(filtered);
  }, [jobs, searchTerm, statusFilter, sortBy, sortOrder]);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Calculate progress percentage
  const calculateProgress = (job: BatchJob) => {
    if (job.total_files === 0) return 0;
    return Math.round((job.processed_files / job.total_files) * 100);
  };

  // Get priority label
  const getPriorityLabel = (priority: number) => {
    if (priority <= 3) return 'High';
    if (priority <= 7) return 'Normal';
    return 'Low';
  };

  // Handle job action
  const handleJobAction = async (action: string, job: BatchJob) => {
    try {
      switch (action) {
        case 'process':
          await onProcessJob(job.id);
          break;
        case 'retry':
          await onUpdateJob(job.id, { status: 'pending' });
          toast.success('Job queued for retry');
          break;
        case 'cancel':
          await onUpdateJob(job.id, { status: 'cancelled' });
          toast.success('Job cancelled');
          break;
        case 'delete':
          if (window.confirm('Are you sure you want to delete this job?')) {
            await onDeleteJob(job.id);
            toast.success('Job deleted');
          }
          break;
        case 'view':
          onViewJob(job);
          break;
      }
    } catch (error) {
      toast.error(`Failed to ${action} job`);
    }
    setShowActions(null);
  };

  // Handle bulk actions
  const handleBulkAction = async (action: string) => {
    if (selectedJobs.size === 0) {
      toast.error('No jobs selected');
      return;
    }

    if (action === 'delete' && !window.confirm(`Delete ${selectedJobs.size} selected jobs?`)) {
      return;
    }

    try {
      const promises = Array.from(selectedJobs).map(jobId => {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return Promise.resolve();

        switch (action) {
          case 'cancel':
            return onUpdateJob(jobId, { status: 'cancelled' });
          case 'retry':
            return onUpdateJob(jobId, { status: 'pending' });
          case 'delete':
            return onDeleteJob(jobId);
          default:
            return Promise.resolve();
        }
      });

      await Promise.all(promises);
      setSelectedJobs(new Set());
      toast.success(`Bulk ${action} completed`);
    } catch (error) {
      toast.error(`Bulk ${action} failed`);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900">Batch Jobs</h2>
          <button
            onClick={onRefresh}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Refresh
          </button>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 w-full"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
            </select>

            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [field, order] = e.target.value.split('-');
                setSortBy(field as any);
                setSortOrder(order as 'asc' | 'desc');
              }}
              className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="created_at-desc">Newest First</option>
              <option value="created_at-asc">Oldest First</option>
              <option value="updated_at-desc">Recently Updated</option>
              <option value="name-asc">Name A-Z</option>
              <option value="name-desc">Name Z-A</option>
              <option value="priority-asc">Priority High-Low</option>
              <option value="priority-desc">Priority Low-High</option>
            </select>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedJobs.size > 0 && (
          <div className="mt-4 p-3 bg-blue-50 rounded-md">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700">
                {selectedJobs.size} job(s) selected
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => handleBulkAction('retry')}
                  className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
                >
                  Retry Selected
                </button>
                <button
                  onClick={() => handleBulkAction('cancel')}
                  className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200"
                >
                  Cancel Selected
                </button>
                <button
                  onClick={() => handleBulkAction('delete')}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Jobs List */}
      <div className="divide-y divide-gray-200">
        {filteredJobs.length === 0 ? (
          <div className="p-12 text-center">
            <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No batch jobs found</h3>
            <p className="text-gray-500">
              {searchTerm || statusFilter !== 'all' 
                ? 'Try adjusting your filters or search term'
                : 'Create your first batch job to get started'
              }
            </p>
          </div>
        ) : (
          filteredJobs.map((job) => {
            const StatusIcon = statusIcons[job.status];
            const progress = calculateProgress(job);

            return (
              <div key={job.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selectedJobs.has(job.id)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedJobs);
                        if (e.target.checked) {
                          newSelected.add(job.id);
                        } else {
                          newSelected.delete(job.id);
                        }
                        setSelectedJobs(newSelected);
                      }}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />

                    {/* Job Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {job.name}
                        </h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[job.status]}`}>
                          <StatusIcon className="w-3 h-3 mr-1" />
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          job.priority <= 3 ? 'bg-red-100 text-red-800' :
                          job.priority <= 7 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {getPriorityLabel(job.priority)}
                        </span>
                      </div>

                      {job.description && (
                        <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                          {job.description}
                        </p>
                      )}

                      <div className="flex items-center space-x-4 text-sm text-gray-500 mb-2">
                        <div className="flex items-center">
                          <FileText className="w-4 h-4 mr-1" />
                          {job.processed_files}/{job.total_files} files
                        </div>
                        <div>
                          {job.processed_pages}/{job.estimated_pages} pages
                        </div>
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(job.created_at)}
                        </div>
                        {job.merge_output && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            Merge: {job.merge_format?.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Progress Bar */}
                      {job.status === 'processing' && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${progress}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="relative ml-4">
                    <button
                      onClick={() => setShowActions(showActions === job.id ? null : job.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
                    >
                      <MoreVertical className="w-5 h-5" />
                    </button>

                    {showActions === job.id && (
                      <div className="absolute right-0 top-10 bg-white border border-gray-200 rounded-md shadow-lg z-10 py-1 min-w-48">
                        <button
                          onClick={() => handleJobAction('view', job)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </button>

                        {job.status === 'pending' && (
                          <button
                            onClick={() => handleJobAction('process', job)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Play className="w-4 h-4 mr-2" />
                            Start Processing
                          </button>
                        )}

                        {job.status === 'failed' && (
                          <button
                            onClick={() => handleJobAction('retry', job)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Retry
                          </button>
                        )}

                        {['pending', 'processing'].includes(job.status) && (
                          <button
                            onClick={() => handleJobAction('cancel', job)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Pause className="w-4 h-4 mr-2" />
                            Cancel
                          </button>
                        )}

                        {job.status === 'completed' && job.merge_output && (
                          <button
                            onClick={() => handleJobAction('download', job)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center"
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download
                          </button>
                        )}

                        {job.status !== 'processing' && (
                          <button
                            onClick={() => handleJobAction('delete', job)}
                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}