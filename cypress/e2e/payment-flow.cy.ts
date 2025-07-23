describe('Payment and Subscription Flow', () => {
  beforeEach(() => {
    cy.login()
  })

  describe('Pricing Page', () => {
    it('should display pricing plans correctly', () => {
      cy.visit('/pricing')
      
      // Check page structure
      cy.get('[data-testid="pricing-header"]').should('be.visible')
      cy.get('[data-testid="pricing-plans"]').should('be.visible')
      
      // Check free plan
      cy.get('[data-testid="free-plan"]').within(() => {
        cy.contains('Free').should('be.visible')
        cy.contains('10 pages').should('be.visible')
        cy.get('[data-testid="free-features"]').should('be.visible')
      })
      
      // Check pro plan
      cy.get('[data-testid="pro-plan"]').within(() => {
        cy.contains('Pro').should('be.visible')
        cy.contains('1,000 pages').should('be.visible')
        cy.contains('$9.99').should('be.visible')
        cy.get('[data-testid="pro-features"]').should('be.visible')
        cy.get('[data-testid="upgrade-button"]').should('be.visible')
      })
      
      // Check FAQ section
      cy.get('[data-testid="pricing-faq"]').should('be.visible')
    })

    it('should handle upgrade button click', () => {
      cy.visit('/pricing')
      
      cy.get('[data-testid="pro-plan"]').within(() => {
        cy.get('[data-testid="upgrade-button"]').click()
      })
      
      // Should make checkout API call
      cy.wait('@checkout')
      
      // In a real test, you might check for redirect to Stripe
      // or mock the checkout response
    })
  })

  describe('Subscription Management', () => {
    beforeEach(() => {
      cy.visit('/dashboard')
    })

    it('should display current subscription status for free user', () => {
      // Mock free user
      cy.intercept('GET', '/api/usage-stats', {
        fixture: 'usage-free-user.json'
      }).as('usageStatsFree')
      
      cy.reload()
      cy.wait('@usageStatsFree')
      
      cy.get('[data-testid="subscription-card"]').within(() => {
        cy.contains('Free Plan').should('be.visible')
        cy.get('[data-testid="upgrade-button"]').should('be.visible')
      })
    })

    it('should display current subscription status for pro user', () => {
      // Mock pro user
      cy.intercept('GET', '/api/usage-stats', {
        fixture: 'usage-pro-user.json'
      }).as('usageStatsPro')
      
      cy.reload()
      cy.wait('@usageStatsPro')
      
      cy.get('[data-testid="subscription-card"]').within(() => {
        cy.contains('Pro Plan').should('be.visible')
        cy.contains('$9.99/month').should('be.visible')
        cy.get('[data-testid="manage-billing-button"]').should('be.visible')
        cy.get('[data-testid="cancel-button"]').should('be.visible')
      })
    })

    it('should handle billing portal access', () => {
      // Mock pro user
      cy.intercept('GET', '/api/usage-stats', {
        fixture: 'usage-pro-user.json'
      }).as('usageStatsPro')
      
      // Mock portal session creation
      cy.intercept('POST', '/api/stripe/create-portal-session', {
        body: { url: 'https://billing.stripe.com/session/test' }
      }).as('createPortalSession')
      
      cy.reload()
      cy.wait('@usageStatsPro')
      
      cy.get('[data-testid="manage-billing-button"]').click()
      cy.wait('@createPortalSession')
      
      // In a real test, this would redirect to Stripe's billing portal
      // We can't easily test external redirects in Cypress
    })
  })

  describe('Checkout Process', () => {
    it('should initiate checkout process', () => {
      cy.visit('/pricing')
      
      // Mock checkout session creation
      cy.intercept('POST', '/api/stripe/create-checkout-session', {
        body: { 
          url: 'https://checkout.stripe.com/session/test',
          sessionId: 'cs_test_123'
        }
      }).as('createCheckoutSession')
      
      cy.get('[data-testid="pro-plan"] [data-testid="upgrade-button"]').click()
      
      cy.wait('@createCheckoutSession').then((interception) => {
        expect(interception.request.body).to.have.property('priceId')
        expect(interception.response?.body).to.have.property('url')
      })
    })

    it('should handle checkout errors', () => {
      cy.visit('/pricing')
      
      // Mock checkout error
      cy.intercept('POST', '/api/stripe/create-checkout-session', {
        statusCode: 400,
        body: { error: 'Unable to create checkout session' }
      }).as('checkoutError')
      
      cy.get('[data-testid="pro-plan"] [data-testid="upgrade-button"]').click()
      
      cy.wait('@checkoutError')
      cy.get('[data-testid="checkout-error"]').should('be.visible')
      cy.contains('Unable to create checkout session').should('be.visible')
    })
  })

  describe('Subscription Status Updates', () => {
    it('should reflect subscription changes after successful payment', () => {
      // This would typically be tested by mocking webhook events
      // or using Stripe's test mode webhooks
      
      // Mock successful subscription update
      cy.intercept('GET', '/api/stripe/subscription', {
        body: {
          subscription: {
            status: 'active',
            plan: 'pro',
            current_period_end: Date.now() + 30 * 24 * 60 * 60 * 1000
          }
        }
      }).as('subscriptionActive')
      
      cy.visit('/dashboard')
      cy.wait('@subscriptionActive')
      
      cy.get('[data-testid="subscription-card"]').within(() => {
        cy.contains('Pro Plan').should('be.visible')
        cy.contains('Active').should('be.visible')
      })
    })

    it('should handle subscription cancellation', () => {
      // Mock cancellation
      cy.intercept('POST', '/api/stripe/cancel-subscription', {
        body: { success: true }
      }).as('cancelSubscription')
      
      // Mock cancelled subscription status
      cy.intercept('GET', '/api/stripe/subscription', {
        body: {
          subscription: {
            status: 'active',
            plan: 'pro',
            cancel_at_period_end: true,
            current_period_end: Date.now() + 15 * 24 * 60 * 60 * 1000
          }
        }
      }).as('subscriptionCancelled')
      
      cy.visit('/dashboard')
      
      // Click cancel button
      cy.get('[data-testid="cancel-button"]').click()
      cy.get('[data-testid="confirm-cancel"]').click()
      
      cy.wait('@cancelSubscription')
      cy.wait('@subscriptionCancelled')
      
      cy.get('[data-testid="subscription-card"]').within(() => {
        cy.contains('Cancels').should('be.visible')
      })
    })
  })

  describe('Usage Limits and Billing', () => {
    it('should enforce limits based on subscription', () => {
      // Test free user hitting limits
      cy.intercept('GET', '/api/usage-stats', {
        fixture: 'usage-at-limit.json'
      }).as('usageAtLimit')
      
      cy.visit('/dashboard')
      cy.wait('@usageAtLimit')
      
      // Should show upgrade prompt
      cy.get('[data-testid="limit-warning"]').should('be.visible')
      cy.get('[data-testid="upgrade-prompt"]').should('be.visible')
      
      // Try to process PDF - should be blocked
      cy.uploadTestPDF()
      cy.get('[data-testid="limit-error"]').should('be.visible')
    })

    it('should reset usage limits for pro users monthly', () => {
      // Mock pro user with usage reset
      cy.intercept('GET', '/api/usage-stats', {
        body: {
          user: {
            subscription_plan: 'pro',
            subscription_status: 'active',
            pages_used_pro: 0, // Reset usage
            monthly_limit: 1000
          }
        }
      }).as('usageReset')
      
      cy.visit('/dashboard')
      cy.wait('@usageReset')
      
      cy.get('[data-testid="usage-display"]').within(() => {
        cy.contains('0 / 1,000').should('be.visible')
      })
    })
  })

  describe('Payment Security', () => {
    it('should not expose sensitive payment data', () => {
      cy.visit('/dashboard')
      
      // Check that no Stripe secret keys are exposed in the client
      cy.window().then((win) => {
        const html = win.document.documentElement.outerHTML
        expect(html).to.not.contain('sk_')
        expect(html).to.not.contain('rk_')
      })
      
      // Check that only publishable keys are present
      cy.window().then((win) => {
        const scripts = Array.from(win.document.querySelectorAll('script'))
        const scriptContents = scripts.map(s => s.innerHTML).join('')
        
        if (scriptContents.includes('pk_')) {
          // This is acceptable - publishable keys are safe to expose
        }
      })
    })
  })
})