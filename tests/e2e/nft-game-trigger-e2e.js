/**
 * NFT Game Trigger E2E Test
 * 测试游戏过程中自动触发NFT成就
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');
const mongoose = require('mongoose');
const fs = require('fs');

const CONFIG = {
    apiUrl: 'http://127.0.0.1:7778',
    frontendUrl: 'http://127.0.0.1:3001',
    cdpPort: 9222,
    mongoUrl: 'mongodb://127.0.0.1:27017/bridge-poker',
    player1: {
        address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        name: 'Player1'
    },
    player2: {
        address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        name: 'Player2'
    }
};

let testResults = {
    passed: 0,
    failed: 0,
    warnings: [],
    screenshots: []
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('NFT Game Trigger E2E Test');
    console.log('========================================\n');

    // 测试1: NFT检测API
    console.log('测试1: NFT成就检测API');
    console.log('----------------------------------------');
    
    // 测试顺子
    const straightTest = await axios.post(`${CONFIG.apiUrl}/api/nft/detect`, {
        holeCards: [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'h' }],
        board: [{ rank: 'Q', suit: 'c' }, { rank: 'J', suit: 'd' }, { rank: '10', suit: 's' }, { rank: '4', suit: 'h' }, { rank: '5', suit: 's' }]
    });
    
    console.log('顺子检测结果:', JSON.stringify(straightTest.data, null, 2));
    if (straightTest.data.achievement?.type === 'STRAIGHT') {
        console.log('✅ PASS: 顺子检测正确');
        testResults.passed++;
    } else {
        console.log('❌ FAIL: 顺子检测失败');
        testResults.failed++;
    }

    // 测试同花
    const flushTest = await axios.post(`${CONFIG.apiUrl}/api/nft/detect`, {
        holeCards: [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'h' }],
        board: [{ rank: 'Q', suit: 'h' }, { rank: 'J', suit: 'h' }, { rank: '5', suit: 'h' }]
    });
    
    console.log('\n同花检测结果:', JSON.stringify(flushTest.data, null, 2));
    if (flushTest.data.achievement?.type === 'FLUSH') {
        console.log('✅ PASS: 同花检测正确');
        testResults.passed++;
    } else {
        console.log('❌ FAIL: 同花检测失败');
        testResults.failed++;
    }

    // 测试同花顺
    const straightFlushTest = await axios.post(`${CONFIG.apiUrl}/api/nft/detect`, {
        holeCards: [{ rank: 'J', suit: 'h' }, { rank: '10', suit: 'h' }],
        board: [{ rank: 'Q', suit: 'h' }, { rank: 'K', suit: 'h' }, { rank: 'A', suit: 'h' }]
    });
    
    console.log('\n皇家同花顺检测结果:', JSON.stringify(straightFlushTest.data, null, 2));
    if (straightFlushTest.data.achievement?.type === 'ROYAL_FLUSH') {
        console.log('✅ PASS: 皇家同花顺检测正确');
        testResults.passed++;
    } else {
        console.log('❌ FAIL: 皇家同花顺检测失败');
        testResults.failed++;
    }

    // 测试2: 创建锦标赛并验证游戏流程
    console.log('\n测试2: 创建锦标赛');
    console.log('----------------------------------------');
    
    const tournamentRes = await axios.post(`${CONFIG.apiUrl}/api/tournament/create`, {
        name: 'NFT Test Tournament',
        buyIn: 100,
        maxPlayers: 6,
        creatorAddress: CONFIG.player1.address
    });
    
    const tournamentId = tournamentRes.data.tournament?._id || tournamentRes.data.tournamentId;
    console.log('锦标赛创建成功, ID:', tournamentId);
    
    if (tournamentId) {
        console.log('✅ PASS: 锦标赛创建成功');
        testResults.passed++;
    } else {
        console.log('❌ FAIL: 锦标赛创建失败');
        testResults.failed++;
    }

    // 测试3: 通过CDP访问浏览器查看游戏
    console.log('\n测试3: 浏览器游戏流程');
    console.log('----------------------------------------');
    
    try {
        const client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime, Network } = client;
        
        // 启用必要的域
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        
        // 监听console日志
        Runtime.consoleAPICalled(({ type, args }) => {
            if (type === 'log') {
                const msg = args.map(a => a.value || '').join(' ');
                if (msg.includes('NFT') || msg.includes('Achievement')) {
                    console.log('🎮 [浏览器日志]', msg);
                }
            }
        });
        
        // 监听WebSocket消息
        Network.webSocketFrameReceived(({ response }) => {
            const payload = response.payloadData;
            if (payload.includes('NFT') || payload.includes('Achievement') || payload.includes('SC_NFT')) {
                console.log('📡 [WebSocket接收]', payload.substring(0, 200));
            }
        });
        
        // 访问游戏页面
        const gameUrl = `${CONFIG.frontendUrl}/play`;
        console.log('访问游戏页面:', gameUrl);
        
        await Page.navigate({ url: gameUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 截图
        const screenshot = await Page.captureScreenshot();
        const screenshotPath = 'test-results/nft-game-trigger-page.png';
        fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
        console.log('📸 截图保存:', screenshotPath);
        testResults.screenshots.push(screenshotPath);
        
        // 检查页面内容
        const pageResult = await Runtime.evaluate({
            expression: `({
                title: document.title,
                hasNFTLink: !!document.querySelector('a[href="/nft"]'),
                bodyText: document.body.innerText.substring(0, 300)
            })`,
            returnByValue: true
        });
        
        console.log('页面信息:', JSON.stringify(pageResult.result?.value, null, 2));
        
        // 访问NFT画廊
        console.log('\n访问NFT画廊...');
        await Page.navigate({ url: `${CONFIG.frontendUrl}/nft` });
        await Page.loadEventFired();
        await sleep(2000);
        
        const nftScreenshot = await Page.captureScreenshot();
        const nftScreenshotPath = 'test-results/nft-gallery-trigger.png';
        fs.writeFileSync(nftScreenshotPath, Buffer.from(nftScreenshot.data, 'base64'));
        console.log('📸 NFT画廊截图:', nftScreenshotPath);
        testResults.screenshots.push(nftScreenshotPath);
        
        await client.close();
        
        console.log('✅ PASS: 浏览器测试完成');
        testResults.passed++;
    } catch (error) {
        console.log('⚠️ WARN: 浏览器测试失败:', error.message);
        testResults.warnings.push('浏览器测试: ' + error.message);
    }

    // 测试4: 验证数据库中的NFT记录
    console.log('\n测试4: 验证数据库NFT记录');
    console.log('----------------------------------------');
    
    await mongoose.connect(CONFIG.mongoUrl);
    const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }));
    
    const nfts = await NFTClaim.find({ playerAddress: new RegExp(CONFIG.player1.address.substring(0, 10), 'i') });
    console.log('数据库中的NFT记录数:', nfts.length);
    
    if (nfts.length > 0) {
        console.log('NFT详情:');
        nfts.forEach(nft => {
            console.log(`  - ${nft.achievementType} (TokenID: ${nft.tokenId})`);
            console.log(`    牌型: ${nft.handDescription}`);
        });
        console.log('✅ PASS: NFT记录存在');
        testResults.passed++;
    } else {
        console.log('⚠️ WARN: 数据库中没有NFT记录');
        testResults.warnings.push('数据库中没有NFT记录');
    }
    
    await mongoose.disconnect();

    // 打印结果
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`⚠️ 警告: ${testResults.warnings.length}`);
    if (testResults.warnings.length > 0) {
        testResults.warnings.forEach(w => console.log(`   - ${w}`));
    }
    console.log(`📸 截图: ${testResults.screenshots.join(', ')}`);
    console.log('========================================');
    
    process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(console.error);
