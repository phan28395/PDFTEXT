import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, X, FileText, CheckCircle, Loader2, Download, ChevronRight, Sparkles, Image, FileSearch } from 'lucide-react';
import toast from 'react-hot-toast';
import { processPDF, validateFile as apiValidateFile, ProcessingResult, ProcessingError, downloadTextFile, formatFileSize, formatProcessingTime } from '@/api/processing';
import { DocumentType } from './DocumentTypeSelector';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { CloudinaryService } from '@/services/cloudinary';

interface FileUploadProps {
  onFileSelect?: (file: File) => void;
  onUploadComplete?: (result: ProcessingResult) => void;
  className?: string;
  maxFileSize?: number;
  disabled?: boolean;
  acceptedTypes?: string[];
}

interface FileWithPreview extends File {
  preview?: string;
}

// Simplified document types with icons
const DOCUMENT_TYPES = [
  { 
    id: 'standard', 
    icon: FileText, 
    label: 'Text',
    color: 'blue'
  },
  { 
    id: 'latex', 
    icon: Sparkles, 
    label: 'Math',
    color: 'purple'
  },
  { 
    id: 'forms', 
    icon: FileSearch, 
    label: 'Forms',
    color: 'green'
  }
] as const;

export default function FileUploadNew({
  onFileSelect,
  onUploadComplete,
  className = '',
  maxFileSize = 50,
  disabled = false,
  acceptedTypes = ['application/pdf']
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<FileWithPreview | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingResult, setProcessingResult] = useState<ProcessingResult | null>(null);
  const [processingError, setProcessingError] = useState<ProcessingError | null>(null);
  const [selectedDocumentType, setSelectedDocumentType] = useState<DocumentType>('standard');
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [selectedPageRange, setSelectedPageRange] = useState<{start: number, end: number} | null>(null);
  
  // Cloudinary state
  const [cloudinaryUpload, setCloudinaryUpload] = useState<{
    publicId: string;
    url: string;
    pages: number;
  } | null>(null);
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  
  // UI state
  const [currentStep, setCurrentStep] = useState<'upload' | 'type' | 'pages' | 'processing' | 'complete'>('upload');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { user } = useAuth();
  const { user: userData, refreshUser } = useUser(user?.id);
  
  const costPerPage = 1.2;
  const freePages = userData?.free_pages_remaining || 0;
  const creditBalance = userData?.credit_balance || 0;

  // File validation
  const validateFile = (file: File): string | null => {
    const validation = apiValidateFile(file);
    return validation.valid ? null : validation.error || 'File validation failed';
  };

  // Handle file selection
  const handleFile = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast.error(error);
      return;
    }

    const fileWithPreview = Object.assign(file, {
      preview: URL.createObjectURL(file)
    });

    setSelectedFile(fileWithPreview);
    setCurrentStep('type');
    
    // Upload to Cloudinary
    setUploadingToCloudinary(true);
    try {
      const cloudinary = new CloudinaryService();
      const uploadResult = await cloudinary.uploadPDF(file);
      setCloudinaryUpload(uploadResult);
      onFileSelect?.(file);
    } catch (error) {
      console.warn('Cloudinary upload failed, continuing without preview');
    } finally {
      setUploadingToCloudinary(false);
    }
  };

  // Calculate cost
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

  // Process PDF
  const handleProcess = async () => {
    if (!selectedFile) return;
    
    setCurrentStep('processing');
    setUploading(true);
    setUploadProgress(0);

    try {
      const pagesToProcess = selectedPageRange ? 
        (selectedPageRange.end - selectedPageRange.start + 1) : 
        (cloudinaryUpload?.pages || 1);
        
      const result = await processPDF(
        selectedFile, 
        selectedDocumentType, 
        'combined',
        (progress) => setUploadProgress(progress),
        selectedPageRange || undefined,
        'text'
      );

      setProcessingResult(result);
      setCurrentStep('complete');
      toast.success(`Successfully processed ${result.pages} pages!`);
      onUploadComplete?.(result);
      
      // Refresh user data to update free pages and credit balance
      await refreshUser();
    } catch (error: any) {
      setProcessingError(error);
      toast.error(error.message || 'Processing failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // Reset everything
  const reset = () => {
    if (selectedFile?.preview) {
      URL.revokeObjectURL(selectedFile.preview);
    }
    setSelectedFile(null);
    setCloudinaryUpload(null);
    setSelectedDocumentType('standard');
    setSelectedPageRange(null);
    setShowPageSelector(false);
    setCurrentStep('upload');
    setProcessingResult(null);
    setProcessingError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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

  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  // Download result
  const handleDownload = () => {
    if (processingResult && selectedFile) {
      downloadTextFile(processingResult.text, selectedFile.name);
      toast.success('Downloaded!');
    }
  };

  // Step 1: Upload
  if (currentStep === 'upload') {
    return (
      <div className={`w-full ${className}`}>
        <div
          className={`
            relative border-2 border-dashed rounded-xl p-12 text-center transition-all duration-200
            ${dragActive ? 'border-blue-400 bg-blue-50 scale-[1.02]' : 'border-gray-300 hover:border-blue-400'}
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
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
          
          <Upload className={`h-20 w-20 mx-auto mb-4 ${dragActive ? 'text-blue-600 animate-bounce' : 'text-gray-400'}`} />
          
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {dragActive ? 'Drop your PDF here' : 'Upload PDF'}
          </h3>
          
          <p className="text-gray-600 mb-8">
            Drag & drop or click to browse
          </p>
          
          <div className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Upload className="h-5 w-5 mr-2" />
            Choose File
          </div>
          
          <p className="text-xs text-gray-500 mt-8">
            PDF files up to {maxFileSize}MB • $0.012 per page
          </p>
        </div>
      </div>
    );
  }

  // Step 2: Document Type Selection
  if (currentStep === 'type' && selectedFile) {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          {/* File Info */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">{selectedFile.name}</h3>
                <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
              </div>
            </div>
            <button onClick={reset} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Document Type Selection */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-700">Select document type:</h4>
            <div className="grid grid-cols-3 gap-3">
              {DOCUMENT_TYPES.map((type) => {
                const Icon = type.icon;
                const isSelected = selectedDocumentType === type.id;
                return (
                  <button
                    key={type.id}
                    onClick={() => setSelectedDocumentType(type.id as DocumentType)}
                    className={`
                      p-4 rounded-lg border-2 transition-all duration-200
                      ${isSelected 
                        ? `border-${type.color}-500 bg-${type.color}-50` 
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <Icon className={`h-8 w-8 mx-auto mb-2 ${isSelected ? `text-${type.color}-600` : 'text-gray-600'}`} />
                    <span className={`text-sm font-medium ${isSelected ? `text-${type.color}-700` : 'text-gray-700'}`}>
                      {type.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loading indicator for Cloudinary */}
          {uploadingToCloudinary && (
            <div className="mt-4 text-center text-sm text-gray-500">
              <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
              Analyzing PDF...
            </div>
          )}

          {/* Continue Button */}
          <button
            onClick={() => setCurrentStep('pages')}
            disabled={uploadingToCloudinary}
            className="mt-6 w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            Continue
            <ChevronRight className="h-5 w-5 ml-2" />
          </button>
        </div>
      </div>
    );
  }

  // Step 3: Page Selection
  if (currentStep === 'pages' && selectedFile) {
    const totalPages = cloudinaryUpload?.pages || 1;
    const pages = selectedPageRange ? (selectedPageRange.end - selectedPageRange.start + 1) : totalPages;
    const cost = calculateCost(pages);
    
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-white rounded-xl shadow-sm border p-6">
          {/* File & Type Info */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <FileText className="h-8 w-8 text-blue-600" />
              <div>
                <h3 className="font-medium text-gray-900">{selectedFile.name}</h3>
                <p className="text-sm text-gray-500">
                  {DOCUMENT_TYPES.find(t => t.id === selectedDocumentType)?.label} • {totalPages} pages
                </p>
              </div>
            </div>
            <button onClick={reset} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>

          {/* Preview Images */}
          {cloudinaryUpload && totalPages > 1 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-gray-700">Preview</h4>
                <button
                  onClick={() => setShowPageSelector(!showPageSelector)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {showPageSelector ? 'Process all' : 'Select pages'}
                </button>
              </div>
              
              {showPageSelector ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <img 
                        src={new CloudinaryService().getPreviewUrl(cloudinaryUpload.publicId, 1, 200)}
                        alt="First page"
                        className="w-full rounded-lg border"
                      />
                      <p className="text-xs text-center mt-1 text-gray-500">First page</p>
                    </div>
                    <div>
                      <img 
                        src={new CloudinaryService().getPreviewUrl(cloudinaryUpload.publicId, totalPages, 200)}
                        alt="Last page"
                        className="w-full rounded-lg border"
                      />
                      <p className="text-xs text-center mt-1 text-gray-500">Last page</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={selectedPageRange?.start || 1}
                      onChange={(e) => setSelectedPageRange({
                        start: Math.max(1, Math.min(+e.target.value, selectedPageRange?.end || totalPages)),
                        end: selectedPageRange?.end || totalPages
                      })}
                      className="w-20 px-3 py-2 border rounded-lg text-center"
                    />
                    <span className="text-gray-500">to</span>
                    <input
                      type="number"
                      min="1"
                      max={totalPages}
                      value={selectedPageRange?.end || totalPages}
                      onChange={(e) => setSelectedPageRange({
                        start: selectedPageRange?.start || 1,
                        end: Math.max(selectedPageRange?.start || 1, Math.min(+e.target.value, totalPages))
                      })}
                      className="w-20 px-3 py-2 border rounded-lg text-center"
                    />
                    <span className="text-sm text-gray-500">of {totalPages} pages</span>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <img 
                    src={new CloudinaryService().getPreviewUrl(cloudinaryUpload.publicId, 1, 200)}
                    alt="Preview"
                    className="w-full rounded-lg border"
                  />
                  {totalPages > 1 && (
                    <img 
                      src={new CloudinaryService().getPreviewUrl(cloudinaryUpload.publicId, totalPages, 200)}
                      alt="Preview"
                      className="w-full rounded-lg border"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cost Preview */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">
                {cost.totalPages} pages × $0.012
              </span>
              <span className="font-semibold text-gray-900">
                {cost.totalCostCents === 0 ? 'FREE' : `$${(cost.totalCostCents / 100).toFixed(2)}`}
              </span>
            </div>
            {cost.freePages > 0 && (
              <p className="text-xs text-green-600 mt-1">
                Using {cost.freePages} free pages
              </p>
            )}
          </div>

          {/* Process Button */}
          <button
            onClick={handleProcess}
            disabled={!cost.canAfford}
            className="w-full flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Sparkles className="h-5 w-5 mr-2" />
            Process {cost.totalPages} pages
          </button>

          {!cost.canAfford && (
            <p className="text-xs text-red-600 text-center mt-2">
              Insufficient credits. Please add funds to continue.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Step 4: Processing
  if (currentStep === 'processing') {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-white rounded-xl shadow-sm border p-12 text-center">
          <Loader2 className="h-16 w-16 text-blue-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Processing your PDF...
          </h3>
          <p className="text-gray-600 mb-4">
            This may take a few moments
          </p>
          <div className="w-full max-w-xs mx-auto">
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{uploadProgress}%</p>
          </div>
        </div>
      </div>
    );
  }

  // Step 5: Complete
  if (currentStep === 'complete' && processingResult) {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Processing Complete!
          </h3>
          <p className="text-gray-600 mb-6">
            Successfully extracted text from {processingResult.pages} pages
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={handleDownload}
              className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="h-5 w-5 mr-2" />
              Download Text
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Process Another
            </button>
          </div>
          
          <div className="mt-6 p-4 bg-gray-50 rounded-lg text-left">
            <p className="text-sm font-medium text-gray-700 mb-2">Preview:</p>
            <p className="text-sm text-gray-600 line-clamp-3">
              {processingResult.text.substring(0, 200)}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (processingError) {
    return (
      <div className={`w-full ${className}`}>
        <div className="bg-white rounded-xl shadow-sm border p-8 text-center">
          <X className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Processing Failed
          </h3>
          <p className="text-gray-600 mb-6">
            {processingError.message}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => {
                setProcessingError(null);
                handleProcess();
              }}
              className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={reset}
              className="flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Upload New File
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}