const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { withRateLimit, RateLimitConfigs } = require('../../src/lib/rateLimit.js');
const { withSecurityHeaders, SecurityConfigs } = require('../../src/lib/securityHeaders.js');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Pricing configuration
const PRICE_IDS = {
  pro: process.env.STRIPE_PRO_PRICE_ID || 'price_1234567890', // Replace with actual price ID from Stripe
};

async function createCheckoutSessionHandler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { planId, userId, successUrl, cancelUrl } = req.body;

    // Validate request body
    if (!planId || !userId || !successUrl || !cancelUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: planId, userId, successUrl, cancelUrl' 
      });
    }

    // Validate plan ID
    if (!PRICE_IDS[planId]) {
      return res.status(400).json({ error: 'Invalid plan ID' });
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let customerId = user.stripe_customer_id;

    // Create or retrieve Stripe customer
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: {
          supabase_user_id: userId,
        },
      });

      customerId = customer.id;

      // Update user record with Stripe customer ID
      const { error: updateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: customerId })
        .eq('id', userId);

      if (updateError) {
        console.error('Failed to update user with Stripe customer ID:', updateError);
        // Continue anyway, as the customer was created successfully
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: PRICE_IDS[planId],
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        user_id: userId,
        plan_id: planId,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          plan_id: planId,
        },
      },
      // Enable customer portal access
      customer_update: {
        address: 'auto',
        name: 'auto',
      },
      // Collect billing address for tax calculation
      billing_address_collection: 'required',
      // Set up automatic tax calculation if available
      automatic_tax: {
        enabled: true,
      },
    });

    res.status(200).json({ sessionId: session.id });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    
    // Return appropriate error based on Stripe error type
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ error: 'Payment failed. Please try again.' });
    } else if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    } else if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid payment request.' });
    } else if (error.type === 'StripeAPIError') {
      return res.status(500).json({ error: 'Payment service temporarily unavailable.' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}

// Export with security middleware for payment endpoints
export default withSecurityHeaders(SecurityConfigs.PAYMENT)(
  withRateLimit(RateLimitConfigs.PAYMENT, 'stripe-checkout')(createCheckoutSessionHandler)
);