// Performance monitoring system for PDF-to-Text SaaS
// Tracks application performance, user interactions, and system health

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface WebVitalsMetric {
  name: 'CLS' | 'FCP' | 'FID' | 'LCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: Date;
}

export interface APIPerformanceMetric {
  endpoint: string;
  method: string;
  duration: number;
  status: number;
  timestamp: Date;
  userId?: string;
  error?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private webVitals: WebVitalsMetric[] = [];
  private apiMetrics: APIPerformanceMetric[] = [];
  private isEnabled = true;
  private maxMetrics = 1000; // Keep last 1000 metrics in memory

  constructor() {
    this.initializeWebVitals();
    this.setupNavigationTiming();
    this.setupResourceTiming();
  }

  // Initialize Web Vitals monitoring
  private initializeWebVitals() {
    if (typeof window === 'undefined') return;

    // Monitor Largest Contentful Paint (LCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      this.recordWebVital('LCP', lastEntry.startTime);
    }).observe({ entryTypes: ['largest-contentful-paint'] });

    // Monitor First Input Delay (FID)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        this.recordWebVital('FID', entry.processingStart - entry.startTime);
      });
    }).observe({ entryTypes: ['first-input'] });

    // Monitor Cumulative Layout Shift (CLS)
    let clsValue = 0;
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
        }
      });
      this.recordWebVital('CLS', clsValue);
    }).observe({ entryTypes: ['layout-shift'] });

    // Monitor First Contentful Paint (FCP)
    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry: any) => {
        if (entry.name === 'first-contentful-paint') {
          this.recordWebVital('FCP', entry.startTime);
        }
      });
    }).observe({ entryTypes: ['paint'] });
  }

  // Record Web Vital metric
  private recordWebVital(name: WebVitalsMetric['name'], value: number) {
    const rating = this.getWebVitalRating(name, value);
    const metric: WebVitalsMetric = {
      name,
      value,
      rating,
      timestamp: new Date()
    };

    this.webVitals.push(metric);
    if (this.webVitals.length > this.maxMetrics) {
      this.webVitals.shift();
    }

    // Send to API if enabled
    if (this.isEnabled) {
      this.sendMetricToAPI('web-vital', {
        name,
        value,
        rating,
        url: window.location.pathname,
        userAgent: navigator.userAgent
      });
    }
  }

  // Get Web Vital rating based on thresholds
  private getWebVitalRating(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
    const thresholds = {
      CLS: { good: 0.1, poor: 0.25 },
      FCP: { good: 1800, poor: 3000 },
      FID: { good: 100, poor: 300 },
      LCP: { good: 2500, poor: 4000 },
      TTFB: { good: 800, poor: 1800 }
    };

    const threshold = thresholds[name as keyof typeof thresholds];
    if (!threshold) return 'good';

    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  }

  // Setup navigation timing monitoring
  private setupNavigationTiming() {
    if (typeof window === 'undefined') return;

    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        if (navigation) {
          this.recordMetric('page-load-time', navigation.loadEventEnd - navigation.fetchStart, 'ms');
          this.recordMetric('dom-content-loaded', navigation.domContentLoadedEventEnd - navigation.fetchStart, 'ms');
          this.recordMetric('first-byte', navigation.responseStart - navigation.requestStart, 'ms');
          this.recordWebVital('TTFB', navigation.responseStart - navigation.requestStart);
        }
      }, 0);
    });
  }

  // Setup resource timing monitoring
  private setupResourceTiming() {
    if (typeof window === 'undefined') return;

    new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      entries.forEach((entry) => {
        if (entry.duration > 1000) { // Only track slow resources (>1s)
          this.recordMetric('slow-resource', entry.duration, 'ms', {
            name: entry.name,
            type: (entry as any).initiatorType
          });
        }
      });
    }).observe({ entryTypes: ['resource'] });
  }

  // Record custom performance metric
  recordMetric(name: string, value: number, unit: string = 'ms', metadata?: Record<string, any>) {
    const metric: PerformanceMetric = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      value,
      unit,
      timestamp: new Date(),
      metadata
    };

    this.metrics.push(metric);
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }

    if (this.isEnabled) {
      this.sendMetricToAPI('custom', metric);
    }
  }

  // Record API performance
  recordAPICall(
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    userId?: string,
    error?: string
  ) {
    const metric: APIPerformanceMetric = {
      endpoint,
      method,
      duration,
      status,
      timestamp: new Date(),
      userId,
      error
    };

    this.apiMetrics.push(metric);
    if (this.apiMetrics.length > this.maxMetrics) {
      this.apiMetrics.shift();
    }

    if (this.isEnabled) {
      this.sendMetricToAPI('api', metric);
    }
  }

  // Send metric to API
  private async sendMetricToAPI(type: string, data: any) {
    try {
      await fetch('/api/metrics/performance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type,
          data,
          timestamp: new Date().toISOString(),
          url: typeof window !== 'undefined' ? window.location.pathname : '',
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : ''
        })
      });
    } catch (error) {
      console.warn('Failed to send performance metric:', error);
    }
  }

  // Get performance summary
  getPerformanceSummary() {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);

    const recentMetrics = this.metrics.filter(m => m.timestamp.getTime() > oneHourAgo);
    const recentWebVitals = this.webVitals.filter(m => m.timestamp.getTime() > oneHourAgo);
    const recentAPIMetrics = this.apiMetrics.filter(m => m.timestamp.getTime() > oneHourAgo);

    return {
      metrics: {
        total: recentMetrics.length,
        byName: this.groupMetricsByName(recentMetrics)
      },
      webVitals: {
        total: recentWebVitals.length,
        ratings: this.getWebVitalsRatings(recentWebVitals)
      },
      api: {
        total: recentAPIMetrics.length,
        averageResponseTime: this.calculateAverageResponseTime(recentAPIMetrics),
        errorRate: this.calculateErrorRate(recentAPIMetrics),
        slowRequests: recentAPIMetrics.filter(m => m.duration > 2000).length
      }
    };
  }

  // Group metrics by name for analysis
  private groupMetricsByName(metrics: PerformanceMetric[]) {
    return metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = {
          count: 0,
          totalValue: 0,
          averageValue: 0,
          minValue: metric.value,
          maxValue: metric.value
        };
      }

      acc[metric.name].count++;
      acc[metric.name].totalValue += metric.value;
      acc[metric.name].averageValue = acc[metric.name].totalValue / acc[metric.name].count;
      acc[metric.name].minValue = Math.min(acc[metric.name].minValue, metric.value);
      acc[metric.name].maxValue = Math.max(acc[metric.name].maxValue, metric.value);

      return acc;
    }, {} as Record<string, any>);
  }

  // Get Web Vitals ratings summary
  private getWebVitalsRatings(webVitals: WebVitalsMetric[]) {
    return webVitals.reduce((acc, vital) => {
      if (!acc[vital.name]) {
        acc[vital.name] = { good: 0, 'needs-improvement': 0, poor: 0 };
      }
      acc[vital.name][vital.rating]++;
      return acc;
    }, {} as Record<string, Record<string, number>>);
  }

  // Calculate average API response time
  private calculateAverageResponseTime(apiMetrics: APIPerformanceMetric[]) {
    if (apiMetrics.length === 0) return 0;
    const total = apiMetrics.reduce((sum, metric) => sum + metric.duration, 0);
    return total / apiMetrics.length;
  }

  // Calculate API error rate
  private calculateErrorRate(apiMetrics: APIPerformanceMetric[]) {
    if (apiMetrics.length === 0) return 0;
    const errorCount = apiMetrics.filter(metric => metric.status >= 400).length;
    return (errorCount / apiMetrics.length) * 100;
  }

  // Enable/disable monitoring
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
  }

  // Get all metrics for export
  getAllMetrics() {
    return {
      metrics: this.metrics,
      webVitals: this.webVitals,
      apiMetrics: this.apiMetrics
    };
  }

  // Clear all metrics
  clearMetrics() {
    this.metrics = [];
    this.webVitals = [];
    this.apiMetrics = [];
  }
}

