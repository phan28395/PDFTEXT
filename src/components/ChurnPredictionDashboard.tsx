import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Users, 
  TrendingDown, 
  Mail, 
  Shield,
  Clock,
  Target,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface ChurnRiskUser {
  id: string;
  email: string;
  subscriptionStatus: string;
  riskScore: number;
  riskLevel: 'high' | 'medium' | 'low';
  churnProbability: number;
  lastActivity: string;
  daysSinceLastActivity: number;
  totalRevenue: number;
  predictedLTV: number;
  riskFactors: string[];
  suggestedActions: string[];
}

interface ChurnMetrics {
  overallChurnRate: number;
  predictedChurnRate: number;
  usersAtRisk: {
    high: number;
    medium: number;
    low: number;
  };
  churnPrevention: {
    campaignsSent: number;
    usersRetained: number;
    revenueProtected: number;
    successRate: number;
  };
  riskTrends: Array<{
    date: string;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  }>;
  topRiskFactors: Array<{
    factor: string;
    count: number;
    impact: number;
  }>;
}

interface ChurnData {
  metrics: ChurnMetrics;
  riskUsers: ChurnRiskUser[];
  preventionCampaigns: Array<{
    id: string;
    name: string;
    targetRisk: string;
    sent: number;
    opened: number;
    retained: number;
    status: string;
  }>;
}

export default function ChurnPredictionDashboard() {
  const [data, setData] = useState<ChurnData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchChurnData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics/churn-prediction', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch churn prediction data');
      }
      
      const churnData = await response.json();
      setData(churnData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch churn data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runChurnPrediction = async () => {
    try {
      setRefreshing(true);
      
      const response = await fetch('/api/analytics/churn-prediction/calculate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        await fetchChurnData();
      }
    } catch (err) {
      console.error('Failed to run churn prediction:', err);
    }
  };

  const sendPreventionCampaign = async (riskLevel: string) => {
    try {
      const response = await fetch('/api/marketing/churn-prevention', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ riskLevel })
      });
      
      if (response.ok) {
        await fetchChurnData(); // Refresh data
      }
    } catch (err) {
      console.error('Failed to send prevention campaign:', err);
    }
  };

  useEffect(() => {
    fetchChurnData();
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
          onClick={fetchChurnData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredUsers = data.riskUsers.filter(user => 
    selectedRiskLevel === 'all' || user.riskLevel === selectedRiskLevel
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Churn Prediction & Prevention</h2>
              <p className="text-sm text-gray-600">AI-powered churn prediction and automated retention</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <button
              onClick={runChurnPrediction}
              disabled={refreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Recalculate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingDown className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Predicted Churn Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.metrics.predictedChurnRate.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Next 30 days
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">High Risk Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.metrics.usersAtRisk.high}
              </p>
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={() => sendPreventionCampaign('high')}
              className="text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition-colors"
            >
              Send Campaign
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Shield className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Revenue Protected</p>
              <p className="text-2xl font-bold text-gray-900">
                ${data.metrics.churnPrevention.revenueProtected.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-green-600">
            {data.metrics.churnPrevention.usersRetained} users retained
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.metrics.churnPrevention.successRate.toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">
            Prevention campaigns
          </div>
        </div>
      </div>

      {/* Risk Distribution and Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Risk Distribution</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="font-medium text-gray-900">High Risk</span>
              </div>
              <div className="text-right">
                <span className="text-red-600 font-bold text-lg">{data.metrics.usersAtRisk.high}</span>
                <div className="text-xs text-gray-600">users</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Medium Risk</span>
              </div>
              <div className="text-right">
                <span className="text-yellow-600 font-bold text-lg">{data.metrics.usersAtRisk.medium}</span>
                <div className="text-xs text-gray-600">users</div>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg border border-green-200">
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium text-gray-900">Low Risk</span>
              </div>
              <div className="text-right">
                <span className="text-green-600 font-bold text-lg">{data.metrics.usersAtRisk.low}</span>
                <div className="text-xs text-gray-600">users</div>
              </div>
            </div>
          </div>
        </div>

        {/* Top Risk Factors */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Risk Factors</h3>
          <div className="space-y-3">
            {data.metrics.topRiskFactors.map((factor, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                    index === 0 ? 'bg-red-500' : 
                    index === 1 ? 'bg-orange-500' : 
                    index === 2 ? 'bg-yellow-500' : 'bg-gray-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{factor.factor}</div>
                    <div className="text-sm text-gray-600">{factor.count} users affected</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-red-600">
                    {factor.impact.toFixed(1)}% impact
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Users at Risk Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Users at Risk</h3>
          <select
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Risk Levels</option>
            <option value="high">High Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="low">Low Risk</option>
          </select>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Risk Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Churn Probability
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Activity
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Revenue
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.slice(0, 10).map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{user.email}</div>
                      <div className="text-sm text-gray-500">{user.subscriptionStatus}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full border ${getRiskColor(user.riskLevel)}`}>
                      {user.riskLevel} ({user.riskScore}/10)
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {(user.churnProbability * 100).toFixed(1)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-gray-400" />
                      <span>{user.daysSinceLastActivity} days ago</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <div>
                      <div className="font-medium">${user.totalRevenue}</div>
                      <div className="text-xs text-gray-500">LTV: ${user.predictedLTV}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button className="text-blue-600 hover:text-blue-900 mr-3">
                      Send Email
                    </button>
                    <button className="text-green-600 hover:text-green-900">
                      View Profile
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredUsers.length > 10 && (
          <div className="mt-4 text-center text-sm text-gray-600">
            Showing 10 of {filteredUsers.length} users
          </div>
        )}
      </div>

      {/* Prevention Campaigns */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Prevention Campaigns</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.preventionCampaigns.map((campaign) => (
            <div key={campaign.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">{campaign.name}</h4>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  campaign.status === 'active' ? 'bg-green-100 text-green-800' :
                  campaign.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {campaign.status}
                </span>
              </div>
              <div className="text-sm text-gray-600 mb-3">
                Target: {campaign.targetRisk} risk users
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-600">Sent:</span>
                  <span className="font-medium ml-1">{campaign.sent}</span>
                </div>
                <div>
                  <span className="text-gray-600">Opened:</span>
                  <span className="font-medium ml-1">{campaign.opened}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-gray-600">Retained:</span>
                  <span className="font-medium text-green-600 ml-1">{campaign.retained} users</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}