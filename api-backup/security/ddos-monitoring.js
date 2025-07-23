const { withSecurityHeaders, SecurityConfigs } = require('../../src/lib/securityHeaders.js');
const { withRateLimit, RateLimitConfigs } = require('../../src/lib/rateLimit.js');

/**
 * DDoS Monitoring and Management API
 * Provides real-time statistics and management capabilities for DDoS protection
 */

// In-memory storage for demo - in production, use Redis or database
const ddosStats = {
  totalRequestsBlocked: 0,
  activeThreats: 0,
  topAttackingIPs: [],
  threatTypes: {},
  lastUpdate: new Date().toISOString()
};

async function ddosMonitoringHandler(req, res) {
  // Only allow GET requests for monitoring, POST for management
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify admin authentication (simplified for demo)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Unauthorized',
        message: 'Admin authentication required'
      });
    }

    if (req.method === 'GET') {
      return await handleGetMonitoring(req, res);
    } else if (req.method === 'POST') {
      return await handleManageThreats(req, res);
    }
  } catch (error) {
    console.error('DDoS monitoring error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process DDoS monitoring request'
    });
  }
}

async function handleGetMonitoring(req, res) {
  const { action, timeframe = '1h' } = req.query;

  switch (action) {
    case 'stats':
      return getOverallStats(req, res, timeframe);
    case 'threats':
      return getActiveThreats(req, res);
    case 'blocked-ips':
      return getBlockedIPs(req, res);
    case 'traffic-analysis':
      return getTrafficAnalysis(req, res, timeframe);
    default:
      return getDashboardData(req, res);
  }
}

async function handleManageThreats(req, res) {
  const { action, ip, duration } = req.body;

  if (!action || !ip) {
    return res.status(400).json({
      error: 'Bad request',
      message: 'Action and IP address are required'
    });
  }

  switch (action) {
    case 'block':
      return blockIP(req, res, ip, duration);
    case 'unblock':
      return unblockIP(req, res, ip);
    case 'whitelist':
      return addToWhitelist(req, res, ip);
    case 'remove-whitelist':
      return removeFromWhitelist(req, res, ip);
    default:
      return res.status(400).json({
        error: 'Invalid action',
        message: 'Supported actions: block, unblock, whitelist, remove-whitelist'
      });
  }
}

async function getOverallStats(req, res, timeframe) {
  // Simulate real-time DDoS statistics
  const stats = {
    overview: {
      totalRequests: Math.floor(Math.random() * 10000) + 50000,
      blockedRequests: Math.floor(Math.random() * 500) + 100,
      activeThreats: Math.floor(Math.random() * 10) + 2,
      blockedIPs: Math.floor(Math.random() * 50) + 25,
      avgRiskScore: Math.floor(Math.random() * 30) + 15,
      uptime: '99.98%'
    },
    protection: {
      ddosProtectionEnabled: true,
      rateLimitingEnabled: true,
      geoBlockingEnabled: true,
      botDetectionEnabled: true,
      adaptiveThresholdsEnabled: true
    },
    performance: {
      avgResponseTime: Math.floor(Math.random() * 100) + 50,
      cpuUsage: Math.floor(Math.random() * 30) + 20,
      memoryUsage: Math.floor(Math.random() * 40) + 30,
      networkThroughput: Math.floor(Math.random() * 1000) + 500
    },
    timeframe,
    lastUpdate: new Date().toISOString()
  };

  return res.status(200).json({
    success: true,
    data: stats
  });
}

async function getActiveThreats(req, res) {
  // Simulate active threat detection
  const threats = [
    {
      id: 'threat_001',
      type: 'volumetric_attack',
      sourceIP: '192.168.1.100',
      country: 'Unknown',
      riskScore: 95,
      requestsPerMinute: 500,
      startTime: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      status: 'active',
      mitigation: 'ip_block'
    },
    {
      id: 'threat_002',
      type: 'application_attack',
      sourceIP: '10.0.0.50',
      country: 'CN',
      riskScore: 87,
      requestsPerMinute: 200,
      startTime: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      status: 'mitigated',
      mitigation: 'rate_limit'
    },
    {
      id: 'threat_003',
      type: 'botnet_attack',
      sourceIP: '172.16.0.25',
      country: 'RU',
      riskScore: 78,
      requestsPerMinute: 150,
      startTime: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      status: 'monitoring',
      mitigation: 'challenge'
    }
  ];

  return res.status(200).json({
    success: true,
    data: {
      threats,
      total: threats.length,
      active: threats.filter(t => t.status === 'active').length,
      mitigated: threats.filter(t => t.status === 'mitigated').length
    }
  });
}

async function getBlockedIPs(req, res) {
  // Simulate blocked IP list
  const blockedIPs = [
    {
      ip: '192.168.1.100',
      reason: 'High-risk volumetric attack',
      blockedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      riskScore: 95,
      requestCount: 500,
      country: 'Unknown'
    },
    {
      ip: '10.0.0.50',
      reason: 'Application layer attack patterns',
      blockedAt: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      riskScore: 87,
      requestCount: 200,
      country: 'CN'
    },
    {
      ip: '172.16.0.25',
      reason: 'Suspected botnet activity',
      blockedAt: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      expiresAt: new Date(Date.now() + 7 * 60 * 1000).toISOString(),
      riskScore: 78,
      requestCount: 150,
      country: 'RU'
    }
  ];

  return res.status(200).json({
    success: true,
    data: {
      blockedIPs,
      total: blockedIPs.length,
      expiringSoon: blockedIPs.filter(ip => 
        new Date(ip.expiresAt).getTime() - Date.now() < 5 * 60 * 1000
      ).length
    }
  });
}

