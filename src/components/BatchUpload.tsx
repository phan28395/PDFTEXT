import React, { useState, useCallback, useRef } from 'react';
import { Upload, X, FileText, FolderOpen, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface FileItem {
  file: File;
  id: string;
  size: number;
  estimatedPages: number;
  status: 'pending' | 'uploading' | 'uploaded' | 'error';
  error?: string;
}

interface BatchUploadProps {
  onFilesSelected: (files: FileItem[]) => void;
  onCreateJob: (jobData: {
    name: string;
    description?: string;
    files: FileItem[];
    priority: number;
    mergeOutput: boolean;
    mergeFormat?: 'txt' | 'md' | 'docx';
  }) => Promise<void>;
  isCreatingJob?: boolean;
  maxFiles?: number;
}

export function BatchUpload({ 
  onFilesSelected, 
  onCreateJob, 
  isCreatingJob = false,
  maxFiles = 100 
}: BatchUploadProps) {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [jobName, setJobName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [priority, setPriority] = useState(5);
  const [mergeOutput, setMergeOutput] = useState(false);
  const [mergeFormat, setMergeFormat] = useState<'txt' | 'md' | 'docx'>('txt');
  const [showJobForm, setShowJobForm] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Estimate pages based on file size (rough estimate: 1 page per 50KB)
  const estimatePages = (fileSize: number): number => {
    return Math.max(1, Math.ceil(fileSize / (50 * 1024)));
  };

  // Validate file
  const validateFile = (file: File): { isValid: boolean; error?: string } => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return { isValid: false, error: 'Only PDF files are allowed' };
    }
    
    if (file.size > 50 * 1024 * 1024) { // 50MB limit
      return { isValid: false, error: 'File size must be less than 50MB' };
    }
    
    return { isValid: true };
  };

  // Handle file selection
  const handleFiles = useCallback((selectedFiles: FileList | File[]) => {
    const fileArray = Array.from(selectedFiles);
    
    if (files.length + fileArray.length > maxFiles) {
      toast.error(`Maximum ${maxFiles} files allowed`);
      return;
    }

    const newFiles: FileItem[] = [];
    const errors: string[] = [];

    fileArray.forEach((file) => {
      const validation = validateFile(file);
      
      if (!validation.isValid) {
        errors.push(`${file.name}: ${validation.error}`);
        return;
      }

      // Check for duplicates
      const isDuplicate = files.some(existingFile => 
        existingFile.file.name === file.name && 
        existingFile.file.size === file.size
      );

      if (isDuplicate) {
        errors.push(`${file.name}: File already added`);
        return;
      }

      const fileItem: FileItem = {
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        size: file.size,
        estimatedPages: estimatePages(file.size),
        status: 'pending'
      };

      newFiles.push(fileItem);
    });

    if (errors.length > 0) {
      errors.forEach(error => toast.error(error));
    }

    if (newFiles.length > 0) {
      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesSelected(updatedFiles);
      toast.success(`Added ${newFiles.length} file(s)`);
    }
  }, [files, maxFiles, onFilesSelected]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles) {
      handleFiles(droppedFiles);
    }
  }, [handleFiles]);

  // File input handlers
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const handleFolderInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  // Remove file
  const removeFile = (fileId: string) => {
    const updatedFiles = files.filter(f => f.id !== fileId);
    setFiles(updatedFiles);
    onFilesSelected(updatedFiles);
  };

  // Clear all files
  const clearAllFiles = () => {
    setFiles([]);
    onFilesSelected([]);
  };

  // Calculate totals
  const totalFiles = files.length;
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  const totalEstimatedPages = files.reduce((sum, file) => sum + file.estimatedPages, 0);

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Handle job creation
  const handleCreateJob = async () => {
    if (!jobName.trim()) {
      toast.error('Job name is required');
      return;
    }

    if (files.length === 0) {
      toast.error('At least one file is required');
      return;
    }

    try {
      await onCreateJob({
        name: jobName.trim(),
        description: jobDescription.trim() || undefined,
        files,
        priority,
        mergeOutput,
        mergeFormat: mergeOutput ? mergeFormat : undefined
      });

      // Reset form
      setJobName('');
      setJobDescription('');
      setPriority(5);
      setMergeOutput(false);
      setMergeFormat('txt');
      setShowJobForm(false);
      setFiles([]);
    } catch (error) {
      console.error('Error creating batch job:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Batch Upload</h2>
        {files.length > 0 && (
          <button
            onClick={clearAllFiles}
            className="text-sm text-red-600 hover:text-red-700"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          Drop PDF files here or click to browse
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload multiple PDF files for batch processing. Maximum {maxFiles} files, 50MB each.
        </p>

        <div className="flex justify-center space-x-4">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FileText className="w-4 h-4 mr-2" />
            Select Files
          </button>
          
          <button
            onClick={() => folderInputRef.current?.click()}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            <FolderOpen className="w-4 h-4 mr-2" />
            Select Folder
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileInput}
          className="hidden"
        />
        
        <input
          ref={folderInputRef}
          type="file"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFolderInput}
          className="hidden"
          {...({ webkitdirectory: "" } as any)}
        />
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Selected Files ({totalFiles})
            </h3>
            <div className="text-sm text-gray-500">
              Total: {formatFileSize(totalSize)} | ~{totalEstimatedPages} pages
            </div>
          </div>

          <div className="border rounded-lg overflow-hidden">
            <div className="max-h-64 overflow-y-auto">
              {files.map((fileItem) => (
                <div
                  key={fileItem.id}
                  className="flex items-center justify-between p-3 border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <FileText className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {fileItem.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(fileItem.size)} • ~{fileItem.estimatedPages} pages
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    {fileItem.status === 'pending' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <AlertCircle className="w-3 h-3 mr-1" />
                        Pending
                      </span>
                    )}
                    {fileItem.status === 'uploaded' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Ready
                      </span>
                    )}
                    {fileItem.status === 'error' && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        <X className="w-3 h-3 mr-1" />
                        Error
                      </span>
                    )}

                    <button
                      onClick={() => removeFile(fileItem.id)}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Job Configuration */}
          {!showJobForm ? (
            <div className="mt-4 text-center">
              <button
                onClick={() => setShowJobForm(true)}
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Batch Job
              </button>
            </div>
          ) : (
            <div className="mt-6 border-t pt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Job Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Name *
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => setJobName(e.target.value)}
                    placeholder="Enter job name..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority (1-10)
                  </label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(p => (
                      <option key={p} value={p}>
                        {p} {p <= 3 ? '(High)' : p <= 7 ? '(Normal)' : '(Low)'}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="mt-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="mergeOutput"
                    checked={mergeOutput}
                    onChange={(e) => setMergeOutput(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="mergeOutput" className="ml-2 text-sm font-medium text-gray-700">
                    Merge outputs into single file
                  </label>
                </div>

                {mergeOutput && (
                  <div className="mt-2 ml-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Output Format
                    </label>
                    <select
                      value={mergeFormat}
                      onChange={(e) => setMergeFormat(e.target.value as 'txt' | 'md' | 'docx')}
                      className="px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="txt">Text (.txt)</option>
                      <option value="md">Markdown (.md)</option>
                      <option value="docx">Word Document (.docx)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowJobForm(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateJob}
                  disabled={isCreatingJob || !jobName.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isCreatingJob ? 'Creating...' : 'Create Job'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}