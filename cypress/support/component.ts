// Component testing support file
import { mount } from 'cypress/react18'
import './commands'

// Add mount command to Cypress chainable
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount
    }
  }
}

Cypress.Commands.add('mount', mount)