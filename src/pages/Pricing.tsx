import React from 'react';
import { Check, Zap, Shield, Clock } from 'lucide-react';
import { PRICING_PLANS, formatPrice } from '../lib/stripe';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../hooks/useAuth';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Link } from 'react-router-dom';

const Pricing: React.FC = () => {
  const { user } = useAuth();
  const { currentPlan, createCheckoutSession, loading: subscriptionLoading } = useSubscription();

  const handleSubscribe = async (planId: 'free' | 'pro') => {
    if (!user) {
      // Redirect to login if not authenticated
      window.location.href = '/login?redirect=/pricing';
      return;
    }

    if (planId === 'free') {
      // Free plan is automatic, no need to do anything
      return;
    }

    await createCheckoutSession(planId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Choose Your Plan
            </h1>
            <p className="mt-4 text-xl text-gray-600">
              Start with our free tier or upgrade for more processing power
            </p>
          </div>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          
          {/* Free Plan */}
          <div className={`relative rounded-2xl border ${
            currentPlan === 'free' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 bg-white'
          } p-8 shadow-sm hover:shadow-md transition-shadow`}>
            {currentPlan === 'free' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Current Plan
                </span>
              </div>
            )}

            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900">
                {PRICING_PLANS.FREE.name}
              </h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">
                  {formatPrice(PRICING_PLANS.FREE.price)}
                </span>
                <span className="text-gray-500 ml-2">lifetime</span>
              </div>
              <p className="mt-4 text-gray-600">
                {PRICING_PLANS.FREE.description}
              </p>
            </div>

            <ul className="mt-8 space-y-4">
              {PRICING_PLANS.FREE.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {currentPlan === 'free' ? (
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 py-3 px-6 rounded-lg font-semibold cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe('free')}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Downgrade to Free
                </button>
              )}
            </div>
          </div>

          {/* Pro Plan */}
          <div className={`relative rounded-2xl border ${
            currentPlan === 'pro' 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-200 bg-white'
          } p-8 shadow-sm hover:shadow-md transition-shadow`}>
            {currentPlan === 'pro' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Current Plan
                </span>
              </div>
            )}

            {/* Popular badge for non-subscribers */}
            {currentPlan !== 'pro' && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-gradient-to-r from-blue-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                  Most Popular
                </span>
              </div>
            )}

            <div className="text-center">
              <h3 className="text-2xl font-bold text-gray-900">
                {PRICING_PLANS.PRO.name}
              </h3>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">
                  {formatPrice(PRICING_PLANS.PRO.price)}
                </span>
                <span className="text-gray-500 ml-2">/month</span>
              </div>
              <p className="mt-4 text-gray-600">
                {PRICING_PLANS.PRO.description}
              </p>
            </div>

            <ul className="mt-8 space-y-4">
              {PRICING_PLANS.PRO.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <Check className="h-5 w-5 text-green-500 mt-0.5 mr-3 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </li>
              ))}
            </ul>

            <div className="mt-8">
              {subscriptionLoading ? (
                <div className="w-full flex justify-center py-3">
                  <LoadingSpinner size="sm" />
                </div>
              ) : currentPlan === 'pro' ? (
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 py-3 px-6 rounded-lg font-semibold cursor-not-allowed"
                >
                  Current Plan
                </button>
              ) : (
                <button
                  onClick={() => handleSubscribe('pro')}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {user ? 'Subscribe to Pro' : 'Sign Up for Pro'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Features comparison */}
        <div className="mt-16">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Why Upgrade to Pro?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                100x More Processing
              </h3>
              <p className="text-gray-600">
                Process up to 1,000 pages per month instead of just 10 lifetime.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Priority Support
              </h3>
              <p className="text-gray-600">
                Get faster response times and dedicated customer support.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Processing History
              </h3>
              <p className="text-gray-600">
                Keep track of all your processed documents with full history.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-16 max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can cancel your Pro subscription at any time. You'll retain access until the end of your current billing period.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                What happens if I exceed my limits?
              </h3>
              <p className="text-gray-600">
                On the free plan, you can't process more than 10 pages total. Pro users get 1,000 pages per month that reset monthly.
              </p>
            </div>

            <div className="border-b border-gray-200 pb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Is my data secure?
              </h3>
              <p className="text-gray-600">
                Absolutely. We use enterprise-grade security, encrypt all data, and automatically delete processed files after extraction.
              </p>
            </div>
          </div>
        </div>

        {/* Call to action */}
        {!user && (
          <div className="mt-16 text-center">
            <div className="bg-blue-50 rounded-2xl p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Ready to get started?
              </h2>
              <p className="text-gray-600 mb-6">
                Create your free account and start converting PDFs to text today.
              </p>
              <Link
                to="/register"
                className="inline-block bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Sign Up Free
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Pricing;