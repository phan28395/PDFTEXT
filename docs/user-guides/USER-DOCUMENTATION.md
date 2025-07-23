# PDF-to-Text User Documentation

## Welcome to PDF-to-Text

Convert your PDF documents to editable text format quickly, securely, and reliably. Our platform uses advanced AI-powered OCR technology to extract text from any PDF document with high accuracy.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Account Management](#account-management)
3. [File Processing](#file-processing)
4. [Subscription Plans](#subscription-plans)
5. [Troubleshooting](#troubleshooting)
6. [API Documentation](#api-documentation)
7. [Privacy & Security](#privacy--security)
8. [Support](#support)

## Getting Started

### Creating Your Account

1. **Sign Up**
   - Visit our registration page
   - Enter your email address and create a secure password
   - Verify your email address by clicking the link we send you
   - Complete your profile setup

2. **First Login**
   - Use your email and password to log in
   - You'll be redirected to your dashboard
   - Take the optional tour to learn key features

3. **Free Trial**
   - New accounts include 50 free pages
   - No credit card required for trial
   - Upgrade anytime to continue processing

### Dashboard Overview

Your dashboard provides:
- **Quick Upload**: Drag and drop PDF files
- **Processing History**: View all your conversions
- **Usage Statistics**: Track your page usage
- **Account Settings**: Manage preferences and billing

## Account Management

### Profile Settings

**Personal Information**
- Update your name and contact details
- Change your email address (requires verification)
- Set notification preferences

**Security Settings**
- Change your password
- Enable two-factor authentication (recommended)
- Review login activity
- Manage API keys (Pro users)

### Subscription Management

**Viewing Your Plan**
- Current plan details and limits
- Usage statistics and remaining pages
- Billing cycle information

**Upgrading Your Plan**
- Compare plan features
- Instant activation after payment
- Prorated billing adjustments

**Payment Methods**
- Add or update credit cards
- View billing history
- Download invoices

### Data Management

**Export Your Data**
- Download all your processed documents
- Export processing history
- Request complete data archive

**Delete Your Account**
- Permanently remove all data
- Cancel subscriptions
- 30-day grace period for data recovery

## File Processing

### Supported File Types

- **PDF Documents**: All versions supported
- **File Size Limit**: 10MB per file
- **Batch Processing**: Up to 100 files at once (Pro users)

### Upload Methods

**Single File Upload**
1. Click "Upload PDF" or drag file to upload area
2. File is automatically validated
3. Processing begins immediately
4. Download results when complete

**Batch Upload** (Pro only)
1. Select multiple PDF files
2. Files are queued for processing
3. Monitor progress in real-time
4. Download individual or bulk results

### Processing Options

**Output Formats**
- **Plain Text (.txt)**: Clean, formatted text
- **JSON**: Structured data with metadata
- **DOCX**: Editable Word document (Pro)
- **CSV**: Tabular data extraction (Pro)

**Advanced Features** (Pro only)
- OCR language selection
- Table extraction
- Mathematical equation recognition
- Custom formatting options

### Quality Optimization

**Best Practices for PDFs**
- Use high-resolution documents
- Ensure text is clearly readable
- Avoid heavily stylized fonts
- Clean scans work better than photos

**Common Issues**
- Handwritten text may not be recognized
- Very small text (< 8pt) may be unclear
- Rotated or skewed text should be corrected first
- Password-protected PDFs must be unlocked first

## Subscription Plans

### Free Plan
- **50 pages per month**
- Basic text extraction
- TXT output format only
- Email support
- Processing history (30 days)

### Pro Plan ($19/month)
- **500 pages per month**
- All output formats (TXT, JSON, DOCX, CSV)
- Batch processing (up to 100 files)
- Advanced OCR features
- Priority processing
- API access
- Extended history (1 year)
- Priority email support

### Enterprise (Custom)
- Unlimited pages
- Custom integrations
- Dedicated support
- SLA guarantees
- On-premise deployment options
- Custom features development

## Troubleshooting

### Common Issues

**Upload Problems**
- ❓ **File too large**: Reduce file size or upgrade to Pro
- ❓ **Invalid format**: Ensure file is a PDF document
- ❓ **Upload fails**: Check internet connection and try again

**Processing Errors**
- ❓ **Processing timeout**: Large files may take longer
- ❓ **Poor text quality**: Try higher resolution PDF
- ❓ **Missing text**: Check if PDF contains actual text or only images

**Account Issues**
- ❓ **Login problems**: Reset password or check email verification
- ❓ **Billing issues**: Contact support with order details
- ❓ **Page limit reached**: Upgrade plan or wait for monthly reset

### Error Messages

**"File processing failed"**
- File may be corrupted or encrypted
- Try re-saving the PDF and uploading again

**"Page limit exceeded"**
- Upgrade to Pro plan for higher limits
- Current usage resets on billing cycle date

**"Authentication required"**
- Session expired - please log in again
- Clear browser cache if problem persists

## API Documentation

### Authentication

All API requests require authentication via API key:

```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://your-domain.vercel.app/api/process-pdf
```

### Endpoints

**Process PDF**
```
POST /api/process-pdf
Content-Type: multipart/form-data

Parameters:
- file: PDF file (required)
- format: Output format (txt, json, docx, csv)
- language: OCR language code (optional)
```

**Get Processing Status**
```
GET /api/processing-status/{job_id}

Response:
{
  "status": "completed",
  "progress": 100,
  "result_url": "https://..."
}
```

**Usage Statistics**
```
GET /api/usage-stats

Response:
{
  "pages_used": 45,
  "pages_remaining": 455,
  "plan": "pro"
}
```

### Rate Limits

- **Free Plan**: 10 requests per minute
- **Pro Plan**: 100 requests per minute
- **Enterprise**: Custom limits

### SDKs and Examples

**JavaScript/Node.js**
```javascript
const response = await fetch('/api/process-pdf', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  },
  body: formData
});
```

**Python**
```python
import requests

response = requests.post(
    'https://your-domain.vercel.app/api/process-pdf',
    headers={'Authorization': f'Bearer {api_key}'},
    files={'file': open('document.pdf', 'rb')}
)
```

## Privacy & Security

### Data Protection

**File Security**
- All uploads encrypted in transit (HTTPS)
- Files processed in secure environment
- Automatic deletion after processing
- No long-term file storage

**Account Security**
- Password encryption using industry standards
- Optional two-factor authentication
- Secure session management
- Regular security audits

### Compliance

**GDPR Compliance**
- Right to data export
- Right to deletion
- Transparent data usage
- Consent-based processing

**Privacy Principles**
- Minimal data collection
- No file content retention
- No third-party data sharing
- Audit logs for accountability

### Data Retention

- **Processed files**: Deleted within 24 hours
- **Processing history**: Metadata only, retained per plan
- **Account data**: Retained until account deletion
- **Backup data**: Automatically purged after 30 days

## Support

### Getting Help

**In-App Support**
- Click the "Help" button in your dashboard
- Submit tickets directly from the interface
- Access this documentation
- View system status

**Email Support**
- support@your-domain.com
- Response within 24 hours (4 hours for Pro users)
- Include account details and error messages

**Knowledge Base**
- Searchable help articles
- Video tutorials
- FAQ section
- Community tips

### System Status

Check our status page for:
- Real-time system performance
- Scheduled maintenance announcements
- Incident reports and resolutions
- Service availability metrics

### Feature Requests

We welcome feedback! Submit feature requests via:
- In-app feedback form
- Email to feedback@your-domain.com
- Community forum discussions
- Direct support tickets

### Emergency Contact

For critical issues:
- Security concerns: security@your-domain.com
- Billing emergencies: billing@your-domain.com
- System outages: Use status page for updates

---

## Quick Start Checklist

✅ **Account Setup**
- [ ] Sign up and verify email
- [ ] Complete profile setup
- [ ] Upload first PDF
- [ ] Download converted text

✅ **Optimization**
- [ ] Set notification preferences
- [ ] Enable two-factor authentication
- [ ] Bookmark frequently used features
- [ ] Join our newsletter for updates

✅ **Pro Features** (if applicable)
- [ ] Explore batch processing
- [ ] Try different output formats
- [ ] Set up API access
- [ ] Configure advanced OCR settings

---

## Version Information

**Documentation Version**: 1.0
**Last Updated**: Production Launch
**Platform Version**: 1.0.0
**API Version**: v1

For the most current information, always check our online help center.