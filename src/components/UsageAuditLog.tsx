import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  FileText,
  CreditCard,
  RefreshCw
} from 'lucide-react';
import { useUsageHistory } from '@/hooks/useUsageTracking';

interface AuditLogProps {
  className?: string;
  showFilters?: boolean;
  maxHeight?: string;
}

export function UsageAuditLog({ 
  className = '', 
  showFilters = true,
  maxHeight = 'max-h-96'
}: AuditLogProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const { history, loading, error, refetch } = useUsageHistory(
    currentPage, 
    20, 
    actionFilter || undefined
  );

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'page_processed': return FileText;
      case 'limit_exceeded': return AlertCircle;
      case 'subscription_changed': return CreditCard;
      default: return Clock;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case 'page_processed': return 'text-green-600 bg-green-50 border-green-200';
      case 'limit_exceeded': return 'text-red-600 bg-red-50 border-red-200';
      case 'subscription_changed': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const filteredRecords = history?.records.filter(record => {
    if (!searchTerm) return true;
    
    return (
      record.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.subscription_plan.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.pages_count.toString().includes(searchTerm)
    );
  }) || [];

  if (error) {
    return (
      <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
        <div className="flex items-center text-red-800">
          <AlertCircle className="h-5 w-5 mr-2" />
          <div>
            <p className="font-medium">Failed to load audit log</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg border shadow-sm ${className}`}>
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Usage Audit Log</h3>
          <button
            onClick={refetch}
            disabled={loading}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search activities..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="sm:w-48">
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">All Activities</option>
                <option value="page_processed">Pages Processed</option>
                <option value="limit_exceeded">Limit Exceeded</option>
                <option value="subscription_changed">Subscription Changed</option>
              </select>
            </div>
          </div>
        )}
      </div>

      <div className={`${maxHeight} overflow-y-auto`}>
        {loading ? (
          <div className="p-6">
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex items-center space-x-4 p-3">
                  <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
                  <div className="flex-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </div>
                  <div className="w-16 h-4 bg-gray-200 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        ) : filteredRecords.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {filteredRecords.map((record) => {
              const Icon = getActionIcon(record.action);
              const colorClass = getActionColor(record.action);
              
              return (
                <div key={record.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start space-x-4">
                    <div className={`p-2 rounded-lg border ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {record.action.replace('_', ' ')}
                        </p>
                        <time className="text-xs text-gray-500">
                          {new Date(record.created_at).toLocaleString()}
                        </time>
                      </div>
                      
                      <div className="mt-1 space-y-1">
                        <p className="text-sm text-gray-600">
                          {record.action === 'page_processed' ? (
                            <>
                              Processed {record.pages_count} pages 
                              (Total: {record.pages_before} → {record.pages_after})
                            </>
                          ) : record.action === 'limit_exceeded' ? (
                            <>
                              Attempted to process {record.pages_count} pages 
                              (Current: {record.pages_before})
                            </>
                          ) : (
                            <>
                              Changed from {record.metadata?.subscription_plan_before || 'unknown'} 
                              to {record.subscription_plan}
                            </>
                          )}
                        </p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span className="flex items-center">
                            <CreditCard className="h-3 w-3 mr-1" />
                            {record.subscription_plan} plan
                          </span>
                          {record.metadata?.processing_record_id && (
                            <span>
                              Record: {record.metadata.processing_record_id.slice(0, 8)}...
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 text-center">
            <Clock className="h-12 w-12 text-gray-300 mx-auto" />
            <h3 className="text-sm font-medium text-gray-900 mt-4">No audit records</h3>
            <p className="text-sm text-gray-500 mt-2">
              {searchTerm || actionFilter 
                ? 'No records match your current filters'
                : 'No usage activity to display'
              }
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {history && history.total_count > 0 && (
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {history.page_offset + 1}-{Math.min(history.page_offset + history.page_limit, history.total_count)} of {history.total_count}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                disabled={currentPage === 0}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(currentPage + 1)}
                disabled={!history.has_more}
                className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default UsageAuditLog;