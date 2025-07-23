import React, { useState, useEffect } from 'react';
import { BatchUpload } from '../components/BatchUpload';
import { BatchJobsList } from '../components/BatchJobsList';
import { BatchJobDetails } from '../components/BatchJobDetails';
import { useBatchProcessing } from '../hooks/useBatchProcessing';
import { useAuth } from '../hooks/useAuth';
import Layout from '../components/Layout';
import { Plus, FileText, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileItem {
  file: File;
  id: string;
  size: number;
  estimatedPages: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

function BatchProcessing() {
  const { user } = useAuth();
  const {
    jobs,
    files,
    loading,
    creating,
    processing,
    fetchJobs,
    fetchJobFiles,
    createJob,
    processJob,
    updateJob,
    deleteJob,
    retryFile,
    downloadMergedOutput,
    downloadFile,
    getJobFiles
  } = useBatchProcessing();

  const [selectedFiles, setSelectedFiles] = useState<FileItem[]>([]);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);

  // Handle file selection from upload component
  const handleFilesSelected = (files: FileItem[]) => {
    setSelectedFiles(files);
  };

  // Handle job creation
  const handleCreateJob = async (jobData: {
    name: string;
    description?: string;
    files: FileItem[];
    priority: number;
    mergeOutput: boolean;
    mergeFormat?: 'txt' | 'md' | 'docx';
  }) => {
    try {
      const result = await createJob({
        name: jobData.name,
        description: jobData.description,
        files: jobData.files.map(f => ({
          file: f.file,
          estimatedPages: f.estimatedPages
        })),
        priority: jobData.priority,
        mergeOutput: jobData.mergeOutput,
        mergeFormat: jobData.mergeFormat
      });

      if (result) {
        setSelectedFiles([]);
        setShowUpload(false);
        toast.success('Batch job created and files uploaded successfully!');
      }
    } catch (error) {
      console.error('Error creating job:', error);
      toast.error('Failed to create batch job');
    }
  };

  // Handle job processing
  const handleProcessJob = async (jobId: string) => {
    try {
      const success = await processJob(jobId);
      if (success) {
        toast.success('Batch processing started');
      }
    } catch (error) {
      console.error('Error processing job:', error);
      toast.error('Failed to start processing');
    }
  };

  // Handle job view
  const handleViewJob = async (job: any) => {
    setSelectedJob(job);
    await fetchJobFiles(job.id);
    setShowJobDetails(true);
  };

  // Handle file retry
  const handleRetryFile = async (fileId: string) => {
    try {
      const success = await retryFile(fileId);
      if (success && selectedJob) {
        // Refresh job files
        await fetchJobFiles(selectedJob.id);
      }
    } catch (error) {
      console.error('Error retrying file:', error);
      toast.error('Failed to retry file');
    }
  };

  // Handle download file
  const handleDownloadFile = (processingRecordId: string) => {
    downloadFile(processingRecordId);
  };

  // Handle download merged output
  const handleDownloadMerged = () => {
    if (selectedJob) {
      downloadMergedOutput(selectedJob.id);
    }
  };

  // Refresh job details
  const handleRefreshJobDetails = async () => {
    if (selectedJob) {
      await fetchJobFiles(selectedJob.id);
      await fetchJobs(); // Also refresh the main jobs list
    }
  };

  // Calculate dashboard stats
  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    processing: jobs.filter(j => j.status === 'processing').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length
  };

  if (!user) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
          <p className="text-gray-600">Please log in to access batch processing.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Batch Processing</h1>
              <p className="mt-2 text-gray-600">
                Process multiple PDF files at once with advanced queuing and progress tracking.
              </p>
            </div>
            
            <button
              onClick={() => setShowUpload(!showUpload)}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              New Batch Job
            </button>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <FileText className="w-8 h-8 text-gray-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Total Jobs</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <Clock className="w-8 h-8 text-yellow-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Pending</p>
                  <p className="text-2xl font-semibold text-yellow-600">{stats.pending}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <div className="w-3 h-3 bg-blue-600 rounded-full animate-pulse"></div>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Processing</p>
                  <p className="text-2xl font-semibold text-blue-600">{stats.processing}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <CheckCircle className="w-8 h-8 text-green-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Completed</p>
                  <p className="text-2xl font-semibold text-green-600">{stats.completed}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center">
                <AlertTriangle className="w-8 h-8 text-red-400" />
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-500">Failed</p>
                  <p className="text-2xl font-semibold text-red-600">{stats.failed}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Upload Section */}
        {showUpload && (
          <div className="mb-8">
            <BatchUpload
              onFilesSelected={handleFilesSelected}
              onCreateJob={handleCreateJob}
              isCreatingJob={creating}
              maxFiles={100}
            />
          </div>
        )}

        {/* Jobs List */}
        <BatchJobsList
          jobs={jobs}
          loading={loading}
          onRefresh={fetchJobs}
          onUpdateJob={updateJob}
          onDeleteJob={deleteJob}
          onViewJob={handleViewJob}
          onProcessJob={handleProcessJob}
        />

        {/* Job Details Modal */}
        <BatchJobDetails
          job={selectedJob}
          files={selectedJob ? getJobFiles(selectedJob.id) : []}
          isOpen={showJobDetails}
          onClose={() => {
            setShowJobDetails(false);
            setSelectedJob(null);
          }}
          onRefresh={handleRefreshJobDetails}
          onRetryFile={handleRetryFile}
          onDownloadFile={handleDownloadFile}
          onDownloadMerged={handleDownloadMerged}
          loading={processing}
        />
      </div>
    </Layout>
  );
}

export default BatchProcessing;