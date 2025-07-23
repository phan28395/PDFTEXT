// Custom Cypress commands for PDF-to-Text SaaS testing

// Login command
Cypress.Commands.add('login', (email?: string, password?: string) => {
  const testEmail = email || Cypress.env('testUserEmail')
  const testPassword = password || Cypress.env('testUserPassword')
  
  cy.visit('/login')
  cy.get('[data-testid="email-input"]').type(testEmail)
  cy.get('[data-testid="password-input"]').type(testPassword)
  cy.get('[data-testid="login-button"]').click()
  
  // Wait for login to complete
  cy.wait('@login')
  cy.url().should('include', '/dashboard')
})

// Logout command
Cypress.Commands.add('logout', () => {
  cy.get('[data-testid="user-menu"]').click()
  cy.get('[data-testid="logout-button"]').click()
  cy.url().should('eq', Cypress.config().baseUrl + '/')
})

// Create test user command
Cypress.Commands.add('createTestUser', () => {
  cy.visit('/register')
  cy.get('[data-testid="email-input"]').type(Cypress.env('testUserEmail'))
  cy.get('[data-testid="password-input"]').type(Cypress.env('testUserPassword'))
  cy.get('[data-testid="confirm-password-input"]').type(Cypress.env('testUserPassword'))
  cy.get('[data-testid="register-button"]').click()
  
  cy.wait('@register')
  cy.contains('Please check your email').should('be.visible')
})

// Upload test PDF command
Cypress.Commands.add('uploadTestPDF', () => {
  // Use a test PDF file from fixtures
  const testPdf = 'test.pdf'
  
  cy.get('[data-testid="file-upload"]').attachFile(testPdf)
  cy.get('[data-testid="upload-button"]').click()
  
  cy.wait('@processPdf')
})

// Wait for PDF processing to complete
Cypress.Commands.add('waitForProcessing', () => {
  cy.get('[data-testid="processing-status"]', { timeout: 30000 })
    .should('contain', 'completed')
})

// Accessibility check command
Cypress.Commands.add('checkAccessibility', () => {
  // Basic accessibility checks
  cy.get('main').should('exist')
  cy.get('[role="main"]').should('exist')
  
  // Check for proper heading structure
  cy.get('h1').should('exist')
  
  // Check for alt text on images
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt')
  })
  
  // Check for form labels
  cy.get('input').each(($input) => {
    const id = $input.attr('id')
    if (id) {
      cy.get(`label[for="${id}"]`).should('exist')
    }
  })
})