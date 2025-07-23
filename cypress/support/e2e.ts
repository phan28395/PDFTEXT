// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'

// Custom commands and utilities
declare global {
  namespace Cypress {
    interface Chainable {
      login(email?: string, password?: string): Chainable<void>
      logout(): Chainable<void>
      createTestUser(): Chainable<void>
      uploadTestPDF(): Chainable<void>
      waitForProcessing(): Chainable<void>
      checkAccessibility(): Chainable<void>
    }
  }
}

// Cypress configuration
Cypress.on('uncaught:exception', (err, runnable) => {
  // Prevent Cypress from failing tests on uncaught exceptions
  // This is useful for handling expected errors in the application
  console.warn('Uncaught exception:', err.message)
  return false
})

// Global hooks
beforeEach(() => {
  // Clear localStorage and sessionStorage
  cy.clearLocalStorage()
  cy.clearCookies()
  
  // Set up API intercepts for testing
  cy.intercept('POST', '/api/auth/login').as('login')
  cy.intercept('POST', '/api/auth/register').as('register')
  cy.intercept('POST', '/api/process-pdf').as('processPdf')
  cy.intercept('GET', '/api/usage-stats').as('usageStats')
  cy.intercept('POST', '/api/stripe/create-checkout-session').as('checkout')
})

afterEach(() => {
  // Clean up after each test
  cy.clearLocalStorage()
  cy.clearCookies()
})