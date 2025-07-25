import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { PreviewData, DocumentMetadata, PreviewUnit } from '@/types/document';
import { Loader2 } from 'lucide-react';

interface PreviewDisplayProps {
  previewData: PreviewData | null;
  loading: boolean;
  metadata: DocumentMetadata | null;
}

export default function PreviewDisplay({ 
  previewData, 
  loading, 
  metadata 
}: PreviewDisplayProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  
  const virtualizer = useVirtualizer({
    count: previewData?.units.length || 0,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 800,
    overscan: 2,
  });
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Generating preview...</p>
        </div>
      </div>
    );
  }
  
  if (!previewData || previewData.units.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-500">Select {metadata?.unitName} to preview</p>
      </div>
    );
  }
  
  return (
    <div ref={parentRef} className="h-full overflow-auto p-6">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const unit = previewData.units[virtualItem.index];
          
          return (
            <div
              key={virtualItem.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <PreviewUnitComponent unit={unit} metadata={metadata} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewUnitComponent({ unit, metadata }: { unit: PreviewUnit; metadata: DocumentMetadata | null }) {
  return (
    <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-medium text-gray-900">
          {metadata?.unitName.slice(0, -1)} {unit.index}
        </h4>
        {unit.text && (
          <span className="text-sm text-gray-500">
            {unit.text.split(' ').length} words detected
          </span>
        )}
      </div>
      
      <div className="border rounded-lg overflow-hidden">
        <img
          src={unit.imageUrl}
          alt={`${metadata?.unitName.slice(0, -1)} ${unit.index}`}
          className="w-full"
          loading="lazy"
        />
      </div>
    </div>
  );
}