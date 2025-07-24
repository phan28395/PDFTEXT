import React from 'react';
import { FileText, Calculator, Table } from 'lucide-react';

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
    description: 'Academic papers with mathematical formulas',
    icon: Calculator,
    examples: ['Research papers', 'Equations', 'Scientific texts', 'Thesis'],
    features: ['Math formulas', 'LaTeX syntax', 'Academic structure']
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
  return (
    <div className={`space-y-4 ${className}`}>
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Choose Document Type
        </h3>
        <p className="text-sm text-gray-600">
          Select the type that best matches your document for optimal processing
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {DOCUMENT_TYPES.map((type) => {
          const IconComponent = type.icon;
          const isSelected = selectedType === type.id;
          
          return (
            <button
              key={type.id}
              onClick={() => onTypeSelect(type.id)}
              className={`
                p-6 rounded-lg border-2 transition-all duration-200 text-left
                ${isSelected 
                  ? 'border-blue-500 bg-blue-50 shadow-md' 
                  : 'border-gray-200 hover:border-blue-300 hover:bg-blue-25'
                }
              `}
            >
              <div className="flex items-center mb-3">
                <IconComponent className={`h-6 w-6 mr-3 ${
                  isSelected ? 'text-blue-600' : 'text-gray-600'
                }`} />
                <h4 className={`font-medium ${
                  isSelected ? 'text-blue-900' : 'text-gray-900'
                }`}>
                  {type.name}
                </h4>
              </div>
              
              <p className={`text-sm mb-3 ${
                isSelected ? 'text-blue-700' : 'text-gray-600'
              }`}>
                {type.description}
              </p>

              <div className="mb-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Examples
                </p>
                <div className="flex flex-wrap gap-1">
                  {type.examples.map((example) => (
                    <span
                      key={example}
                      className={`text-xs px-2 py-1 rounded-full ${
                        isSelected 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Features
                </p>
                <ul className="text-xs space-y-1">
                  {type.features.map((feature) => (
                    <li key={feature} className={`flex items-center ${
                      isSelected ? 'text-blue-600' : 'text-gray-500'
                    }`}>
                      <div className={`w-1 h-1 rounded-full mr-2 ${
                        isSelected ? 'bg-blue-500' : 'bg-gray-400'
                      }`} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>

              {isSelected && (
                <div className="mt-3 text-center">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-500 text-white">
                    ✓ Selected
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-center text-sm text-gray-500">
        <p>All document types: <span className="font-medium text-gray-900">$0.012 per page</span></p>
      </div>
    </div>
  );
};

export default DocumentTypeSelector;