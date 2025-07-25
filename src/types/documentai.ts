// Document AI types (without importing the actual library)

export interface ProcessedDocument {
  text: string;
  pages: number;
  confidence: number;
  processingTime: number;
  language?: LanguageInfo;
  ocrQuality?: OCRQualityInfo;
  entities?: Array<{
    type: string;
    mention_text: string;
    confidence: number;
  }>;
  structure?: DocumentStructure;
  mathematics?: MathematicalContent[];
  images?: ImageContent[];
  formatting?: FormattingInfo;
  forms?: FormData[];
}

export interface LanguageInfo {
  primaryLanguage: string;
  detectedLanguages: Array<{
    languageCode: string;
    confidence: number;
    pageNumbers: number[];
  }>;
  isMultilingual: boolean;
}

export interface OCRQualityInfo {
  overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  averageConfidence: number;
  lowConfidencePages: number[];
  readabilityScore: number;
}

export interface DocumentStructure {
  tables: TableContent[];
  paragraphs: ParagraphContent[];
  headers: HeaderContent[];
  lists: ListContent[];
}

export interface MathematicalContent {
  content: string;
  type: 'equation' | 'formula' | 'symbol';
  page: number;
  boundingBox: BoundingBox;
  confidence: number;
  latex?: string;
}

export interface ImageContent {
  description: string;
  page: number;
  boundingBox: BoundingBox;
  confidence: number;
  size: { width: number; height: number };
  extractedText?: string;
}

export interface TableContent {
  headers: string[];
  rows: string[][];
  page: number;
  confidence: number;
  isStructured: boolean;
  cellConfidences?: number[][];
  boundingBox?: BoundingBox;
}

export interface ParagraphContent {
  text: string;
  style: string;
  page: number;
  alignment: string;
}

export interface HeaderContent {
  text: string;
  level: number;
  page: number;
  style: string;
}

export interface ListContent {
  items: string[];
  type: 'ordered' | 'unordered';
  page: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FormattingInfo {
  fonts: FontInfo[];
  styles: StyleInfo[];
  layout: LayoutInfo;
}

export interface FontInfo {
  name: string;
  size: number;
  bold: boolean;
  italic: boolean;
}

export interface StyleInfo {
  color: string;
  backgroundColor?: string;
  underlined: boolean;
  strikethrough: boolean;
}

export interface LayoutInfo {
  columns: number;
  margins: { top: number; bottom: number; left: number; right: number };
  pageSize: { width: number; height: number };
}