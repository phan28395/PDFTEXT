// Document AI service that calls the API instead of using the library directly
import { CloudinaryService } from './cloudinary';

export interface DocumentAIService {
  processFromCloudinary(publicId: string, pageRange?: { start: number; end: number }): Promise<string>;
}

export class DocumentAI implements DocumentAIService {
  private cloudinary: CloudinaryService;
  
  constructor() {
    this.cloudinary = new CloudinaryService();
  }
  
  /**
   * Process a document stored in Cloudinary
   * This should call the API endpoint, not process directly
   */
  async processFromCloudinary(publicId: string, pageRange?: { start: number; end: number }): Promise<string> {
    // This is a placeholder - in reality, this should call your API endpoint
    // The API endpoint should handle the actual Document AI processing
    
    console.warn('DocumentAI.processFromCloudinary should call the API endpoint, not process directly');
    
    // For now, return a placeholder
    return `Text extraction should be handled by the API endpoint. Cloudinary public ID: ${publicId}`;
  }
}