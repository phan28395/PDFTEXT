import { supabase } from '../../src/lib/supabase';
import { rateLimit, securityHeaders, logSecurityEvent } from '../../src/lib/rateLimit';

export default async function handler(req, res) {
  // Apply security headers
  securityHeaders(req, res);

  try {
    // Apply rate limiting (stricter for support tickets to prevent spam)
    const rateLimitResult = await rateLimit(req, 'auth', { maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!rateLimitResult.success) {
      return res.status(rateLimitResult.status).json({
        success: false,
        error: rateLimitResult.error
      });
    }

    if (req.method === 'POST') {
      return await handleCreateTicket(req, res);
    } else if (req.method === 'GET') {
      return await handleGetTickets(req, res);
    } else {
      await logSecurityEvent({
        type: 'method_not_allowed',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/support/ticket',
        method: req.method
      });
      return res.status(405).json({ 
        success: false, 
        error: 'Method not allowed' 
      });
    }

  } catch (error) {
    console.error('Support ticket error:', error);
    
    await logSecurityEvent({
      type: 'api_error',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/support/ticket',
      details: { error: error.message }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

async function handleCreateTicket(req, res) {
  try {
    // Get authorization token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      await logSecurityEvent({
        type: 'unauthorized_access',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/support/ticket',
        details: { error: authError?.message }
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    const { 
      subject, 
      message, 
      category, 
      priority = 'medium',
      user_email,
      user_name,
      additional_info = {}
    } = req.body;

    // Validate required fields
    if (!subject || !message || !category) {
      return res.status(400).json({
        success: false,
        error: 'Subject, message, and category are required'
      });
    }

    // Validate subject and message length
    if (subject.length > 200) {
      return res.status(400).json({
        success: false,
        error: 'Subject must be less than 200 characters'
      });
    }

    if (message.length > 5000) {
      return res.status(400).json({
        success: false,
        error: 'Message must be less than 5000 characters'
      });
    }

    // Validate category
    const validCategories = ['technical', 'billing', 'feature_request', 'account', 'general'];
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid category'
      });
    }

    // Validate priority
    const validPriorities = ['low', 'medium', 'high', 'urgent'];
    if (!validPriorities.includes(priority)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid priority'
      });
    }

    // Sanitize input
    const sanitizedSubject = subject.trim().replace(/[<>\"'&]/g, '');
    const sanitizedMessage = message.trim().replace(/[<>\"'&]/g, '');

    // Get user information
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('email, subscription_plan, subscription_status')
      .eq('id', userData.user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
    }

    // Generate ticket number
    const ticketNumber = 'TKT-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substr(2, 4).toUpperCase();

    // Create support ticket (in a real implementation, you would have a support_tickets table)
    // For now, we'll store it in a mock structure and log it
    const ticketData = {
      ticket_number: ticketNumber,
      user_id: userData.user.id,
      user_email: user_email || userProfile?.email || userData.user.email,
      user_name: user_name || 'User',
      subject: sanitizedSubject,
      message: sanitizedMessage,
      category,
      priority,
      status: 'open',
      created_at: new Date().toISOString(),
      user_subscription_plan: userProfile?.subscription_plan || 'free',
      user_subscription_status: userProfile?.subscription_status || 'free',
      additional_info,
      ip_address: req.ip || req.connection.remoteAddress,
      user_agent: req.headers['user-agent']
    };

    // In a real implementation, you would save this to a database
    console.log('Support ticket created:', ticketData);

    // Log support ticket creation
    await logSecurityEvent({
      type: 'support_ticket_created',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/support/ticket',
      details: {
        user_id: userData.user.id,
        ticket_number: ticketNumber,
        category,
        priority,
        subject: sanitizedSubject.substring(0, 50) + '...'
      }
    });

    // Send email notification (in a real implementation)
    try {
      // await sendSupportTicketNotification(ticketData);
      console.log('Support ticket email notification would be sent here');
    } catch (emailError) {
      console.error('Failed to send support ticket email:', emailError);
      // Don't fail the request if email fails
    }

    return res.status(201).json({
      success: true,
      data: {
        ticket_number: ticketNumber,
        status: 'open',
        created_at: ticketData.created_at,
        expected_response_time: priority === 'urgent' ? '2 hours' : priority === 'high' ? '4 hours' : '24 hours'
      },
      message: 'Support ticket created successfully. You will receive email updates on your ticket status.'
    });

  } catch (error) {
    console.error('Create ticket error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create support ticket'
    });
  }
}

async function handleGetTickets(req, res) {
  try {
    // Get authorization token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authorization token required'
      });
    }

    const token = authHeader.split(' ')[1];
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    // In a real implementation, you would fetch tickets from database
    // For now, return mock data
    const mockTickets = [
      {
        ticket_number: 'TKT-SAMPLE001',
        subject: 'Upload Issue with Large PDF',
        category: 'technical',
        priority: 'medium',
        status: 'open',
        created_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
        last_updated: new Date(Date.now() - 43200000).toISOString(), // 12 hours ago
        expected_response_time: '24 hours'
      }
    ];

    await logSecurityEvent({
      type: 'support_tickets_accessed',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/support/ticket',
      details: {
        user_id: userData.user.id,
        tickets_count: mockTickets.length
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        tickets: mockTickets,
        total_count: mockTickets.length,
        open_count: mockTickets.filter(t => t.status === 'open').length,
        closed_count: mockTickets.filter(t => t.status === 'closed').length
      }
    });

  } catch (error) {
    console.error('Get tickets error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch support tickets'
    });
  }
}