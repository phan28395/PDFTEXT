// Performance optimization utilities
// Includes code splitting, lazy loading, caching, and optimization strategies

import { ComponentType, lazy, LazyExoticComponent } from 'react';

// Image optimization and lazy loading
export function optimizeImage(src: string, width?: number, height?: number): string {
  // Add optimization parameters based on your CDN or image service
  const params = new URLSearchParams();
  
  if (width) params.append('w', width.toString());
  if (height) params.append('h', height.toString());
  params.append('f', 'auto'); // Auto format selection
  params.append('q', '80'); // Quality 80%
  
  const separator = src.includes('?') ? '&' : '?';
  return `${src}${separator}${params.toString()}`;
}

// Intersection Observer for lazy loading
export class IntersectionObserverManager {
  private static instance: IntersectionObserverManager;
  private observer: IntersectionObserver;
  private callbacks = new Map<Element, () => void>();

  private constructor() {
    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const callback = this.callbacks.get(entry.target);
            if (callback) {
              callback();
              this.unobserve(entry.target);
            }
          }
        });
      },
      {
        rootMargin: '50px 0px',
        threshold: 0.1
      }
    );
  }

  static getInstance(): IntersectionObserverManager {
    if (!IntersectionObserverManager.instance) {
      IntersectionObserverManager.instance = new IntersectionObserverManager();
    }
    return IntersectionObserverManager.instance;
  }

  observe(element: Element, callback: () => void): void {
    this.callbacks.set(element, callback);
    this.observer.observe(element);
  }

  unobserve(element: Element): void {
    this.callbacks.delete(element);
    this.observer.unobserve(element);
  }
}

// Dynamic import wrapper with error handling
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallbackComponent?: ComponentType
): LazyExoticComponent<T> {
  return lazy(async () => {
    try {
      return await importFn();
    } catch (error) {
      console.error('Failed to load component:', error);
      
      // Return fallback or empty component
      if (fallbackComponent) {
        return { default: fallbackComponent as T };
      }
      
      // Return minimal error component
      return {
        default: (() => {
          return null; // Error component fallback
        }) as T
      };
    }
  });
}

// Resource prefetching
export class ResourcePrefetcher {
  private static preloadedModules = new Set<string>();
  private static preloadedImages = new Set<string>();

  // Preload a module/component
  static preloadModule(importFn: () => Promise<any>): void {
    const moduleKey = importFn.toString();
    if (!this.preloadedModules.has(moduleKey)) {
      this.preloadedModules.add(moduleKey);
      importFn().catch((error) => {
        console.warn('Failed to preload module:', error);
        this.preloadedModules.delete(moduleKey);
      });
    }
  }

  // Preload an image
  static preloadImage(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.preloadedImages.has(src)) {
        resolve();
        return;
      }

      const img = new Image();
      img.onload = () => {
        this.preloadedImages.add(src);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  // Preload multiple images
  static preloadImages(srcs: string[]): Promise<void[]> {
    return Promise.allSettled(srcs.map(src => this.preloadImage(src)))
      .then(() => []);
  }

  // Preload critical resources for a route
  static preloadRoute(routeResources: {
    modules?: Array<() => Promise<any>>;
    images?: string[];
    stylesheets?: string[];
  }): void {
    // Preload modules
    if (routeResources.modules) {
      routeResources.modules.forEach(module => this.preloadModule(module));
    }

    // Preload images
    if (routeResources.images) {
      this.preloadImages(routeResources.images);
    }

    // Preload stylesheets
    if (routeResources.stylesheets) {
      routeResources.stylesheets.forEach(href => this.preloadStylesheet(href));
    }
  }

  private static preloadStylesheet(href: string): void {
    if (document.querySelector(`link[href="${href}"]`)) return;

    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'style';
    link.href = href;
    document.head.appendChild(link);

    // Also add the actual stylesheet
    setTimeout(() => {
      const styleLink = document.createElement('link');
      styleLink.rel = 'stylesheet';
      styleLink.href = href;
      document.head.appendChild(styleLink);
    }, 100);
  }
}

// Memory management utilities
export class MemoryManager {
  private static cache = new Map<string, any>();
  private static cacheTimestamps = new Map<string, number>();
  private static maxCacheSize = 100;
  private static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // Cache data with automatic cleanup
  static set(key: string, value: any, timeout?: number): void {
    // Clean old entries if cache is full
    if (this.cache.size >= this.maxCacheSize) {
      this.cleanup();
    }

    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now() + (timeout || this.cacheTimeout));
  }

