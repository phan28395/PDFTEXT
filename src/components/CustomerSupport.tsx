import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { 
  MessageCircle, 
  Send, 
  Ticket, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  User,
  Mail,
  Phone,
  HelpCircle,
  FileText,
  CreditCard,
  Settings,
  Lightbulb,
  MessageSquare,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from './LoadingSpinner';

interface SupportTicket {
  ticket_number: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'waiting_for_customer' | 'closed';
  created_at: string;
  last_updated: string;
  expected_response_time: string;
}

interface SupportCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const SUPPORT_CATEGORIES: SupportCategory[] = [
  {
    id: 'technical',
    name: 'Technical Issues',
    description: 'Problems with uploads, processing, or downloading',
    icon: Settings,
    color: 'blue'
  },
  {
    id: 'billing',
    name: 'Billing & Payments',
    description: 'Questions about subscriptions, invoices, or payments',
    icon: CreditCard,
    color: 'green'
  },
  {
    id: 'account',
    name: 'Account Management',
    description: 'Account settings, password, or profile issues',
    icon: User,
    color: 'purple'
  },
  {
    id: 'feature_request',
    name: 'Feature Request',
    description: 'Suggest new features or improvements',
    icon: Lightbulb,
    color: 'yellow'
  },
  {
    id: 'general',
    name: 'General Questions',
    description: 'General inquiries or other questions',
    icon: MessageSquare,
    color: 'gray'
  }
];

const FAQ_ITEMS = [
  {
    question: 'How do I upload and process a PDF?',
    answer: 'Simply drag and drop your PDF file onto the upload area in your dashboard, or click to browse for files. The system will automatically process your PDF and extract the text.',
    category: 'technical'
  },
  {
    question: 'What file formats are supported?',
    answer: 'Currently, we support PDF files up to 50MB in size. We plan to add support for more formats in the future.',
    category: 'technical'
  },
  {
    question: 'How does billing work?',
    answer: 'Free users get 10 pages per account lifetime. Pro subscribers get 1,000 pages per month for $9.99/month. Usage resets on your billing date.',
    category: 'billing'
  },
  {
    question: 'Can I cancel my subscription anytime?',
    answer: 'Yes, you can cancel your subscription at any time. You\'ll continue to have access until the end of your current billing period.',
    category: 'billing'
  },
  {
    question: 'Is my data secure?',
    answer: 'Yes, we use enterprise-grade encryption for all file uploads and storage. Your files are processed securely and can be deleted at any time.',
    category: 'account'
  },
  {
    question: 'How long are my files stored?',
    answer: 'Processed files and results are stored for 30 days by default. Pro users can access their processing history indefinitely.',
    category: 'account'
  }
];

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'urgent': return 'red';
    case 'high': return 'orange';
    case 'medium': return 'yellow';
    case 'low': return 'gray';
    default: return 'gray';
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'open': return <Clock className="h-4 w-4" />;
    case 'in_progress': return <RefreshCw className="h-4 w-4" />;
    case 'waiting_for_customer': return <MessageCircle className="h-4 w-4" />;
    case 'closed': return <CheckCircle className="h-4 w-4" />;
    default: return <HelpCircle className="h-4 w-4" />;
  }
};

