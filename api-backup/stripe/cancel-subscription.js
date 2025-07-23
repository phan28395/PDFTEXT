const Stripe = require('stripe');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { subscriptionId } = req.body;

    // Validate request body
    if (!subscriptionId) {
      return res.status(400).json({ 
        error: 'Missing required field: subscriptionId' 
      });
    }

    // Cancel subscription at period end (don't cancel immediately)
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    res.status(200).json({ 
      success: true,
      message: 'Subscription will be canceled at the end of the current billing period',
      cancel_at: subscription.cancel_at,
      current_period_end: subscription.current_period_end,
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    
    // Return appropriate error based on Stripe error type
    if (error.code === 'resource_missing') {
      return res.status(404).json({ error: 'Subscription not found' });
    } else if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    } else if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid request.' });
    } else if (error.type === 'StripeAPIError') {
      return res.status(500).json({ error: 'Service temporarily unavailable.' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}