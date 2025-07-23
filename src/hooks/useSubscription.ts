import { useState, useEffect, useCallback } from 'react';
import { stripeService, StripeSubscription, PricingPlan, isSubscriptionActive } from '../lib/stripe';
import { useAuth } from './useAuth';
import toast from 'react-hot-toast';

interface UseSubscriptionReturn {
  subscription: StripeSubscription | null;
  loading: boolean;
  error: string | null;
  isActive: boolean;
  currentPlan: PricingPlan;
  refreshSubscription: () => Promise<void>;
  createCheckoutSession: (planId: PricingPlan) => Promise<void>;
  openPortal: () => Promise<void>;
  cancelSubscription: () => Promise<void>;
}

export const useSubscription = (): UseSubscriptionReturn => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<StripeSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch subscription data
  const fetchSubscription = useCallback(async () => {
    if (!user?.id) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const subscriptionData = await stripeService.getSubscription(user.id);
      setSubscription(subscriptionData);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Refresh subscription data
  const refreshSubscription = useCallback(async () => {
    setLoading(true);
    await fetchSubscription();
  }, [fetchSubscription]);

  // Create checkout session and redirect to Stripe
  const createCheckoutSession = useCallback(async (planId: PricingPlan) => {
    if (!user?.id) {
      toast.error('You must be logged in to subscribe');
      return;
    }

    if (planId === 'free') {
      toast.error('You are already on the free plan');
      return;
    }

    try {
      setError(null);
      const { sessionId } = await stripeService.createCheckoutSession(planId, user.id);
      
      // Redirect to Stripe Checkout
      const { getStripe } = await import('../lib/stripe');
      const stripeInstance = await getStripe();
      
      if (!stripeInstance) {
        throw new Error('Stripe failed to initialize');
      }

      const { error: stripeError } = await stripeInstance.redirectToCheckout({
        sessionId,
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      const message = err instanceof Error ? err.message : 'Failed to start checkout';
      setError(message);
      toast.error(message);
    }
  }, [user?.id]);

  // Open Stripe customer portal
  const openPortal = useCallback(async () => {
    const userWithStripe = user as any;
    if (!userWithStripe?.stripe_customer_id) {
      toast.error('No billing information found. Please subscribe first.');
      return;
    }

    try {
      setError(null);
      const { url } = await stripeService.createPortalSession(userWithStripe.stripe_customer_id);
      window.location.href = url;
    } catch (err) {
      console.error('Error opening portal:', err);
      const message = err instanceof Error ? err.message : 'Failed to open billing portal';
      setError(message);
      toast.error(message);
    }
  }, [user]);

  // Cancel subscription
  const cancelSubscription = useCallback(async () => {
    if (!subscription?.id) {
      toast.error('No active subscription found');
      return;
    }

    const confirmed = window.confirm(
      'Are you sure you want to cancel your subscription? It will remain active until the end of your current billing period.'
    );

    if (!confirmed) return;

    try {
      setError(null);
      await stripeService.cancelSubscription(subscription.id);
      toast.success('Subscription canceled. It will remain active until the end of your billing period.');
      await refreshSubscription();
    } catch (err) {
      console.error('Error canceling subscription:', err);
      const message = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setError(message);
      toast.error(message);
    }
  }, [subscription?.id, refreshSubscription]);

  // Load subscription on mount and when user changes
  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Determine current plan
  const currentPlan: PricingPlan = (subscription?.plan as PricingPlan) || 'free';
  const isActive = isSubscriptionActive(subscription);

  return {
    subscription,
    loading,
    error,
    isActive,
    currentPlan,
    refreshSubscription,
    createCheckoutSession,
    openPortal,
    cancelSubscription,
  };
};

// Hook for checking if user can access Pro features
export const useProAccess = () => {
  const { isActive, currentPlan, loading } = useSubscription();
  
  return {
    hasProAccess: isActive && currentPlan === 'pro',
    loading,
  };
};

// Hook for usage limits based on subscription
export const useUsageLimits = () => {
  const { currentPlan, isActive } = useSubscription();
  
  const limits = {
    free: { pages: 10, monthly: false },
    pro: { pages: 1000, monthly: true },
  };

  const currentLimit = limits[currentPlan as keyof typeof limits];
  
  return {
    maxPages: currentLimit.pages,
    isMonthly: currentLimit.monthly,
    planName: currentPlan.toUpperCase(),
    isUnlimited: isActive && currentPlan === 'pro',
  };
};