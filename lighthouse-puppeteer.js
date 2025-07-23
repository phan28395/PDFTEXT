// Puppeteer script for Lighthouse CI to handle authentication and dynamic content

module.exports = async (browser, context) => {
  const { url } = context;
  const page = await browser.newPage();

  // Set viewport for consistent testing
  await page.setViewport({ width: 1280, height: 720 });
  
  // Handle different pages with specific setup
  if (url.includes('/dashboard')) {
    // Login before testing dashboard
    await page.goto(`${context.baseUrl}/login`);
    
    // Fill login form
    await page.waitForSelector('[data-testid="email-input"]');
    await page.type('[data-testid="email-input"]', 'test@example.com');
    await page.type('[data-testid="password-input"]', 'TestPassword123!');
    
    // Submit login form
    await Promise.all([
      page.click('[data-testid="login-button"]'),
      page.waitForNavigation()
    ]);
    
    // Wait for dashboard to load
    await page.waitForSelector('[data-testid="user-welcome"]', { timeout: 10000 });
    
    // Navigate to the actual dashboard URL
    await page.goto(url);
    await page.waitForSelector('[data-testid="usage-stats"]', { timeout: 10000 });
    
  } else if (url.includes('/pricing')) {
    // Ensure pricing page is fully loaded
    await page.goto(url);
    await page.waitForSelector('[data-testid="pricing-plans"]', { timeout: 10000 });
    
  } else if (url.includes('/login') || url.includes('/register')) {
    // Wait for form elements to load
    await page.goto(url);
    await page.waitForSelector('form', { timeout: 10000 });
    
  } else {
    // Default home page
    await page.goto(url);
    await page.waitForSelector('main', { timeout: 10000 });
  }
  
  // Wait for any lazy-loaded content
  await page.waitForTimeout(2000);
  
  // Scroll to bottom to trigger any lazy loading
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  
  // Wait a bit more for content to load
  await page.waitForTimeout(1000);
  
  // Scroll back to top for consistent testing
  await page.evaluate(() => {
    window.scrollTo(0, 0);
  });
  
  // Remove any loading overlays or modals that might interfere with testing
  await page.evaluate(() => {
    // Remove loading spinners
    const loadingElements = document.querySelectorAll('[data-testid*="loading"], .loading, .spinner');
    loadingElements.forEach(el => el.remove());
    
    // Remove modals or overlays
    const modals = document.querySelectorAll('[data-testid*="modal"], .modal, .overlay');
    modals.forEach(el => el.remove());
    
    // Remove any toast notifications
    const toasts = document.querySelectorAll('[data-testid*="toast"], .toast');
    toasts.forEach(el => el.remove());
  });
  
  // Ensure page is ready for Lighthouse audit
  await page.waitForTimeout(1000);
  
  await page.close();
}