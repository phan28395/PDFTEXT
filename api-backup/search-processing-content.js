import { createClient } from '@supabase/supabase-js';
import { withRateLimit, RateLimitConfigs } from '../src/lib/rateLimit.js';
import { withSecurityHeaders, SecurityConfigs } from '../src/lib/securityHeaders.js';

// Initialize Supabase client
const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verifyUserAuth(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Invalid authorization header');
  }
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);
  
  if (error || !user) {
    throw new Error('Invalid or expired token');
  }
  
  return user;
}

async function searchProcessingContentHandler(req, res) {
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
    // Verify authentication
    const authHeader = req.headers.authorization;
    let user;
    try {
      user = await verifyUserAuth(authHeader);
    } catch (authError) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or missing authentication token'
      });
    }

    const {
      type,
      searchTerm,
      mathType,
      recordId,
      page,
      limit = 20,
      daysBack = 30
    } = req.query;

    // Validate search type
    if (!['mathematics', 'images', 'structure', 'quality', 'text'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid search type',
        message: 'Search type must be one of: mathematics, images, structure, quality, text'
      });
    }

    let searchResults = {};

    switch (type) {
      case 'mathematics':
        const { data: mathResults, error: mathError } = await supabase.rpc(
          'search_mathematical_content',
          {
            user_uuid: user.id,
            search_term: searchTerm || null,
            math_type: mathType || null
          }
        );

        if (mathError) throw mathError;

        searchResults = {
          type: 'mathematics',
          results: mathResults || [],
          totalCount: mathResults?.length || 0,
          searchTerm,
          mathType
        };
        break;

      case 'images':
        const { data: imageResults, error: imageError } = await supabase.rpc(
          'search_image_content',
          {
            user_uuid: user.id,
            search_description: searchTerm || null
          }
        );

        if (imageError) throw imageError;

        searchResults = {
          type: 'images',
          results: imageResults || [],
          totalCount: imageResults?.length || 0,
          searchTerm
        };
        break;

      case 'structure':
        if (!recordId) {
          return res.status(400).json({
            error: 'Missing record ID',
            message: 'Record ID is required for structure analysis'
          });
        }

        const { data: structureResults, error: structureError } = await supabase.rpc(
          'get_document_structure',
          {
            user_uuid: user.id,
            record_uuid: recordId
          }
        );

        if (structureError) throw structureError;

        searchResults = {
          type: 'structure',
          results: structureResults || [],
          recordId
        };
        break;

      case 'quality':
        const { data: qualityResults, error: qualityError } = await supabase.rpc(
          'get_processing_quality_metrics',
          {
            user_uuid: user.id,
            days_back: parseInt(daysBack)
          }
        );

        if (qualityError) throw qualityError;

        searchResults = {
          type: 'quality',
          results: qualityResults || [],
          daysBack: parseInt(daysBack)
        };
        break;

      case 'text':
        // Full-text search across processing records
        let query = supabase
          .from('processing_history')
          .select('id, filename, text_content, confidence_score, created_at, pages_processed')
          .eq('user_id', user.id)
          .eq('status', 'completed')
          .order('created_at', { ascending: false });

        if (searchTerm) {
          query = query.ilike('text_content', `%${searchTerm}%`);
        }

        if (page && parseInt(page) > 1) {
          const offset = (parseInt(page) - 1) * parseInt(limit);
          query = query.range(offset, offset + parseInt(limit) - 1);
        } else {
          query = query.limit(parseInt(limit));
        }

        const { data: textResults, error: textError, count } = await query;

        if (textError) throw textError;

        // Extract matching snippets
        const resultsWithSnippets = textResults?.map(record => {
          let snippet = '';
          if (searchTerm && record.text_content) {
            const lowerText = record.text_content.toLowerCase();
            const lowerTerm = searchTerm.toLowerCase();
            const index = lowerText.indexOf(lowerTerm);
            
            if (index !== -1) {
              const start = Math.max(0, index - 100);
              const end = Math.min(record.text_content.length, index + searchTerm.length + 100);
              snippet = record.text_content.substring(start, end);
              
              if (start > 0) snippet = '...' + snippet;
              if (end < record.text_content.length) snippet = snippet + '...';
            }
          }

          return {
            ...record,
            snippet,
            text_content: undefined // Don't send full content in search results
          };
        }) || [];

        searchResults = {
          type: 'text',
          results: resultsWithSnippets,
          totalCount: count || resultsWithSnippets.length,
          searchTerm,
          page: parseInt(page) || 1,
          limit: parseInt(limit)
        };
        break;

      default:
        return res.status(400).json({
          error: 'Invalid search type',
          message: 'Unsupported search type'
        });
    }

    // Add performance metadata
    const searchTime = req.startTime ? Date.now() - req.startTime : 0;
    searchResults.metadata = {
      searchTime,
      userId: user.id,
      timestamp: new Date().toISOString()
    };

    res.status(200).json({
      success: true,
      data: searchResults
    });

  } catch (error) {
    console.error('Search processing content API error:', error);
    
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while searching',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Add start time tracking
const originalHandler = searchProcessingContentHandler;
const timedHandler = async (req, res) => {
  req.startTime = Date.now();
  return originalHandler(req, res);
};

// Export with security middleware
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'search-processing-content')(timedHandler)
);