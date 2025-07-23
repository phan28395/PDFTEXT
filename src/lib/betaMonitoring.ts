import { supabase } from './supabase';

export interface BetaEvent {
  event_type: string;
  user_id: string;
  metadata?: Record<string, any>;
  page_url?: string;
  feature_name?: string;
}

export interface BetaError {
  error_type: string;
  error_message: string;
  stack_trace?: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

export interface BetaPerformanceMetric {
  metric_name: string;
  value: number;
  unit: string;
  user_id?: string;
  metadata?: Record<string, any>;
}

class BetaMonitoring {
  private isEnabled: boolean;
  private userId: string | null = null;

  constructor() {
    this.isEnabled = import.meta.env.VITE_BETA_TESTING_ENABLED === 'true' && 
                     import.meta.env.NODE_ENV === 'staging';
  }

  setUserId(userId: string | null) {
    this.userId = userId;
  }

  // Track user events during beta testing
  async trackEvent(event: BetaEvent) {
    if (!this.isEnabled || !this.userId) return;

    try {
      const eventData = {
        ...event,
        user_id: this.userId,
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
        session_id: this.getSessionId(),
        browser_info: this.getBrowserInfo()
      };

      // Send to backend API
      await fetch('/api/monitoring/beta-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await this.getAuthToken()}`
        },
        body: JSON.stringify(eventData)
      });

