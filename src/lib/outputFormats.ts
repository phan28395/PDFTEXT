import { ProcessedDocument, DocumentStructure, MathematicalContent, ImageContent, TableContent } from '@/types/documentai';

export interface OutputGenerationOptions {
  format: 'txt' | 'markdown' | 'docx';
  includeMetadata?: boolean;
  preserveFormatting?: boolean;
  includeImages?: boolean;
  includeTables?: boolean;
  includeMathematics?: boolean;
  customStyles?: {
    headerPrefix?: string;
    tableStyle?: 'simple' | 'grid' | 'markdown';
    mathFormat?: 'latex' | 'unicode' | 'text';
  };
}

export interface GeneratedOutput {
  content: string | Buffer;
  filename: string;
  mimeType: string;
  size: number;
  encoding?: string;
  metadata?: {
    pages: number;
    tables: number;
    images: number;
    mathematics: number;
    confidence: number;
    generatedAt: Date;
  };
}

/**
 * Main output generator class
 */
export class OutputFormatGenerator {
  constructor(private document: ProcessedDocument) {}

  /**
   * Generate output in specified format
   */
  async generate(options: OutputGenerationOptions): Promise<GeneratedOutput> {
    const validator = new OutputValidator();
    
    // Validate options
    const validationResult = validator.validateOptions(options);
    if (!validationResult.valid) {
      throw new Error(`Invalid output options: ${validationResult.errors.join(', ')}`);
    }

    let output: GeneratedOutput;

    switch (options.format) {
      case 'txt':
        output = this.generateTXT(options);
        break;
      case 'markdown':
        output = this.generateMarkdown(options);
        break;
      case 'docx':
        output = await this.generateDOCX(options);
        break;
      default:
        throw new Error(`Unsupported format: ${options.format}`);
    }

    // Validate generated output
    const outputValidation = validator.validateOutput(output);
    if (!outputValidation.valid) {
      throw new Error(`Output validation failed: ${outputValidation.errors.join(', ')}`);
    }

    return output;
  }

  /**
   * Generate TXT output with proper UTF-8 encoding
   */
  private generateTXT(options: OutputGenerationOptions): GeneratedOutput {
    const txtGenerator = new TXTGenerator(this.document, options);
    return txtGenerator.generate();
  }

  /**
   * Generate Markdown output with sanitization
   */
  private generateMarkdown(options: OutputGenerationOptions): GeneratedOutput {
    const markdownGenerator = new MarkdownGenerator(this.document, options);
    return markdownGenerator.generate();
  }

  /**
   * Generate DOCX output with formatting
   */
  private async generateDOCX(options: OutputGenerationOptions): Promise<GeneratedOutput> {
    const docxGenerator = new DOCXGenerator(this.document, options);
    return await docxGenerator.generate();
  }
}

/**
 * TXT format generator
 */
class TXTGenerator {
  constructor(
    private document: ProcessedDocument,
    private options: OutputGenerationOptions
  ) {}

  generate(): GeneratedOutput {
    let content = '';

    // Add metadata header if requested
    if (this.options.includeMetadata) {
      content += this.generateMetadataHeader();
    }

    // Add main text content
    content += this.document.text || '';

    // Add structured content if available and requested
    if (this.document.structure && this.options.includeTables) {
      content += this.formatStructuredContent();
    }

    // Add mathematical content if available and requested
    if (this.document.mathematics && this.options.includeMathematics) {
      content += this.formatMathematicalContent();
    }

    // Add image descriptions if available and requested
    if (this.document.images && this.options.includeImages) {
      content += this.formatImageContent();
    }

    // Ensure proper UTF-8 encoding and normalize content
    const normalizedContent = this.normalizeTextContent(content);
    const encodedContent = Buffer.from(normalizedContent, 'utf8').toString('utf8');

    return {
      content: encodedContent,
      filename: this.generateFilename('txt'),
      mimeType: 'text/plain; charset=utf-8',
      size: Buffer.byteLength(encodedContent, 'utf8'),
      encoding: 'utf-8',
      metadata: this.generateMetadata()
    };
  }

