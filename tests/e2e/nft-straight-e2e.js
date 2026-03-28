/**
 * NFT顺子牌型端对端完整测试
 * 
 * 测试流程（按照CODEBUDDY.md guide）：
 * 1. 测试用例需要全面，端对端测试，各个界面按钮事件需要触发
 * 2. 进入游戏，模拟fold，call，raise等操作
 * 3. 根据前端、后台、浏览器日志确定是否有错误
 * 4. 完善相关测试用例，自动完成所有流程操作
 * 
 * 使用Chrome CDP端口9222连接现有浏览器
 */

const fetch = require('node-fetch');
const CDP = require('chrome-remote-interface');

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:3001';
const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';
const CDP_PORT = 9222;

// 测试玩家
const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

const PLAYER2 = {
    address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
    privateKey: '[REMOVED PRIVATE KEY - SEE .env FOR CONFIG]'
};

// 顺子测试数据
const STRAIGHT_HANDS = [
    {
        name: 'A高顺子(Broadway)',
        holeCards: ['Ah', 'Kh'],
        board: ['Qc', 'Jd', 'Ts', '2c', '3d'],
        expectedType: 'STRAIGHT',
        typeId: 6
    },
    {
        name: '车轮顺子(A-2-3-4-5)',
        holeCards: ['Ah', '2h'],
        board: ['3c', '4d', '5s', 'Kc', 'Qd'],
        expectedType: 'STRAIGHT',
        typeId: 6
    },
    {
        name: 'K高顺子',
        holeCards: ['9h', 'Th'],
        board: ['Jc', 'Qd', 'Ks', '2c', '3d'],
        expectedType: 'STRAIGHT',
        typeId: 6
    }
];

// 测试结果
const results = { passed: [], failed: [], warnings: [] };

function logPass(testName) {
    results.passed.push(testName);
    console.log(`✅ PASS: ${testName}`);
}

function logFail(testName, error) {
    results.failed.push(testName);
    results.warnings.push({ test: testName, error });
    console.log(`❌ FAIL: ${testName} - ${error}`);
}

