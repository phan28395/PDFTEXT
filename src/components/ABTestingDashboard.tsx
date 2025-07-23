import { useState, useEffect } from 'react';
import { 
  Zap, 
  Play, 
  Pause, 
  BarChart3, 
  TrendingUp,
  Users,
  Target,
  AlertCircle,
  CheckCircle,
  XCircle,
  Plus,
  Settings
} from 'lucide-react';
import LoadingSpinner from './LoadingSpinner';

interface ABTestVariant {
  id: string;
  name: string;
  traffic: number; // Percentage of traffic
  users: number;
  conversions: number;
  conversionRate: number;
  confidence: number;
  isWinner: boolean;
  config: Record<string, any>;
}

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  successMetric: string;
  trafficAllocation: number;
  variants: ABTestVariant[];
  statistical: {
    significance: number;
    pValue: number;
    sampleSize: number;
    daysRemaining: number;
  };
  results: {
    winner?: string;
    liftPercentage?: number;
    confidenceInterval: [number, number];
  };
}

interface ABTestData {
  tests: ABTest[];
  summary: {
    activeTests: number;
    completedTests: number;
    totalUsers: number;
    averageLift: number;
    successfulTests: number;
  };
}

export default function ABTestingDashboard() {
  const [data, setData] = useState<ABTestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTest, setSelectedTest] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchABTestData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/analytics/ab-tests', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch A/B test data');
      }
      
      const testData = await response.json();
      setData(testData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch A/B test data');
    } finally {
      setLoading(false);
    }
  };

  const updateTestStatus = async (testId: string, status: string) => {
    try {
      const response = await fetch(`/api/analytics/ab-tests/${testId}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });
      
      if (response.ok) {
        await fetchABTestData();
      }
    } catch (err) {
      console.error('Failed to update test status:', err);
    }
  };

  useEffect(() => {
    fetchABTestData();
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
          onClick={fetchABTestData}
          className="mt-4 bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'paused': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'completed': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'draft': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <Play className="h-4 w-4" />;
      case 'paused': return <Pause className="h-4 w-4" />;
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'draft': return <Settings className="h-4 w-4" />;
      default: return <Settings className="h-4 w-4" />;
    }
  };

  const getSignificanceColor = (significance: number) => {
    if (significance >= 95) return 'text-green-600';
    if (significance >= 90) return 'text-yellow-600';
    return 'text-gray-600';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center space-x-3 mb-4 sm:mb-0">
            <Zap className="h-6 w-6 text-purple-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900">A/B Testing Dashboard</h2>
              <p className="text-sm text-gray-600">Optimize features with data-driven experiments</p>
            </div>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create Test</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Play className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Active Tests</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.activeTests}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.completedTests}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">
                {data.summary.totalUsers.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Avg Lift</p>
              <p className="text-2xl font-bold text-gray-900">
                +{data.summary.averageLift.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <p className="text-sm text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {((data.summary.successfulTests / Math.max(1, data.summary.completedTests)) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* A/B Tests List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">A/B Tests</h3>
        <div className="space-y-6">
          {data.tests.map((test) => (
            <div key={test.id} className="border border-gray-200 rounded-lg p-6">
              {/* Test Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-900">{test.name}</h4>
                    <p className="text-sm text-gray-600">{test.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(test.status)}`}>
                    {getStatusIcon(test.status)}
                    <span className="ml-1">{test.status}</span>
                  </span>
                  
                  {test.status === 'active' && (
                    <button
                      onClick={() => updateTestStatus(test.id, 'paused')}
                      className="p-2 text-gray-600 hover:text-gray-900 rounded-md hover:bg-gray-100"
                    >
                      <Pause className="h-4 w-4" />
                    </button>
                  )}
                  
                  {test.status === 'paused' && (
                    <button
                      onClick={() => updateTestStatus(test.id, 'active')}
                      className="p-2 text-green-600 hover:text-green-700 rounded-md hover:bg-green-50"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Test Info */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6 text-sm">
                <div>
                  <span className="text-gray-600">Success Metric:</span>
                  <span className="font-medium ml-2">{test.successMetric}</span>
                </div>
                <div>
                  <span className="text-gray-600">Traffic:</span>
                  <span className="font-medium ml-2">{test.trafficAllocation}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Significance:</span>
                  <span className={`font-medium ml-2 ${getSignificanceColor(test.statistical.significance)}`}>
                    {test.statistical.significance.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Days Remaining:</span>
                  <span className="font-medium ml-2">
                    {test.statistical.daysRemaining > 0 ? test.statistical.daysRemaining : 'Completed'}
                  </span>
                </div>
              </div>

              {/* Variants Performance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {test.variants.map((variant) => (
                  <div 
                    key={variant.id} 
                    className={`p-4 rounded-lg border-2 ${
                      variant.isWinner ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-medium text-gray-900">{variant.name}</h5>
                        {variant.isWinner && (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        )}
                      </div>
                      <span className="text-sm text-gray-600">{variant.traffic}% traffic</span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {variant.users.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Users</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-900">
                          {variant.conversionRate.toFixed(2)}%
                        </div>
                        <div className="text-sm text-gray-600">Conversion Rate</div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="font-medium text-gray-900">
                          {variant.conversions.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-600">Conversions</div>
                      </div>
                      <div>
                        <div className={`font-medium ${getSignificanceColor(variant.confidence)}`}>
                          {variant.confidence.toFixed(1)}%
                        </div>
                        <div className="text-sm text-gray-600">Confidence</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          variant.isWinner ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(100, (variant.conversionRate / 20) * 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Test Results Summary */}
              {test.status === 'completed' && test.results.winner && (
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <CheckCircle className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-900">Test Results</span>
                  </div>
                  <p className="text-sm text-blue-800">
                    <strong>{test.results.winner}</strong> is the winner with a{' '}
                    <strong>{test.results.liftPercentage?.toFixed(1)}%</strong> improvement
                    (95% confidence interval: {test.results.confidenceInterval[0].toFixed(1)}% - {test.results.confidenceInterval[1].toFixed(1)}%)
                  </p>
                </div>
              )}

              {/* Statistical Warnings */}
              {test.status === 'active' && (
                <div className="mt-4">
                  {test.statistical.significance < 90 && (
                    <div className="flex items-center space-x-2 text-yellow-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>Results not yet statistically significant. Continue running test.</span>
                    </div>
                  )}
                  
                  {test.statistical.sampleSize < 100 && (
                    <div className="flex items-center space-x-2 text-orange-600 text-sm">
                      <AlertCircle className="h-4 w-4" />
                      <span>Small sample size. Consider increasing traffic allocation.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {data.tests.length === 0 && (
          <div className="text-center py-12">
            <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No A/B Tests</h3>
            <p className="text-gray-600 mb-6">Create your first A/B test to start optimizing your features</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 text-white px-6 py-3 rounded-md hover:bg-purple-700 transition-colors"
            >
              Create Your First Test
            </button>
          </div>
        )}
      </div>

      {/* Create Test Modal would go here */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create A/B Test</h3>
            <p className="text-gray-600 mb-6">
              A/B test creation interface would be implemented here with form fields for test configuration.
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
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
              >
                Create Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}