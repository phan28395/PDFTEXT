// React hooks for performance optimization
// Provides hooks for lazy loading, virtual scrolling, and performance monitoring

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { 
  IntersectionObserverManager, 
  ResourcePrefetcher, 
  MemoryManager,
  VirtualScrollManager,
  debounce,
  throttle
} from '../lib/performanceOptimization';

// Hook for lazy loading content when it becomes visible
export function useLazyLoad<T>(
  loadFunction: () => Promise<T>,
  dependencies: any[] = []
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const elementRef = useRef<HTMLElement>(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || hasLoaded.current) return;

    const observer = IntersectionObserverManager.getInstance();
    
    const loadData = async () => {
      if (hasLoaded.current) return;
      
      setLoading(true);
      setError(null);
      hasLoaded.current = true;
      
      try {
        const result = await loadFunction();
        setData(result);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    observer.observe(element, loadData);

    return () => {
      observer.unobserve(element);
    };
  }, dependencies);

  return {
    data,
    loading,
    error,
    elementRef
  };
}

// Hook for virtual scrolling large lists
export function useVirtualScroll(
  items: any[],
  itemHeight: number,
  containerHeight: number,
  overscan = 5
) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLElement>(null);

  const virtualizer = useMemo(
    () => new VirtualScrollManager(containerHeight, itemHeight, items.length),
    [containerHeight, itemHeight, items.length]
  );

  const visibleRange = useMemo(
    () => virtualizer.getVisibleRange(scrollTop),
    [virtualizer, scrollTop]
  );

  const handleScroll = useCallback(
    throttle((event: Event) => {
      const target = event.target as HTMLElement;
      setScrollTop(target.scrollTop);
    }, 16), // ~60fps
    []
  );

  useEffect(() => {
    const element = scrollElementRef.current;
    if (!element) return;

    element.addEventListener('scroll', handleScroll, { passive: true });
    return () => element.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const visibleItems = useMemo(
    () => items.slice(visibleRange.startIndex, visibleRange.endIndex + 1),
    [items, visibleRange.startIndex, visibleRange.endIndex]
  );

  return {
    scrollElementRef,
    visibleItems,
    visibleRange,
    totalHeight: visibleRange.totalHeight,
    offsetY: visibleRange.offsetY
  };
}

// Hook for performance monitoring
export function usePerformanceMonitoring(componentName: string) {
  const startTime = useRef<number>(Date.now());
  const [metrics, setMetrics] = useState({
    renderTime: 0,
    mountTime: 0,
    updateCount: 0
  });

  // Track component mount time
  useEffect(() => {
    const mountTime = Date.now() - startTime.current;
    setMetrics(prev => ({ ...prev, mountTime }));
  }, []);

  // Track render time
  useEffect(() => {
    const renderTime = Date.now() - startTime.current;
    setMetrics(prev => ({ 
      ...prev, 
      renderTime,
      updateCount: prev.updateCount + 1
    }));
    startTime.current = Date.now();
  });

  // Report metrics to performance monitoring
  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.performance && window.performance.mark) {
        window.performance.mark(`${componentName}-render`);
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [componentName]);

  return metrics;
}

// Hook for debounced values
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Hook for throttled functions
export function useThrottle<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): T {
  const throttledFunction = useMemo(
    () => throttle(func, delay),
    [func, delay]
  );

  return throttledFunction as T;
}

// Hook for memory-efficient caching
export function useCache<T>(key: string, fetchFunction: () => Promise<T>) {
  const [data, setData] = useState<T | null>(() => MemoryManager.get<T>(key));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction();
      setData(result);
      MemoryManager.set(key, result);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, fetchFunction]);

  useEffect(() => {
    const cachedData = MemoryManager.get<T>(key);
    if (!cachedData) {
      refetch();
    }
  }, [key, refetch]);

  return {
    data,
    loading,
    error,
    refetch
  };
}

// Hook for image lazy loading
export function useLazyImage(src: string, placeholder?: string) {
  const [imageSrc, setImageSrc] = useState(placeholder || '');
  const [imageRef, setImageRef] = useState<HTMLImageElement | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!imageRef) return;

    const observer = IntersectionObserverManager.getInstance();

    const loadImage = () => {
      const img = new Image();
      img.onload = () => {
        setImageSrc(src);
        setLoaded(true);
        setError(false);
      };
      img.onerror = () => {
        setError(true);
        setLoaded(false);
      };
      img.src = src;
    };

    observer.observe(imageRef, loadImage);

    return () => {
      if (imageRef) {
        observer.unobserve(imageRef);
      }
    };
  }, [src, imageRef]);

  return {
    imageSrc,
    loaded,
    error,
    setImageRef
  };
}

