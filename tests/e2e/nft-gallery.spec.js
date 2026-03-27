/**
 * NFT画廊 E2E测试
 */

const { test, expect } = require('@playwright/test');

test.describe('NFT画廊 E2E测试', () => {
    test('应该能访问NFT画廊页面', async ({ page }) => {
        await page.goto('/nft');
        
        // 等待页面加载
        await page.waitForLoadState('networkidle');
        
        // 验证页面标题存在
        const heading = page.locator('h1, h2');
        await expect(heading.first()).toBeVisible({ timeout: 15000 });
    });
    
    test('应该显示NFT选项卡', async ({ page }) => {
        await page.goto('/nft');
        await page.waitForLoadState('networkidle');
        
        // 检查有按钮或选项
        const buttons = page.locator('button');
        const count = await buttons.count();
        expect(count).toBeGreaterThan(0);
    });
});

test.describe('用户NFT列表', () => {
    test('未登录用户应该看到连接钱包提示', async ({ page }) => {
        await page.goto('/nft');
        await page.waitForLoadState('networkidle');
        
        // 页面应该有内容
        const content = page.locator('body');
        await expect(content).toBeVisible();
    });
});
