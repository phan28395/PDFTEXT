import { DocumentMetadata } from '@/types/document';

export interface CloudinaryUploadResponse {
  publicId: string;
  url: string;
  pages: number;
}

export class CloudinaryService {
  private cloudName: string;
  private uploadPreset: string;

  constructor() {
    this.cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
    this.uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
    
    if (!this.cloudName || !this.uploadPreset) {
      throw new Error('Cloudinary configuration is missing. Please check your environment variables.');
    }
  }

  async uploadPDF(file: File): Promise<CloudinaryUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', this.uploadPreset);
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/upload`,
      { method: 'POST', body: formData }
    );
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Cloudinary upload failed: ${error.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    return {
      publicId: data.public_id,
      url: data.secure_url,
      pages: data.pages || 1
    };
  }

  getPreviewUrl(publicId: string, page: number, width: number = 400): string {
    return `https://res.cloudinary.com/${this.cloudName}/image/upload/pg_${page},q_70,w_${width}/${publicId}.jpg`;
  }

  getPDFUrl(publicId: string): string {
    return `https://res.cloudinary.com/${this.cloudName}/raw/upload/${publicId}`;
  }

  async getMetadata(publicId: string): Promise<DocumentMetadata> {
    const apiKey = import.meta.env.VITE_CLOUDINARY_API_KEY;
    const apiSecret = import.meta.env.VITE_CLOUDINARY_API_SECRET;
    
    if (!apiKey || !apiSecret) {
      throw new Error('Cloudinary API credentials are missing for metadata retrieval.');
    }
    
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${this.cloudName}/resources/${publicId}`,
      {
        headers: {
          'Authorization': `Basic ${btoa(`${apiKey}:${apiSecret}`)}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Failed to fetch metadata: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      type: 'pdf',
      totalUnits: data.pages || 1,
      unitName: 'pages',
      fileName: data.original_filename || 'unknown.pdf',
      fileSize: data.bytes || 0,
    };
  }
}