import { useState, useEffect } from 'react';
import { 
  Share2, 
  Users, 
  Gift, 
  TrendingUp,
  Copy,
  ExternalLink,
  CheckCircle,
  DollarSign,
  Target,
  Award,
  Link,
  UserPlus
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface ReferralData {
  userReferral: {
    referralCode: string;
    totalRewards: number;
    clicks: number;
    signups: number;
    conversions: number;
    conversionRate: number;
    pendingRewards: number;
  };
  programStats: {
    totalReferrers: number;
    totalReferrals: number;
    totalRewards: number;
    averageReward: number;
    topReferrers: Array<{
      email: string;
      referrals: number;
      rewards: number;
    }>;
  };
  recentActivity: Array<{
    id: string;
    type: 'click' | 'signup' | 'conversion';
    timestamp: string;
    reward?: number;
  }>;
}

export default function ReferralProgramDashboard() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchReferralData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/referrals/dashboard', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch referral data');
      }
      
      const referralData = await response.json();
      setData(referralData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch referral data');
    } finally {
      setLoading(false);
    }
  };

  const copyReferralLink = async () => {
    if (!data?.userReferral.referralCode) return;
    
    const referralLink = `https://pdf-to-text.com/?ref=${data.userReferral.referralCode}`;
    
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  useEffect(() => {
    fetchReferralData();
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
          onClick={fetchReferralData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Mock data if no real data available
  const mockData: ReferralData = {
    userReferral: {
      referralCode: 'JANE2024',
      totalRewards: 35.50,
      clicks: 47,
      signups: 12,
      conversions: 3,
      conversionRate: 25.0,
      pendingRewards: 8.50
    },
    programStats: {
      totalReferrers: 234,
      totalReferrals: 1456,
      totalRewards: 12450.75,
      averageReward: 53.20,
      topReferrers: [
        { email: 'top@example.com', referrals: 23, rewards: 287.50 },
        { email: 'power@example.com', referrals: 19, rewards: 234.25 },
        { email: 'super@example.com', referrals: 17, rewards: 198.75 }
      ]
    },
    recentActivity: [
      { id: '1', type: 'conversion', timestamp: '2024-01-20T10:30:00Z', reward: 5.00 },
      { id: '2', type: 'signup', timestamp: '2024-01-19T15:45:00Z', reward: 2.50 },
      { id: '3', type: 'click', timestamp: '2024-01-19T12:20:00Z' },
      { id: '4', type: 'signup', timestamp: '2024-01-18T09:15:00Z', reward: 2.50 }
    ]
  };

  const displayData = data || mockData;
  const referralLink = `https://pdf-to-text.com/?ref=${displayData.userReferral.referralCode}`;

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'click': return <ExternalLink className="h-4 w-4 text-blue-600" />;
      case 'signup': return <UserPlus className="h-4 w-4 text-green-600" />;
      case 'conversion': return <DollarSign className="h-4 w-4 text-purple-600" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'click': return 'bg-blue-50 border-blue-200';
      case 'signup': return 'bg-green-50 border-green-200';
      case 'conversion': return 'bg-purple-50 border-purple-200';
      default: return 'bg-gray-50 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <Share2 className="h-6 w-6 text-green-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Referral Program</h2>
            <p className="text-sm text-gray-600">Earn rewards by referring friends to PDF-to-Text</p>
          </div>
        </div>
      </div>

      {/* Your Referral Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Rewards</p>
              <p className="text-2xl font-bold text-gray-900">
                ${displayData.userReferral.totalRewards.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-green-600">
            ${displayData.userReferral.pendingRewards.toFixed(2)} pending
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Referrals</p>
              <p className="text-2xl font-bold text-gray-900">
                {displayData.userReferral.signups}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-blue-600">
            {displayData.userReferral.clicks} clicks
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Conversions</p>
              <p className="text-2xl font-bold text-gray-900">
                {displayData.userReferral.conversions}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-purple-600">
            {displayData.userReferral.conversionRate.toFixed(1)}% rate
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Award className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Your Code</p>
              <p className="text-2xl font-bold text-gray-900">
                {displayData.userReferral.referralCode}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Share with friends
          </div>
        </div>
      </div>

      {/* Referral Link Sharing */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Share Your Referral Link</h3>
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-900 truncate">{referralLink}</span>
              <button
                onClick={copyReferralLink}
                className="ml-3 p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-200 transition-colors"
              >
                {copied ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
            <Share2 className="h-4 w-4" />
            <span>Share on Twitter</span>
          </button>
          <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-blue-800 text-white rounded-md hover:bg-blue-900 transition-colors">
            <Share2 className="h-4 w-4" />
            <span>Share on LinkedIn</span>
          </button>
          <button className="flex items-center justify-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors">
            <Share2 className="h-4 w-4" />
            <span>Send Email</span>
          </button>
        </div>
      </div>

      {/* Program Overview & Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Program Statistics */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Program Statistics</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Referrers</span>
              <span className="font-medium text-gray-900">{displayData.programStats.totalReferrers.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Referrals</span>
              <span className="font-medium text-gray-900">{displayData.programStats.totalReferrals.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Total Rewards Paid</span>
              <span className="font-medium text-green-600">${displayData.programStats.totalRewards.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Average Reward</span>
              <span className="font-medium text-gray-900">${displayData.programStats.averageReward.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Top Referrers Leaderboard */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Referrers</h3>
          <div className="space-y-3">
            {displayData.programStats.topReferrers.map((referrer, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-orange-500' : 'bg-gray-300'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{referrer.email}</div>
                    <div className="text-sm text-gray-600">{referrer.referrals} referrals</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-medium text-green-600">${referrer.rewards.toFixed(2)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {displayData.recentActivity.map((activity) => (
            <div key={activity.id} className={`flex items-center justify-between p-3 border rounded-lg ${getActivityColor(activity.type)}`}>
              <div className="flex items-center space-x-3">
                {getActivityIcon(activity.type)}
                <div>
                  <div className="font-medium text-gray-900 capitalize">{activity.type}</div>
                  <div className="text-sm text-gray-600">
                    {new Date(activity.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
              </div>
              {activity.reward && (
                <div className="text-right">
                  <div className="font-medium text-green-600">+${activity.reward.toFixed(2)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">How It Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Share2 className="h-6 w-6 text-blue-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">1. Share Your Link</h4>
            <p className="text-sm text-gray-600">Share your unique referral link with friends and colleagues</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <UserPlus className="h-6 w-6 text-green-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">2. They Sign Up</h4>
            <p className="text-sm text-gray-600">When someone signs up using your link, you earn $2.50</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <Gift className="h-6 w-6 text-purple-600" />
            </div>
            <h4 className="font-medium text-gray-900 mb-2">3. Earn More</h4>
            <p className="text-sm text-gray-600">Get an additional $5.00 when they upgrade to Pro</p>
          </div>
        </div>
      </div>
    </div>
  );
}