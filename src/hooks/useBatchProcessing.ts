import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
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
  output_options: any;
  error_details?: any;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

interface BatchFile {
  id: string;
  batch_job_id: string;
  processing_record_id?: string;
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
  updated_at: string;
}

interface CreateJobData {
  name: string;
  description?: string;
  files: Array<{
    file: File;
    estimatedPages: number;
  }>;
  priority: number;
  mergeOutput: boolean;
  mergeFormat?: 'txt' | 'md' | 'docx';
}

interface JobsQuery {
  page?: number;
  limit?: number;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export function useBatchProcessing() {
  const { user, getAuthHeaders } = useAuth();
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [files, setFiles] = useState<{ [jobId: string]: BatchFile[] }>({});
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Fetch batch jobs
  const fetchJobs = useCallback(async (query: JobsQuery = {}) => {
    if (!user) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, value.toString());
        }
      });

      const response = await fetch(`/api/batch/jobs?${params}`, {
        headers: await getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch batch jobs');
      }

      const data = await response.json();
      if (data.success) {
        setJobs(data.data.jobs);
        return data.data;
      } else {
        throw new Error(data.error || 'Failed to fetch jobs');
      }
    } catch (error) {
      console.error('Error fetching batch jobs:', error);
      toast.error('Failed to fetch batch jobs');
      return { jobs: [], pagination: null };
    } finally {
      setLoading(false);
    }
  }, [user, getAuthHeaders]);

  // Fetch files for a specific job
  const fetchJobFiles = useCallback(async (jobId: string) => {
    if (!user) return [];

    try {
      const response = await fetch(`/api/batch/jobs/${jobId}/files`, {
        headers: await getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to fetch job files');
      }

      const data = await response.json();
      if (data.success) {
        setFiles(prev => ({ ...prev, [jobId]: data.data.files }));
        return data.data.files;
      } else {
        throw new Error(data.error || 'Failed to fetch files');
      }
    } catch (error) {
      console.error('Error fetching job files:', error);
      toast.error('Failed to fetch job files');
      return [];
    }
  }, [user, getAuthHeaders]);

  // Create new batch job
  const createJob = useCallback(async (jobData: CreateJobData) => {
    if (!user) {
      toast.error('Authentication required');
      return null;
    }

    setCreating(true);
    try {
      // Prepare file data for API
      const filesData = jobData.files.map(({ file, estimatedPages }) => ({
        name: file.name,
        size: file.size,
        estimatedPages
      }));

      const response = await fetch('/api/batch/create-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({
          name: jobData.name,
          description: jobData.description,
          files: filesData,
          priority: jobData.priority,
          mergeOutput: jobData.mergeOutput,
          mergeFormat: jobData.mergeFormat
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create batch job');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Batch job created successfully');
        
        // Upload files to the created job
        const uploadSuccess = await uploadJobFiles(data.data.batchJob.id, jobData.files);
        
        if (uploadSuccess) {
          // Refresh jobs list
          await fetchJobs();
          return data.data.batchJob;
        } else {
          throw new Error('Failed to upload files');
        }
      } else {
        throw new Error(data.error || 'Failed to create job');
      }
    } catch (error) {
      console.error('Error creating batch job:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create batch job');
      return null;
    } finally {
      setCreating(false);
    }
  }, [user, getAuthHeaders, fetchJobs]);

  // Upload files to a job
  const uploadJobFiles = useCallback(async (jobId: string, files: Array<{ file: File }>) => {
    if (!user) return false;

    try {
      const formData = new FormData();
      formData.append('batchJobId', jobId);
      
      files.forEach(({ file }) => {
        formData.append('files', file);
      });

      const response = await fetch('/api/batch/upload-files', {
        method: 'POST',
        headers: await getAuthHeaders(),
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to upload files');
      }

      const data = await response.json();
      if (data.success) {
        if (data.data.errors.length > 0) {
          data.data.errors.forEach((error: any) => {
            toast.error(`${error.filename}: ${error.error}`);
          });
        }
        
        if (data.data.processedFiles.length > 0) {
          toast.success(`Uploaded ${data.data.processedFiles.length} files successfully`);
        }
        
        return data.data.processedFiles.length > 0;
      } else {
        throw new Error(data.error || 'Failed to upload files');
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('Failed to upload files');
      return false;
    }
  }, [user, getAuthHeaders]);

  // Process a batch job
  const processJob = useCallback(async (jobId: string) => {
    if (!user) return false;

    setProcessing(true);
    try {
      const response = await fetch('/api/batch/process-job', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ batchJobId: jobId })
      });

      if (!response.ok) {
        throw new Error('Failed to start job processing');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Batch processing started');
        
        // Refresh jobs and files
        await Promise.all([
          fetchJobs(),
          fetchJobFiles(jobId)
        ]);
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to process job');
      }
    } catch (error) {
      console.error('Error processing job:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process job');
      return false;
    } finally {
      setProcessing(false);
    }
  }, [user, getAuthHeaders, fetchJobs, fetchJobFiles]);

  // Update job
  const updateJob = useCallback(async (jobId: string, updates: Partial<BatchJob>) => {
    if (!user) return false;

    try {
      const response = await fetch('/api/batch/jobs', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ jobId, ...updates })
      });

      if (!response.ok) {
        throw new Error('Failed to update job');
      }

      const data = await response.json();
      if (data.success) {
        // Update local state
        setJobs(prev => prev.map(job => 
          job.id === jobId ? { ...job, ...data.data.job } : job
        ));
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to update job');
      }
    } catch (error) {
      console.error('Error updating job:', error);
      toast.error('Failed to update job');
      return false;
    }
  }, [user, getAuthHeaders]);

  // Delete job
  const deleteJob = useCallback(async (jobId: string) => {
    if (!user) return false;

    try {
      const response = await fetch(`/api/batch/jobs?jobId=${jobId}`, {
        method: 'DELETE',
        headers: await getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Failed to delete job');
      }

      const data = await response.json();
      if (data.success) {
        // Remove from local state
        setJobs(prev => prev.filter(job => job.id !== jobId));
        setFiles(prev => {
          const newFiles = { ...prev };
          delete newFiles[jobId];
          return newFiles;
        });
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to delete job');
      }
    } catch (error) {
      console.error('Error deleting job:', error);
      toast.error('Failed to delete job');
      return false;
    }
  }, [user, getAuthHeaders]);

  // Retry failed file
  const retryFile = useCallback(async (fileId: string) => {
    if (!user) return false;

    try {
      const response = await fetch('/api/batch/retry-file', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ fileId })
      });

      if (!response.ok) {
        throw new Error('Failed to retry file');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('File queued for retry');
        
        // Refresh files for the job
        const file = Object.values(files).flat().find(f => f.id === fileId);
        if (file) {
          await fetchJobFiles(file.batch_job_id);
        }
        
        return true;
      } else {
        throw new Error(data.error || 'Failed to retry file');
      }
    } catch (error) {
      console.error('Error retrying file:', error);
      toast.error('Failed to retry file');
      return false;
    }
  }, [user, getAuthHeaders, files, fetchJobFiles]);

  // Download merged output
  const downloadMergedOutput = useCallback(async (jobId: string) => {
    if (!user) return;

    try {
      const response = await fetch('/api/batch/merge-outputs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getAuthHeaders())
        },
        body: JSON.stringify({ batchJobId: jobId })
      });

      if (!response.ok) {
        throw new Error('Failed to generate merged output');
      }

      const data = await response.json();
      if (data.success) {
        // Trigger download
        window.open(data.data.downloadUrl, '_blank');
        toast.success('Download started');
      } else {
        throw new Error(data.error || 'Failed to generate output');
      }
    } catch (error) {
      console.error('Error downloading merged output:', error);
      toast.error('Failed to download merged output');
    }
  }, [user, getAuthHeaders]);

  // Download individual file
  const downloadFile = useCallback(async (processingRecordId: string) => {
    if (!user) return;

    try {
      window.open(`/api/download-processing-result/${processingRecordId}`, '_blank');
      toast.success('Download started');
    } catch (error) {
      console.error('Error downloading file:', error);
      toast.error('Failed to download file');
    }
  }, [user]);

  // Auto-refresh jobs periodically
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      // Only auto-refresh if there are processing jobs
      const hasProcessingJobs = jobs.some(job => job.status === 'processing');
      if (hasProcessingJobs) {
        await fetchJobs();
      }
    }, 10000); // Refresh every 10 seconds

    return () => clearInterval(interval);
  }, [user, jobs, fetchJobs]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchJobs();
    }
  }, [user, fetchJobs]);

  return {
    // Data
    jobs,
    files,
    
    // Loading states
    loading,
    creating,
    processing,
    
    // Actions
    fetchJobs,
    fetchJobFiles,
    createJob,
    processJob,
    updateJob,
    deleteJob,
    retryFile,
    downloadMergedOutput,
    downloadFile,
    
    // Helpers
    refreshJobs: () => fetchJobs(),
    getJobFiles: (jobId: string) => files[jobId] || []
  };
}