  private generateMetadataHeader(): string {
    const metadata = this.generateMetadata();
    return `Document Processing Report
========================
Generated: ${metadata.generatedAt.toISOString()}
Pages: ${metadata.pages}
Confidence: ${metadata.confidence}%
Tables: ${metadata.tables}
Images: ${metadata.images}
Mathematics: ${metadata.mathematics}

========================

`;
  }

  private formatStructuredContent(): string {
    if (!this.document.structure) return '';

    let content = '\n\n--- STRUCTURED CONTENT ---\n\n';

    // Format tables
    if (this.document.structure.tables.length > 0) {
      content += 'TABLES:\n';
      this.document.structure.tables.forEach((table, index) => {
        content += `\nTable ${index + 1} (Page ${table.page}):\n`;
        content += `${table.headers.join(' | ')}\n`;
        content += `${table.headers.map(() => '---').join(' | ')}\n`;
        table.rows.forEach(row => {
          content += `${row.join(' | ')}\n`;
        });
        content += '\n';
      });
    }

    // Format headers
    if (this.document.structure.headers.length > 0) {
      content += '\nHEADERS:\n';
      this.document.structure.headers.forEach(header => {
        const prefix = '#'.repeat(header.level);
        content += `${prefix} ${header.text} (Page ${header.page})\n`;
      });
    }

    return content;
  }

  private formatMathematicalContent(): string {
    if (!this.document.mathematics) return '';

    let content = '\n\n--- MATHEMATICAL CONTENT ---\n\n';
    
    this.document.mathematics.forEach((math, index) => {
      content += `Math ${index + 1} (${math.type}, Page ${math.page}):\n`;
      content += `${math.content}\n`;
      if (math.latex) {
        content += `LaTeX: ${math.latex}\n`;
      }
      content += `Confidence: ${math.confidence}\n\n`;
    });

    return content;
  }

  private formatImageContent(): string {
    if (!this.document.images) return '';

    let content = '\n\n--- IMAGES ---\n\n';
    
    this.document.images.forEach((image, index) => {
      content += `Image ${index + 1} (Page ${image.page}):\n`;
      content += `Description: ${image.description}\n`;
      content += `Size: ${image.size.width}x${image.size.height}\n`;
      content += `Confidence: ${image.confidence}\n`;
      if (image.extractedText) {
        content += `Extracted Text: ${image.extractedText}\n`;
      }
      content += '\n';
    });

    return content;
  }

  private normalizeTextContent(content: string): string {
    return content
      // Normalize line endings to Unix style
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      // Remove excessive whitespace
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      // Trim leading/trailing whitespace
      .trim();
  }

  private generateFilename(extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `document-${timestamp}.${extension}`;
  }

  private generateMetadata() {
    return {
      pages: this.document.pages,
      tables: this.document.structure?.tables.length || 0,
      images: this.document.images?.length || 0,
      mathematics: this.document.mathematics?.length || 0,
      confidence: this.document.confidence,
      generatedAt: new Date()
    };
  }
}

/**
 * Markdown format generator with sanitization
 */
class MarkdownGenerator {
  constructor(
    private document: ProcessedDocument,
    private options: OutputGenerationOptions
  ) {}

  generate(): GeneratedOutput {
    let content = '';

    // Add metadata header if requested
    if (this.options.includeMetadata) {
      content += this.generateMetadataHeader();
    }

    // Add main content with markdown formatting
    content += this.formatMainContent();

    // Add structured content
    if (this.document.structure && this.options.includeTables) {
      content += this.formatStructuredContent();
    }

    // Add mathematical content
    if (this.document.mathematics && this.options.includeMathematics) {
      content += this.formatMathematicalContent();
    }

    // Add image descriptions
    if (this.document.images && this.options.includeImages) {
      content += this.formatImageContent();
    }

    // Sanitize markdown content
    const sanitizedContent = this.sanitizeMarkdown(content);

    return {
      content: sanitizedContent,
      filename: this.generateFilename('md'),
      mimeType: 'text/markdown; charset=utf-8',
      size: Buffer.byteLength(sanitizedContent, 'utf8'),
      encoding: 'utf-8',
      metadata: this.generateMetadata()
    };
  }