  // Get cached data
  static get<T>(key: string): T | null {
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp || Date.now() > timestamp) {
      this.delete(key);
      return null;
    }

    return this.cache.get(key) || null;
  }

  // Delete cached data
  static delete(key: string): void {
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
  }

  // Clean expired entries
  static cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    this.cacheTimestamps.forEach((timestamp, key) => {
      if (now > timestamp) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach(key => this.delete(key));
  }

  // Clear all cache
  static clear(): void {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  // Get cache statistics
  static getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      utilization: (this.cache.size / this.maxCacheSize) * 100
    };
  }
}

// Debounce utility for performance
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) func(...args);
    };

    const callNow = immediate && !timeout;
    
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) func(...args);
  };
}

// Throttle utility for performance
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// Virtual scrolling helper
export class VirtualScrollManager {
  private containerHeight: number;
  private itemHeight: number;
  private totalItems: number;
  private scrollTop: number = 0;
  private overscan: number = 5;

  constructor(containerHeight: number, itemHeight: number, totalItems: number) {
    this.containerHeight = containerHeight;
    this.itemHeight = itemHeight;
    this.totalItems = totalItems;
  }

  getVisibleRange(scrollTop: number) {
    this.scrollTop = scrollTop;
    
    const startIndex = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.overscan);
    const endIndex = Math.min(
      this.totalItems - 1,
      Math.ceil((scrollTop + this.containerHeight) / this.itemHeight) + this.overscan
    );

    return {
      startIndex,
      endIndex,
      offsetY: startIndex * this.itemHeight,
      totalHeight: this.totalItems * this.itemHeight
    };
  }

  updateScrollTop(scrollTop: number) {
    this.scrollTop = scrollTop;
  }
}

// Bundle analysis and optimization
export class BundleOptimizer {
  // Check if a feature should be loaded based on user context
  static shouldLoadFeature(feature: string, userContext?: any): boolean {
    const featureFlags = {
      'admin-panel': userContext?.role === 'admin',
      'batch-processing': userContext?.subscriptionPlan === 'pro',
      'advanced-analytics': userContext?.subscriptionPlan === 'pro',
      'export-features': true // Always load
    };

    return featureFlags[feature as keyof typeof featureFlags] ?? false;
  }

  // Dynamic import with feature flags
  static async loadFeature(
    feature: string,
    importFn: () => Promise<any>,
    userContext?: any
  ): Promise<any> {
    if (!this.shouldLoadFeature(feature, userContext)) {
      return null;
    }

    try {
      return await importFn();
    } catch (error) {
      console.error(`Failed to load feature ${feature}:`, error);
      return null;
    }
  }
}

// Performance monitoring integration
export class PerformanceOptimizer {
  private static metrics = new Map<string, number[]>();

  // Measure and track performance
  static measure(name: string, fn: () => any): any {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;

    // Track metrics
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(duration);

    // Keep only last 100 measurements
    const measurements = this.metrics.get(name)!;
    if (measurements.length > 100) {
      measurements.shift();
    }

    return result;
  }

  // Get performance statistics
  static getStats(name: string) {
    const measurements = this.metrics.get(name) || [];
    if (measurements.length === 0) return null;

    const sum = measurements.reduce((a, b) => a + b, 0);
    const avg = sum / measurements.length;
    const min = Math.min(...measurements);
    const max = Math.max(...measurements);

    return { avg, min, max, count: measurements.length };
  }

  // Get all performance metrics
  static getAllStats() {
    const stats: Record<string, any> = {};
    this.metrics.forEach((_, name) => {
      stats[name] = this.getStats(name);
    });
    return stats;
  }
}

// Export all optimization utilities (removing duplicate exports)
export {
  IntersectionObserverManager as LazyLoader
};