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

// Pay-per-use configuration
export const PRICING_CONFIG = {
  COST_PER_PAGE: 5, // 5 cents per page
  MINIMUM_CREDIT_PURCHASE: 500, // $5.00 minimum
  CREDIT_PACKAGES: [
    { amount: 500, bonus: 0, label: '$5.00' }, // $5 = 100 pages
    { amount: 1000, bonus: 100, label: '$10.00 + $1 bonus' }, // $10 + $1 bonus = 220 pages
    { amount: 2500, bonus: 500, label: '$25.00 + $5 bonus' }, // $25 + $5 bonus = 600 pages
    { amount: 5000, bonus: 1500, label: '$50.00 + $15 bonus' }, // $50 + $15 bonus = 1300 pages
  ]
} as const;

// Credit package type
export interface CreditPackage {
  amount: number;
  bonus: number;
  label: string;
}

// Stripe customer type (simplified)
export interface StripeCustomer {
  id: string;
  email: string;
  name?: string;
}

// Payment session result
export interface PaymentSession {
  sessionId: string;
  url?: string;
}

// Credit service functions
export const creditService = {
  // Create checkout session for credit purchase
  async createCreditCheckoutSession(packageAmount: number, userId: string): Promise<PaymentSession> {
    const response = await fetch('/api/stripe/create-credit-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: packageAmount,
        userId,
        successUrl: `${window.location.origin}/dashboard?credits_added=true`,
        cancelUrl: `${window.location.origin}/account-settings?canceled=true`,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create credit checkout session');
    }

    return response.json();
  },

  // Get user credit balance
  async getCreditBalance(userId: string): Promise<{ balance: number }> {
    const response = await fetch(`/api/credits/balance?userId=${userId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch credit balance');
    }

    return response.json();
  },

  // Process page charge
  async chargeForPages(userId: string, pageCount: number): Promise<{ success: boolean; newBalance: number }> {
    const response = await fetch('/api/credits/charge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId,
        pageCount,
        costPerPage: PRICING_CONFIG.COST_PER_PAGE
      }),
    });

    if (!response.ok) {
      throw new Error('Insufficient credits or payment failed');
    }

    return response.json();
  }
};

// Utility functions
export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(price);
};

// Credit utility functions
export const formatCredits = (credits: number): string => {
  return formatPrice(credits / 100); // Convert cents to dollars
};

export const calculatePagesFromCredits = (credits: number): number => {
  return Math.floor(credits / PRICING_CONFIG.COST_PER_PAGE);
};

export const calculateCreditsFromPages = (pages: number): number => {
  return pages * PRICING_CONFIG.COST_PER_PAGE;
};

export const getCreditPackageByAmount = (amount: number): CreditPackage | undefined => {
  return PRICING_CONFIG.CREDIT_PACKAGES.find(pkg => pkg.amount === amount);
};

export const getTotalCreditsWithBonus = (packageAmount: number): number => {
  const pkg = getCreditPackageByAmount(packageAmount);
  return packageAmount + (pkg?.bonus || 0);
};