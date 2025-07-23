import { describe, it, expect } from 'vitest'
import { 
  validatePDFFile, 
  formatFileSize, 
  formatDate, 
  isValidEmail, 
  validatePassword 
} from '@/utils'

describe('validatePDFFile', () => {
  it('should validate a correct PDF file', () => {
    const mockPDFFile = new File(['content'], 'test.pdf', { type: 'application/pdf' })
    const result = validatePDFFile(mockPDFFile)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should reject non-PDF files', () => {
    const mockTxtFile = new File(['content'], 'test.txt', { type: 'text/plain' })
    const result = validatePDFFile(mockTxtFile)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Only PDF files are allowed')
  })

  it('should reject files larger than 10MB', () => {
    // Create a mock file that is 11MB
    const largeContent = new Array(11 * 1024 * 1024).fill('a').join('')
    const largePDFFile = new File([largeContent], 'large.pdf', { type: 'application/pdf' })
    
    const result = validatePDFFile(largePDFFile)
    expect(result.valid).toBe(false)
    expect(result.error).toBe('File size must be less than 10MB')
  })

  it('should accept files exactly 10MB', () => {
    // Create a mock file that is exactly 10MB
    const maxContent = new Array(10 * 1024 * 1024).fill('a').join('')
    const maxSizePDFFile = new File([maxContent], 'max.pdf', { type: 'application/pdf' })
    
    const result = validatePDFFile(maxSizePDFFile)
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })
})

describe('formatFileSize', () => {
  it('should format 0 bytes correctly', () => {
    expect(formatFileSize(0)).toBe('0 Bytes')
  })

  it('should format bytes correctly', () => {
    expect(formatFileSize(500)).toBe('500 Bytes')
    expect(formatFileSize(1000)).toBe('1000 Bytes')
  })

  it('should format KB correctly', () => {
    expect(formatFileSize(1024)).toBe('1 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
    expect(formatFileSize(2048)).toBe('2 KB')
  })

  it('should format MB correctly', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB')
    expect(formatFileSize(1024 * 1024 * 1.5)).toBe('1.5 MB')
    expect(formatFileSize(1024 * 1024 * 10)).toBe('10 MB')
  })

  it('should format GB correctly', () => {
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB')
    expect(formatFileSize(1024 * 1024 * 1024 * 2.5)).toBe('2.5 GB')
  })
})

describe('formatDate', () => {
  it('should format ISO date string correctly', () => {
    const isoDate = '2023-12-01T10:30:00.000Z'
    const formatted = formatDate(isoDate)
    // Note: The exact format depends on the system locale, but it should contain month, day, year
    expect(formatted).toMatch(/Dec|12/)
    expect(formatted).toMatch(/2023/)
    expect(formatted).toMatch(/1/)
    expect(formatted).toMatch(/\d{1,2}:\d{2}/)
  })

  it('should handle different date formats', () => {
    const dateString = '2023-01-15T15:45:30Z'
    const formatted = formatDate(dateString)
    expect(formatted).toMatch(/Jan|01/)
    expect(formatted).toMatch(/2023/)
    expect(formatted).toMatch(/15/)
  })
})

describe('isValidEmail', () => {
  it('should validate correct email addresses', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
    expect(isValidEmail('test.email+tag@domain.co.uk')).toBe(true)
    expect(isValidEmail('user123@test-domain.org')).toBe(true)
  })

  it('should reject invalid email addresses', () => {
    expect(isValidEmail('invalid-email')).toBe(false)
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('@domain.com')).toBe(false)
    expect(isValidEmail('user@domain')).toBe(false)
    expect(isValidEmail('user name@domain.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('validatePassword', () => {
  it('should validate strong passwords', () => {
    const result = validatePassword('StrongPass123')
    expect(result.valid).toBe(true)
    expect(result.error).toBeUndefined()
  })

  it('should reject passwords shorter than 8 characters', () => {
    const result = validatePassword('Short1')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Password must be at least 8 characters long')
  })

  it('should reject passwords without lowercase letters', () => {
    const result = validatePassword('STRONGPASS123')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Password must contain at least one lowercase letter')
  })

  it('should reject passwords without uppercase letters', () => {
    const result = validatePassword('strongpass123')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Password must contain at least one uppercase letter')
  })

  it('should reject passwords without numbers', () => {
    const result = validatePassword('StrongPassword')
    expect(result.valid).toBe(false)
    expect(result.error).toBe('Password must contain at least one number')
  })

  it('should accept passwords with all requirements', () => {
    const passwords = [
      'Password123',
      'MyStr0ngP@ss',
      'Test1234',
      'Secure9Pass'
    ]
    
    passwords.forEach(password => {
      const result = validatePassword(password)
      expect(result.valid).toBe(true)
    })
  })
})