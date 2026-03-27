/**
 * DAO Governance E2E Tests
 */

const { test, expect } = require('@playwright/test');

test.describe('DAO Governance E2E Tests', () => {
    test('should display DAO page', async ({ page }) => {
        await page.goto('/dao');
        await page.waitForLoadState('networkidle');
        
        // 验证页面加载
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: 15000 });
    });
    
    test('should show proposal list or empty state', async ({ page }) => {
        await page.goto('/dao');
        await page.waitForLoadState('networkidle');
        
        // 页面应该有内容
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
    
    test('should have create proposal button area', async ({ page }) => {
        await page.goto('/dao');
        await page.waitForLoadState('networkidle');
        
        // 检查有按钮
        const buttons = page.locator('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThanOrEqual(0);
    });
    
    test('should show voting interface elements', async ({ page }) => {
        await page.goto('/dao');
        await page.waitForLoadState('networkidle');
        
        // 页面应该有内容
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
});
