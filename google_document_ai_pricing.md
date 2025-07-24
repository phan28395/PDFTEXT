# Google Document AI Pricing Guide (2025)

## Text Digitization (OCR)

### Enterprise Document OCR Processor
Base pricing for converting documents to text:
- **1-5,000,000 pages/month**: $1.50 per 1,000 pages
- **5,000,001+ pages/month**: $0.60 per 1,000 pages

### OCR Add-on Features
Premium features that enhance OCR capabilities:
- **Math OCR**: $6.00 per 1,000 pages (extracts mathematical formulas in LaTeX format)
- **Font Style Detection**: $6.00 per 1,000 pages (identifies font properties, styles, colors)
- **Checkbox Extraction**: $6.00 per 1,000 pages (detects checkbox status)

**Note**: Math OCR and selection mark detection are mutually exclusive add-ons.

---

## Structure and Entity Extraction

### Custom Extractor
For extracting custom fields and entities:
- **1-1,000,000 pages/month**: $30.00 per 1,000 pages
- **1,000,001+ pages/month**: $20.00 per 1,000 pages

### Form Parser
For processing structured forms:
- **1-1,000,000 pages/month**: $30.00 per 1,000 pages
- **1,000,001+ pages/month**: $20.00 per 1,000 pages

### Layout Parser
For understanding document layout and structure:
- **Flat rate**: $10.00 per 1,000 pages

---

## Pretrained Specialized Processors

### Financial Documents
- **Invoice Parser**: $0.10 per 10 pages
- **Expense Parser**: $0.10 per 10 pages
- **Bank Statement Parser**: $0.10 per classified document

### HR Documents
- **Pay Slip Parser**: $0.30 per classified document
- **W2 Parser**: $0.30 per classified document

### Identity Documents
- **US Driver License Parser**: $0.10 per document
- **US Passport Parser**: $0.10 per document

---

## Custom Processor Deployment

### Hosting Costs
- **Custom Processor Hosting**: $0.05 per hour per deployed processor version

---

## Cost Examples

### Math OCR Processing (Your Use Case)
For 1,000 pages with Math OCR enabled:
- Base Enterprise OCR: $1.50
- Math OCR add-on: $6.00
- **Total**: $7.50 per 1,000 pages

### High-Volume Math OCR Processing
For 6,000,000 pages/month with Math OCR:
- First 5M pages: 5,000 × $1.50 = $7,500
- Next 1M pages: 1,000 × $0.60 = $600
- Math OCR for all 6M: 6,000 × $6.00 = $36,000
- **Total**: $44,100/month

### Invoice Processing
For 100 invoices (typically 10 pages each):
- Invoice Parser: 100 × $0.10 = $10.00

---

## Important Notes

- **No charges for failed requests**
- **Pricing is in USD** and may vary by currency
- **Volume discounts** apply to monthly usage
- **Page definition** varies by document type (images, PDFs, Word documents)
- Some specialized processors require **limited access requests**
- **Minimum billing unit** varies by processor type

---

## Getting Started

1. Enable the Document AI API in Google Cloud Console
2. Set up authentication (service account key)
3. Choose appropriate processor based on your needs
4. Monitor usage through Cloud Console billing

For the most up-to-date pricing, visit: https://cloud.google.com/document-ai/pricing