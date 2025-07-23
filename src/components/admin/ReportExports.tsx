import { useState } from 'react';
import { Download, FileText, Calendar, Filter, Clock, CheckCircle } from 'lucide-react';
import LoadingSpinner from '../LoadingSpinner';

interface ExportJob {
  id: string;
  type: 'users' | 'revenue' | 'usage' | 'security' | 'analytics';
  format: 'csv' | 'xlsx' | 'pdf';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  downloadUrl?: string;
  parameters: {
    dateFrom: string;
    dateTo: string;
    filters?: any;
  };
}

export default function ReportExports() {
  const [selectedReportType, setSelectedReportType] = useState<'users' | 'revenue' | 'usage' | 'security' | 'analytics'>('users');
  const [selectedFormat, setSelectedFormat] = useState<'csv' | 'xlsx' | 'pdf'>('csv');
  const [dateFrom, setDateFrom] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([
    {
      id: '1',
      type: 'users',
      format: 'csv',
      status: 'completed',
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      completedAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
      downloadUrl: '/exports/users-2024-01-15.csv',
      parameters: {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-15'
      }
    },
    {
      id: '2',
      type: 'revenue',
      format: 'xlsx',
      status: 'processing',
      createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
      parameters: {
        dateFrom: '2024-01-01',
        dateTo: '2024-01-15'
      }
    }
  ]);
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { value: 'users', label: 'User Report', description: 'User registration, activity, and subscription data' },
    { value: 'revenue', label: 'Revenue Report', description: 'Payment transactions and subscription revenue' },
    { value: 'usage', label: 'Usage Report', description: 'PDF processing statistics and usage patterns' },
    { value: 'security', label: 'Security Report', description: 'Security events, rate limiting, and threat analysis' },
    { value: 'analytics', label: 'Analytics Report', description: 'Comprehensive business intelligence metrics' }
  ];

  const generateReport = async () => {
    if (!dateFrom || !dateTo) {
      alert('Please select both start and end dates');
      return;
    }

    setLoading(true);

    try {
      // Simulate API call to generate report
      const newJob: ExportJob = {
        id: Date.now().toString(),
        type: selectedReportType,
        format: selectedFormat,
        status: 'pending',
        createdAt: new Date().toISOString(),
        parameters: {
          dateFrom,
          dateTo
        }
      };

      setExportJobs(prev => [newJob, ...prev]);

      // Simulate processing
      setTimeout(() => {
        setExportJobs(prev => 
          prev.map(job => 
            job.id === newJob.id 
              ? { ...job, status: 'processing' as const }
              : job
          )
        );
      }, 1000);

      setTimeout(() => {
        setExportJobs(prev => 
          prev.map(job => 
            job.id === newJob.id 
              ? { 
                  ...job, 
                  status: 'completed' as const, 
                  completedAt: new Date().toISOString(),
                  downloadUrl: `/exports/${selectedReportType}-${dateFrom}-${dateTo}.${selectedFormat}`
                }
              : job
          )
        );
      }, 5000);

    } catch (error) {
      console.error('Error generating report:', error);
      alert('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = (job: ExportJob) => {
    if (job.downloadUrl) {
      // In a real implementation, this would download the file
      window.open(job.downloadUrl, '_blank');
    }
  };

  const getStatusColor = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      case 'failed': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'completed': return <CheckCircle className="h-4 w-4" />;
      case 'processing': return <LoadingSpinner size="sm" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'failed': return <span>❌</span>;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center space-x-3">
          <Download className="h-6 w-6 text-blue-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Report Exports</h2>
            <p className="text-sm text-gray-600">Generate and download detailed reports</p>
          </div>
        </div>
      </div>

      {/* Export Form */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Generate New Report</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={selectedReportType}
              onChange={(e) => setSelectedReportType(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {reportTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {reportTypes.find(t => t.value === selectedReportType)?.description}
            </p>
          </div>

          {/* Format */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as any)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="csv">CSV</option>
              <option value="xlsx">Excel (XLSX)</option>
              <option value="pdf">PDF</option>
            </select>
          </div>

          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              From Date
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              To Date
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="mt-6">
          <button
            onClick={generateReport}
            disabled={loading}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Generating...</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>Generate Report</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Export History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Export History</h3>

        {exportJobs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No reports generated yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Report
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date Range
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exportJobs.map((job) => (
                  <tr key={job.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {reportTypes.find(t => t.value === job.type)?.label}
                          </div>
                          <div className="text-sm text-gray-500 uppercase">
                            {job.format}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.parameters.dateFrom).toLocaleDateString()} - {new Date(job.parameters.dateTo).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium space-x-1 ${getStatusColor(job.status)}`}>
                        {getStatusIcon(job.status)}
                        <span className="capitalize">{job.status}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {job.status === 'completed' && job.downloadUrl ? (
                        <button
                          onClick={() => downloadReport(job)}
                          className="text-blue-600 hover:text-blue-900 flex items-center space-x-1"
                        >
                          <Download className="h-4 w-4" />
                          <span>Download</span>
                        </button>
                      ) : (
                        <span className="text-gray-400">
                          {job.status === 'processing' ? 'Processing...' : 
                           job.status === 'pending' ? 'Pending...' : 
                           job.status === 'failed' ? 'Failed' : 'N/A'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Export Templates</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { type: 'users', label: 'Monthly User Report', period: '30 days' },
            { type: 'revenue', label: 'Weekly Revenue', period: '7 days' },
            { type: 'usage', label: 'Daily Usage Stats', period: '1 day' },
            { type: 'security', label: 'Security Summary', period: '7 days' },
            { type: 'analytics', label: 'Business Overview', period: '30 days' }
          ].map((template, index) => (
            <button
              key={index}
              onClick={() => {
                setSelectedReportType(template.type as any);
                const days = parseInt(template.period);
                setDateFrom(new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
                setDateTo(new Date().toISOString().split('T')[0]);
              }}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
            >
              <div className="flex items-center space-x-3">
                <FileText className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-medium text-gray-900">{template.label}</div>
                  <div className="text-sm text-gray-500">Last {template.period}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}