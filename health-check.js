// Comprehensive health check script for monitoring application health

import http from 'http';
import https from 'https';
import { createClient } from '@supabase/supabase-js';

// Configuration
const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  supabaseUrl: process.env.VITE_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  timeout: 10000, // 10 seconds
  retries: 3
}

// Health check results
let healthStatus = {
  status: 'unknown',
  timestamp: new Date().toISOString(),
  checks: {},
  uptime: process.uptime(),
  version: process.env.npm_package_version || '1.0.0'
}

// Health check functions
async function checkWebServer() {
  return new Promise((resolve) => {
    const protocol = config.port === 443 ? https : http
    const req = protocol.request({
      hostname: config.host,
      port: config.port,
      path: '/',
      method: 'GET',
      timeout: config.timeout
    }, (res) => {
      resolve({
        status: res.statusCode === 200 ? 'healthy' : 'unhealthy',
        details: {
          statusCode: res.statusCode,
          responseTime: Date.now() - startTime
        }
      })
    })
    
    const startTime = Date.now()
    
    req.on('error', (error) => {
      resolve({
        status: 'unhealthy',
        details: { error: error.message }
      })
    })
    
    req.on('timeout', () => {
      resolve({
        status: 'unhealthy',
        details: { error: 'Request timeout' }
      })
    })
    
    req.end()
  })
}

