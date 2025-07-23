const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');
const { withSecurityHeaders, SecurityConfigs } = require('../../src/lib/securityHeaders.js');

// Initialize Stripe with secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

// Initialize Supabase client
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Webhook endpoint secret
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

async function webhookHandler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  console.log('Received webhook event:', event.type);

  try {
    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });

  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

// Handle successful checkout session completion
async function handleCheckoutCompleted(session) {
  console.log('Checkout completed:', session.id);

  const userId = session.metadata?.user_id;
  const planId = session.metadata?.plan_id;

  if (!userId) {
    console.error('No user_id in checkout session metadata');
    return;
  }

  try {
    // Update user subscription status
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: 'active',
        subscription_plan: planId || 'pro',
        stripe_customer_id: session.customer,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error updating user subscription:', error);
    } else {
      console.log(`User ${userId} subscription activated`);
    }

    // Reset usage counter for new subscription
    await resetUserUsage(userId);

  } catch (error) {
    console.error('Error handling checkout completion:', error);
  }
}

// Handle subscription updates (renewals, upgrades, etc.)
async function handleSubscriptionUpdate(subscription) {
  console.log('Subscription updated:', subscription.id);

  const userId = subscription.metadata?.user_id;
  
  if (!userId) {
    // Try to find user by customer ID
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('stripe_customer_id', subscription.customer)
      .single();
    
    if (!user) {
      console.error('No user found for subscription update');
      return;
    }
  }

  try {
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: subscription.status,
        subscription_plan: subscription.metadata?.plan_id || 'pro',
        updated_at: new Date().toISOString(),
      })
      .eq(userId ? 'id' : 'stripe_customer_id', userId || subscription.customer);

    if (error) {
      console.error('Error updating subscription:', error);
    } else {
      console.log(`Subscription ${subscription.id} updated`);
    }

    // Reset usage if subscription is active/renewed
    if (subscription.status === 'active') {
      await resetUserUsage(userId || user.id);
    }

  } catch (error) {
    console.error('Error handling subscription update:', error);
  }
}

// Handle subscription deletion/cancellation
async function handleSubscriptionDeleted(subscription) {
  console.log('Subscription deleted:', subscription.id);

  try {
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: 'canceled',
        subscription_plan: 'free',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', subscription.customer);

    if (error) {
      console.error('Error handling subscription deletion:', error);
    } else {
      console.log(`Subscription ${subscription.id} canceled`);
    }

  } catch (error) {
    console.error('Error handling subscription deletion:', error);
  }
}

// Handle successful payment
async function handlePaymentSucceeded(invoice) {
  console.log('Payment succeeded:', invoice.id);

  // If this is a subscription renewal, reset usage
  if (invoice.billing_reason === 'subscription_cycle') {
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    const userId = subscription.metadata?.user_id;

    if (userId) {
      await resetUserUsage(userId);
      console.log(`Usage reset for user ${userId} after renewal`);
    }
  }
}

// Handle failed payment
async function handlePaymentFailed(invoice) {
  console.log('Payment failed:', invoice.id);

  try {
    // Update user status to reflect payment failure
    const { error } = await supabase
      .from('users')
      .update({
        subscription_status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_customer_id', invoice.customer);

    if (error) {
      console.error('Error updating user after payment failure:', error);
    }

    // TODO: Send email notification about failed payment
    // TODO: Implement grace period logic

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// Helper function to reset user usage counter
async function resetUserUsage(userId) {
  try {
    const { error } = await supabase
      .from('users')
      .update({
        pages_processed_this_month: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    if (error) {
      console.error('Error resetting user usage:', error);
    }
  } catch (error) {
    console.error('Error in resetUserUsage:', error);
  }
}

// Configure to handle raw body for webhook signature verification
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb',
    },
  },
};

// Export with security headers (no rate limiting for webhooks as Stripe has its own retry logic)
export default withSecurityHeaders(SecurityConfigs.API)(webhookHandler);