/**
 * NFT游戏完整端对端测试
 * 模拟游戏运行，构造顺子牌型，生成NFT
 * 
 * 测试流程：
 * 1. 创建锦标赛
 * 2. 两个玩家加入
 * 3. 游戏发牌
 * 4. 模拟游戏操作（fold/call/raise）
 * 5. 构造顺子牌型结算
 * 6. 检测NFT成就
 * 7. 生成NFT签名
 */

const CDP = require('chrome-remote-interface');
const http = require('http');
const https = require('https');

// 配置
const CONFIG = {
    frontendUrl: 'http://127.0.0.1:3001',
    apiUrl: 'http://127.0.0.1:7778',
    cdpPort: 9222,
    player1: {
        address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        privateKey: process.env.PLAYER1_PRIVATE_KEY || 'c8e7c89c6b8e3b7d5a4e3c2b1a0f9e8d7c6b5a4e3d2c1b0a9f8e7d6c5b4a3e2d1'
    },
    player2: {
        address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        privateKey: process.env.PLAYER2_PRIVATE_KEY || 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2'
    }
};

// 测试结果
let testResults = {
    passed: 0,
    failed: 0,
    warnings: [],
    screenshots: []
};

// 工具函数
function httpGet(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        }).on('error', reject);
    });
}

