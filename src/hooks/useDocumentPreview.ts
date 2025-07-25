import { useState, useCallback, useRef } from 'react';
import { DocumentMetadata, PreviewData, SelectionRange } from '@/types/document';
import { getProcessor } from '@/services/documentProcessorFactory';

interface DocumentPreviewState {
  metadata: DocumentMetadata | null;
  previewData: PreviewData | null;
  loading: boolean;
  error: string | null;
}

export function useDocumentPreview(file: File & { storagePath?: string }) {
  const [state, setState] = useState<DocumentPreviewState>({
    metadata: null,
    previewData: null,
    loading: false,
    error: null
  });
  
  // Cache preview data
  const previewCache = useRef(new Map<string, PreviewData>());
  
  const generatePreview = useCallback(async (range: SelectionRange) => {
    const cacheKey = `${range.start}-${range.end}-${range.all}`;
    
    // Check cache
    if (previewCache.current.has(cacheKey)) {
      setState(prev => ({
        ...prev,
        previewData: previewCache.current.get(cacheKey)!
      }));
      return;
    }
    
    // Generate new preview
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const processor = getProcessor(file.type);
      const preview = await processor.generatePreview(file, range);
      
      // Cache result
      previewCache.current.set(cacheKey, preview);
      
      setState(prev => ({
        ...prev,
        previewData: preview,
        loading: false
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to generate preview',
        loading: false
      }));
    }
  }, [file]);
  
  const analyzeDocument = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const processor = getProcessor(file.type);
      const metadata = await processor.analyze(file);
      
      setState(prev => ({
        ...prev,
        metadata,
        loading: false
      }));
      
      return metadata;
    } catch (error) {
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to analyze document',
        loading: false
      }));
      return null;
    }
  }, [file]);
  
  const clearCache = useCallback(() => {
    previewCache.current.clear();
  }, []);
  
  return {
    ...state,
    generatePreview,
    analyzeDocument,
    clearCache
  };
}