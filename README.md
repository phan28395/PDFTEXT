# PDF-TO-TEXT SaaS

A modern web application for converting PDF documents to text using AI-powered OCR.

## Features

- 📄 PDF to text conversion using Google Document AI
- 🖼️ Preview pages before processing
- 💳 Pay-per-use with Stripe integration
- 🔐 Secure authentication with Supabase
- ☁️ Cloud storage with Cloudinary

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Vercel Functions (Serverless)
- **Database**: PostgreSQL (Supabase)
- **Storage**: Cloudinary
- **OCR**: Google Document AI
- **Payments**: Stripe

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Accounts for: Supabase, Cloudinary, Google Cloud, Stripe

### Environment Setup

1. Clone the repository
2. Copy `.env.example` to `.env.local`
3. Fill in your API keys:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Cloudinary
VITE_CLOUDINARY_CLOUD_NAME=your_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=pdf_uploads

# Google Document AI
GOOGLE_APPLICATION_CREDENTIALS_JSON=your_credentials_json
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_DOCUMENT_AI_PROCESSOR_ID=your_processor_id

# Stripe
VITE_STRIPE_PUBLISHABLE_KEY=your_stripe_pk
STRIPE_SECRET_KEY=your_stripe_sk
```

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Deploy

Deploy to Vercel:

```bash
vercel --prod
```

## Database Setup

Run the schema in your Supabase SQL editor:

```bash
database/schema.sql
```

## Cloudinary Setup

See `CLOUDINARY_SETUP.md` for detailed Cloudinary configuration instructions.

## Project Structure

```
src/
├── api/          # API client code
├── components/   # React components
├── hooks/        # Custom React hooks
├── lib/          # Core libraries
├── pages/        # Page components
├── services/     # Business logic
├── types/        # TypeScript types
└── utils/        # Utilities

api/              # Vercel serverless functions
database/         # Database schema
public/           # Static assets
```

## License

MIT