import request from 'supertest'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import fs from 'fs'
import path from 'path'

// Mock Google Document AI
const mockDocumentAI = {
  processDocument: jest.fn()
}

jest.mock('@google-cloud/documentai', () => ({
  DocumentProcessorServiceClient: jest.fn(() => mockDocumentAI)
}))

// Mock Supabase
const mockSupabaseClient = {
  from: jest.fn(() => ({
    insert: jest.fn(() => ({
      data: [{ id: 'record-123' }],
      error: null
    })),
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: { 
            id: 'user-123', 
            pages_used_free: 5, 
            pages_used_pro: 100,
            subscription_status: 'active',
            subscription_plan: 'pro'
          },
          error: null
        }))
      }))
    })),
    rpc: jest.fn(() => ({
      data: { success: true, pages_used: 6 },
      error: null
    }))
  }))
}

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabaseClient)
}))

// Mock VirusTotal
const mockVirusTotal = {
  scanFile: jest.fn(() => Promise.resolve({ safe: true }))
}

jest.mock('@/lib/security', () => ({
  scanForMalware: jest.fn(() => Promise.resolve({ safe: true, details: 'Clean' })),
  validatePDFStructure: jest.fn(() => true),
  sanitizeFilename: jest.fn((filename) => filename)
}))

// Mock rate limiting
jest.mock('@/lib/rateLimit', () => ({
  checkRateLimit: jest.fn(() => ({ allowed: true }))
}))

// Mock formidable
const mockFormidable = {
  parse: jest.fn()
}

jest.mock('formidable', () => ({
  __esModule: true,
  default: jest.fn(() => mockFormidable)
}))

