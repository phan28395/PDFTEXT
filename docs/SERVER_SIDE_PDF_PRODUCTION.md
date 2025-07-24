# Production-Ready Server-Side PDF Implementation

## Security & Performance Considerations

### 1. Secure File Handling

```typescript
// src/middleware/pdfSecurity.ts
import { Request, Response, NextFunction } from 'express';
import fileType from 'file-type';
import crypto from 'crypto';

export const validatePDF = async (
  req: Request, 
  res: Response, 
  next: NextFunction
) => {
  try {
    const buffer = req.file?.buffer;
    if (!buffer) {
      return res.status(400).json({ error: 'No file provided' });
    }
    
    // Verify file type
    const type = await fileType.fromBuffer(buffer);
    if (type?.mime !== 'application/pdf') {
      return res.status(400).json({ error: 'Invalid file type' });
    }
    
    // Check file size (50MB limit)
    if (buffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large' });
    }
    
    // Generate secure file ID
    req.pdfId = crypto.randomBytes(16).toString('hex');
    
    next();
  } catch (error) {
    res.status(500).json({ error: 'File validation failed' });
  }
};

// Rate limiting
import rateLimit from 'express-rate-limit';

export const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 uploads per window
  message: 'Too many uploads, please try again later'
});

export const imageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 image requests per minute
  skipSuccessfulRequests: true
});
```

### 2. Optimized Processing with Queue

```typescript
// src/services/pdfQueue.ts
import Bull from 'bull';
import { PDFImageProcessor } from './pdfImageProcessor';

const pdfQueue = new Bull('pdf-processing', {
  redis: {
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT
  }
});

// Worker
pdfQueue.process(async (job) => {
  const { pdfBuffer, pdfId, userId } = job.data;
  
  // Update job progress
  job.progress(10);
  
  const processor = new PDFImageProcessor();
  const result = await processor.convertPDFToImages(pdfBuffer, pdfId, {
    onProgress: (percent) => job.progress(percent)
  });
  
  // Store metadata
  await storeProcessingResult(userId, pdfId, result);
  
  return result;
});

// Add job to queue
export const queuePDFProcessing = async (
  pdfBuffer: Buffer,
  pdfId: string,
  userId: string
) => {
  const job = await pdfQueue.add({
    pdfBuffer,
    pdfId,
    userId
  }, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000
    }
  });
  
  return job.id;
};
```

### 3. Efficient Storage with CDN

```typescript
// src/services/storageService.ts
import AWS from 'aws-sdk';
import { createClient } from '@supabase/supabase-js';

export class StorageService {
  private s3 = new AWS.S3();
  private supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
  
  async storeImage(
    userId: string,
    pdfId: string,
    pageNum: number,
    imageBuffer: Buffer,
    contentType = 'image/webp'
  ) {
    const key = `pdfs/${userId}/${pdfId}/pages/${pageNum}.webp`;
    
    // Option A: AWS S3
    await this.s3.putObject({
      Bucket: process.env.S3_BUCKET!,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=86400', // 24 hours
      Metadata: {
        userId,
        pdfId,
        pageNum: String(pageNum)
      }
    }).promise();
    
    // Option B: Supabase Storage
    const { error } = await this.supabase.storage
      .from('pdf-images')
      .upload(key, imageBuffer, {
        contentType,
        cacheControl: '86400'
      });
      
    if (error) throw error;
    
    return key;
  }
  
  async getSignedUrl(key: string, expiresIn = 3600) {
    // Generate time-limited signed URL
    const { data } = await this.supabase.storage
      .from('pdf-images')
      .createSignedUrl(key, expiresIn);
      
    return data?.signedUrl;
  }
}
```

### 4. Smart Caching Strategy

```typescript
// src/services/cacheService.ts
import Redis from 'ioredis';
import LRU from 'lru-cache';

class CacheService {
  private redis = new Redis();
  private memoryCache = new LRU<string, Buffer>({
    max: 100, // 100 images in memory
    maxSize: 100 * 1024 * 1024, // 100MB
    sizeCalculation: (value) => value.length,
    ttl: 1000 * 60 * 15 // 15 minutes
  });
  
  async getImage(key: string): Promise<Buffer | null> {
    // Check memory cache first
    const memCached = this.memoryCache.get(key);
    if (memCached) return memCached;
    
    // Check Redis
    const redisCached = await this.redis.getBuffer(key);
    if (redisCached) {
      // Promote to memory cache
      this.memoryCache.set(key, redisCached);
      return redisCached;
    }
    
    return null;
  }
  
  async setImage(key: string, buffer: Buffer, ttl = 3600) {
    // Store in both caches
    this.memoryCache.set(key, buffer);
    await this.redis.setex(key, ttl, buffer);
  }
  
  // Warming cache for frequently accessed PDFs
  async warmCache(pdfId: string, pageCount: number) {
    const pagesToWarm = Math.min(5, pageCount);
    
    for (let i = 1; i <= pagesToWarm; i++) {
      // Trigger background loading
      this.loadPageInBackground(pdfId, i);
    }
  }
}
```

### 5. Progressive Enhancement Frontend

