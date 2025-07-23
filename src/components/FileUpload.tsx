import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2, Download, Cloud } from 'lucide-react';
import toast from 'react-hot-toast';
import { processPDF, validateFile as apiValidateFile, ProcessingResult, ProcessingError, downloadTextFile, formatFileSize, formatProcessingTime } from '@/api/processing';
import CloudStoragePicker from './CloudStoragePicker';

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  onUploadComplete?: (result: ProcessingResult) => void;
  className?: string;
  maxFileSize?: number; // in MB
  disabled?: boolean;
  acceptedTypes?: string[];
}

interface FileWithPreview extends File {
  preview?: string;
}

export default function FileUpload({
  onFileSelect,
  onUploadComplete,
  className = '',
  maxFileSize = 50, // 50MB default (API limit)
  disabled = false,
  acceptedTypes = ['application/pdf']
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<ProcessingError | null>(null);
  const [showCloudPicker, setShowCloudPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File validation using API validation
  const validateFile = (file: File): string | null => {
    const validation = apiValidateFile(file);
    return validation.valid ? null : validation.error || 'File validation failed';
  };

  // Handle file selection
  const handleFile = (file: File) => {
    setValidationError(null);
    setProcessingResult(null);
    setProcessingError(null);
    
    const error = validateFile(file);
    if (error) {
      setValidationError(error);
      toast.error(error);
      return;
    }

    const fileWithPreview = Object.assign(file, {
      preview: URL.createObjectURL(file)
    });

    setSelectedFile(fileWithPreview);
    onFileSelect?.(file);
    toast.success(`File "${file.name}" selected successfully`);
  };

  // Handle cloud file selection
  const handleCloudFile = (blob: Blob, filename: string) => {
    const file = new File([blob], filename, { type: 'application/pdf' });
    handleFile(file);
    setShowCloudPicker(false);
  };

  // Drag handlers
  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setDragActive(true);
    }
  };

  const handleDragOut = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  // File input change handler
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  // Remove selected file
  const removeFile = () => {
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
    setSelectedFile(null);
    setValidationError(null);
    setProcessingResult(null);
    setProcessingError(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process PDF using real API
  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);
    setProcessingError(null);
    setProcessingResult(null);

    try {
      const result = await processPDF(selectedFile, (progress) => {
        setUploadProgress(progress);
      });

      setProcessingResult(result);
      toast.success(`Successfully processed ${result.pages} page${result.pages > 1 ? 's' : ''}!`);
      onUploadComplete?.(result);
      
    } catch (error: any) {
      console.error('Processing error:', error);
      setProcessingError(error);
      
      if (error.error === 'Usage limit exceeded') {
        toast.error(`Usage limit exceeded. ${error.usage?.remaining || 0} pages remaining.`);
      } else if (error.error === 'Rate limit exceeded') {
        toast.error('Too many requests. Please try again in a minute.');
      } else if (error.retryAfter) {
        toast.error(`Rate limited. Try again in ${error.retryAfter} seconds.`);
      } else {
        toast.error(error.message || 'Processing failed. Please try again.');
      }
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Download extracted text
  const handleDownload = () => {
    if (processingResult && selectedFile) {
      downloadTextFile(processingResult.text, selectedFile.name);
      toast.success('Text file downloaded successfully!');
    }
  };


  return (
    <div className={`w-full ${className}`}>
      <div
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
          ${dragActive 
            ? 'border-blue-400 bg-blue-50' 
            : disabled 
              ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
              : validationError
                ? 'border-red-300 bg-red-50'
                : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50 cursor-pointer'
          }
          ${selectedFile && !validationError ? 'border-green-300 bg-green-50' : ''}
        `}
        onDragEnter={handleDragIn}
        onDragLeave={handleDragOut}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
        />

        {selectedFile ? (
          <div className="space-y-4">
            {/* File Preview */}
            <div className="flex items-center justify-center space-x-4 p-4 bg-white rounded-lg border border-gray-200">
              <div className="flex-shrink-0">
                <FileText className="h-10 w-10 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-medium text-gray-900 truncate">
                  {selectedFile.name}
                </h3>
                <p className="text-sm text-gray-500">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeFile();
                }}
                className="flex-shrink-0 p-1 rounded-full hover:bg-gray-200 transition-colors"
                disabled={uploading}
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            {/* Upload Progress */}
            {uploading && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Uploading...</span>
                  <span className="text-gray-900 font-medium">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Button */}
            {!uploading && !processingResult && (
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUpload();
                  }}
                  disabled={!!validationError}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Convert to Text
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile();
                  }}
                  className="text-gray-600 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Remove
                </button>
              </div>
            )}

            {/* Processing Results */}
            {processingResult && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center text-green-800">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Processing Complete!</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-green-700">
                  <div>
                    <span className="font-medium">Pages:</span> {processingResult.pages}
                  </div>
                  <div>
                    <span className="font-medium">Confidence:</span> {(processingResult.confidence * 100).toFixed(1)}%
                  </div>
                  <div>
                    <span className="font-medium">Processing Time:</span> {formatProcessingTime(processingResult.processingTime)}
                  </div>
                  <div>
                    <span className="font-medium">Remaining Pages:</span> {processingResult.usage.remaining}
                  </div>
                </div>

                {processingResult.text && (
                  <div className="bg-white border border-green-200 rounded p-3">
                    <div className="text-xs text-green-600 mb-2 font-medium">Extracted Text Preview:</div>
                    <div className="text-sm text-gray-700 max-h-32 overflow-y-auto">
                      {processingResult.text.substring(0, 300)}
                      {processingResult.text.length > 300 && '...'}
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 justify-center pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload();
                    }}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors inline-flex items-center"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download Text
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="text-green-700 px-4 py-2 rounded-lg hover:bg-green-100 transition-colors"
                  >
                    Process Another
                  </button>
                </div>
              </div>
            )}

            {/* Processing Error */}
            {processingError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center text-red-800">
                  <AlertCircle className="h-5 w-5 mr-2" />
                  <span className="font-medium">Processing Failed</span>
                </div>
                
                <div className="text-sm text-red-700">
                  {processingError.message}
                </div>

                {processingError.usage && (
                  <div className="bg-red-100 border border-red-200 rounded p-3">
                    <div className="text-xs text-red-600 mb-1 font-medium">Usage Information:</div>
                    <div className="text-sm text-red-700 space-y-1">
                      <div>Current Usage: {processingError.usage.current} pages</div>
                      <div>Monthly Limit: {processingError.usage.limit} pages</div>
                      <div>Remaining: {processingError.usage.remaining} pages</div>
                    </div>
                  </div>
                )}

                <div className="flex space-x-3 justify-center pt-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProcessingError(null);
                      handleUpload();
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
                    disabled={processingError.error === 'Usage limit exceeded'}
                  >
                    Try Again
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile();
                    }}
                    className="text-red-700 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors"
                  >
                    Remove File
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Upload Icon and Text */}
            <div className="space-y-2">
              {validationError ? (
                <AlertCircle className="h-16 w-16 text-red-500 mx-auto" />
              ) : dragActive ? (
                <div className="relative">
                  <Upload className="h-16 w-16 text-blue-600 mx-auto animate-bounce" />
                  <div className="absolute inset-0 rounded-full border-2 border-blue-400 animate-ping" />
                </div>
              ) : (
                <Upload className={`h-16 w-16 mx-auto ${disabled ? 'text-gray-400' : 'text-gray-500'}`} />
              )}
              
              <div>
                <h3 className={`text-lg font-medium ${disabled ? 'text-gray-400' : 'text-gray-900'}`}>
                  {validationError ? 'Invalid File' : dragActive ? 'Drop your PDF here' : 'Upload PDF Document'}
                </h3>
                <p className={`text-sm mt-1 ${disabled ? 'text-gray-400' : 'text-gray-600'}`}>
                  {validationError 
                    ? validationError 
                    : disabled 
                      ? 'File upload is currently disabled'
                      : `Drag and drop your PDF file here, or click to browse (Max ${maxFileSize}MB)`
                  }
                </p>
              </div>
            </div>

            {/* Features */}
            {!disabled && !validationError && (
              <>
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-6">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={disabled}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Choose from Computer
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowCloudPicker(!showCloudPicker);
                    }}
                    disabled={disabled}
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center"
                  >
                    <Cloud className="h-4 w-4 mr-2" />
                    Import from Cloud
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6 text-xs text-gray-500">
                  <div className="flex items-center justify-center space-x-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Secure Processing</span>
                  </div>
                  <div className="flex items-center justify-center space-x-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>99.9% Accuracy</span>
                  </div>
                  <div className="flex items-center justify-center space-x-1">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>Multiple Formats</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Loading Overlay */}
        {uploading && (
          <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-600 mt-2">Processing your PDF...</p>
            </div>
          </div>
        )}
      </div>

      {/* Cloud Storage Picker */}
      {showCloudPicker && (
        <div className="mt-4">
          <CloudStoragePicker
            onFileSelect={handleCloudFile}
            className="border-t border-gray-200 pt-4"
          />
        </div>
      )}

      {/* File Requirements */}
      <div className="mt-4 text-xs text-gray-500 text-center space-y-1">
        <p>Supported format: PDF • Maximum file size: {maxFileSize}MB</p>
        <p>Your files are processed securely and deleted after conversion</p>
      </div>
    </div>
  );
}