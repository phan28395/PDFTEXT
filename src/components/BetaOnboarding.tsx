import React, { useState } from 'react';
import { Check, ArrowRight, ArrowLeft, Upload, FileText, BarChart3, Settings, Star } from 'lucide-react';
import { useBetaTesting } from '../hooks/useBetaTesting';

interface BetaOnboardingProps {
  onComplete: () => void;
}

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  content: React.ReactNode;
}

export default function BetaOnboarding({ onComplete }: BetaOnboardingProps) {
  const { joinBeta } = useBetaTesting();
  const [currentStep, setCurrentStep] = useState(0);
  const [invitationCode, setInvitationCode] = useState('');
  const [userType, setUserType] = useState<'individual' | 'business' | 'developer'>('individual');
  const [testingGoals, setTestingGoals] = useState<string[]>([]);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState('');

  const availableGoals = [
    'Test PDF processing accuracy',
    'Evaluate performance and speed',
    'Test payment and subscription flow',
    'Provide UI/UX feedback',
    'Test mobile responsiveness',
    'Evaluate API functionality',
    'Test security features',
    'Provide general feedback'
  ];

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to Beta Testing!',
      description: 'Help us build the best PDF-to-text platform',
      icon: Star,
      content: (
        <div className="text-center space-y-6">
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
            <Star className="h-12 w-12 text-blue-600" />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Thank you for joining our beta program!
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              As a beta tester, you'll get early access to new features and help shape the future of our platform. 
              Your feedback is invaluable to us.
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">What to expect:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Early access to new features</li>
              <li>• Direct communication with our development team</li>
              <li>• Opportunity to influence product direction</li>
              <li>• Special beta tester benefits</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'invitation',
      title: 'Enter Invitation Code',
      description: 'Verify your beta access',
      icon: Settings,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <Settings className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Enter Your Invitation Code</h3>
            <p className="text-gray-600">
              Please enter the invitation code you received to join the beta program.
            </p>
          </div>
          <div>
            <label htmlFor="invitation-code" className="block text-sm font-medium text-gray-700 mb-2">
              Invitation Code
            </label>
            <input
              type="text"
              id="invitation-code"
              value={invitationCode}
              onChange={(e) => setInvitationCode(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono"
              placeholder="XXXX-XXXX-XXXX"
              maxLength={12}
            />
            {error && (
              <p className="mt-2 text-sm text-red-600">{error}</p>
            )}
          </div>
        </div>
      )
    },
    {
      id: 'profile',
      title: 'Tell Us About Yourself',
      description: 'Help us understand your needs',
      icon: Settings,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <Settings className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">User Profile</h3>
            <p className="text-gray-600">
              This helps us tailor the beta experience to your needs.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              I am a:
            </label>
            <div className="space-y-3">
              {[
                { value: 'individual', label: 'Individual User', description: 'Personal use and small projects' },
                { value: 'business', label: 'Business User', description: 'Company or organizational use' },
                { value: 'developer', label: 'Developer', description: 'Technical integration and API testing' }
              ].map((option) => (
                <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="userType"
                    value={option.value}
                    checked={userType === option.value}
                    onChange={(e) => setUserType(e.target.value as any)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{option.label}</div>
                    <div className="text-sm text-gray-600">{option.description}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'goals',
      title: 'Testing Goals',
      description: 'What would you like to test?',
      icon: BarChart3,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <BarChart3 className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">What are you interested in testing?</h3>
            <p className="text-gray-600">
              Select all areas you'd like to provide feedback on. This helps us prioritize your experience.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {availableGoals.map((goal) => (
              <label key={goal} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testingGoals.includes(goal)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setTestingGoals(prev => [...prev, goal]);
                    } else {
                      setTestingGoals(prev => prev.filter(g => g !== goal));
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-900">{goal}</span>
              </label>
            ))}
          </div>
        </div>
      )
    },
    {
      id: 'features',
      title: 'Platform Overview',
      description: 'Quick tour of key features',
      icon: FileText,
      content: (
        <div className="space-y-6">
          <div className="text-center">
            <FileText className="h-16 w-16 text-blue-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Key Features to Test</h3>
            <p className="text-gray-600">Here's what you can explore during the beta:</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                icon: Upload,
                title: 'PDF Upload & Processing',
                description: 'Upload PDFs and extract text with high accuracy'
              },
              {
                icon: BarChart3,
                title: 'Usage Analytics',
                description: 'Track your processing history and usage statistics'
              },
              {
                icon: Settings,
                title: 'Account Management',
                description: 'Manage your profile, subscription, and preferences'
              },
              {
                icon: Star,
                title: 'Beta Features',
                description: 'Access to experimental features and early releases'
              }
            ].map((feature, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg">
                <feature.icon className="h-8 w-8 text-blue-600 mb-3" />
                <h4 className="font-semibold text-gray-900 mb-2">{feature.title}</h4>
                <p className="text-sm text-gray-600">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      )
    }
  ];

  const handleNext = async () => {
    if (currentStep === 1) {
      // Validate invitation code
      if (!invitationCode || invitationCode.length < 8) {
        setError('Please enter a valid invitation code');
        return;
      }
      setError('');
    }

    if (currentStep === steps.length - 1) {
      // Complete onboarding and join beta
      await handleJoinBeta();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleJoinBeta = async () => {
    setIsJoining(true);
    try {
      await joinBeta(invitationCode, userType, testingGoals);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join beta program');
    } finally {
      setIsJoining(false);
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => prev - 1);
    setError('');
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return invitationCode.length >= 8;
      case 3:
        return testingGoals.length > 0;
      default:
        return true;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Progress bar */}
          <div className="bg-blue-600 px-6 py-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-white font-semibold">Beta Onboarding</h2>
              <span className="text-blue-100 text-sm">
                Step {currentStep + 1} of {steps.length}
              </span>
            </div>
            <div className="w-full bg-blue-700 rounded-full h-2">
              <div
                className="bg-white h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Step indicators */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`flex items-center ${
                    index < currentStep
                      ? 'text-green-600'
                      : index === currentStep
                      ? 'text-blue-600'
                      : 'text-gray-400'
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                      index < currentStep
                        ? 'bg-green-100'
                        : index === currentStep
                        ? 'bg-blue-100'
                        : 'bg-gray-100'
                    }`}
                  >
                    {index < currentStep ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      index + 1
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`h-0.5 w-12 mx-2 ${
                        index < currentStep ? 'bg-green-300' : 'bg-gray-300'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Current step content */}
          <div className="p-8">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                {steps[currentStep].title}
              </h3>
              <p className="text-gray-600">{steps[currentStep].description}</p>
            </div>

            {steps[currentStep].content}
          </div>

          {/* Navigation buttons */}
          <div className="px-8 py-6 bg-gray-50 flex justify-between">
            <button
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                currentStep === 0
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={handleNext}
              disabled={!canProceed() || isJoining}
              className={`flex items-center space-x-2 px-6 py-2 rounded-lg transition-colors ${
                !canProceed() || isJoining
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <span>
                {currentStep === steps.length - 1 ? 
                  (isJoining ? 'Joining...' : 'Join Beta') : 
                  'Next'
                }
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}