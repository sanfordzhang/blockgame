/**
 * E2E Tests for Blockchain Integration
 * Run with: npx playwright test
 */

// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('Blockchain Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });
  
  test('should show connect wallet button on landing', async ({ page }) => {
    const connectButton = page.locator('text=Connect TronLink');
    await expect(connectButton).toBeVisible();
  });
  
  test('should show mode switch', async ({ page }) => {
    await page.goto('/play');
    
    // Check for mode indicator
    const modeIndicator = page.locator('.mode-indicator');
    await expect(modeIndicator).toBeVisible();
  });
  
  test('should navigate to admin login', async ({ page }) => {
    await page.goto('/admin/login');
    
    const loginCard = page.locator('.admin-login-card');
    await expect(loginCard).toBeVisible();
    
    const connectButton = page.locator('text=Connect TronLink');
    await expect(connectButton).toBeVisible();
  });
  
  test('should show deposit/withdraw UI on play page', async ({ page }) => {
    await page.goto('/play');
    
    // Look for wallet section
    const walletSection = page.locator('.wallet-section');
    await expect(walletSection).toBeVisible();
  });
});

test.describe('Admin Panel', () => {
  test('should require admin authentication', async ({ page }) => {
    await page.goto('/admin/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/\/admin\/login/);
  });
  
  test('should show admin navigation', async ({ page }) => {
    // Mock admin authentication
    await page.addInitScript(() => {
      window.localStorage.setItem('isAdmin', 'true');
      window.localStorage.setItem('adminAddress', 'TRX_ADMIN_ADDRESS');
    });
    
    await page.goto('/admin/dashboard');
    
    // Check navigation links
    await expect(page.locator('text=Dashboard')).toBeVisible();
    await expect(page.locator('text=Rake Rate')).toBeVisible();
    await expect(page.locator('text=Emergency')).toBeVisible();
  });
});

test.describe('Game Mode Switch', () => {
  test('should toggle between fun and real mode', async ({ page }) => {
    await page.goto('/play');
    
    const modeSwitch = page.locator('.mode-switch');
    await expect(modeSwitch).toBeVisible();
    
    // Toggle to real mode
    await modeSwitch.click();
    
    // Check for warning
    const warning = page.locator('.mode-warning');
    await expect(warning).toBeVisible();
  });
  
  test('should show faucet info in fun mode', async ({ page }) => {
    await page.goto('/play');
    
    // Should show faucet info
    const faucetInfo = page.locator('.faucet-info');
    await expect(faucetInfo).toBeVisible();
  });
});
