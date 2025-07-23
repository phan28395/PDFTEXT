describe('PDF Processing Flow', () => {
  beforeEach(() => {
    // Login before each test
    cy.login()
    cy.visit('/dashboard')
  })

  describe('File Upload', () => {
    it('should upload and process a PDF successfully', () => {
      // Check file upload interface
      cy.get('[data-testid="file-upload-area"]').should('be.visible')
      cy.get('[data-testid="file-upload-input"]').should('exist')
      
      // Upload test PDF
      cy.fixture('test.pdf', 'base64').then(fileContent => {
        cy.get('[data-testid="file-upload-input"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'test.pdf',
          mimeType: 'application/pdf'
        })
      })
      
      // Check file is selected
      cy.get('[data-testid="selected-file"]').should('contain', 'test.pdf')
      cy.get('[data-testid="file-size"]').should('be.visible')
      
      // Start processing
      cy.get('[data-testid="process-button"]').click()
      
      // Check processing state
      cy.get('[data-testid="processing-spinner"]').should('be.visible')
      cy.get('[data-testid="processing-message"]').should('contain', 'Processing')
      
      // Wait for processing to complete
      cy.wait('@processPdf', { timeout: 30000 })
      
      // Check success state
      cy.get('[data-testid="processing-result"]', { timeout: 30000 })
        .should('be.visible')
      cy.get('[data-testid="extracted-text"]').should('be.visible')
      cy.get('[data-testid="download-button"]').should('be.visible')
    })

    it('should handle file validation errors', () => {
      // Try to upload a non-PDF file
      cy.fixture('test.txt').then(fileContent => {
        cy.get('[data-testid="file-upload-input"]').selectFile({
          contents: fileContent,
          fileName: 'test.txt',
          mimeType: 'text/plain'
        })
      })
      
      // Should show error
      cy.get('[data-testid="file-error"]').should('contain', 'Only PDF files are allowed')
    })

    it('should handle large file errors', () => {
      // Mock a large file (in real test, you'd need a large PDF fixture)
      cy.get('[data-testid="file-upload-input"]').then($input => {
        // Create a mock large file
        const largeFile = new File(['x'.repeat(60 * 1024 * 1024)], 'large.pdf', {
          type: 'application/pdf'
        })
        
        // Manually set the files property (for testing)
        Object.defineProperty($input[0], 'files', {
          value: [largeFile],
          writable: false
        })
        
        // Trigger change event
        $input.trigger('change')
      })
      
      cy.get('[data-testid="file-error"]').should('contain', 'File too large')
    })

    it('should support drag and drop', () => {
      cy.fixture('test.pdf', 'base64').then(fileContent => {
        // Simulate drag and drop
        cy.get('[data-testid="file-upload-area"]').selectFile({
          contents: Cypress.Buffer.from(fileContent, 'base64'),
          fileName: 'test.pdf',
          mimeType: 'application/pdf'
        }, { action: 'drag-drop' })
      })
      
      cy.get('[data-testid="selected-file"]').should('contain', 'test.pdf')
    })
  })

  describe('Processing Results', () => {
    beforeEach(() => {
      // Upload and process a file
      cy.uploadTestPDF()
      cy.waitForProcessing()
    })

    it('should display extracted text correctly', () => {
      cy.get('[data-testid="extracted-text"]').should('be.visible')
      cy.get('[data-testid="extracted-text"]').should('not.be.empty')
      
      // Should have formatting controls
      cy.get('[data-testid="text-formatting"]').should('be.visible')
      cy.get('[data-testid="copy-button"]').should('be.visible')
    })

    it('should allow downloading results', () => {
      cy.get('[data-testid="download-button"]').click()
      
      // Check download modal or direct download
      // Note: Cypress doesn't actually download files by default
      // You might need to configure this or check for download links
    })

    it('should show processing statistics', () => {
      cy.get('[data-testid="processing-stats"]').should('be.visible')
      cy.get('[data-testid="pages-processed"]').should('contain', /\d+ page/)
      cy.get('[data-testid="processing-time"]').should('be.visible')
    })
  })

  describe('Usage Limits', () => {
    it('should display current usage', () => {
      cy.get('[data-testid="usage-display"]').should('be.visible')
      cy.get('[data-testid="pages-used"]').should('be.visible')
      cy.get('[data-testid="pages-remaining"]').should('be.visible')
    })

    it('should show upgrade prompt for free users near limit', () => {
      // This would require setting up test data with a user near their limit
      // or mocking the usage stats API
      cy.intercept('GET', '/api/usage-stats', {
        fixture: 'usage-near-limit.json'
      }).as('usageStatsNearLimit')
      
      cy.reload()
      cy.wait('@usageStatsNearLimit')
      
      cy.get('[data-testid="upgrade-prompt"]').should('be.visible')
      cy.get('[data-testid="upgrade-button"]').should('be.visible')
    })

    it('should prevent processing when limit is reached', () => {
      // Mock API to return limit reached error
      cy.intercept('POST', '/api/process-pdf', {
        statusCode: 400,
        body: {
          success: false,
          error: 'Page limit reached',
          code: 'LIMIT_EXCEEDED'
        }
      }).as('processPdfLimitReached')
      
      cy.uploadTestPDF()
      
      cy.wait('@processPdfLimitReached')
      cy.get('[data-testid="limit-error"]').should('contain', 'Page limit reached')
      cy.get('[data-testid="upgrade-button"]').should('be.visible')
    })
  })

  describe('Processing History', () => {
    it('should show processing history', () => {
      cy.visit('/usage-history')
      
      cy.get('[data-testid="history-table"]').should('be.visible')
      cy.get('[data-testid="history-item"]').should('exist')
      
      // Check history item details
      cy.get('[data-testid="history-item"]').first().within(() => {
        cy.get('[data-testid="filename"]').should('be.visible')
        cy.get('[data-testid="processing-date"]').should('be.visible')
        cy.get('[data-testid="pages-count"]').should('be.visible')
        cy.get('[data-testid="status"]').should('be.visible')
      })
    })

    it('should allow filtering history', () => {
      cy.visit('/usage-history')
      
      // Test date filter
      cy.get('[data-testid="date-filter"]').select('last-week')
      cy.get('[data-testid="apply-filter"]').click()
      
      // Should update results
      cy.wait(500) // Wait for filter to apply
      
      // Test status filter
      cy.get('[data-testid="status-filter"]').select('completed')
      cy.get('[data-testid="apply-filter"]').click()
    })

    it('should support pagination', () => {
      cy.visit('/usage-history')
      
      // Check pagination controls if there are enough items
      cy.get('[data-testid="pagination"]').then($pagination => {
        if ($pagination.is(':visible')) {
          cy.get('[data-testid="next-page"]').click()
          cy.get('[data-testid="page-indicator"]').should('contain', '2')
        }
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle processing errors gracefully', () => {
      // Mock API error
      cy.intercept('POST', '/api/process-pdf', {
        statusCode: 500,
        body: {
          success: false,
          error: 'Processing failed',
          code: 'PROCESSING_ERROR'
        }
      }).as('processPdfError')
      
      cy.uploadTestPDF()
      
      cy.wait('@processPdfError')
      cy.get('[data-testid="processing-error"]').should('be.visible')
      cy.get('[data-testid="retry-button"]').should('be.visible')
      cy.get('[data-testid="new-file-button"]').should('be.visible')
    })

    it('should handle network errors', () => {
      // Mock network failure
      cy.intercept('POST', '/api/process-pdf', { forceNetworkError: true }).as('networkError')
      
      cy.uploadTestPDF()
      
      cy.wait('@networkError')
      cy.get('[data-testid="network-error"]').should('be.visible')
      cy.get('[data-testid="retry-button"]').should('be.visible')
    })

    it('should show timeout errors', () => {
      // Mock timeout
      cy.intercept('POST', '/api/process-pdf', (req) => {
        req.reply({ delay: 31000 }) // Delay longer than timeout
      }).as('timeoutError')
      
      cy.uploadTestPDF()
      
      // Should show timeout error
      cy.get('[data-testid="timeout-error"]', { timeout: 35000 }).should('be.visible')
    })
  })
})