# Google Document AI Pricing Guide

## Overview
Google Document AI charges based on the number of pages processed. Pricing varies by processor type and monthly volume. Failed requests are not charged.

## Pricing Categories

### 1. Digitize Text (OCR)

#### Enterprise Document OCR Processor
- **Tier 1**: 1 - 5,000,000 pages/month: **$1.50 per 1,000 pages**
- **Tier 2**: 5,000,001+ pages/month: **$0.60 per 1,000 pages**

**Example Use Cases:**
- Converting scanned invoices to searchable PDFs
- Digitizing historical documents
- Processing handwritten forms

**Cost Examples:**
- Small business (10,000 pages/month): 10 × $1.50 = **$15/month**
- Medium company (100,000 pages/month): 100 × $1.50 = **$150/month**
- Enterprise (6,000,000 pages/month): 
  - First 5M: 5,000 × $1.50 = $7,500
  - Next 1M: 1,000 × $0.60 = $600
  - Total: **$8,100/month**

#### OCR Add-ons
- **Flat rate**: **$6 per 1,000 pages** (all volumes)

**Example Use Cases:**
- Adding language detection to OCR results
- Enhanced accuracy for complex layouts
- Special character recognition

**Cost Example:**
- Processing 50,000 pages with add-ons: 50 × $6 = **$300**

### 2. Extract Structures & Entities

#### Custom Extractor
- **Tier 1**: 1 - 1,000,000 pages/month: **$30 per 1,000 pages**
- **Tier 2**: 1,000,001+ pages/month: **$20 per 1,000 pages**

**Example Use Cases:**
- Extracting specific fields from custom forms
- Processing proprietary document formats
- Industry-specific data extraction

**Cost Examples:**
- Startup (5,000 pages/month): 5 × $30 = **$150/month**
- Growing business (500,000 pages/month): 500 × $30 = **$15,000/month**
- Large enterprise (2,000,000 pages/month):
  - First 1M: 1,000 × $30 = $30,000
  - Next 1M: 1,000 × $20 = $20,000
  - Total: **$50,000/month**

#### Form Parser
- **Same pricing as Custom Extractor**

**Example Use Cases:**
- Processing insurance claim forms
- Extracting data from tax forms
- Handling registration forms

**Cost Example:**
- Processing 25,000 application forms: 25 × $30 = **$750**

#### Layout Parser
- **Flat rate**: **$10 per 1,000 pages**

**Example Use Cases:**
- Understanding document structure (headers, paragraphs, tables)
- Converting documents to structured formats
- Preparing documents for further processing

**Cost Examples:**
- Analyzing 100,000 documents: 100 × $10 = **$1,000**
- Monthly report processing (200,000 pages): 200 × $10 = **$2,000/month**

### 3. Pretrained Processors

#### Invoice Parser
- **$0.10 per 10 pages** ($10 per 1,000 pages)

**Example Use Cases:**
- Automating accounts payable
- Extracting vendor information, amounts, dates
- Processing international invoices

**Cost Examples:**
- Small business (1,000 invoices/month): 100 × $0.10 = **$10/month**
- Medium company (50,000 invoices/month): 5,000 × $0.10 = **$500/month**

#### Expense Parser
- **$0.10 per 10 pages** ($10 per 1,000 pages)

**Example Use Cases:**
- Processing employee expense reports
- Extracting receipt data
- Categorizing business expenses

**Cost Example:**
- Processing 10,000 receipts: 1,000 × $0.10 = **$100**

#### Utility Parser
- **$0.10 per 10 pages** ($10 per 1,000 pages)

**Example Use Cases:**
- Processing utility bills
- Extracting meter readings
- Tracking energy consumption

**Cost Example:**
- Monthly utility bill processing (5,000 bills): 500 × $0.10 = **$50/month**

#### Document Classifiers
- **$0.05 - $0.30 per document** (varies by classifier type)

**Example Use Cases:**
- Sorting incoming mail
- Categorizing support tickets
- Routing documents to appropriate departments

**Cost Examples:**
- Basic classification (10,000 docs at $0.05): 10,000 × $0.05 = **$500**
- Complex classification (10,000 docs at $0.30): 10,000 × $0.30 = **$3,000**

