import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  Download, 
  ExternalLink, 
  CreditCard, 
  Calendar, 
  DollarSign,
  FileText,
  Receipt,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from './LoadingSpinner';

interface Invoice {
  id: string;
  status: string;
  total: number;
  currency: string;
  created: number;
  invoice_pdf?: string;
  hosted_invoice_url?: string;
  number: string;
  billing_reason: string;
  description: string;
  period_start: number;
  period_end: number;
  subtotal: number;
  tax: number;
  customer_email: string;
}

interface Payment {
  id: string;
  status: string;
  amount: number;
  currency: string;
  created: number;
  description: string;
  receipt_url?: string;
  payment_method_types: string[];
  last4: string;
  brand: string;
}

interface BillingData {
  invoices: Invoice[];
  payments: Payment[];
  has_more: boolean;
  total_count: number;
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toLowerCase()) {
      case 'paid':
      case 'succeeded':
        return { color: 'green', icon: CheckCircle, text: 'Paid' };
      case 'pending':
      case 'processing':
        return { color: 'yellow', icon: Clock, text: 'Pending' };
      case 'failed':
      case 'canceled':
        return { color: 'red', icon: AlertCircle, text: 'Failed' };
      default:
        return { color: 'gray', icon: Clock, text: status };
    }
  };

  const { color, icon: Icon, text } = getStatusConfig(status);

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-${color}-100 text-${color}-800`}>
      <Icon className="h-3 w-3 mr-1" />
      {text}
    </span>
  );
};

const formatCurrency = (amount: number, currency: string = 'usd'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount / 100); // Convert from cents to dollars
};

const formatDate = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const InvoiceCard: React.FC<{ invoice: Invoice }> = ({ invoice }) => {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900 flex items-center">
            <FileText className="h-4 w-4 mr-2 text-blue-600" />
            Invoice {invoice.number}
          </h3>
          <p className="text-sm text-gray-600 mt-1">{invoice.description}</p>
        </div>
        <StatusBadge status={invoice.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Amount</p>
          <p className="font-semibold text-lg text-gray-900">
            {formatCurrency(invoice.total, invoice.currency)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Date</p>
          <p className="font-medium text-gray-900 flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {formatDate(invoice.created)}
          </p>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-600">Billing Period</p>
            <p className="text-gray-900">
              {formatDate(invoice.period_start)} - {formatDate(invoice.period_end)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-600 mb-1">Subtotal: {formatCurrency(invoice.subtotal, invoice.currency)}</p>
            <p className="text-gray-600 mb-1">Tax: {formatCurrency(invoice.tax, invoice.currency)}</p>
            <p className="font-medium text-gray-900">Total: {formatCurrency(invoice.total, invoice.currency)}</p>
          </div>
        </div>
      </div>

      <div className="flex space-x-3 mt-4 pt-4 border-t">
        {invoice.invoice_pdf && (
          <a
            href={invoice.invoice_pdf}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </a>
        )}
        {invoice.hosted_invoice_url && (
          <a
            href={invoice.hosted_invoice_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            View Online
          </a>
        )}
      </div>
    </div>
  );
};

const PaymentCard: React.FC<{ payment: Payment }> = ({ payment }) => {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-medium text-gray-900 flex items-center">
            <CreditCard className="h-4 w-4 mr-2 text-green-600" />
            Payment
          </h3>
          <p className="text-sm text-gray-600 mt-1">{payment.description}</p>
        </div>
        <StatusBadge status={payment.status} />
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="text-sm text-gray-600">Amount</p>
          <p className="font-semibold text-lg text-gray-900">
            {formatCurrency(payment.amount, payment.currency)}
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Date</p>
          <p className="font-medium text-gray-900 flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {formatDate(payment.created)}
          </p>
        </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex justify-between items-center text-sm">
          <div>
            <p className="text-gray-600">Payment Method</p>
            <p className="text-gray-900 capitalize">
              {payment.brand} •••• {payment.last4}
            </p>
          </div>
          <div>
            {payment.receipt_url && (
              <a
                href={payment.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 text-sm"
              >
                <Receipt className="h-4 w-4 mr-2" />
                Receipt
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BillingHistory: React.FC = () => {
  const { user } = useAuth();
  const [billingData, setBillingData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'invoices' | 'payments'>('invoices');
  const [refreshing, setRefreshing] = useState(false);

  const fetchBillingHistory = async () => {
    if (!user) return;

    try {
      setError(null);
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/billing/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch billing history');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }

      setBillingData(result.data);
    } catch (error: any) {
      console.error('Billing history fetch error:', error);
      setError(error.message || 'Failed to load billing history');
      toast.error('Failed to load billing history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchBillingHistory();
  }, [user]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchBillingHistory();
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center py-12">
          <LoadingSpinner size="lg" />
          <p className="text-gray-600 mt-4">Loading billing history...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-800 mb-2">Failed to Load Billing History</h3>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const hasNoData = !billingData || (billingData.invoices.length === 0 && billingData.payments.length === 0);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Billing History</h1>
          <p className="text-gray-600">
            View your invoices, payments, and billing information.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {hasNoData ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <DollarSign className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Billing History</h3>
          <p className="text-gray-600 mb-6">
            You don't have any billing history yet. Upgrade to a paid plan to start seeing invoices and payments here.
          </p>
          <button
            onClick={() => window.location.href = '/dashboard?tab=subscription'}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            View Plans
          </button>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center">
                <div className="bg-blue-100 rounded-lg p-3">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500">Total Invoices</h3>
                  <p className="text-2xl font-bold text-gray-900">{billingData?.invoices.length || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center">
                <div className="bg-green-100 rounded-lg p-3">
                  <CreditCard className="h-6 w-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500">Successful Payments</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {billingData?.payments.filter(p => p.status === 'succeeded').length || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg border p-6">
              <div className="flex items-center">
                <div className="bg-purple-100 rounded-lg p-3">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <h3 className="text-sm font-medium text-gray-500">Total Paid</h3>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(
                      billingData?.payments
                        .filter(p => p.status === 'succeeded')
                        .reduce((sum, p) => sum + p.amount, 0) || 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b mb-6">
            <nav className="flex">
              <button
                onClick={() => setActiveTab('invoices')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'invoices'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Invoices ({billingData?.invoices.length || 0})
              </button>
              <button
                onClick={() => setActiveTab('payments')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === 'payments'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                Payments ({billingData?.payments.length || 0})
              </button>
            </nav>
          </div>

          {/* Content */}
          <div className="space-y-4">
            {activeTab === 'invoices' && (
              <>
                {billingData?.invoices.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices</h3>
                    <p className="text-gray-600">You don't have any invoices yet.</p>
                  </div>
                ) : (
                  billingData?.invoices.map((invoice) => (
                    <InvoiceCard key={invoice.id} invoice={invoice} />
                  ))
                )}
              </>
            )}

            {activeTab === 'payments' && (
              <>
                {billingData?.payments.length === 0 ? (
                  <div className="text-center py-8">
                    <CreditCard className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Payments</h3>
                    <p className="text-gray-600">You don't have any payments yet.</p>
                  </div>
                ) : (
                  billingData?.payments.map((payment) => (
                    <PaymentCard key={payment.id} payment={payment} />
                  ))
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default BillingHistory;