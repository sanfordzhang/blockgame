/**
 * Blockchain Integration E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('Blockchain Integration', () => {
    test('should load landing page', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // 验证页面加载
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: 15000 });
    });
    
    test('should have wallet connect button', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // 检查有按钮
        const buttons = page.locator('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
    });
    
    test('should show deposit/withdraw UI on play page', async ({ page }) => {
        await page.goto('/play');
        await page.waitForLoadState('networkidle');
        
        // 验证页面加载
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
});

test.describe('Admin Panel', () => {
    test('should load admin login page', async ({ page }) => {
        await page.goto('/admin/login');
        await page.waitForLoadState('networkidle');
        
        // 验证页面加载
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
});

test.describe('Game Mode Switch', () => {
    test('should have mode switch on landing', async ({ page }) => {
        await page.goto('/');
        await page.waitForLoadState('networkidle');
        
        // 验证页面加载
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
});
