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
    const { customerId, returnUrl } = req.body;

    // Validate request body
    if (!customerId || !returnUrl) {
      return res.status(400).json({ 
        error: 'Missing required fields: customerId, returnUrl' 
      });
    }

    // Validate customer exists in Stripe
    try {
      await stripe.customers.retrieve(customerId);
    } catch (error) {
      if (error.code === 'resource_missing') {
        return res.status(404).json({ error: 'Customer not found' });
      }
      throw error;
    }

    // Create portal session
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Error creating portal session:', error);
    
    // Return appropriate error based on Stripe error type
    if (error.type === 'StripeRateLimitError') {
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    } else if (error.type === 'StripeInvalidRequestError') {
      return res.status(400).json({ error: 'Invalid request.' });
    } else if (error.type === 'StripeAPIError') {
      return res.status(500).json({ error: 'Service temporarily unavailable.' });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
}