// Document type abstraction for universal preview system

export interface DocumentMetadata {
  type: 'pdf';
  totalUnits: number;  // pages for PDF
  unitName: string;    // "pages"
  fileName: string;
  fileSize: number;
  dimensions?: { width: number; height: number };
  additionalInfo?: Record<string, any>;
}

export interface DocumentProcessor {
  analyze(file: File | Buffer): Promise<DocumentMetadata>;
  generatePreview(file: File | Buffer, range: SelectionRange): Promise<PreviewData>;
  estimateCost(metadata: DocumentMetadata, range: SelectionRange): number;
}

export interface SelectionRange {
  start: number;
  end: number;
  all: boolean;
}

export interface PreviewData {
  units: PreviewUnit[];
  processingTime: number;
}

export interface PreviewUnit {
  index: number;
  imageUrl: string;
  thumbnail: string;
  text?: string;  // Extracted text preview
  metadata?: any;
}