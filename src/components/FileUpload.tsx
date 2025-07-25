import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader2, Download, Cloud, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { processPDF, validateFile as apiValidateFile, ProcessingResult, ProcessingError, downloadTextFile, formatFileSize, formatProcessingTime } from '@/api/processing';
import CloudStoragePicker from './CloudStoragePicker';
import DocumentTypeSelector, { DocumentType } from './DocumentTypeSelector';
import DocumentPreview from './DocumentPreview/DocumentPreview';
import { SelectionRange } from '@/types/document';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { CloudinaryService } from '@/services/cloudinary';
import PDFPreview from './PDFPreview';

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
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType | null>(null);
  const [selectedDownloadFormat, setSelectedDownloadFormat] = useState<'combined' | 'separated' | 'individual'>('combined');
  const [showCostPreview, setShowCostPreview] = useState(false);
  const [estimatedPages, setEstimatedPages] = useState<number | null>(null);
  
  // Document preview state
  const [showDocumentPreview, setShowDocumentPreview] = useState(false);
  const [selectedPageRange, setSelectedPageRange] = useState<{start: number, end: number, total: number} | null>(null);
  
  // Cloudinary state
  const [cloudinaryUpload, setCloudinaryUpload] = useState<{
    publicId: string;
    url: string;
    pages: number;
  } | null>(null);
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Get user data for free pages and credits
  const { user } = useAuth();
  const { user: userData } = useUser(user?.id);
  
  const costPerPage = 1.2; // 1.2 cents per page ($0.012)
  const freePages = userData?.free_pages_remaining || 0;
  const creditBalance = userData?.credit_balance || 0;

  // File validation using API validation
  const validateFile = (file: File): string | null => {
    const validation = apiValidateFile(file);
    return validation.valid ? null : validation.error || 'File validation failed';
  };

  // Estimate pages from file size (rough approximation)
  const estimatePagesFromSize = (fileSize: number): number => {
    // Rough estimate: 1 page ≈ 100KB for text PDFs, can vary widely
    const averagePageSize = 100 * 1024; // 100KB
    return Math.max(1, Math.ceil(fileSize / averagePageSize));
  };

  // Calculate cost breakdown
  const calculateCost = (pages: number) => {
    const pagesUsedFromFree = Math.min(pages, freePages);
    const pagesNeedingPayment = Math.max(0, pages - freePages);
    const totalCost = pagesNeedingPayment * costPerPage;
    
    return {
      totalPages: pages,
      freePages: pagesUsedFromFree,
      paidPages: pagesNeedingPayment,
      totalCostCents: totalCost,
      canAfford: totalCost <= creditBalance || pagesNeedingPayment === 0
    };
  };

  // Handle file selection
  const handleFile = async (file: File) => {
    setValidationError(null);
    setProcessingResult(null);
    setProcessingError(null);
    setCloudinaryUpload(null);
    
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
    
    // Check if Cloudinary is configured
    try {
      // Try to initialize Cloudinary to check if it's configured
      new CloudinaryService();
    } catch (error) {
      console.warn('Cloudinary not configured, using direct upload');
      // Estimate pages and proceed without Cloudinary preview
      const estimatedPageCount = estimatePagesFromSize(file.size);
      setEstimatedPages(estimatedPageCount);
      setShowCostPreview(true);
      onFileSelect?.(file);
      toast.success(`File "${file.name}" selected successfully`);
      return;
    }
    
    // Upload to Cloudinary
    setUploadingToCloudinary(true);
    try {
      const cloudinary = new CloudinaryService();
      const uploadResult = await cloudinary.uploadPDF(file);
      setCloudinaryUpload(uploadResult);
      
      // Use actual page count from Cloudinary
      setEstimatedPages(uploadResult.pages);
      setShowCostPreview(true);
      
      // Show PDF Preview using Cloudinary
      setShowDocumentPreview(true);
      
      onFileSelect?.(file);
      toast.success(`File "${file.name}" uploaded successfully`);
    } catch (error) {
      console.error('Cloudinary upload error:', error);
      toast.error('Failed to upload file. Please try again.');
      setValidationError(error.message);
      removeFile();
    } finally {
      setUploadingToCloudinary(false);
    }
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
    setSelectedDocumentType(null);
    setSelectedDownloadFormat('combined');
    setShowCostPreview(false);
    setEstimatedPages(null);
    setCloudinaryUpload(null);
    
    // Reset document preview state
    setShowDocumentPreview(false);
    setSelectedPageRange(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Process PDF using real API
  const handleUpload = async () => {
    if (!selectedFile || !selectedDocumentType) return;

    setUploading(true);
    setUploadProgress(0);
    setProcessingError(null);
    setProcessingResult(null);

    try {
      const result = await processPDF(
        selectedFile, 
        selectedDocumentType, 
        selectedDownloadFormat,
        (progress) => {
          setUploadProgress(progress);
        },
        selectedPageRange ? { start: selectedPageRange.start, end: selectedPageRange.end } : undefined,
        'text'
      );

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

            {/* Document Type Selection */}
            {showCostPreview && !selectedDocumentType && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <DocumentTypeSelector
                  selectedType={selectedDocumentType}
                  onTypeSelect={setSelectedDocumentType}
                  className="mb-4"
                />
              </div>
            )}

            {/* Cost Preview */}
            {showCostPreview && selectedDocumentType && estimatedPages && (
              <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-gray-900 flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Cost Preview
                  </h4>
                  <span className="text-xs text-gray-500">Estimated</span>
                </div>
                
                {(() => {
                  const cost = calculateCost(estimatedPages);
                  return (
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Estimated pages:</span>
                        <span className="font-medium">{cost.totalPages}</span>
                      </div>
                      {cost.freePages > 0 && (
                        <div className="flex justify-between">
                          <span className="text-green-600">Free pages:</span>
                          <span className="font-medium text-green-600">-{cost.freePages}</span>
                        </div>
                      )}
                      {cost.paidPages > 0 && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Paid pages:</span>
                          <span className="font-medium">{cost.paidPages} × $0.012</span>
                        </div>
                      )}
                      <div className="border-t pt-2 flex justify-between font-medium">
                        <span>Total cost:</span>
                        <span className={cost.totalCostCents === 0 ? 'text-green-600' : 'text-gray-900'}>
                          {cost.totalCostCents === 0 ? 'FREE' : `$${(cost.totalCostCents / 100).toFixed(3)}`}
                        </span>
                      </div>
                      {!cost.canAfford && (
                        <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 text-xs">
                          Insufficient credits. Please add credits to continue.
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Download Format Selection */}
            {showCostPreview && selectedDocumentType && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-3">Download Format</h4>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="combined"
                      checked={selectedDownloadFormat === 'combined'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <span className="font-medium">Combined</span> - Single file with all pages
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="separated"
                      checked={selectedDownloadFormat === 'separated'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <span className="font-medium">Separated</span> - Multiple files, one per page
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="downloadFormat"
                      value="individual"
                      checked={selectedDownloadFormat === 'individual'}
                      onChange={(e) => setSelectedDownloadFormat(e.target.value as any)}
                      className="mr-2"
                    />
                    <span className="text-sm">
                      <span className="font-medium">Individual</span> - Zip file with individual page files
                    </span>
                  </label>
                </div>
              </div>
            )}

            {/* Document Preview */}
            {showDocumentPreview && selectedFile && cloudinaryUpload && (
              <div className="mt-4">
                <PDFPreview
                  publicId={cloudinaryUpload.publicId}
                  totalPages={cloudinaryUpload.pages}
                  onPageRangeSelect={(start, end) => {
                    // Update selected page range
                    const pagesToProcess = end - start + 1;
                    setEstimatedPages(pagesToProcess);
                    setSelectedPageRange({
                      start,
                      end,
                      total: cloudinaryUpload.pages
                    });
                    
                    // Hide preview and show upload button
                    setShowDocumentPreview(false);
                  }}
                />
              </div>
            )}
            

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
            {!uploading && !processingResult && selectedDocumentType && estimatedPages && (
              <div className="flex space-x-3 justify-center">
                {(() => {
                  const cost = calculateCost(estimatedPages);
                  return (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUpload();
                      }}
                      disabled={!!validationError || !cost.canAfford}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {cost.totalCostCents === 0 ? 'Process for FREE' : `Process for $${(cost.totalCostCents / 100).toFixed(3)}`}
                    </button>
                  );
                })()}
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
        {(uploading || uploadingToCloudinary) && (
          <div className="absolute inset-0 bg-white bg-opacity-75 rounded-lg flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin mx-auto" />
              <p className="text-sm text-gray-600 mt-2">
                {uploadingToCloudinary ? 'Uploading to cloud...' : 'Processing your PDF...'}
              </p>
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