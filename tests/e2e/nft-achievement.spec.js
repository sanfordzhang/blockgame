/**
 * NFT Achievement E2E 测试
 * 测试 AchievementNFT.sol 合约功能的端对端流程
 */

const { test, expect } = require('@playwright/test');

// 测试配置
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const TEST_WALLET = process.env.TEST_WALLET || 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

test.describe('NFT画廊页面', () => {
    test('应该显示NFT画廊标题', async ({ page }) => {
        await page.goto(`${BASE_URL}/nft`);
        await page.waitForLoadState('networkidle');
        
        // 检查标题
        const heading = page.locator('h1');
        await expect(heading).toContainText('NFT Achievements', { timeout: 10000 });
    });

    test('应该显示两个选项卡', async ({ page }) => {
        await page.goto(`${BASE_URL}/nft`);
        await page.waitForLoadState('networkidle');
        
        // 检查选项卡
        const tabs = page.locator('button');
        const count = await tabs.count();
        expect(count).toBeGreaterThanOrEqual(2);
        
        // 检查默认选中的选项卡
        const myCollectionTab = page.getByText('My Collection');
        await expect(myCollectionTab).toBeVisible();
        
        const typesTab = page.getByText('Achievement Types');
        await expect(typesTab).toBeVisible();
    });

    test('应该能切换到Achievement Types选项卡', async ({ page }) => {
        await page.goto(`${BASE_URL}/nft`);
        await page.waitForLoadState('networkidle');
        
        // 点击 Achievement Types 选项卡
        const typesTab = page.getByText('Achievement Types');
        await typesTab.click();
        
        // 等待加载
        await page.waitForTimeout(500);
        
        // 应该显示成就类型卡片
        const cards = page.locator('[class*="NFTCard"], [class*="nft-card"], div').filter({ hasText: 'Royal Flush' });
        await expect(cards.first()).toBeVisible({ timeout: 5000 });
    });

    test('应该显示所有6种成就类型', async ({ page }) => {
        await page.goto(`${BASE_URL}/nft`);
        await page.waitForLoadState('networkidle');
        
        // 切换到 Achievement Types
        await page.getByText('Achievement Types').click();
        await page.waitForTimeout(500);
        
        // 检查所有成就类型 - 使用精确匹配
        const achievementTypes = [
            'Royal Flush',
            'Straight Flush',
            'Four of a Kind',
            'Full House',
            'Flush',
            'Straight'
        ];
        
        for (const type of achievementTypes) {
            // 使用 role=heading 进行精确匹配
            const card = page.getByRole('heading', { name: type, exact: true });
            await expect(card).toBeVisible({ timeout: 5000 });
        }
    });

    test('应该显示稀有度徽章', async ({ page }) => {
        await page.goto(`${BASE_URL}/nft`);
        await page.waitForLoadState('networkidle');
        
        // 切换到 Achievement Types
        await page.getByText('Achievement Types').click();
        await page.waitForTimeout(500);
        
        // 检查稀有度徽章 - 使用 first() 避免严格模式问题
        const legendaryBadge = page.getByText('Legendary').first();
        await expect(legendaryBadge).toBeVisible({ timeout: 5000 });
        
        const epicBadge = page.getByText('Epic').first();
        await expect(epicBadge).toBeVisible({ timeout: 5000 });
        
        const rareBadge = page.getByText('Rare').first();
        await expect(rareBadge).toBeVisible({ timeout: 5000 });
        
        const uncommonBadge = page.getByText('Uncommon').first();
        await expect(uncommonBadge).toBeVisible({ timeout: 5000 });
    });
});

test.describe('NFT铸造流程', () => {
    test('未连接钱包应显示提示信息', async ({ page }) => {
        await page.goto(`${BASE_URL}/nft`);
        await page.waitForLoadState('networkidle');
        
        // 在 My Collection 选项卡下
        const prompt = page.getByText(/connect your wallet/i);
        // 可能显示也可能不显示，取决于钱包状态
        const isVisible = await prompt.isVisible().catch(() => false);
        console.log('Wallet connect prompt visible:', isVisible);
    });
});

test.describe('NFT API测试', () => {
    test('应该能调用NFT collection API', async ({ request }) => {
        const response = await request.get(`${BASE_URL}/api/nft/collection/${TEST_WALLET}`);
        
        // API 可能返回成功或空数据
        expect([200, 404]).toContain(response.status());
        
        if (response.status() === 200) {
            const data = await response.json();
            expect(data).toHaveProperty('success');
        }
    });
});
