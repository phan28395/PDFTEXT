import { supabase } from '../../src/lib/supabase';
import { rateLimit, securityHeaders, logSecurityEvent } from '../../src/lib/rateLimit';

export default async function handler(req, res) {
  // Apply security headers
  securityHeaders(req, res);

  // Only allow PUT method
  if (req.method !== 'PUT') {
    await logSecurityEvent({
      type: 'method_not_allowed',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/user/update-profile',
      method: req.method
    });
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(req, 'auth');
    if (!rateLimitResult.success) {
      return res.status(rateLimitResult.status).json({
        success: false,
        error: rateLimitResult.error
      });
    }

    // Get authorization token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      await logSecurityEvent({
        type: 'unauthorized_access',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/user/update-profile',
        details: { error: authError?.message }
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    const { full_name, email } = req.body;
    const user_id = userData.user.id;

    // Validate input
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    if (full_name && (typeof full_name !== 'string' || full_name.length > 100)) {
      return res.status(400).json({
        success: false,
        error: 'Full name must be a string with maximum 100 characters'
      });
    }

    // Sanitize full_name
    const sanitizedFullName = full_name ? full_name.trim().replace(/[<>\"'&]/g, '') : null;

    try {
      // Update user profile in database
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (sanitizedFullName !== undefined) {
        updateData.full_name = sanitizedFullName || null;
      }

      if (email && email !== userData.user.email) {
        updateData.email = email;
      }

      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user_id)
        .select()
        .single();

      if (error) {
        console.error('Database update error:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to update profile in database'
        });
      }

      // Update email in Supabase Auth if it changed
      let emailUpdateResult = { success: true };
      if (email && email !== userData.user.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: email
        });

        if (emailError) {
          console.error('Email update error:', emailError);
          emailUpdateResult = { success: false, error: emailError.message };
        }
      }

      // Log successful profile update
      await logSecurityEvent({
        type: 'profile_updated',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/user/update-profile',
        details: {
          user_id,
          updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
          email_changed: email && email !== userData.user.email,
          email_update_success: emailUpdateResult.success
        }
      });

      return res.status(200).json({
        success: true,
        data: data,
        email_update: emailUpdateResult,
        message: email && email !== userData.user.email 
          ? 'Profile updated successfully. Please check your email to verify the new address.'
          : 'Profile updated successfully'
      });

    } catch (dbError) {
      console.error('Profile update database error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error during profile update'
      });
    }

  } catch (error) {
    console.error('Profile update error:', error);
    
    await logSecurityEvent({
      type: 'api_error',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/user/update-profile',
      details: { error: error.message }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}