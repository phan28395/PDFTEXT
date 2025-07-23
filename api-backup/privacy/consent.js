import { createClient } from '@supabase/supabase-js';
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js';
import { applyRateLimit } from '../../src/lib/rateLimit.js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * User Consent Management API
 * Handles consent for different types of data processing (GDPR compliance)
 */
export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(req, res);

  // Apply rate limiting
  const rateLimitResult = await applyRateLimit(req, res, {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // 30 requests per 15 minutes
    message: 'Too many consent requests. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  if (!rateLimitResult.success) {
    return;
  }

  if (!['GET', 'POST', 'PUT'].includes(req.method)) {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only GET, POST, and PUT requests are supported'
    });
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Valid authentication token required'
      });
    }

    const token = authHeader.split(' ')[1];
    
    // Verify the user token
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Invalid or expired authentication token'
      });
    }

    const userId = user.id;
    const userIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    // GET: Retrieve user's current consent settings
    if (req.method === 'GET') {
      const { data: consentData, error: consentError } = await supabase
        .rpc('get_user_privacy_settings', { p_user_id: userId });

      if (consentError) {
        console.error('Error fetching consent settings:', consentError);
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to retrieve consent settings'
        });
      }

      // If no consent records exist, create default ones
      if (!consentData || consentData.length === 0) {
        const defaultConsents = [
          { type: 'essential', consented: true, required: true },
          { type: 'analytics', consented: false, required: false },
          { type: 'marketing', consented: false, required: false },
          { type: 'processing', consented: true, required: true }
        ];

        for (const consent of defaultConsents) {
          await supabase.rpc('update_user_consent', {
            p_user_id: userId,
            p_consent_type: consent.type,
            p_consented: consent.consented,
            p_ip_address: userIP,
            p_user_agent: userAgent,
            p_privacy_policy_version: '1.0'
          });
        }

        // Fetch the newly created consent records
        const { data: newConsentData } = await supabase
          .rpc('get_user_privacy_settings', { p_user_id: userId });

        consentData = newConsentData;
      }

      // Add consent type descriptions and requirements
      const consentTypes = {
        essential: {
          name: 'Essential Cookies & Processing',
          description: 'Required for the website to function properly, including authentication and basic PDF processing.',
          required: true,
          category: 'necessary'
        },
        analytics: {
          name: 'Analytics & Performance',
          description: 'Help us understand how you use our service to improve performance and user experience.',
          required: false,
          category: 'analytics'
        },
        marketing: {
          name: 'Marketing & Communications',
          description: 'Allow us to send you product updates, newsletters, and promotional content.',
          required: false,
          category: 'marketing'
        },
        processing: {
          name: 'PDF Processing & Storage',
          description: 'Required to process your PDF files and store processing history for your account.',
          required: true,
          category: 'necessary'
        }
      };

      const enrichedConsent = consentData.map(consent => ({
        ...consent,
        ...consentTypes[consent.consent_type],
        can_modify: !consentTypes[consent.consent_type]?.required
      }));

      return res.status(200).json({
        consent_settings: enrichedConsent,
        privacy_policy_version: '1.0',
        last_updated: new Date().toISOString(),
        gdpr_info: {
          data_controller: 'PDF-to-Text SaaS Platform',
          contact_email: 'privacy@pdftotext.com',
          legal_basis: 'Consent (Article 6.1.a) and Legitimate Interest (Article 6.1.f)',
          rights: [
            'Right to access your data',
            'Right to rectify inaccurate data', 
            'Right to erase your data',
            'Right to restrict processing',
            'Right to data portability',
            'Right to object to processing',
            'Right to withdraw consent'
          ]
        }
      });
    }

    // POST/PUT: Update user consent
    if (req.method === 'POST' || req.method === 'PUT') {
      const { consent_type, consented, privacy_policy_version = '1.0' } = req.body;

      if (!consent_type || typeof consented !== 'boolean') {
        return res.status(400).json({
          error: 'Bad request',
          message: 'consent_type and consented (boolean) are required'
        });
      }

      // Validate consent type
      const validConsentTypes = ['essential', 'analytics', 'marketing', 'processing'];
      if (!validConsentTypes.includes(consent_type)) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Invalid consent type. Must be one of: ' + validConsentTypes.join(', ')
        });
      }

      // Prevent withdrawal of essential consent
      if ((consent_type === 'essential' || consent_type === 'processing') && !consented) {
        return res.status(400).json({
          error: 'Bad request',
          message: 'Essential and processing consent cannot be withdrawn. Consider deleting your account instead.'
        });
      }

      // Update consent using database function
      const { data: updateResult, error: updateError } = await supabase
        .rpc('update_user_consent', {
          p_user_id: userId,
          p_consent_type: consent_type,
          p_consented: consented,
          p_ip_address: userIP,
          p_user_agent: userAgent,
          p_privacy_policy_version: privacy_policy_version
        });

      if (updateError || !updateResult) {
        console.error('Error updating consent:', updateError);
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to update consent settings'
        });
      }

      // Get updated consent settings
      const { data: updatedConsent } = await supabase
        .rpc('get_user_privacy_settings', { p_user_id: userId });

      // Log the consent change in privacy audit log
      const { error: auditError } = await supabase
        .from('privacy_audit_log')
        .insert({
          user_id: userId,
          action: consented ? 'consent_granted' : 'consent_withdrawn',
          ip_address: userIP,
          user_agent: userAgent,
          metadata: {
            consent_type: consent_type,
            consented: consented,
            privacy_policy_version: privacy_policy_version,
            timestamp: new Date().toISOString(),
            method: req.method
          }
        });

      if (auditError) {
        console.error('Failed to log consent change:', auditError);
      }

      return res.status(200).json({
        message: `Consent ${consented ? 'granted' : 'withdrawn'} successfully`,
        consent_type: consent_type,
        consented: consented,
        updated_at: new Date().toISOString(),
        consent_settings: updatedConsent || []
      });
    }

  } catch (error) {
    console.error('Consent management error:', error);

    // Log the error
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          await supabase
            .from('privacy_audit_log')
            .insert({
              user_id: user.id,
              action: 'consent_management_error',
              ip_address: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
              user_agent: req.headers['user-agent'],
              metadata: { 
                timestamp: new Date().toISOString(),
                error: error.message,
                method: req.method
              }
            });
        }
      }
    } catch (auditError) {
      console.error('Failed to log consent error:', auditError);
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process consent request. Please try again later.'
    });
  }
}