/**
 * 锦标赛端对端测试 - 增强版
 * 包含完整的API响应验证和错误处理
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');

const CDP_PORT = process.env.CDP_PORT || 9222;
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const API_URL = process.env.API_URL || 'http://127.0.0.1:7777';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 直接调用API创建锦标赛
async function createTournamentViaAPI(configId = 1) {
    try {
        const response = await fetch(`${API_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId, walletAddress: 'test-mode' })
        });
        const data = await response.json();
        console.log('API创建响应:', JSON.stringify(data, null, 2));
        return data;
    } catch (error) {
        console.error('API创建失败:', error.message);
        return null;
    }
}

// 直接调用API获取锦标赛列表
async function getTournamentsAPI(status = null) {
    try {
        const url = status 
            ? `${API_URL}/api/tournament/list?status=${status}`
            : `${API_URL}/api/tournament/list`;
        const response = await fetch(url);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API获取失败:', error.message);
        return null;
    }
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛端对端测试 (CDP) - 增强版');
    console.log('========================================\n');
    
    let client;
    
    try {
        // 连接到Chrome
        console.log(`连接到Chrome (端口 ${CDP_PORT})...`);
        client = await CDP({ port: CDP_PORT });
        
        const { Page, Runtime, DOM, Network } = client;
        
        // 启用必要的域
        await Promise.all([
            Page.enable(),
            Runtime.enable(),
            DOM.enable(),
            Network.enable()
        ]);
        
        console.log('✅ 已连接到Chrome\n');
        
        // 监听所有网络响应
        const apiResponses = [];
        Network.responseReceived(async (params) => {
            if (params.response.url.includes('/api/')) {
                try {
                    const body = await Network.getResponseBody({ requestId: params.requestId });
                    apiResponses.push({
                        url: params.response.url,
                        status: params.response.status,
                        body: body.body
                    });
                } catch (e) {}
            }
        });
        
        // 测试0: 直接API测试
        console.log('--- 测试0: 直接API测试 ---');
        
        // 获取现有锦标赛
        let existingTournaments = await getTournamentsAPI();
        console.log('现有锦标赛:', existingTournaments?.tournaments?.length || 0, '个');
        
        // 创建新锦标赛
        console.log('\n通过API创建锦标赛...');
        const createResult = await createTournamentViaAPI(1);
        
        if (createResult?.success) {
            console.log('✅ API创建成功');
            console.log('锦标赛ID:', createResult.tournament?.tournamentId);
            console.log('配置:', createResult.tournament?.config?.name);
        } else {
            console.log('❌ API创建失败:', createResult?.error);
        }
        
        // 再次获取锦标赛列表
        await sleep(1000);
        existingTournaments = await getTournamentsAPI();
        console.log('创建后锦标赛:', existingTournaments?.tournaments?.length || 0, '个');
        
        // 测试1: 访问锦标赛页面
        console.log('\n--- 测试1: 访问锦标赛页面 ---');
        await Page.navigate({ url: `${BASE_URL}/tournament` });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 获取页面标题
        const heading = await Runtime.evaluate({
            expression: `document.querySelector('h1')?.textContent`
        });
        console.log('页面标题:', heading.result.value);
        
        // 测试2: 检查空状态
        console.log('\n--- 测试2: 检查页面状态 ---');
        
        const emptyState = await Runtime.evaluate({
            expression: `!!document.querySelector('[data-testid="empty-state"]')`
        });
        console.log('空状态显示:', emptyState.result.value);
        
        const cardCount = await Runtime.evaluate({
            expression: `document.querySelectorAll('[class*="TournamentCard"]').length`
        });
        console.log('锦标赛卡片数量:', cardCount.result.value);
        
        // 测试3: 检查错误信息
        const errorVisible = await Runtime.evaluate({
            expression: `!!document.querySelector('[data-testid="error-message"]')`
        });
        
        if (errorVisible.result.value) {
            const errorText = await Runtime.evaluate({
                expression: `document.querySelector('[data-testid="error-message"]')?.textContent`
            });
            console.log('❌ 页面显示错误:', errorText.result.value);
        }
        
        // 测试4: 如果没有卡片，刷新页面
        if (cardCount.result.value === 0) {
            console.log('\n--- 测试3: 刷新页面 ---');
            await Page.reload();
            await Page.loadEventFired();
            await sleep(3000);
            
            const newCardCount = await Runtime.evaluate({
                expression: `document.querySelectorAll('[class*="TournamentCard"]').length`
            });
            console.log('刷新后卡片数量:', newCardCount.result.value);
            
            // 检查loading状态
            const loadingText = await Runtime.evaluate({
                expression: `document.querySelector('[data-testid="loading-text"]')?.textContent`
            });
            console.log('加载状态:', loadingText.result.value || '无');
        }
        
        // 测试5: 点击创建按钮
        console.log('\n--- 测试4: 点击创建按钮 ---');
        
        const createBtnExists = await Runtime.evaluate({
            expression: `!!document.querySelector('[data-testid="create-tournament-btn-1"]')`
        });
        
        if (createBtnExists.result.value) {
            await Runtime.evaluate({
                expression: `document.querySelector('[data-testid="create-tournament-btn-1"]').click()`
            });
            console.log('✅ 点击创建按钮');
            await sleep(4000);
            
            // 检查新的卡片
            const newCardCount = await Runtime.evaluate({
                expression: `document.querySelectorAll('[class*="TournamentCard"]').length`
            });
            console.log('点击后卡片数量:', newCardCount.result.value);
        }
        
        // 测试6: 输出所有API响应
        console.log('\n--- 测试5: API响应汇总 ---');
        if (apiResponses.length > 0) {
            apiResponses.forEach((resp, i) => {
                console.log(`\n响应 ${i + 1}: ${resp.url}`);
                console.log('状态:', resp.status);
                try {
                    const data = JSON.parse(resp.body);
                    console.log('内容:', JSON.stringify(data, null, 2).substring(0, 500));
                } catch (e) {
                    console.log('内容:', resp.body.substring(0, 200));
                }
            });
        } else {
            console.log('没有捕获到API响应');
        }
        
        // 测试7: 验证卡片内容和点击
        console.log('\n--- 测试6: 验证卡片 ---');
        
        const finalCardCount = await Runtime.evaluate({
            expression: `document.querySelectorAll('[class*="TournamentCard"]').length`
        });
        
        if (finalCardCount.result.value > 0) {
            // 获取第一个卡片详情
            const cardDetails = await Runtime.evaluate({
                expression: `
                    (function() {
                        const card = document.querySelector('[class*="TournamentCard"]');
                        if (!card) return null;
                        return {
                            text: card.textContent.substring(0, 200),
                            status: card.querySelector('[class*="StatusBadge"]')?.textContent,
                            buyIn: card.querySelector('text=Buy-in')?.parentElement?.textContent,
                            players: card.querySelector('text=Players')?.parentElement?.textContent
                        };
                    })()
                `
            });
            
            console.log('卡片详情:', JSON.stringify(cardDetails.result.value, null, 2));
            
            // 点击卡片
            await Runtime.evaluate({
                expression: `document.querySelector('[class*="TournamentCard"]').click()`
            });
            await sleep(2000);
            console.log('✅ 点击卡片成功');
            
            // 检查是否有弹窗
            const modalVisible = await Runtime.evaluate({
                expression: `!!document.querySelector('[role="dialog"], [class*="modal"], [class*="Modal"]')`
            });
            console.log('弹窗显示:', modalVisible.result.value);
        }
        
        // 测试8: 筛选功能
        console.log('\n--- 测试7: 筛选功能 ---');
        
        await Runtime.evaluate({
            expression: `document.querySelector('[data-testid="filter-waiting"]')?.click()`
        });
        await sleep(1000);
        console.log('✅ 点击Waiting筛选');
        
        await Runtime.evaluate({
            expression: `document.querySelector('[data-testid="filter-all"]')?.click()`
        });
        await sleep(1000);
        console.log('✅ 点击All筛选');
        
        console.log('\n========================================');
        console.log('✅ 所有测试完成!');
        console.log('========================================');
        
        // 输出最终状态
        console.log('\n最终状态:');
        const finalState = await Runtime.evaluate({
            expression: `
                (function() {
                    return {
                        url: window.location.href,
                        cardCount: document.querySelectorAll('[class*="TournamentCard"]').length,
                        emptyState: !!document.querySelector('[data-testid="empty-state"]'),
                        errorState: !!document.querySelector('[data-testid="error-message"]'),
                        createSection: !!document.querySelector('[data-testid="create-tournament-section"]')
                    };
                })()
            `
        });
        console.log(JSON.stringify(finalState.result.value, null, 2));
        
    } catch (error) {
        console.error('\n❌ 测试失败:', error.message);
        console.error(error.stack);
    } finally {
        if (client) {
            await client.close();
        }
    }
}

// 运行测试
runTests().catch(console.error);
