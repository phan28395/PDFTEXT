import React, { useState } from 'react';
import { X, Bug, Lightbulb, Zap, AlertTriangle, MessageCircle, Camera } from 'lucide-react';
import { useBetaTesting } from '../hooks/useBetaTesting';

interface BetaFeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialType?: 'bug_report' | 'feature_request' | 'usability' | 'performance' | 'general';
}

export default function BetaFeedbackModal({ isOpen, onClose, initialType = 'general' }: BetaFeedbackModalProps) {
  const { submitFeedback } = useBetaTesting();
  const [formData, setFormData] = useState({
    feedback_type: initialType,
    title: '',
    description: '',
    severity: 'medium' as const,
    category: '',
    reproduction_steps: '',
    expected_behavior: '',
    actual_behavior: '',
    screenshot: null as File | null
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const feedbackTypes = [
    { value: 'bug_report', label: 'Bug Report', icon: Bug, color: 'text-red-500' },
    { value: 'feature_request', label: 'Feature Request', icon: Lightbulb, color: 'text-yellow-500' },
    { value: 'usability', label: 'Usability Issue', icon: Zap, color: 'text-blue-500' },
    { value: 'performance', label: 'Performance Issue', icon: AlertTriangle, color: 'text-orange-500' },
    { value: 'general', label: 'General Feedback', icon: MessageCircle, color: 'text-green-500' }
  ];

  const severityOptions = [
    { value: 'low', label: 'Low - Minor issue or enhancement' },
    { value: 'medium', label: 'Medium - Noticeable impact' },
    { value: 'high', label: 'High - Major impact on usability' },
    { value: 'critical', label: 'Critical - Blocks core functionality' }
  ];

  const categoryOptions = {
    bug_report: ['Authentication', 'PDF Processing', 'Payment', 'UI/UX', 'Performance', 'Security'],
    feature_request: ['PDF Processing', 'Analytics', 'Export Options', 'Integration', 'Mobile App', 'API'],
    usability: ['Navigation', 'Forms', 'Workflow', 'Accessibility', 'Mobile Experience'],
    performance: ['Loading Speed', 'Processing Time', 'Memory Usage', 'Network Issues'],
    general: ['Overall Experience', 'Documentation', 'Support', 'Pricing', 'Other']
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      let screenshotUrl = '';
      
      // Upload screenshot if provided
      if (formData.screenshot) {
        // In a real implementation, you would upload to a storage service
        // For now, we'll just note that a screenshot was provided
        screenshotUrl = 'screenshot_provided';
      }

      await submitFeedback({
        feedback_type: formData.feedback_type,
        title: formData.title,
        description: formData.description,
        severity: formData.severity,
        category: formData.category,
        reproduction_steps: formData.reproduction_steps || undefined,
        expected_behavior: formData.expected_behavior || undefined,
        actual_behavior: formData.actual_behavior || undefined,
        screenshot_url: screenshotUrl || undefined
      });

      // Reset form and close modal
      setFormData({
        feedback_type: 'general',
        title: '',
        description: '',
        severity: 'medium',
        category: '',
        reproduction_steps: '',
        expected_behavior: '',
        actual_behavior: '',
        screenshot: null
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScreenshot = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        setFormData(prev => ({ ...prev, screenshot: file }));
      }
    };
    input.click();
  };

  if (!isOpen) return null;

  const selectedType = feedbackTypes.find(type => type.value === formData.feedback_type);
  const availableCategories = categoryOptions[formData.feedback_type] || [];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center space-x-3">
            {selectedType && <selectedType.icon className={`h-6 w-6 ${selectedType.color}`} />}
            <h2 className="text-xl font-semibold">Submit Beta Feedback</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          {/* Feedback Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Feedback Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {feedbackTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setFormData(prev => ({ 
                    ...prev, 
                    feedback_type: type.value as any,
                    category: '' // Reset category when type changes
                  }))}
                  className={`p-3 border rounded-lg flex flex-col items-center space-y-2 transition-colors ${
                    formData.feedback_type === type.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <type.icon className={`h-5 w-5 ${type.color}`} />
                  <span className="text-xs font-medium">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              id="title"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Brief description of the issue or suggestion"
            />
          </div>

          {/* Category and Severity */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                id="category"
                required
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a category</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-2">
                Severity
              </label>
              <select
                id="severity"
                value={formData.severity}
                onChange={(e) => setFormData(prev => ({ ...prev, severity: e.target.value as any }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {severityOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
              Description *
            </label>
            <textarea
              id="description"
              required
              rows={4}
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Provide detailed information about your feedback"
            />
          </div>

          {/* Bug Report Specific Fields */}
          {formData.feedback_type === 'bug_report' && (
            <div className="space-y-4">
              <div>
                <label htmlFor="reproduction_steps" className="block text-sm font-medium text-gray-700 mb-2">
                  Steps to Reproduce
                </label>
                <textarea
                  id="reproduction_steps"
                  rows={3}
                  value={formData.reproduction_steps}
                  onChange={(e) => setFormData(prev => ({ ...prev, reproduction_steps: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="1. Go to...&#10;2. Click on...&#10;3. Observe..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="expected_behavior" className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Behavior
                  </label>
                  <textarea
                    id="expected_behavior"
                    rows={2}
                    value={formData.expected_behavior}
                    onChange={(e) => setFormData(prev => ({ ...prev, expected_behavior: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What should happen?"
                  />
                </div>

                <div>
                  <label htmlFor="actual_behavior" className="block text-sm font-medium text-gray-700 mb-2">
                    Actual Behavior
                  </label>
                  <textarea
                    id="actual_behavior"
                    rows={2}
                    value={formData.actual_behavior}
                    onChange={(e) => setFormData(prev => ({ ...prev, actual_behavior: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="What actually happened?"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Screenshot Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Screenshot (Optional)
            </label>
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={handleScreenshot}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
              >
                <Camera className="h-4 w-4" />
                <span>Add Screenshot</span>
              </button>
              {formData.screenshot && (
                <span className="text-sm text-green-600">
                  Screenshot selected: {formData.screenshot.name}
                </span>
              )}
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end space-x-3 pt-6 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}