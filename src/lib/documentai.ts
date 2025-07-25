import { DocumentProcessorServiceClient } from '@google-cloud/documentai';

// Initialize Google Document AI client
const client = new DocumentProcessorServiceClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
});

// Configuration
export const DOCUMENT_AI_CONFIG = {
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || '',
  location: process.env.GOOGLE_DOCUMENT_AI_LOCATION || 'us',
  processorId: process.env.GOOGLE_DOCUMENT_AI_PROCESSOR_ID || '',
  ocrProcessorId: process.env.GOOGLE_DOCUMENT_AI_OCR_PROCESSOR_ID || '',
  formParserProcessorId: process.env.GOOGLE_DOCUMENT_AI_FORM_PARSER_ID || '',
  processorVersion: 'rc', // Use release candidate version
};

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

export interface FormData {
  fields: Array<{
    fieldName: string;
    fieldValue: string;
    confidence: number;
    page: number;
  }>;
  tables: FormTable[];
  checkboxes: Array<{
    name: string;
    isChecked: boolean;
    confidence: number;
    page: number;
  }>;
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

export interface FormattingInfo {
  fonts: FontInfo[];
  styles: StyleInfo[];
  layout: LayoutInfo;
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

export interface FormTable {
  headers: string[];
  rows: string[][];
  page: number;
  confidence: number;
  tableType: 'form' | 'data' | 'invoice' | 'unknown';
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

export class DocumentAIError extends Error {
  public code: string;
  public details?: any;
  
