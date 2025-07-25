import { processDocument as processDocumentAI } from '@/lib/documentai';
import { CloudinaryService } from './cloudinary';

export interface DocumentAIService {
  processFromCloudinary(publicId: string, pageRange?: { start: number; end: number }): Promise<string>;
  processFromBuffer(buffer: Buffer, mimeType?: string): Promise<string>;
}

export class DocumentAI implements DocumentAIService {
  private cloudinary: CloudinaryService;
  
  constructor() {
    this.cloudinary = new CloudinaryService();
  }
  
  /**
   * Process a document stored in Cloudinary
   */
  async processFromCloudinary(publicId: string, pageRange?: { start: number; end: number }): Promise<string> {
    // Get the PDF URL from Cloudinary
    const pdfUrl = this.cloudinary.getPDFUrl(publicId);
    
    // Fetch the PDF from Cloudinary
    const response = await fetch(pdfUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF from Cloudinary: ${response.statusText}`);
    }
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    // Process with Document AI
    const result = await processDocumentAI(buffer, 'application/pdf');
    
    // If page range is specified, extract only the relevant pages
    if (pageRange && result.structure?.paragraphs) {
      const filteredParagraphs = result.structure.paragraphs.filter(
        p => p.page >= pageRange.start && p.page <= pageRange.end
      );
      
      // Reconstruct text from filtered paragraphs
      return filteredParagraphs.map(p => p.text).join('\n\n');
    }
    
    return result.text;
  }
  
  /**
   * Process a document from a buffer
   */
  async processFromBuffer(buffer: Buffer, mimeType: string = 'application/pdf'): Promise<string> {
    const result = await processDocumentAI(buffer, mimeType);
    return result.text;
  }
}