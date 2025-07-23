import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
  CreditCard, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ArrowUp, 
  ArrowDown,
  Star,
  Users,
  Clock,
  Shield,
  Zap
} from 'lucide-react';
import { useSubscription } from '../hooks/useSubscription';
import { LoadingSpinner } from './LoadingSpinner';
import { PRICING_PLANS, formatPrice, getSubscriptionStatusText } from '../lib/stripe';

interface PlanComparisonProps {
  onSelectPlan: (planId: 'free' | 'pro') => void;
  currentPlan: 'free' | 'pro';
  loading?: boolean;
}

const PlanComparison: React.FC<PlanComparisonProps> = ({ onSelectPlan, currentPlan, loading = false }) => {
  const plans = [PRICING_PLANS.FREE, PRICING_PLANS.PRO];

  return (
    <div className="grid md:grid-cols-2 gap-6">
      {plans.map((plan) => {
        const isCurrent = plan.id === currentPlan;
        const isUpgrade = plan.id === 'pro' && currentPlan === 'free';
        const isDowngrade = plan.id === 'free' && currentPlan === 'pro';

        return (
          <div
            key={plan.id}
            className={`rounded-lg border-2 p-6 relative ${
              isCurrent 
                ? 'border-green-500 bg-green-50' 
                : plan.id === 'pro' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 bg-white'
            }`}
          >
            {isCurrent && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                  Current Plan
                </span>
              </div>
            )}
            
            {plan.id === 'pro' && !isCurrent && (
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
                  <Star className="h-3 w-3 mr-1" />
                  Recommended
                </span>
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
              <div className="mt-2">
                <span className="text-4xl font-bold text-gray-900">
                  {formatPrice(plan.price)}
                </span>
                {plan.id === 'pro' && (
                  <span className="text-gray-600">/month</span>
                )}
                {plan.id === 'free' && (
                  <span className="text-gray-600"> lifetime</span>
                )}
              </div>
              <p className="text-gray-600 mt-2">{plan.description}</p>
            </div>

            <div className="space-y-3 mb-6">
              {plan.features.map((feature, index) => (
                <div key={index} className="flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>

            {!isCurrent && (
              <button
                onClick={() => onSelectPlan(plan.id as 'free' | 'pro')}
                disabled={loading}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center ${
                  isUpgrade
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : isDowngrade
                      ? 'bg-gray-600 text-white hover:bg-gray-700'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {loading ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    {isUpgrade && <ArrowUp className="h-4 w-4 mr-2" />}
                    {isDowngrade && <ArrowDown className="h-4 w-4 mr-2" />}
                    {isUpgrade && 'Upgrade to Pro'}
                    {isDowngrade && 'Downgrade to Free'}
                    {!isUpgrade && !isDowngrade && `Switch to ${plan.name}`}
                  </>
                )}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

interface SubscriptionDetailsProps {
  subscription: any;
  currentPlan: 'free' | 'pro';
  isActive: boolean;
}

const SubscriptionDetails: React.FC<SubscriptionDetailsProps> = ({ 
  subscription, 
  currentPlan, 
  isActive 
}) => {
  const planDetails = currentPlan === 'free' ? PRICING_PLANS.FREE : PRICING_PLANS.PRO;

  return (
    <div className="bg-white rounded-lg border p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Current Subscription</h3>
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <h4 className="font-medium text-gray-900 mb-2">{planDetails.name} Plan</h4>
          <p className="text-gray-600 text-sm mb-4">{planDetails.description}</p>
          
          <div className="flex items-baseline mb-4">
            <span className="text-3xl font-bold text-gray-900">
              {formatPrice(planDetails.price)}
            </span>
            {currentPlan === 'pro' && (
              <span className="text-gray-600 ml-1">/month</span>
            )}
            {currentPlan === 'free' && (
              <span className="text-gray-600 ml-1"> lifetime</span>
            )}
          </div>

          <div className="space-y-2">
            {planDetails.features.map((feature, index) => (
              <div key={index} className="flex items-start">
                <CheckCircle className="h-4 w-4 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                <span className="text-gray-700 text-sm">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {subscription && isActive && (
          <div>
            <h4 className="font-medium text-gray-900 mb-4">Billing Information</h4>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Status:</span>
                <span className="font-medium text-gray-900">
                  {getSubscriptionStatusText(subscription.status)}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Billing cycle:</span>
                <span className="font-medium text-gray-900">Monthly</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current period:</span>
                <span className="font-medium text-gray-900">
                  {new Date(subscription.current_period_start * 1000).toLocaleDateString()} - {' '}
                  {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                </span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-gray-600 flex items-center">
                  <Calendar className="h-4 w-4 mr-1" />
                  Next billing:
                </span>
                <span className="font-medium text-gray-900">
                  {new Date(subscription.current_period_end * 1000).toLocaleDateString()}
                </span>
              </div>

              {subscription.cancel_at_period_end && (
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mt-4">
                  <div className="flex items-center text-sm text-orange-700">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>
                      Your subscription will be canceled on{' '}
                      {new Date(subscription.current_period_end * 1000).toLocaleDateString()}.
                      You'll be downgraded to the Free plan.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const SubscriptionManagement: React.FC = () => {
  const { 
    subscription, 
    loading, 
    currentPlan, 
    isActive,
    openPortal, 
    cancelSubscription,
    createCheckoutSession 
  } = useSubscription();

  const [showPlanComparison, setShowPlanComparison] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const [canceling, setCanceling] = useState(false);

  const handlePlanChange = async (planId: 'free' | 'pro') => {
    if (planId === currentPlan) return;

    setUpgrading(true);
    try {
      if (planId === 'pro') {
        // Upgrade to Pro
        await createCheckoutSession('pro');
        toast.success('Redirecting to checkout...');
      } else {
        // Downgrade to Free (cancel current subscription)
        const result = await cancelSubscription();
        if (result) {
          toast.success('Your subscription has been scheduled for cancellation. You\'ll be downgraded to Free at the end of your current billing period.');
          setShowPlanComparison(false);
        }
      }
    } catch (error) {
      console.error('Plan change error:', error);
      toast.error('Failed to change plan. Please try again.');
    } finally {
      setUpgrading(false);
    }
  };

  const handleCancelSubscription = async () => {
    setCanceling(true);
    try {
      const result = await cancelSubscription();
      if (result) {
        toast.success('Your subscription has been canceled and will end at the end of your current billing period.');
      }
    } catch (error) {
      console.error('Cancellation error:', error);
      toast.error('Failed to cancel subscription. Please try again or contact support.');
    } finally {
      setCanceling(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading subscription information...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Subscription Management</h1>
        <p className="text-gray-600">
          Manage your subscription, billing, and plan features.
        </p>
      </div>

      <div className="space-y-6">
        {/* Current Subscription Details */}
        <SubscriptionDetails 
          subscription={subscription}
          currentPlan={currentPlan}
          isActive={isActive}
        />

        {/* Action Buttons */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Plan Change */}
            <button
              onClick={() => setShowPlanComparison(!showPlanComparison)}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              {currentPlan === 'free' ? (
                <>
                  <ArrowUp className="h-4 w-4 mr-2" />
                  Upgrade Plan
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Change Plan
                </>
              )}
            </button>

            {/* Billing Portal */}
            {currentPlan === 'pro' && isActive && (
              <button
                onClick={openPortal}
                className="flex items-center justify-center px-4 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Billing
              </button>
            )}

            {/* Cancel Subscription */}
            {currentPlan === 'pro' && isActive && !subscription?.cancel_at_period_end && (
              <button
                onClick={handleCancelSubscription}
                disabled={canceling}
                className="flex items-center justify-center px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {canceling ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Plan
                  </>
                )}
              </button>
            )}

            {/* Contact Support */}
            <button
              onClick={() => window.open('mailto:support@example.com', '_blank')}
              className="flex items-center justify-center px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <Users className="h-4 w-4 mr-2" />
              Contact Support
            </button>
          </div>
        </div>

        {/* Plan Comparison */}
        {showPlanComparison && (
          <div className="bg-white rounded-lg border p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900">Choose Your Plan</h3>
              <button
                onClick={() => setShowPlanComparison(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <XCircle className="h-5 w-5" />
              </button>
            </div>
            
            <PlanComparison 
              onSelectPlan={handlePlanChange}
              currentPlan={currentPlan}
              loading={upgrading}
            />
          </div>
        )}

        {/* Usage Information */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Plan Benefits</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className="bg-blue-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h4 className="font-medium text-gray-900">Pages Included</h4>
              <p className="text-2xl font-bold text-gray-900">{PRICING_PLANS[currentPlan.toUpperCase() as keyof typeof PRICING_PLANS].pages}</p>
              <p className="text-sm text-gray-600">
                {currentPlan === 'free' ? 'Lifetime' : 'Per month'}
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <Shield className="h-8 w-8 text-green-600" />
              </div>
              <h4 className="font-medium text-gray-900">Security</h4>
              <p className="text-sm text-gray-600 mt-1">
                Enterprise-grade encryption and secure processing
              </p>
            </div>

            <div className="text-center">
              <div className="bg-purple-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
              <h4 className="font-medium text-gray-900">Support</h4>
              <p className="text-sm text-gray-600 mt-1">
                {currentPlan === 'pro' ? 'Priority' : 'Standard'} email support
              </p>
            </div>

            <div className="text-center">
              <div className="bg-orange-100 rounded-full p-3 w-16 h-16 flex items-center justify-center mx-auto mb-3">
                <Zap className="h-8 w-8 text-orange-600" />
              </div>
              <h4 className="font-medium text-gray-900">Features</h4>
              <p className="text-sm text-gray-600 mt-1">
                {currentPlan === 'pro' ? 'All features included' : 'Core features'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionManagement;