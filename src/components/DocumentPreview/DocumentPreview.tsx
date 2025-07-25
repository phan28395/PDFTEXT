import React, { useState, useEffect } from 'react';
import { DocumentMetadata, SelectionRange } from '@/types/document';
import { getProcessor } from '@/services/documentProcessorFactory';
import { PDFPreview } from '../PDFPreview';
import DocumentInfo from './DocumentInfo';
import { Loader2 } from 'lucide-react';

interface DocumentPreviewProps {
  file: File;
  onConfirm: (range: SelectionRange) => void;
}

export default function DocumentPreview({ file, onConfirm }: DocumentPreviewProps) {
  const [metadata, setMetadata] = useState<DocumentMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const analyzeDocument = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const processor = getProcessor(file.type);
        const meta = await processor.analyze(file);
        setMetadata(meta);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze document');
      } finally {
        setLoading(false);
      }
    };
    
    analyzeDocument();
  }, [file]);
  
  const handlePageRangeSelect = (start: number, end: number) => {
    onConfirm({ start, end, all: false });
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-sm text-gray-600">Analyzing document...</p>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }
  
  if (!metadata || !metadata.cloudinaryPublicId) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-700">Unable to preview document. Please try again.</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <DocumentInfo metadata={metadata} loading={false} />
      
      {metadata.type === 'pdf' && (
        <PDFPreview
          publicId={metadata.cloudinaryPublicId}
          totalPages={metadata.totalUnits}
          onPageRangeSelect={handlePageRangeSelect}
        />
      )}
    </div>
  );
}