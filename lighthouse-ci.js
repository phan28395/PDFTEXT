module.exports = {
  ci: {
    collect: {
      // URLs to test
      url: [
        'http://localhost:3000',
        'http://localhost:3000/pricing',
        'http://localhost:3000/login',
        'http://localhost:3000/register',
        'http://localhost:3000/dashboard'
      ],
      
      // Lighthouse settings
      settings: {
        chromeFlags: '--no-sandbox --disable-dev-shm-usage',
        preset: 'desktop',
        onlyCategories: [
          'performance',
          'accessibility', 
          'best-practices',
          'seo'
        ]
      },
      
      // Number of runs per URL
      numberOfRuns: 3,
      
      // Puppeteer options
      puppeteerScript: './lighthouse-puppeteer.js'
    },
    
    assert: {
      // Performance budgets
      assertions: {
        'categories:performance': ['error', { minScore: 0.8 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.8 }],
        
        // Core Web Vitals
        'first-contentful-paint': ['error', { maxNumericValue: 2000 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'first-meaningful-paint': ['error', { maxNumericValue: 2000 }],
        'speed-index': ['error', { maxNumericValue: 3000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['error', { maxNumericValue: 300 }],
        
        // Network and resource audits
        'uses-long-cache-ttl': 'warn',
        'uses-optimized-images': 'warn',
        'modern-image-formats': 'warn',
        'unused-javascript': 'warn',
        'unused-css-rules': 'warn',
        
        // Security audits
        'is-on-https': 'error',
        'uses-http2': 'warn',
        'no-vulnerable-libraries': 'error',
        
        // Accessibility audits
        'color-contrast': 'error',
        'image-alt': 'error',
        'label': 'error',
        'link-name': 'error',
        
        // Best practices
        'uses-https': 'error',
        'no-document-write': 'error',
        'external-anchors-use-rel-noopener': 'error'
      }
    },
    
    upload: {
      // Upload to Lighthouse CI server
      target: 'lhci',
      serverBaseUrl: process.env.LHCI_SERVER_URL,
      token: process.env.LHCI_TOKEN,
      
      // Or upload to GitHub status checks
      // target: 'github',
      // githubStatusContext: 'lighthouse-ci'
    },
    
    server: {
      // Lighthouse CI server configuration
      port: 9001,
      storage: {
        storageMethod: 'sql',
        sqlDialect: 'sqlite',
        sqlDatabasePath: './lhci.db'
      }
    },
    
    wizard: {
      // Configuration wizard settings
      skipGithubStatusCheck: false
    }
  }
}