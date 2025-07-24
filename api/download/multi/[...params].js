import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { params } = req.query;
    
    if (!params || params.length < 2) {
      return res.status(400).json({ error: 'Invalid download path' });
    }

    const [recordId, filename] = params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Get user from auth token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid authentication' });
    }
    
    // Verify user owns this processing record
    const { data: record, error: recordError } = await supabase
      .from('processing_history')
      .select('*')
      .eq('id', recordId)
      .eq('user_id', user.id)
      .single();
    
    if (recordError || !record) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    // Check if record is completed
    if (record.processing_status !== 'completed') {
      return res.status(400).json({ error: 'Processing not completed' });
    }
    
    // Get file path
    const tempDir = path.join('/tmp', recordId);
    const filePath = path.join(tempDir, filename);
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileContent = fs.readFileSync(filePath);
    
    // Determine content type
    let contentType = 'text/plain';
    let disposition = 'attachment';
    
    if (filename.endsWith('.zip')) {
      contentType = 'application/zip';
    } else if (filename.endsWith('.txt')) {
      contentType = 'text/plain; charset=utf-8';
    }
    
    // Set headers
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);
    res.setHeader('Cache-Control', 'private, no-cache');
    
    // Send file
    res.status(200).send(fileContent);
    
  } catch (error) {
    console.error('Multi-download error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}