  constructor(code: string, message: string, details?: any) {
    super(message);
    this.name = 'DocumentAIError';
    this.code = code;
    this.details = details;
  }
}

/**
 * Process PDF document using Google Document AI
 * @param fileBuffer - PDF file buffer
 * @param mimeType - MIME type (should be 'application/pdf')
 * @returns Processed document with extracted text
 */
export async function processDocument(
  fileBuffer: Buffer,
  mimeType: string = 'application/pdf'
): Promise<ProcessedDocument> {
  try {
    const startTime = Date.now();

    // Validate file type
    if (mimeType !== 'application/pdf') {
      throw new Error('Only PDF files are supported');
    }

    // Validate file size (max 200MB for Document AI)
    const maxSize = 200 * 1024 * 1024; // 200MB
    if (fileBuffer.length > maxSize) {
      throw new Error('File size exceeds maximum limit of 200MB');
    }

    // Construct the full resource name
    const name = `projects/${DOCUMENT_AI_CONFIG.projectId}/locations/${DOCUMENT_AI_CONFIG.location}/processors/${DOCUMENT_AI_CONFIG.processorId}`;

    // Prepare the request
    const request = {
      name,
      rawDocument: {
        content: fileBuffer,
        mimeType,
      },
    };

    // Process the document
    const [result] = await client.processDocument(request);
    const document = result.document;

    if (!document) {
      throw new Error('Failed to process document');
    }

    const processingTime = Date.now() - startTime;

    // Extract comprehensive document content
    let fullText = '';
    let totalConfidence = 0;
    let pageCount = 0;
    const structure: DocumentStructure = {
      tables: [],
      paragraphs: [],
      headers: [],
      lists: []
    };
    const mathematics: MathematicalContent[] = [];
    const images: ImageContent[] = [];
    const fonts: FontInfo[] = [];
    const styles: StyleInfo[] = [];

    if (document.pages) {
      pageCount = document.pages.length;
      
      for (let pageIdx = 0; pageIdx < document.pages.length; pageIdx++) {
        const page = document.pages[pageIdx];
        
        // Extract paragraphs with formatting
        if (page.paragraphs) {
          for (const paragraph of page.paragraphs) {
            if (paragraph.layout?.textAnchor?.textSegments) {
              let paragraphText = '';
              for (const segment of paragraph.layout.textAnchor.textSegments) {
                if (segment.startIndex != null && segment.endIndex != null && document.text) {
                  const startIdx = parseInt(segment.startIndex.toString());
                  const endIdx = parseInt(segment.endIndex.toString());
                  const segmentText = document.text.substring(startIdx, endIdx);
                  paragraphText += segmentText;
                  fullText += segmentText;
                }
              }
              
              // Detect and extract mathematical content
              const mathMatches = detectMathematicalContent(paragraphText, pageIdx);
              mathematics.push(...mathMatches);
              
              // Store paragraph structure
              if (paragraphText.trim()) {
                structure.paragraphs.push({
                  text: paragraphText.trim(),
                  style: detectParagraphStyle(paragraph),
                  page: pageIdx + 1,
                  alignment: detectTextAlignment(paragraph)
                });
                
                fullText += '\n';
              }
            }
          }
        }

        // Extract tables with enhanced structure detection
        if (page.tables) {
          for (const table of page.tables) {
            const extractedTable = extractTableContentEnhanced(table, document.text || '', pageIdx + 1);
            if (extractedTable) {
              structure.tables.push(extractedTable);
              // Add table content to full text with structure indicators
              if (extractedTable.isStructured) {
                fullText += `\n[STRUCTURED_TABLE]\n${extractedTable.headers.join(' | ')}\n`;
                for (const row of extractedTable.rows) {
                  fullText += `${row.join(' | ')}\n`;
                }
                fullText += '[/STRUCTURED_TABLE]\n\n';
              } else {
                fullText += `\n[TABLE]\n${extractedTable.headers.join(' | ')}\n`;
                for (const row of extractedTable.rows) {
                  fullText += `${row.join(' | ')}\n`;
                }
                fullText += '[/TABLE]\n\n';
              }
            }
          }
        }

        // Extract images and visual elements
        if (page.visualElements) {
          for (const element of page.visualElements) {
            if (element.detectedLanguages && element.layout) {
              const imageInfo = extractImageContent(element, pageIdx + 1);
              if (imageInfo) {
                images.push(imageInfo);
                fullText += `\n[IMAGE: ${imageInfo.description}]\n`;
              }
            }
          }
        }

        // Extract font and style information
        if (page.paragraphs) {
          for (const paragraph of page.paragraphs) {
            const fontInfo = extractFontInfo(paragraph);
            if (fontInfo && !fonts.some(f => f.name === fontInfo.name && f.size === fontInfo.size)) {
              fonts.push(fontInfo);
            }
            
            const styleInfo = extractStyleInfo(paragraph);
            if (styleInfo && !styles.some(s => s.color === styleInfo.color)) {
              styles.push(styleInfo);
            }
          }
        }
      }
    }

    // If no structured text found, use raw document text
    if (!fullText && document.text) {
      fullText = document.text;
      // Still try to detect mathematical content in raw text
      const mathMatches = detectMathematicalContent(document.text, 0);
      mathematics.push(...mathMatches);
    }

    // Calculate average confidence
    if (document.pages) {
      let confidenceSum = 0;
      let confidenceCount = 0;

      for (const page of document.pages) {
        if (page.paragraphs) {
          for (const paragraph of page.paragraphs) {
            if (paragraph.layout?.confidence) {
              confidenceSum += paragraph.layout.confidence;
              confidenceCount++;
            }
          }
        }
      }

      totalConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0.95;
    } else {
      totalConfidence = 0.95; // Default confidence
    }

    // Extract entities if available
    const entities = document.entities?.map(entity => ({
      type: entity.type || 'unknown',
      mention_text: entity.mentionText || '',
      confidence: entity.confidence || 0,
    })) || [];

    // Apply content sanitization
    const sanitizedText = sanitizeExtractedContent(fullText);

    // Detect languages
    const languageInfo = detectLanguages(document.pages || []);

    // Assess OCR quality
    const ocrQuality = assessOCRQuality(document.pages || [], totalConfidence);

    // Extract form data if available
    const formData = extractFormData(document);

    // Determine layout info
    const layoutInfo: LayoutInfo = {
      columns: detectColumnLayout(document.pages || []),
      margins: { top: 72, bottom: 72, left: 72, right: 72 }, // Default values
      pageSize: { width: 612, height: 792 } // Default letter size
    };

    return {
      text: sanitizedText,
      pages: pageCount || 1,
      confidence: Math.round(totalConfidence * 100) / 100,
      processingTime,
      language: languageInfo,
      ocrQuality,
      entities: entities.length > 0 ? entities : undefined,
      structure: structure.tables.length > 0 || structure.paragraphs.length > 0 ? structure : undefined,
      mathematics: mathematics.length > 0 ? mathematics : undefined,
      images: images.length > 0 ? images : undefined,
      formatting: {
        fonts,
        styles,
        layout: layoutInfo
      },
      forms: formData.length > 0 ? formData : undefined
    };

  } catch (error: any) {
    console.error('Document AI processing error:', error);
    
    // Map common errors to user-friendly messages
    if (error.code === 7) {
      throw new DocumentAIError('PERMISSION_DENIED', 'Invalid API credentials or insufficient permissions');
    } else if (error.code === 8) {
      throw new DocumentAIError('RESOURCE_EXHAUSTED', 'API quota exceeded. Please try again later.');
    } else if (error.code === 3) {
      throw new DocumentAIError('INVALID_ARGUMENT', 'Invalid file format or corrupted PDF');
    } else if (error.code === 4) {
      throw new DocumentAIError('DEADLINE_EXCEEDED', 'Processing timeout. File may be too large or complex.');
    }

    throw error;
  }
}

/**
 * Validate file before processing
 * @param fileBuffer - File buffer to validate
 * @param filename - Original filename
 * @returns Validation result
 */
export function validateFile(fileBuffer: Buffer, filename: string): { valid: boolean; error?: string } {
  // Check file extension
  const allowedExtensions = ['.pdf'];
  const fileExtension = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'Only PDF files are allowed' };
  }

