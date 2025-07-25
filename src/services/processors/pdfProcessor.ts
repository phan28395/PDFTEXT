import { DocumentProcessor, DocumentMetadata, SelectionRange, PreviewData } from '@/types/document';
import { CloudinaryService } from '@/services/cloudinary';
import { DocumentAI } from '@/services/documentai';

export class PDFProcessor implements DocumentProcessor {
  private cloudinary: CloudinaryService;
  private documentAI: DocumentAI;
  
  constructor() {
    this.cloudinary = new CloudinaryService();
    this.documentAI = new DocumentAI();
  }
  
  async analyze(file: File): Promise<DocumentMetadata> {
    // Upload PDF to Cloudinary
    const { publicId, pages } = await this.cloudinary.uploadPDF(file);
    
    return {
      type: 'pdf',
      totalUnits: pages,
      unitName: 'pages',
      fileName: file.name,
      fileSize: file.size,
      cloudinaryPublicId: publicId
    };
  }
  
  async generatePreview(file: File | any, range: SelectionRange): Promise<PreviewData> {
    // If file has cloudinaryPublicId, it's already uploaded
    const publicId = file.cloudinaryPublicId || (await this.cloudinary.uploadPDF(file)).publicId;
    const metadata = file.cloudinaryPublicId ? file : await this.analyze(file);
    
    // Generate preview URLs for the requested range
    const units = [];
    const start = range.start;
    const end = range.end;
    
    // Show first page
    units.push({
      index: start,
      imageUrl: this.cloudinary.getPreviewUrl(publicId, start),
      thumbnail: this.cloudinary.getPreviewUrl(publicId, start, 200)
    });
    
    // If range spans multiple pages, add gap indicator
    if (end - start > 1) {
      units.push({
        index: -1,
        imageUrl: '',
        thumbnail: '',
        isGap: true,
        startPage: start + 1,
        endPage: end - 1,
        count: end - start - 1
      });
    }
    
    // Show last page if different from first
    if (end > start) {
      units.push({
        index: end,
        imageUrl: this.cloudinary.getPreviewUrl(publicId, end),
        thumbnail: this.cloudinary.getPreviewUrl(publicId, end, 200)
      });
    }
    
    return {
      units,
      processingTime: Date.now()
    };
  }
  
  async processPages(publicId: string, startPage: number, endPage: number): Promise<string> {
    // Process the specified page range using Document AI
    return await this.documentAI.processFromCloudinary(publicId, {
      start: startPage,
      end: endPage
    });
  }
  
  estimateCost(metadata: DocumentMetadata, range: SelectionRange): number {
    const units = range.all ? metadata.totalUnits : (range.end - range.start + 1);
    return units * 0.012; // $0.012 per page
  }
}