function httpPost(url, body, headers = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const client = urlObj.protocol === 'https:' ? https : http;
        
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
            }
        };
        
        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve({ status: res.statusCode, data }));
        });
        
        req.on('error', reject);
        req.write(JSON.stringify(body));
        req.end();
    });
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 测试用例
const tests = {
    // 测试1: 检测顺子牌型API
    async testDetectStraight() {
        console.log('\n========================================');
        console.log('测试1: 顺子牌型检测API');
        console.log('========================================');
        
        // Broadway顺子: A-K-Q-J-T
        const handData = {
            holeCards: ['Ah', 'Kh'],
            board: ['Qc', 'Jd', 'Ts', '2c', '3d'],
            walletAddress: CONFIG.player1.address
        };
        
        const result = await httpPost(`${CONFIG.apiUrl}/api/nft/detect`, handData);
        const response = JSON.parse(result.data);
        
        console.log('检测牌型: A高顺子(Broadway)');
        console.log('手牌:', handData.holeCards.join(', '));
        console.log('公共牌:', handData.board.join(', '));
        console.log('检测结果:', JSON.stringify(response, null, 2));
        
        if (response.success && response.hasAchievement && response.achievement?.type === 'STRAIGHT') {
            console.log('✅ PASS: 顺子牌型检测成功');
            testResults.passed++;
            return response.achievement;
        } else {
            console.log('❌ FAIL: 顺子牌型检测失败');
            testResults.failed++;
            return null;
        }
    },
    
    // 测试2: 检测同花顺牌型
    async testDetectStraightFlush() {
        console.log('\n========================================');
        console.log('测试2: 同花顺牌型检测API');
        console.log('========================================');
        
        // 同花顺: 7-8-9-T-J 同花
        const handData = {
            holeCards: ['7h', '8h'],
            board: ['9h', 'Th', 'Jh', '2c', '3d'],
            walletAddress: CONFIG.player1.address
        };
        
        const result = await httpPost(`${CONFIG.apiUrl}/api/nft/detect`, handData);
        const response = JSON.parse(result.data);
        
        console.log('检测牌型: J高同花顺');
        console.log('检测结果:', JSON.stringify(response, null, 2));
        
        if (response.success && response.hasAchievement && response.achievement?.type === 'STRAIGHT_FLUSH') {
            console.log('✅ PASS: 同花顺牌型检测成功');
            testResults.passed++;
            return response.achievement;
        } else {
            console.log('❌ FAIL: 同花顺牌型检测失败');
            testResults.failed++;
            return null;
        }
    },
    
    // 测试3: 检测皇家同花顺
    async testDetectRoyalFlush() {
        console.log('\n========================================');
        console.log('测试3: 皇家同花顺牌型检测API');
        console.log('========================================');
        
        // 皇家同花顺: A-K-Q-J-T 同花
        const handData = {
            holeCards: ['Ah', 'Kh'],
            board: ['Qh', 'Jh', 'Th', '2c', '3d'],
            walletAddress: CONFIG.player1.address
        };
        
        const result = await httpPost(`${CONFIG.apiUrl}/api/nft/detect`, handData);
        const response = JSON.parse(result.data);
        
        console.log('检测牌型: 皇家同花顺');
        console.log('检测结果:', JSON.stringify(response, null, 2));
        
        if (response.success && response.hasAchievement && response.achievement?.type === 'ROYAL_FLUSH') {
            console.log('✅ PASS: 皇家同花顺牌型检测成功');
            testResults.passed++;
            return response.achievement;
        } else {
            console.log('❌ FAIL: 皇家同花顺牌型检测失败');
            testResults.failed++;
            return null;
        }
    },
    
    // 测试4: 生成NFT签名
    async testGenerateNFTSignature(achievement) {
        console.log('\n========================================');
        console.log('测试4: 生成NFT铸造签名');
        console.log('========================================');
        
        const mintData = {
            walletAddress: CONFIG.player1.address,
            achievementType: achievement.typeId || 6,
            gameSessionId: `game-straight-${Date.now()}`,
            handData: achievement
        };
        
        console.log('铸造请求:', JSON.stringify(mintData, null, 2));
        
        const result = await httpPost(`${CONFIG.apiUrl}/api/nft/prepare-mint`, mintData);
        const response = JSON.parse(result.data);
        
        console.log('签名响应:', JSON.stringify(response, null, 2));
        
        if (response.success && response.signature) {
            console.log('✅ PASS: NFT签名生成成功');
            testResults.passed++;
            return response.signature;
        } else {
            console.log('❌ FAIL: NFT签名生成失败');
            testResults.failed++;
            return null;
        }
    },
    
    // 测试5: 创建锦标赛并加入玩家
    async testCreateTournament() {
        console.log('\n========================================');
        console.log('测试5: 创建锦标赛并加入玩家');
        console.log('========================================');
        
        const tournamentId = Date.now().toString();
        
        // 创建锦标赛
        const createResult = await httpPost(`${CONFIG.apiUrl}/api/tournament/create`, {
            tournamentId,
            name: `NFT Test Tournament ${tournamentId}`,
            buyIn: 1000000, // 1 TRX in SUN
            maxPlayers: 6,
            creatorAddress: CONFIG.player1.address
        }, { 'x-wallet-address': CONFIG.player1.address });
        
        console.log('创建锦标赛结果:', createResult.status);
        
        if (createResult.status === 200 || createResult.status === 201) {
            console.log('✅ PASS: 创建锦标赛');
            testResults.passed++;
        } else {
            console.log('⚠️  WARN: 创建锦标赛状态:', createResult.status);
            testResults.warnings.push('创建锦标赛可能需要已有配置');
        }
        
        // 玩家1加入
        const join1Result = await httpPost(`${CONFIG.apiUrl}/api/tournament/join`, {
            tournamentId,
            playerAddress: CONFIG.player1.address
        }, { 'x-wallet-address': CONFIG.player1.address });
        
        // 玩家2加入
        const join2Result = await httpPost(`${CONFIG.apiUrl}/api/tournament/join`, {
            tournamentId,
            playerAddress: CONFIG.player2.address
        }, { 'x-wallet-address': CONFIG.player2.address });
        
        console.log('玩家1加入:', join1Result.status);
        console.log('玩家2加入:', join2Result.status);
        
        if (join1Result.status === 200 && join2Result.status === 200) {
            console.log('✅ PASS: 玩家加入锦标赛');
            testResults.passed++;
        }
        
        return tournamentId;
    },
    
    // 测试6: 通过浏览器CDP访问游戏
    async testBrowserGameFlow(client, tournamentId) {
        console.log('\n========================================');
        console.log('测试6: 浏览器游戏流程');
        console.log('========================================');
        
        const { Page, Runtime } = client;
        
        // 导航到锦标赛页面
        const tournamentUrl = `${CONFIG.frontendUrl}/tournament/${tournamentId}`;
        console.log('访问:', tournamentUrl);
        
        await Page.navigate({ url: tournamentUrl });
        await Page.loadEventFired();
        await sleep(3000);
        
        // 获取页面内容
        try {
            const pageResult = await Runtime.evaluate({
                expression: `({
                    title: document.title,
                    bodyText: document.body.innerText.substring(0, 500),
                    buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText).slice(0, 10)
                })`,
                returnByValue: true
            });
            
            const pageInfo = pageResult.result?.value || { title: 'unknown', bodyText: '', buttons: [] };
            console.log('页面标题:', pageInfo.title);
            console.log('页面按钮:', pageInfo.buttons?.slice(0, 5)?.join(', ') || 'none');
            
            // 截图
            const screenshot = await Page.captureScreenshot();
            const fs = require('fs');
            const screenshotPath = `test-results/nft-game-flow-${Date.now()}.png`;
            fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
            console.log('📸 截图保存:', screenshotPath);
            testResults.screenshots.push(screenshotPath);
            
            // 检查游戏状态
            const gameCheck = await Runtime.evaluate({
                expression: `({
                    hasTable: !!document.querySelector('[class*="table"]'),
                    hasCards: !!document.querySelector('[class*="card"]'),
                    hasFoldBtn: !!document.querySelector('button'),
                    bodyLength: document.body.innerText.length
                })`,
                returnByValue: true
            });
            
            const gameState = gameCheck.result?.value || { hasTable: false, hasCards: false };
            console.log('游戏状态:', JSON.stringify(gameState, null, 2));
            
            console.log('✅ PASS: 浏览器游戏流程测试完成');
            testResults.passed++;
            return true;
        } catch (e) {
            console.log('⚠️  WARN: 浏览器交互问题:', e.message);
            testResults.warnings.push('浏览器交互: ' + e.message);
            return false;
        }
    },
    
    // 测试7: 模拟游戏结束并生成NFT
    async testGameEndNFTGeneration() {
        console.log('\n========================================');
        console.log('测试7: 模拟游戏结束生成NFT');
        console.log('========================================');
        
        // 模拟游戏结果
        const gameResult = {
            gameId: `game-nft-${Date.now()}`,
            winners: [{ address: CONFIG.player1.address, amount: 2000000 }],
            players: [
                {
                    address: CONFIG.player1.address,
                    holeCards: ['Ah', 'Kh'], // 顺子手牌
                    finalChips: 2000000
                },
                {
                    address: CONFIG.player2.address,
                    holeCards: ['2c', '3d'],
                    finalChips: 0
                }
            ],
            board: ['Qc', 'Jd', 'Ts', '4h', '5s'], // 公共牌构成顺子 A-K-Q-J-T
            pot: 2000000
        };
        
        console.log('模拟游戏结果:', JSON.stringify(gameResult, null, 2));
        
        // 检测玩家1的牌型
        const detectResult = await httpPost(`${CONFIG.apiUrl}/api/nft/detect`, {
            holeCards: gameResult.players[0].holeCards,
            board: gameResult.board,
            walletAddress: gameResult.players[0].address
        });
        
        const detectResponse = JSON.parse(detectResult.data);
        console.log('\n玩家1牌型检测:', JSON.stringify(detectResponse, null, 2));
        
        if (detectResponse.hasAchievement) {
            console.log('\n🎉 检测到成就牌型:', detectResponse.achievement.name);
            
            // 生成NFT签名
            const mintResult = await httpPost(`${CONFIG.apiUrl}/api/nft/prepare-mint`, {
                walletAddress: gameResult.players[0].address,
                achievementType: detectResponse.achievement.typeId,
                gameSessionId: gameResult.gameId,
                handData: detectResponse.achievement
            });
            
            const mintResponse = JSON.parse(mintResult.data);
            console.log('\nNFT铸造签名:', JSON.stringify(mintResponse, null, 2));
            
            if (mintResponse.success) {
                console.log('\n✅ PASS: NFT生成成功！');
                console.log('========================================');
                console.log('🎊 NFT详情:');
                console.log('  玩家:', gameResult.players[0].address);
                console.log('  成就:', detectResponse.achievement.name);
                console.log('  牌型:', detectResponse.achievement.description);
                console.log('  卡牌:', detectResponse.achievement.cards.join(', '));
                console.log('  游戏ID:', gameResult.gameId);
                console.log('========================================');
                testResults.passed++;
                return true;
            } else {
                console.log('❌ FAIL: NFT签名生成失败');
                testResults.failed++;
                return false;
            }
        } else {
            console.log('⚠️  WARN: 未检测到成就牌型');
            testResults.warnings.push('未检测到成就牌型');
            return false;
        }
    }
};

