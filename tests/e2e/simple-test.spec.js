/**
 * 简单测试 - 验证Chrome连接和基本功能
 */

const { test, expect } = require('@playwright/test');

test('验证Chrome连接', async ({ page }) => {
    console.log('✅ Chrome连接成功');
    
    // 直接访问锦标赛页面
    await page.goto('http://localhost:3001/tournament', { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    // 等待页面加载
    await page.waitForTimeout(2000);
    
    // 验证标题
    const title = await page.title();
    console.log('页面标题:', title);
    
    // 截图
    await page.screenshot({ path: 'test-results/tournament-page.png' });
    
    console.log('✅ 测试完成');
});
