import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { DocumentType } from '@/components/DocumentTypeSelector';

interface DocumentModeContextType {
  documentMode: DocumentType;
  setDocumentMode: (mode: DocumentType) => void;
}

const DocumentModeContext = createContext<DocumentModeContextType | undefined>(undefined);

const STORAGE_KEY = 'pdf-to-text-document-mode';

export function DocumentModeProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage or default to 'standard'
  const [documentMode, setDocumentModeState] = useState<DocumentType>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as DocumentType) || 'standard';
  });

  // Persist to localStorage when mode changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, documentMode);
  }, [documentMode]);

  const setDocumentMode = (mode: DocumentType) => {
    setDocumentModeState(mode);
  };

  return (
    <DocumentModeContext.Provider value={{ documentMode, setDocumentMode }}>
      {children}
    </DocumentModeContext.Provider>
  );
}

export function useDocumentMode() {
  const context = useContext(DocumentModeContext);
  if (context === undefined) {
    throw new Error('useDocumentMode must be used within a DocumentModeProvider');
  }
  return context;
}