  // Check magic bytes for PDF
  const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
  if (!fileBuffer.subarray(0, 4).equals(pdfMagicBytes)) {
    return { valid: false, error: 'Invalid PDF file format' };
  }

  // Check file size (max 50MB for our service)
  const maxSize = 50 * 1024 * 1024; // 50MB limit for better performance
  if (fileBuffer.length > maxSize) {
    return { valid: false, error: 'File size must be less than 50MB' };
  }

  // Check minimum file size (avoid empty files)
  const minSize = 1024; // 1KB minimum
  if (fileBuffer.length < minSize) {
    return { valid: false, error: 'File is too small or corrupted' };
  }

  return { valid: true };
}

/**
 * Detect mathematical content in text using pattern recognition
 */
function detectMathematicalContent(text: string, pageIndex: number): MathematicalContent[] {
  const mathematics: MathematicalContent[] = [];
  
  // Mathematical equation patterns
  const mathPatterns = [
    // LaTeX-style equations
    /\$\$([^$]+)\$\$/g,
    /\$([^$]+)\$/g,
    // Common mathematical expressions
    /(\d+\s*[+\-*/÷×]\s*\d+\s*=\s*\d+)/g,
    // Fractions
    /(\d+\/\d+)/g,
    // Square roots
    /(√\d+|√\([^)]+\))/g,
    // Exponents
    /(\d+\^[\d\+\-\*\/\(\)]+)/g,
    // Integrals
    /(∫[^∫]+d[a-zA-Z])/g,
    // Summation
    /(Σ[^Σ]+)/g,
    // Greek letters commonly used in math
    /([αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ])/g
  ];

  mathPatterns.forEach((pattern, index) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const content = match[1] || match[0];
      mathematics.push({
        content,
        type: index < 2 ? 'equation' : index < 6 ? 'formula' : 'symbol',
        page: pageIndex + 1,
        boundingBox: { x: 0, y: 0, width: 0, height: 0 }, // Would need OCR coordinates
        confidence: 0.8,
        latex: index < 2 ? content : undefined
      });
    }
  });

  return mathematics;
}

/**
 * Extract table content from Document AI table structure
 */