// Hook for route prefetching
export function useRoutePrefetch() {
  const prefetchRoute = useCallback((routeModules: Array<() => Promise<any>>) => {
    routeModules.forEach(module => {
      ResourcePrefetcher.preloadModule(module);
    });
  }, []);

  const prefetchImages = useCallback((images: string[]) => {
    ResourcePrefetcher.preloadImages(images);
  }, []);

  return {
    prefetchRoute,
    prefetchImages
  };
}

// Hook for measuring component performance
export function useComponentPerformance(name: string) {
  const renderStart = useRef<number>(0);
  const [performanceData, setPerformanceData] = useState({
    averageRenderTime: 0,
    renderCount: 0,
    slowRenders: 0
  });

  useEffect(() => {
    renderStart.current = performance.now();
  });

  useEffect(() => {
    const renderTime = performance.now() - renderStart.current;
    
    setPerformanceData(prev => {
      const newRenderCount = prev.renderCount + 1;
      const newAverageRenderTime = 
        (prev.averageRenderTime * prev.renderCount + renderTime) / newRenderCount;
      const newSlowRenders = renderTime > 16 ? prev.slowRenders + 1 : prev.slowRenders;

      return {
        averageRenderTime: newAverageRenderTime,
        renderCount: newRenderCount,
        slowRenders: newSlowRenders
      };
    });

    // Log slow renders in development
    if (process.env.NODE_ENV === 'development' && renderTime > 16) {
      console.warn(`Slow render detected in ${name}: ${renderTime.toFixed(2)}ms`);
    }
  });

  return performanceData;
}

// Hook for managing loading states efficiently
export function useOptimizedLoading(initialLoading = false) {
  const [loading, setLoading] = useState(initialLoading);
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({});

  const setStateLoading = useCallback((state: string, isLoading: boolean) => {
    setLoadingStates(prev => {
      const newStates = { ...prev, [state]: isLoading };
      const hasAnyLoading = Object.values(newStates).some(Boolean);
      setLoading(hasAnyLoading);
      return newStates;
    });
  }, []);

  const getStateLoading = useCallback((state: string) => {
    return loadingStates[state] || false;
  }, [loadingStates]);

  return {
    loading,
    setLoading,
    setStateLoading,
    getStateLoading,
    loadingStates
  };
}

// Hook for efficient list rendering with pagination
export function useOptimizedList<T>(
  items: T[],
  pageSize = 20,
  enableVirtualization = false,
  itemHeight = 50
) {
  const [currentPage, setCurrentPage] = useState(0);
  const [containerHeight] = useState(400); // Default container height

  const paginatedItems = useMemo(() => {
    if (enableVirtualization) return items;
    
    const startIndex = currentPage * pageSize;
    const endIndex = startIndex + pageSize;
    return items.slice(startIndex, endIndex);
  }, [items, currentPage, pageSize, enableVirtualization]);

  const virtualScrollProps = useVirtualScroll(
    items,
    itemHeight,
    containerHeight
  );

  const totalPages = Math.ceil(items.length / pageSize);
  const hasNextPage = currentPage < totalPages - 1;
  const hasPrevPage = currentPage > 0;

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage(prev => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage(prev => prev - 1);
    }
  }, [hasPrevPage]);

  const goToPage = useCallback((page: number) => {
    const clampedPage = Math.max(0, Math.min(page, totalPages - 1));
    setCurrentPage(clampedPage);
  }, [totalPages]);

  if (enableVirtualization) {
    return {
      items: virtualScrollProps.visibleItems,
      ...virtualScrollProps,
      currentPage: 0,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
      nextPage: () => {},
      prevPage: () => {},
      goToPage: () => {}
    };
  }

  return {
    items: paginatedItems,
    currentPage,
    totalPages,
    hasNextPage,
    hasPrevPage,
    nextPage,
    prevPage,
    goToPage,
    scrollElementRef: null,
    totalHeight: 0,
    offsetY: 0
  };
}