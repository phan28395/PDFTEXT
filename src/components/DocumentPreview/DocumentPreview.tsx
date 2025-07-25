import React, { useState, useEffect } from 'react';
import { DocumentMetadata, SelectionRange, PreviewData } from '@/types/document';
import { getProcessor } from '@/services/documentProcessorFactory';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';
import RangeSelector from './RangeSelector';
import PreviewDisplay from './PreviewDisplay';
import DocumentInfo from './DocumentInfo';

interface DocumentPreviewProps {
  file: File;
  onConfirm: (range: SelectionRange) => void;
}

export default function DocumentPreview({ file, onConfirm }: DocumentPreviewProps) {
  const { metadata, previewData, loading, error, generatePreview, analyzeDocument } = useDocumentPreview(file);
  const [selectedRange, setSelectedRange] = useState<SelectionRange>({
    start: 1,
    end: 1,
    all: false
  });
  const [cost, setCost] = useState(0);
  
  useEffect(() => {
    const analyze = async () => {
      const meta = await analyzeDocument();
      if (meta) {
        setSelectedRange({
          start: 1,
          end: meta.totalUnits,
          all: true
        });
      }
    };
    analyze();
  }, [file, analyzeDocument]);
  
  useEffect(() => {
    if (metadata && selectedRange) {
      generatePreview(selectedRange);
      
      // Calculate cost
      const processor = getProcessor(file.type);
      const estimatedCost = processor.estimateCost(metadata, selectedRange);
      setCost(estimatedCost);
    }
  }, [selectedRange, metadata, generatePreview, file.type]);
  
  return (
    <div className="flex h-full">
      <div className="w-1/3 bg-white border-r p-6 space-y-6">
        <DocumentInfo metadata={metadata} loading={loading} />
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}
        
        {metadata && (
          <>
            <RangeSelector
              metadata={metadata}
              value={selectedRange}
              onChange={setSelectedRange}
            />
            
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="font-medium text-blue-900">Processing Cost</h4>
              <p className="text-2xl font-bold text-blue-600">
                ${cost.toFixed(2)}
              </p>
              <p className="text-sm text-blue-700">
                {selectedRange.all ? metadata.totalUnits : (selectedRange.end - selectedRange.start + 1)} {metadata.unitName}
              </p>
            </div>
            
            <button
              onClick={() => onConfirm(selectedRange)}
              className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Process Selected {metadata.unitName}
            </button>
          </>
        )}
      </div>
      
      <div className="flex-1 bg-gray-50">
        <PreviewDisplay 
          previewData={previewData}
          loading={loading}
          metadata={metadata}
        />
      </div>
    </div>
  );
}