### 4. Custom Processor Hosting
- **$0.05 per hour** per deployed processor version
- **Annual cost**: $0.05 × 24 × 365 = **$438/year**

**Example Use Cases:**
- Hosting trained custom models
- Maintaining multiple versions for A/B testing
- Running specialized extraction models

**Cost Example:**
- Running 3 custom processors year-round: 3 × $438 = **$1,314/year**

## Page Definition

### What Counts as a Page?
- **PDF**: Each page in the PDF
- **Images**: Each image file = 1 page
- **TIFF**: Multi-page TIFF counts as multiple pages
- **Documents**: Based on standard page breaks

### Maximum Page Size
- Most processors: 20 pages per request
- Some specialized processors may have different limits

## Cost Optimization Strategies

### 1. Volume Planning
```
Example: Processing 4.5M pages/month
- All at Tier 1 OCR: 4,500 × $1.50 = $6,750
- Better approach: Process 5M+ to qualify for Tier 2
- Result: 5,000 × $1.50 + additional at $0.60 = potential savings
```

### 2. Processor Selection
```
Example: Invoice processing options
- Custom Extractor: $30/1,000 pages
- Invoice Parser: $10/1,000 pages
- Savings: $20/1,000 pages (67% cost reduction)
```

### 3. Batch Processing
```
Example: Daily document processing
- Individual requests: Higher overhead
- Batch of 20 pages: Optimal efficiency
- Recommendation: Accumulate documents for batch processing
```

## Real-World Scenarios

### Scenario 1: Law Firm
- **Volume**: 200,000 pages/month
- **Mix**: 80% OCR, 20% Layout Parser
- **Monthly Cost**:
  - OCR: 160 × $1.50 = $240
  - Layout: 40 × $10 = $400
  - **Total**: $640/month

### Scenario 2: Healthcare Provider
- **Volume**: 1,500,000 pages/month
- **Mix**: 60% Form Parser, 40% Custom Extractor
- **Monthly Cost**:
  - Form Parser: 900 × $30 = $27,000
  - Custom Extractor: 600 × $30 = $18,000
  - **Total**: $45,000/month

### Scenario 3: E-commerce Company
- **Volume**: 50,000 invoices/month
- **Processing**: Invoice Parser only
- **Monthly Cost**: 5,000 × $0.10 = **$500/month**

## Free Tier Information
- Google offers $300 free credits for new users
- No permanent free tier for Document AI
- Trial period allows testing all processor types

## Additional Costs to Consider
1. **Google Cloud Storage**: For storing documents
2. **Compute Engine**: If running custom processing pipelines
3. **Network egress**: For downloading results
4. **BigQuery**: For analyzing extracted data

## Billing Examples

### Small Business Budget
```
Monthly Processing:
- 5,000 pages OCR: 5 × $1.50 = $7.50
- 1,000 invoices: 100 × $0.10 = $10
- Total: $17.50/month (~$210/year)
```

### Medium Enterprise Budget
```
Monthly Processing:
- 100,000 pages Custom Extractor: 100 × $30 = $3,000
- 50,000 pages Layout Parser: 50 × $10 = $500
- 2 Custom Processors: 2 × $0.05 × 730 = $73
- Total: $3,573/month (~$42,876/year)
```

### Large Corporation Budget
```
Monthly Processing:
- 10,000,000 pages OCR: 
  - First 5M: 5,000 × $1.50 = $7,500
  - Next 5M: 5,000 × $0.60 = $3,000
- 2,000,000 pages Custom Extractor:
  - First 1M: 1,000 × $30 = $30,000
  - Next 1M: 1,000 × $20 = $20,000
- Total: $60,500/month (~$726,000/year)
```

## Key Takeaways
1. **Volume discounts** kick in at 5M pages for OCR, 1M for extractors
2. **Pretrained processors** are significantly cheaper than custom ones
3. **Failed requests** don't incur charges
4. **Plan for scale** to optimize pricing tiers
5. **Test thoroughly** during trial period to estimate costs accurately