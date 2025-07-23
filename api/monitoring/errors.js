// Error monitoring API endpoint
import { createClient } from '@supabase/supabase-js'
import { checkRateLimit } from '../../src/lib/rateLimit.js'
import { applySecurityHeaders } from '../../src/lib/securityHeaders.js'

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export default async function handler(req, res) {
  // Apply security headers
  applySecurityHeaders(res)
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Rate limiting for error reports
    const clientIp = req.headers['x-forwarded-for'] || req.connection.remoteAddress
    const rateLimitResult = checkRateLimit(clientIp, 'error_reporting')
    
    if (!rateLimitResult.allowed) {
      return res.status(429).json({
        error: 'Too many error reports',
        resetTime: rateLimitResult.resetTime
      })
    }

    const {
      id,
      timestamp,
      level,
      message,
      stack,
      context,
      userId,
      sessionId,
      fingerprint,
      occurrenceCount
    } = req.body

    // Validate required fields
    if (!message || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields: message, sessionId'
      })
    }

    // Check if we've seen this error before (deduplication)
    const { data: existingError } = await supabase
      .from('error_reports')
      .select('id, occurrence_count, last_occurrence')
      .eq('fingerprint', fingerprint)
      .single()

    if (existingError) {
      // Update existing error
      const { error: updateError } = await supabase
        .from('error_reports')
        .update({
          occurrence_count: existingError.occurrence_count + 1,
          last_occurrence: timestamp,
          resolved: false // Reopen if it was resolved
        })
        .eq('id', existingError.id)

      if (updateError) {
        console.error('Error updating error report:', updateError)
        return res.status(500).json({ error: 'Failed to update error report' })
      }

      return res.status(200).json({ 
        success: true, 
        action: 'updated',
        errorId: existingError.id 
      })
    }

    // Create new error report
    const errorData = {
      id,
      timestamp,
      level,
      message: message.substring(0, 1000), // Limit message length
      stack: stack?.substring(0, 5000), // Limit stack trace length
      context: JSON.stringify({
        ...context,
        // Sanitize sensitive data
        breadcrumbs: context.breadcrumbs?.slice(-20) || [] // Keep only last 20 breadcrumbs
      }),
      user_id: userId,
      session_id: sessionId,
      fingerprint,
      occurrence_count: occurrenceCount || 1,
      resolved: false,
      created_at: timestamp,
      last_occurrence: timestamp
    }

    const { data, error } = await supabase
      .from('error_reports')
      .insert(errorData)
      .select()
      .single()

    if (error) {
      console.error('Error inserting error report:', error)
      return res.status(500).json({ error: 'Failed to store error report' })
    }

    // Check for critical errors that need immediate attention
    if (level === 'error' && shouldTriggerImmediateAlert(message, context)) {
      await triggerImmediateAlert(data)
    }

    // Update error statistics
    await updateErrorStatistics(level, userId)

    res.status(201).json({ 
      success: true, 
      action: 'created',
      errorId: data.id 
    })

  } catch (error) {
    console.error('Error in error monitoring endpoint:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
}

function shouldTriggerImmediateAlert(message, context) {
  const criticalPatterns = [
    /payment.*failed/i,
    /stripe.*error/i,
    /database.*connection/i,
    /security.*breach/i,
    /unauthorized.*access/i
  ]
  
  return criticalPatterns.some(pattern => pattern.test(message)) ||
         context?.feature === 'payment' ||
         context?.feature === 'security'
}

async function triggerImmediateAlert(errorData) {
  try {
    // Send to external alerting service (Slack, email, etc.)
    const alertPayload = {
      type: 'critical_error',
      error: errorData,
      timestamp: new Date().toISOString(),
      severity: 'high'
    }

    // Example: Send to Slack webhook
    if (process.env.SLACK_ERROR_WEBHOOK_URL) {
      await fetch(process.env.SLACK_ERROR_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🚨 Critical Error Detected`,
          attachments: [{
            color: 'danger',
            fields: [
              {
                title: 'Error Message',
                value: errorData.message,
                short: false
              },
              {
                title: 'Session ID',
                value: errorData.session_id,
                short: true
              },
              {
                title: 'User ID',
                value: errorData.user_id || 'Anonymous',
                short: true
              }
            ]
          }]
        })
      })
    }

    // Store alert in database
    await supabase
      .from('error_alerts')
      .insert({
        error_id: errorData.id,
        alert_type: 'immediate',
        sent_at: new Date().toISOString(),
        status: 'sent'
      })

  } catch (error) {
    console.error('Failed to trigger immediate alert:', error)
  }
}

async function updateErrorStatistics(level, userId) {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    // Update daily error counts
    await supabase.rpc('increment_error_count', {
      date: today,
      error_level: level,
      user_id: userId
    })
  } catch (error) {
    console.error('Failed to update error statistics:', error)
  }
}