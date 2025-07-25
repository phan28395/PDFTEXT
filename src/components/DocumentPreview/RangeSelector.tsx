import React from 'react';
import { DocumentMetadata, SelectionRange } from '@/types/document';

interface RangeSelectorProps {
  metadata: DocumentMetadata;
  value: SelectionRange;
  onChange: (range: SelectionRange) => void;
}

export default function RangeSelector({ metadata, value, onChange }: RangeSelectorProps) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">
        Select {metadata.unitName} to process
      </h3>
      
      {/* Quick Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onChange({ start: 1, end: metadata.totalUnits, all: true })}
          className={`px-4 py-2 rounded ${
            value.all ? 'bg-blue-600 text-white' : 'bg-gray-100'
          }`}
        >
          All {metadata.unitName}
        </button>
        
        <button
          onClick={() => onChange({ start: 1, end: 1, all: false })}
          className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
        >
          First {metadata.unitName.slice(0, -1)}
        </button>
      </div>
      
      {/* Custom Range */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700">
          Custom Range
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={metadata.totalUnits}
            value={value.start}
            onChange={(e) => onChange({
              ...value,
              start: parseInt(e.target.value) || 1,
              all: false
            })}
            className="w-20 px-3 py-2 border rounded"
          />
          <span>to</span>
          <input
            type="number"
            min={1}
            max={metadata.totalUnits}
            value={value.end}
            onChange={(e) => onChange({
              ...value,
              end: parseInt(e.target.value) || metadata.totalUnits,
              all: false
            })}
            className="w-20 px-3 py-2 border rounded"
          />
          <span className="text-sm text-gray-500">
            of {metadata.totalUnits}
          </span>
        </div>
      </div>
      
      {/* Visual Range Indicator */}
      <div className="mt-4">
        <div className="h-2 bg-gray-200 rounded-full relative">
          <div
            className="absolute h-full bg-blue-600 rounded-full"
            style={{
              left: `${((value.start - 1) / metadata.totalUnits) * 100}%`,
              width: `${((value.end - value.start + 1) / metadata.totalUnits) * 100}%`
            }}
          />
        </div>
      </div>
    </div>
  );
}