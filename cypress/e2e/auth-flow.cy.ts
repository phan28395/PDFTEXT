describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.visit('/')
  })

  describe('User Registration', () => {
    it('should register a new user successfully', () => {
      cy.visit('/register')
      
      // Check page elements
      cy.get('[data-testid="register-form"]').should('be.visible')
      cy.get('[data-testid="email-input"]').should('be.visible')
      cy.get('[data-testid="password-input"]').should('be.visible')
      cy.get('[data-testid="confirm-password-input"]').should('be.visible')
      
      // Fill out registration form
      const timestamp = Date.now()
      const email = `test${timestamp}@example.com`
      const password = 'TestPassword123!'
      
      cy.get('[data-testid="email-input"]').type(email)
      cy.get('[data-testid="password-input"]').type(password)
      cy.get('[data-testid="confirm-password-input"]').type(password)
      
      // Check password strength indicator
      cy.get('[data-testid="password-strength"]').should('contain', 'Strong')
      
      // Submit form
      cy.get('[data-testid="register-button"]').click()
      
      // Check for success message
      cy.contains('Please check your email').should('be.visible')
      
      // Verify API call was made
      cy.wait('@register').then((interception) => {
        expect(interception.response?.statusCode).to.equal(200)
      })
    })

    it('should show validation errors for invalid inputs', () => {
      cy.visit('/register')
      
      // Try to submit empty form
      cy.get('[data-testid="register-button"]').click()
      
      // Check for validation errors
      cy.contains('Email is required').should('be.visible')
      cy.contains('Password is required').should('be.visible')
      
      // Test invalid email
      cy.get('[data-testid="email-input"]').type('invalid-email')
      cy.get('[data-testid="password-input"]').click() // Trigger validation
      cy.contains('Please enter a valid email').should('be.visible')
      
      // Test weak password
      cy.get('[data-testid="email-input"]').clear().type('test@example.com')
      cy.get('[data-testid="password-input"]').type('weak')
      cy.get('[data-testid="password-strength"]').should('contain', 'Weak')
      
      // Test password mismatch
      cy.get('[data-testid="password-input"]').clear().type('StrongPassword123!')
      cy.get('[data-testid="confirm-password-input"]').type('DifferentPassword123!')
      cy.get('[data-testid="register-button"]').click()
      cy.contains('Passwords do not match').should('be.visible')
    })
  })

  describe('User Login', () => {
    beforeEach(() => {
      // Assume test user exists (from previous tests or seeded data)
      cy.visit('/login')
    })

    it('should login successfully with valid credentials', () => {
      cy.get('[data-testid="email-input"]').type(Cypress.env('testUserEmail'))
      cy.get('[data-testid="password-input"]').type(Cypress.env('testUserPassword'))
      cy.get('[data-testid="login-button"]').click()
      
      cy.wait('@login')
      cy.url().should('include', '/dashboard')
      
      // Check dashboard elements
      cy.get('[data-testid="user-welcome"]').should('be.visible')
      cy.get('[data-testid="usage-stats"]').should('be.visible')
    })

    it('should show error for invalid credentials', () => {
      cy.get('[data-testid="email-input"]').type('invalid@example.com')
      cy.get('[data-testid="password-input"]').type('wrongpassword')
      cy.get('[data-testid="login-button"]').click()
      
      cy.wait('@login')
      cy.contains('Invalid credentials').should('be.visible')
    })

    it('should redirect to login when accessing protected routes', () => {
      cy.visit('/dashboard')
      cy.url().should('include', '/login')
    })
  })

  describe('Forgot Password', () => {
    it('should send password reset email', () => {
      cy.visit('/login')
      cy.get('[data-testid="forgot-password-link"]').click()
      
      cy.url().should('include', '/forgot-password')
      cy.get('[data-testid="email-input"]').type('test@example.com')
      cy.get('[data-testid="reset-button"]').click()
      
      cy.contains('Password reset email sent').should('be.visible')
    })
  })

  describe('Logout', () => {
    it('should logout successfully', () => {
      // Login first
      cy.login()
      
      // Logout
      cy.logout()
      
      // Should redirect to home
      cy.url().should('eq', Cypress.config().baseUrl + '/')
    })
  })

  describe('Session Management', () => {
    it('should maintain session across page reloads', () => {
      cy.login()
      cy.reload()
      
      // Should still be on dashboard
      cy.url().should('include', '/dashboard')
      cy.get('[data-testid="user-welcome"]').should('be.visible')
    })

    it('should handle session expiry gracefully', () => {
      cy.login()
      
      // Clear session storage to simulate expiry
      cy.clearLocalStorage()
      cy.clearCookies()
      
      // Try to access protected route
      cy.visit('/dashboard')
      
      // Should redirect to login
      cy.url().should('include', '/login')
    })
  })
})