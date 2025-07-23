import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { 
  AlertTriangle, 
  XCircle, 
  Heart, 
  DollarSign, 
  Star, 
  Clock,
  ArrowLeft,
  CheckCircle,
  Users,
  Zap
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { LoadingSpinner } from './LoadingSpinner';

interface CancellationReason {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  retention_offer?: {
    type: 'discount' | 'pause' | 'downgrade' | 'support';
    title: string;
    description: string;
    action: string;
  };
}

const CANCELLATION_REASONS: CancellationReason[] = [
  {
    id: 'too_expensive',
    title: 'Too expensive',
    description: 'The subscription cost is higher than I expected',
    icon: DollarSign,
    retention_offer: {
      type: 'discount',
      title: '50% Off Next 3 Months',
      description: 'We understand budget concerns. Get 50% off your next 3 months to give us another chance.',
      action: 'Apply Discount'
    }
  },
  {
    id: 'not_using_enough',
    title: 'Not using it enough',
    description: 'I don\'t process enough documents to justify the cost',
    icon: Clock,
    retention_offer: {
      type: 'downgrade',
      title: 'Switch to Pay-Per-Use',
      description: 'Only pay for what you use with our flexible pay-per-document pricing.',
      action: 'Learn More'
    }
  },
  {
    id: 'missing_features',
    title: 'Missing features I need',
    description: 'The service doesn\'t have features that are important to me',
    icon: Star,
    retention_offer: {
      type: 'support',
      title: 'Let\'s Talk About Your Needs',
      description: 'Our product team would love to hear about the features you need. Many of our best features come from user feedback.',
      action: 'Schedule Call'
    }
  },
  {
    id: 'technical_issues',
    title: 'Technical issues',
    description: 'I\'m experiencing problems with the service',
    icon: AlertTriangle,
    retention_offer: {
      type: 'support',
      title: 'Priority Support',
      description: 'Let our technical team help resolve any issues. We offer priority support to ensure you get the best experience.',
      action: 'Get Help'
    }
  },
  {
    id: 'switching_services',
    title: 'Switching to another service',
    description: 'I found another service that better fits my needs',
    icon: ArrowLeft,
    retention_offer: {
      type: 'pause',
      title: 'Pause Instead of Cancel',
      description: 'Take a break for up to 3 months. Your account will be paused and you can reactivate anytime.',
      action: 'Pause Subscription'
    }
  },
  {
    id: 'temporary_break',
    title: 'Taking a temporary break',
    description: 'I need to pause the service temporarily',
    icon: Clock,
    retention_offer: {
      type: 'pause',
      title: 'Free Subscription Pause',
      description: 'Pause your subscription for up to 6 months and reactivate when you\'re ready.',
      action: 'Pause Now'
    }
  },
  {
    id: 'other',
    title: 'Other reason',
    description: 'My reason isn\'t listed above',
    icon: XCircle
  }
];

interface CancellationStep {
  step: number;
  title: string;
  completed: boolean;
}

const CANCELLATION_STEPS: CancellationStep[] = [
  { step: 1, title: 'Reason', completed: false },
  { step: 2, title: 'Retention Offer', completed: false },
  { step: 3, title: 'Feedback', completed: false },
  { step: 4, title: 'Confirmation', completed: false }
];

export const SubscriptionCancellation: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { subscription, cancelSubscription, isActive } = useSubscription();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedReason, setSelectedReason] = useState<CancellationReason | null>(null);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [acceptedRetentionOffer, setAcceptedRetentionOffer] = useState(false);
  const [finalConfirmation, setFinalConfirmation] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [steps, setSteps] = useState(CANCELLATION_STEPS);

  const updateStepCompletion = (stepNumber: number, completed: boolean) => {
    setSteps(prevSteps => 
      prevSteps.map(step => 
        step.step === stepNumber ? { ...step, completed } : step
      )
    );
  };

  const handleReasonSelection = (reason: CancellationReason) => {
    setSelectedReason(reason);
    updateStepCompletion(1, true);
    setCurrentStep(2);
  };

  const handleRetentionOfferResponse = (accepted: boolean) => {
    setAcceptedRetentionOffer(accepted);
    updateStepCompletion(2, true);
    
    if (accepted && selectedReason?.retention_offer) {
      // Handle retention offer acceptance
      toast.success('Retention offer applied! Our team will contact you shortly.');
      onClose();
      return;
    }
    
    setCurrentStep(3);
  };

  const handleFeedbackSubmit = () => {
    updateStepCompletion(3, true);
    setCurrentStep(4);
  };

  const handleFinalCancellation = async () => {
    if (!finalConfirmation) {
      toast.error('Please confirm that you want to cancel your subscription');
      return;
    }

    setProcessing(true);
    try {
      // Submit cancellation feedback
      const feedbackData = {
        reason: selectedReason?.id,
        reason_text: selectedReason?.title,
        additional_feedback: additionalFeedback,
        retention_offer_shown: !!selectedReason?.retention_offer,
        retention_offer_accepted: acceptedRetentionOffer,
        cancellation_date: new Date().toISOString()
      };

      // Log cancellation feedback (you would implement this API endpoint)
      try {
        await fetch('/api/feedback/cancellation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedbackData)
        });
      } catch (error) {
        console.log('Feedback logging failed:', error);
        // Don't block cancellation if feedback logging fails
      }

      // Proceed with cancellation
      const result = await cancelSubscription();
      
      if (result) {
        updateStepCompletion(4, true);
        toast.success('Your subscription has been cancelled. You\'ll continue to have access until your current billing period ends.');
        
        // Close modal after showing success
        setTimeout(() => {
          onClose();
        }, 2000);
      }

    } catch (error) {
      console.error('Cancellation error:', error);
      toast.error('Failed to cancel subscription. Please try again or contact support.');
    } finally {
      setProcessing(false);
    }
  };

  const handleGoBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      updateStepCompletion(currentStep, false);
    }
  };

  if (!subscription || !isActive) {
    return (
      <div className="text-center py-8">
        <XCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Subscription</h3>
        <p className="text-gray-600">You don't have an active subscription to cancel.</p>
        <button
          onClick={onClose}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress Steps */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <React.Fragment key={step.step}>
              <div className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step.completed 
                    ? 'bg-green-500 text-white' 
                    : currentStep === step.step
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}>
                  {step.completed ? <CheckCircle className="h-4 w-4" /> : step.step}
                </div>
                <span className={`ml-2 text-sm ${
                  step.completed 
                    ? 'text-green-600 font-medium' 
                    : currentStep === step.step
                      ? 'text-blue-600 font-medium'
                      : 'text-gray-600'
                }`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${
                  steps[index + 1].completed || currentStep > step.step
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Step Content */}
      {currentStep === 1 && (
        <div>
          <div className="text-center mb-8">
            <Heart className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">We're sorry to see you go!</h2>
            <p className="text-gray-600">
              Help us understand why you're canceling so we can improve our service.
            </p>
          </div>

          <div className="space-y-3">
            {CANCELLATION_REASONS.map((reason) => {
              const IconComponent = reason.icon;
              return (
                <button
                  key={reason.id}
                  onClick={() => handleReasonSelection(reason)}
                  className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors"
                >
                  <div className="flex items-start">
                    <div className="bg-gray-100 rounded-lg p-2 mr-4">
                      <IconComponent className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{reason.title}</h3>
                      <p className="text-sm text-gray-600">{reason.description}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {currentStep === 2 && selectedReason && (
        <div>
          {selectedReason.retention_offer ? (
            <div>
              <div className="text-center mb-8">
                <Star className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Wait! We have a special offer for you</h2>
                <p className="text-gray-600">
                  Before you go, we'd like to offer you something that might address your concerns.
                </p>
              </div>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6 mb-8">
                <div className="text-center">
                  <Zap className="h-8 w-8 text-blue-600 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {selectedReason.retention_offer.title}
                  </h3>
                  <p className="text-gray-700 mb-6">
                    {selectedReason.retention_offer.description}
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      onClick={() => handleRetentionOfferResponse(true)}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                    >
                      {selectedReason.retention_offer.action}
                    </button>
                    <button
                      onClick={() => handleRetentionOfferResponse(false)}
                      className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                    >
                      No thanks, continue canceling
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-gray-600 mb-6">Thank you for letting us know your reason.</p>
              <button
                onClick={() => handleRetentionOfferResponse(false)}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue
              </button>
            </div>
          )}
        </div>
      )}

      {currentStep === 3 && (
        <div>
          <div className="text-center mb-8">
            <Users className="h-12 w-12 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">One more thing...</h2>
            <p className="text-gray-600">
              Any additional feedback would help us serve our customers better.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Additional comments (optional)
              </label>
              <textarea
                value={additionalFeedback}
                onChange={(e) => setAdditionalFeedback(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Tell us more about your experience or what we could do better..."
              />
            </div>

            <div className="flex justify-center">
              <button
                onClick={handleFeedbackSubmit}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Continue to Cancellation
              </button>
            </div>
          </div>
        </div>
      )}

      {currentStep === 4 && (
        <div>
          <div className="text-center mb-8">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Final Confirmation</h2>
            <p className="text-gray-600">
              Are you sure you want to cancel your subscription?
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-medium text-yellow-800 mb-2">What happens when you cancel:</h3>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• Your subscription will be cancelled at the end of your current billing period</li>
                  <li>• You'll continue to have access until {new Date(subscription.current_period_end * 1000).toLocaleDateString()}</li>
                  <li>• You can reactivate your subscription anytime before it ends</li>
                  <li>• Your processing history and account data will be preserved</li>
                  <li>• After cancellation, you'll be downgraded to the Free plan (10 pages lifetime)</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="final-confirmation"
                checked={finalConfirmation}
                onChange={(e) => setFinalConfirmation(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="final-confirmation" className="ml-2 text-gray-700">
                I understand and want to cancel my subscription
              </label>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={handleFinalCancellation}
                disabled={!finalConfirmation || processing}
                className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {processing ? (
                  <LoadingSpinner size="sm" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Cancel Subscription
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                disabled={processing}
                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50"
              >
                Keep Subscription
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      {currentStep > 1 && currentStep < 4 && (
        <div className="flex justify-between mt-8 pt-6 border-t">
          <button
            onClick={handleGoBack}
            className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800"
          >
            Cancel Process
          </button>
        </div>
      )}
    </div>
  );
};

export default SubscriptionCancellation;