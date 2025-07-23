import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { validatePasswordStrength, validateEmail, useAuth } from '@/hooks/useAuth'

// Mock supabase
const mockSupabase = {
  auth: {
    getSession: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    onAuthStateChange: vi.fn(() => ({
      data: { subscription: { unsubscribe: vi.fn() } }
    }))
  }
}

vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase,
  handleSupabaseError: vi.fn((error, context) => error.message)
}))

describe('validatePasswordStrength', () => {
  it('should validate strong passwords correctly', () => {
    const result = validatePasswordStrength('StrongPass123!')
    expect(result.isValid).toBe(true)
    expect(result.score).toBeGreaterThan(80)
    expect(result.feedback).toHaveLength(0)
  })

  it('should reject weak passwords', () => {
    const result = validatePasswordStrength('weak')
    expect(result.isValid).toBe(false)
    expect(result.feedback.length).toBeGreaterThan(0)
    expect(result.feedback).toContain('Password must be at least 8 characters long')
  })

  it('should provide specific feedback for missing requirements', () => {
    const result = validatePasswordStrength('password123')
    expect(result.isValid).toBe(false)
    expect(result.feedback).toContain('Password must contain at least one uppercase letter')
    expect(result.feedback).toContain('Password must contain at least one special character')
  })

  it('should give bonus points for length', () => {
    const shortStrong = validatePasswordStrength('StrongP1!')
    const longStrong = validatePasswordStrength('StrongPassword123!')
    expect(longStrong.score).toBeGreaterThan(shortStrong.score)
  })
})

describe('validateEmail', () => {
  it('should validate correct email addresses', () => {
    expect(validateEmail('test@example.com')).toBe(true)
    expect(validateEmail('user.name+tag@domain.co.uk')).toBe(true)
  })

  it('should reject invalid email addresses', () => {
    expect(validateEmail('invalid-email')).toBe(false)
    expect(validateEmail('user@')).toBe(false)
    expect(validateEmail('@domain.com')).toBe(false)
    expect(validateEmail('')).toBe(false)
  })
})

describe('useAuth hook', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSupabase.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null
    })
  })

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth())
    
    expect(result.current.loading).toBe(true)
    expect(result.current.user).toBe(null)
    expect(result.current.session).toBe(null)
  })

  it('should handle successful login', async () => {
    const mockUser = { id: '123', email: 'test@example.com' }
    const mockSession = { user: mockUser }
    
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: mockUser, session: mockSession },
      error: null
    })

    const { result } = renderHook(() => useAuth())
    
    let loginResult
    await act(async () => {
      loginResult = await result.current.login({
        email: 'test@example.com',
        password: 'ValidPass123!'
      })
    })

    expect(loginResult).toEqual({ success: true })
  })

  it('should handle login with invalid email', async () => {
    const { result } = renderHook(() => useAuth())
    
    let loginResult
    await act(async () => {
      loginResult = await result.current.login({
        email: 'invalid-email',
        password: 'ValidPass123!'
      })
    })

    expect(loginResult).toEqual({
      success: false,
      error: 'Please enter a valid email address'
    })
  })

  it('should handle login errors from Supabase', async () => {
    mockSupabase.auth.signInWithPassword.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid credentials' }
    })

    const { result } = renderHook(() => useAuth())
    
    let loginResult
    await act(async () => {
      loginResult = await result.current.login({
        email: 'test@example.com',
        password: 'wrongpassword'
      })
    })

    expect(loginResult.success).toBe(false)
    expect(loginResult.error).toBe('Invalid credentials')
  })

  it('should handle successful registration', async () => {
    mockSupabase.auth.signUp.mockResolvedValue({
      data: { user: { email_confirmed_at: new Date().toISOString() } },
      error: null
    })

    const { result } = renderHook(() => useAuth())
    
    let registerResult
    await act(async () => {
      registerResult = await result.current.register({
        email: 'newuser@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'ValidPass123!'
      })
    })

    expect(registerResult).toEqual({ success: true })
  })

  it('should reject registration with mismatched passwords', async () => {
    const { result } = renderHook(() => useAuth())
    
    let registerResult
    await act(async () => {
      registerResult = await result.current.register({
        email: 'test@example.com',
        password: 'ValidPass123!',
        confirmPassword: 'DifferentPass123!'
      })
    })

    expect(registerResult).toEqual({
      success: false,
      error: 'Passwords do not match'
    })
  })

  it('should handle successful logout', async () => {
    mockSupabase.auth.signOut.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth())
    
    let logoutResult
    await act(async () => {
      logoutResult = await result.current.logout()
    })

    expect(logoutResult).toEqual({ success: true })
  })

  it('should handle password reset request', async () => {
    mockSupabase.auth.resetPasswordForEmail.mockResolvedValue({ error: null })

    const { result } = renderHook(() => useAuth())
    
    let resetResult
    await act(async () => {
      resetResult = await result.current.resetPassword('test@example.com')
    })

    expect(resetResult).toEqual({ success: true })
  })

  it('should reject password reset with invalid email', async () => {
    const { result } = renderHook(() => useAuth())
    
    let resetResult
    await act(async () => {
      resetResult = await result.current.resetPassword('invalid-email')
    })

    expect(resetResult).toEqual({
      success: false,
      error: 'Please enter a valid email address'
    })
  })
})