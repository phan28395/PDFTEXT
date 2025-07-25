import { DocumentProcessor } from '@/types/document';
import { PDFProcessor } from './processors/pdfProcessor';

const processors: Record<string, DocumentProcessor> = {
  'application/pdf': new PDFProcessor(),
};

export function getProcessor(mimeType: string): DocumentProcessor {
  const processor = processors[mimeType];
  if (!processor) {
    throw new Error(`Unsupported file type: ${mimeType}`);
  }
  return processor;
}

export function isSupportedType(mimeType: string): boolean {
  return mimeType in processors;
}