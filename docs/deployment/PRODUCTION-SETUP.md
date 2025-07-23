# Production Setup Guide - Step 24

## Quick Production Deployment

This document outlines the immediate steps needed to deploy the PDF-to-Text SaaS platform to production.

## Critical Environment Variables

Set these in your Vercel dashboard under Project Settings > Environment Variables:

### Required for Basic Functionality
```bash
# Supabase Configuration
VITE_SUPABASE_URL=your_production_supabase_url
VITE_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key

# Stripe Configuration  
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_production_webhook_secret
STRIPE_PRO_PRICE_ID=price_your_production_pro_price_id

# Google Document AI
GOOGLE_CLOUD_PROJECT_ID=your_production_project_id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your_production_processor_id
GOOGLE_APPLICATION_CREDENTIALS=path_to_production_service_account.json

# Security Keys (Generate new secure keys)
JWT_SECRET=generate_32_plus_character_secret_here
ENCRYPTION_KEY=generate_32_plus_character_encryption_key_here

# Production Configuration
NODE_ENV=production
VITE_API_URL=https://your-domain.vercel.app
```

### Optional but Recommended
```bash
# Security & Monitoring
VIRUSTOTAL_API_KEY=your_virustotal_api_key
SENTRY_DSN=your_sentry_dsn_optional
LOG_LEVEL=error
ENABLE_ERROR_TRACKING=true

# Rate Limiting (Production Values)
RATE_LIMIT_UPLOADS_PER_MINUTE=5
RATE_LIMIT_AUTH_ATTEMPTS=3
RATE_LIMIT_API_REQUESTS_PER_MINUTE=100

# File Processing
MAX_FILE_SIZE_MB=10
PROCESSING_TIMEOUT_SECONDS=60
TEMP_FILE_CLEANUP_HOURS=1
```

## Pre-Deployment Checklist

### 1. Supabase Production Setup
- [ ] Create production Supabase project
- [ ] Run database schema from `/database/` directory
- [ ] Enable Row Level Security (RLS)
- [ ] Configure email authentication
- [ ] Set up SMTP for email delivery
- [ ] Copy production URL and anon key

### 2. Stripe Production Setup
- [ ] Activate Stripe live mode
- [ ] Create production API keys
- [ ] Set up webhook endpoint: `https://your-domain.vercel.app/api/stripe/webhook`
- [ ] Configure products and pricing in live mode
- [ ] Test payment flow in live mode

### 3. Google Cloud Setup
- [ ] Create production GCP project
- [ ] Enable Document AI API
- [ ] Create service account with Document AI permissions
- [ ] Download service account JSON credentials
- [ ] Upload credentials to Vercel as environment variable

## Deployment Commands

### Quick Deployment (Recommended for Step 24)
```bash
# Use the quick deployment script
node deploy-production-quick.js
```

### Manual Deployment
```bash
# Set production environment
export NODE_ENV=production

# Build for production
npm run build

# Deploy to Vercel
vercel --prod --confirm
```

### Alternative: Use package.json script
```bash
npm run deploy:prod:quick
```

## Post-Deployment Tasks

### 1. Domain Configuration
- Set up custom domain in Vercel dashboard
- Update CORS origins in Supabase settings
- Update webhook URLs in Stripe dashboard
- Test all major workflows

### 2. Security Verification
- [ ] HTTPS enabled and working
- [ ] CSP headers active (check browser dev tools)
- [ ] Rate limiting functional
- [ ] File upload security working

### 3. Basic Functionality Test
- [ ] User registration and login
- [ ] PDF upload and processing
- [ ] Subscription creation and management
- [ ] Payment processing

## Monitoring Setup

### Immediate Monitoring
1. **Vercel Dashboard**: Monitor deployment status and analytics
2. **Supabase Dashboard**: Monitor database performance and auth
3. **Stripe Dashboard**: Monitor payment transactions
4. **Browser DevTools**: Check for console errors and network issues

### Health Check
Run the health check script:
```bash
npm run health-check
```

Or manually test key endpoints:
- `GET /api/health` - Basic health check
- `POST /api/auth/login` - Authentication
- `POST /api/process-pdf` - Core functionality

## Troubleshooting

### Common Issues

**1. Build Failures**
- Check TypeScript errors: `npm run type-check`
- Verify all dependencies: `npm ci`

**2. Environment Variables**
- Verify in Vercel dashboard
- Check for typos in variable names
- Ensure no test keys in production

**3. Database Connection**
- Verify Supabase URLs and keys
- Check RLS policies are enabled
- Test connection with service role key

**4. Payment Processing**
- Verify Stripe live keys
- Check webhook endpoint URL
- Test with real payment methods

### Quick Fixes
- **500 Errors**: Check Vercel function logs
- **Auth Issues**: Verify Supabase configuration
- **Payment Failures**: Check Stripe webhook logs
- **File Processing**: Verify Google Cloud credentials

## Success Criteria for Step 24

- [ ] Application deployed to production URL
- [ ] Core PDF processing functionality working
- [ ] User authentication and registration working
- [ ] Stripe payments processing correctly
- [ ] Basic monitoring and error tracking active
- [ ] Security headers and HTTPS enabled

## Next Steps (Future)

After successful deployment:
1. Set up comprehensive monitoring (Step 25)
2. Implement customer support procedures
3. Create user documentation
4. Launch marketing campaigns
5. Monitor and respond to user feedback

---

**Note**: This is a streamlined deployment guide for immediate production launch. For comprehensive production setup, refer to the full `DEPLOYMENT.md` guide.