  private generateMetadataHeader(): string {
    const metadata = this.generateMetadata();
    return `# Document Processing Report

- **Generated:** ${metadata.generatedAt.toISOString()}
- **Pages:** ${metadata.pages}
- **Confidence:** ${metadata.confidence}%
- **Tables:** ${metadata.tables}
- **Images:** ${metadata.images}
- **Mathematics:** ${metadata.mathematics}

---

`;
  }

  private formatMainContent(): string {
    let content = this.document.text || '';

    // If we have structure information, enhance the formatting
    if (this.document.structure?.headers) {
      // Try to identify and format headers in the main text
      this.document.structure.headers.forEach(header => {
        const escapedText = this.escapeMarkdown(header.text);
        const headerMarkdown = `${'#'.repeat(header.level)} ${escapedText}`;
        
        // Replace the header text with markdown formatted version
        content = content.replace(
          new RegExp(`^${this.escapeRegex(header.text)}$`, 'gm'),
          headerMarkdown
        );
      });
    }

    return content + '\n\n';
  }

  private formatStructuredContent(): string {
    if (!this.document.structure) return '';

    let content = '## Structured Content\n\n';

    // Format tables as markdown tables
    if (this.document.structure.tables.length > 0) {
      content += '### Tables\n\n';
      this.document.structure.tables.forEach((table, index) => {
        content += `#### Table ${index + 1} (Page ${table.page})\n\n`;
        
        // Create markdown table
        const headers = table.headers.map(h => this.escapeMarkdown(h));
        const headerRow = `| ${headers.join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
        
        content += `${headerRow}\n${separatorRow}\n`;
        
        table.rows.forEach(row => {
          const cells = row.map(cell => this.escapeMarkdown(cell));
          content += `| ${cells.join(' | ')} |\n`;
        });
        
        content += '\n';
      });
    }

    return content;
  }

  private formatMathematicalContent(): string {
    if (!this.document.mathematics) return '';

    let content = '## Mathematical Content\n\n';
    
    this.document.mathematics.forEach((math, index) => {
      content += `### Math ${index + 1} (${math.type}, Page ${math.page})\n\n`;
      
      if (math.latex && this.options.customStyles?.mathFormat === 'latex') {
        content += `$$${math.latex}$$\n\n`;
      } else {
        content += `\`${this.escapeMarkdown(math.content)}\`\n\n`;
      }
      
      content += `**Confidence:** ${math.confidence}\n\n`;
    });

    return content;
  }

  private formatImageContent(): string {
    if (!this.document.images) return '';

    let content = '## Images\n\n';
    
    this.document.images.forEach((image, index) => {
      content += `### Image ${index + 1} (Page ${image.page})\n\n`;
      content += `**Description:** ${this.escapeMarkdown(image.description)}\n\n`;
      content += `**Size:** ${image.size.width} × ${image.size.height}\n\n`;
      content += `**Confidence:** ${image.confidence}\n\n`;
      
      if (image.extractedText) {
        content += `**Extracted Text:** ${this.escapeMarkdown(image.extractedText)}\n\n`;
      }
    });

    return content;
  }

  private sanitizeMarkdown(content: string): string {
    return content
      // Remove potential script injections
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      // Remove javascript: links
      .replace(/\[([^\]]*)\]\(javascript:[^)]*\)/gi, '[$1]()')
      // Remove data: URLs except safe images
      .replace(/\[([^\]]*)\]\(data:(?!image\/(png|jpe?g|gif|svg\+xml))[^)]*\)/gi, '[$1]()')
      // Remove HTML event handlers
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '')
      // Normalize whitespace
      .replace(/\s{3,}/g, '  ')
      .trim();
  }

  private escapeMarkdown(text: string): string {
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/`/g, '\\`')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/#/g, '\\#')
      .replace(/\+/g, '\\+')
      .replace(/-/g, '\\-')
      .replace(/\./g, '\\.')
      .replace(/!/g, '\\!');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateFilename(extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `document-${timestamp}.${extension}`;
  }

  private generateMetadata() {
    return {
      pages: this.document.pages,
      tables: this.document.structure?.tables.length || 0,
      images: this.document.images?.length || 0,
      mathematics: this.document.mathematics?.length || 0,
      confidence: this.document.confidence,
      generatedAt: new Date()
    };
  }
}

/**
 * DOCX format generator with basic formatting support
 */
