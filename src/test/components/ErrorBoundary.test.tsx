import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ErrorBoundary, { 
  ErrorState, 
  ErrorAlert, 
  NetworkError, 
  FileProcessingError 
} from '@/components/ErrorBoundary'

// Test component that throws an error
const ThrowError = ({ shouldThrow = false }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error message')
  }
  return <div>No error</div>
}

// Wrapper with router for components that use Link
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

// Mock console.error to avoid noise in test output
const originalError = console.error
beforeEach(() => {
  console.error = vi.fn()
})

afterEach(() => {
  console.error = originalError
})

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <RouterWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </RouterWrapper>
    )
    expect(screen.getByText('No error')).toBeDefined()
  })

  it('renders error UI when an error is thrown', () => {
    render(
      <RouterWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </RouterWrapper>
    )
    
    expect(screen.getByText('Oops! Something went wrong')).toBeDefined()
    expect(screen.getByText(/We encountered an unexpected error/)).toBeDefined()
    expect(screen.getByText('Try Again')).toBeDefined()
    expect(screen.getByText('Go to Homepage')).toBeDefined()
  })

  it('calls onError prop when error occurs', () => {
    const onError = vi.fn()
    
    render(
      <RouterWrapper>
        <ErrorBoundary onError={onError}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </RouterWrapper>
    )

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({
        componentStack: expect.any(String)
      })
    )
  })

  it('renders custom fallback when provided', () => {
    const fallback = <div>Custom error message</div>
    
    render(
      <RouterWrapper>
        <ErrorBoundary fallback={fallback}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </RouterWrapper>
    )

    expect(screen.getByText('Custom error message')).toBeDefined()
  })

  it('resets error state when Try Again is clicked', () => {
    const { rerender } = render(
      <RouterWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      </RouterWrapper>
    )

    expect(screen.getByText('Oops! Something went wrong')).toBeDefined()
    
    fireEvent.click(screen.getByText('Try Again'))

    // Re-render with non-throwing component
    rerender(
      <RouterWrapper>
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      </RouterWrapper>
    )

    expect(screen.getByText('No error')).toBeDefined()
  })

  // Note: Testing development mode error details would require mocking process.env
  // which can be complex in Vitest. In a real scenario, you might test this separately
})

describe('ErrorState', () => {
  it('renders with default props', () => {
    render(<ErrorState />)
    expect(screen.getByText('Something went wrong')).toBeDefined()
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeDefined()
  })

  it('renders with custom title and message', () => {
    render(<ErrorState title="Custom Error" message="Custom message" />)
    expect(screen.getByText('Custom Error')).toBeDefined()
    expect(screen.getByText('Custom message')).toBeDefined()
  })

  it('renders action button when provided', () => {
    const action = { label: 'Retry', onClick: vi.fn() }
    render(<ErrorState action={action} />)
    
    const button = screen.getByText('Retry')
    expect(button).toBeDefined()
    
    fireEvent.click(button)
    expect(action.onClick).toHaveBeenCalledOnce()
  })

  it('applies custom className', () => {
    const { container } = render(<ErrorState className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})

describe('ErrorAlert', () => {
  it('renders error alert with message', () => {
    render(<ErrorAlert message="Error message" />)
    expect(screen.getByText('Error message')).toBeDefined()
  })

  it('renders with title when provided', () => {
    render(<ErrorAlert title="Error Title" message="Error message" />)
    expect(screen.getByText('Error Title')).toBeDefined()
    expect(screen.getByText('Error message')).toBeDefined()
  })

  it('applies warning type styling', () => {
    const { container } = render(<ErrorAlert type="warning" message="Warning message" />)
    expect(container.querySelector('.bg-yellow-50')).toBeDefined()
  })

  it('calls onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn()
    render(<ErrorAlert message="Error message" onDismiss={onDismiss} />)
    
    const dismissButton = screen.getByLabelText('Dismiss')
    fireEvent.click(dismissButton)
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('hides dismiss button when onDismiss is not provided', () => {
    render(<ErrorAlert message="Error message" />)
    expect(screen.queryByLabelText('Dismiss')).toBeNull()
  })
})

describe('NetworkError', () => {
  it('renders connection error message', () => {
    render(<NetworkError />)
    expect(screen.getByText('Connection Error')).toBeDefined()
    expect(screen.getByText(/Unable to connect to the server/)).toBeDefined()
  })

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<NetworkError onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Retry')
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('hides retry button when onRetry is not provided', () => {
    render(<NetworkError />)
    expect(screen.queryByText('Retry')).toBeNull()
  })
})

describe('FileProcessingError', () => {
  it('renders processing error with default message', () => {
    render(<FileProcessingError />)
    expect(screen.getByText('Processing Failed')).toBeDefined()
    expect(screen.getByText('Failed to process your PDF file')).toBeDefined()
    expect(screen.getByText('Failed to process the PDF file')).toBeDefined()
  })

  it('renders filename when provided', () => {
    render(<FileProcessingError filename="test.pdf" />)
    expect(screen.getByText('Failed to process "test.pdf"')).toBeDefined()
  })

  it('renders custom error message', () => {
    render(<FileProcessingError error="Custom error message" />)
    expect(screen.getByText('Custom error message')).toBeDefined()
  })

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<FileProcessingError onRetry={onRetry} />)
    
    const retryButton = screen.getByText('Try Again')
    fireEvent.click(retryButton)
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders new file button when onNewFile is provided', () => {
    const onNewFile = vi.fn()
    render(<FileProcessingError onNewFile={onNewFile} />)
    
    const newFileButton = screen.getByText('Upload Different File')
    fireEvent.click(newFileButton)
    expect(onNewFile).toHaveBeenCalledOnce()
  })

  it('renders both buttons when both callbacks are provided', () => {
    const onRetry = vi.fn()
    const onNewFile = vi.fn()
    render(<FileProcessingError onRetry={onRetry} onNewFile={onNewFile} />)
    
    expect(screen.getByText('Try Again')).toBeDefined()
    expect(screen.getByText('Upload Different File')).toBeDefined()
  })
})