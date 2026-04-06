/**
 * 完整NFT锻造流程（含自动点击锻造按钮和签名）
 * 1. 创建Mock锦标赛
 * 2. 启动机器人
 * 3. CDP控制浏览器加入游戏
 * 4. 完成游戏获得顺子成就
 * 5. 自动点击"铸造 NFT"按钮
 * 6. 等待并自动签名
 * 7. 验证NFT上链成功
 */

const CDP = require('chrome-remote-interface');
const http = require('http');
const { spawn, execSync } = require('child_process');
const fs = require('fs');

const CONFIG = {
    frontend: 'http://127.0.0.1:3001',
    backend: 'http://127.0.0.1:7778',
    cdpPort: 9222,
    playerAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    nftContract: 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC',
    testResultsDir: './test-results',
    // TronLink签名坐标
    tronlinkIconX: 1238,
    tronlinkIconY: 50,
    signBtnX: 1414,
    signBtnY: 635
};

function log(msg) {
    console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// HTTP请求
function httpRequest(options, postData = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (postData) req.write(postData);
        req.end();
    });
}

async function takeScreenshot(Page, filename) {
    try {
        const { data } = await Page.captureScreenshot();
        fs.writeFileSync(`${CONFIG.testResultsDir}/${filename}`, Buffer.from(data, 'base64'));
        log(`📸 截图: ${filename}`);
    } catch (error) {
        log(`截图失败: ${error.message}`);
    }
}

// 创建锦标赛
async function createTournament() {
    log('创建Mock锦标赛...');
    
    const postData = JSON.stringify({
        configId: 3,
        mockGame: true
    });
    
    const result = await httpRequest({
        hostname: '127.0.0.1',
        port: 7778,
        path: '/api/tournament/create',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'x-wallet-address': CONFIG.playerAddress
        }
    }, postData);
    
    const tournament = result.tournament || result;
    const tournamentId = tournament.tournamentId || tournament._id || tournament.id;
    
    log(`锦标赛ID: ${tournamentId}`);
    return tournamentId;
}

// 启动机器人
function startBot(tournamentId) {
    log(`启动机器人加入锦标赛 ${tournamentId}...`);
    
    const bot = spawn('node', ['scripts/game-bot.js'], {
        env: { ...process.env, TOURNAMENT_ID: tournamentId },
        stdio: ['ignore', 'pipe', 'pipe']
    });
    
    bot.stdout.on('data', (data) => {
        log(`[BOT] ${data.toString().trim()}`);
    });
    
    return bot;
}

