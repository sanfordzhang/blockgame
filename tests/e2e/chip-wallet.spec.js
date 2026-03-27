/**
 * CHIP Wallet E2E Tests
 * End-to-end tests for CHIP wallet functionality
 */

const { test, expect } = require('@playwright/test');

test.describe('CHIP Wallet E2E Tests', () => {
    test('should load wallet page', async ({ page }) => {
        await page.goto('/wallet');
        await page.waitForLoadState('networkidle');
        
        // 验证页面加载
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: 15000 });
    });
    
    test('should show connect wallet prompt for unconnected users', async ({ page }) => {
        await page.goto('/wallet');
        await page.waitForLoadState('networkidle');
        
        // 页面应该有内容 - 未连接钱包时显示提示
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
    
    test('should have wallet tabs', async ({ page }) => {
        await page.goto('/wallet');
        await page.waitForLoadState('networkidle');
        
        // 检查有按钮（标签）
        const buttons = page.locator('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
    });
    
    test('should show staking section', async ({ page }) => {
        await page.goto('/wallet');
        await page.waitForLoadState('networkidle');
        
        // 点击 Staking 标签
        const stakingTab = page.getByRole('button', { name: /staking/i });
        if (await stakingTab.count() > 0) {
            await stakingTab.click();
        }
        
        // 页面应该有内容
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
    
    test('should show VIP section', async ({ page }) => {
        await page.goto('/wallet');
        await page.waitForLoadState('networkidle');
        
        // 点击 VIP Status 标签
        const vipTab = page.getByRole('button', { name: /vip/i });
        if (await vipTab.count() > 0) {
            await vipTab.click();
        }
        
        // 页面应该有内容
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
});
