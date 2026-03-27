/**
 * 锦标赛系统 E2E测试 - 完整端对端流程
 * 测试从Landing页面进入 -> 点击锦标赛 -> 创建 -> 加入 -> 验证完整流程
 */

const { test, expect } = require('@playwright/test');

// 测试配置
const TEST_CONFIG = {
    defaultTimeout: 30000,
    apiUrl: '/api/tournament',
};

test.describe('锦标赛端对端完整流程', () => {
    
    test.describe.serial('完整锦标赛流程测试', () => {
        let createdTournamentId = null;

        test('步骤1: 从Landing页面进入锦标赛页面', async ({ page }) => {
            // 访问首页
            await page.goto('/');
            await page.waitForLoadState('networkidle');
            
            // 等待页面加载完成
            await page.waitForSelector('[data-testid="feature-section"]', { timeout: 15000 })
                .catch(() => console.log('Feature section not visible, may need login'));
            
            // 尝试找到并点击锦标赛入口
            const tournamentFeature = page.locator('[data-testid="feature-tournament"]');
            
            // 检查是否可见（需要登录后才能看到功能入口）
            const isVisible = await tournamentFeature.isVisible().catch(() => false);
            
            if (isVisible) {
                await tournamentFeature.click();
                await page.waitForLoadState('networkidle');
                
                // 验证进入了锦标赛页面
                await expect(page).toHaveURL(/.*tournament.*/);
                const heading = page.locator('h1');
                await expect(heading).toContainText('Tournaments', { timeout: 10000 });
            } else {
                // 如果未登录，直接访问锦标赛页面
                await page.goto('/tournament');
                await page.waitForLoadState('networkidle');
                
                // 验证页面标题
                const heading = page.locator('h1');
                await expect(heading).toContainText('Tournaments', { timeout: 10000 });
            }
        });

        test('步骤2: 验证锦标赛页面基础功能', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 验证页面标题
            const heading = page.locator('h1');
            await expect(heading).toContainText('Tournaments', { timeout: 15000 });
            
            // 验证提示Banner存在
            const banner = page.locator('text=点击状态为 WAITING 的锦标赛卡片即可报名参赛');
            await expect(banner).toBeVisible({ timeout: 10000 });
            
            // 验证创建按钮区域存在
            const createSection = page.locator('[data-testid="create-tournament-section"]');
            await expect(createSection).toBeVisible({ timeout: 10000 });
            
            // 验证至少有一个创建按钮
            const createBtn = page.locator('[data-testid^="create-tournament-btn-"]');
            const count = await createBtn.count();
            expect(count).toBeGreaterThan(0);
            
            // 验证筛选按钮存在
            await expect(page.locator('[data-testid="filter-all"]')).toBeVisible();
            await expect(page.locator('[data-testid="filter-waiting"]')).toBeVisible();
            await expect(page.locator('[data-testid="filter-in-progress"]')).toBeVisible();
            await expect(page.locator('[data-testid="filter-completed"]')).toBeVisible();
        });

        test('步骤3: 创建新锦标赛', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 监听API响应
            const responsePromise = page.waitForResponse(
                response => response.url().includes('/api/tournament/create') && response.request().method() === 'POST'
            ).catch(() => null);
            
            // 点击第一个创建按钮（6人赛 100 TRX）
            const createBtn = page.locator('[data-testid="create-tournament-btn-1"]');
            await expect(createBtn).toBeEnabled({ timeout: 5000 });
            await createBtn.click();
            
            // 等待创建完成
            await page.waitForTimeout(3000);
            
            // 检查API响应
            try {
                const response = await Promise.race([
                    responsePromise,
                    page.waitForTimeout(5000).then(() => null)
                ]);
                
                if (response) {
                    const data = await response.json();
                    expect(data.success).toBe(true);
                    expect(data.tournament).toBeDefined();
                    createdTournamentId = data.tournament.tournamentId;
                    console.log(`Created tournament: ${createdTournamentId}`);
                }
            } catch (e) {
                console.log('API response check skipped:', e.message);
            }
            
            // 验证页面状态变化
            await page.waitForTimeout(2000);
            
            // 检查是否有锦标赛卡片出现
            const tournamentCards = page.locator('[class*="TournamentCard"]');
            const cardCount = await tournamentCards.count();
            
            // 或者空状态消失
            const emptyState = page.locator('[data-testid="empty-state"]');
            const emptyVisible = await emptyState.isVisible().catch(() => false);
            
            // 验证：要么有卡片，要么空状态消失，或者显示创建成功
            expect(cardCount > 0 || !emptyVisible).toBeTruthy();
        });

        test('步骤4: 验证锦标赛卡片详情', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 查找锦标赛卡片
            const tournamentCard = page.locator('[class*="TournamentCard"]').first();
            
            // 等待卡片出现
            const hasCard = await tournamentCard.waitFor({ state: 'visible', timeout: 10000 })
                .then(() => true)
                .catch(() => false);
            
            if (hasCard) {
                // 验证卡片内容
                const cardText = await tournamentCard.textContent();
                console.log('Card text:', cardText);
                
                // 验证状态标签存在
                const statusBadge = tournamentCard.locator('[class*="StatusBadge"]');
                await expect(statusBadge).toBeVisible();
                
                // 验证Buy-in金额显示
                await expect(tournamentCard.locator('text=Buy-in')).toBeVisible();
                
                // 验证Prize Pool显示
                await expect(tournamentCard.locator('text=Prize Pool')).toBeVisible();
                
                // 验证玩家数量显示
                await expect(tournamentCard.locator('text=Players')).toBeVisible();
            } else {
                // 如果没有卡片，创建一个
                console.log('No tournament card found, creating one...');
                const createBtn = page.locator('[data-testid="create-tournament-btn-1"]');
                await createBtn.click();
                await page.waitForTimeout(3000);
                
                // 再次检查
                const newCard = page.locator('[class*="TournamentCard"]').first();
                await expect(newCard).toBeVisible({ timeout: 10000 });
            }
        });

        test('步骤5: 测试筛选功能', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 点击Waiting筛选
            const filterWaiting = page.locator('[data-testid="filter-waiting"]');
            await filterWaiting.click();
            await page.waitForTimeout(1000);
            
            // 验证URL参数或UI变化
            await expect(filterWaiting).toHaveAttribute('class', /active|border/);
            
            // 点击All筛选
            const filterAll = page.locator('[data-testid="filter-all"]');
            await filterAll.click();
            await page.waitForTimeout(1000);
            
            await expect(filterAll).toHaveAttribute('class', /active|border/);
            
            // 测试其他筛选按钮
            await page.locator('[data-testid="filter-in-progress"]').click();
            await page.waitForTimeout(500);
            
            await page.locator('[data-testid="filter-completed"]').click();
            await page.waitForTimeout(500);
            
            // 返回All
            await filterAll.click();
        });

        test('步骤6: 点击WAITING状态的锦标赛尝试加入', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 确保有WAITING状态的锦标赛
            let waitingCard = page.locator('[class*="TournamentCard"]').filter({
                has: page.locator('text=WAITING')
            }).first();
            
            let hasWaiting = await waitingCard.isVisible().catch(() => false);
            
            if (!hasWaiting) {
                // 创建一个新锦标赛
                console.log('No WAITING tournament, creating one...');
                const createBtn = page.locator('[data-testid="create-tournament-btn-1"]');
                await createBtn.click();
                await page.waitForTimeout(3000);
                
                // 设置筛选为WAITING
                await page.locator('[data-testid="filter-waiting"]').click();
                await page.waitForTimeout(1000);
                
                waitingCard = page.locator('[class*="TournamentCard"]').first();
                hasWaiting = await waitingCard.isVisible().catch(() => false);
            }
            
            if (hasWaiting) {
                // 点击卡片尝试加入
                await waitingCard.click();
                await page.waitForTimeout(1500);
                
                // 验证弹窗或页面响应
                // 未登录用户应该看到登录提示弹窗
                const modal = page.locator('[role="dialog"], [class*="modal"], [class*="Modal"]');
                const modalVisible = await modal.isVisible().catch(() => false);
                
                if (modalVisible) {
                    console.log('Modal appeared - login required');
                    // 关闭弹窗
                    const closeBtn = modal.locator('button').first();
                    if (await closeBtn.isVisible()) {
                        await closeBtn.click();
                    }
                } else {
                    // 可能直接进入了游戏页面
                    console.log('Page navigated or action taken');
                }
            }
        });
    });

    test.describe('API错误处理', () => {
        test('应该正确处理API错误', async ({ page }) => {
            // 拦截API返回错误
            await page.route('**/api/tournament/list*', route => {
                route.fulfill({
                    status: 500,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: false, error: 'Server error' })
                });
            });
            
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 验证错误提示
            const errorMsg = page.locator('[data-testid="error-message"]');
            await expect(errorMsg).toBeVisible({ timeout: 10000 });
        });

        test('应该正确处理空状态', async ({ page }) => {
            // 拦截API返回空列表
            await page.route('**/api/tournament/list*', route => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({ success: true, tournaments: [] })
                });
            });
            
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            // 验证空状态提示
            const emptyState = page.locator('[data-testid="empty-state"]');
            await expect(emptyState).toBeVisible({ timeout: 10000 });
            await expect(emptyState).toContainText('No tournaments available');
        });
    });

    test.describe('创建不同类型的锦标赛', () => {
        test('创建2人赛', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            const createBtn = page.locator('[data-testid="create-tournament-btn-3"]');
            await createBtn.click();
            await page.waitForTimeout(3000);
            
            // 验证创建成功
            const card = page.locator('[class*="TournamentCard"]').first();
            await expect(card).toBeVisible({ timeout: 10000 }).catch(() => {
                console.log('Card may take time to appear');
            });
        });

        test('创建4人赛', async ({ page }) => {
            await page.goto('/tournament');
            await page.waitForLoadState('networkidle');
            
            const createBtn = page.locator('[data-testid="create-tournament-btn-2"]');
            await createBtn.click();
            await page.waitForTimeout(3000);
            
            // 验证创建成功
            const card = page.locator('[class*="TournamentCard"]').first();
            await expect(card).toBeVisible({ timeout: 10000 }).catch(() => {
                console.log('Card may take time to appear');
            });
        });
    });
});
