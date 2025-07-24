# Enhanced PDF Processing Features

## Overview

The application now includes enhanced PDF processing capabilities with:

1. **PDF Viewer with Page Navigation**
   - Scroll through entire PDF documents
   - Zoom in/out functionality
   - Page rotation
   - Real-time page preview

2. **Page Range Selection**
   - Select specific page ranges for processing
   - Automatic cost calculation based on selected pages
   - Validation to ensure page numbers don't exceed available pages

3. **Multiple Output Formats**
   - Plain Text (.txt)
   - Markdown (.md) with page headers and confidence scores
   - HTML (.html) with styled formatting
   - JSON (.json) with structured data and metadata
   - DOCX-style formatted text

## How It Works

### 1. Upload Process
1. User uploads a PDF file
2. PDF viewer automatically displays the document
3. User can navigate through pages using controls
4. User selects desired page range (defaults to all pages)
5. User chooses output format
6. System processes only selected pages and converts to chosen format

### 2. Page Range Validation
- Frontend validates page numbers against total document pages
- Backend double-checks page ranges before processing
- Cost calculation updates dynamically based on selected pages
- Only selected pages are charged to user's account

### 3. Format Conversion
- Backend processes selected pages using Google Document AI
- Text is extracted from specified page range
- Content is converted to requested output format
- Formatted content is returned to user

## Technical Implementation

### Frontend Components

**PDFViewer Component**
- Uses PDF.js for document rendering
- Provides navigation controls (previous/next, zoom, rotate)
- Includes page range selection interface
- Output format dropdown selection
- Real-time preview with page indicators

**Enhanced FileUpload Component**
- Integrates PDF viewer for PDF files
- Maintains state for page selection and format preferences
- Updates cost calculations based on page range
- Passes selection parameters to processing API

### Backend Enhancements

**process-pdf.js API**
- Accepts `startPage` and `endPage` parameters
- Accepts `outputFormat` parameter
- Validates page ranges against document structure
- Processes only specified page range
- Converts text to requested format using helper functions

**Format Conversion Functions**
- `convertToMarkdown()`: Creates structured Markdown with page headers
- `convertToHTML()`: Generates styled HTML with CSS
- `convertToDocxText()`: Formats text for Word-like appearance
- JSON output includes page-by-page breakdown with confidence scores

## Usage Examples

### Processing Specific Pages
```javascript
// User selects pages 5-10 from a 20-page document
// Only 6 pages are processed and charged
// Cost: 6 pages × $0.012 = $0.072
```

### Format Selection
```javascript
// Markdown output includes:
# Document Content

## Page 5
[Page content here...]
*Confidence: 95.2%*

---

## Page 6
[Page content here...]
*Confidence: 97.1%*
```

### HTML Output
```html
<!-- Generated HTML includes styling and page structure -->
<div class="page">
    <div class="page-header">
        <h2>Page 5</h2>
    </div>
    <pre>[Page content...]</pre>
    <div class="confidence">Confidence: 95.2%</div>
</div>
```

## Benefits

1. **Cost Efficiency**: Users only pay for pages they actually need
2. **Flexibility**: Multiple output formats for different use cases
3. **User Experience**: Visual PDF preview before processing
4. **Precision**: Exact page selection for targeted extraction
5. **Professional Output**: Formatted results ready for various applications

## Future Enhancements

- Support for image formats (JPG, PNG) with similar page-like processing
- Advanced format options (RTF, XML, CSV for tables)
- Batch processing with different formats per document
- OCR confidence visualization overlay on PDF viewer
- Export to cloud storage services