function extractTableContent(table: any, documentText: string, pageNumber: number): TableContent | null {
  if (!table.headerRows || !table.bodyRows) {
    return null;
  }

  const headers: string[] = [];
  const rows: string[][] = [];

  // Extract headers
  for (const headerRow of table.headerRows) {
    if (headerRow.cells) {
      const headerCells: string[] = [];
      for (const cell of headerRow.cells) {
        const cellText = extractTextFromLayout(cell.layout, documentText);
        headerCells.push(cellText.trim());
      }
      headers.push(...headerCells);
    }
  }

  // Extract body rows
  for (const bodyRow of table.bodyRows) {
    if (bodyRow.cells) {
      const rowCells: string[] = [];
      for (const cell of bodyRow.cells) {
        const cellText = extractTextFromLayout(cell.layout, documentText);
        rowCells.push(cellText.trim());
      }
      if (rowCells.some(cell => cell.length > 0)) {
        rows.push(rowCells);
      }
    }
  }

  return {
    headers,
    rows,
    page: pageNumber,
    confidence: 0.9, // Default table confidence
    isStructured: false // Add missing property
  };
}

/**
 * Extract text content from layout structure
 */
function extractTextFromLayout(layout: any, documentText: string): string {
  if (!layout?.textAnchor?.textSegments || !documentText) {
    return '';
  }

  let text = '';
  for (const segment of layout.textAnchor.textSegments) {
    if (segment.startIndex != null && segment.endIndex != null) {
      const startIdx = parseInt(segment.startIndex.toString());
      const endIdx = parseInt(segment.endIndex.toString());
      text += documentText.substring(startIdx, endIdx);
    }
  }
  return text;
}

/**
 * Extract image content information
 */
function extractImageContent(element: any, pageNumber: number): ImageContent | null {
  if (!element.layout?.boundingPoly?.normalizedVertices) {
    return null;
  }

  const vertices = element.layout.boundingPoly.normalizedVertices;
  const boundingBox = {
    x: Math.min(...vertices.map((v: any) => v.x || 0)),
    y: Math.min(...vertices.map((v: any) => v.y || 0)),
    width: Math.max(...vertices.map((v: any) => v.x || 0)) - Math.min(...vertices.map((v: any) => v.x || 0)),
    height: Math.max(...vertices.map((v: any) => v.y || 0)) - Math.min(...vertices.map((v: any) => v.y || 0))
  };

  return {
    description: element.detectedLanguages?.[0]?.languageCode || 'Unknown visual element',
    page: pageNumber,
    boundingBox,
    confidence: element.layout.confidence || 0.8,
    size: {
      width: boundingBox.width * 612, // Approximate page width
      height: boundingBox.height * 792  // Approximate page height
    },
    extractedText: element.layout.textAnchor ? 'Text detected in image' : undefined
  };
}

/**
 * Detect paragraph style based on layout properties
 */
function detectParagraphStyle(paragraph: any): string {
  // This would typically analyze font size, weight, etc.
  // For now, return a basic classification
  if (paragraph.layout?.confidence && paragraph.layout.confidence > 0.95) {
    return 'high-confidence';
  }
  return 'normal';
}

/**
 * Detect text alignment from paragraph layout
 */
function detectTextAlignment(paragraph: any): string {
  // Would analyze bounding box positions to determine alignment
  // For now, return default
  return 'left';
}

/**
 * Extract font information from paragraph
 */
function extractFontInfo(paragraph: any): FontInfo | null {
  // Document AI doesn't directly provide font info in the current API
  // This would be enhanced with more detailed analysis
  return {
    name: 'Unknown',
    size: 12,
    bold: false,
    italic: false
  };
}

/**
 * Extract style information from paragraph
 */
function extractStyleInfo(paragraph: any): StyleInfo | null {
  // Document AI doesn't directly provide style info in the current API
  // This would be enhanced with more detailed analysis
  return {
    color: '#000000',
    underlined: false,
    strikethrough: false
  };
}

/**
 * Detect column layout from pages
 */
function detectColumnLayout(pages: any[]): number {
  // Simple heuristic: if paragraphs are consistently narrow, might be multi-column
  return 1; // Default to single column
}

/**
 * Sanitize extracted content for security and quality
 */
