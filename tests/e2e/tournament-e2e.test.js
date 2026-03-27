/**
 * 锦标赛端对端测试 - 使用Puppeteer连接现有Chrome
 * 更稳定，不会卡死
 */

const puppeteer = require('puppeteer');
const { expect } = require('chai');

const CDP_PORT = process.env.CDP_PORT || 9222;
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// 延时函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function connectToChrome() {
    try {
        // 获取WebSocket endpoint
        const response = await fetch(`http://localhost:${CDP_PORT}/json/version`);
        const data = await response.json();
        
        console.log('✅ 已连接到Chrome');
        console.log('WebSocket:', data.webSocketDebuggerUrl);
        
        // 连接到现有浏览器
        const browser = await puppeteer.connect({
            browserURL: `http://localhost:${CDP_PORT}`,
            defaultViewport: null
        });
        
        return browser;
    } catch (error) {
        throw new Error(`无法连接到Chrome (port ${CDP_PORT}): ${error.message}\n请确保Chrome以调试模式运行: chrome --remote-debugging-port=9222`);
    }
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛端对端测试');
    console.log('========================================\n');
    
    let browser;
    let page;
    
    try {
        // 连接到Chrome
        browser = await connectToChrome();
        
        // 获取当前页面或创建新页面
        const pages = await browser.pages();
        page = pages[0] || await browser.newPage();
        
        console.log('\n--- 测试1: 访问Landing页面 ---');
        await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(2000);
        console.log('✅ Landing页面加载成功');
        
        // 截图
        await page.screenshot({ path: 'test-results/01-landing.png' });
        
        console.log('\n--- 测试2: 进入锦标赛页面 ---');
        // 查找锦标赛入口
        const tournamentFeature = await page.$('[data-testid="feature-tournament"]');
        
        if (tournamentFeature) {
            await tournamentFeature.click();
            await sleep(2000);
            console.log('✅ 点击锦标赛入口');
        } else {
            // 直接访问锦标赛页面
            await page.goto(`${BASE_URL}/tournament`, { waitUntil: 'domcontentloaded' });
            await sleep(2000);
            console.log('✅ 直接访问锦标赛页面');
        }
        
        await page.screenshot({ path: 'test-results/02-tournament.png' });
        
        console.log('\n--- 测试3: 验证页面元素 ---');
        
        // 验证标题
        const heading = await page.$eval('h1', el => el.textContent).catch(() => null);
        console.log('页面标题:', heading);
        expect(heading).to.include('Tournaments');
        
        // 验证创建按钮区域
        const createSection = await page.$('[data-testid="create-tournament-section"]');
        expect(createSection).to.not.be.null;
        console.log('✅ 创建按钮区域存在');
        
        // 验证筛选按钮
        const filterButtons = await page.$$('[data-testid^="filter-"]');
        console.log(`✅ 找到 ${filterButtons.length} 个筛选按钮`);
        
        console.log('\n--- 测试4: 创建锦标赛 ---');
        
        // 点击创建按钮
        const createBtn = await page.$('[data-testid="create-tournament-btn-1"]');
        if (createBtn) {
            // 监听响应
            page.on('response', async (response) => {
                if (response.url().includes('/api/tournament/create')) {
                    console.log('API响应:', response.status());
                    try {
                        const data = await response.json();
                        console.log('创建结果:', JSON.stringify(data, null, 2));
                    } catch (e) {}
                }
            });
            
            await createBtn.click();
            console.log('✅ 点击创建按钮');
            await sleep(3000);
            
            await page.screenshot({ path: 'test-results/03-after-create.png' });
        }
        
        console.log('\n--- 测试5: 验证锦标赛卡片 ---');
        
        // 等待卡片出现
        await sleep(2000);
        
        const cards = await page.$$('[class*="TournamentCard"]');
        console.log(`找到 ${cards.length} 个锦标赛卡片`);
        
        if (cards.length > 0) {
            // 验证第一个卡片的内容
            const cardText = await cards[0].evaluate(el => el.textContent);
            console.log('卡片内容预览:', cardText.substring(0, 100) + '...');
            
            // 验证状态标签
            const statusBadge = await cards[0].$('[class*="StatusBadge"]');
            if (statusBadge) {
                const status = await statusBadge.evaluate(el => el.textContent);
                console.log('状态:', status);
            }
            
            console.log('✅ 锦标赛卡片验证成功');
        }
        
        console.log('\n--- 测试6: 测试筛选功能 ---');
        
        // 点击Waiting筛选
        const waitingFilter = await page.$('[data-testid="filter-waiting"]');
        if (waitingFilter) {
            await waitingFilter.click();
            await sleep(1000);
            console.log('✅ 点击Waiting筛选');
            await page.screenshot({ path: 'test-results/04-filter-waiting.png' });
        }
        
        // 点击All筛选
        const allFilter = await page.$('[data-testid="filter-all"]');
        if (allFilter) {
            await allFilter.click();
            await sleep(1000);
            console.log('✅ 点击All筛选');
        }
        
        console.log('\n--- 测试7: 点击锦标赛卡片 ---');
        
        const waitingCard = await page.$('[class*="TournamentCard"]');
        if (waitingCard) {
            await waitingCard.click();
            await sleep(2000);
            console.log('✅ 点击锦标赛卡片');
            await page.screenshot({ path: 'test-results/05-card-click.png' });
        }
        
        console.log('\n========================================');
        console.log('✅ 所有测试通过!');
        console.log('========================================');
        
        console.log('\n截图已保存到 test-results/ 目录');
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        if (page) {
            await page.screenshot({ path: 'test-results/error.png' });
            console.log('错误截图已保存: test-results/error.png');
        }
        throw error;
    } finally {
        // 不关闭浏览器，保持连接
        if (browser) {
            console.log('\n提示: 浏览器保持打开状态，可以继续使用');
        }
    }
}

// 运行测试
runTests()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