// 主流程
async function main() {
    let client;
    let bot;
    
    try {
        if (!fs.existsSync(CONFIG.testResultsDir)) {
            fs.mkdirSync(CONFIG.testResultsDir, { recursive: true });
        }
        
        log('========================================');
        log('  完整NFT锻造流程');
        log('========================================');
        
        // 1. 连接CDP
        log('连接Chrome CDP...');
        client = await CDP({ port: CONFIG.cdpPort });
        const { Page, Runtime } = client;
        await Page.enable();
        await Runtime.enable();
        
        // 2. 创建锦标赛
        const tournamentId = await createTournament();
        await sleep(2000);
        
        // 3. 启动机器人
        bot = startBot(tournamentId);
        await sleep(3000);
        
        // 4. 导航到锦标赛页面
        log('导航到锦标赛页面...');
        await Page.navigate({ url: `${CONFIG.frontend}/tournament` });
        await Page.loadEventFired();
        await sleep(3000);
        await takeScreenshot(Page, 'nft-complete-01-tournament.png');
        
        // 5. 点击锦标赛卡片
        log('查找并点击锦标赛卡片...');
        const cardClicked = await Runtime.evaluate({
            expression: `(function() {
                const cards = document.querySelectorAll('.sc-bypJrT, [class*="Card"]');
                for (const card of cards) {
                    if (card.innerText && (card.innerText.includes('1 / 2') || card.innerText.includes('1/2'))) {
                        card.click();
                        return 'clicked';
                    }
                }
                return 'not found';
            })()`,
            returnByValue: true
        });
        
        if (cardClicked.result.value === 'clicked') {
            log('✓ 点击锦标赛卡片');
            await sleep(2000);
            await takeScreenshot(Page, 'nft-complete-02-card-clicked.png');
            
            // 6. 点击Confirm按钮
            log('点击Confirm按钮...');
            await Runtime.evaluate({
                expression: `(function() {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.trim() === 'Confirm') {
                            btn.click();
                            return 'confirm clicked';
                        }
                    }
                    return 'not found';
                })()`,
                returnByValue: true
            });
            
            await sleep(3000);
            await takeScreenshot(Page, 'nft-complete-03-game-started.png');
            
            // 7. 游戏操作
            log('开始游戏操作...');
            let round = 1;
            let gameEnded = false;
            
            while (!gameEnded && round <= 20) {
                log(`--- 回合 ${round} ---`);
                await sleep(2000);
                
                // 获取可用按钮
                const buttonsResult = await Runtime.evaluate({
                    expression: `(function() {
                        return JSON.stringify(
                            Array.from(document.querySelectorAll('button'))
                                .filter(b => !b.disabled)
                                .map(b => b.textContent.trim())
                        );
                    })()`,
                    returnByValue: true
                });
                
                const buttons = JSON.parse(buttonsResult.result.value || '[]');
                log(`可用按钮: ${buttons.join(', ')}`);
                
                // 执行操作
                if (buttons.includes('Check')) {
                    await Runtime.evaluate({
                        expression: `(function() {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                if (btn.textContent.trim() === 'Check') {
                                    btn.click();
                                    return true;
                                }
                            }
                        })()`
                    });
                    log('✓ Check');
                } else if (buttons.includes('Call')) {
                    await Runtime.evaluate({
                        expression: `(function() {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                if (btn.textContent.trim() === 'Call') {
                                    btn.click();
                                    return true;
                                }
                            }
                        })()`
                    });
                    log('✓ Call');
                } else if (buttons.includes('Fold')) {
                    await Runtime.evaluate({
                        expression: `(function() {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                if (btn.textContent.trim() === 'Fold') {
                                    btn.click();
                                    return true;
                                }
                            }
                        })()`
                    });
                    log('✓ Fold');
                    gameEnded = true;
                }
                
                await takeScreenshot(Page, `nft-complete-round-${round}.png`);
                
                // 检查游戏是否结束
                const endCheck = await Runtime.evaluate({
                    expression: `(function() {
                        const winner = document.querySelector('[class*="winner"], [class*="Winner"]');
                        const gameOver = document.querySelector('[class*="game-over"], [class*="GameOver"]');
                        const champion = document.body.innerText.includes('Champion');
                        return winner || gameOver || champion ? 'ended' : 'continue';
                    })()`,
                    returnByValue: true
                });
                
                if (endCheck.result.value === 'ended') {
                    log('游戏结束！');
                    gameEnded = true;
                }
                
                round++;
            }
            
            // 8. 等待NFT成就弹窗
            log('等待NFT成就弹窗...');
            await sleep(3000);
            await takeScreenshot(Page, 'nft-complete-04-game-ended.png');
            
            // 9. 查找并点击"铸造 NFT"按钮
            log('查找"铸造 NFT"按钮...');
            let mintButtonFound = false;
            
            for (let i = 0; i < 10; i++) {
                const mintResult = await Runtime.evaluate({
                    expression: `(function() {
                        // 查找所有按钮
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            const text = btn.textContent.trim();
                            if (text.includes('铸造') || text.includes('NFT') || text.includes('Mint')) {
                                if (!btn.disabled) {
                                    btn.click();
                                    return { clicked: true, text: text };
                                }
                            }
                        }
                        
                        // 查找SweetAlert弹窗中的按钮
                        const swalButtons = document.querySelectorAll('.swal2-confirm, .swal2-button');
                        for (const btn of swalButtons) {
                            const text = btn.textContent.trim();
                            if (text.includes('铸造') || text.includes('NFT') || text.includes('确认')) {
                                if (!btn.disabled) {
                                    btn.click();
                                    return { clicked: true, text: text };
                                }
                            }
                        }
                        
                        return { clicked: false };
                    })()`,
                    returnByValue: true
                });
                
                const result = mintResult.result.value;
                if (result && result.clicked) {
                    log(`✓ 已点击按钮: ${result.text}`);
                    mintButtonFound = true;
                    break;
                }
                
                await sleep(1000);
            }
            
            await sleep(2000);
            await takeScreenshot(Page, 'nft-complete-05-mint-clicked.png');
            
            if (mintButtonFound) {
                // 10. 等待TronLink签名窗口
                log('等待TronLink签名请求...');
                await sleep(5000);
                
                await takeScreenshot(Page, 'nft-complete-06-before-sign.png');
                
                // 11. 点击TronLink图标和签名按钮
                log('执行签名操作...');
                try {
                    // 点击TronLink图标
                    execSync(`cliclick c:${CONFIG.tronlinkIconX},${CONFIG.tronlinkIconY}`);
                    await sleep(2000);
                    
                    // 点击签名按钮（多次点击）
                    execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                    await sleep(1000);
                    execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                    await sleep(1000);
                    execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                    
                    log('✓ 已点击签名按钮');
                } catch (error) {
                    log(`签名操作失败: ${error.message}`);
                }
                
                // 12. 等待交易确认
                log('等待交易确认 (15秒)...');
                await sleep(15000);
                
                await takeScreenshot(Page, 'nft-complete-07-final.png');
                
                // 13. 验证NFT
                log('验证NFT锻造结果...');
                
                // 导航到NFT页面
                await Page.navigate({ url: `${CONFIG.frontend}/nft` });
                await Page.loadEventFired();
                await sleep(3000);
                
                const nftCheck = await Runtime.evaluate({
                    expression: `(function() {
                        const body = document.body.innerText;
                        const count = (body.match(/Straight/g) || []).length;
                        const hasLatest = body.includes('Apr 7') || body.includes('刚刚');
                        return JSON.stringify({
                            nftCount: count,
                            hasLatest: hasLatest,
                            preview: body.substring(0, 500)
                        });
                    })()`,
                    returnByValue: true
                });
                
                const nftInfo = JSON.parse(nftCheck.result.value || '{}');
                log(`NFT页面显示: ${nftInfo.nftCount} 个Straight, 最新: ${nftInfo.hasLatest}`);
                
                await takeScreenshot(Page, 'nft-complete-08-nft-page.png');
            }
            
        } else {
            log('❌ 未找到锦标赛卡片');
        }
        
        log('========================================');
        log('流程完成');
        log(`NFT合约: https://nile.tronscan.org/#/token20/${CONFIG.nftContract}`);
        log(`钱包地址: https://nile.tronscan.org/#/address/${CONFIG.playerAddress}`);
        log('========================================');
        
    } catch (error) {
        log(`❌ 错误: ${error.message}`);
        console.error(error);
    } finally {
        if (client) {
            await client.close();
        }
        if (bot) {
            bot.kill();
        }
    }
}

main().catch(console.error);
