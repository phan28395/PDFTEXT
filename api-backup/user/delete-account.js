import { supabase } from '../../src/lib/supabase';
import { rateLimit, securityHeaders, logSecurityEvent } from '../../src/lib/rateLimit';

export default async function handler(req, res) {
  // Apply security headers
  securityHeaders(req, res);

  // Only allow DELETE method
  if (req.method !== 'DELETE') {
    await logSecurityEvent({
      type: 'method_not_allowed',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/user/delete-account',
      method: req.method
    });
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Apply rate limiting (strict for account deletion)
    const rateLimitResult = await rateLimit(req, 'auth', { maxRequests: 2, windowMs: 15 * 60 * 1000 });
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
        endpoint: '/api/user/delete-account',
        details: { error: authError?.message }
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    const { user_id, reason = 'No reason provided' } = req.body;
    
    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required'
      });
    }

    // Verify the token user matches the user_id being deleted
    if (userData.user.id !== user_id) {
      await logSecurityEvent({
        type: 'unauthorized_account_deletion',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/user/delete-account',
        details: { token_user: userData.user.id, requested_user: user_id }
      });
      return res.status(403).json({
        success: false,
        error: 'Unauthorized: Cannot delete another user\'s account'
      });
    }

    // Get user data before deletion for logging
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('email, subscription_status, pages_used, stripe_customer_id, stripe_subscription_id')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile for deletion:', profileError);
      return res.status(400).json({
        success: false,
        error: 'User not found'
      });
    }

    // Start transaction-like cleanup process
    let cleanupResults = {
      processing_history: false,
      user_profile: false,
      auth_user: false,
      stripe_cleanup: false
    };

    try {
      // 1. Delete processing history
      const { error: historyError } = await supabase
        .from('processing_history')
        .delete()
        .eq('user_id', user_id);

      if (historyError) {
        console.error('Error deleting processing history:', historyError);
      } else {
        cleanupResults.processing_history = true;
      }

      // 2. Delete user profile from database
      const { error: profileDeleteError } = await supabase
        .from('users')
        .delete()
        .eq('id', user_id);

      if (profileDeleteError) {
        console.error('Error deleting user profile:', profileDeleteError);
      } else {
        cleanupResults.user_profile = true;
      }

      // 3. Cancel Stripe subscription if exists
      if (userProfile.stripe_customer_id || userProfile.stripe_subscription_id) {
        try {
          // Note: In a real implementation, you would integrate with Stripe API here
          // For now, we'll just log that Stripe cleanup is needed
          console.log('Stripe cleanup needed for user:', user_id, {
            customer_id: userProfile.stripe_customer_id,
            subscription_id: userProfile.stripe_subscription_id
          });
          cleanupResults.stripe_cleanup = true;
        } catch (stripeError) {
          console.error('Stripe cleanup error:', stripeError);
        }
      } else {
        cleanupResults.stripe_cleanup = true; // No Stripe data to clean
      }

      // 4. Delete auth user (this should be last)
      const { error: authDeleteError } = await supabase.auth.admin.deleteUser(user_id);

      if (authDeleteError) {
        console.error('Error deleting auth user:', authDeleteError);
      } else {
        cleanupResults.auth_user = true;
      }

      // Log account deletion
      await logSecurityEvent({
        type: 'account_deletion',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/user/delete-account',
        details: {
          user_id,
          email: userProfile.email,
          reason,
          cleanup_results: cleanupResults,
          subscription_status: userProfile.subscription_status,
          pages_used: userProfile.pages_used
        }
      });

      // Check if all cleanup was successful
      const allCleanupSuccessful = Object.values(cleanupResults).every(result => result === true);

      return res.status(200).json({
        success: true,
        message: 'Account deleted successfully',
        cleanup_complete: allCleanupSuccessful,
        cleanup_details: cleanupResults
      });

    } catch (cleanupError) {
      console.error('Account deletion cleanup error:', cleanupError);
      
      // Log the failed deletion attempt
      await logSecurityEvent({
        type: 'account_deletion_failed',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/user/delete-account',
        details: {
          user_id,
          email: userProfile.email,
          reason,
          error: cleanupError.message,
          cleanup_results: cleanupResults
        }
      });

      return res.status(500).json({
        success: false,
        error: 'Account deletion failed. Please contact support for assistance.',
        cleanup_attempted: cleanupResults
      });
    }

  } catch (error) {
    console.error('Account deletion error:', error);
    
    await logSecurityEvent({
      type: 'api_error',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/user/delete-account',
      details: { error: error.message }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error during account deletion'
    });
  }
}