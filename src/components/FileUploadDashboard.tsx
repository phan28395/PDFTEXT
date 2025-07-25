import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { Upload, X, FileText, Loader2, Download, ChevronLeft, ChevronRight, Maximize2, DollarSign, Zap, FileSearch, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import { processPDF, validateFile as apiValidateFile, ProcessingResult, ProcessingError, downloadTextFile, formatFileSize } from '@/api/processing';
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

export default function FileUploadDashboard({
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
  
  // Page selection
  const [processAllPages, setProcessAllPages] = useState(true);
  const [startPage, setStartPage] = useState(1);
  const [endPage, setEndPage] = useState(1);
  
  // Cloudinary state
  const [cloudinaryUpload, setCloudinaryUpload] = useState<{
    publicId: string;
    url: string;
    pages: number;
  } | null>(null);
  const [uploadingToCloudinary, setUploadingToCloudinary] = useState(false);
  
  // Image viewer
  const [enlargedImage, setEnlargedImage] = useState<number | null>(null);
  const [previewPages, setPreviewPages] = useState<number[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { user } = useAuth();
  const { user: userData } = useUser(user?.id);
  
  const costPerPage = 1.2;
  const freePages = userData?.free_pages_remaining || 0;
  const creditBalance = userData?.credit_balance || 0;

  // Calculate which pages to show in preview
  useEffect(() => {
    if (!cloudinaryUpload) return;
    
    const total = cloudinaryUpload.pages;
    const pages: number[] = [];
    
    if (processAllPages) {
      // Show first 2, last 2, and middle if > 5 pages
      if (total <= 5) {
        for (let i = 1; i <= total; i++) pages.push(i);
      } else {
        pages.push(1, 2, -1); // -1 represents "..."
        pages.push(total - 1, total);
      }
    } else {
      // Show selected range
      const rangeSize = endPage - startPage + 1;
      if (rangeSize <= 5) {
        for (let i = startPage; i <= endPage; i++) pages.push(i);
      } else {
        pages.push(startPage, startPage + 1, -1);
        pages.push(endPage - 1, endPage);
      }
    }
    
    setPreviewPages(pages);
  }, [cloudinaryUpload, processAllPages, startPage, endPage]);

  // Update end page when file changes
  useEffect(() => {
    if (cloudinaryUpload) {
      setEndPage(cloudinaryUpload.pages);
    }
  }, [cloudinaryUpload]);

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
    setProcessingResult(null);
    setProcessingError(null);
    
    // Upload to Cloudinary
    setUploadingToCloudinary(true);
    try {
      const cloudinary = new CloudinaryService();
      const uploadResult = await cloudinary.uploadPDF(file);
      setCloudinaryUpload(uploadResult);
      onFileSelect?.(file);
      toast.success('File uploaded successfully!');
    } catch (error) {
      console.warn('Cloudinary upload failed:', error);
      toast.error('Preview generation failed, but you can still process the file.');
    } finally {
      setUploadingToCloudinary(false);
    }
  };

  // Calculate cost
  const calculateCost = () => {
    const pages = processAllPages ? 
      (cloudinaryUpload?.pages || 1) : 
      (endPage - startPage + 1);
    
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
    
    setUploading(true);
    setUploadProgress(0);
    setProcessingError(null);

    try {
      const pageRange = processAllPages ? undefined : { start: startPage, end: endPage };
      
      const result = await processPDF(
        selectedFile, 
        selectedDocumentType, 
        'combined',
        (progress) => setUploadProgress(progress),
        pageRange,
        'text'
      );

      setProcessingResult(result);
      toast.success(`Successfully processed ${result.pages} pages!`);
      onUploadComplete?.(result);
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
    setProcessAllPages(true);
    setStartPage(1);
    setEndPage(1);
    setProcessingResult(null);
    setProcessingError(null);
    setEnlargedImage(null);
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

  // Scroll preview
  const scrollPreview = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  const cost = calculateCost();

  return (
    <div className={`w-full ${className}`}>
      <div className="bg-white rounded-xl shadow-lg border overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-3 min-h-[600px]">
          
          {/* Left Panel - Upload & Controls */}
          <div className="p-6 border-r border-gray-200 space-y-6">
            {/* Upload Zone */}
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                ${selectedFile ? 'border-green-300 bg-green-50' : 
                  dragActive ? 'border-blue-400 bg-blue-50' : 
                  'border-gray-300 hover:border-blue-400'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              onDragEnter={handleDragIn}
              onDragLeave={handleDragOut}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => !disabled && !selectedFile && fileInputRef.current?.click()}
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
                <div className="space-y-3">
                  <FileText className="h-12 w-12 text-green-600 mx-auto" />
                  <div>
                    <p className="font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <>
                  <Upload className={`h-12 w-12 mx-auto mb-3 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="text-sm font-medium text-gray-900">
                    {dragActive ? 'Drop your PDF here' : 'Drop PDF or click to browse'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Up to {maxFileSize}MB</p>
                </>
              )}
              
              {uploadingToCloudinary && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
                    <p className="text-sm text-gray-600 mt-2">Analyzing PDF...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Document Type */}
            {selectedFile && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Document Type</h3>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setSelectedDocumentType('standard')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedDocumentType === 'standard' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileText className={`h-6 w-6 mx-auto mb-1 ${
                      selectedDocumentType === 'standard' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs">Text</span>
                  </button>
                  <button
                    onClick={() => setSelectedDocumentType('latex')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedDocumentType === 'latex' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Sparkles className={`h-6 w-6 mx-auto mb-1 ${
                      selectedDocumentType === 'latex' ? 'text-purple-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs">Math</span>
                  </button>
                  <button
                    onClick={() => setSelectedDocumentType('forms')}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedDocumentType === 'forms' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileSearch className={`h-6 w-6 mx-auto mb-1 ${
                      selectedDocumentType === 'forms' ? 'text-green-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs">Forms</span>
                  </button>
                </div>
              </div>
            )}

            {/* Page Selection */}
            {cloudinaryUpload && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Pages to Process</h3>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={processAllPages}
                    onChange={(e) => setProcessAllPages(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  <span className="text-sm text-gray-700">Process all {cloudinaryUpload.pages} pages</span>
                </label>
                
                {!processAllPages && (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">From</span>
                    <input
                      type="number"
                      min="1"
                      max={cloudinaryUpload.pages}
                      value={startPage}
                      onChange={(e) => {
                        const val = Math.max(1, Math.min(+e.target.value, endPage));
                        setStartPage(val);
                      }}
                      className="w-16 px-2 py-1 border rounded text-center text-sm"
                    />
                    <span className="text-sm text-gray-600">to</span>
                    <input
                      type="number"
                      min="1"
                      max={cloudinaryUpload.pages}
                      value={endPage}
                      onChange={(e) => {
                        const val = Math.max(startPage, Math.min(+e.target.value, cloudinaryUpload.pages));
                        setEndPage(val);
                      }}
                      className="w-16 px-2 py-1 border rounded text-center text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Cost Preview */}
            {selectedFile && (
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Cost Preview
                  </span>
                  <span className="font-semibold text-gray-900">
                    {cost.totalCostCents === 0 ? 'FREE' : `$${(cost.totalCostCents / 100).toFixed(2)}`}
                  </span>
                </div>
                
                <div className="text-xs space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>{cost.totalPages} pages × $0.012</span>
                    <span>${(cost.totalPages * 0.012).toFixed(2)}</span>
                  </div>
                  {cost.freePages > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Free pages discount</span>
                      <span>-${(cost.freePages * 0.012).toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Process Button */}
            {selectedFile && !processingResult && (
              <button
                onClick={handleProcess}
                disabled={uploading || !cost.canAfford || uploadingToCloudinary}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    Processing... {uploadProgress}%
                  </>
                ) : (
                  <>
                    <Zap className="h-5 w-5 mr-2" />
                    Process {cost.totalPages} pages
                  </>
                )}
              </button>
            )}

            {/* Success State */}
            {processingResult && (
              <div className="space-y-3">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700 font-medium">Successfully processed!</p>
                  <p className="text-sm text-green-600">{processingResult.pages} pages extracted</p>
                </div>
                
                <button
                  onClick={handleDownload}
                  className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <Download className="h-5 w-5 mr-2" />
                  Download Text
                </button>
                
                <button
                  onClick={reset}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Process Another File
                </button>
              </div>
            )}

            {/* Error State */}
            {processingError && (
              <div className="space-y-3">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-700 font-medium">Processing failed</p>
                  <p className="text-sm text-red-600 mt-1">{processingError.message}</p>
                </div>
                
                <button
                  onClick={() => {
                    setProcessingError(null);
                    handleProcess();
                  }}
                  className="w-full py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>

          {/* Right Panel - Preview */}
          <div className="lg:col-span-2 bg-gray-50 p-6">
            {!selectedFile ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">Upload a PDF to see preview</p>
                </div>
              </div>
            ) : !cloudinaryUpload ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Loader2 className="h-16 w-16 text-gray-400 animate-spin mx-auto mb-4" />
                  <p className="text-gray-500">Generating preview...</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-medium text-gray-900">
                    Preview ({processAllPages ? `All ${cloudinaryUpload.pages} pages` : `Pages ${startPage}-${endPage}`})
                  </h3>
                  <p className="text-sm text-gray-500">Click image to enlarge</p>
                </div>
                
                {/* Preview Images */}
                <div className="flex-1 relative">
                  <button
                    onClick={() => scrollPreview('left')}
                    className="absolute left-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  
                  <button
                    onClick={() => scrollPreview('right')}
                    className="absolute right-0 top-1/2 -translate-y-1/2 z-10 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                  
                  <div 
                    ref={scrollContainerRef}
                    className="flex gap-4 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-400 pb-4 h-full items-center"
                    style={{ scrollbarWidth: 'thin' }}
                  >
                    {previewPages.map((page, index) => {
                      if (page === -1) {
                        return (
                          <div key={`dots-${index}`} className="flex-shrink-0 flex items-center px-4">
                            <span className="text-2xl text-gray-400">•••</span>
                          </div>
                        );
                      }
                      
                      const cloudinary = new CloudinaryService();
                      const imageUrl = cloudinary.getPreviewUrl(cloudinaryUpload.publicId, page, 300);
                      
                      return (
                        <div 
                          key={page} 
                          className="flex-shrink-0 cursor-pointer hover:scale-105 transition-transform"
                          onClick={() => setEnlargedImage(page)}
                        >
                          <div className="bg-white rounded-lg shadow-md overflow-hidden">
                            <img 
                              src={imageUrl}
                              alt={`Page ${page}`}
                              className="h-[400px] w-auto"
                              loading="lazy"
                            />
                            <div className="px-3 py-2 bg-gray-900 text-white text-center text-sm">
                              Page {page}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Enlarged Image Modal */}
      {enlargedImage !== null && cloudinaryUpload && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <div className="relative max-w-7xl max-h-full">
            <button
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg hover:bg-gray-100"
              onClick={() => setEnlargedImage(null)}
            >
              <X className="h-6 w-6" />
            </button>
            <img 
              src={new CloudinaryService().getPreviewUrl(cloudinaryUpload.publicId, enlargedImage, 1200)}
              alt={`Page ${enlargedImage} enlarged`}
              className="max-w-full max-h-[90vh] rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-black bg-opacity-75 text-white rounded-lg">
              Page {enlargedImage} of {cloudinaryUpload.pages}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}