// API endpoint for merging batch processing outputs
// Combines multiple processed files into single output format

import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';
import { generateSecureDownloadLink } from '../../src/lib/downloadManager.js';
import fs from 'fs';
import path from 'path';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(req, res, 'general');
  if (!rateLimitResult.allowed) {
    return res.status(429).json({
      success: false,
      error: 'Rate limit exceeded',
      retryAfter: rateLimitResult.retryAfter
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  try {
    const { batchJobId } = req.body;

    if (!batchJobId) {
      return res.status(400).json({
        success: false,
        error: 'Missing batchJobId'
      });
    }

    // Get user from authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    // Get batch job with merge settings
    const { data: batchJob, error: jobError } = await supabase
      .from('batch_jobs')
      .select('*')
      .eq('id', batchJobId)
      .eq('user_id', user.id)
      .single();

    if (jobError || !batchJob) {
      return res.status(404).json({
        success: false,
        error: 'Batch job not found or access denied'
      });
    }

    if (!batchJob.merge_output) {
      return res.status(400).json({
        success: false,
        error: 'Batch job is not configured for merged output'
      });
    }

    if (!batchJob.merge_format) {
      return res.status(400).json({
        success: false,
        error: 'No merge format specified for batch job'
      });
    }

    // Get all completed processing records for this batch
    const { data: processedFiles, error: filesError } = await supabase
      .from('batch_files')
      .select(`
        id,
        original_filename,
        actual_pages,
        processing_record_id,
        processing_history (
          extracted_text,
          extracted_images,
          extracted_tables,
          extracted_math,
          processing_metadata
        )
      `)
      .eq('batch_job_id', batchJobId)
      .eq('status', 'completed')
      .not('processing_record_id', 'is', null)
      .order('created_at');

    if (filesError) {
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch processed files'
      });
    }

    if (!processedFiles || processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No completed files found for merging'
      });
    }

    // Create merged content based on format
    let mergedContent = '';
    let totalPages = 0;
    const fileCount = processedFiles.length;

    // Generate content based on merge format
    switch (batchJob.merge_format) {
      case 'txt':
        mergedContent = generateMergedTxt(processedFiles, batchJob);
        break;
      case 'md':
        mergedContent = generateMergedMarkdown(processedFiles, batchJob);
        break;
      case 'docx':
        mergedContent = generateMergedHtml(processedFiles, batchJob); // HTML for DOCX conversion
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Unsupported merge format'
        });
    }

    // Calculate total pages
    totalPages = processedFiles.reduce((sum, file) => sum + (file.actual_pages || 0), 0);

    // Create output file
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `batch_${batchJob.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${batchJob.merge_format}`;
    const outputDir = '/tmp/batch_outputs';
    const outputPath = path.join(outputDir, filename);

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write merged content to file
    fs.writeFileSync(outputPath, mergedContent, 'utf8');
    const fileSize = fs.statSync(outputPath).size;

    // Generate secure download token
    const downloadToken = generateSecureDownloadLink();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Store output record
    const { data: batchOutput, error: outputError } = await supabase
      .from('batch_outputs')
      .insert({
        batch_job_id: batchJobId,
        output_type: batchJob.merge_format,
        file_path: outputPath,
        file_size: fileSize,
        download_token: downloadToken,
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (outputError) {
      // Clean up file if database insert failed
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      return res.status(500).json({
        success: false,
        error: 'Failed to store output record'
      });
    }

    // Update batch job status to completed
    await supabase
      .from('batch_jobs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', batchJobId);

    // Return success with download information
    return res.status(200).json({
      success: true,
      data: {
        batchJobId,
        outputId: batchOutput.id,
        filename,
        format: batchJob.merge_format,
        fileSize,
        downloadToken,
        expiresAt: expiresAt.toISOString(),
        downloadUrl: `/api/download/${downloadToken}`,
        summary: {
          filesIncluded: fileCount,
          totalPages,
          outputFormat: batchJob.merge_format
        }
      }
    });

  } catch (error) {
    console.error('Unexpected error in batch output merging:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}

// Helper function to generate merged TXT content
function generateMergedTxt(processedFiles, batchJob) {
  let content = `# Batch Processing Results: ${batchJob.name}\n`;
  content += `Generated: ${new Date().toISOString()}\n`;
  content += `Total Files: ${processedFiles.length}\n`;
  content += `\n${'='.repeat(80)}\n\n`;

  processedFiles.forEach((file, index) => {
    const record = file.processing_history;
    content += `## File ${index + 1}: ${file.original_filename}\n`;
    content += `Pages: ${file.actual_pages || 'Unknown'}\n`;
    content += `\n${'-'.repeat(40)}\n\n`;
    content += record.extracted_text || '[No text extracted]';
    content += `\n\n${'='.repeat(80)}\n\n`;
  });

  return content;
}

// Helper function to generate merged Markdown content
function generateMergedMarkdown(processedFiles, batchJob) {
  let content = `# Batch Processing Results: ${batchJob.name}\n\n`;
  content += `**Generated:** ${new Date().toLocaleString()}\n`;
  content += `**Total Files:** ${processedFiles.length}\n`;
  content += `**Description:** ${batchJob.description || 'No description provided'}\n\n`;

  // Table of contents
  content += `## Table of Contents\n\n`;
  processedFiles.forEach((file, index) => {
    const sanitizedName = file.original_filename.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    content += `${index + 1}. [${file.original_filename}](#file-${index + 1}-${sanitizedName})\n`;
  });
  content += `\n---\n\n`;

  // Content for each file
  processedFiles.forEach((file, index) => {
    const record = file.processing_history;
    const sanitizedName = file.original_filename.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
    
    content += `## File ${index + 1}: ${file.original_filename} {#file-${index + 1}-${sanitizedName}}\n\n`;
    content += `**Pages:** ${file.actual_pages || 'Unknown'}\n`;
    content += `**File Size:** ${(file.file_size / 1024).toFixed(1)} KB\n\n`;

    // Add extracted text
    const text = record.extracted_text || '[No text extracted]';
    content += `### Extracted Text\n\n${text}\n\n`;

    // Add tables if available
    if (record.extracted_tables && record.extracted_tables.length > 0) {
      content += `### Tables\n\n`;
      record.extracted_tables.forEach((table, tableIndex) => {
        content += `#### Table ${tableIndex + 1}\n\n`;
        if (table.headers && table.data) {
          // Create markdown table
          content += `| ${table.headers.join(' | ')} |\n`;
          content += `| ${table.headers.map(() => '---').join(' | ')} |\n`;
          table.data.forEach(row => {
            content += `| ${row.join(' | ')} |\n`;
          });
        }
        content += `\n`;
      });
    }

    // Add mathematical content if available
    if (record.extracted_math && record.extracted_math.length > 0) {
      content += `### Mathematical Content\n\n`;
      record.extracted_math.forEach((math, mathIndex) => {
        content += `**${math.type || 'Expression'} ${mathIndex + 1}:** ${math.content}\n\n`;
      });
    }

    content += `---\n\n`;
  });

  return content;
}

// Helper function to generate merged HTML content (for DOCX conversion)
function generateMergedHtml(processedFiles, batchJob) {
  let content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Batch Processing Results: ${batchJob.name}</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; margin: 2cm; }
        h1 { color: #2563eb; border-bottom: 2px solid #2563eb; }
        h2 { color: #1e40af; border-bottom: 1px solid #e5e7eb; }
        .file-section { page-break-before: auto; margin-bottom: 2em; }
        .metadata { background: #f3f4f6; padding: 1em; margin-bottom: 1em; }
        table { border-collapse: collapse; width: 100%; margin: 1em 0; }
        th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; }
        th { background-color: #f9fafb; }
        .math-content { background: #fef3c7; padding: 0.5em; margin: 0.5em 0; font-family: monospace; }
        .page-break { page-break-before: always; }
    </style>
</head>
<body>`;

  content += `<h1>Batch Processing Results: ${batchJob.name}</h1>`;
  content += `<div class="metadata">`;
  content += `<p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>`;
  content += `<p><strong>Total Files:</strong> ${processedFiles.length}</p>`;
  content += `<p><strong>Description:</strong> ${batchJob.description || 'No description provided'}</p>`;
  content += `</div>`;

  processedFiles.forEach((file, index) => {
    const record = file.processing_history;
    
    if (index > 0) {
      content += `<div class="page-break"></div>`;
    }
    
    content += `<div class="file-section">`;
    content += `<h2>File ${index + 1}: ${file.original_filename}</h2>`;
    content += `<div class="metadata">`;
    content += `<p><strong>Pages:</strong> ${file.actual_pages || 'Unknown'}</p>`;
    content += `<p><strong>File Size:</strong> ${(file.file_size / 1024).toFixed(1)} KB</p>`;
    content += `</div>`;

    // Add extracted text
    const text = record.extracted_text || '[No text extracted]';
    content += `<h3>Extracted Text</h3>`;
    content += `<div>${text.replace(/\n/g, '<br>')}</div>`;

    // Add tables if available
    if (record.extracted_tables && record.extracted_tables.length > 0) {
      content += `<h3>Tables</h3>`;
      record.extracted_tables.forEach((table, tableIndex) => {
        content += `<h4>Table ${tableIndex + 1}</h4>`;
        if (table.headers && table.data) {
          content += `<table>`;
          content += `<thead><tr>${table.headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>`;
          content += `<tbody>`;
          table.data.forEach(row => {
            content += `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`;
          });
          content += `</tbody></table>`;
        }
      });
    }

    // Add mathematical content if available
    if (record.extracted_math && record.extracted_math.length > 0) {
      content += `<h3>Mathematical Content</h3>`;
      record.extracted_math.forEach((math, mathIndex) => {
        content += `<div class="math-content"><strong>${math.type || 'Expression'} ${mathIndex + 1}:</strong> ${math.content}</div>`;
      });
    }

    content += `</div>`;
  });

  content += `</body></html>`;
  return content;
}