function sanitizeExtractedContent(text: string): string {
  // Remove potentially malicious content
  let sanitized = text
    // Remove script tags and javascript
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove on* event handlers
    .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
    // Remove javascript: URLs
    .replace(/javascript:/gi, '')
    // Remove data: URLs (except safe ones)
    .replace(/data:(?!image\/(png|jpe?g|gif|svg\+xml))[^;]+;/gi, '')
    // Clean up excessive whitespace
    .replace(/\s{3,}/g, '  ')
    // Remove null bytes and other control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize line endings
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Validate encoding and fix common issues
  try {
    // Check for valid UTF-8 and fix encoding issues
    sanitized = Buffer.from(sanitized, 'utf8').toString('utf8');
  } catch (error) {
    console.warn('Content encoding issue, using cleaned version:', error);
  }

  return sanitized.trim();
}

/**
 * Enhanced error handling with categorization and recovery
 */
export function handleProcessingError(error: any): DocumentAIError {
  // Categorize and provide actionable error messages
  if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
    return new DocumentAIError('NETWORK_ERROR', 'Unable to connect to processing service. Please check your internet connection and try again.');
  }

  if (error.message?.includes('quota') || error.code === 8) {
    return new DocumentAIError('QUOTA_EXCEEDED', 'Processing quota exceeded. Please try again later or upgrade your plan.');
  }

  if (error.message?.includes('timeout') || error.code === 4) {
    return new DocumentAIError('TIMEOUT', 'Document processing timed out. The file may be too large or complex. Try reducing the file size.');
  }

  if (error.message?.includes('credentials') || error.code === 7) {
    return new DocumentAIError('AUTHENTICATION_ERROR', 'Service authentication failed. Please contact support.');
  }

  if (error.message?.includes('corrupted') || error.message?.includes('invalid')) {
    return new DocumentAIError('INVALID_DOCUMENT', 'The document appears to be corrupted or in an unsupported format.');
  }

  // Default error
  return new DocumentAIError('PROCESSING_ERROR', error.message || 'An unexpected error occurred during document processing.');
}

/**
 * Processing queue status interface
 */
export interface ProcessingQueueItem {
  id: string;
  userId: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  priority: 'low' | 'normal' | 'high';
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  progress?: number;
  errorMessage?: string;
  retryCount: number;
}

/**
 * Detect languages in the document
 */
function detectLanguages(pages: any[]): LanguageInfo {
  const languageMap = new Map<string, { confidence: number; pages: Set<number> }>();
  
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    
    // Check page-level language detection
    if (page.detectedLanguages) {
      for (const langInfo of page.detectedLanguages) {
        const langCode = langInfo.languageCode || 'unknown';
        const confidence = langInfo.confidence || 0;
        
        if (languageMap.has(langCode)) {
          const existing = languageMap.get(langCode)!;
          existing.confidence = Math.max(existing.confidence, confidence);
          existing.pages.add(pageIdx + 1);
        } else {
          languageMap.set(langCode, {
            confidence,
            pages: new Set([pageIdx + 1])
          });
        }
      }
    }
    
    // Check paragraph-level language detection
    if (page.paragraphs) {
      for (const paragraph of page.paragraphs) {
        if (paragraph.detectedLanguages) {
          for (const langInfo of paragraph.detectedLanguages) {
            const langCode = langInfo.languageCode || 'unknown';
            const confidence = langInfo.confidence || 0;
            
            if (languageMap.has(langCode)) {
              const existing = languageMap.get(langCode)!;
              existing.confidence = Math.max(existing.confidence, confidence);
              existing.pages.add(pageIdx + 1);
            } else {
              languageMap.set(langCode, {
                confidence,
                pages: new Set([pageIdx + 1])
              });
            }
          }
        }
      }
    }
  }
  
  // Convert to array and sort by confidence
  const detectedLanguages = Array.from(languageMap.entries())
    .map(([languageCode, info]) => ({
      languageCode,
      confidence: info.confidence,
      pageNumbers: Array.from(info.pages).sort((a, b) => a - b)
    }))
    .sort((a, b) => b.confidence - a.confidence);
  
  const primaryLanguage = detectedLanguages.length > 0 ? detectedLanguages[0].languageCode : 'en';
  const isMultilingual = detectedLanguages.length > 1 && 
    detectedLanguages[1].confidence > 0.5;
  
  return {
    primaryLanguage,
    detectedLanguages,
    isMultilingual
  };
}

