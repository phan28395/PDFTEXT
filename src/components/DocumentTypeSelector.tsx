import React, { useState } from 'react';
import { FileText, Calculator, Table, HelpCircle } from 'lucide-react';

export type DocumentType = 'standard' | 'latex' | 'forms';

interface DocumentTypeOption {
  id: DocumentType;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  examples: string[];
  features: string[];
}

const DOCUMENT_TYPES: DocumentTypeOption[] = [
  {
    id: 'standard',
    name: 'Standard Document',
    description: 'Regular text documents, articles, books',
    icon: FileText,
    examples: ['Articles', 'Books', 'Reports', 'Essays'],
    features: ['Text extraction', 'Paragraph structure', 'Basic formatting']
  },
  {
    id: 'latex',
    name: 'LaTeX Document', 
    description: 'Documents with mathematical formulas to preserve',
    icon: Calculator,
    examples: ['Research papers', 'Technical docs', 'Scientific texts', 'Any doc with equations'],
    features: ['LaTeX formula preservation', 'Mixed content support', 'Equation syntax retention']
  },
  {
    id: 'forms',
    name: 'Forms & Tables',
    description: 'Forms, tables, and structured data',
    icon: Table,
    examples: ['Forms', 'Tables', 'Invoices', 'Surveys'],
    features: ['Table structure', 'Form fields', 'Data extraction']
  }
];

interface DocumentTypeSelectorProps {
  selectedType: DocumentType | null;
  onTypeSelect: (type: DocumentType) => void;
  className?: string;
}

export const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({
  selectedType,
  onTypeSelect,
  className = ''
}) => {
  const [hoveredType, setHoveredType] = useState<DocumentType | null>(null);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="text-center">
        <h3 className="text-base font-semibold text-gray-900">
          Choose Document Type
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {DOCUMENT_TYPES.map((type) => {
          const IconComponent = type.icon;
          const isSelected = selectedType === type.id;
          const isHovered = hoveredType === type.id;
          
          return (
            <div key={type.id} className="relative">
              <button
                onClick={() => onTypeSelect(type.id)}
                onMouseEnter={() => setHoveredType(type.id)}
                onMouseLeave={() => setHoveredType(null)}
                className={`
                  w-full p-4 rounded-lg border-2 transition-all duration-200 text-left
                  ${isSelected 
                    ? 'border-blue-500 bg-blue-50 shadow-md' 
                    : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                  }
                `}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <IconComponent className={`h-5 w-5 mr-2 ${
                      isSelected ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                    <h4 className={`font-medium text-sm ${
                      isSelected ? 'text-blue-900' : 'text-gray-900'
                    }`}>
                      {type.name}
                    </h4>
                  </div>
                  <HelpCircle className="h-4 w-4 text-gray-400" />
                </div>
                
                <p className={`text-xs ${
                  isSelected ? 'text-blue-700' : 'text-gray-600'
                }`}>
                  {type.description}
                </p>

                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-blue-500 text-white">
                      ✓
                    </span>
                  </div>
                )}
              </button>

              {/* Tooltip */}
              {isHovered && (
                <div className="absolute z-10 mt-1 p-3 bg-gray-900 text-white rounded-lg shadow-lg max-w-xs pointer-events-none">
                  <div className="mb-2">
                    <p className="text-xs font-medium mb-1">Examples:</p>
                    <p className="text-xs opacity-90">{type.examples.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">Features:</p>
                    <ul className="text-xs space-y-0.5 opacity-90">
                      {type.features.map((feature) => (
                        <li key={feature}>• {feature}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="absolute -top-1 left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45"></div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="text-center text-xs text-gray-500">
        <p>All types: <span className="font-medium text-gray-700">$0.012/page</span></p>
      </div>
    </div>
  );
};

export default DocumentTypeSelector;