      // Also track in Supabase function
      await supabase.rpc('track_beta_activity', {
        p_page_visited: window.location.pathname,
        p_feature_used: event.feature_name,
        p_action_type: event.event_type
      });
    } catch (error) {
      console.error('Failed to track beta event:', error);
    }
  }

  // Track errors specifically during beta testing
  async trackError(error: BetaError) {
    if (!this.isEnabled) return;

    try {
      const errorData = {
        ...error,
        user_id: this.userId,
        page_url: window.location.href,
        timestamp: new Date().toISOString(),
        browser_info: this.getBrowserInfo(),
        user_agent: navigator.userAgent
      };

      // Send to error monitoring endpoint
      await fetch('/api/monitoring/errors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData)
      });

      // Log to console in development
      if (import.meta.env.DEV) {
        console.error('Beta Error Tracked:', errorData);
      }
    } catch (trackingError) {
      console.error('Failed to track beta error:', trackingError);
    }
  }

  // Track performance metrics
  async trackPerformance(metric: BetaPerformanceMetric) {
    if (!this.isEnabled || !this.userId) return;

    try {
      const performanceData = {
        ...metric,
        user_id: this.userId,
        page_url: window.location.href,
        timestamp: new Date().toISOString()
      };

      await fetch('/api/monitoring/beta-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_type: 'performance_metric',
          user_id: this.userId,
          metadata: performanceData
        })
      });
    } catch (error) {
      console.error('Failed to track performance metric:', error);
    }
  }

  // Track page views automatically
  async trackPageView(pageName: string) {
    await this.trackEvent({
      event_type: 'page_view',
      user_id: this.userId!,
      metadata: {
        page_name: pageName,
        referrer: document.referrer,
        load_time: performance.now()
      }
    });
  }

  // Track feature usage
  async trackFeatureUsage(featureName: string, action: string, metadata?: Record<string, any>) {
    await this.trackEvent({
      event_type: 'feature_usage',
      user_id: this.userId!,
      feature_name: featureName,
      metadata: {
        action,
        ...metadata
      }
    });
  }

  // Track user interactions
  async trackInteraction(elementType: string, elementId: string, action: string) {
    await this.trackEvent({
      event_type: 'user_interaction',
      user_id: this.userId!,
      metadata: {
        element_type: elementType,
        element_id: elementId,
        action: action,
        timestamp: Date.now()
      }
    });
  }

  // Track conversion events
  async trackConversion(conversionType: string, value?: number, metadata?: Record<string, any>) {
    await this.trackEvent({
      event_type: 'conversion',
      user_id: this.userId!,
      metadata: {
        conversion_type: conversionType,
        value,
        ...metadata
      }
    });
  }

  // Monitor and track performance automatically
  startPerformanceMonitoring() {
    if (!this.isEnabled) return;

    // Track page load performance
    window.addEventListener('load', () => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigation) {
        this.trackPerformance({
          metric_name: 'page_load_time',
          value: navigation.loadEventEnd - navigation.loadEventStart,
          unit: 'milliseconds'
        });

        this.trackPerformance({
          metric_name: 'dom_content_loaded',
          value: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          unit: 'milliseconds'
        });
      }
    });

    // Track Core Web Vitals
    this.trackCoreWebVitals();

    // Track resource loading performance
    this.monitorResourcePerformance();

    // Track memory usage (if available)
    this.monitorMemoryUsage();
  }

  // Track Core Web Vitals
  private trackCoreWebVitals() {
    // First Contentful Paint
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.trackPerformance({
            metric_name: 'first_contentful_paint',
            value: entry.startTime,
            unit: 'milliseconds'
          });
        }
      }
    }).observe({ entryTypes: ['paint'] });

    // Largest Contentful Paint
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.trackPerformance({
        metric_name: 'largest_contentful_paint',
        value: lastEntry.startTime,
        unit: 'milliseconds'
      });
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // Cumulative Layout Shift
    let clsValue = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value;
        }
      }
      this.trackPerformance({
        metric_name: 'cumulative_layout_shift',
        value: clsValue,
        unit: 'score'
      });
    }).observe({ entryTypes: ['layout-shift'] });
  }

  // Monitor resource loading performance
  private monitorResourcePerformance() {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const resource = entry as PerformanceResourceTiming;
        if (resource.duration > 1000) { // Track slow resources (>1s)
          this.trackPerformance({
            metric_name: 'slow_resource_load',
            value: resource.duration,
            unit: 'milliseconds',
            metadata: {
              resource_name: resource.name,
              resource_type: resource.initiatorType
            }
          });
        }
      }
    }).observe({ entryTypes: ['resource'] });
  }

  // Monitor memory usage
  private monitorMemoryUsage() {
    if ('memory' in performance) {
      setInterval(() => {
        const memory = (performance as any).memory;
        this.trackPerformance({
          metric_name: 'memory_usage',
          value: memory.usedJSHeapSize,
          unit: 'bytes',
          metadata: {
            total_heap_size: memory.totalJSHeapSize,
            heap_size_limit: memory.jsHeapSizeLimit
          }
        });
      }, 30000); // Every 30 seconds
    }
  }

  // Setup automatic error tracking
  setupErrorTracking() {
    if (!this.isEnabled) return;

    // Track unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.trackError({
        error_type: 'javascript_error',
        error_message: event.message,
        stack_trace: event.error?.stack,
        metadata: {
          filename: event.filename,
          line: event.lineno,
          column: event.colno
        }
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        error_type: 'unhandled_promise_rejection',
        error_message: event.reason?.message || String(event.reason),
        stack_trace: event.reason?.stack,
        metadata: {
          reason: event.reason
        }
      });
    });

    // Track React error boundaries (if using React)
    if (typeof window !== 'undefined' && window.React) {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        // Check if this is a React error
        const errorMessage = args.join(' ');
        if (errorMessage.includes('React') || errorMessage.includes('component')) {
          this.trackError({
            error_type: 'react_error',
            error_message: errorMessage,
            metadata: { args }
          });
        }
        originalConsoleError.apply(console, args);
      };
    }
  }

  // Helper methods
  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('beta_session_id');
    if (!sessionId) {
      sessionId = Math.random().toString(36).substring(2) + Date.now().toString(36);
      sessionStorage.setItem('beta_session_id', sessionId);
    }
    return sessionId;
  }

  private getBrowserInfo() {
    return {
      user_agent: navigator.userAgent,
      screen_resolution: `${screen.width}x${screen.height}`,
      viewport_size: `${window.innerWidth}x${window.innerHeight}`,
      color_depth: screen.colorDepth,
      pixel_ratio: window.devicePixelRatio,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookie_enabled: navigator.cookieEnabled,
      online: navigator.onLine
    };
  }

  private async getAuthToken(): Promise<string | null> {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || null;
  }
}

// Create singleton instance
export const betaMonitoring = new BetaMonitoring();

// Auto-setup if in beta environment
if (typeof window !== 'undefined' && import.meta.env.VITE_BETA_TESTING_ENABLED === 'true') {
  betaMonitoring.setupErrorTracking();
  betaMonitoring.startPerformanceMonitoring();
}