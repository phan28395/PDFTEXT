import React from 'react';
import { CreditCard, Calendar, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { LoadingSpinner } from './LoadingSpinner';
import { PRICING_PLANS, formatPrice, getSubscriptionStatusText } from '../lib/stripe';

export const SubscriptionCard: React.FC = () => {
  const { 
    subscription, 
    loading, 
    currentPlan, 
    isActive,
    openPortal, 
    cancelSubscription,
    createCheckoutSession 
  } = useSubscription();

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-8">
          <LoadingSpinner size="md" />
        </div>
      </div>
    );
  }

  const planDetails = currentPlan === 'free' ? PRICING_PLANS.FREE : PRICING_PLANS.PRO;

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <CreditCard className="h-5 w-5 mr-2" />
            Subscription
          </h2>
          
          {/* Status badge */}
          <div className="flex items-center">
            {isActive ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                <CheckCircle className="h-4 w-4 mr-1" />
                Active
              </span>
            ) : currentPlan === 'free' ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                Free Plan
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                <XCircle className="h-4 w-4 mr-1" />
                Inactive
              </span>
            )}
          </div>
        </div>

        {/* Current plan details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              {planDetails.name} Plan
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {planDetails.description}
            </p>
          </div>

          {/* Price */}
          <div className="flex items-baseline">
            <span className="text-2xl font-bold text-gray-900">
              {formatPrice(planDetails.price)}
            </span>
            {currentPlan === 'pro' && (
              <span className="text-sm text-gray-600 ml-1">/month</span>
            )}
            {currentPlan === 'free' && (
              <span className="text-sm text-gray-600 ml-1">lifetime</span>
            )}
          </div>

          {/* Subscription details for Pro users */}
          {subscription && isActive && (
            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium text-gray-900">
                    {getSubscriptionStatusText(subscription.status)}
                  </span>
                </div>
                
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Billing period:</span>
                  <span className="font-medium text-gray-900">
                    {new Date(subscription.current_period_start * 1000).toLocaleDateString()} - {' '}
                    {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Next billing:</span>
                  <span className="font-medium text-gray-900 flex items-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                  </span>
                </div>

                {subscription.cancel_at_period_end && (
                  <div className="flex items-center text-sm text-orange-600 bg-orange-50 rounded p-2 mt-2">
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    <span>
                      Your subscription will be canceled on{' '}
                      {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Plan features */}
          <div>
            <h4 className="font-medium text-gray-900 mb-2">Plan includes:</h4>
            <ul className="text-sm text-gray-600 space-y-1">
              {planDetails.features.map((feature, index) => (
                <li key={index} className="flex items-start">
                  <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          {currentPlan === 'free' && (
            <button
              onClick={() => createCheckoutSession('pro')}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Upgrade to Pro
            </button>
          )}

          {currentPlan === 'pro' && isActive && (
            <>
              <button
                onClick={openPortal}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-200 transition-colors font-medium"
              >
                Manage Billing
              </button>
              
              {!subscription?.cancel_at_period_end && (
                <button
                  onClick={cancelSubscription}
                  className="flex-1 bg-red-50 text-red-700 py-2 px-4 rounded-md hover:bg-red-100 transition-colors font-medium"
                >
                  Cancel Subscription
                </button>
              )}
            </>
          )}

          {currentPlan === 'pro' && !isActive && (
            <button
              onClick={() => createCheckoutSession('pro')}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors font-medium"
            >
              Reactivate Pro
            </button>
          )}
        </div>

        {/* Billing portal note */}
        {currentPlan === 'pro' && isActive && (
          <p className="mt-3 text-xs text-gray-500">
            Use "Manage Billing" to update payment methods, download invoices, or view billing history.
          </p>
        )}
      </div>
    </div>
  );
};