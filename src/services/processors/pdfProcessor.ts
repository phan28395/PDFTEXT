import { DocumentProcessor, DocumentMetadata, SelectionRange, PreviewData } from '@/types/document';
import { createClient } from '@supabase/supabase-js';

export class PDFProcessor implements DocumentProcessor {
  private supabase;
  
  constructor() {
    this.supabase = createClient(
      import.meta.env.VITE_SUPABASE_URL || '',
      import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    );
  }
  
  async analyze(file: File): Promise<DocumentMetadata> {
    // First upload the file to Supabase Storage
    const fileName = `temp/${Date.now()}-${file.name}`;
    const { error: uploadError } = await this.supabase.storage
      .from('pdfs')
      .upload(fileName, file);
    
    if (uploadError) throw uploadError;
    
    // Call Supabase Edge Function to analyze
    const { data, error } = await this.supabase.functions.invoke('process-pdf', {
      body: { 
        action: 'analyze',
        fileName 
      }
    });
    
    if (error) throw error;
    
    // Store the fileName for later use
    (data as any).storagePath = fileName;
    
    return data;
  }
  
  async generatePreview(file: File | any, range: SelectionRange): Promise<PreviewData> {
    // If file has storagePath, it's already uploaded
    const fileName = file.storagePath || await this.uploadFile(file);
    
    // Call Supabase Edge Function
    const { data, error } = await this.supabase.functions.invoke('process-pdf', {
      body: { 
        action: 'preview',
        fileName,
        range 
      }
    });
    
    if (error) throw error;
    
    return data;
  }
  
  private async uploadFile(file: File): Promise<string> {
    const fileName = `temp/${Date.now()}-${file.name}`;
    const { error } = await this.supabase.storage
      .from('pdfs')
      .upload(fileName, file);
    
    if (error) throw error;
    
    return fileName;
  }
  
  estimateCost(metadata: DocumentMetadata, range: SelectionRange): number {
    const units = range.all ? metadata.totalUnits : (range.end - range.start + 1);
    return units * 0.012; // $0.012 per page
  }
}