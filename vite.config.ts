import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import fs from 'fs'
import path from 'path'

// Plugin to copy PDF.js worker to public directory
const copyPdfWorker = () => {
  return {
    name: 'copy-pdf-worker',
    buildStart() {
      // Copy the legacy worker (more compatible)
      const workerPath = path.resolve(__dirname, 'node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs');
      const destPath = path.resolve(__dirname, 'public/pdf.worker.legacy.js');
      
      if (fs.existsSync(workerPath)) {
        fs.copyFileSync(workerPath, destPath);
        console.log('PDF.js legacy worker copied to public directory');
      } else {
        console.warn('PDF.js worker not found at:', workerPath);
      }
    }
  };
}

export default defineConfig({
  plugins: [react(), copyPdfWorker()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    fs: {
      // Allow serving files from node_modules for PDF.js worker
      allow: ['..'],
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: process.env.NODE_ENV === 'production',
        drop_debugger: process.env.NODE_ENV === 'production',
      },
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks for better caching
          react: ['react', 'react-dom'],
          router: ['react-router-dom'],
          ui: ['lucide-react'],
          supabase: ['@supabase/supabase-js'],
          stripe: ['@stripe/stripe-js'],
          // Split large pages into separate chunks
          admin: ['./src/pages/Admin.tsx'],
          batch: ['./src/pages/BatchProcessing.tsx', './src/components/BatchUpload.tsx'],
          analytics: ['./src/components/UsageAnalytics.tsx'],
        },
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId
            ? chunkInfo.facadeModuleId.split('/').pop()?.replace('.tsx', '').replace('.ts', '')
            : 'chunk';
          return `js/${facadeModuleId}-[hash].js`;
        },
        entryFileNames: 'js/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const extType = assetInfo.name?.split('.').pop();
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType || '')) {
            return `images/[name]-[hash][extname]`;
          }
          if (/css/i.test(extType || '')) {
            return `css/[name]-[hash][extname]`;
          }
          if (/woff2?|eot|ttf|otf/i.test(extType || '')) {
            return `fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    // Asset optimization
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    cssCodeSplit: true,
    reportCompressedSize: false, // Faster builds
    chunkSizeWarningLimit: 1000,
  },
  // Asset optimization
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      'lucide-react',
      'pdfjs-dist',
    ],
    exclude: ['pdfjs-dist/build/pdf.worker.min.js'],
  },
  define: {
    // Ensure environment variables are available in the build
    'process.env': {},
    // Enable production optimizations
    __DEV__: process.env.NODE_ENV !== 'production',
  },
  // Enable gzip compression hints
  experimental: {
    renderBuiltUrl(filename: string, { hostType }: { hostType: 'js' | 'css' | 'html' }) {
      if (hostType === 'js' || hostType === 'css') {
        // Use CDN URL in production if VITE_CDN_URL is set
        const cdnUrl = process.env.VITE_CDN_URL;
        if (cdnUrl && process.env.NODE_ENV === 'production') {
          return `${cdnUrl}/${filename}`;
        }
      }
      return { relative: true };
    },
  },
})