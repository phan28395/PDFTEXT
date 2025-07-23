import { useState, useEffect } from 'react';
import { 
  Mail, 
  Send, 
  Users, 
  TrendingUp,
  Eye,
  MousePointer,
  Target,
  Plus,
  Play,
  Pause,
  BarChart3,
  Calendar,
  Clock,
  CheckCircle
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface Campaign {
  id: string;
  name: string;
  type: 'email' | 'in_app' | 'push';
  status: 'draft' | 'active' | 'paused' | 'completed';
  triggerType: 'manual' | 'behavioral' | 'scheduled' | 'churn_risk';
  targetAudience: {
    segment: string;
    criteria: string[];
    size: number;
  };
  content: {
    subject: string;
    message: string;
    callToAction: string;
  };
  performance: {
    sent: number;
    opened: number;
    clicked: number;
    converted: number;
    openRate: number;
    clickRate: number;
    conversionRate: number;
    roi: number;
  };
  scheduledAt?: string;
  createdAt: string;
}

export default function MarketingCampaignsManager() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/marketing/campaigns', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      
      const data = await response.json();
      setCampaigns(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  const updateCampaignStatus = async (campaignId: string, status: string) => {
    try {
      const response = await fetch(`/api/marketing/campaigns/${campaignId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        await fetchCampaigns();
      }
    } catch (err) {
      console.error('Failed to update campaign status:', err);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <p className="text-red-700">{error}</p>
        <button
          onClick={fetchCampaigns}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'paused': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'completed': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTriggerTypeIcon = (triggerType: string) => {
    switch (triggerType) {
      case 'manual': return <Send className="h-4 w-4" />;
      case 'behavioral': return <Target className="h-4 w-4" />;
      case 'scheduled': return <Calendar className="h-4 w-4" />;
      case 'churn_risk': return <TrendingUp className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  // Mock campaign data
  const mockCampaigns: Campaign[] = [
    {
      id: '1',
      name: 'Welcome Email Series',
      type: 'email',
      status: 'active',
      triggerType: 'behavioral',
      targetAudience: {
        segment: 'New Users',
        criteria: ['Signed up in last 24 hours', 'No uploads yet'],
        size: 156
      },
      content: {
        subject: 'Welcome to PDF-to-Text! Get started in 3 easy steps',
        message: 'Transform your PDFs into editable text with our AI-powered tool...',
        callToAction: 'Upload Your First PDF'
      },
      performance: {
        sent: 1247,
        opened: 687,
        clicked: 234,
        converted: 89,
        openRate: 55.1,
        clickRate: 18.8,
        conversionRate: 7.1,
        roi: 245.6
      },
      scheduledAt: '2024-01-15T09:00:00Z',
      createdAt: '2024-01-10T10:00:00Z'
    },
    {
      id: '2',
      name: 'Upgrade Reminder',
      type: 'email',
      status: 'active',
      triggerType: 'behavioral',
      targetAudience: {
        segment: 'Heavy Free Users',
        criteria: ['Used 8+ pages', 'Free plan', 'Active last 7 days'],
        size: 89
      },
      content: {
        subject: 'You\'re almost at your limit - Upgrade to Pro?',
        message: 'Don\'t let page limits slow you down. Upgrade to Pro for unlimited processing...',
        callToAction: 'Upgrade to Pro'
      },
      performance: {
        sent: 423,
        opened: 289,
        clicked: 67,
        converted: 18,
        openRate: 68.3,
        clickRate: 15.8,
        conversionRate: 4.2,
        roi: 180.4
      },
      createdAt: '2024-01-08T14:30:00Z'
    },
    {
      id: '3',
      name: 'Churn Prevention Campaign',
      type: 'email',
      status: 'completed',
      triggerType: 'churn_risk',
      targetAudience: {
        segment: 'At-Risk Users',
        criteria: ['No activity 14+ days', 'Previously active'],
        size: 234
      },
      content: {
        subject: 'We miss you! Here\'s what\'s new',
        message: 'It\'s been a while since your last visit. Check out our new features...',
        callToAction: 'See What\'s New'
      },
      performance: {
        sent: 234,
        opened: 123,
        clicked: 34,
        converted: 12,
        openRate: 52.6,
        clickRate: 14.5,
        conversionRate: 5.1,
        roi: 156.8
      },
      createdAt: '2024-01-05T11:15:00Z'
    }
  ];

  const displayCampaigns = campaigns.length > 0 ? campaigns : mockCampaigns;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <Mail className="h-6 w-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Marketing Campaigns</h2>
              <p className="text-sm text-gray-600">Automated campaigns with user segmentation</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Campaign Performance Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Send className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Sent</p>
              <p className="text-2xl font-bold text-gray-900">
                {displayCampaigns.reduce((sum, c) => sum + c.performance.sent, 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Eye className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Open Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(displayCampaigns.reduce((sum, c) => sum + c.performance.openRate, 0) / displayCampaigns.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <MousePointer className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Click Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {(displayCampaigns.reduce((sum, c) => sum + c.performance.clickRate, 0) / displayCampaigns.length).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg ROI</p>
              <p className="text-2xl font-bold text-gray-900">
                {(displayCampaigns.reduce((sum, c) => sum + c.performance.roi, 0) / displayCampaigns.length).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campaigns List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Active Campaigns</h3>
        <div className="space-y-6">
          {displayCampaigns.map((campaign) => (
            <div key={campaign.id} className="border border-gray-200 rounded-lg p-6">
              {/* Campaign Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    {getTriggerTypeIcon(campaign.triggerType)}
                    <div>
                      <h4 className="text-lg font-medium text-gray-900">{campaign.name}</h4>
                      <p className="text-sm text-gray-600">{campaign.type} • {campaign.triggerType}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(campaign.status)}`}>
                    {campaign.status}
                  </span>
                  
                  {campaign.status === 'active' && (
                    <button
                      onClick={() => updateCampaignStatus(campaign.id, 'paused')}
                      className="p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  
                  {campaign.status === 'paused' && (
                    <button
                      onClick={() => updateCampaignStatus(campaign.id, 'active')}
                      className="p-2 text-green-600 hover:text-green-700 rounded-md hover:bg-green-50"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Target Audience */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-gray-900">Target: {campaign.targetAudience.segment}</h5>
                  <span className="text-sm text-gray-600">{campaign.targetAudience.size} users</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {campaign.targetAudience.criteria.map((criterion, index) => (
                    <span
                      key={index}
                      className="inline-block px-2 py-1 bg-white text-gray-700 text-xs rounded border"
                    >
                      {criterion}
                    </span>
                  ))}
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">{campaign.performance.sent}</div>
                  <div className="text-sm text-gray-600">Sent</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">{campaign.performance.openRate}%</div>
                  <div className="text-sm text-gray-600">Open Rate</div>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-lg">
                  <div className="text-lg font-bold text-purple-600">{campaign.performance.clickRate}%</div>
                  <div className="text-sm text-gray-600">Click Rate</div>
                </div>
                <div className="text-center p-3 bg-orange-50 rounded-lg">
                  <div className="text-lg font-bold text-orange-600">{campaign.performance.conversionRate}%</div>
                  <div className="text-sm text-gray-600">Conversion</div>
                </div>
              </div>

              {/* Campaign Content Preview */}
              <div className="border-t border-gray-200 pt-4">
                <h6 className="font-medium text-gray-900 mb-2">Content Preview</h6>
                <div className="text-sm text-gray-600">
                  <div className="mb-1"><strong>Subject:</strong> {campaign.content.subject}</div>
                  <div className="mb-1"><strong>Message:</strong> {campaign.content.message.substring(0, 100)}...</div>
                  <div><strong>CTA:</strong> {campaign.content.callToAction}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Create Campaign Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Marketing Campaign</h3>
            <p className="text-gray-600 mb-6">
              Campaign creation interface would be implemented here with form fields for campaign configuration, audience targeting, and content creation.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Create Campaign
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}