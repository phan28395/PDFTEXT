import { downloadManager } from '../../src/lib/downloadManager.js';
import { withRateLimit, RateLimitConfigs } from '../../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../../src/lib/securityHeaders.js';

/**
 * Secure download endpoint with expiration handling
 * GET /api/download/[id]?token=<access_token>
 */
async function downloadHandler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET requests are supported' 
    });
  }
  
  try {
    // Extract link ID from URL
    const linkId = req.query.id;
    const accessToken = req.query.token;
    
    // Validate parameters
    if (!linkId || typeof linkId !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Download link ID is required'
      });
    }
    
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Access token is required'
      });
    }
    
    // Validate security constraints
    if (!isValidLinkId(linkId)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Invalid download link format'
      });
    }
    
    if (!isValidAccessToken(accessToken)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'Invalid access token format'
      });
    }
    
    // Validate download link and get file
    const validation = await downloadManager.validateAndGetFile(linkId, accessToken);
    
    if (!validation.valid) {
      // Log security events for invalid access attempts
      console.warn('Invalid download attempt:', {
        linkId,
        error: validation.error,
        ip: getClientIP(req),
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });
      
      return res.status(404).json({
        error: 'Not found',
        message: validation.error || 'Download link not found or expired'
      });
    }
    
    const { filePath, downloadLink } = validation;
    
    // Get file content
    let fileContent;
    try {
      fileContent = await downloadManager.getFileContent(filePath);
    } catch (error) {
      console.error('Failed to read file:', error);
      return res.status(500).json({
        error: 'File access error',
        message: 'Unable to access requested file'
      });
    }
    
    // Set appropriate headers for download
    res.setHeader('Content-Type', downloadLink.mimeType);
    res.setHeader('Content-Length', downloadLink.size);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(downloadLink.filename)}"`);
    
    // Security headers for downloads
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Download-Options', 'noopen');
    
    // Cache control for downloads
    res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Log successful download
    console.log('Successful download:', {
      linkId,
      filename: downloadLink.filename,
      size: downloadLink.size,
      mimeType: downloadLink.mimeType,
      userId: downloadLink.metadata?.userId,
      ip: getClientIP(req),
      timestamp: new Date().toISOString()
    });
    
    // Send file content
    res.status(200).send(fileContent);
    
  } catch (error) {
    console.error('Download API error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while processing your download request'
    });
  }
}

/**
 * Validate link ID format for security
 */
function isValidLinkId(linkId) {
  // Link ID should be alphanumeric with underscores, reasonable length
  const linkIdPattern = /^[a-zA-Z0-9_]{10,100}$/;
  return linkIdPattern.test(linkId);
}

/**
 * Validate access token format for security
 */
function isValidAccessToken(token) {
  // Access token should be hexadecimal, specific length
  const tokenPattern = /^[a-fA-F0-9]{32}$/;
  return tokenPattern.test(token);
}

/**
 * Get client IP address with proxy support
 */
function getClientIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         (req.connection?.socket ? req.connection.socket.remoteAddress : null) ||
         'unknown';
}

// Export with security middleware
export default withSecurityHeaders(SecurityConfigs.DOWNLOAD)(
  withRateLimit(RateLimitConfigs.DOWNLOAD, 'download')(downloadHandler)
);