/**
 * Assess OCR quality based on confidence scores and text characteristics
 */
function assessOCRQuality(pages: any[], averageConfidence: number): OCRQualityInfo {
  const pageConfidences: number[] = [];
  const lowConfidencePages: number[] = [];
  let totalWords = 0;
  let recognizedWords = 0;
  
  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const page = pages[pageIdx];
    let pageConfidence = 0;
    let pageConfidenceCount = 0;
    
    if (page.paragraphs) {
      for (const paragraph of page.paragraphs) {
        if (paragraph.layout?.confidence) {
          pageConfidence += paragraph.layout.confidence;
          pageConfidenceCount++;
        }
        
        // Count words for readability assessment
        if (paragraph.layout?.textAnchor) {
          const text = extractTextFromLayout(paragraph.layout, '');
          const words = text.split(/\s+/).filter(word => word.length > 0);
          totalWords += words.length;
          
          // Simple heuristic for recognized words (contains letters)
          recognizedWords += words.filter(word => /[a-zA-Z]/.test(word)).length;
        }
      }
    }
    
    const avgPageConfidence = pageConfidenceCount > 0 ? pageConfidence / pageConfidenceCount : averageConfidence;
    pageConfidences.push(avgPageConfidence);
    
    if (avgPageConfidence < 0.7) {
      lowConfidencePages.push(pageIdx + 1);
    }
  }
  
  const readabilityScore = totalWords > 0 ? (recognizedWords / totalWords) * 100 : 0;
  
  let overallQuality: 'excellent' | 'good' | 'fair' | 'poor';
  if (averageConfidence >= 0.95 && readabilityScore >= 95) {
    overallQuality = 'excellent';
  } else if (averageConfidence >= 0.85 && readabilityScore >= 85) {
    overallQuality = 'good';
  } else if (averageConfidence >= 0.70 && readabilityScore >= 70) {
    overallQuality = 'fair';
  } else {
    overallQuality = 'poor';
  }
  
  return {
    overallQuality,
    averageConfidence: Math.round(averageConfidence * 100) / 100,
    lowConfidencePages,
    readabilityScore: Math.round(readabilityScore * 100) / 100
  };
}

/**
 * Extract form data from document
 */
function extractFormData(document: any): FormData[] {
  const formDataArray: FormData[] = [];
  
  if (!document.pages) {
    return formDataArray;
  }
  
  for (let pageIdx = 0; pageIdx < document.pages.length; pageIdx++) {
    const page = document.pages[pageIdx];
    const formData: FormData = {
      fields: [],
      tables: [],
      checkboxes: []
    };
    
    // Extract form fields
    if (page.formFields) {
      for (const field of page.formFields) {
        const fieldName = extractTextFromLayout(field.fieldName?.layout, document.text || '').trim();
        const fieldValue = extractTextFromLayout(field.fieldValue?.layout, document.text || '').trim();
        
        if (fieldName || fieldValue) {
          formData.fields.push({
            fieldName,
            fieldValue,
            confidence: Math.min(
              field.fieldName?.layout?.confidence || 0,
              field.fieldValue?.layout?.confidence || 0
            ),
            page: pageIdx + 1
          });
        }
      }
    }
    
    // Extract form tables (different from regular tables)
    if (page.tables) {
      for (const table of page.tables) {
        const extractedTable = extractFormTable(table, document.text || '', pageIdx + 1);
        if (extractedTable) {
          formData.tables.push(extractedTable);
        }
      }
    }
    
    // Extract checkboxes and radio buttons
    if (page.symbols) {
      for (const symbol of page.symbols) {
        if (symbol.text === '☐' || symbol.text === '☑' || symbol.text === '○' || symbol.text === '●') {
          const isChecked = symbol.text === '☑' || symbol.text === '●';
          const name = `checkbox_${pageIdx}_${formData.checkboxes.length}`;
          
          formData.checkboxes.push({
            name,
            isChecked,
            confidence: symbol.layout?.confidence || 0.8,
            page: pageIdx + 1
          });
        }
      }
    }
    
    // Only add form data if there's actual content
    if (formData.fields.length > 0 || formData.tables.length > 0 || formData.checkboxes.length > 0) {
      formDataArray.push(formData);
    }
  }
  
  return formDataArray;
}

