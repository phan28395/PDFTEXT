#!/usr/bin/env node

/**
 * Quick Production Deployment Script
 * For immediate production deployment with basic checks
 */

import { execSync } from 'child_process';
import fs from 'fs';

const log = (message, type = 'info') => {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: '✓',
    warn: '⚠',
    error: '✗',
    progress: '⏳'
  }[type] || 'ℹ';
  
  console.log(`${prefix} [${timestamp}] ${message}`);
};

const CRITICAL_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY'
];

try {
  log('Starting quick production deployment...', 'progress');
  
  // Quick environment check
  const missingVars = CRITICAL_ENV_VARS.filter(envVar => !process.env[envVar]);
  if (missingVars.length > 0) {
    log(`Missing critical environment variables: ${missingVars.join(', ')}`, 'error');
    log('Please set these in your Vercel dashboard or .env.production file', 'error');
  }
  
  // Set production environment
  process.env.NODE_ENV = 'production';
  
  // Clean previous builds
  if (fs.existsSync('dist')) {
    fs.rmSync('dist', { recursive: true });
    log('Cleaned previous build');
  }
  
  // Build for production
  log('Building for production...', 'progress');
  execSync('npm run build', { stdio: 'inherit' });
  
  // Deploy to Vercel
  log('Deploying to Vercel production...', 'progress');
  execSync('vercel --prod --confirm', { stdio: 'inherit' });
  
  log('🎉 Production deployment completed!');
  log('Check your Vercel dashboard for the live URL');
  
} catch (error) {
  log(`Deployment failed: ${error.message}`, 'error');
  process.exit(1);
}