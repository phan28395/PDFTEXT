import { supabase } from '../../src/lib/supabase';
import { rateLimit, securityHeaders, logSecurityEvent } from '../../src/lib/rateLimit';

export default async function handler(req, res) {
  // Apply security headers
  securityHeaders(req, res);

  // Only allow GET method
  if (req.method !== 'GET') {
    await logSecurityEvent({
      type: 'method_not_allowed',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/billing/history',
      method: req.method
    });
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(req, 'general');
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
        endpoint: '/api/billing/history',
        details: { error: authError?.message }
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    // Get user's Stripe customer ID
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('stripe_customer_id, email')
      .eq('id', userData.user.id)
      .single();

    if (profileError || !userProfile) {
      console.error('Error fetching user profile:', profileError);
      return res.status(404).json({
        success: false,
        error: 'User profile not found'
      });
    }

    // If no Stripe customer ID, return empty history
    if (!userProfile.stripe_customer_id) {
      return res.status(200).json({
        success: true,
        data: {
          invoices: [],
          payments: [],
          has_more: false,
          total_count: 0
        }
      });
    }

    try {
      // In a real implementation, you would use the Stripe API here
      // const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      // const invoices = await stripe.invoices.list({
      //   customer: userProfile.stripe_customer_id,
      //   limit: parseInt(req.query.limit) || 20,
      //   starting_after: req.query.starting_after || undefined
      // });

      // For now, we'll return mock data structure
      const mockBillingHistory = {
        invoices: [
          {
            id: 'in_1234567890',
            status: 'paid',
            total: 999, // Amount in cents
            currency: 'usd',
            created: Math.floor(Date.now() / 1000) - 86400 * 30, // 30 days ago
            invoice_pdf: 'https://pay.stripe.com/invoice/fake-pdf-url',
            hosted_invoice_url: 'https://invoice.stripe.com/fake-url',
            number: 'INVOICE-001',
            billing_reason: 'subscription_create',
            description: 'Pro Plan Subscription',
            period_start: Math.floor(Date.now() / 1000) - 86400 * 30,
            period_end: Math.floor(Date.now() / 1000),
            subtotal: 999,
            tax: 0,
            customer_email: userProfile.email
          }
        ],
        payments: [
          {
            id: 'pi_1234567890',
            status: 'succeeded',
            amount: 999,
            currency: 'usd',
            created: Math.floor(Date.now() / 1000) - 86400 * 30,
            description: 'Pro Plan Subscription',
            receipt_url: 'https://pay.stripe.com/receipts/fake-receipt-url',
            payment_method_types: ['card'],
            last4: '4242',
            brand: 'visa'
          }
        ],
        has_more: false,
        total_count: 1
      };

      // Log billing history access
      await logSecurityEvent({
        type: 'billing_history_accessed',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/billing/history',
        details: {
          user_id: userData.user.id,
          customer_id: userProfile.stripe_customer_id,
          invoices_count: mockBillingHistory.invoices.length,
          payments_count: mockBillingHistory.payments.length
        }
      });

      return res.status(200).json({
        success: true,
        data: mockBillingHistory
      });

    } catch (stripeError) {
      console.error('Stripe API error:', stripeError);
      
      await logSecurityEvent({
        type: 'stripe_api_error',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/billing/history',
        details: {
          user_id: userData.user.id,
          customer_id: userProfile.stripe_customer_id,
          error: stripeError.message
        }
      });

      return res.status(500).json({
        success: false,
        error: 'Failed to fetch billing history from payment provider'
      });
    }

  } catch (error) {
    console.error('Billing history error:', error);
    
    await logSecurityEvent({
      type: 'api_error',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/billing/history',
      details: { error: error.message }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}