class DOCXGenerator {
  constructor(
    private document: ProcessedDocument,
    private options: OutputGenerationOptions
  ) {}

  async generate(): Promise<GeneratedOutput> {
    // Generate HTML content that can be converted to DOCX
    const htmlContent = this.generateHTML();
    
    // Create a simple DOCX-like XML structure
    const docxXML = this.createDOCXStructure(htmlContent);
    
    // Convert to buffer
    const content = Buffer.from(docxXML, 'utf-8');
    
    return {
      content,
      filename: this.generateFilename('docx'),
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      size: content.length,
      metadata: this.generateMetadata()
    };
  }

  private generateHTML(): string {
    let html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Document</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
        h1, h2, h3, h4, h5, h6 { color: #333; margin-top: 20px; margin-bottom: 10px; }
        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .math { background-color: #f9f9f9; padding: 5px; margin: 10px 0; font-family: monospace; }
        .image-description { background-color: #e8f4f8; padding: 10px; margin: 10px 0; border-left: 4px solid #007acc; }
        .metadata { background-color: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
    </style>
</head>
<body>`;

    // Add metadata section if requested
    if (this.options.includeMetadata) {
      html += this.generateHTMLMetadata();
    }

    // Add main content
    html += this.formatHTMLContent();

    // Add structured content
    if (this.document.structure && this.options.includeTables) {
      html += this.formatHTMLStructure();
    }

    // Add mathematical content
    if (this.document.mathematics && this.options.includeMathematics) {
      html += this.formatHTMLMathematics();
    }

    // Add image content
    if (this.document.images && this.options.includeImages) {
      html += this.formatHTMLImages();
    }

    html += '</body></html>';
    return html;
  }

  private generateHTMLMetadata(): string {
    const metadata = this.generateMetadata();
    return `
    <div class="metadata">
        <h2>Document Processing Report</h2>
        <p><strong>Generated:</strong> ${metadata.generatedAt.toISOString()}</p>
        <p><strong>Pages:</strong> ${metadata.pages}</p>
        <p><strong>Confidence:</strong> ${metadata.confidence}%</p>
        <p><strong>Tables:</strong> ${metadata.tables}</p>
        <p><strong>Images:</strong> ${metadata.images}</p>
        <p><strong>Mathematics:</strong> ${metadata.mathematics}</p>
    </div>
    `;
  }

  private formatHTMLContent(): string {
    let content = this.document.text || '';
    
    // Apply basic HTML formatting
    content = this.escapeHTML(content);
    
    // Convert line breaks to paragraphs
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    const formattedContent = paragraphs.map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('\n');
    
    // If we have structure, try to enhance formatting
    if (this.document.structure?.headers) {
      return this.enhanceWithHeaders(formattedContent);
    }
    
    return formattedContent;
  }

  private enhanceWithHeaders(content: string): string {
    if (!this.document.structure?.headers) return content;
    
    let enhanced = content;
    
    this.document.structure.headers.forEach(header => {
      const escapedText = this.escapeHTML(header.text);
      const headerTag = `h${Math.min(header.level, 6)}`;
      const regex = new RegExp(`<p>${this.escapeRegex(escapedText)}</p>`, 'gi');
      enhanced = enhanced.replace(regex, `<${headerTag}>${escapedText}</${headerTag}>`);
    });
    
    return enhanced;
  }

  private formatHTMLStructure(): string {
    if (!this.document.structure) return '';

    let html = '<h2>Structured Content</h2>';

    // Format tables
    if (this.document.structure.tables.length > 0) {
      html += '<h3>Tables</h3>';
      this.document.structure.tables.forEach((table, index) => {
        html += `<h4>Table ${index + 1} (Page ${table.page})</h4>`;
        html += '<table>';
        
        // Header row
        if (table.headers.length > 0) {
          html += '<thead><tr>';
          table.headers.forEach(header => {
            html += `<th>${this.escapeHTML(header)}</th>`;
          });
          html += '</tr></thead>';
        }
        
        // Data rows
        html += '<tbody>';
        table.rows.forEach(row => {
          html += '<tr>';
          row.forEach(cell => {
            html += `<td>${this.escapeHTML(cell)}</td>`;
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
      });
    }

    return html;
  }

  private formatHTMLMathematics(): string {
    if (!this.document.mathematics) return '';

    let html = '<h2>Mathematical Content</h2>';
    
    this.document.mathematics.forEach((math, index) => {
      html += `<h3>Math ${index + 1} (${math.type}, Page ${math.page})</h3>`;
      html += `<div class="math">`;
      
      if (math.latex && this.options.customStyles?.mathFormat === 'latex') {
        html += `<strong>LaTeX:</strong> ${this.escapeHTML(math.latex)}<br>`;
      }
      
      html += `<strong>Content:</strong> ${this.escapeHTML(math.content)}<br>`;
      html += `<strong>Confidence:</strong> ${math.confidence}`;
      html += '</div>';
    });

    return html;
  }

  private formatHTMLImages(): string {
    if (!this.document.images) return '';

    let html = '<h2>Images</h2>';
    
    this.document.images.forEach((image, index) => {
      html += `<div class="image-description">`;
      html += `<h3>Image ${index + 1} (Page ${image.page})</h3>`;
      html += `<p><strong>Description:</strong> ${this.escapeHTML(image.description)}</p>`;
      html += `<p><strong>Size:</strong> ${image.size.width} × ${image.size.height}</p>`;
      html += `<p><strong>Confidence:</strong> ${image.confidence}</p>`;
      
      if (image.extractedText) {
        html += `<p><strong>Extracted Text:</strong> ${this.escapeHTML(image.extractedText)}</p>`;
      }
      
      // Placeholder for image placement
      html += `<div style="border: 2px dashed #ccc; padding: 20px; text-align: center; margin: 10px 0;">`;
      html += `[Image Placeholder: ${this.escapeHTML(image.description)}]`;
      html += '</div>';
      
      html += '</div>';
    });

    return html;
  }

  private createDOCXStructure(htmlContent: string): string {
    // Create a simplified DOCX-like XML structure
    // In a real implementation, this would create proper Open XML format
    return `<?xml version="1.0" encoding="UTF-8"?>
<document>
    <metadata>
        <pages>${this.document.pages}</pages>
        <confidence>${this.document.confidence}</confidence>
        <generated>${new Date().toISOString()}</generated>
    </metadata>
    <content type="html">
        <![CDATA[${htmlContent}]]>
    </content>
</document>`;
  }

  private escapeHTML(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateFilename(extension: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `document-${timestamp}.${extension}`;
  }

  private generateMetadata() {
    return {
      pages: this.document.pages,
      tables: this.document.structure?.tables.length || 0,
      images: this.document.images?.length || 0,
      mathematics: this.document.mathematics?.length || 0,
      confidence: this.document.confidence,
      generatedAt: new Date()
    };
  }
}

/**
 * Output validation class
 */
class OutputValidator {
  validateOptions(options: OutputGenerationOptions): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check format
    if (!['txt', 'markdown', 'docx'].includes(options.format)) {
      errors.push(`Unsupported format: ${options.format}`);
    }

    // Validate custom styles if provided
    if (options.customStyles) {
      if (options.customStyles.tableStyle && 
          !['simple', 'grid', 'markdown'].includes(options.customStyles.tableStyle)) {
        errors.push(`Invalid table style: ${options.customStyles.tableStyle}`);
      }

      if (options.customStyles.mathFormat && 
          !['latex', 'unicode', 'text'].includes(options.customStyles.mathFormat)) {
        errors.push(`Invalid math format: ${options.customStyles.mathFormat}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  validateOutput(output: GeneratedOutput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check content exists
    if (!output.content) {
      errors.push('Output content is empty');
    }

    // Check filename
    if (!output.filename || output.filename.length === 0) {
      errors.push('Output filename is missing');
    }

    // Check MIME type
    if (!output.mimeType || output.mimeType.length === 0) {
      errors.push('Output MIME type is missing');
    }

    // Check size
    if (output.size <= 0) {
      errors.push('Output size is invalid');
    }

    // Validate text content if it's a string
    if (typeof output.content === 'string') {
      try {
        // Test UTF-8 encoding
        Buffer.from(output.content, 'utf8').toString('utf8');
      } catch (error) {
        errors.push('Content contains invalid UTF-8 characters');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

export { OutputValidator, TXTGenerator, MarkdownGenerator, DOCXGenerator };