import React, { useState } from 'react';
import { ProcessedDocument, MathematicalContent, ImageContent, TableContent } from '@/types/documentai';
import OutputFormatGenerator from './OutputFormatGenerator';

interface EnhancedProcessingResultsProps {
  processedDoc: ProcessedDocument;
  filename: string;
  recordId?: string;
}

export const EnhancedProcessingResults: React.FC<EnhancedProcessingResultsProps> = ({
  processedDoc,
  filename,
  recordId
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'structure' | 'mathematics' | 'images' | 'analysis' | 'downloads'>('text');
  const [searchTerm, setSearchTerm] = useState('');

  const tabs = [
    { id: 'text', label: 'Extracted Text', count: null },
    { id: 'structure', label: 'Document Structure', count: processedDoc.structure ? 
      (processedDoc.structure.tables.length + processedDoc.structure.paragraphs.length + processedDoc.structure.headers.length) : 0 },
    { id: 'mathematics', label: 'Mathematical Content', count: processedDoc.mathematics?.length || 0 },
    { id: 'images', label: 'Images & Visual Elements', count: processedDoc.images?.length || 0 },
    { id: 'analysis', label: 'Document Analysis', count: null },
    { id: 'downloads', label: 'Download Formats', count: null }
  ];

  const highlightSearchTerm = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  };

  const filteredText = searchTerm 
    ? processedDoc.text.split('\n').filter(line => 
        line.toLowerCase().includes(searchTerm.toLowerCase())
      ).join('\n')
    : processedDoc.text;

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-full">
      <div className="mb-6">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Processing Results: {filename}
        </h3>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <span className="bg-blue-100 px-2 py-1 rounded">
            {processedDoc.pages} pages processed
          </span>
          <span className="bg-green-100 px-2 py-1 rounded">
            {Math.round(processedDoc.confidence * 100)}% confidence
          </span>
          <span className="bg-purple-100 px-2 py-1 rounded">
            {(processedDoc.processingTime / 1000).toFixed(2)}s processing time
          </span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search extracted content..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              {tab.count !== null && (
                <span className="ml-2 bg-gray-100 text-gray-900 py-0.5 px-2.5 rounded-full text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'text' && (
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Extracted Text Content</h4>
            <div className="bg-gray-50 p-4 rounded-lg max-h-96 overflow-y-auto">
              <pre 
                className="whitespace-pre-wrap text-sm text-gray-800 font-mono leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: searchTerm ? highlightSearchTerm(filteredText, searchTerm) : filteredText 
                }}
              />
            </div>
            {searchTerm && (
              <p className="text-sm text-gray-500">
                Showing lines containing "{searchTerm}"
              </p>
            )}
          </div>
        )}

        {activeTab === 'structure' && (
          <div className="space-y-6">
            <h4 className="text-lg font-medium text-gray-900">Document Structure Analysis</h4>
            
            {processedDoc.structure?.tables && processedDoc.structure.tables.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-3">Tables ({processedDoc.structure.tables.length})</h5>
                {processedDoc.structure.tables.map((table, index) => (
                  <TableDisplay key={index} table={table} index={index} />
                ))}
              </div>
            )}

            {processedDoc.structure?.paragraphs && processedDoc.structure.paragraphs.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-3">
                  Paragraphs ({processedDoc.structure.paragraphs.length})
                </h5>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {processedDoc.structure.paragraphs.slice(0, 10).map((paragraph, index) => (
                    <div key={index} className="bg-gray-50 p-3 rounded">
                      <div className="flex justify-between text-xs text-gray-500 mb-2">
                        <span>Page {paragraph.page}</span>
                        <span>Style: {paragraph.style}</span>
                      </div>
                      <p className="text-sm text-gray-800 line-clamp-3">
                        {paragraph.text.substring(0, 200)}...
                      </p>
                    </div>
                  ))}
                </div>
                {processedDoc.structure.paragraphs.length > 10 && (
                  <p className="text-sm text-gray-500 mt-2">
                    Showing first 10 of {processedDoc.structure.paragraphs.length} paragraphs
                  </p>
                )}
              </div>
            )}

            {processedDoc.structure?.headers && processedDoc.structure.headers.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-3">Headers ({processedDoc.structure.headers.length})</h5>
                <div className="space-y-2">
                  {processedDoc.structure.headers.map((header, index) => (
                    <div key={index} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                        H{header.level}
                      </span>
                      <span className="text-xs text-gray-500">Page {header.page}</span>
                      <span className="text-sm font-medium text-gray-900">{header.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'mathematics' && (
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Mathematical Content</h4>
            {processedDoc.mathematics && processedDoc.mathematics.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {processedDoc.mathematics.map((math, index) => (
                  <MathContentDisplay key={index} math={math} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📐</div>
                <p>No mathematical content detected in this document.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <h4 className="text-lg font-medium text-gray-900">Images & Visual Elements</h4>
            {processedDoc.images && processedDoc.images.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {processedDoc.images.map((image, index) => (
                  <ImageContentDisplay key={index} image={image} />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">🖼️</div>
                <p>No images or visual elements detected in this document.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <h4 className="text-lg font-medium text-gray-900">Document Analysis</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Quality Metrics</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-blue-700">Confidence:</span>
                    <span className="font-medium text-blue-900">
                      {Math.round(processedDoc.confidence * 100)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Processing Time:</span>
                    <span className="font-medium text-blue-900">
                      {(processedDoc.processingTime / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-blue-700">Word Count:</span>
                    <span className="font-medium text-blue-900">
                      {processedDoc.text.split(/\s+/).length.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h5 className="font-medium text-green-900 mb-2">Content Types</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-green-700">Tables:</span>
                    <span className="font-medium text-green-900">
                      {processedDoc.structure?.tables.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Math Elements:</span>
                    <span className="font-medium text-green-900">
                      {processedDoc.mathematics?.length || 0}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Images:</span>
                    <span className="font-medium text-green-900">
                      {processedDoc.images?.length || 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg">
                <h5 className="font-medium text-purple-900 mb-2">Document Layout</h5>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-purple-700">Pages:</span>
                    <span className="font-medium text-purple-900">{processedDoc.pages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Columns:</span>
                    <span className="font-medium text-purple-900">
                      {processedDoc.formatting?.layout.columns || 1}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-purple-700">Fonts:</span>
                    <span className="font-medium text-purple-900">
                      {processedDoc.formatting?.fonts.length || 'Unknown'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {processedDoc.entities && processedDoc.entities.length > 0 && (
              <div>
                <h5 className="font-medium text-gray-900 mb-3">Detected Entities</h5>
                <div className="flex flex-wrap gap-2">
                  {processedDoc.entities.map((entity, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
                    >
                      <span className="mr-1">{entity.type}:</span>
                      {entity.mention_text}
                      <span className="ml-1 text-gray-500">
                        ({Math.round(entity.confidence * 100)}%)
                      </span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'downloads' && recordId && (
          <div>
            <OutputFormatGenerator
              recordId={recordId}
              originalFilename={filename}
              onDownloadGenerated={(downloadUrl, format) => {
                console.log(`Download generated for ${format}:`, downloadUrl);
              }}
            />
          </div>
        )}

        {activeTab === 'downloads' && !recordId && (
          <div className="text-center py-8">
            <p className="text-gray-500">
              Download functionality is not available for this processing result.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const TableDisplay: React.FC<{ table: TableContent; index: number }> = ({ table, index }) => (
  <div className="bg-white border rounded-lg p-4 mb-4">
    <div className="flex justify-between items-center mb-3">
      <h6 className="font-medium text-gray-900">Table {index + 1}</h6>
      <div className="text-xs text-gray-500 space-x-2">
        <span>Page {table.page}</span>
        <span>•</span>
        <span>{Math.round(table.confidence * 100)}% confidence</span>
      </div>
    </div>
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {table.headers.map((header, i) => (
              <th key={i} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {table.rows.slice(0, 5).map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.rows.length > 5 && (
        <p className="text-xs text-gray-500 mt-2">
          Showing first 5 of {table.rows.length} rows
        </p>
      )}
    </div>
  </div>
);

const MathContentDisplay: React.FC<{ math: MathematicalContent }> = ({ math }) => (
  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
    <div className="flex items-start justify-between mb-2">
      <span className={`px-2 py-1 rounded text-xs font-medium ${
        math.type === 'equation' ? 'bg-blue-100 text-blue-800' :
        math.type === 'formula' ? 'bg-green-100 text-green-800' :
        'bg-purple-100 text-purple-800'
      }`}>
        {math.type}
      </span>
      <div className="text-xs text-gray-500">
        Page {math.page} • {Math.round(math.confidence * 100)}% confidence
      </div>
    </div>
    <div className="font-mono text-sm text-gray-900 mb-2">
      {math.content}
    </div>
    {math.latex && (
      <div className="text-xs text-gray-600">
        LaTeX: <code className="bg-gray-100 px-1 rounded">{math.latex}</code>
      </div>
    )}
  </div>
);

const ImageContentDisplay: React.FC<{ image: ImageContent }> = ({ image }) => (
  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-blue-900">Visual Element</span>
      <div className="text-xs text-blue-700">
        Page {image.page} • {Math.round(image.confidence * 100)}% confidence
      </div>
    </div>
    <p className="text-sm text-blue-800 mb-2">{image.description}</p>
    <div className="flex justify-between text-xs text-blue-600">
      <span>Size: {image.size.width} × {image.size.height}px</span>
      {image.extractedText && <span>Contains text</span>}
    </div>
  </div>
);

export default EnhancedProcessingResults;