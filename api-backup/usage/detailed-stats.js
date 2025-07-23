import { supabase } from '../../src/lib/supabase';
import { rateLimit, securityHeaders, logSecurityEvent } from '../../src/lib/rateLimit';

export default async function handler(req, res) {
  // Apply security headers
  securityHeaders(req, res);

  // Only allow GET method
  if (req.method !== 'GET') {
    await logSecurityEvent({
      type: 'method_not_allowed',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/usage/detailed-stats',
      method: req.method
    });
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimit(req, 'general');
    if (!rateLimitResult.success) {
      return res.status(rateLimitResult.status).json({
        success: false,
        error: rateLimitResult.error
      });
    }

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
        endpoint: '/api/usage/detailed-stats',
        details: { error: authError?.message }
      });
      return res.status(401).json({
        success: false,
        error: 'Invalid authentication token'
      });
    }

    const userId = userData.user.id;
    const { timeframe = '30d' } = req.query;

    // Calculate date range based on timeframe
    const now = new Date();
    let startDate = new Date();
    
    switch (timeframe) {
      case '7d':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(now.getDate() - 90);
        break;
      case '1y':
        startDate.setFullYear(now.getFullYear() - 1);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    try {
      // Get user's current usage info
      const { data: userInfo, error: userError } = await supabase
        .from('users')
        .select('pages_used, pages_limit, pages_processed_this_month, subscription_plan, subscription_status, created_at')
        .eq('id', userId)
        .single();

      if (userError) {
        console.error('User info fetch error:', userError);
        return res.status(404).json({
          success: false,
          error: 'User not found'
        });
      }

      // Get processing history for the timeframe
      const { data: processingHistory, error: historyError } = await supabase
        .from('processing_history')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (historyError) {
        console.error('Processing history error:', historyError);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch processing history'
        });
      }

      // Calculate statistics
      const totalProcessed = processingHistory?.length || 0;
      const totalPages = processingHistory?.reduce((sum, record) => sum + (record.pages_processed || 0), 0) || 0;
      const successfulProcessing = processingHistory?.filter(record => record.processing_status === 'completed') || [];
      const failedProcessing = processingHistory?.filter(record => record.processing_status === 'failed') || [];
      
      const successRate = totalProcessed > 0 ? (successfulProcessing.length / totalProcessed) * 100 : 0;
      const averageProcessingTime = successfulProcessing.length > 0 
        ? successfulProcessing.reduce((sum, record) => sum + (record.processing_time_ms || 0), 0) / successfulProcessing.length
        : 0;
      const averagePagesPerDocument = totalProcessed > 0 ? totalPages / totalProcessed : 0;

      // Group by date for chart data
      const dailyUsage = {};
      const formatMapping = {};
      const last30Days = [];

      // Initialize last 30 days
      for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        last30Days.push(dateStr);
        dailyUsage[dateStr] = { pages: 0, documents: 0, success: 0, failed: 0 };
      }

      // Process history data
      processingHistory?.forEach(record => {
        const date = record.created_at.split('T')[0];
        if (dailyUsage[date]) {
          dailyUsage[date].pages += record.pages_processed || 0;
          dailyUsage[date].documents += 1;
          if (record.processing_status === 'completed') {
            dailyUsage[date].success += 1;
          } else if (record.processing_status === 'failed') {
            dailyUsage[date].failed += 1;
          }
        }

        // Count formats
        const format = record.output_format || 'txt';
        formatMapping[format] = (formatMapping[format] || 0) + 1;
      });

      // Convert to array for charts
      const chartData = last30Days.map(date => ({
        date,
        pages: dailyUsage[date].pages,
        documents: dailyUsage[date].documents,
        success: dailyUsage[date].success,
        failed: dailyUsage[date].failed
      }));

      // Get monthly usage trend
      const monthlyData = {};
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7); // YYYY-MM format
        monthlyData[monthStr] = { pages: 0, documents: 0 };
      }

      processingHistory?.forEach(record => {
        const month = record.created_at.slice(0, 7);
        if (monthlyData[month]) {
          monthlyData[month].pages += record.pages_processed || 0;
          monthlyData[month].documents += 1;
        }
      });

      const monthlyTrend = Object.keys(monthlyData).map(month => ({
        month,
        pages: monthlyData[month].pages,
        documents: monthlyData[month].documents
      }));

      // Calculate efficiency metrics
      const recentDocuments = processingHistory?.slice(0, 10) || [];
      const averageFileSize = recentDocuments.length > 0 
        ? recentDocuments.reduce((sum, record) => sum + (record.file_size || 0), 0) / recentDocuments.length
        : 0;

      // Calculate usage projections
      const daysInCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const currentDay = now.getDate();
      const dailyAverage = currentDay > 0 ? userInfo.pages_processed_this_month / currentDay : 0;
      const projectedMonthlyUsage = dailyAverage * daysInCurrentMonth;

      const stats = {
        overview: {
          total_pages_lifetime: userInfo.pages_used,
          pages_limit: userInfo.pages_limit,
          pages_this_month: userInfo.pages_processed_this_month,
          subscription_plan: userInfo.subscription_plan,
          subscription_status: userInfo.subscription_status,
          member_since: userInfo.created_at,
          usage_percentage: userInfo.pages_limit > 0 ? (userInfo.pages_used / userInfo.pages_limit) * 100 : 0,
          monthly_usage_percentage: userInfo.subscription_plan === 'pro' 
            ? (userInfo.pages_processed_this_month / 1000) * 100 
            : (userInfo.pages_used / 10) * 100
        },
        period_stats: {
          timeframe,
          documents_processed: totalProcessed,
          pages_processed: totalPages,
          success_rate: Math.round(successRate * 100) / 100,
          average_processing_time_ms: Math.round(averageProcessingTime),
          average_pages_per_document: Math.round(averagePagesPerDocument * 100) / 100,
          average_file_size_bytes: Math.round(averageFileSize),
          successful_documents: successfulProcessing.length,
          failed_documents: failedProcessing.length
        },
        projections: {
          daily_average: Math.round(dailyAverage * 100) / 100,
          projected_monthly_usage: Math.round(projectedMonthlyUsage),
          days_remaining_in_month: daysInCurrentMonth - currentDay,
          projected_overage: userInfo.subscription_plan === 'pro' 
            ? Math.max(0, projectedMonthlyUsage - 1000)
            : Math.max(0, projectedMonthlyUsage - (10 - userInfo.pages_used))
        },
        charts: {
          daily_usage: chartData,
          monthly_trend: monthlyTrend,
          format_distribution: Object.entries(formatMapping).map(([format, count]) => ({
            format,
            count,
            percentage: Math.round((count / totalProcessed) * 100 * 100) / 100
          })),
          success_failure_ratio: {
            successful: successfulProcessing.length,
            failed: failedProcessing.length,
            success_rate: successRate
          }
        },
        recent_activity: recentDocuments.map(record => ({
          id: record.id,
          filename: record.original_filename,
          pages: record.pages_processed,
          status: record.processing_status,
          created_at: record.created_at,
          processing_time_ms: record.processing_time_ms,
          output_format: record.output_format
        }))
      };

      // Log stats access
      await logSecurityEvent({
        type: 'usage_stats_accessed',
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        endpoint: '/api/usage/detailed-stats',
        details: {
          user_id: userId,
          timeframe,
          total_documents: totalProcessed,
          total_pages: totalPages
        }
      });

      return res.status(200).json({
        success: true,
        data: stats
      });

    } catch (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({
        success: false,
        error: 'Database error while fetching usage statistics'
      });
    }

  } catch (error) {
    console.error('Usage stats error:', error);
    
    await logSecurityEvent({
      type: 'api_error',
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: '/api/usage/detailed-stats',
      details: { error: error.message }
    });

    return res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
}