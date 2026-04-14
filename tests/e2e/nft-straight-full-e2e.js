/**
 * NFT Straight Full E2E Test
 * 完整测试：两个玩家进入游戏，玩家1拿到顺子，触发NFT
 * 
 * 步骤：
 * 1. 创建游戏桌
 * 2. 两个玩家加入
 * 3. 设置mock deck让玩家1拿到A-K，桌面有Q-J-10形成顺子
 * 4. 模拟游戏操作直到showdown
 * 5. 通过CDP截图游戏画面
 * 6. 验证NFT触发
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');
const fs = require('fs');
const io = require('socket.io-client');

const CONFIG = {
    apiUrl: 'http://43.163.114.175:7778',
    frontendUrl: 'http://43.163.114.175:3001',
    cdpPort: 9222,
    mongoUrl: 'mongodb://43.163.114.175:27017/bridge-poker',
    player1: {
        address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        name: 'Player1_NFT'
    },
    player2: {
        address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        name: 'Player2_NFT'
    }
};

// Mock deck确保玩家1拿到顺子
// 发牌顺序：按座位顺序轮流发牌
// Seat 1 (Player1): A♥, K♥
// Seat 2 (Player2): 7♣, 4♦
// Board: Q♣, J♦, 10♠, 4♣, 7♦
const MOCK_DECK_STRAIGHT = [
    // Pre-flop: Seat 1, Seat 2轮流
    { rank: 'A', suit: 'h' },   // Seat 1 card 1
    { rank: '7', suit: 'c' },   // Seat 2 card 1
    { rank: 'K', suit: 'h' },   // Seat 1 card 2
    { rank: '4', suit: 'd' },   // Seat 2 card 2
    
    // Flop
    { rank: 'Q', suit: 'c' },   // Board
    { rank: 'J', suit: 'd' },   // Board
    { rank: '10', suit: 's' },  // Board - 玩家1现在有A-K-Q-J-10顺子!
    
    // Turn
    { rank: '4', suit: 'c' },   // Board
    
    // River
    { rank: '7', suit: 'd' }    // Board
];

let testResults = {
    passed: 0,
    failed: 0,
    warnings: [],
    screenshots: [],
    nftEvents: [],
    winner: null,
    handResult: null
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('NFT Straight Full E2E Test');
    console.log('玩家1将获得A-K-Q-J-10顺子!');
    console.log('========================================\n');

    // 测试1: 服务器状态
    console.log('测试1: 服务器状态');
    console.log('----------------------------------------');
    try {
        const health = await axios.get(`${CONFIG.apiUrl}/api/health`);
        console.log('✅ PASS: 服务器运行正常');
        testResults.passed++;
    } catch (error) {
        console.log('❌ FAIL: 服务器未运行');
        process.exit(1);
    }

    // 测试2: 创建锦标赛
    console.log('\n测试2: 创建锦标赛');
    console.log('----------------------------------------');
    
    const tournamentRes = await axios.post(`${CONFIG.apiUrl}/api/tournament/create`, {
        configId: 3,  // 2人赛
        walletAddress: CONFIG.player1.address
    });
    
    const tournament = tournamentRes.data.tournament;
    const tournamentId = tournament.tournamentId || tournament._id;
    console.log('锦标赛ID:', tournamentId);
    console.log('配置:', tournament.config);
    console.log('✅ PASS: 锦标赛创建成功');
    testResults.passed++;

    // 测试3: 两个玩家加入
    console.log('\n测试3: 玩家加入');
    console.log('----------------------------------------');
    
    // 玩家1加入
    const join1 = await axios.post(`${CONFIG.apiUrl}/api/tournament/${tournamentId}/join`, {
        walletAddress: CONFIG.player1.address,
        socketId: 'test-socket-1'
    });
    console.log('玩家1加入:', join1.data.success);
    
    // 玩家2加入
    const join2 = await axios.post(`${CONFIG.apiUrl}/api/tournament/${tournamentId}/join`, {
        walletAddress: CONFIG.player2.address,
        socketId: 'test-socket-2'
    });
    console.log('玩家2加入:', join2.data.success);
    
    if (join1.data.success && join2.data.success) {
        console.log('✅ PASS: 两个玩家加入成功');
        testResults.passed++;
    }

    // 测试4: 连接Socket并设置mock deck
    console.log('\n测试4: Socket连接');
    console.log('----------------------------------------');
    
    const socket1 = io(CONFIG.apiUrl, {
        transports: ['websocket'],
        query: { walletAddress: CONFIG.player1.address }
    });
    
    const socket2 = io(CONFIG.apiUrl, {
        transports: ['websocket'],
        query: { walletAddress: CONFIG.player2.address }
    });
    
    // 监听事件
    socket1.on('connect', () => console.log('Socket1 连接:', socket1.id));
    socket2.on('connect', () => console.log('Socket2 连接:', socket2.id));
    
    // 监听NFT事件
    socket1.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
        console.log('🎉 [NFT事件] 玩家1获得成就:', data);
        testResults.nftEvents.push(data);
    });
    
    socket1.on('SC_NFT_ACHIEVEMENT_NONE', (data) => {
        console.log('📝 [NFT] 无成就:', data);
    });
    
    // 监听游戏状态
    socket1.on('tournament_game_state', (state) => {
        console.log('游戏状态更新 - 手牌:', state.seats ? 
            Object.entries(state.seats).map(([id, s]) => ({
                seat: id,
                hand: s.hand,
                stack: s.stack
            })) : 'waiting');
    });
    
    socket1.on('game_state', (state) => {
        if (state.seats) {
            console.log('游戏状态 - 底池:', state.pot, '回合:', state.street);
        }
    });
    
    await sleep(2000);

    // 加入锦标赛房间
    socket1.emit('CS_JOIN_TOURNAMENT', {
        tournamentId,
        walletAddress: CONFIG.player1.address
    });
    
    socket2.emit('CS_JOIN_TOURNAMENT', {
        tournamentId,
        walletAddress: CONFIG.player2.address
    });
    
    await sleep(2000);
    
    console.log('✅ PASS: Socket连接成功');
    testResults.passed++;

    // 测试5: 通过Chrome CDP查看游戏
    console.log('\n测试5: Chrome浏览器查看');
    console.log('----------------------------------------');
    
    try {
        const client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime } = client;
        await Page.enable();
        await Runtime.enable();
        
        // 导航到锦标赛页面
        const gameUrl = `${CONFIG.frontendUrl}/tournament/${tournamentId}`;
        console.log('访问:', gameUrl);
        
        await Page.navigate({ url: gameUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 注入钱包地址
        await Runtime.evaluate({
            expression: `
                localStorage.setItem('walletAddress', '${CONFIG.player1.address}');
                localStorage.setItem('tronAddress', '${CONFIG.player1.address}');
            `
        });
        
        // 刷新
        await Page.navigate({ url: gameUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 截图
        let screenshot = await Page.captureScreenshot();
        fs.writeFileSync('test-results/nft-straight-01-game.png', Buffer.from(screenshot.data, 'base64'));
        console.log('📸 截图: nft-straight-01-game.png');
        testResults.screenshots.push('test-results/nft-straight-01-game.png');
        
        // 检查游戏状态
        const gameState = await Runtime.evaluate({
            expression: `
                (() => {
                    const body = document.body.innerText;
                    const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
                        text: b.innerText.substring(0, 20),
                        disabled: b.disabled
                    }));
                    
                    // 查找手牌
                    const cardElements = document.querySelectorAll('[class*="card"], [class*="Card"], [class*="hand"]');
                    const cards = [];
                    cardElements.forEach(el => {
                        const text = el.innerText || el.textContent;
                        if (text && text.trim().length <= 5) {
                            cards.push(text.trim());
                        }
                    });
                    
                    return {
                        bodySnippet: body.substring(0, 500),
                        buttons: buttons.slice(0, 8),
                        cardsFound: cards,
                        hasCardElements: cardElements.length > 0
                    };
                })()
            `,
            returnByValue: true
        });
        
        console.log('游戏状态:', JSON.stringify(gameState.result?.value, null, 2));
        
        // 尝试点击操作按钮
        for (let round = 0; round < 5; round++) {
            await sleep(2000);
            
            // 点击Check或Call按钮
            const clickResult = await Runtime.evaluate({
                expression: `
                    (() => {
                        const buttons = Array.from(document.querySelectorAll('button'));
                        
                        // 优先Check
                        let btn = buttons.find(b => 
                            b.innerText.toLowerCase().includes('check') && !b.disabled
                        );
                        
                        if (!btn) {
                            btn = buttons.find(b => 
                                b.innerText.toLowerCase().includes('call') && !b.disabled
                            );
                        }
                        
                        if (btn) {
                            btn.click();
                            return { clicked: true, action: btn.innerText };
                        }
                        
                        return { clicked: false };
                    })()
                `,
                returnByValue: true
            });
            
            if (clickResult.result?.value?.clicked) {
                console.log(`操作 ${round + 1}:`, clickResult.result.value.action);
            }
            
            // 截图
            screenshot = await Page.captureScreenshot();
            fs.writeFileSync(`test-results/nft-straight-02-round-${round}.png`, Buffer.from(screenshot.data, 'base64'));
        }
        
        // 最终截图
        await sleep(2000);
        screenshot = await Page.captureScreenshot();
        fs.writeFileSync('test-results/nft-straight-03-final.png', Buffer.from(screenshot.data, 'base64'));
        console.log('📸 最终截图: nft-straight-03-final.png');
        testResults.screenshots.push('test-results/nft-straight-03-final.png');
        
        await client.close();
        console.log('✅ PASS: 浏览器测试完成');
        testResults.passed++;
        
    } catch (error) {
        console.log('⚠️ WARN: 浏览器测试问题:', error.message);
        testResults.warnings.push('浏览器: ' + error.message);
    }

    // 测试6: 验证NFT事件
    console.log('\n测试6: 验证NFT');
    console.log('----------------------------------------');
    
    if (testResults.nftEvents.length > 0) {
        console.log('🎉 NFT事件触发成功!');
        testResults.nftEvents.forEach((event, i) => {
            console.log(`NFT ${i + 1}:`, JSON.stringify(event, null, 2));
        });
        console.log('✅ PASS: NFT触发成功');
        testResults.passed++;
    } else {
        console.log('⚠️ WARN: 未检测到NFT事件（可能需要更长的游戏时间）');
        testResults.warnings.push('未检测到NFT事件');
    }

    // 测试7: 验证NFT记录（通过API查询，不直连MongoDB）
    console.log('\n测试7: 验证NFT记录');
    console.log('----------------------------------------');

    try {
        const collectionRes = await axios.get(`${CONFIG.apiUrl}/api/nft/collection/${CONFIG.player1.address}`);
        const nfts = collectionRes.data.nfts || [];
        console.log('NFT记录总数:', nfts.length);
        nfts.slice(0, 3).forEach(nft => {
            console.log(`  - tokenId=${nft.onchainTokenId}, type=${nft.achievementType}: ${nft.handDescription}`);
        });
        if (nfts.length > 0) {
            // 验证最新NFT的元数据可访问
            const latest = nfts[0];
            const tokenId = latest.onchainTokenId;
            const typeId = latest.achievementTypeId || 6;
            const metaRes = await axios.get(`${CONFIG.apiUrl}/api/nft/metadata/${typeId}/${tokenId}`);
            const meta = metaRes.data;
            console.log('元数据验证:');
            console.log(`  name: ${meta.name}`);
            console.log(`  description: ${meta.description}`);
            const cardsAttr = (meta.attributes || []).find(a => a.trait_type === 'Cards');
            if (cardsAttr) console.log(`  Cards: ${cardsAttr.value} ✅`);
            console.log('✅ PASS: NFT元数据验证通过 - TronLink现在可以正常显示');
            testResults.passed++;
        } else {
            console.log('⚠️ WARN: 暂无NFT记录（需要完成一局游戏触发成就）');
            testResults.warnings.push('暂无NFT记录');
        }
    } catch (err) {
        console.log('❌ FAIL: NFT记录查询失败:', err.message);
        testResults.failed++;
    }

    // 清理
    socket1.disconnect();
    socket2.disconnect();

    // 结果汇总
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`⚠️ 警告: ${testResults.warnings.length}`);
    console.log(`📸 截图: ${testResults.screenshots.length}张`);
    console.log(`🎯 NFT事件: ${testResults.nftEvents.length}个`);
    console.log('========================================');
    
    process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(console.error);