```tsx
// src/components/ProgressivePDFViewer.tsx
import { useState, useEffect, useRef } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

function LazyPageImage({ 
  pdfId, 
  pageNum, 
  isVisible 
}: { 
  pdfId: string; 
  pageNum: number; 
  isVisible: boolean;
}) {
  const [src, setSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (isVisible && !src) {
      // Load high quality image
      setSrc(`/api/pdf/${pdfId}/page/${pageNum}`);
    }
  }, [isVisible, pdfId, pageNum, src]);
  
  return (
    <div className="relative min-h-[800px] bg-gray-100">
      {/* Low quality placeholder */}
      {loading && (
        <img
          src={`/api/pdf/${pdfId}/page/${pageNum}?thumbnail=true`}
          className="absolute inset-0 w-full h-full object-contain blur-sm"
          alt=""
        />
      )}
      
      {/* High quality image */}
      {src && (
        <img
          src={src}
          onLoad={() => setLoading(false)}
          className={`w-full h-auto transition-opacity duration-300 ${
            loading ? 'opacity-0' : 'opacity-100'
          }`}
          alt={`Page ${pageNum}`}
        />
      )}
      
      {/* Page number overlay */}
      <div className="absolute bottom-4 right-4 bg-black/50 text-white px-2 py-1 rounded text-sm">
        Page {pageNum}
      </div>
    </div>
  );
}

export function ProgressivePDFViewer({ pdfId, totalPages }: Props) {
  const [visiblePages, setVisiblePages] = useState(new Set([1]));
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Continuous scroll mode
  return (
    <div ref={containerRef} className="overflow-auto h-full">
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
          <IntersectionObserverWrapper
            key={pageNum}
            onVisible={() => setVisiblePages(prev => new Set([...prev, pageNum]))}
            threshold={0.1}
          >
            <LazyPageImage
              pdfId={pdfId}
              pageNum={pageNum}
              isVisible={visiblePages.has(pageNum)}
            />
          </IntersectionObserverWrapper>
        ))}
      </div>
    </div>
  );
}
```

### 6. Monitoring & Analytics

```typescript
// src/services/monitoring.ts
import * as Sentry from '@sentry/node';
import { StatsD } from 'node-statsd';

const statsd = new StatsD();

export class PDFMetrics {
  static trackProcessing(pdfId: string, pageCount: number, duration: number) {
    // Track processing time
    statsd.timing('pdf.processing.duration', duration);
    statsd.increment('pdf.processing.count');
    statsd.gauge('pdf.processing.pages', pageCount);
    
    // Track by page count buckets
    const bucket = this.getPageCountBucket(pageCount);
    statsd.increment(`pdf.processing.pages.${bucket}`);
  }
  
  static trackImageServed(pdfId: string, pageNum: number, cached: boolean) {
    statsd.increment('pdf.images.served');
    statsd.increment(`pdf.images.cache.${cached ? 'hit' : 'miss'}`);
  }
  
  static trackError(error: Error, context: any) {
    Sentry.captureException(error, {
      tags: {
        service: 'pdf-processor'
      },
      extra: context
    });
    
    statsd.increment('pdf.errors');
  }
  
  private static getPageCountBucket(pages: number): string {
    if (pages <= 10) return '1-10';
    if (pages <= 50) return '11-50';
    if (pages <= 100) return '51-100';
    return '100+';
  }
}
```

### 7. Cleanup Service

```typescript
// src/services/cleanupService.ts
import cron from 'node-cron';

export class CleanupService {
  // Run every hour
  static schedule() {
    cron.schedule('0 * * * *', async () => {
      await this.cleanupExpiredPDFs();
    });
  }
  
  static async cleanupExpiredPDFs() {
    const expirationTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
    
    // Find expired PDFs
    const expiredPDFs = await db.query(
      'SELECT pdf_id FROM pdf_processing WHERE created_at < $1',
      [new Date(expirationTime)]
    );
    
    // Delete files and records
    for (const { pdf_id } of expiredPDFs) {
      await this.deletePDFFiles(pdf_id);
      await this.deletePDFRecord(pdf_id);
    }
  }
  
  private static async deletePDFFiles(pdfId: string) {
    // Delete from storage
    const files = await storage.listFiles(`pdfs/*/${pdfId}/*`);
    await Promise.all(files.map(file => storage.deleteFile(file)));
    
    // Clear cache
    await cache.deletePattern(`pdf:${pdfId}:*`);
  }
}
```

## Deployment Checklist

- [ ] Set up Redis for queuing and caching
- [ ] Configure S3/Supabase storage buckets
- [ ] Set up CDN for image delivery
- [ ] Configure monitoring (Sentry, StatsD)
- [ ] Set up cleanup cron jobs
- [ ] Configure rate limiting
- [ ] Set up health checks
- [ ] Configure auto-scaling for workers
- [ ] Set up backup strategy
- [ ] Configure SSL/TLS for all endpoints

## Performance Targets

- First page render: < 2 seconds
- Subsequent pages: < 500ms
- Queue processing: < 10s for 50-page PDF
- Cache hit rate: > 80%
- Availability: 99.9%