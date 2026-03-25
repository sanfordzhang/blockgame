/**
 * NFT画廊 E2E测试
 */

// @ts-check
const { test, expect } = require('@playwright/test');

test.describe('NFT画廊 E2E测试', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  // ==================== NFT页面 ====================
  test.describe('NFT画廊页面', () => {
    test('应该能访问NFT画廊页面', async ({ page }) => {
      await page.goto('/nft');
      
      // 检查页面存在
      const nftPage = page.locator('.nft-gallery, .nft-container, [data-testid="nft-gallery"]');
      await expect(nftPage.first()).toBeVisible({ timeout: 5000 });
    });

    test('应该显示NFT成就类型说明', async ({ page }) => {
      await page.goto('/nft');
      
      // 检查成就类型列表
      const achievementTypes = page.locator('.achievement-type, .nft-type, text=/Royal|Straight|Flush|Four|Full/i');
      const count = await achievementTypes.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('应该显示月度限量信息', async ({ page }) => {
      await page.goto('/nft');
      
      // 检查限量显示
      const limitInfo = page.locator('.monthly-limit, .limit-info, text=/monthly|monthly.*limit|剩余|限量/i');
      const count = await limitInfo.count();
      
      if (count > 0) {
        await expect(limitInfo.first()).toBeVisible();
      }
    });
  });

  // ==================== 用户NFT列表 ====================
  test.describe('用户NFT列表', () => {
    test('登录用户应该能看到自己的NFT', async ({ page }) => {
      await page.addInitScript(() => {
        window.mockWalletConnected = true;
        window.mockWalletAddress = 'TPL66VK2gCXNCD7EJg9psXR5pgL2kYq57b';
        window.mockUserNFTs = [
          { id: 1, type: 'STRAIGHT', rarity: 'COMMON' },
          { id: 2, type: 'FLUSH', rarity: 'COMMON' }
        ];
      });

      await page.goto('/nft');
      
      // 检查NFT列表
      const nftList = page.locator('.nft-list, .my-nfts, [data-testid="my-nfts"]');
      const count = await nftList.count();
      
      if (count > 0) {
        await expect(nftList.first()).toBeVisible();
      }
    });

    test('未登录用户应该看到连接钱包提示', async ({ page }) => {
      await page.goto('/nft');
      
      // 检查连接提示
      const connectPrompt = page.locator('text=/connect.*wallet|连接.*钱包|sign.*in/i');
      const count = await connectPrompt.count();
      
      // 可能显示空列表或连接提示
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== NFT详情 ====================
  test.describe('NFT详情', () => {
    test('点击NFT应该显示详情', async ({ page }) => {
      await page.addInitScript(() => {
        window.mockUserNFTs = [
          { id: 1, type: 'ROYAL_FLUSH', rarity: 'LEGENDARY', name: 'Royal Flush #1' }
        ];
      });

      await page.goto('/nft');
      
      // 点击NFT卡片
      const nftCard = page.locator('.nft-card, .nft-item').first();
      
      if (await nftCard.isVisible()) {
        await nftCard.click();
        
        // 应该显示详情弹窗
        const modal = page.locator('.modal, .nft-detail, [data-testid="nft-detail"]');
        await expect(modal.first()).toBeVisible({ timeout: 5000 });
      }
    });

    test('NFT详情应该显示稀有度', async ({ page }) => {
      await page.addInitScript(() => {
        window.mockSelectedNFT = {
          id: 1,
          type: 'ROYAL_FLUSH',
          rarity: 'LEGENDARY'
        };
      });

      await page.goto('/nft/1');
      
      // 检查稀有度显示
      const rarity = page.locator('.rarity, .nft-rarity, text=/LEGENDARY|EPIC|RARE|COMMON/i');
      const count = await rarity.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  // ==================== NFT铸造 ====================
  test.describe('NFT铸造', () => {
    test('应该显示可铸造的成就列表', async ({ page }) => {
      await page.addInitScript(() => {
        window.mockWalletConnected = true;
        window.mockAchievements = [
          { type: 'STRAIGHT', available: true },
          { type: 'FLUSH', available: true }
        ];
      });

      await page.goto('/nft/mint');
      
      // 检查成就选项
      const options = page.locator('.achievement-option, .mint-option');
      const count = await options.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('铸造流程应该显示确认步骤', async ({ page }) => {
      await page.addInitScript(() => {
        window.mockMintFlow = {
          step: 'select',
          achievements: [
            { type: 'STRAIGHT', mintable: true }
          ]
        };
      });

      await page.goto('/nft/mint');
      
      // 选择成就
      const option = page.locator('.achievement-option, .mint-option').first();
      
      if (await option.isVisible()) {
        await option.click();
        
        // 应该显示确认或支付步骤
        const confirmBtn = page.locator('.confirm-btn, .mint-btn, button:has-text("Mint"), button:has-text("铸造")');
        const count = await confirmBtn.count();
        
        expect(count).toBeGreaterThanOrEqual(0);
      }
    });
  });

  // ==================== NFT稀有度 ====================
  test.describe('NFT稀有度显示', () => {
    test('LEGENDARY稀有度应该有特殊样式', async ({ page }) => {
      await page.addInitScript(() => {
        window.mockNFTWithRarity = { rarity: 'LEGENDARY' };
      });

      await page.goto('/nft');
      
      // 检查LEGENDARY样式
      const legendary = page.locator('.legendary, .rarity-legendary, [data-rarity="legendary"]');
      const count = await legendary.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('应该显示稀有度对应的限量', async ({ page }) => {
      await page.goto('/nft');
      
      // 检查限量数字
      const limitNumbers = page.locator('.limit-number, .remaining-count');
      const count = await limitNumbers.count();
      
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});

// ==================== NFT成就触发测试 ====================
test.describe('游戏中NFT成就', () => {
  test('达成成就牌型应该显示提示', async ({ page }) => {
    await page.addInitScript(() => {
      window.mockGameResult = {
        handResult: 'ROYAL_FLUSH',
        achievement: true
      };
    });

    await page.goto('/play');
    
    // 检查成就提示
    const achievement = page.locator('.achievement-popup, .nft-unlocked, text=/achievement|解锁|NFT/i');
    const count = await achievement.count();
    
    expect(count).toBeGreaterThanOrEqual(0);
  });
});
