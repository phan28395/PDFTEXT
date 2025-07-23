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

// Price ID to plan mapping
const PRICE_TO_PLAN = {
  [process.env.STRIPE_PRO_PRICE_ID || 'price_1234567890']: 'pro',
};

async function subscriptionHandler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'Missing userId parameter' });
    }

    // Get user from database
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, email, stripe_customer_id')
      .eq('id', userId)
      .single();

    if (userError || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // If user has no Stripe customer ID, they have no subscription
    if (!user.stripe_customer_id) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    // Get subscriptions for the customer
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripe_customer_id,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    const subscription = subscriptions.data[0];
    const priceId = subscription.items.data[0]?.price.id;
    const planId = PRICE_TO_PLAN[priceId] || 'free';

    // Format subscription data
    const subscriptionData = {
      id: subscription.id,
      status: subscription.status,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      plan: planId,
      cancel_at_period_end: subscription.cancel_at_period_end,
    };

    res.status(200).json(subscriptionData);

  } catch (error) {
    console.error('Error fetching subscription:', error);
    
    // Return appropriate error based on Stripe error type
    if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    } else if (error.type === 'StripeAPIError') {
      return res.status(500).json({ error: 'Service temporarily unavailable.' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}

// Export with security middleware
export default withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'stripe-subscription')(subscriptionHandler)
);