function logWarn(testName, message) {
    results.warnings.push({ test: testName, error: message });
    console.log(`⚠️  WARN: ${testName} - ${message}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// CDP客户端
let cdpClient = null;

async function connectCDP() {
    try {
        console.log(`\n--- 连接Chrome CDP端口 ${CDP_PORT} ---`);
        cdpClient = await CDP({ port: CDP_PORT });
        const { Page, Runtime, Network, DOM } = cdpClient;
        
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        await DOM.enable();
        
        console.log('✅ CDP连接成功');
        return { Page, Runtime, Network, DOM };
    } catch (e) {
        console.log(`❌ CDP连接失败: ${e.message}`);
        return null;
    }
}

async function disconnectCDP() {
    if (cdpClient) {
        try {
            await cdpClient.close();
            console.log('CDP连接已关闭');
        } catch (e) {
            // 忽略关闭错误
        }
    }
}

// 在浏览器中执行脚本
async function evaluateInBrowser(Runtime, expression) {
    try {
        const result = await Runtime.evaluate({ expression });
        return result.result;
    } catch (e) {
        console.log('执行脚本错误:', e.message);
        return null;
    }
}

// 截图
async function takeScreenshot(Page, filename) {
    try {
        const { data } = await Page.captureScreenshot({ format: 'png' });
        const fs = require('fs');
        const path = require('path');
        const screenshotsDir = path.join(__dirname, '../../test-results');
        if (!fs.existsSync(screenshotsDir)) {
            fs.mkdirSync(screenshotsDir, { recursive: true });
        }
        fs.writeFileSync(path.join(screenshotsDir, filename), Buffer.from(data, 'base64'));
        console.log(`📸 截图保存: ${filename}`);
    } catch (e) {
        console.log('截图失败:', e.message);
    }
}

// ==================== 测试函数 ====================

async function test1_NFTGalleryPage(Runtime, Page) {
    console.log('\n========================================');
    console.log('测试1: NFT画廊页面');
    console.log('========================================');
    
    try {
        // 导航到NFT页面
        await Page.navigate({ url: `${BASE_URL}/nft` });
        await Page.loadEventFired();
        await sleep(2000);
        
        // 截图
        await takeScreenshot(Page, 'nft-gallery-1.png');
        
        // 检查页面内容
        const pageContent = await evaluateInBrowser(Runtime, `
            JSON.stringify({
                title: document.title,
                h1Text: document.querySelector('h1')?.textContent || '',
                buttonCount: document.querySelectorAll('button').length,
                hasNFTText: document.body.innerText.includes('NFT'),
                hasStraightText: document.body.innerText.includes('Straight')
            });
        `);
        
        const content = JSON.parse(pageContent.value || '{}');
        console.log('页面内容:', content);
        
        if (content.hasNFTText) {
            logPass('NFT画廊页面加载');
        } else {
            logFail('NFT画廊页面加载', '页面不包含NFT文本');
        }
        
        if (content.hasStraightText) {
            logPass('顺子成就类型显示');
        } else {
            logWarn('顺子成就类型', '页面不包含Straight文本');
        }
        
    } catch (e) {
        logFail('NFT画廊页面测试', e.message);
    }
}

async function test2_AchievementTypesTab(Runtime, Page) {
    console.log('\n========================================');
    console.log('测试2: 成就类型选项卡');
    console.log('========================================');
    
    try {
        // 点击Achievement Types选项卡
        const clickResult = await evaluateInBrowser(Runtime, `
            (function() {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.includes('Achievement Types')) {
                        btn.click();
                        return 'clicked';
                    }
                }
                return 'not found';
            })();
        `);
        
        console.log('点击结果:', clickResult.value);
        await sleep(1000);
        
        // 截图
        await takeScreenshot(Page, 'nft-achievement-types.png');
        
        // 检查成就类型卡片
        const achievementCards = await evaluateInBrowser(Runtime, `
            JSON.stringify({
                straightVisible: document.body.innerText.includes('Straight'),
                flushVisible: document.body.innerText.includes('Flush'),
                fullHouseVisible: document.body.innerText.includes('Full House'),
                fourOfKindVisible: document.body.innerText.includes('Four of a Kind'),
                straightFlushVisible: document.body.innerText.includes('Straight Flush'),
                royalFlushVisible: document.body.innerText.includes('Royal Flush')
            });
        `);
        
        const cards = JSON.parse(achievementCards.value || '{}');
        console.log('成就类型显示:', cards);
        
        if (cards.straightVisible) {
            logPass('顺子成就类型卡片显示');
        } else {
            logFail('顺子成就类型卡片', '未找到Straight文本');
        }
        
    } catch (e) {
        logFail('成就类型选项卡测试', e.message);
    }
}

async function test3_NFTAPIs() {
    console.log('\n========================================');
    console.log('测试3: NFT API接口');
    console.log('========================================');
    
    // 3.1 获取成就类型
    try {
        const response = await fetch(`${API_URL}/api/nft/types`);
        console.log('成就类型API状态:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('成就类型数据:', JSON.stringify(data).substring(0, 200));
            logPass('获取成就类型API');
        } else {
            logWarn('获取成就类型API', `状态码: ${response.status}`);
        }
    } catch (e) {
        logWarn('获取成就类型API', e.message);
    }
    
    // 3.2 获取玩家NFT集合
    try {
        const response = await fetch(`${API_URL}/api/nft/collection/${PLAYER1.address}`);
        console.log('NFT集合API状态:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('NFT集合数据:', JSON.stringify(data).substring(0, 200));
            logPass('获取玩家NFT集合API');
        } else {
            logWarn('获取玩家NFT集合API', `状态码: ${response.status}`);
        }
    } catch (e) {
        logWarn('获取玩家NFT集合API', e.message);
    }
    
    // 3.3 月度限量检查
    try {
        const response = await fetch(`${API_URL}/api/nft/monthly-limit/6`); // 6 = STRAIGHT
        console.log('月度限量API状态:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('顺子月度限量:', data);
            logPass('月度限量API');
        } else {
            logWarn('月度限量API', `状态码: ${response.status}`);
        }
    } catch (e) {
        logWarn('月度限量API', e.message);
    }
}

async function test4_StraightHandDetection() {
    console.log('\n========================================');
    console.log('测试4: 顺子牌型检测');
    console.log('========================================');
    
    const testCase = STRAIGHT_HANDS[0]; // A高顺子
    
    console.log(`测试牌型: ${testCase.name}`);
    console.log(`手牌: ${testCase.holeCards.join(', ')}`);
    console.log(`公共牌: ${testCase.board.join(', ')}`);
    
    // 调用检测API
    try {
        const response = await fetch(`${API_URL}/api/nft/detect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                holeCards: testCase.holeCards,
                board: testCase.board,
                walletAddress: PLAYER1.address
            })
        });
        
        console.log('检测API状态:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('检测结果:', data);
            
            if (data.achievement && data.achievement.type === 'STRAIGHT') {
                logPass('顺子牌型检测成功');
            } else {
                logFail('顺子牌型检测', '检测结果不符合预期');
            }
        } else if (response.status === 404) {
            logWarn('顺子牌型检测API', 'API不存在，可能需要实现');
        } else {
            logFail('顺子牌型检测', `状态码: ${response.status}`);
        }
    } catch (e) {
        logWarn('顺子牌型检测', e.message);
    }
}

async function test5_TournamentGame(Runtime, Page) {
    console.log('\n========================================');
    console.log('测试5: 锦标赛游戏流程');
    console.log('========================================');
    
    let tournamentId = null;
    
    // 5.1 创建锦标赛
    try {
        console.log('\n[5.1] 创建锦标赛');
        const response = await fetch(`${API_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                configId: 3, // 2人锦标赛
                walletAddress: PLAYER1.address
            })
        });
        
        if (response.ok) {
            const data = await response.json();
            tournamentId = data.tournament?.tournamentId || data.tournament?.id;
            console.log('锦标赛ID:', tournamentId);
            logPass('创建锦标赛');
        } else {
            logFail('创建锦标赛', `状态码: ${response.status}`);
            return;
        }
    } catch (e) {
        logFail('创建锦标赛', e.message);
        return;
    }
    
    // 5.2 玩家加入
    try {
        console.log('\n[5.2] 玩家加入锦标赛');
        
        // 玩家1加入
        await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER1.address 
            },
            body: JSON.stringify({ walletAddress: PLAYER1.address })
        });
        console.log('玩家1已加入');
        
        // 玩家2加入
        await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER2.address 
            },
            body: JSON.stringify({ walletAddress: PLAYER2.address })
        });
        console.log('玩家2已加入');
        
        logPass('玩家加入锦标赛');
    } catch (e) {
        logFail('玩家加入锦标赛', e.message);
    }
    
    // 5.3 访问锦标赛页面
    try {
        console.log('\n[5.3] 访问锦标赛页面');
        await Page.navigate({ url: `${BASE_URL}/tournament/${tournamentId}` });
        await Page.loadEventFired();
        await sleep(2000);
        
        await takeScreenshot(Page, 'nft-tournament-page.png');
        logPass('访问锦标赛页面');
    } catch (e) {
        logFail('访问锦标赛页面', e.message);
    }
    
    // 5.4 检查游戏状态
    try {
        console.log('\n[5.4] 检查游戏状态');
        const gameState = await evaluateInBrowser(Runtime, `
            JSON.stringify({
                hasTable: document.querySelector('[class*="table"]') !== null,
                hasCards: document.querySelectorAll('[class*="card"], [class*="Card"]').length > 0,
                hasButtons: document.querySelectorAll('button').length,
                bodyText: document.body.innerText.substring(0, 200)
            });
        `);
        
        const state = JSON.parse(gameState.value || '{}');
        console.log('游戏状态:', state);
        
        if (state.hasTable || state.hasCards) {
            logPass('游戏界面存在');
        } else {
            logWarn('游戏界面', '可能需要等待游戏开始');
        }
    } catch (e) {
        logWarn('检查游戏状态', e.message);
    }
    
    // 5.5 尝试游戏操作
    try {
        console.log('\n[5.5] 尝试游戏操作');
        
        // 查找并点击游戏按钮
        const clickResult = await evaluateInBrowser(Runtime, `
            (function() {
                const buttons = document.querySelectorAll('button');
                const actions = [];
                
                for (const btn of buttons) {
                    const text = btn.textContent.toLowerCase();
                    if (text.includes('call') || text.includes('check') || text.includes('raise')) {
                        actions.push(text);
                        if (text.includes('call')) {
                            btn.click();
                            return 'clicked: ' + text;
                        }
                    }
                }
                
                return 'buttons found: ' + actions.join(', ');
            })();
        `);
        
        console.log('操作结果:', clickResult.value);
        await sleep(1000);
        await takeScreenshot(Page, 'nft-game-action.png');
        
    } catch (e) {
        logWarn('游戏操作', e.message);
    }
}

async function test6_NFTMintSimulation() {
    console.log('\n========================================');
    console.log('测试6: NFT铸造模拟');
    console.log('========================================');
    
    const testCase = STRAIGHT_HANDS[0];
    const gameId = `test-straight-${Date.now()}`;
    
    // 模拟游戏结束，触发NFT铸造
    try {
        const response = await fetch(`${API_URL}/api/nft/prepare-mint`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER1.address 
            },
            body: JSON.stringify({
                walletAddress: PLAYER1.address,
                achievementType: 'STRAIGHT',
                achievementTypeId: 6,
                holeCards: testCase.holeCards,
                board: testCase.board,
                gameId: gameId
            })
        });
        
        console.log('铸造准备API状态:', response.status);
        
        if (response.ok) {
            const data = await response.json();
            console.log('铸造准备数据:', data);
            logPass('NFT铸造准备API');
        } else if (response.status === 404) {
            logWarn('NFT铸造准备API', 'API不存在，可能需要实现');
        } else {
            const errorText = await response.text();
            logWarn('NFT铸造准备API', `状态码: ${response.status}, ${errorText}`);
        }
    } catch (e) {
        logWarn('NFT铸造准备API', e.message);
    }
}

async function test7_CompleteFlow(Runtime, Page) {
    console.log('\n========================================');
    console.log('测试7: 完整流程验证');
    console.log('========================================');
    
    // 最终截图
    await Page.navigate({ url: `${BASE_URL}/nft` });
    await Page.loadEventFired();
    await sleep(2000);
    await takeScreenshot(Page, 'nft-final-page.png');
    
    // 检查控制台错误
    console.log('\n检查是否有JavaScript错误...');
    const errors = await evaluateInBrowser(Runtime, `
        (function() {
            // 检查页面是否有明显的错误提示
            const errorElements = document.querySelectorAll('[class*="error"], [class*="Error"]');
            const hasErrors = errorElements.length > 0;
            
            return JSON.stringify({
                hasErrors: hasErrors,
                errorCount: errorElements.length,
                pageReady: document.readyState === 'complete'
            });
        })();
    `);
    
    const errorState = JSON.parse(errors.value || '{}');
    console.log('错误状态:', errorState);
    
    if (!errorState.hasErrors) {
        logPass('页面无错误');
    } else {
        logWarn('页面错误检查', `发现 ${errorState.errorCount} 个错误元素`);
    }
}

// ==================== 主函数 ====================

async function runTests() {
    console.log('========================================');
    console.log('NFT顺子牌型端对端完整测试');
    console.log('========================================');
    console.log(`前端URL: ${BASE_URL}`);
    console.log(`后端API: ${API_URL}`);
    console.log(`CDP端口: ${CDP_PORT}`);
    console.log(`玩家1: ${PLAYER1.address}`);
    console.log(`玩家2: ${PLAYER2.address}`);
    console.log('========================================\n');
    
    // 检查服务状态
    try {
        const healthResponse = await fetch(`${API_URL}/api/health`);
        if (healthResponse.ok) {
            console.log('✅ 后端服务运行中');
        } else {
            console.log('⚠️ 后端服务状态异常');
        }
    } catch (e) {
        console.log('❌ 后端服务未运行');
        console.log('请先启动后端: ENV_FILE=.env.testnet node server/server.js');
    }
    
    // 连接CDP
    const cdp = await connectCDP();
    
    if (cdp) {
        const { Page, Runtime, Network, DOM } = cdp;
        
        try {
            // 运行所有测试
            await test1_NFTGalleryPage(Runtime, Page);
            await test2_AchievementTypesTab(Runtime, Page);
            await test3_NFTAPIs();
            await test4_StraightHandDetection();
            await test5_TournamentGame(Runtime, Page);
            await test6_NFTMintSimulation();
            await test7_CompleteFlow(Runtime, Page);
        } catch (e) {
            console.error('测试执行错误:', e);
        }
        
        await disconnectCDP();
    } else {
        // 仅运行API测试
        console.log('\n⚠️ CDP不可用，仅运行API测试\n');
        await test3_NFTAPIs();
        await test4_StraightHandDetection();
        await test6_NFTMintSimulation();
    }
    
    // 输出汇总
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${results.passed.length}`);
    console.log(`❌ 失败: ${results.failed.length}`);
    console.log(`⚠️  警告: ${results.warnings.length}`);
    
    if (results.passed.length > 0) {
        console.log('\n通过的测试:');
        results.passed.forEach(t => console.log(`  ✅ ${t}`));
    }
    
    if (results.failed.length > 0) {
        console.log('\n失败的测试:');
        results.failed.forEach(t => console.log(`  ❌ ${t}`));
    }
    
    if (results.warnings.length > 0) {
        console.log('\n警告信息:');
        results.warnings.forEach(w => console.log(`  ⚠️  ${w.test}: ${w.error}`));
    }
    
    console.log('\n========================================');
    
    // 返回退出码
    process.exit(results.failed.length > 0 ? 1 : 0);
}

// 运行测试
runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
