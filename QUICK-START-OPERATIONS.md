# 🚀 Quick Start Operations Guide

**From Demo to Production in 5 Steps**

This guide takes you from the current working demo to a fully operational PDF-to-Text SaaS platform.

## 📊 **Current Status**

✅ **Working Now**: UI Demo Mode (http://localhost:3001)  
🎯 **Goal**: Full Production SaaS Platform  
⏱️ **Time to Production**: ~2-4 hours (depending on service setup)

---

## 🎯 **Step 1: Database Setup (Required) - 15 minutes**

### **Setup Supabase Database**

1. **Create Account**: Go to [supabase.com](https://supabase.com) → Sign up (free)
2. **Create Project**: New Project → Choose region → Wait 2 minutes
3. **Get Credentials**: 
   - Go to Settings → API
   - Copy `Project URL: https://knqnovuzfqehspzxlnrh.supabase.co` and `anon public: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtucW5vdnV6ZnFlaHNwenhsbnJoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNTk0MTMsImV4cCI6MjA2ODgzNTQxM30.gTJEh-xaOFfTK6lTGQjAS_yjhfw1O1WqWCoVikSPfv8` key
4. **Setup Database**:
   - Go to SQL Editor
   - Run all scripts from `/database/` folder in this order:
     - `schema.sql` (core tables)
     - `business-intelligence-schema.sql` (analytics)
     - `api-schema.sql` (API keys)

### **Update Environment**
```bash
# Update .env.local with real values
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-real-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

**✅ Test**: Restart dev server → Registration/Login should work

---

## 🎯 **Step 2: PDF Processing Setup (Core Feature) - 20 minutes**

### **Setup Google Document AI**

1. **Google Cloud Console**: Go to [console.cloud.google.com](https://console.cloud.google.com)
2. **Create Project**: New Project → Enable billing (free tier available)
3. **Enable APIs**: 
   - Document AI API
   - Cloud Storage API (if needed)
4. **Create Processors**:
   - Go to Document AI → Create Processor
   - Create: "Document OCR" processor
   - Create: "Form Parser" processor (optional)
5. **Service Account**:
   - IAM → Service Accounts → Create
   - Download JSON key file
   - Add to project root (git-ignored)

### **Update Environment**
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your-ocr-processor-id
GOOGLE_APPLICATION_CREDENTIALS=./service-account-key.json
```

**✅ Test**: Upload a PDF → Should extract text successfully

---

## 🎯 **Step 3: Payment Processing (Revenue) - 15 minutes**

### **Setup Stripe**

1. **Create Account**: [stripe.com](https://stripe.com) → Sign up
2. **Get Test Keys**: Dashboard → Developers → API Keys
3. **Create Products**:
   - Products → Add Product
   - "Pro Plan" → $20/month → Copy Price ID
4. **Setup Webhooks**:
   - Webhooks → Add endpoint
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: `customer.subscription.*`, `invoice.*`

### **Update Environment**
```bash
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_key
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_PRO_PRICE_ID=price_your_price_id
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

**✅ Test**: Try to upgrade to Pro → Payment flow should work

---

## 🎯 **Step 4: Deploy to Production - 10 minutes**

### **Deploy to Vercel**

1. **Create Account**: [vercel.com](https://vercel.com) → Sign up with GitHub
2. **Import Project**: New Project → Import from Git → Select your repo
3. **Environment Variables**: 
   - Project Settings → Environment Variables
   - Add all variables from `.env.local`
   - Change test keys to production keys
4. **Deploy**: Deploy button → Wait 2-3 minutes

### **Production Environment Variables**
```bash
# Use PRODUCTION values for:
VITE_SUPABASE_URL=https://your-prod-project.supabase.co
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_SECRET_KEY=sk_live_your_live_key
NODE_ENV=production
```

**✅ Test**: Visit your Vercel domain → Full app should work

---

## 🎯 **Step 5: Go Live Checklist - 5 minutes**

### **Pre-Launch Verification**

- [ ] **Database**: Tables created, RLS enabled
- [ ] **Authentication**: Register/Login working
- [ ] **PDF Processing**: Upload → Extract text working  
- [ ] **Payments**: Stripe checkout → Subscription working
- [ ] **Admin Panel**: Access admin features
- [ ] **Security**: HTTPS enabled, environment variables secured
- [ ] **Domain**: Custom domain configured (optional)

### **Launch Preparation**

1. **Switch to Live Mode**:
   - Stripe: Toggle to "Live mode"
   - Update all environment variables to production values
2. **Test with Real Data**: 
   - Real email registration
   - Real PDF upload
   - Real payment (small amount)
3. **Monitoring**: Check Vercel logs, Supabase logs

---

## 📚 **Detailed Documentation**

For comprehensive setup instructions, see:

- **🔧 [Development Guide](docs/development/STATUS.md)** - Current project status
- **🚀 [Production Setup](docs/deployment/PRODUCTION-SETUP.md)** - Detailed deployment
- **🔒 [Security Guide](docs/security/SECURITY.md)** - Security implementation
- **👥 [User Guide](docs/user-guides/USER-DOCUMENTATION.md)** - End-user documentation

---

## 🆘 **Troubleshooting**

### **Common Issues**

| Problem | Solution |
|---------|----------|
| Blank page | Check browser console, verify environment variables |
| "Missing environment variable" | Create `.env.local` with required variables |
| PDF upload fails | Verify Google Document AI setup and credentials |
| Payment fails | Check Stripe test mode vs live mode, verify webhook |
| Database errors | Verify Supabase connection and RLS policies |

### **Getting Help**

1. **Check Logs**: 
   - Browser console (F12)
   - Vercel Function logs
   - Supabase logs
2. **Verify Setup**: Compare your `.env.local` with `.env.example`
3. **Test Services**: Use service dashboards to verify configuration

---

## 💰 **Cost Breakdown (Free Tiers)**

| Service | Free Tier | Cost After |
|---------|-----------|------------|
| **Supabase** | 2 databases, 500MB | $25/month |
| **Google Document AI** | 1000 pages/month | $1.50/1000 pages |
| **Stripe** | Unlimited transactions | 2.9% + 30¢ per transaction |
| **Vercel** | 100GB bandwidth | $20/month pro |

**Total Monthly Cost**: $0 to start, ~$50-100/month at scale

---

## 🎉 **Success Metrics**

When everything is working, you'll have:

- ✅ **Users can register and login**
- ✅ **PDFs are processed and text extracted**  
- ✅ **Payments work and subscriptions are managed**
- ✅ **Admin panel shows user and system metrics**
- ✅ **Analytics track business performance**
- ✅ **API provides developer access**

**🚀 Congratulations! You now have a production SaaS platform!**

---

*Last Updated: January 2024*  
*Estimated Setup Time: 2-4 hours total*  
*Prerequisites: GitHub account, email address, credit card for service verification*