/**
 * Extract form table with enhanced metadata
 */
function extractFormTable(table: any, documentText: string, pageNumber: number): FormTable | null {
  const basicTable = extractTableContent(table, documentText, pageNumber);
  if (!basicTable) {
    return null;
  }
  
  // Determine table type based on content
  let tableType: 'form' | 'data' | 'invoice' | 'unknown' = 'unknown';
  
  const allText = [
    ...basicTable.headers,
    ...basicTable.rows.flat()
  ].join(' ').toLowerCase();
  
  if (allText.includes('invoice') || allText.includes('bill') || allText.includes('amount')) {
    tableType = 'invoice';
  } else if (allText.includes('name') || allText.includes('address') || allText.includes('signature')) {
    tableType = 'form';
  } else if (basicTable.rows.length > 5) {
    tableType = 'data';
  }
  
  return {
    headers: basicTable.headers,
    rows: basicTable.rows,
    page: pageNumber,
    confidence: basicTable.confidence,
    tableType
  };
}

/**
 * Enhanced table extraction with better structure detection
 */
function extractTableContentEnhanced(table: any, documentText: string, pageNumber: number): TableContent | null {
  const basicTable = extractTableContent(table, documentText, pageNumber);
  if (!basicTable) {
    return null;
  }
  
  // Calculate cell-level confidences
  const cellConfidences: number[][] = [];
  
  if (table.bodyRows) {
    for (const row of table.bodyRows) {
      const rowConfidences: number[] = [];
      if (row.cells) {
        for (const cell of row.cells) {
          const confidence = cell.layout?.confidence || 0.8;
          rowConfidences.push(confidence);
        }
      }
      cellConfidences.push(rowConfidences);
    }
  }
  
  // Calculate bounding box
  let boundingBox: BoundingBox | undefined;
  if (table.layout?.boundingPoly?.normalizedVertices) {
    const vertices = table.layout.boundingPoly.normalizedVertices;
    boundingBox = {
      x: Math.min(...vertices.map((v: any) => v.x || 0)),
      y: Math.min(...vertices.map((v: any) => v.y || 0)),
      width: Math.max(...vertices.map((v: any) => v.x || 0)) - Math.min(...vertices.map((v: any) => v.x || 0)),
      height: Math.max(...vertices.map((v: any) => v.y || 0)) - Math.min(...vertices.map((v: any) => v.y || 0))
    };
  }
  
  // Determine if table has good structure
  const isStructured = basicTable.headers.length > 0 && 
    basicTable.rows.length > 0 && 
    basicTable.rows.every(row => row.length === basicTable.headers.length);
  
  return {
    ...basicTable,
    isStructured,
    cellConfidences: cellConfidences.length > 0 ? cellConfidences : undefined,
    boundingBox
  };
}

/**
 * Advanced OCR processing with multiple processors
 */