async function getTrafficAnalysis(req, res, timeframe) {
  // Simulate traffic analysis data
  const analysis = {
    requestsByCountry: [
      { country: 'US', requests: 15000, blocked: 50 },
      { country: 'CN', requests: 5000, blocked: 800 },
      { country: 'RU', requests: 3000, blocked: 600 },
      { country: 'GB', requests: 8000, blocked: 20 },
      { country: 'DE', requests: 6000, blocked: 15 }
    ],
    requestsByHour: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      requests: Math.floor(Math.random() * 1000) + 500,
      blocked: Math.floor(Math.random() * 50) + 10,
      avgRiskScore: Math.floor(Math.random() * 40) + 10
    })),
    topUserAgents: [
      { userAgent: 'Mozilla/5.0 (legitimate)', requests: 10000, riskScore: 5 },
      { userAgent: 'Python-urllib/3.x', requests: 2000, riskScore: 60 },
      { userAgent: 'curl/7.x', requests: 1500, riskScore: 45 },
      { userAgent: 'Unknown/Bot', requests: 800, riskScore: 85 }
    ],
    attackVectors: [
      { type: 'volumetric', count: 150, percentage: 45 },
      { type: 'application_layer', count: 100, percentage: 30 },
      { type: 'protocol', count: 50, percentage: 15 },
      { type: 'botnet', count: 33, percentage: 10 }
    ],
    timeframe,
    generatedAt: new Date().toISOString()
  };

  return res.status(200).json({
    success: true,
    data: analysis
  });
}

async function getDashboardData(req, res) {
  // Comprehensive dashboard data
  const dashboard = {
    alerts: [
      {
        id: 'alert_001',
        severity: 'high',
        type: 'ddos_attack',
        message: 'Volumetric attack detected from 192.168.1.100',
        timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
        acknowledged: false
      },
      {
        id: 'alert_002',
        severity: 'medium',
        type: 'suspicious_traffic',
        message: 'Unusual traffic pattern from subnet 10.0.0.0/24',
        timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
        acknowledged: false
      }
    ],
    quickStats: {
      requestsLastMinute: Math.floor(Math.random() * 1000) + 500,
      blockedLastMinute: Math.floor(Math.random() * 50) + 10,
      activeThreats: 3,
      protectionLevel: 'High'
    },
    systemHealth: {
      ddosEngine: 'operational',
      rateLimiter: 'operational',
      threatDetection: 'operational',
      geoBlocking: 'operational',
      lastHealthCheck: new Date().toISOString()
    }
  };

  return res.status(200).json({
    success: true,
    data: dashboard
  });
}

async function blockIP(req, res, ip, duration = 15 * 60 * 1000) {
  // Validate IP address
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return res.status(400).json({
      error: 'Invalid IP address',
      message: 'Please provide a valid IPv4 address'
    });
  }

  // Log the manual block action
  console.log(`Admin manually blocked IP: ${ip} for ${duration}ms`);

  return res.status(200).json({
    success: true,
    message: `IP ${ip} has been blocked`,
    data: {
      ip,
      duration,
      expiresAt: new Date(Date.now() + duration).toISOString(),
      blockedBy: 'admin',
      timestamp: new Date().toISOString()
    }
  });
}

async function unblockIP(req, res, ip) {
  // Validate IP address
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return res.status(400).json({
      error: 'Invalid IP address',
      message: 'Please provide a valid IPv4 address'
    });
  }

  // Log the manual unblock action
  console.log(`Admin manually unblocked IP: ${ip}`);

  return res.status(200).json({
    success: true,
    message: `IP ${ip} has been unblocked`,
    data: {
      ip,
      unblockedBy: 'admin',
      timestamp: new Date().toISOString()
    }
  });
}

async function addToWhitelist(req, res, ip) {
  // Validate IP address
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return res.status(400).json({
      error: 'Invalid IP address',
      message: 'Please provide a valid IPv4 address'
    });
  }

  // Log the whitelist action
  console.log(`Admin added IP to whitelist: ${ip}`);

  return res.status(200).json({
    success: true,
    message: `IP ${ip} has been added to whitelist`,
    data: {
      ip,
      addedBy: 'admin',
      timestamp: new Date().toISOString()
    }
  });
}

async function removeFromWhitelist(req, res, ip) {
  // Validate IP address
  const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  if (!ipRegex.test(ip)) {
    return res.status(400).json({
      error: 'Invalid IP address',
      message: 'Please provide a valid IPv4 address'
    });
  }

  // Log the whitelist removal action
  console.log(`Admin removed IP from whitelist: ${ip}`);

  return res.status(200).json({
    success: true,
    message: `IP ${ip} has been removed from whitelist`,
    data: {
      ip,
      removedBy: 'admin',
      timestamp: new Date().toISOString()
    }
  });
}

// Apply security headers and rate limiting
const handler = withSecurityHeaders(SecurityConfigs.API)(
  withRateLimit(RateLimitConfigs.GENERAL, 'ddos-monitoring')(ddosMonitoringHandler)
);

module.exports = handler;