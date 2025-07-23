import { loadStripe, Stripe } from '@stripe/stripe-js';

// Initialize Stripe with publishable key
let stripePromise: Promise<Stripe | null>;

export const getStripe = () => {
  if (!stripePromise) {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (!publishableKey) {
      console.error('Missing Stripe publishable key');
      return Promise.resolve(null);
    }
    stripePromise = loadStripe(publishableKey);
  }
  return stripePromise;
};

// Pricing plans configuration
export const PRICING_PLANS = {
  FREE: {
    id: 'free',
    name: 'Free',
    price: 0,
    pages: 10,
    description: '10 pages per account (lifetime)',
    features: [
      '10 pages per account',
      'PDF to text conversion',
      'Download results',
      'Email support'
    ]
  },
  PRO: {
    id: 'pro',
    name: 'Pro',
    price: 9.99,
    pages: 1000,
    description: '1000 pages per month',
    stripePriceId: 'price_1234567890', // This will be set from Stripe dashboard
    features: [
      '1000 pages per month',
      'PDF to text conversion',
      'Download results',
      'Priority email support',
      'Processing history',
      'Bulk processing'
    ]
  }
} as const;

export type PricingPlan = 'free' | 'pro';

// Stripe customer and subscription types
export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
  subscription?: StripeSubscription;
}

export interface StripeSubscription {
  id: string;
  status: 'active' | 'canceled' | 'past_due' | 'unpaid' | 'trialing';
  current_period_start: number;
  current_period_end: number;
  plan: PricingPlan;
  cancel_at_period_end: boolean;
}

// Stripe service functions
export const stripeService = {
  // Create checkout session for subscription
  async createCheckoutSession(planId: PricingPlan, userId: string): Promise<{ sessionId: string }> {
    const response = await fetch('/api/stripe/create-checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        planId,
        userId,
        successUrl: `${window.location.origin}/dashboard?success=true`,
        cancelUrl: `${window.location.origin}/pricing?canceled=true`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create checkout session');
    }

    return response.json();
  },

  // Create portal session for subscription management
  async createPortalSession(customerId: string): Promise<{ url: string }> {
    const response = await fetch('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        customerId,
        returnUrl: `${window.location.origin}/dashboard`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create portal session');
    }

    return response.json();
  },

  // Get customer subscription status
  async getSubscription(userId: string): Promise<StripeSubscription | null> {
    const response = await fetch(`/api/stripe/subscription?userId=${userId}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        return null; // No subscription found
      }
      throw new Error('Failed to fetch subscription');
    }

    return response.json();
  },

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<void> {
    const response = await fetch('/api/stripe/cancel-subscription', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscriptionId }),
    });

    if (!response.ok) {
      throw new Error('Failed to cancel subscription');
    }
  }
};

// Utility functions
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
};

export const getPlanFromSubscription = (subscription: StripeSubscription): PricingPlan => {
  return subscription.plan as PricingPlan;
};

export const isSubscriptionActive = (subscription: StripeSubscription | null): boolean => {
  if (!subscription) return false;
  return ['active', 'trialing'].includes(subscription.status);
};

export const getSubscriptionStatusText = (status: StripeSubscription['status']): string => {
  switch (status) {
    case 'active':
      return 'Active';
    case 'trialing':
      return 'Trial';
    case 'past_due':
      return 'Past Due';
    case 'canceled':
      return 'Canceled';
    case 'unpaid':
      return 'Unpaid';
    default:
      return 'Unknown';
  }
};