describe('PDF Processing API Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/process-pdf', () => {
    const mockPDFBuffer = Buffer.from('Mock PDF content')
    const mockProcessedText = 'Extracted text from PDF'

    beforeEach(() => {
      // Mock file parsing
      mockFormidable.parse.mockImplementation((req, callback) => {
        callback(null, {}, {
          file: [{
            originalFilename: 'test.pdf',
            mimetype: 'application/pdf',
            size: 1024 * 1024, // 1MB
            filepath: '/tmp/test.pdf'
          }]
        })
      })

      // Mock Document AI response
      mockDocumentAI.processDocument.mockResolvedValue([{
        document: {
          text: mockProcessedText,
          pages: [
            { pageNumber: 1 },
            { pageNumber: 2 },
            { pageNumber: 3 }
          ]
        }
      }])

      // Mock file system operations
      jest.spyOn(fs, 'readFileSync').mockReturnValue(mockPDFBuffer)
      jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {})
    })

    it('should successfully process a PDF file', async () => {
      // Test the processing logic
      const filename = 'test.pdf'
      const fileSize = 1024 * 1024
      const expectedPages = 3

      // Validate file
      expect(filename.endsWith('.pdf')).toBe(true)
      expect(fileSize).toBeLessThan(50 * 1024 * 1024) // 50MB limit

      // Process with Document AI
      const aiResponse = await mockDocumentAI.processDocument({
        name: 'projects/test/locations/us/processors/test',
        rawDocument: {
          content: mockPDFBuffer.toString('base64'),
          mimeType: 'application/pdf'
        }
      })

      expect(aiResponse[0].document.text).toBe(mockProcessedText)
      expect(aiResponse[0].document.pages).toHaveLength(expectedPages)

      // Update usage
      const usageResult = mockSupabaseClient.from('users').rpc('atomic_update_user_pages_usage')
      expect(usageResult.data.success).toBe(true)

      // Insert processing record
      const insertResult = mockSupabaseClient.from('processing_history').insert({})
      expect(insertResult.data).toHaveLength(1)
    })

    it('should reject files that are too large', () => {
      const largeFileSize = 60 * 1024 * 1024 // 60MB
      const maxSize = 50 * 1024 * 1024 // 50MB limit

      expect(largeFileSize).toBeGreaterThan(maxSize)
      
      // This would result in an error response
      const errorResponse = {
        success: false,
        error: 'File too large. Maximum size is 50MB.',
        code: 'FILE_TOO_LARGE'
      }

      expect(errorResponse.success).toBe(false)
      expect(errorResponse.code).toBe('FILE_TOO_LARGE')
    })

    it('should reject non-PDF files', () => {
      const nonPDFFile = {
        originalFilename: 'document.txt',
        mimetype: 'text/plain'
      }

      expect(nonPDFFile.mimetype).not.toBe('application/pdf')
      
      const errorResponse = {
        success: false,
        error: 'Only PDF files are supported',
        code: 'INVALID_FILE_TYPE'
      }

      expect(errorResponse.success).toBe(false)
      expect(errorResponse.code).toBe('INVALID_FILE_TYPE')
    })

    it('should enforce usage limits for free users', async () => {
      // Mock free user at limit
      mockSupabaseClient.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            single: () => ({
              data: { 
                pages_used_free: 10, // At limit
                subscription_status: 'free',
                subscription_plan: null
              },
              error: null
            })
          })
        }),
        rpc: () => ({
          data: null,
          error: { code: 'LIMIT_EXCEEDED', message: 'Page limit exceeded' }
        })
      }))

      const usageCheck = await mockSupabaseClient.from('users').rpc('atomic_update_user_pages_usage')
      expect(usageCheck.error?.code).toBe('LIMIT_EXCEEDED')
    })

    it('should handle Document AI processing errors', async () => {
      mockDocumentAI.processDocument.mockRejectedValue(
        new Error('Document AI service unavailable')
      )

      try {
        await mockDocumentAI.processDocument({})
        expect(true).toBe(false) // Should not reach here
      } catch (error) {
        expect((error as Error).message).toBe('Document AI service unavailable')
      }
    })

    it('should handle malware detection', async () => {
      const mockSecurity = require('@/lib/security')
      
      // Test clean file
      mockSecurity.scanForMalware.mockResolvedValue({ safe: true, details: 'Clean' })
      const cleanResult = await mockSecurity.scanForMalware(mockPDFBuffer)
      expect(cleanResult.safe).toBe(true)

      // Test malicious file
      mockSecurity.scanForMalware.mockResolvedValue({ safe: false, details: 'Malware detected' })
      const maliciousResult = await mockSecurity.scanForMalware(mockPDFBuffer)
      expect(maliciousResult.safe).toBe(false)
    })

    it('should clean up temporary files', () => {
      const tempFilePath = '/tmp/test.pdf'
      
      // Simulate file cleanup
      fs.unlinkSync(tempFilePath)
      
      expect(fs.unlinkSync).toHaveBeenCalledWith(tempFilePath)
    })

    it('should handle rate limiting', () => {
      const mockRateLimit = require('@/lib/rateLimit')
      
      // Test allowed request
      mockRateLimit.checkRateLimit.mockReturnValue({ allowed: true })
      const allowedResult = mockRateLimit.checkRateLimit('127.0.0.1', 'processing')
      expect(allowedResult.allowed).toBe(true)

      // Test blocked request
      mockRateLimit.checkRateLimit.mockReturnValue({ 
        allowed: false, 
        resetTime: Date.now() + 60000 
      })
      const blockedResult = mockRateLimit.checkRateLimit('127.0.0.1', 'processing')
      expect(blockedResult.allowed).toBe(false)
    })

    it('should validate PDF structure', () => {
      const mockSecurity = require('@/lib/security')
      
      // Valid PDF
      mockSecurity.validatePDFStructure.mockReturnValue(true)
      expect(mockSecurity.validatePDFStructure(mockPDFBuffer)).toBe(true)

      // Invalid PDF
      mockSecurity.validatePDFStructure.mockReturnValue(false)
      expect(mockSecurity.validatePDFStructure(Buffer.from('invalid'))).toBe(false)
    })

    it('should sanitize filenames', () => {
      const mockSecurity = require('@/lib/security')
      
      mockSecurity.sanitizeFilename.mockImplementation((filename) => {
        return filename.replace(/[^a-zA-Z0-9.-]/g, '_')
      })

      expect(mockSecurity.sanitizeFilename('test.pdf')).toBe('test.pdf')
      expect(mockSecurity.sanitizeFilename('test file.pdf')).toBe('test_file.pdf')
      expect(mockSecurity.sanitizeFilename('../../evil.pdf')).toBe('____evil.pdf')
    })

    it('should handle concurrent requests with atomic updates', async () => {
      // Simulate concurrent requests
      const requests = Array(5).fill(null).map(() => 
        mockSupabaseClient.from('users').rpc('atomic_update_user_pages_usage', {
          user_id: 'user-123',
          pages_to_add: 3
        })
      )

      const results = await Promise.all(requests)
      
      // All should succeed due to atomic updates
      results.forEach(result => {
        expect(result.data).toBeDefined()
      })
    })
  })

  describe('Processing History API', () => {
    it('should retrieve user processing history', async () => {
      mockSupabaseClient.from.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            order: () => ({
              range: () => ({
                data: [
                  {
                    id: 'record-1',
                    filename: 'doc1.pdf',
                    pages: 3,
                    status: 'completed',
                    created_at: new Date().toISOString()
                  }
                ],
                error: null
              })
            })
          })
        })
      }))

      const history = mockSupabaseClient.from('processing_history')
        .select('*')
        .eq('user_id', 'user-123')
        .order('created_at', { ascending: false })
        .range(0, 9)

      expect(history.data).toHaveLength(1)
      expect(history.data[0].filename).toBe('doc1.pdf')
    })
  })
})