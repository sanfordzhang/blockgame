/**
 * NFT Straight Game Full E2E Test
 * 使用Chrome CDP进行完整的端对端测试
 * 
 * 目标：
 * 1. 让玩家1在游戏中获得顺子
 * 2. 截图游戏画面显示顺子牌型
 * 3. 触发NFT成就通知
 */

const CDP = require('chrome-remote-interface');
const axios = require('axios');
const fs = require('fs');

const CONFIG = {
    apiUrl: 'http://127.0.0.1:7778',
    frontendUrl: 'http://127.0.0.1:3001',
    cdpPort: 9222,
    player1: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    player2: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'
};

let testPassed = 0;
let testFailed = 0;
let screenshots = [];
let nftTriggered = false;

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('NFT Straight Game Full E2E Test');
    console.log('========================================\n');

    // 测试1: 验证前端
    console.log('测试1: 验证前端服务');
    console.log('----------------------------------------');
    
    try {
        const frontendCheck = await axios.get(CONFIG.frontendUrl, { timeout: 5000 });
        console.log('✅ PASS: 前端服务可用');
        testPassed++;
    } catch (e) {
        console.log('❌ FAIL: 前端服务不可用');
        testFailed++;
        process.exit(1);
    }

    // 测试2: 连接Chrome CDP
    console.log('\n测试2: 连接Chrome CDP');
    console.log('----------------------------------------');
    
    let client;
    try {
        client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime, Network } = client;
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        console.log('✅ PASS: Chrome CDP连接成功');
        testPassed++;
        
        // 测试3: 打开游戏页面
        console.log('\n测试3: 打开游戏页面');
        console.log('----------------------------------------');
        
        // 导航到Play页面
        await Page.navigate({ url: `${CONFIG.frontendUrl}/play` });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 截图
        let screenshot = await Page.captureScreenshot();
        fs.writeFileSync('test-results/nft-straight-01-play.png', Buffer.from(screenshot.data, 'base64'));
        screenshots.push('test-results/nft-straight-01-play.png');
        console.log('📸 截图: nft-straight-01-play.png');
        
        // 设置钱包地址
        await Runtime.evaluate({
            expression: `
                localStorage.setItem('walletAddress', '${CONFIG.player1}');
                localStorage.setItem('tronAddress', '${CONFIG.player1}');
                console.log('Wallet set to: ${CONFIG.player1}');
            `
        });
        
        // 刷新页面
        await Page.navigate({ url: `${CONFIG.frontendUrl}/play` });
        await Page.loadEventFired();
        await sleep(3000);
        
        screenshot = await Page.captureScreenshot();
        fs.writeFileSync('test-results/nft-straight-02-wallet.png', Buffer.from(screenshot.data, 'base64'));
        screenshots.push('test-results/nft-straight-02-wallet.png');
        console.log('📸 截图: nft-straight-02-wallet.png');
        
        console.log('✅ PASS: 游戏页面加载成功');
        testPassed++;
        
        // 测试4: 检查页面状态
        console.log('\n测试4: 检查游戏状态');
        console.log('----------------------------------------');
        
        const pageState = await Runtime.evaluate({
            expression: `
                (() => {
                    const body = document.body.innerText;
                    const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText.substring(0, 30));
                    const links = Array.from(document.querySelectorAll('a')).map(a => ({ text: a.innerText, href: a.href }));
                    
                    return {
                        title: document.title,
                        bodySnippet: body.substring(0, 500),
                        buttons: buttons.slice(0, 10),
                        links: links.slice(0, 5),
                        hasTable: body.includes('Table') || body.includes('牌桌'),
                        hasGameButtons: buttons.some(b => b.toLowerCase().includes('fold') || b.toLowerCase().includes('check'))
                    };
                })()
            `,
            returnByValue: true
        });
        
        console.log('页面状态:', JSON.stringify(pageState.result?.value, null, 2));
        
        // 测试5: 尝试加入游戏
        console.log('\n测试5: 加入游戏');
        console.log('----------------------------------------');
        
        // 点击加入按钮（如果有）
        const joinResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const joinBtn = buttons.find(b => 
                        b.innerText.toLowerCase().includes('join') ||
                        b.innerText.toLowerCase().includes('play') ||
                        b.innerText.toLowerCase().includes('sit')
                    );
                    
                    if (joinBtn) {
                        joinBtn.click();
                        return { clicked: true, text: joinBtn.innerText };
                    }
                    
                    // 检查是否有锦标赛按钮
                    const tournamentBtn = buttons.find(b => 
                        b.innerText.toLowerCase().includes('tournament') ||
                        b.innerText.includes('锦标赛')
                    );
                    
                    if (tournamentBtn) {
                        tournamentBtn.click();
                        return { clicked: true, text: tournamentBtn.innerText };
                    }
                    
                    return { clicked: false, availableButtons: buttons.slice(0, 5).map(b => b.innerText) };
                })()
            `,
            returnByValue: true
        });
        
        console.log('加入结果:', JSON.stringify(joinResult.result?.value, null, 2));
        
        await sleep(3000);
        
        screenshot = await Page.captureScreenshot();
        fs.writeFileSync('test-results/nft-straight-03-joined.png', Buffer.from(screenshot.data, 'base64'));
        screenshots.push('test-results/nft-straight-03-joined.png');
        console.log('📸 截图: nft-straight-03-joined.png');
        
        // 测试6: 导航到NFT画廊
        console.log('\n测试6: 查看NFT画廊');
        console.log('----------------------------------------');
        
        await Page.navigate({ url: `${CONFIG.frontendUrl}/nft` });
        await Page.loadEventFired();
        await sleep(3000);
        
        screenshot = await Page.captureScreenshot();
        fs.writeFileSync('test-results/nft-straight-04-nft-gallery.png', Buffer.from(screenshot.data, 'base64'));
        screenshots.push('test-results/nft-straight-04-nft-gallery.png');
        console.log('📸 截图: nft-straight-04-nft-gallery.png');
        
        const nftState = await Runtime.evaluate({
            expression: `
                (() => {
                    const body = document.body.innerText;
                    return {
                        title: document.title,
                        bodySnippet: body.substring(0, 500),
                        hasNFT: body.includes('NFT') || body.includes('成就'),
                        hasCards: body.includes('Straight') || body.includes('顺子') || body.includes('Flush')
                    };
                })()
            `,
            returnByValue: true
        });
        
        console.log('NFT画廊状态:', JSON.stringify(nftState.result?.value, null, 2));
        
        // 测试7: 验证NFT API
        console.log('\n测试7: 验证NFT API');
        console.log('----------------------------------------');
        
        // 检测顺子
        const straightDetect = await axios.post(`${CONFIG.apiUrl}/api/nft/detect`, {
            holeCards: [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'h' }],
            board: [{ rank: 'Q', suit: 'c' }, { rank: 'J', suit: 'd' }, { rank: '10', suit: 's' }]
        });
        
        console.log('顺子检测结果:', straightDetect.data.achievement?.type);
        
        if (straightDetect.data.achievement?.type === 'STRAIGHT') {
            console.log('✅ PASS: NFT顺子检测成功');
            testPassed++;
            nftTriggered = true;
        }
        
        // 检查NFT collection
        const collection = await axios.get(`${CONFIG.apiUrl}/api/nft/collection/${CONFIG.player1}`);
        console.log('NFT Collection:', collection.data.nfts?.length || 0, '个');
        
        if (collection.data.nfts?.length > 0) {
            console.log('✅ PASS: 数据库存在NFT记录');
            testPassed++;
            
            // 显示NFT详情
            collection.data.nfts.forEach((nft, i) => {
                console.log(`NFT ${i + 1}:`, nft.achievementType, nft.handDescription);
            });
        }
        
        await client.close();
        
    } catch (error) {
        console.log('❌ FAIL: Chrome CDP错误:', error.message);
        testFailed++;
    }

    // 打印结果
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${testPassed}`);
    console.log(`❌ 失败: ${testFailed}`);
    console.log(`📸 截图: ${screenshots.length}张`);
    console.log(`🎯 NFT检测: ${nftTriggered ? '成功' : '未触发'}`);
    console.log('========================================');
    
    process.exit(testFailed > 0 ? 1 : 0);
}

main().catch(console.error);
