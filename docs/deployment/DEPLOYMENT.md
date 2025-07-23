# Production Deployment Guide

## Prerequisites

### 1. Vercel Account Setup
- Create a Vercel account at https://vercel.com
- Install Vercel CLI: `npm i -g vercel`
- Login to Vercel: `vercel login`

### 2. Supabase Production Project
- Create a new Supabase project for production
- Configure Row Level Security (RLS) policies
- Set up database schema using scripts in `/database/`
- Enable email auth and configure SMTP

### 3. Stripe Production Account
- Upgrade to Stripe live mode
- Create production API keys
- Set up webhook endpoints
- Configure products and pricing

### 4. Google Cloud Platform
- Create production GCP project
- Enable Document AI API
- Create service account with appropriate permissions
- Download service account JSON file

## Environment Configuration

### 1. Copy Environment Template
```bash
cp .env.production.example .env.production
```

### 2. Configure Production Variables

**Critical Variables to Update:**
- `VITE_SUPABASE_URL`: Your production Supabase URL
- `VITE_SUPABASE_ANON_KEY`: Production anonymous key
- `SUPABASE_SERVICE_ROLE_KEY`: Production service role key
- `VITE_STRIPE_PUBLISHABLE_KEY`: Live Stripe publishable key (pk_live_...)
- `STRIPE_SECRET_KEY`: Live Stripe secret key (sk_live_...)
- `STRIPE_WEBHOOK_SECRET`: Production webhook secret
- `GOOGLE_CLOUD_PROJECT_ID`: Production GCP project ID
- `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`: Production processor ID
- `JWT_SECRET`: Strong 32+ character secret
- `ENCRYPTION_KEY`: Strong 32+ character encryption key

**Security Keys Generation:**
```bash
# Generate secure JWT secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Generate secure encryption key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Pre-Deployment Checklist

### 1. Code Quality
- [ ] All tests passing: `npm run test:all`
- [ ] TypeScript compilation: `npm run type-check`
- [ ] Linting passed: `npm run lint`
- [ ] Security audit clean: `npm run security:audit`

### 2. Configuration Validation
- [ ] Production environment variables set
- [ ] No test/development keys in production
- [ ] Database schema deployed
- [ ] Stripe webhooks configured
- [ ] Google Cloud credentials uploaded

### 3. Security Review
- [ ] CSP headers configured
- [ ] HTTPS enforcement enabled
- [ ] Rate limiting configured
- [ ] File upload validation in place
- [ ] Authentication flows secured

## Deployment Process

### 1. Automated Production Deployment
```bash
# Set production environment
export NODE_ENV=production

# Run automated deployment
npm run deploy:production
```

The automated deployment script will:
- ✅ Validate environment variables
- ✅ Run all tests and quality checks
- ✅ Optimize production build
- ✅ Deploy to Vercel with production config
- ✅ Run post-deployment verification
- ✅ Generate deployment report

### 2. Manual Deployment (if needed)
```bash
# Build production version
npm run build

# Deploy to Vercel
npm run deploy:prod:quick
```

### 3. Set Environment Variables in Vercel
```bash
# Add all production environment variables
vercel env add VITE_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add STRIPE_SECRET_KEY production
# ... (repeat for all variables)
```

## Post-Deployment Configuration

### 1. Domain Configuration
- Configure custom domain in Vercel dashboard
- Update CORS origins in Supabase
- Update webhook URLs in Stripe
- Update CSP headers with production domain

### 2. Database Backups
```bash
# Test backup system
npm run backup:test

# Schedule automated backups
npm run backup:database
```

### 3. Monitoring Setup
- Configure error tracking (Sentry optional)
- Set up uptime monitoring
- Enable Vercel analytics
- Configure database monitoring

## Database Management

### 1. Schema Migration
```sql
-- Run migration scripts in Supabase SQL editor
-- Files located in /database/ directory
-- Execute in order: schema, policies, functions
```

### 2. Backup Strategy
- **Automated Daily Backups**: 2 AM UTC via cron
- **Retention**: 30 days default
- **Location**: `./backups/` directory
- **Monitoring**: Check `backup.log` daily

### 3. Backup Commands
```bash
# Manual backup
npm run backup:database

# Test backup without affecting production
npm run backup:test

# Restore from backup (manual process)
# Import JSON files from backup directory to Supabase
```

## Security Configuration

### 1. Vercel Security Headers
All security headers are configured in `vercel.json`:
- Strict Transport Security (HSTS)
- Content Security Policy (CSP)
- X-Frame-Options
- X-XSS-Protection
- Referrer-Policy

### 2. Rate Limiting
Production rate limits (stricter than development):
- File uploads: 5 per minute
- Auth attempts: 3 per account
- API requests: 100 per minute

### 3. File Security
- Maximum file size: 10MB
- PDF validation with magic bytes
- VirusTotal scanning enabled
- Temporary file cleanup: 1 hour

## Monitoring and Maintenance

### 1. Health Checks
```bash
# Manual health check
npm run health-check

# Check specific production domain
node health-check.js --url=https://your-domain.vercel.app
```

### 2. Performance Monitoring
- Vercel Analytics for web vitals
- Lighthouse CI for performance budgets
- Database query performance via Supabase dashboard

### 3. Error Monitoring
- Application errors logged via API endpoints
- Database errors tracked in audit logs
- Failed deployments reported in deployment-report.json

## Troubleshooting

### Common Deployment Issues

**1. Environment Variable Errors**
```bash
# Check environment variables in Vercel
vercel env ls

# Update specific variable
vercel env rm VARIABLE_NAME production
vercel env add VARIABLE_NAME production
```

**2. Build Failures**
```bash
# Local build test
npm run build

# Check TypeScript errors
npm run type-check

# Verify dependencies
npm ci
```

**3. Database Connection Issues**
- Verify Supabase URLs and keys
- Check RLS policies are enabled
- Ensure service role key has correct permissions

**4. Stripe Webhook Failures**
- Verify webhook endpoint URL
- Check webhook secret matches
- Ensure webhook is configured for live mode

### Rollback Procedure

**1. Quick Rollback**
```bash
# Redeploy previous working version
vercel rollback
```

**2. Emergency Procedure**
- Disable problematic features via environment variables
- Redirect traffic to maintenance page
- Deploy hotfix immediately

## Support and Resources

### Documentation Links
- [Vercel Deployment Guide](https://vercel.com/docs)
- [Supabase Production Checklist](https://supabase.com/docs/guides/platform/going-into-prod)
- [Stripe Production Checklist](https://stripe.com/docs/keys#test-live-modes)
- [Google Cloud Security Best Practices](https://cloud.google.com/security/best-practices)

### Emergency Contacts
- **Vercel Support**: support@vercel.com
- **Supabase Support**: support@supabase.io
- **Stripe Support**: support@stripe.com

### Monitoring Dashboards
- **Vercel Dashboard**: https://vercel.com/dashboard
- **Supabase Dashboard**: https://app.supabase.io
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Google Cloud Console**: https://console.cloud.google.com

---

**Note**: This guide assumes you have completed all previous development steps and have a fully tested application ready for production deployment. Always test the deployment process in a staging environment first.