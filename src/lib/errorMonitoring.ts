// Error monitoring and logging system
import { User } from '@supabase/supabase-js'

export interface ErrorReport {
  id: string
  timestamp: string
  level: 'error' | 'warn' | 'info'
  message: string
  stack?: string
  context: ErrorContext
  userId?: string
  sessionId: string
  fingerprint: string
  resolved: boolean
  occurrenceCount: number
}

export interface ErrorContext {
  url: string
  userAgent: string
  userId?: string
  feature?: string
  action?: string
  metadata?: Record<string, any>
  breadcrumbs: Breadcrumb[]
}

export interface Breadcrumb {
  timestamp: string
  category: 'navigation' | 'user_action' | 'api_call' | 'state_change'
  message: string
  level: 'info' | 'warn' | 'error'
  data?: Record<string, any>
}

export interface AlertRule {
  id: string
  name: string
  condition: {
    errorPattern?: string
    threshold: number
    timeWindow: number // minutes
    level?: 'error' | 'warn'
  }
  actions: {
    email?: string[]
    slack?: string
    webhook?: string
  }
  enabled: boolean
}

class ErrorMonitoringService {
  private breadcrumbs: Breadcrumb[] = []
  private sessionId: string
  private userId?: string
  private maxBreadcrumbs = 50
  private alertRules: AlertRule[] = []
  private errorCache = new Map<string, { count: number; lastOccurrence: Date }>()
  
