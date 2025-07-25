import React from 'react';
import { DocumentMetadata } from '@/types/document';
import { FileText, FileSpreadsheet, FileImage, Loader2 } from 'lucide-react';

interface DocumentInfoProps {
  metadata: DocumentMetadata | null;
  loading: boolean;
}

export default function DocumentInfo({ metadata, loading }: DocumentInfoProps) {
  const getIcon = () => {
    if (!metadata) return <FileText className="h-8 w-8" />;
    
    switch (metadata.type) {
      case 'pdf':
        return <FileText className="h-8 w-8 text-red-500" />;
      case 'xlsx':
        return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
      case 'image':
        return <FileImage className="h-8 w-8 text-blue-500" />;
      default:
        return <FileText className="h-8 w-8" />;
    }
  };
  
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb < 1 ? `${(bytes / 1024).toFixed(1)} KB` : `${mb.toFixed(1)} MB`;
  };
  
  if (loading && !metadata) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Analyzing document...</span>
      </div>
    );
  }
  
  if (!metadata) return null;
  
  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-3">
        {getIcon()}
        <div>
          <h2 className="font-semibold text-lg truncate">{metadata.fileName}</h2>
          <p className="text-sm text-gray-500">{formatFileSize(metadata.fileSize)}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-gray-500">Type</p>
          <p className="font-medium">{metadata.type.toUpperCase()}</p>
        </div>
        <div>
          <p className="text-gray-500">Total {metadata.unitName}</p>
          <p className="font-medium">{metadata.totalUnits}</p>
        </div>
      </div>
      
      {metadata.additionalInfo && (
        <div className="pt-4 border-t">
          <p className="text-sm font-medium text-gray-700 mb-2">Additional Information</p>
          <div className="space-y-1">
            {Object.entries(metadata.additionalInfo).map(([key, value]) => (
              <div key={key} className="text-sm">
                <span className="text-gray-500">{key}: </span>
                <span className="font-medium">{JSON.stringify(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}