async function checkDatabase() {
  try {
    if (!config.supabaseUrl || !config.supabaseKey) {
      return {
        status: 'unhealthy',
        details: { error: 'Missing Supabase configuration' }
      }
    }
    
    const supabase = createClient(config.supabaseUrl, config.supabaseKey)
    const startTime = Date.now()
    
    // Simple query to check database connectivity
    const { data, error } = await supabase
      .from('users')
      .select('id')
      .limit(1)
    
    const responseTime = Date.now() - startTime
    
    if (error) {
      return {
        status: 'unhealthy',
        details: { 
          error: error.message,
          responseTime 
        }
      }
    }
    
    return {
      status: 'healthy',
      details: { 
        responseTime,
        connected: true 
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }
}

async function checkExternalServices() {
  const checks = {}
  
  // Check Google Document AI (indirectly by checking Google's status)
  try {
    const response = await fetch('https://cloud.google.com/status', { 
      timeout: config.timeout 
    })
    checks.googleCloud = {
      status: response.ok ? 'healthy' : 'unhealthy',
      details: { statusCode: response.status }
    }
  } catch (error) {
    checks.googleCloud = {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }
  
  // Check Stripe API
  try {
    const response = await fetch('https://status.stripe.com/api/v2/status.json', { 
      timeout: config.timeout 
    })
    const data = await response.json()
    checks.stripe = {
      status: data.status?.indicator === 'none' ? 'healthy' : 'degraded',
      details: { 
        indicator: data.status?.indicator,
        description: data.status?.description 
      }
    }
  } catch (error) {
    checks.stripe = {
      status: 'unhealthy',
      details: { error: error.message }
    }
  }
  
  return checks
}

async function checkMemoryUsage() {
  const usage = process.memoryUsage()
  const totalMem = require('os').totalmem()
  const freeMem = require('os').freemem()
  
  const memoryUsagePercent = ((usage.heapUsed / usage.heapTotal) * 100).toFixed(2)
  const systemMemoryUsagePercent = (((totalMem - freeMem) / totalMem) * 100).toFixed(2)
  
  return {
    status: memoryUsagePercent < 90 ? 'healthy' : 'unhealthy',
    details: {
      heapUsed: `${Math.round(usage.heapUsed / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(usage.heapTotal / 1024 / 1024)}MB`,
      memoryUsagePercent: `${memoryUsagePercent}%`,
      systemMemoryUsagePercent: `${systemMemoryUsagePercent}%`,
      external: `${Math.round(usage.external / 1024 / 1024)}MB`
    }
  }
}

async function checkDiskSpace() {
  try {
    const { execSync } = require('child_process')
    const output = execSync('df -h /').toString()
    const lines = output.split('\n')
    const diskInfo = lines[1].split(/\s+/)
    
    const usagePercent = parseInt(diskInfo[4].replace('%', ''))
    
    return {
      status: usagePercent < 80 ? 'healthy' : 'unhealthy',
      details: {
        filesystem: diskInfo[0],
        size: diskInfo[1],
        used: diskInfo[2],
        available: diskInfo[3],
        usagePercent: `${usagePercent}%`
      }
    }
  } catch (error) {
    return {
      status: 'unknown',
      details: { error: 'Unable to check disk space' }
    }
  }
}

async function checkCPUUsage() {
  const startUsage = process.cpuUsage()
  
  // Wait 100ms to measure CPU usage
  await new Promise(resolve => setTimeout(resolve, 100))
  
  const endUsage = process.cpuUsage(startUsage)
  const totalUsage = (endUsage.user + endUsage.system) / 1000 // Convert to milliseconds
  const cpuPercent = (totalUsage / 100).toFixed(2)
  
  return {
    status: cpuPercent < 80 ? 'healthy' : 'unhealthy',
    details: {
      cpuPercent: `${cpuPercent}%`,
      userTime: `${(endUsage.user / 1000).toFixed(2)}ms`,
      systemTime: `${(endUsage.system / 1000).toFixed(2)}ms`
    }
  }
}

async function runHealthChecks() {
  console.log('Running health checks...')
  const startTime = Date.now()
  
  try {
    // Run all health checks in parallel
    const [
      webServerCheck,
      databaseCheck,
      externalServicesCheck,
      memoryCheck,
      diskCheck,
      cpuCheck
    ] = await Promise.all([
      checkWebServer(),
      checkDatabase(),
      checkExternalServices(),
      checkMemoryUsage(),
      checkDiskSpace(),
      checkCPUUsage()
    ])
    
    healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: config.version,
      duration: `${Date.now() - startTime}ms`,
      checks: {
        webServer: webServerCheck,
        database: databaseCheck,
        memory: memoryCheck,
        disk: diskCheck,
        cpu: cpuCheck,
        externalServices: externalServicesCheck
      }
    }
    
    // Determine overall health status
    const allChecks = [
      webServerCheck,
      databaseCheck,
      memoryCheck,
      diskCheck,
      cpuCheck,
      ...Object.values(externalServicesCheck)
    ]
    
    const hasUnhealthy = allChecks.some(check => check.status === 'unhealthy')
    const hasDegraded = allChecks.some(check => check.status === 'degraded')
    
    if (hasUnhealthy) {
      healthStatus.status = 'unhealthy'
    } else if (hasDegraded) {
      healthStatus.status = 'degraded'
    } else {
      healthStatus.status = 'healthy'
    }
    
    // Log results
    console.log(`Health check completed in ${healthStatus.duration}`)
    console.log(`Overall status: ${healthStatus.status}`)
    
    if (healthStatus.status !== 'healthy') {
      console.error('Health check details:', JSON.stringify(healthStatus, null, 2))
    }
    
    return healthStatus
    
  } catch (error) {
    console.error('Health check failed:', error)
    healthStatus = {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: config.version,
      error: error.message,
      duration: `${Date.now() - startTime}ms`,
      checks: {}
    }
    return healthStatus
  }
}

// Main execution
async function main() {
  const result = await runHealthChecks()
  
  // Exit with appropriate code
  if (result.status === 'healthy') {
    process.exit(0)
  } else {
    process.exit(1)
  }
}

// Handle different execution contexts
if (import.meta.url === `file://${process.argv[1]}`) {
  // Run as script
  main()
}

// Export for use as module
export {
  runHealthChecks,
  checkWebServer,
  checkDatabase,
  checkExternalServices,
  checkMemoryUsage,
  checkDiskSpace,
  checkCPUUsage
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception in health check:', error)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection in health check:', reason)
  process.exit(1)
})