export async function processDocumentWithOCR(
  fileBuffer: Buffer,
  enableFormParsing: boolean = false,
  mimeType: string = 'application/pdf'
): Promise<ProcessedDocument> {
  try {
    const startTime = Date.now();
    
    // Use specialized processors for better results
    const processors = [
      DOCUMENT_AI_CONFIG.processorId, // Main processor
    ];
    
    if (DOCUMENT_AI_CONFIG.ocrProcessorId) {
      processors.push(DOCUMENT_AI_CONFIG.ocrProcessorId); // OCR-specific processor
    }
    
    if (enableFormParsing && DOCUMENT_AI_CONFIG.formParserProcessorId) {
      processors.push(DOCUMENT_AI_CONFIG.formParserProcessorId); // Form parser
    }
    
    // Process with main processor first
    const mainResult = await processDocument(fileBuffer, mimeType);
    
    // If OCR quality is poor, try specialized OCR processor
    if (mainResult.ocrQuality?.overallQuality === 'poor' && DOCUMENT_AI_CONFIG.ocrProcessorId) {
      try {
        const ocrResult = await processWithSpecificProcessor(
          fileBuffer, 
          DOCUMENT_AI_CONFIG.ocrProcessorId, 
          mimeType
        );
        
        // Merge results, preferring OCR result for text quality
        if (ocrResult.ocrQuality && ocrResult.ocrQuality.averageConfidence > mainResult.ocrQuality.averageConfidence) {
          mainResult.text = ocrResult.text;
          mainResult.confidence = ocrResult.confidence;
          mainResult.ocrQuality = ocrResult.ocrQuality;
        }
      } catch (ocrError) {
        console.warn('OCR processor failed, using main result:', ocrError);
      }
    }
    
    // Add form parsing if requested
    if (enableFormParsing && DOCUMENT_AI_CONFIG.formParserProcessorId) {
      try {
        const formResult = await processWithSpecificProcessor(
          fileBuffer,
          DOCUMENT_AI_CONFIG.formParserProcessorId,
          mimeType
        );
        
        if (formResult.forms && formResult.forms.length > 0) {
          mainResult.forms = formResult.forms;
        }
      } catch (formError) {
        console.warn('Form parser failed, skipping form extraction:', formError);
      }
    }
    
    const totalProcessingTime = Date.now() - startTime;
    mainResult.processingTime = totalProcessingTime;
    
    return mainResult;
    
  } catch (error) {
    console.error('Advanced OCR processing failed:', error);
    // Fallback to basic processing
    return processDocument(fileBuffer, mimeType);
  }
}

/**
 * Process document with specific processor
 */
async function processWithSpecificProcessor(
  fileBuffer: Buffer,
  processorId: string,
  mimeType: string
): Promise<ProcessedDocument> {
  const name = `projects/${DOCUMENT_AI_CONFIG.projectId}/locations/${DOCUMENT_AI_CONFIG.location}/processors/${processorId}`;
  
  const request = {
    name,
    rawDocument: {
      content: fileBuffer,
      mimeType,
    },
  };
  
  const [result] = await client.processDocument(request);
  
  // Convert result to ProcessedDocument format
  // This is a simplified version - would need full implementation
  return {
    text: result.document?.text || '',
    pages: result.document?.pages?.length || 1,
    confidence: 0.9,
    processingTime: 0,
  };
}

/**
 * Simple in-memory processing queue (would be replaced with Redis/DB in production)
 */
class ProcessingQueue {
  private queue: ProcessingQueueItem[] = [];
  private processing: Set<string> = new Set();

  addJob(item: Omit<ProcessingQueueItem, 'id' | 'createdAt' | 'status' | 'retryCount'>): string {
    const id = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.queue.push({
      ...item,
      id,
      status: 'pending',
      createdAt: new Date(),
      retryCount: 0
    });
    
    // Sort by priority
    this.queue.sort((a, b) => {
      const priorities = { high: 3, normal: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
    
    return id;
  }

  getStatus(id: string): ProcessingQueueItem | null {
    return this.queue.find(item => item.id === id) || null;
  }

  updateProgress(id: string, progress: number): void {
    const item = this.queue.find(item => item.id === id);
    if (item) {
      item.progress = progress;
    }
  }

  markCompleted(id: string): void {
    const item = this.queue.find(item => item.id === id);
    if (item) {
      item.status = 'completed';
      item.completedAt = new Date();
      this.processing.delete(id);
    }
  }

  markFailed(id: string, error: string): void {
    const item = this.queue.find(item => item.id === id);
    if (item) {
      item.status = 'failed';
      item.errorMessage = error;
      item.completedAt = new Date();
      this.processing.delete(id);
    }
  }
}

export const processingQueue = new ProcessingQueue();

export { client as documentAIClient };