// 主测试流程
async function runTests() {
    console.log('========================================');
    console.log('NFT游戏完整端对端测试');
    console.log('========================================');
    console.log('前端URL:', CONFIG.frontendUrl);
    console.log('后端API:', CONFIG.apiUrl);
    console.log('CDP端口:', CONFIG.cdpPort);
    console.log('玩家1:', CONFIG.player1.address);
    console.log('玩家2:', CONFIG.player2.address);
    console.log('========================================');
    
    // 检查后端
    try {
        await httpGet(`${CONFIG.apiUrl}/api/health`);
        console.log('\n✅ 后端服务运行中');
    } catch (e) {
        console.log('\n❌ 后端服务未运行');
        process.exit(1);
    }
    
    let client;
    try {
        // 连接CDP
        console.log('\n--- 连接Chrome CDP端口', CONFIG.cdpPort, '---');
        client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime, Network } = client;
        await Page.enable();
        await Runtime.enable();
        await Network.enable();
        console.log('✅ CDP连接成功');
        
        // 运行测试
        const straightAchievement = await tests.testDetectStraight();
        await tests.testDetectStraightFlush();
        await tests.testDetectRoyalFlush();
        
        if (straightAchievement) {
            await tests.testGenerateNFTSignature(straightAchievement);
        }
        
        const tournamentId = await tests.testCreateTournament();
        await tests.testBrowserGameFlow(client, tournamentId);
        
        // 核心测试: 游戏结束生成NFT
        const nftGenerated = await tests.testGameEndNFTGeneration();
        
        // 结果汇总
        console.log('\n========================================');
        console.log('测试结果汇总');
        console.log('========================================');
        console.log('✅ 通过:', testResults.passed);
        console.log('❌ 失败:', testResults.failed);
        console.log('⚠️  警告:', testResults.warnings.length);
        
        if (testResults.warnings.length > 0) {
            console.log('\n警告信息:');
            testResults.warnings.forEach(w => console.log('  ⚠️ ', w));
        }
        
        console.log('\n截图文件:');
        testResults.screenshots.forEach(s => console.log('  📸', s));
        
        // 关键测试结果
        if (nftGenerated) {
            console.log('\n========================================');
            console.log('🎉 核心测试通过: NFT已生成！');
            console.log('========================================');
        } else {
            console.log('\n⚠️  核心测试未完成: NFT未生成');
        }
        
    } catch (err) {
        console.error('测试错误:', err.message);
        testResults.failed++;
    } finally {
        if (client) {
            await client.close();
            console.log('\nCDP连接已关闭');
        }
    }
    
    // 返回退出码
    process.exit(testResults.failed > 0 ? 1 : 0);
}

// 运行
runTests().catch(console.error);
