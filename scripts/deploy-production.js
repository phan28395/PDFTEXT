#!/usr/bin/env node

/**
 * Production Deployment Script for PDF-to-Text SaaS
 * 
 * This script handles:
 * - Environment validation
 * - Pre-deployment checks
 * - Production build optimization
 * - Vercel deployment with production configuration
 * - Post-deployment verification
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const REQUIRED_ENV_VARS = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'GOOGLE_CLOUD_PROJECT_ID',
  'GOOGLE_DOCUMENT_AI_PROCESSOR_ID',
  'JWT_SECRET',
  'ENCRYPTION_KEY'
];

class ProductionDeployer {
  constructor() {
    this.projectRoot = process.cwd();
    this.errors = [];
    this.warnings = [];
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = {
      info: '✓',
      warn: '⚠',
      error: '✗',
      progress: '⏳'
    }[type] || 'ℹ';
    
    console.log(`${prefix} [${timestamp}] ${message}`);
  }

  validateEnvironment() {
    this.log('Validating production environment variables...', 'progress');
    
    const missingVars = [];
    const weakSecrets = [];
    
    for (const envVar of REQUIRED_ENV_VARS) {
      const value = process.env[envVar];
      
      if (!value) {
        missingVars.push(envVar);
        continue;
      }
      
      // Check for weak secrets
      if (envVar.includes('SECRET') || envVar.includes('KEY')) {
        if (value.length < 32) {
          weakSecrets.push(`${envVar} (${value.length} chars, minimum 32 required)`);
        }
        if (value.includes('test') || value.includes('dev') || value === 'changeme') {
          weakSecrets.push(`${envVar} appears to be a development/test value`);
        }
      }
      
      // Check for development values in production keys
      if (envVar.includes('STRIPE') && value.includes('test')) {
        this.errors.push(`${envVar} contains test keys in production environment`);
      }
    }
    
    if (missingVars.length > 0) {
      this.errors.push(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
    
    if (weakSecrets.length > 0) {
      this.warnings.push(`Weak or suspicious secrets detected: ${weakSecrets.join(', ')}`);
    }
    
    // Validate NODE_ENV
    if (process.env.NODE_ENV !== 'production') {
      this.errors.push('NODE_ENV must be set to "production" for production deployment');
    }
    
    this.log(`Environment validation completed. Errors: ${this.errors.length}, Warnings: ${this.warnings.length}`);
  }

  runPreDeploymentChecks() {
    this.log('Running pre-deployment checks...', 'progress');
    
    try {
      // Type checking
      this.log('Running TypeScript type checking...');
      execSync('npm run type-check', { stdio: 'inherit' });
      
      // Linting
      this.log('Running ESLint...');
      execSync('npm run lint', { stdio: 'inherit' });
      
      // Unit tests
      this.log('Running unit tests...');
      execSync('npm run test:run', { stdio: 'inherit' });
      
      // Security audit
      this.log('Running security audit...');
      execSync('npm run security:audit', { stdio: 'inherit' });
      
      // Build test
      this.log('Testing production build...');
      execSync('npm run build', { stdio: 'inherit' });
      
      this.log('All pre-deployment checks passed!');
    } catch (error) {
      this.errors.push(`Pre-deployment check failed: ${error.message}`);
    }
  }

  optimizeBuild() {
    this.log('Optimizing production build...', 'progress');
    
    try {
      // Clean previous builds
      if (fs.existsSync('dist')) {
        fs.rmSync('dist', { recursive: true });
      }
      
      // Set production optimizations
      process.env.NODE_ENV = 'production';
      process.env.VITE_BUILD_TARGET = 'production';
      
      // Build with optimizations
      execSync('npm run build', { 
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
      
      this.log('Production build optimized successfully');
    } catch (error) {
      this.errors.push(`Build optimization failed: ${error.message}`);
    }
  }

  deployToVercel() {
    this.log('Deploying to Vercel production...', 'progress');
    
    try {
      // Deploy to production
      execSync('vercel --prod --confirm', { stdio: 'inherit' });
      
      this.log('Deployment to Vercel completed successfully');
    } catch (error) {
      this.errors.push(`Vercel deployment failed: ${error.message}`);
    }
  }

  runPostDeploymentVerification() {
    this.log('Running post-deployment verification...', 'progress');
    
    try {
      // Wait a moment for deployment to propagate
      setTimeout(() => {
        // Health check (if domain is configured)
        if (process.env.PRODUCTION_DOMAIN) {
          this.log(`Running health check on ${process.env.PRODUCTION_DOMAIN}...`);
          execSync(`node health-check.js --url=${process.env.PRODUCTION_DOMAIN}`, { stdio: 'inherit' });
        }
        
        this.log('Post-deployment verification completed');
      }, 5000);
    } catch (error) {
      this.warnings.push(`Post-deployment verification warning: ${error.message}`);
    }
  }

  generateDeploymentReport() {
    const report = {
      timestamp: new Date().toISOString(),
      environment: 'production',
      status: this.errors.length === 0 ? 'success' : 'failed',
      errors: this.errors,
      warnings: this.warnings,
      nodeVersion: process.version,
      npmVersion: execSync('npm --version', { encoding: 'utf8' }).trim()
    };
    
    fs.writeFileSync('deployment-report.json', JSON.stringify(report, null, 2));
    this.log(`Deployment report saved to deployment-report.json`);
    
    return report;
  }

  async deploy() {
    this.log('Starting production deployment process...', 'progress');
    
    try {
      this.validateEnvironment();
      
      if (this.errors.length > 0) {
        this.log('Environment validation failed:', 'error');
        this.errors.forEach(error => this.log(error, 'error'));
        process.exit(1);
      }
      
      if (this.warnings.length > 0) {
        this.log('Environment warnings detected:', 'warn');
        this.warnings.forEach(warning => this.log(warning, 'warn'));
      }
      
      this.runPreDeploymentChecks();
      
      if (this.errors.length > 0) {
        this.log('Pre-deployment checks failed:', 'error');
        this.errors.forEach(error => this.log(error, 'error'));
        process.exit(1);
      }
      
      this.optimizeBuild();
      this.deployToVercel();
      this.runPostDeploymentVerification();
      
      const report = this.generateDeploymentReport();
      
      if (report.status === 'success') {
        this.log('🎉 Production deployment completed successfully!');
        if (process.env.PRODUCTION_DOMAIN) {
          this.log(`🌐 Your application is live at: ${process.env.PRODUCTION_DOMAIN}`);
        }
      } else {
        this.log('❌ Production deployment completed with errors');
        process.exit(1);
      }
      
    } catch (error) {
      this.log(`Fatal deployment error: ${error.message}`, 'error');
      process.exit(1);
    }
  }
}

// Run deployment if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const deployer = new ProductionDeployer();
  deployer.deploy().catch(error => {
    console.error('Deployment failed:', error);
    process.exit(1);
  });
}

export default ProductionDeployer;