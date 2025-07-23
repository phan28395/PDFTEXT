import { config } from 'dotenv'

// Load environment variables for testing
config({ path: '.env.test' })

// Set default environment variables for testing
process.env.NODE_ENV = process.env.NODE_ENV || 'test'
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-key'
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || 'sk_test_123'
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_123'

// Mock external services
global.console.log = jest.fn()
global.console.warn = jest.fn()

// Increase timeout for integration tests
jest.setTimeout(30000)