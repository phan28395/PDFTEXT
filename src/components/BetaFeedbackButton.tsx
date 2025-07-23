import React, { useState } from 'react';
import { MessageSquare, ChevronDown } from 'lucide-react';
import { useBetaFeatures } from '../hooks/useBetaTesting';
import BetaFeedbackModal from './BetaFeedbackModal';

export default function BetaFeedbackButton() {
  const { isBetaUser } = useBetaFeatures();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  if (!isBetaUser) return null;

  const feedbackTypes = [
    { type: 'bug_report', label: 'Report a Bug', description: 'Something isn\'t working correctly' },
    { type: 'feature_request', label: 'Request Feature', description: 'Suggest a new feature or improvement' },
    { type: 'usability', label: 'Usability Issue', description: 'Something is confusing or hard to use' },
    { type: 'performance', label: 'Performance Issue', description: 'Something is slow or unresponsive' },
    { type: 'general', label: 'General Feedback', description: 'Share your thoughts or suggestions' }
  ];

  const handleFeedbackTypeSelect = (type: string) => {
    setIsModalOpen(true);
    setIsDropdownOpen(false);
  };

  return (
    <>
      {/* Fixed position feedback button */}
      <div className="fixed bottom-6 right-6 z-40">
        <div className="relative">
          {/* Quick feedback button */}
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center space-x-2 transition-all duration-200 hover:scale-105"
            title="Beta Feedback"
          >
            <MessageSquare className="h-5 w-5" />
            <span className="hidden sm:inline">Feedback</span>
          </button>

          {/* Dropdown for quick feedback types */}
          <div className="absolute bottom-full right-0 mb-2">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className={`bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-full shadow-lg flex items-center space-x-1 transition-all duration-200 ${
                isDropdownOpen ? 'bg-gray-700' : ''
              }`}
              title="Quick Feedback Options"
            >
              <ChevronDown className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                <div className="px-4 py-2 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900">Quick Feedback</h3>
                  <p className="text-xs text-gray-600">Help us improve your beta experience</p>
                </div>
                {feedbackTypes.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleFeedbackTypeSelect(item.type)}
                    className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className="font-medium text-gray-900 text-sm">{item.label}</div>
                    <div className="text-xs text-gray-600 mt-1">{item.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Beta badge in header */}
      <div className="fixed top-4 right-4 z-30">
        <div className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center space-x-2 shadow-lg">
          <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
          <span>BETA</span>
        </div>
      </div>

      <BetaFeedbackModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}