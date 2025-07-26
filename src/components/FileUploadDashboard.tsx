import { useState, useRef, DragEvent, ChangeEvent, useEffect } from 'react';
import { Upload, X, FileText, Loader2, Download, ChevronLeft, ChevronRight, Maximize2, DollarSign, Zap, FileSearch, Sparkles, FileJson, FileCode, FileSpreadsheet, AlignLeft, Code } from 'lucide-react';
import toast from 'react-hot-toast';
import { processPDF, validateFile as apiValidateFile, ProcessingResult, ProcessingError, downloadTextFile, formatFileSize } from '@/api/processing';
import { DocumentType } from './DocumentTypeSelector';
import { useAuth } from '@/hooks/useAuth';
import { useUser } from '@/hooks/useDatabase';
import { CloudinaryService } from '@/services/cloudinary';
import { useDocumentMode } from '@/contexts/DocumentModeContext';

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
  
  // Output format selection
  type OutputFormat = 'txt' | 'markdown' | 'docx' | 'csv' | 'json';
  const [selectedOutputFormat, setSelectedOutputFormat] = useState<OutputFormat>('txt');
  const [showTextPreview, setShowTextPreview] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const textScrollContainerRef = useRef<HTMLDivElement>(null);
  
  const { user, session } = useAuth();
  const { user: userData, refreshUser } = useUser(user?.id);
  const { documentMode } = useDocumentMode();
  
  // Log session status on mount and when it changes
  useEffect(() => {
    console.log('FileUploadDashboard auth status:', {
      hasUser: !!user,
      hasSession: !!session,
      userEmail: user?.email,
      sessionToken: session?.access_token ? 'Present' : 'Missing'
    });
  }, [user, session]);
  
  // Different costs per page based on document mode
  const getCostPerPage = () => {
    switch (documentMode) {
      case 'latex':
        return 2.4; // 2.4 cents per page ($0.024) - Math OCR premium feature
      case 'forms':
        return 1.8; // 1.8 cents per page ($0.018) - Form parser features
      default:
        return 1.2; // 1.2 cents per page ($0.012) - Standard OCR
    }
  };
  
  const costPerPage = getCostPerPage();
  const freePages = userData?.free_pages_remaining || 0;
  const creditBalance = userData?.credit_balance || 0;

  // Calculate which pages to show in preview
  useEffect(() => {
    if (!cloudinaryUpload) return;
    
    const total = cloudinaryUpload.pages;
    const pages: number[] = [];
    
    if (processAllPages) {
      // Show all pages if <= 10, otherwise show first 2, last 2 with ellipsis
      if (total <= 10) {
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
    
    // Check if user is logged in
    if (!user || !session) {
      toast.error('Please log in to process documents');
      console.error('No active session:', { user, session });
      return;
    }
    
    setUploading(true);
    setUploadProgress(0);
    setProcessingError(null);

    try {
      const pageRange = processAllPages ? undefined : { start: startPage, end: endPage };
      
      const result = await processPDF(
        selectedFile, 
        documentMode, 
        'combined',
        (progress) => setUploadProgress(progress),
        pageRange,
        'text'
      );

      setProcessingResult(result);
      toast.success(`Successfully processed ${result.pages} pages!`);
      onUploadComplete?.(result);
      
      // Refresh user data to update free pages and credit balance
      await refreshUser();
    } catch (error: any) {
      console.error('Processing error:', error);
      setProcessingError(error);
      
      // Provide more specific error messages
      if (error.message?.includes('No active session') || error.message?.includes('Authentication')) {
        toast.error('Session expired. Please log out and log in again.');
      } else {
        toast.error(error.message || 'Processing failed');
      }
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

  // Generate example text for format preview
  const getFormatExample = (): string => {
    const exampleText = `This is page 1 content from your PDF document.
It contains multiple paragraphs and lines of text.

This is the second paragraph with more content.`;
    
    switch (selectedOutputFormat) {
      case 'markdown':
        return `# Page 1\n\n${exampleText}\n\n---\n\n# Page 2\n\nContent from page 2 would appear here...`;
      
      case 'json':
        return JSON.stringify({
          document: "example.pdf",
          pages: [
            {
              pageNumber: 1,
              content: exampleText
            },
            {
              pageNumber: 2,
              content: "Content from page 2..."
            }
          ],
          totalPages: 2,
          processedAt: new Date().toISOString()
        }, null, 2);
      
      case 'csv':
        return `Page,Content\n1,"${exampleText.replace(/\n/g, ' ')}"\n2,"Content from page 2..."`;
      
      default: // 'txt'
        return exampleText + '\n\n---\n\nPage 2 content would appear here...';
    }
  };

  // Format text based on selected output format
  const formatTextForOutput = (text: string): string => {
    const pages = text.split('\n\n---\n\n'); // Assuming pages are separated by this delimiter
    
    switch (selectedOutputFormat) {
      case 'markdown':
        return pages.map((page, idx) => `# Page ${idx + 1}\n\n${page}`).join('\n\n---\n\n');
      
      case 'json':
        return JSON.stringify({
          document: selectedFile?.name,
          pages: pages.map((page, idx) => ({
            pageNumber: idx + 1,
            content: page
          })),
          totalPages: pages.length,
          processedAt: new Date().toISOString()
        }, null, 2);
      
      case 'csv':
        // Simple CSV format with page number and content
        const csvContent = 'Page,Content\n' + 
          pages.map((page, idx) => `${idx + 1},"${page.replace(/"/g, '""')}"`).join('\n');
        return csvContent;
      
      case 'docx':
        // For DOCX, we'll return formatted text that indicates page breaks
        return pages.map((page, idx) => `[Page ${idx + 1}]\n\n${page}`).join('\n\n[Page Break]\n\n');
      
      default: // 'txt'
        return text;
    }
  };

  // Download result
  const handleDownload = () => {
    if (processingResult && selectedFile) {
      const formattedText = formatTextForOutput(processingResult.text);
      const extension = selectedOutputFormat === 'markdown' ? 'md' : selectedOutputFormat;
      const fileName = selectedFile.name.replace('.pdf', `.${extension}`);
      
      // For DOCX, we'd need a library like docx.js
      if (selectedOutputFormat === 'docx') {
        toast.error('DOCX export coming soon!');
        return;
      }
      
      downloadTextFile(formattedText, fileName);
      toast.success(`Downloaded as ${extension.toUpperCase()}!`);
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
    <div className={`w-full h-full flex flex-col ${className}`}>
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-3 flex-shrink-0">
        <div className="flex items-center space-x-6">
          <div className={`flex items-center ${selectedFile ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
              selectedFile ? 'bg-green-100 text-green-600' : 'bg-gray-100'
            }`}>
              1
            </div>
            <span className="ml-2 text-sm font-medium">Upload PDF</span>
          </div>
          
          <ChevronRight className="h-4 w-4 text-gray-300" />
          
          <div className={`flex items-center ${processingResult ? 'text-green-600' : selectedFile ? 'text-blue-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
              processingResult ? 'bg-green-100 text-green-600' : selectedFile ? 'bg-blue-100 text-blue-600' : 'bg-gray-100'
            }`}>
              2
            </div>
            <span className="ml-2 text-sm font-medium">Process</span>
          </div>
          
          <ChevronRight className="h-4 w-4 text-gray-300" />
          
          <div className={`flex items-center ${processingResult ? 'text-green-600' : 'text-gray-400'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
              processingResult ? 'bg-green-100 text-green-600' : 'bg-gray-100'
            }`}>
              3
            </div>
            <span className="ml-2 text-sm font-medium">Download</span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden h-[calc(100vh-180px)] min-h-[500px]">
        <div className="grid grid-cols-1 xl:grid-cols-12 h-full">
          
          {/* Left Panel - Upload & Controls */}
          <div className="xl:col-span-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 border-r border-gray-200 space-y-3 h-full overflow-y-auto">
            {/* Upload Zone */}
            <div
              className={`
                relative border-2 border-dashed rounded-lg p-3 text-center transition-all duration-200 shadow-sm
                ${selectedFile ? 'border-green-400 bg-green-50/50' : 
                  dragActive ? 'border-blue-500 bg-blue-50' : 
                  'border-gray-300 hover:border-blue-400 bg-white'}
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
                <div className="space-y-2">
                  <FileText className="h-8 w-8 text-green-600 mx-auto" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate">{selectedFile.name}</p>
                    <p className="text-xs text-gray-500">{formatFileSize(selectedFile.size)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      reset();
                    }}
                    className="text-xs text-red-600 hover:text-red-700"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <>
                  <Upload className={`h-8 w-8 mx-auto mb-1 ${dragActive ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="text-xs font-medium text-gray-900">
                    {dragActive ? 'Drop PDF' : 'Drop PDF here'}
                  </p>
                  <p className="text-xs text-gray-500">or click • Max {maxFileSize}MB</p>
                </>
              )}
              
              {uploadingToCloudinary && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-lg">
                  <div className="text-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                    <p className="text-xs text-gray-600 mt-1">Analyzing PDF...</p>
                  </div>
                </div>
              )}
            </div>


            {/* Output Format Selection - BEFORE processing */}
            {selectedFile && !processingResult && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-700">Output Format</h3>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setSelectedOutputFormat('txt')}
                    className={`p-2 rounded border transition-all flex flex-col items-center ${
                      selectedOutputFormat === 'txt' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <AlignLeft className={`h-4 w-4 mb-1 ${
                      selectedOutputFormat === 'txt' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs font-medium">Plain Text</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedOutputFormat('markdown')}
                    className={`p-2 rounded border transition-all flex flex-col items-center ${
                      selectedOutputFormat === 'markdown' 
                        ? 'border-purple-500 bg-purple-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileCode className={`h-4 w-4 mb-1 ${
                      selectedOutputFormat === 'markdown' ? 'text-purple-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs font-medium">Markdown</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedOutputFormat('json')}
                    className={`p-2 rounded border transition-all flex flex-col items-center ${
                      selectedOutputFormat === 'json' 
                        ? 'border-orange-500 bg-orange-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileJson className={`h-4 w-4 mb-1 ${
                      selectedOutputFormat === 'json' ? 'text-orange-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs font-medium">JSON</span>
                  </button>
                  
                  <button
                    onClick={() => setSelectedOutputFormat('csv')}
                    className={`p-2 rounded border transition-all flex flex-col items-center ${
                      selectedOutputFormat === 'csv' 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <FileSpreadsheet className={`h-4 w-4 mb-1 ${
                      selectedOutputFormat === 'csv' ? 'text-green-600' : 'text-gray-600'
                    }`} />
                    <span className="text-xs font-medium">CSV</span>
                  </button>
                </div>
              </div>
            )}

            {/* Page Selection */}
            {cloudinaryUpload && (
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-gray-700">Pages to Process</h3>
                
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
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    Processing Cost
                    {documentMode !== 'standard' && (
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${
                        documentMode === 'latex' ? 'bg-purple-100 text-purple-700' :
                        'bg-green-100 text-green-700'
                      }`}>
                        {documentMode === 'latex' ? 'Math' : 'Forms'}
                      </span>
                    )}
                  </span>
                  <span className="text-lg font-bold text-gray-900">
                    {cost.totalCostCents === 0 ? 'FREE' : `$${(cost.totalCostCents / 100).toFixed(2)}`}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>{cost.totalPages} pages × ${(costPerPage / 100).toFixed(3)}</span>
                    <span className="font-medium">${(cost.totalPages * costPerPage / 100).toFixed(2)}</span>
                  </div>
                  {cost.freePages > 0 && (
                    <div className="flex justify-between text-xs text-green-600">
                      <span>✨ Free pages</span>
                      <span className="font-medium">-${(cost.freePages * costPerPage / 100).toFixed(2)}</span>
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
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all transform hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center text-sm font-medium shadow-lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing... {uploadProgress}%
                  </>
                ) : uploadingToCloudinary ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Preparing preview...
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Process {cost.totalPages} pages
                  </>
                )}
              </button>
            )}

            {/* Success State */}
            {processingResult && (
              <div className="space-y-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-green-700 font-medium">Successfully processed!</p>
                  <p className="text-sm text-green-600">{processingResult.pages} pages extracted</p>
                </div>
                
                <button
                  onClick={handleDownload}
                  className="w-full py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-[1.02] flex items-center justify-center text-sm font-medium shadow-lg"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download as {selectedOutputFormat.toUpperCase()}
                </button>
                
                <button
                  onClick={reset}
                  className="w-full py-2 text-sm text-gray-600 hover:text-gray-700"
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

          {/* Middle Panel - Document Preview */}
          <div className="xl:col-span-2 bg-white p-2 border-r border-gray-200 h-full overflow-hidden">
            {/* Show text results if processing is complete and preview is toggled */}
            {processingResult && showTextPreview ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      Extracted Text Preview
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Format: {selectedOutputFormat.toUpperCase()} • {processingResult.pages} pages
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTextPreview(false)}
                    className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200"
                  >
                    <X className="h-3 w-3 inline mr-1" />
                    Close Preview
                  </button>
                </div>
                
                {/* Text Preview Area */}
                <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <pre className="h-full overflow-auto p-6 text-sm text-gray-800 font-mono whitespace-pre-wrap bg-gradient-to-br from-gray-50 to-white">
                    {formatTextForOutput(processingResult.text)}
                  </pre>
                </div>
              </div>
            ) : !selectedFile ? (
              <div className="h-full flex items-center justify-center text-center bg-gray-50 rounded-xl">
                <div>
                  <FileText className="h-20 w-20 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-700 mb-2">No document selected</h3>
                  <p className="text-gray-500">Upload a PDF to see page previews</p>
                </div>
              </div>
            ) : !cloudinaryUpload ? (
              <div className="h-full flex items-center justify-center text-center">
                <div>
                  <Loader2 className="h-16 w-16 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-lg font-medium text-gray-700">Analyzing your PDF</p>
                  <p className="text-sm text-gray-500 mt-2">Generating page previews...</p>
                </div>
              </div>
            ) : uploading ? (
              <div className="h-full flex items-center justify-center text-center">
                <div className="max-w-sm">
                  <div className="relative">
                    <Loader2 className="h-20 w-20 text-blue-500 animate-spin mx-auto mb-4" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-blue-600">{uploadProgress}%</span>
                    </div>
                  </div>
                  <p className="text-lg font-medium text-gray-700 mb-2">Processing your document</p>
                  <p className="text-sm text-gray-500">Extracting text from {cost.totalPages} pages...</p>
                  <div className="mt-4 bg-gray-200 rounded-full h-2">
                    <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="mb-2 flex-shrink-0">
                  <h3 className="text-xs font-semibold text-gray-900">
                    {processingResult ? 'Processed' : 'Preview'}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {cloudinaryUpload.pages} pages
                  </p>
                </div>
                
                {/* Vertical Scrolling Preview Images */}
                <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
                  <div className="flex flex-col gap-0.5">
                    {previewPages.map((page, index) => {
                      if (page === -1) {
                        return (
                          <div key={`ellipsis-${index}`} className="text-center py-1">
                            <span className="text-gray-400 text-lg">...</span>
                          </div>
                        );
                      }
                      
                      const cloudinary = new CloudinaryService();
                      const imageUrl = cloudinary.getPreviewUrl(cloudinaryUpload.publicId, page, 800);
                      
                      return (
                        <div 
                          key={page} 
                          className="cursor-pointer hover:scale-[1.02] transition-transform"
                          onClick={() => setEnlargedImage(page)}
                        >
                          <div className="bg-white rounded shadow-sm overflow-hidden border border-gray-100 hover:shadow-md transition-shadow relative">
                            {processingResult && (
                              <div className="absolute inset-0 bg-green-500 bg-opacity-10 z-10 flex items-center justify-center">
                                <div className="bg-green-100 rounded-full p-1">
                                  <FileText className="h-4 w-4 text-green-600" />
                                </div>
                              </div>
                            )}
                            <img 
                              src={imageUrl}
                              alt={`Page ${page}`}
                              className="w-full h-auto object-contain bg-white"
                            />
                            <div className={`px-1 py-0.5 text-white text-center text-xs ${
                              processingResult 
                                ? 'bg-green-600' 
                                : 'bg-gray-700'
                            }`}>
                              Page {page} {processingResult && '✓'}
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
          
          {/* Right Panel - Output Format Preview */}
          <div className="xl:col-span-7 bg-white p-6 h-full">
            {!selectedFile ? (
              <div className="h-full flex items-center justify-center text-center bg-gray-50 rounded-xl">
                <div>
                  <FileText className="h-16 w-16 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-base font-medium text-gray-700 mb-1">No output preview</h3>
                  <p className="text-sm text-gray-500">Upload a PDF to see format preview</p>
                </div>
              </div>
            ) : processingResult && showTextPreview ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Extracted Text
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedOutputFormat.toUpperCase()} • {processingResult.pages} pages
                    </p>
                  </div>
                  <button
                    onClick={() => setShowTextPreview(false)}
                    className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-lg hover:bg-gray-200"
                  >
                    <X className="h-3 w-3 inline mr-1" />
                    Close
                  </button>
                </div>
                
                <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <pre className="h-full overflow-auto p-6 text-sm text-gray-800 font-mono whitespace-pre-wrap">
                    {formatTextForOutput(processingResult.text)}
                  </pre>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Output Format Preview
                    </h3>
                    <p className="text-sm text-gray-500">
                      {selectedOutputFormat.toUpperCase()} format example
                    </p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    selectedOutputFormat === 'txt' ? 'bg-blue-100 text-blue-700' :
                    selectedOutputFormat === 'markdown' ? 'bg-purple-100 text-purple-700' :
                    selectedOutputFormat === 'json' ? 'bg-orange-100 text-orange-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {selectedOutputFormat.toUpperCase()}
                  </span>
                </div>
                
                {/* Format Example Preview */}
                <div className="flex-1 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                  <pre className="h-full overflow-auto p-6 text-sm text-gray-700 font-mono whitespace-pre-wrap">
                    {getFormatExample()}
                  </pre>
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
              src={new CloudinaryService().getPreviewUrl(cloudinaryUpload.publicId, enlargedImage, 800)}
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