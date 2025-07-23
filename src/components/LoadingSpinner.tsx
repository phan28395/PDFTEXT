import React from 'react';
import { Loader2, FileText, Zap } from 'lucide-react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  color?: 'blue' | 'gray' | 'white';
  className?: string;
}

export function LoadingSpinner({ 
  size = 'md', 
  color = 'blue', 
  className = '' 
}: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const colorClasses = {
    blue: 'text-blue-600',
    gray: 'text-gray-600',
    white: 'text-white'
  };

  return (
    <Loader2 className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]} ${className}`} />
  );
}

interface LoadingStateProps {
  message?: string;
  submessage?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function LoadingState({ 
  message = 'Loading...', 
  submessage,
  size = 'md',
  className = '' 
}: LoadingStateProps) {
  const containerClasses = {
    sm: 'py-8',
    md: 'py-12',
    lg: 'py-20'
  };

  const spinnerSizes = {
    sm: 'lg' as const,
    md: 'xl' as const,
    lg: 'xl' as const
  };

  return (
    <div className={`text-center ${containerClasses[size]} ${className}`}>
      <LoadingSpinner size={spinnerSizes[size]} className="mx-auto mb-4" />
      <h3 className="text-lg font-medium text-gray-900 mb-2">{message}</h3>
      {submessage && (
        <p className="text-sm text-gray-600 max-w-md mx-auto">{submessage}</p>
      )}
    </div>
  );
}

// Specialized loading states
export function ProcessingLoader({ filename }: { filename?: string }) {
  return (
    <div className="text-center py-12">
      <div className="relative">
        <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <FileText className="h-10 w-10 text-blue-600" />
        </div>
        <div className="absolute top-0 right-0 w-8 h-8 bg-white rounded-full border-2 border-blue-200 flex items-center justify-center">
          <Zap className="h-4 w-4 text-blue-600 animate-pulse" />
        </div>
      </div>
      <h3 className="text-lg font-medium text-gray-900 mb-2">Processing PDF</h3>
      <p className="text-sm text-gray-600 max-w-md mx-auto mb-4">
        {filename ? `Converting "${filename}" to text using AI...` : 'Converting your PDF to text using AI...'}
      </p>
      <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
        <div className="flex space-x-1">
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce"></div>
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        </div>
        <span>This usually takes 10-30 seconds</span>
      </div>
    </div>
  );
}

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
  width?: string;
  height?: string;
}

export function Skeleton({ 
  className = '', 
  variant = 'text',
  width,
  height 
}: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-gray-200';
  
  const variantClasses = {
    text: 'rounded',
    rectangular: 'rounded-lg',
    circular: 'rounded-full'
  };

  const style: React.CSSProperties = {};
  if (width) style.width = width;
  if (height) style.height = height;

  return (
    <div 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
}

// Skeleton layouts for common UI patterns
export function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-6">
      {/* Header Skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton width="200px" height="32px" />
          <Skeleton width="300px" height="20px" />
        </div>
        <Skeleton width="120px" height="40px" variant="rectangular" />
      </div>

      {/* Stats Cards Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-2">
                <Skeleton width="80px" height="16px" />
                <Skeleton width="60px" height="24px" />
                <Skeleton width="100px" height="16px" />
              </div>
              <Skeleton variant="circular" width="32px" height="32px" />
            </div>
          </div>
        ))}
      </div>

      {/* Content Skeleton */}
      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <Skeleton width="150px" height="24px" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
              <Skeleton variant="rectangular" width="40px" height="40px" />
              <div className="flex-1 space-y-2">
                <Skeleton width="200px" height="16px" />
                <Skeleton width="150px" height="14px" />
              </div>
              <div className="flex space-x-2">
                <Skeleton variant="circular" width="32px" height="32px" />
                <Skeleton variant="circular" width="32px" height="32px" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border space-y-4">
      <Skeleton width="120px" height="20px" />
      <div className="space-y-2">
        {[...Array(lines)].map((_, i) => (
          <Skeleton 
            key={i} 
            width={i === lines - 1 ? '60%' : '100%'} 
            height="16px" 
          />
        ))}
      </div>
    </div>
  );
}

// Button loading state
interface LoadingButtonProps {
  children: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary' | 'danger';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

export function LoadingButton({
  children,
  loading = false,
  disabled = false,
  className = '',
  size = 'md',
  variant = 'primary',
  onClick,
  type = 'button'
}: LoadingButtonProps) {
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2',
    lg: 'px-6 py-3 text-lg'
  };

  const variantClasses = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400',
    secondary: 'bg-gray-100 text-gray-900 hover:bg-gray-200 disabled:bg-gray-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-400'
  };

  const spinnerSizes = {
    sm: 'sm' as const,
    md: 'sm' as const,
    lg: 'md' as const
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center rounded-lg font-medium transition-colors
        disabled:cursor-not-allowed disabled:opacity-50
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {loading && (
        <LoadingSpinner 
          size={spinnerSizes[size]} 
          color={variant === 'secondary' ? 'gray' : 'white'} 
          className="mr-2" 
        />
      )}
      {children}
    </button>
  );
}

export default LoadingSpinner;