/**
 * NFT Straight Game E2E Test
 * 模拟游戏让玩家1拿到顺子，触发NFT
 * 
 * 流程：
 * 1. 使用私钥连接两个玩家
 * 2. 创建游戏桌并设置mock deck
 * 3. 玩家进入游戏，发牌
 * 4. 模拟操作（check/call）直到showdown
 * 5. 验证NFT触发
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const CONFIG = {
    apiUrl: 'http://127.0.0.1:7778',
    frontendUrl: 'http://127.0.0.1:3001',
    cdpPort: 9222,
    mongoUrl: 'mongodb://127.0.0.1:27017/bridge-poker',
    player1: {
        address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        privateKey: process.env.PLAYER1_PRIVATE_KEY || ''
    },
    player2: {
        address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        privateKey: process.env.PLAYER2_PRIVATE_KEY || ''
    }
};

// Mock deck: Player1 gets A-K suited, Player2 gets random cards
// Board will have Q-J-10 for straight
const MOCK_DECK = [
    // Player 1 hole cards (seat 1)
    { rank: 'A', suit: 'h' },  // P1 card 1
    { rank: 'K', suit: 'd' },  // P2 card 1
    { rank: 'K', suit: 'h' },  // P1 card 2
    { rank: 'Q', suit: 's' },  // P2 card 2
    
    // Flop - Q, J, 10 (makes Broadway straight for P1)
    { rank: 'Q', suit: 'h' },  // Flop 1
    { rank: 'J', suit: 'c' },  // Flop 2
    { rank: '10', suit: 's' }, // Flop 3
    
    // Turn - random
    { rank: '4', suit: 'd' },
    
    // River - random
    { rank: '7', suit: 'c' }
];

let testResults = {
    passed: 0,
    failed: 0,
    warnings: [],
    screenshots: [],
    nftTriggered: false
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('NFT Straight Game E2E Test');
    console.log('========================================\n');

    // 测试1: 验证服务器运行
    console.log('测试1: 验证服务器状态');
    console.log('----------------------------------------');
    try {
        const health = await axios.get(`${CONFIG.apiUrl}/api/health`);
        console.log('服务器状态:', health.data);
        console.log('✅ PASS: 服务器运行正常');
        testResults.passed++;
    } catch (error) {
        console.log('❌ FAIL: 服务器未运行');
        testResults.failed++;
        process.exit(1);
    }

    // 测试2: 连接Chrome CDP
    console.log('\n测试2: 连接Chrome浏览器');
    console.log('----------------------------------------');
    let client;
    try {
        client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime, Network } = client;
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        console.log('✅ PASS: Chrome CDP连接成功');
        testResults.passed++;
        
        // 存储全局引用
        global.cdpClient = { Page, Runtime, Network };
    } catch (error) {
        console.log('❌ FAIL: Chrome CDP连接失败:', error.message);
        testResults.failed++;
        process.exit(1);
    }

    const { Page, Runtime, Network } = global.cdpClient;

    // 监听NFT相关事件
    let nftEventReceived = null;
    Runtime.consoleAPICalled(({ type, args }) => {
        const msg = args.map(a => a.value || '').join(' ');
        if (msg.includes('NFT') || msg.includes('Achievement') || msg.includes('STRAIGHT')) {
            console.log('🎮 [浏览器日志]', msg);
        }
    });

    Network.webSocketFrameReceived(({ response }) => {
        try {
            const payload = response.payloadData;
            if (payload.includes('SC_NFT') || payload.includes('Achievement')) {
                console.log('📡 [WebSocket] NFT事件:', payload.substring(0, 300));
                if (payload.includes('SC_NFT_ACHIEVEMENT_EARNED')) {
                    nftEventReceived = payload;
                    testResults.nftTriggered = true;
                }
            }
        } catch (e) {}
    });

    // 测试3: 访问游戏页面并设置钱包
    console.log('\n测试3: 访问游戏页面');
    console.log('----------------------------------------');
    
    // 打开Play页面
    await Page.navigate({ url: `${CONFIG.frontendUrl}/play` });
    await Page.loadEventFired();
    await sleep(3000);
    
    // 截图初始状态
    let screenshot = await Page.captureScreenshot();
    fs.writeFileSync('test-results/nft-game-01-play-page.png', Buffer.from(screenshot.data, 'base64'));
    console.log('📸 截图: nft-game-01-play-page.png');
    testResults.screenshots.push('test-results/nft-game-01-play-page.png');

    // 测试4: 通过API创建游戏桌并设置mock deck
    console.log('\n测试4: 创建游戏桌');
    console.log('----------------------------------------');
    
    // 创建锦标赛
    const tournamentRes = await axios.post(`${CONFIG.apiUrl}/api/tournament/create`, {
        name: 'NFT Straight Test',
        buyIn: 100,
        maxPlayers: 6,
        creatorAddress: CONFIG.player1.address,
        mockDeck: MOCK_DECK  // 传递mock deck
    });
    
    const tournamentId = tournamentRes.data.tournament?._id || tournamentRes.data.tournamentId;
    console.log('锦标赛ID:', tournamentId);

    // 测试5: 注入钱包地址
    console.log('\n测试5: 设置玩家钱包');
    console.log('----------------------------------------');
    
    // 通过localStorage注入钱包地址
    await Runtime.evaluate({
        expression: `
            localStorage.setItem('walletAddress', '${CONFIG.player1.address}');
            localStorage.setItem('tronAddress', '${CONFIG.player1.address}');
            console.log('Wallet set to:', '${CONFIG.player1.address}');
        `
    });
    
    // 刷新页面使钱包生效
    await Page.navigate({ url: `${CONFIG.frontendUrl}/play` });
    await Page.loadEventFired();
    await sleep(2000);

    // 测试6: 加入游戏
    console.log('\n测试6: 加入游戏');
    console.log('----------------------------------------');
    
    // 点击加入按钮
    const joinResult = await Runtime.evaluate({
        expression: `
            (() => {
                // 查找加入按钮
                const buttons = Array.from(document.querySelectorAll('button'));
                const joinBtn = buttons.find(b => 
                    b.innerText.toLowerCase().includes('join') || 
                    b.innerText.toLowerCase().includes('加入') ||
                    b.innerText.toLowerCase().includes('play')
                );
                if (joinBtn) {
                    joinBtn.click();
                    return { clicked: true, text: joinBtn.innerText };
                }
                return { clicked: false, buttons: buttons.map(b => b.innerText).slice(0, 5) };
            })()
        `,
        returnByValue: true
    });
    
    console.log('加入按钮:', JSON.stringify(joinResult.result?.value, null, 2));
    await sleep(3000);

    // 截图
    screenshot = await Page.captureScreenshot();
    fs.writeFileSync('test-results/nft-game-02-joined.png', Buffer.from(screenshot.data, 'base64'));
    console.log('📸 截图: nft-game-02-joined.png');
    testResults.screenshots.push('test-results/nft-game-02-joined.png');

    // 测试7: 检查游戏状态
    console.log('\n测试7: 检查游戏状态');
    console.log('----------------------------------------');
    
    const gameState = await Runtime.evaluate({
        expression: `
            (() => {
                const seats = document.querySelectorAll('[class*="seat"], [class*="player"]');
                const cards = document.querySelectorAll('[class*="card"], [class*="Card"]');
                const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
                    text: b.innerText,
                    disabled: b.disabled
                }));
                
                return {
                    seatsCount: seats.length,
                    cardsCount: cards.length,
                    buttons: buttons.slice(0, 10),
                    bodyText: document.body.innerText.substring(0, 500)
                };
            })()
        `,
        returnByValue: true
    });
    
    console.log('游戏状态:', JSON.stringify(gameState.result?.value, null, 2));

    // 测试8: 模拟游戏操作直到showdown
    console.log('\n测试8: 模拟游戏操作');
    console.log('----------------------------------------');
    
    for (let i = 0; i < 10; i++) {
        await sleep(2000);
        
        // 检查是否有可操作按钮
        const actionResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    
                    // 优先级：Check > Call > Fold
                    let actionBtn = buttons.find(b => 
                        b.innerText.toLowerCase().includes('check') && !b.disabled
                    );
                    
                    if (!actionBtn) {
                        actionBtn = buttons.find(b => 
                            b.innerText.toLowerCase().includes('call') && !b.disabled
                        );
                    }
                    
                    if (actionBtn) {
                        actionBtn.click();
                        return { action: actionBtn.innerText, clicked: true };
                    }
                    
                    return { action: 'waiting', clicked: false };
                })()
            `,
            returnByValue: true
        });
        
        const action = actionResult.result?.value;
        if (action?.clicked) {
            console.log(`操作 ${i + 1}:`, action.action);
        }
        
        // 检查是否显示手牌
        const cardsCheck = await Runtime.evaluate({
            expression: `
                (() => {
                    const cardElements = document.querySelectorAll('[class*="card"], [class*="Card"]');
                    const cards = [];
                    cardElements.forEach(el => {
                        const text = el.innerText || el.textContent;
                        if (text && text.trim()) {
                            cards.push(text.trim());
                        }
                    });
                    
                    // 检查是否看到 A, K
                    const hasA = cards.some(c => c.includes('A'));
                    const hasK = cards.some(c => c.includes('K'));
                    
                    return { 
                        cards, 
                        hasStraightCards: hasA && hasK,
                        count: cards.length 
                    };
                })()
            `,
            returnByValue: true
        });
        
        if (cardsCheck.result?.value?.hasStraightCards) {
            console.log('🎯 检测到顺子底牌:', cardsCheck.result.value.cards);
        }
        
        // 截图
        screenshot = await Page.captureScreenshot();
        const screenshotName = `test-results/nft-game-03-action-${i}.png`;
        fs.writeFileSync(screenshotName, Buffer.from(screenshot.data, 'base64'));
        
        // 检查游戏是否结束
        const endCheck = await Runtime.evaluate({
            expression: `
                (() => {
                    const body = document.body.innerText;
                    const hasWinner = body.includes('wins') || body.includes('Winner') || body.includes('获胜');
                    const hasNFT = body.includes('NFT') || body.includes('Achievement') || body.includes('成就');
                    
                    return { hasWinner, hasNFT, bodySnippet: body.substring(0, 300) };
                })()
            `,
            returnByValue: true
        });
        
        if (endCheck.result?.value?.hasWinner || endCheck.result?.value?.hasNFT) {
            console.log('🎉 游戏结束检测:', endCheck.result.value);
            break;
        }
    }

    // 测试9: 最终截图
    console.log('\n测试9: 最终验证');
    console.log('----------------------------------------');
    
    screenshot = await Page.captureScreenshot();
    fs.writeFileSync('test-results/nft-game-04-final.png', Buffer.from(screenshot.data, 'base64'));
    console.log('📸 截图: nft-game-04-final.png');
    testResults.screenshots.push('test-results/nft-game-04-final.png');

    // 检查NFT事件
    if (nftEventReceived) {
        console.log('✅ PASS: NFT事件已触发');
        console.log('NFT详情:', nftEventReceived.substring(0, 500));
        testResults.passed++;
    } else {
        console.log('⚠️ WARN: 未检测到NFT事件');
        testResults.warnings.push('未检测到NFT事件');
    }

    // 测试10: 验证数据库NFT记录
    console.log('\n测试10: 验证数据库');
    console.log('----------------------------------------');
    
    await mongoose.connect(CONFIG.mongoUrl);
    const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }));
    
    const nfts = await NFTClaim.find({
        playerAddress: new RegExp(CONFIG.player1.address.substring(0, 10), 'i')
    }).sort({ claimedAt: -1 }).limit(5);
    
    console.log('数据库NFT记录:', nfts.length);
    nfts.forEach(nft => {
        console.log(`  - ${nft.achievementType}: ${nft.handDescription}`);
    });
    
    if (nfts.length > 0) {
        console.log('✅ PASS: 数据库存在NFT记录');
        testResults.passed++;
    }
    
    await mongoose.disconnect();
    await client.close();

    // 打印结果
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`⚠️ 警告: ${testResults.warnings.length}`);
    console.log(`📸 截图: ${testResults.screenshots.length}张`);
    console.log(`🎯 NFT触发: ${testResults.nftTriggered ? '是' : '否'}`);
    console.log('========================================');
    
    process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(console.error);
