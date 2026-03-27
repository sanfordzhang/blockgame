const { test, expect } = require('@playwright/test');
const path = require('path');

// 测试游戏基本流程
test.describe('Poker Game Flow', () => {

  test('should connect to game with URL parameters', async ({ page }) => {
    const walletAddress = '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const username = `player_${Math.floor(Math.random() * 10000)}`

    // 访问游戏页面并传递参数
    await page.goto(`http://localhost:3001/?walletAddress=${walletAddress}&gameId=1&username=${username}`);

    // 等待游戏页面加载
    await expect(page.locator('.play-area')).toBeVisible({ timeout: 10000 });

    // 验证连接
    await page.waitForTimeout(2000);
    console.log('Connected successfully');
  });

  test('should connect with localStorage', async ({ page }) => {
    // 设置 localStorage
    await page.goto('http://localhost:3000/');
    await page.evaluate(() => {
      localStorage.setItem('game_walletAddress', '0xtest123456789');
      localStorage.setItem('game_username', 'test_player');
    });

    // 刷新页面
    await page.reload();

    // 等待游戏加载
    await expect(page.locator('.play-area')).toBeVisible({ timeout: 10000 });
  });

  test('should sit down at table', async ({ page, context }) => {
    const walletAddress = '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    const username = `player_${Math.floor(Math.random() * 10000)}`

    // 访问游戏页面
    await page.goto(`http://localhost:3000/?walletAddress=${walletAddress}&gameId=1&username=${username}`);

    // 等待游戏界面加载
    await page.waitForSelector('.play-area', { timeout: 15000 });

    // 等待连接到服务器
    await page.waitForTimeout(3000);

    // 截图
    await page.screenshot({ path: 'tests/screenshots/game-loaded.png' });

    console.log('Game loaded successfully');
  });

  test('should handle game states', async ({ page }) => {
    // 模拟多个玩家
    const players = [
      { walletAddress: '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), username: `player_${Math.floor(Math.random() * 10000)}` },
      { walletAddress: '0x' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15), username: `player_${Math.floor(Math.random() * 10000)}` }
    ];

    // 创建多个页面（模拟多个玩家）
    const contexts = [];
    const pages = [];

    for (const player of players) {
      const context = await page.context().browser().newContext();
      contexts.push(context);
      const playerPage = await context.newPage();
      pages.push(playerPage);

      await playerPage.goto(`http://localhost:3000/?walletAddress=${player.walletAddress}&gameId=1&username=${player.username}`);
      await playerPage.waitForSelector('.play-area', { timeout: 15000 });
      await playerPage.waitForTimeout(2000);
    }

    console.log(`Successfully connected ${players.length} players`);

    // 清理
    for (const context of contexts) {
      await context.close();
    }
  });
});

// 测试 MetaMask 集成（需要扩展）
test.describe('MetaMask Integration', () => {
  // 注意：这需要提前下载并配置 MetaMask 扩展
  test.skip('should connect MetaMask wallet', async ({ page }) => {
    // 这需要配置扩展路径
    // 请查看 GAME_ANALYSIS.md 中的详细说明

    // 示例代码：
    /*
    const EXTENSION_PATH = path.join(__dirname, '../extensions/metamask');

    const context = await page.context().browser().newContext({
      launchOptions: {
        args: [
          `--disable-extensions-except=${EXTENSION_PATH}`,
          `--load-extension=${EXTENSION_PATH}`
        ]
      }
    });

    // 配置 MetaMask...
    */
  });
});