  constructor() {
    this.sessionId = this.generateSessionId()
    this.setupGlobalErrorHandlers()
    this.setupPerformanceMonitoring()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupGlobalErrorHandlers(): void {
    // Capture JavaScript errors
    window.addEventListener('error', (event) => {
      this.captureError(new Error(event.message), {
        feature: 'global',
        action: 'javascript_error',
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        }
      })
    })

    // Capture unhandled Promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(new Error(event.reason), {
        feature: 'global',
        action: 'unhandled_rejection'
      })
    })

    // Capture React Error Boundary errors (if using custom error boundary)
    if (typeof window !== 'undefined') {
      (window as any).reportReactError = (error: Error, errorInfo: any) => {
        this.captureError(error, {
          feature: 'react',
          action: 'component_error',
          metadata: { componentStack: errorInfo.componentStack }
        })
      }
    }
  }

  private setupPerformanceMonitoring(): void {
    // Monitor page load performance
    if ('performance' in window) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          const timing = performance.timing
          const loadTime = timing.loadEventEnd - timing.navigationStart
          
          if (loadTime > 5000) { // Alert if load time > 5 seconds
            this.captureError(new Error('Slow page load'), {
              feature: 'performance',
              action: 'page_load',
              metadata: { loadTime }
            })
          }
        }, 0)
      })
    }

    // Monitor API response times
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const start = Date.now()
      const url = args[0]?.toString() || 'unknown'
      
      try {
        const response = await originalFetch(...args)
        const duration = Date.now() - start
        
        this.addBreadcrumb({
          category: 'api_call',
          message: `API call to ${url}`,
          level: response.ok ? 'info' : 'warn',
          data: { 
            url, 
            status: response.status, 
            duration,
            method: args[1]?.method || 'GET'
          }
        })
        
        // Alert on slow API calls
        if (duration > 10000) { // > 10 seconds
          this.captureError(new Error('Slow API response'), {
            feature: 'api',
            action: 'slow_response',
            metadata: { url, duration }
          })
        }
        
        return response
      } catch (error) {
        this.addBreadcrumb({
          category: 'api_call',
          message: `API call failed: ${url}`,
          level: 'error',
          data: { url, error: (error as Error).message }
        })
        throw error
      }
    }
  }

  setUser(user: User | null): void {
    this.userId = user?.id
    this.addBreadcrumb({
      category: 'user_action',
      message: user ? 'User logged in' : 'User logged out',
      level: 'info',
      data: { userId: user?.id, email: user?.email }
    })
  }

  addBreadcrumb(breadcrumb: Omit<Breadcrumb, 'timestamp'>): void {
    const fullBreadcrumb: Breadcrumb = {
      ...breadcrumb,
      timestamp: new Date().toISOString()
    }
    
    this.breadcrumbs.push(fullBreadcrumb)
    
    // Keep only the last N breadcrumbs
    if (this.breadcrumbs.length > this.maxBreadcrumbs) {
      this.breadcrumbs.shift()
    }
  }

  captureError(error: Error, context: Partial<ErrorContext> = {}): void {
    const fingerprint = this.generateErrorFingerprint(error)
    const cached = this.errorCache.get(fingerprint)
    
    // Rate limiting: don't send the same error too frequently
    if (cached && Date.now() - cached.lastOccurrence.getTime() < 60000) {
      cached.count++
      return
    }

    const errorReport: ErrorReport = {
      id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      level: 'error',
      message: error.message,
      stack: error.stack,
      context: {
        url: window.location.href,
        userAgent: navigator.userAgent,
        userId: this.userId,
        breadcrumbs: [...this.breadcrumbs],
        ...context
      },
      userId: this.userId,
      sessionId: this.sessionId,
      fingerprint,
      resolved: false,
      occurrenceCount: cached ? cached.count + 1 : 1
    }

    // Update cache
    this.errorCache.set(fingerprint, {
      count: errorReport.occurrenceCount,
      lastOccurrence: new Date()
    })

    // Send to monitoring service
    this.sendToMonitoringService(errorReport)
    
    // Check alert rules
    this.checkAlertRules(errorReport)
    
    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', errorReport)
    }
  }

  private generateErrorFingerprint(error: Error): string {
    // Create a unique fingerprint for the error based on message and stack
    const key = `${error.message}_${error.stack?.split('\n')[1] || ''}`
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32)
  }

  private async sendToMonitoringService(errorReport: ErrorReport): Promise<void> {
    try {
      // In production, send to external monitoring service (Sentry, DataDog, etc.)
      if (process.env.NODE_ENV === 'production') {
        await fetch('/api/monitoring/errors', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(errorReport)
        })
      }
      
      // Also store in local database for admin dashboard
      await this.storeInDatabase(errorReport)
    } catch (error) {
      console.error('Failed to send error report:', error)
    }
  }

  private async storeInDatabase(errorReport: ErrorReport): Promise<void> {
    // Store in Supabase for admin dashboard
    try {
      await fetch('/api/admin/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(errorReport)
      })
    } catch (error) {
      console.error('Failed to store error in database:', error)
    }
  }

  private async checkAlertRules(errorReport: ErrorReport): Promise<void> {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue
      
      const shouldAlert = await this.evaluateAlertRule(rule, errorReport)
      if (shouldAlert) {
        await this.triggerAlert(rule, errorReport)
      }
    }
  }

  private async evaluateAlertRule(rule: AlertRule, errorReport: ErrorReport): Promise<boolean> {
    const { condition } = rule
    
    // Check error level
    if (condition.level && errorReport.level !== condition.level) {
      return false
    }
    
    // Check error pattern
    if (condition.errorPattern) {
      const regex = new RegExp(condition.errorPattern, 'i')
      if (!regex.test(errorReport.message)) {
        return false
      }
    }
    
    // Check threshold within time window
    const timeWindowMs = condition.timeWindow * 60 * 1000
    const cutoff = Date.now() - timeWindowMs
    
    try {
      const response = await fetch(`/api/admin/errors/count?since=${cutoff}&pattern=${condition.errorPattern || ''}`)
      const data = await response.json()
      
      return data.count >= condition.threshold
    } catch (error) {
      console.error('Failed to check error count:', error)
      return false
    }
  }

  private async triggerAlert(rule: AlertRule, errorReport: ErrorReport): Promise<void> {
    const alertPayload = {
      rule: rule.name,
      error: errorReport,
      timestamp: new Date().toISOString()
    }
    
    try {
      await fetch('/api/monitoring/alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertPayload)
      })
    } catch (error) {
      console.error('Failed to trigger alert:', error)
    }
  }

  // Performance monitoring methods
  measurePerformance(name: string, fn: () => Promise<any>): Promise<any> {
    const start = Date.now()
    
    return fn().then(
      (result) => {
        const duration = Date.now() - start
        this.addBreadcrumb({
          category: 'state_change',
          message: `Performance: ${name} completed`,
          level: 'info',
          data: { duration }
        })
        return result
      },
      (error) => {
        const duration = Date.now() - start
        this.captureError(error, {
          feature: 'performance',
          action: name,
          metadata: { duration }
        })
        throw error
      }
    )
  }

  // User action tracking
  trackUserAction(action: string, metadata?: Record<string, any>): void {
    this.addBreadcrumb({
      category: 'user_action',
      message: `User action: ${action}`,
      level: 'info',
      data: metadata
    })
  }

  // Navigation tracking
  trackNavigation(from: string, to: string): void {
    this.addBreadcrumb({
      category: 'navigation',
      message: `Navigation: ${from} → ${to}`,
      level: 'info',
      data: { from, to }
    })
  }

  // Manual error reporting
  reportError(message: string, context?: Partial<ErrorContext>): void {
    this.captureError(new Error(message), context)
  }

  // Get current session info for debugging
  getSessionInfo(): { sessionId: string; userId?: string; breadcrumbCount: number } {
    return {
      sessionId: this.sessionId,
      userId: this.userId,
      breadcrumbCount: this.breadcrumbs.length
    }
  }
}

// Create singleton instance
export const errorMonitoring = new ErrorMonitoringService()

// React hook for error monitoring
export function useErrorMonitoring() {
  return {
    captureError: (error: Error, context?: Partial<ErrorContext>) => 
      errorMonitoring.captureError(error, context),
    trackUserAction: (action: string, metadata?: Record<string, any>) => 
      errorMonitoring.trackUserAction(action, metadata),
    measurePerformance: (name: string, fn: () => Promise<any>) => 
      errorMonitoring.measurePerformance(name, fn),
    reportError: (message: string, context?: Partial<ErrorContext>) => 
      errorMonitoring.reportError(message, context)
  }
}