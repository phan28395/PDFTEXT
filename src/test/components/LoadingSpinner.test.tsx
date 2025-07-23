import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { 
  LoadingSpinner, 
  LoadingState, 
  ProcessingLoader, 
  Skeleton,
  DashboardSkeleton,
  CardSkeleton,
  LoadingButton
} from '@/components/LoadingSpinner'

describe('LoadingSpinner', () => {
  it('renders with default props', () => {
    render(<LoadingSpinner />)
    const spinner = screen.getByRole('img', { hidden: true })
    expect(spinner).toBeDefined()
    expect(spinner.className).toContain('animate-spin')
    expect(spinner.className).toContain('h-6 w-6')
    expect(spinner.className).toContain('text-blue-600')
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingSpinner size="sm" />)
    expect(screen.getByRole('img', { hidden: true }).className).toContain('h-4 w-4')

    rerender(<LoadingSpinner size="lg" />)
    expect(screen.getByRole('img', { hidden: true }).className).toContain('h-8 w-8')

    rerender(<LoadingSpinner size="xl" />)
    expect(screen.getByRole('img', { hidden: true }).className).toContain('h-12 w-12')
  })

  it('applies correct color classes', () => {
    const { rerender } = render(<LoadingSpinner color="gray" />)
    expect(screen.getByRole('img', { hidden: true }).className).toContain('text-gray-600')

    rerender(<LoadingSpinner color="white" />)
    expect(screen.getByRole('img', { hidden: true }).className).toContain('text-white')
  })

  it('applies custom className', () => {
    render(<LoadingSpinner className="custom-class" />)
    expect(screen.getByRole('img', { hidden: true }).className).toContain('custom-class')
  })
})

describe('LoadingState', () => {
  it('renders with default message', () => {
    render(<LoadingState />)
    expect(screen.getByText('Loading...')).toBeDefined()
  })

  it('renders with custom message and submessage', () => {
    render(<LoadingState message="Custom Loading" submessage="Please wait..." />)
    expect(screen.getByText('Custom Loading')).toBeDefined()
    expect(screen.getByText('Please wait...')).toBeDefined()
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingState size="sm" />)
    expect(screen.getByText('Loading...').closest('div')).toHaveClass('py-8')

    rerender(<LoadingState size="lg" />)
    expect(screen.getByText('Loading...').closest('div')).toHaveClass('py-20')
  })
})

describe('ProcessingLoader', () => {
  it('renders with default message', () => {
    render(<ProcessingLoader />)
    expect(screen.getByText('Processing PDF')).toBeDefined()
    expect(screen.getByText('Converting your PDF to text using AI...')).toBeDefined()
  })

  it('renders with filename', () => {
    render(<ProcessingLoader filename="document.pdf" />)
    expect(screen.getByText('Converting "document.pdf" to text using AI...')).toBeDefined()
  })

  it('contains timing information', () => {
    render(<ProcessingLoader />)
    expect(screen.getByText('This usually takes 10-30 seconds')).toBeDefined()
  })
})

describe('Skeleton', () => {
  it('renders with default props', () => {
    const { container } = render(<Skeleton />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.className).toContain('animate-pulse')
    expect(skeleton.className).toContain('bg-gray-200')
    expect(skeleton.className).toContain('rounded')
  })

  it('applies variant classes', () => {
    const { container, rerender } = render(<Skeleton variant="circular" />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-full')

    rerender(<Skeleton variant="rectangular" />)
    expect((container.firstChild as HTMLElement).className).toContain('rounded-lg')
  })

  it('applies custom width and height', () => {
    const { container } = render(<Skeleton width="100px" height="50px" />)
    const skeleton = container.firstChild as HTMLElement
    expect(skeleton.style.width).toBe('100px')
    expect(skeleton.style.height).toBe('50px')
  })
})

describe('DashboardSkeleton', () => {
  it('renders multiple skeleton elements', () => {
    const { container } = render(<DashboardSkeleton />)
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(10)
  })

  it('contains stats cards section', () => {
    const { container } = render(<DashboardSkeleton />)
    const statsGrid = container.querySelector('.grid')
    expect(statsGrid).toBeDefined()
  })
})

describe('CardSkeleton', () => {
  it('renders with default number of lines', () => {
    const { container } = render(<CardSkeleton />)
    const lines = container.querySelectorAll('.animate-pulse')
    expect(lines.length).toBe(4) // 1 title + 3 lines
  })

  it('renders with custom number of lines', () => {
    const { container } = render(<CardSkeleton lines={5} />)
    const lines = container.querySelectorAll('.animate-pulse')
    expect(lines.length).toBe(6) // 1 title + 5 lines
  })
})

describe('LoadingButton', () => {
  it('renders children when not loading', () => {
    render(<LoadingButton>Click me</LoadingButton>)
    expect(screen.getByText('Click me')).toBeDefined()
  })

  it('shows spinner when loading', () => {
    render(<LoadingButton loading>Click me</LoadingButton>)
    const button = screen.getByRole('button')
    expect(button.querySelector('.animate-spin')).toBeDefined()
    expect(screen.getByText('Click me')).toBeDefined()
  })

  it('handles click events', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()
    
    render(<LoadingButton onClick={handleClick}>Click me</LoadingButton>)
    
    await user.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('disables button when loading', () => {
    render(<LoadingButton loading>Click me</LoadingButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables button when disabled prop is true', () => {
    render(<LoadingButton disabled>Click me</LoadingButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<LoadingButton size="sm">Small</LoadingButton>)
    expect(screen.getByRole('button').className).toContain('px-3 py-1.5 text-sm')

    rerender(<LoadingButton size="lg">Large</LoadingButton>)
    expect(screen.getByRole('button').className).toContain('px-6 py-3 text-lg')
  })

  it('applies correct variant classes', () => {
    const { rerender } = render(<LoadingButton variant="primary">Primary</LoadingButton>)
    expect(screen.getByRole('button').className).toContain('bg-blue-600')

    rerender(<LoadingButton variant="secondary">Secondary</LoadingButton>)
    expect(screen.getByRole('button').className).toContain('bg-gray-100')

    rerender(<LoadingButton variant="danger">Danger</LoadingButton>)
    expect(screen.getByRole('button').className).toContain('bg-red-600')
  })

  it('sets correct button type', () => {
    render(<LoadingButton type="submit">Submit</LoadingButton>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })
})