export const CustomerSupport: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'create' | 'tickets' | 'faq'>('create');
  const [loading, setLoading] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    subject: '',
    message: '',
    category: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    user_name: '',
    user_email: ''
  });

  // FAQ state
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [faqFilter, setFaqFilter] = useState<string>('all');

  // Load user info and tickets
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        user_email: user.email || ''
      }));
      
      if (activeTab === 'tickets') {
        loadTickets();
      }
    }
  }, [user, activeTab]);

  const loadTickets = async () => {
    setTicketsLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/support/ticket', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load tickets');
      }

      const result = await response.json();
      
      if (result.success) {
        setTickets(result.data.tickets);
      }
    } catch (error) {
      console.error('Error loading tickets:', error);
      toast.error('Failed to load support tickets');
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.subject.trim() || !formData.message.trim() || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch('/api/support/ticket', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subject: formData.subject.trim(),
          message: formData.message.trim(),
          category: formData.category,
          priority: formData.priority,
          user_name: formData.user_name.trim() || 'User',
          user_email: formData.user_email
        })
      });

      if (!response.ok) {
        throw new Error('Failed to create ticket');
      }

      const result = await response.json();
      
      if (result.success) {
        toast.success(`Support ticket ${result.data.ticket_number} created successfully!`);
        
        // Reset form
        setFormData({
          subject: '',
          message: '',
          category: '',
          priority: 'medium',
          user_name: '',
          user_email: user?.email || ''
        });

        // Switch to tickets tab to show the new ticket
        setActiveTab('tickets');
      } else {
        throw new Error(result.error || 'Failed to create ticket');
      }
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      toast.error(error.message || 'Failed to create support ticket');
    } finally {
      setLoading(false);
    }
  };

  const filteredFAQ = FAQ_ITEMS.filter(item => 
    faqFilter === 'all' || item.category === faqFilter
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Customer Support</h1>
        <p className="text-gray-600">
          Get help with your account, report issues, or ask questions about our service.
        </p>
      </div>

      {/* Contact Information */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Mail className="h-6 w-6 text-blue-600 mr-3" />
            <h3 className="font-medium text-blue-900">Email Support</h3>
          </div>
          <p className="text-blue-700 text-sm mb-2">support@example.com</p>
          <p className="text-blue-600 text-xs">Response within 24 hours</p>
        </div>

        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <MessageCircle className="h-6 w-6 text-green-600 mr-3" />
            <h3 className="font-medium text-green-900">Live Chat</h3>
          </div>
          <p className="text-green-700 text-sm mb-2">Available 9 AM - 5 PM EST</p>
          <button className="text-green-600 text-xs hover:underline flex items-center">
            Start Chat <ExternalLink className="h-3 w-3 ml-1" />
          </button>
        </div>

        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-center mb-4">
            <Phone className="h-6 w-6 text-purple-600 mr-3" />
            <h3 className="font-medium text-purple-900">Phone Support</h3>
          </div>
          <p className="text-purple-700 text-sm mb-2">Pro subscribers only</p>
          <p className="text-purple-600 text-xs">1-800-XXX-XXXX</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b mb-6">
        <nav className="flex">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'create'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            Create Ticket
          </button>
          <button
            onClick={() => setActiveTab('tickets')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'tickets'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            My Tickets
          </button>
          <button
            onClick={() => setActiveTab('faq')}
            className={`px-6 py-3 text-sm font-medium border-b-2 ${
              activeTab === 'faq'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            FAQ
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'create' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Support Categories */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Support Categories</h3>
            <div className="space-y-3">
              {SUPPORT_CATEGORIES.map((category) => {
                const IconComponent = category.icon;
                return (
                  <button
                    key={category.id}
                    onClick={() => setFormData({...formData, category: category.id})}
                    className={`w-full p-4 text-left border rounded-lg transition-colors ${
                      formData.category === category.id
                        ? `border-${category.color}-500 bg-${category.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start">
                      <div className={`bg-${category.color}-100 rounded-lg p-2 mr-3`}>
                        <IconComponent className={`h-5 w-5 text-${category.color}-600`} />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 text-sm">{category.name}</h4>
                        <p className="text-xs text-gray-600 mt-1">{category.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Ticket Form */}
          <div className="lg:col-span-2">
            <div className="bg-white border rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-6">Create Support Ticket</h3>
              
              <form onSubmit={handleSubmitTicket} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      value={formData.user_name}
                      onChange={(e) => setFormData({...formData, user_name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Enter your name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      value={formData.user_email}
                      onChange={(e) => setFormData({...formData, user_email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Subject *
                  </label>
                  <input
                    type="text"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Brief description of your issue"
                    required
                    maxLength={200}
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.subject.length}/200 characters</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="low">Low - General question</option>
                    <option value="medium">Medium - Standard issue</option>
                    <option value="high">High - Urgent issue</option>
                    <option value="urgent">Urgent - Critical problem</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Message *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    rows={6}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Please provide detailed information about your issue, including any error messages and steps to reproduce the problem."
                    required
                    maxLength={5000}
                  />
                  <p className="text-xs text-gray-500 mt-1">{formData.message.length}/5000 characters</p>
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={loading || !formData.category}
                    className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'tickets' && (
        <div>
          {ticketsLoading ? (
            <div className="text-center py-12">
              <LoadingSpinner size="lg" />
              <p className="text-gray-600 mt-4">Loading your support tickets...</p>
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Support Tickets</h3>
              <p className="text-gray-600 mb-6">You haven't created any support tickets yet.</p>
              <button
                onClick={() => setActiveTab('create')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Create Your First Ticket
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {tickets.map((ticket) => (
                <div key={ticket.ticket_number} className="bg-white border rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-medium text-gray-900 flex items-center">
                        <Ticket className="h-4 w-4 mr-2 text-blue-600" />
                        {ticket.ticket_number}
                      </h3>
                      <p className="text-lg text-gray-900 mt-1">{ticket.subject}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${getPriorityColor(ticket.priority)}-100 text-${getPriorityColor(ticket.priority)}-800`}>
                        {ticket.priority}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Status</p>
                      <p className="font-medium text-gray-900 flex items-center">
                        {getStatusIcon(ticket.status)}
                        <span className="ml-2 capitalize">{ticket.status.replace('_', ' ')}</span>
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Category</p>
                      <p className="font-medium text-gray-900 capitalize">{ticket.category.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Created</p>
                      <p className="font-medium text-gray-900">{new Date(ticket.created_at).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Expected Response</p>
                      <p className="font-medium text-gray-900">{ticket.expected_response_time}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'faq' && (
        <div>
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Frequently Asked Questions</h3>
            
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFaqFilter('all')}
                className={`px-3 py-1 rounded-full text-sm ${
                  faqFilter === 'all' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {SUPPORT_CATEGORIES.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setFaqFilter(category.id)}
                  className={`px-3 py-1 rounded-full text-sm capitalize ${
                    faqFilter === category.id 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {filteredFAQ.map((faq, index) => (
              <div key={index} className="bg-white border rounded-lg">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="w-full p-6 text-left hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-gray-900">{faq.question}</h4>
                    <HelpCircle className={`h-5 w-5 text-gray-400 transition-transform ${
                      expandedFaq === index ? 'transform rotate-45' : ''
                    }`} />
                  </div>
                </button>
                {expandedFaq === index && (
                  <div className="px-6 pb-6">
                    <p className="text-gray-700">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-gray-600 mb-4">Can't find what you're looking for?</p>
            <button
              onClick={() => setActiveTab('create')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Create Support Ticket
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerSupport;