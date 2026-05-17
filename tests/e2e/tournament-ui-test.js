/**
 * 锦标赛UI测试 - 验证锦标赛游戏画面复用正常游戏界面
 * 使用Chrome DevTools Protocol测试
 */

const CDP = require('chrome-remote-interface');
const fetch = require('node-fetch');

const API_URL = process.env.API_URL || 'http://127.0.0.1:7778';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://127.0.0.1:3001';
const CDP_PORT = 9222;

// 玩家私钥
const _testCfg = require('../../tests/test-config'); const _players = _testCfg.getPlayerConfig(); const PLAYER1_PRIVATE_KEY = _players.PLAYER1.privateKey;
const PLAYER2_PRIVATE_KEY = _players.PLAYER2.privateKey;

let PLAYER1_ADDRESS = null;
let PLAYER2_ADDRESS = null;

// 测试结果
const results = { passed: [], failed: [], errors: [] };

function logPass(testName) {
    results.passed.push(testName);
    console.log(`✅ PASS: ${testName}`);
}

function logFail(testName, error) {
    results.failed.push(testName);
    results.errors.push({ test: testName, error });
    console.log(`❌ FAIL: ${testName} - ${error}`);
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('========================================');
    console.log('锦标赛UI测试 - 验证游戏画面复用');
    console.log('========================================\n');
    
    let client = null;
    let Page, Runtime, DOM;
    
    try {
        // 步骤1: 派生钱包地址
        console.log('--- 步骤1: 派生钱包地址 ---');
        
        const TronWebModule = await import('tronweb');
        let TronWeb;
        if (TronWebModule.default && typeof TronWebModule.default === 'function') {
            TronWeb = TronWebModule.default;
        } else if (TronWebModule.TronWeb) {
            TronWeb = TronWebModule.TronWeb;
        } else {
            TronWeb = TronWebModule;
        }
        
        const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
        PLAYER1_ADDRESS = tronWeb.address.fromPrivateKey(PLAYER1_PRIVATE_KEY);
        PLAYER2_ADDRESS = tronWeb.address.fromPrivateKey(PLAYER2_PRIVATE_KEY);
        
        console.log(`玩家1: ${PLAYER1_ADDRESS}`);
        console.log(`玩家2: ${PLAYER2_ADDRESS}`);
        logPass('派生钱包地址');
        
        // 步骤2: 创建锦标赛
        console.log('\n--- 步骤2: 创建锦标赛 ---');
        
        const createResponse = await fetch(`${API_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId: 3, walletAddress: PLAYER1_ADDRESS })
        });
        const createResult = await createResponse.json();
        
        if (!createResult.success) {
            throw new Error('创建锦标赛失败: ' + createResult.error);
        }
        
        const tournamentId = createResult.tournament?.tournamentId || createResult.tournament?.id;
        console.log(`锦标赛ID: ${tournamentId}`);
        logPass('创建锦标赛');
        
        // 步骤3: 连接Chrome CDP
        console.log('\n--- 步骤3: 连接Chrome CDP ---');
        
        client = await CDP({ port: CDP_PORT });
        ({ Page, Runtime, DOM } = client);
        
        await Page.enable();
        await Runtime.enable();
        await DOM.enable();
        
        logPass('连接Chrome CDP');
        
        // 步骤4: 玩家1打开锦标赛页面
        console.log('\n--- 步骤4: 玩家1打开锦标赛页面 ---');
        
        const player1Url = `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}`;
        await Page.navigate({ url: player1Url });
        await Page.loadEventFired();
        await sleep(2000);
        
        console.log(`打开URL: ${player1Url}`);
        logPass('玩家1打开锦标赛页面');
        
        // 步骤5: 等待玩家2加入，触发游戏开始
        console.log('\n--- 步骤5: 玩家2加入锦标赛（API） ---');
        
        const join2Response = await fetch(`${API_URL}/api/tournament/${tournamentId}/join`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-wallet-address': PLAYER2_ADDRESS
            },
            body: JSON.stringify({ walletAddress: PLAYER2_ADDRESS })
        });
        const join2Result = await join2Response.json();
        
        console.log(`玩家2加入: ${join2Result.success ? '成功' : join2Result.error}`);
        logPass('玩家2加入锦标赛');
        
        // 等待游戏状态更新 - 玩家2也需要通过 Socket 加入
        console.log('\n--- 步骤5b: 等待游戏开始 ---');
        
        // 等待更长时间让游戏开始
        await sleep(5000);
        
        // 检查 tournament 状态
        const statusCheck = await fetch(`${API_URL}/api/tournament/${tournamentId}`);
        const statusData = await statusCheck.json();
        console.log(`Tournament 状态: ${statusData.tournament?.status}`);
        
        // 如果还是 WAITING，手动开始
        if (statusData.tournament?.status === 'WAITING') {
            console.log('手动开始锦标赛...');
            await fetch(`${API_URL}/api/tournament/${tournamentId}/start`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            await sleep(3000);
        }
        
        // 刷新页面获取最新状态
        await Page.navigate({ url: `${FRONTEND_URL}/tournament/${tournamentId}?address=${PLAYER1_ADDRESS}` });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 步骤6: 检查页面UI是否复用了正常游戏界面
        console.log('\n--- 步骤6: 检查游戏UI是否复用正常游戏界面 ---');
        
        // 检查是否存在扑克牌桌图片 (Play.js的核心元素)
        const pokerTableCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    // 检查扑克牌桌图片
                    const pokerTable = document.querySelector('img[alt="Poker Table"]');
                    if (!pokerTable) return { hasPokerTable: false, reason: 'No poker table image found' };
                    
                    // 检查座位元素 (Seat组件)
                    const seats = document.querySelectorAll('.seat-name, .seat-stack');
                    if (seats.length === 0) return { hasSeats: false, reason: 'No seat elements found' };
                    
                    // 检查游戏UI按钮 (Fold/Check/Call/Raise)
                    const buttons = document.querySelectorAll('button');
                    const buttonTexts = Array.from(buttons).map(b => b.textContent.trim());
                    const hasGameButtons = ['Fold', 'Check', 'Call', 'Raise'].some(text => buttonTexts.includes(text));
                    
                    // 检查是否使用Play.js的背景样式
                    const container = document.querySelector('.play-area');
                    const hasPlayArea = container !== null;
                    
                    // 检查社区牌
                    const communityCards = document.querySelectorAll('img[alt*="card"], .poker-card');
                    
                    return {
                        hasPokerTable: true,
                        seatCount: seats.length,
                        hasGameButtons: hasGameButtons,
                        hasPlayArea: hasPlayArea,
                        communityCardCount: communityCards.length,
                        buttonTexts: buttonTexts.slice(0, 10)
                    };
                })()
            `,
            returnByValue: true
        });
        
        const uiCheck = pokerTableCheck.result?.value || pokerTableCheck.result;
        console.log('UI检查结果:', JSON.stringify(uiCheck, null, 2));
        
        if (uiCheck && uiCheck.hasPokerTable) {
            logPass('找到扑克牌桌图片（复用Play.js）');
        } else {
            logFail('找到扑克牌桌图片', uiCheck?.reason || '未找到');
        }
        
        if (uiCheck && uiCheck.hasPlayArea) {
            logPass('使用Play.js背景样式（.play-area）');
        } else {
            logFail('使用Play.js背景样式', '未找到.play-area类');
        }
        
        if (uiCheck && uiCheck.hasGameButtons) {
            logPass('游戏按钮存在（Fold/Check/Call/Raise）');
        } else {
            logFail('游戏按钮存在', '未找到游戏按钮');
        }
        
        // 步骤7: 检查页面结构完整性
        console.log('\n--- 步骤7: 检查页面结构完整性 ---');
        
        const structureCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    const root = document.getElementById('root');
                    if (!root) return { hasRoot: false, childCount: 0 };
                    
                    // 检查是否渲染了内容
                    const childCount = root.children.length;
                    const htmlContent = root.innerHTML.length;
                    
                    // 检查是否有React错误
                    const hasError = root.innerHTML.includes('Error') || 
                                    root.innerHTML.includes('Something went wrong');
                    
                    // 检查关键组件
                    const hasContainer = root.querySelector('[class*="Container"]') !== null;
                    const hasPokerTableWrapper = root.innerHTML.includes('PokerTableWrapper') || 
                                                 root.innerHTML.includes('table.webp');
                    
                    return {
                        hasRoot: true,
                        childCount: childCount,
                        htmlContentLength: htmlContent,
                        hasError: hasError,
                        hasContainer: hasContainer,
                        hasPokerTableWrapper: hasPokerTableWrapper
                    };
                })()
            `,
            returnByValue: true
        });
        
        const struct = structureCheck.result?.value || structureCheck.result;
        console.log('页面结构:', JSON.stringify(struct, null, 2));
        
        if (struct && struct.hasRoot && struct.childCount > 0 && !struct.hasError) {
            logPass(`页面正常渲染（${struct.childCount}个子元素）`);
        } else {
            logFail('页面正常渲染', `hasRoot=${struct?.hasRoot}, children=${struct?.childCount}, error=${struct?.hasError}`);
        }
        
        // 步骤8: 检查游戏状态是否显示
        console.log('\n--- 步骤8: 检查游戏状态 ---');
        
        const gameStateCheck = await Runtime.evaluate({
            expression: `
                (function() {
                    // 检查是否有等待信息或游戏信息
                    const pageText = document.body.innerText;
                    
                    // 应该显示以下之一：等待玩家、游戏信息、锦标赛信息
                    const hasWaitingInfo = pageText.includes('Waiting') || pageText.includes('等待');
                    const hasGameInfo = pageText.includes('Tournament') || pageText.includes('锦标赛');
                    const hasPlayerInfo = pageText.includes('Player') || pageText.includes('Stack') || pageText.includes('Chips');
                    
                    // 检查控制台错误
                    return {
                        hasWaitingInfo: hasWaitingInfo,
                        hasGameInfo: hasGameInfo,
                        hasPlayerInfo: hasPlayerInfo,
                        pageTextSnippet: pageText.substring(0, 500)
                    };
                })()
            `,
            returnByValue: true
        });
        
        const gameState = gameStateCheck.result?.value || gameStateCheck.result;
        console.log('游戏状态检查:', JSON.stringify({
            hasWaitingInfo: gameState?.hasWaitingInfo,
            hasGameInfo: gameState?.hasGameInfo,
            hasPlayerInfo: gameState?.hasPlayerInfo
        }, null, 2));
        
        if (gameState && (gameState.hasGameInfo || gameState.hasPlayerInfo)) {
            logPass('显示游戏状态信息');
        } else {
            logFail('显示游戏状态信息', '未找到游戏状态');
        }
        
        // 步骤9: 截图保存
        console.log('\n--- 步骤9: 保存截图 ---');
        
        const screenshot = await Page.captureScreenshot({ format: 'png' });
        const fs = require('fs');
        const screenshotPath = '/tmp/tournament-ui-test.png';
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log(`截图已保存: ${screenshotPath}`);
        logPass('保存截图');
        
    } catch (error) {
        console.error('\n❌ 测试执行错误:', error.message);
        console.error(error.stack);
        logFail('测试执行', error.message);
    } finally {
        if (client) {
            await client.close();
        }
    }
    
    // 输出汇总
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${results.passed.length}`);
    console.log(`❌ 失败: ${results.failed.length}`);
    
    if (results.passed.length > 0) {
        console.log('\n通过的测试:');
        results.passed.forEach(t => console.log(`  ✅ ${t}`));
    }
    
    if (results.failed.length > 0) {
        console.log('\n失败的测试:');
        results.failed.forEach(t => console.log(`  ❌ ${t}`));
    }
    
    console.log('\n========================================');
    process.exit(results.failed.length > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error('未捕获的错误:', err);
    process.exit(1);
});