// Create global instance
export const performanceMonitor = new PerformanceMonitor();

// React hook for performance monitoring
export function usePerformanceMonitoring() {
  const recordMetric = (name: string, value: number, unit = 'ms', metadata?: Record<string, any>) => {
    performanceMonitor.recordMetric(name, value, unit, metadata);
  };

  const recordAPICall = (
    endpoint: string,
    method: string,
    duration: number,
    status: number,
    userId?: string,
    error?: string
  ) => {
    performanceMonitor.recordAPICall(endpoint, method, duration, status, userId, error);
  };

  const getPerformanceSummary = () => {
    return performanceMonitor.getPerformanceSummary();
  };

  return {
    recordMetric,
    recordAPICall,
    getPerformanceSummary
  };
}

// API wrapper with performance tracking
export function withPerformanceTracking<T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  endpoint: string,
  method = 'GET'
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = performance.now();
    let status = 200;
    let error: string | undefined;

    try {
      const result = await apiFunction(...args);
      return result;
    } catch (err) {
      status = (err as any).status || 500;
      error = (err as Error).message;
      throw err;
    } finally {
      const duration = performance.now() - startTime;
      performanceMonitor.recordAPICall(endpoint, method, duration, status, undefined, error);
    }
  }) as T;
}

// Performance timing decorator
export function measurePerformance(name: string, metadata?: Record<string, any>) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const startTime = performance.now();
      try {
        const result = await originalMethod.apply(this, args);
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric(name, duration, 'ms', metadata);
        return result;
      } catch (error) {
        const duration = performance.now() - startTime;
        performanceMonitor.recordMetric(`${name}-error`, duration, 'ms', { 
          ...metadata, 
          error: (error as Error).message 
        });
        throw error;
      }
    };

    return descriptor;
  };
}