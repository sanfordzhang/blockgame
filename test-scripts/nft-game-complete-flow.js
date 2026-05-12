/**
 * NFT锻造完整自动化流程
 * 按照docs/GAME_BOT_TEST_FLOW.md流程执行：
 * 1. 创建锦标赛（mock模式）
 * 2. 启动机器人
 * 3. CDP控制浏览器加入游戏
 * 4. 完成游戏操作
 * 5. 等待NFT成就触发
 * 6. 自动处理NFT锻造签名
 * 7. 验证NFT铸造成功
 */

const CDP = require('chrome-remote-interface');
const http = require('http');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// 配置
const CONFIG = {
    frontend: 'http://127.0.0.1:3001',
    backend: 'http://127.0.0.1:7778',
    cdpPort: 9222,
    playerAddress: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    botAddress: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
    nftContract: 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC',
    testResultsDir: './test-results',
    // TronLink签名按钮坐标（来自deposit-auto-final.sh）
    signBtnX: 1414,
    signBtnY: 635,
    tronlinkIconX: 1238,
    tronlinkIconY: 50,
    // TronLink窗口参数
    tlX: 1127,
    tlY: 34,
    tlW: 385,
    tlH: 953
};

// 工具函数
function log(message) {
    console.log(`[${new Date().toLocaleTimeString()}] ${message}`);
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

// 创建锦标赛
async function createTournament(mockGame = true) {
    log('创建锦标赛...');
    
    const postData = JSON.stringify({
        configId: 3, // 2人锦标赛
        mockGame: mockGame
    });
    
    const options = {
        hostname: '127.0.0.1',
        port: 7778,
        path: '/api/tournament/create',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData),
            'x-wallet-address': CONFIG.playerAddress
        }
    };
    
    const result = await httpRequest(options, postData);
    log(`锦标赛创建成功: ${JSON.stringify(result)}`);
    return result;
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
    
    bot.stderr.on('data', (data) => {
        log(`[BOT ERROR] ${data.toString().trim()}`);
    });
    
    return bot;
}

// CDP自动化
async function runCDPAutomation(client, tournamentId) {
    const { Page, Runtime, DOM } = client;
    
    // 启用必要的域
    await Page.enable();
    await Runtime.enable();
    await DOM.enable();
    
    // 导航到锦标赛页面
    log('导航到锦标赛页面...');
    await Page.navigate({ url: `${CONFIG.frontend}/tournament` });
    await Page.loadEventFired();
    await sleep(3000);
    
    // 截图
    await takeScreenshot(Page, '01-tournament-page.png');
    
    // 查找并点击锦标赛卡片
    log('查找锦标赛卡片...');
    const findTournamentCard = async () => {
        const result = await Runtime.evaluate({
            expression: `
                (() => {
                    const cards = document.querySelectorAll('.sc-bypJrT, [class*="TournamentCard"]');
                    for (const card of cards) {
                        if (card.innerText && (card.innerText.includes('1 / 2') || card.innerText.includes('1/2'))) {
                            card.click();
                            return 'clicked';
                        }
                    }
                    return 'not found';
                })()
            `
        });
        return result.result.value;
    };
    
    let clicked = await findTournamentCard();
    if (clicked !== 'clicked') {
        log('未找到锦标赛卡片，等待...');
        await sleep(2000);
        clicked = await findTournamentCard();
    }
    
    if (clicked === 'clicked') {
        log('点击锦标赛卡片成功');
        await sleep(2000);
        await takeScreenshot(Page, '02-tournament-selected.png');
        
        // 点击Confirm按钮
        log('点击Confirm按钮...');
        await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.trim() === 'Confirm') {
                            btn.click();
                            return 'confirm clicked';
                        }
                    }
                    return 'confirm not found';
                })()
            `
        });
        
        await sleep(3000);
        await takeScreenshot(Page, '03-game-started.png');
        
        return true;
    }
    
    return false;
}

// 游戏操作
async function playGame(client) {
    const { Page, Runtime } = client;
    
    log('开始游戏操作...');
    let round = 1;
    let gameEnded = false;
    let nftTriggered = false;
    
    // 监听控制台消息
    Runtime.consoleAPICalled(({ type, args }) => {
        const message = args.map(a => a.value).join(' ');
        if (message.includes('NFT') || message.includes('achievement')) {
            log(`🎮 控制台: ${message}`);
            if (message.includes('NFT') || message.includes('STRAIGHT')) {
                nftTriggered = true;
            }
        }
    });
    
    // 游戏循环
    while (!gameEnded && round <= 20) {
        log(`--- 回合 ${round} ---`);
        await sleep(2000);
        
        // 获取当前游戏状态
        const gameStateResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const state = window.__GAME_STATE__;
                    return state ? JSON.stringify({
                        turn: state.turn,
                        street: state.street,
                        pot: state.pot,
                        myTurn: state.myTurn
                    }) : null;
                })()
            `
        });
        
        const gameState = gameStateResult.result.value;
        if (gameState) {
            log(`游戏状态: ${gameState}`);
        }
        
        // 检查是否有可操作的按钮
        const buttonsResult = await Runtime.evaluate({
            expression: `
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'))
                        .filter(b => !b.disabled)
                        .map(b => b.textContent.trim());
                    return JSON.stringify(buttons);
                })()
            `
        });
        
        const buttons = JSON.parse(buttonsResult.result.value || '[]');
        log(`可用按钮: ${buttons.join(', ')}`);
        
        // 执行操作
        if (buttons.includes('Check')) {
            await clickButton(Runtime, 'Check');
            log('✓ 执行 Check');
        } else if (buttons.includes('Call')) {
            await clickButton(Runtime, 'Call');
            log('✓ 执行 Call');
        } else if (buttons.includes('Fold')) {
            await clickButton(Runtime, 'Fold');
            log('✓ 执行 Fold');
            gameEnded = true;
        }
        
        // 截图
        await takeScreenshot(Page, `round-${round}.png`);
        
        // 检查游戏是否结束
        const endCheck = await Runtime.evaluate({
            expression: `
                (() => {
                    const winner = document.querySelector('[class*="winner"], [class*="Winner"]');
                    const gameOver = document.querySelector('[class*="game-over"], [class*="GameOver"]');
                    return winner || gameOver ? 'ended' : 'continue';
                })()
            `
        });
        
        if (endCheck.result.value === 'ended') {
            log('游戏结束！');
            gameEnded = true;
        }
        
        round++;
    }
    
    return { gameEnded, nftTriggered };
}

// 点击按钮
async function clickButton(Runtime, buttonText) {
    await Runtime.evaluate({
        expression: `
            (() => {
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.trim() === '${buttonText}') {
                        btn.click();
                        return true;
                    }
                }
                return false;
            })()
        `
    });
}

// 截图
async function takeScreenshot(Page, filename) {
    const { data } = await Page.captureScreenshot();
    const filepath = path.join(CONFIG.testResultsDir, filename);
    fs.writeFileSync(filepath, Buffer.from(data, 'base64'));
    log(`📸 截图保存: ${filename}`);
}

// 监听NFT成就并自动签名
async function waitForNFTAndSign(client) {
    const { Page, Runtime } = client;
    
    log('等待NFT成就触发...');
    
    // 监听页面上的NFT成就弹窗
    for (let i = 0; i < 30; i++) {
        await sleep(2000);
        
        // 检查是否有NFT成就弹窗
        const nftPopup = await Runtime.evaluate({
            expression: `
                (() => {
                    // 检查NFT成就弹窗
                    const popup = document.querySelector('[class*="nft-achievement"], [class*="NFTAchievement"], [class*="achievement-popup"]');
                    if (popup) {
                        return {
                            found: true,
                            text: popup.innerText
                        };
                    }
                    
                    // 检查"准备锻造"按钮
                    const buttons = document.querySelectorAll('button');
                    for (const btn of buttons) {
                        if (btn.textContent.includes('锻造') || btn.textContent.includes('Mint') || btn.textContent.includes('铸造')) {
                            return {
                                found: true,
                                hasButton: true,
                                buttonText: btn.textContent
                            };
                        }
                    }
                    
                    return { found: false };
                })()
            `
        });
        
        const result = nftPopup.result.value;
        if (result && result.found) {
            log(`🎉 检测到NFT成就: ${JSON.stringify(result)}`);
            
            // 点击锻造按钮
            if (result.hasButton) {
                log('点击锻造按钮...');
                await Runtime.evaluate({
                    expression: `
                        (() => {
                            const buttons = document.querySelectorAll('button');
                            for (const btn of buttons) {
                                if (btn.textContent.includes('锻造') || btn.textContent.includes('Mint') || btn.textContent.includes('铸造')) {
                                    btn.click();
                                    return 'mint clicked';
                                }
                            }
                            return 'mint button not found';
                        })()
                    `
                });
                
                await sleep(3000);
                
                // 等待TronLink签名请求
                log('等待TronLink签名请求...');
                
                // 使用cliclick点击签名按钮
                const { execSync } = require('child_process');
                
                try {
                    // 先尝试点击TronLink图标打开窗口
                    execSync(`cliclick c:${CONFIG.tronlinkIconX},${CONFIG.tronlinkIconY}`);
                    await sleep(2000);
                    
                    // 点击签名按钮（多次点击确保成功）
                    log('点击签名按钮...');
                    execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                    await sleep(1000);
                    execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                    await sleep(1000);
                    execSync(`cliclick c:${CONFIG.signBtnX},${CONFIG.signBtnY}`);
                    
                    log('✅ 已点击签名按钮');
                    
                    // 等待交易确认
                    await sleep(5000);
                    
                    return true;
                } catch (error) {
                    log(`签名操作失败: ${error.message}`);
                }
            }
        }
        
        // 每5秒打印一次状态
        if (i % 3 === 0) {
            log(`等待NFT成就... (${i}/${30})`);
        }
    }
    
    return false;
}

// 验证NFT铸造
async function verifyNFTMinted(address) {
    log(`验证NFT铸造: ${address}`);
    
    // 1. 查询数据库
    const dbCheck = await httpRequest({
        hostname: '127.0.0.1',
        port: 7778,
        path: `/api/nft/claims/${address}`,
        method: 'GET'
    });
    
    log(`数据库NFT记录: ${JSON.stringify(dbCheck)}`);
    
    // 2. 查询区块链（通过Tronscan API）
    try {
        const tronscanUrl = `https://nileapi.tronscan.org/api/token/tokens?address=${address}&limit=20`;
        const https = require('https');
        
        const tronscanResult = await new Promise((resolve, reject) => {
            https.get(tronscanUrl, (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        resolve(null);
                    }
                });
            }).on('error', reject);
        });
        
        if (tronscanResult && tronscanResult.data) {
            const nfts = tronscanResult.data.filter(token => 
                token.tokenId === CONFIG.nftContract || 
                token.address === CONFIG.nftContract
            );
            
            if (nfts.length > 0) {
                log(`🎉 Tronscan上找到 ${nfts.length} 个NFT!`);
                nfts.forEach(nft => {
                    log(`  - ${nft.name || nft.tokenName}: ${nft.tokenId}`);
                });
                return true;
            }
        }
    } catch (error) {
        log(`Tronscan查询失败: ${error.message}`);
    }
    
    return false;
}

// 主流程
async function main() {
    let client;
    let bot;
    
    try {
        // 确保测试结果目录存在
        if (!fs.existsSync(CONFIG.testResultsDir)) {
            fs.mkdirSync(CONFIG.testResultsDir, { recursive: true });
        }
        
        log('========================================');
        log('  NFT锻造完整自动化流程');
        log('========================================');
        
        // 1. 连接Chrome CDP
        log('连接Chrome CDP...');
        client = await CDP({ port: CONFIG.cdpPort });
        
        // 2. 创建锦标赛（mock模式）
        const tournamentResult = await createTournament(true);
        const tournament = tournamentResult.tournament || tournamentResult;
        const tournamentId = tournament.tournamentId || tournament._id || tournament.id;
        
        if (!tournamentId) {
            log(`锦标赛返回数据: ${JSON.stringify(tournamentResult)}`);
            throw new Error('创建锦标赛失败');
        }
        
        log(`锦标赛ID: ${tournamentId}`);
        
        await sleep(2000);
        
        // 3. 启动机器人
        bot = startBot(tournamentId);
        await sleep(3000);
        
        // 4. CDP控制浏览器加入游戏
        const joined = await runCDPAutomation(client, tournamentId);
        if (!joined) {
            throw new Error('加入游戏失败');
        }
        
        // 5. 游戏操作
        const { gameEnded, nftTriggered } = await playGame(client);
        log(`游戏结束: ${gameEnded}, NFT触发: ${nftTriggered}`);
        
        // 6. 等待NFT成就并自动签名
        const nftMinted = await waitForNFTAndSign(client);
        
        // 7. 验证NFT铸造
        await sleep(3000);
        const verified = await verifyNFTMinted(CONFIG.playerAddress);
        
        // 最终截图
        const { Page } = client;
        await takeScreenshot(Page, 'final-state.png');
        
        log('========================================');
        if (verified) {
            log('  ✅ NFT锻造成功！');
        } else if (nftMinted) {
            log('  ⚠️  签名完成，但未在链上找到NFT');
        } else {
            log('  ❌ NFT锻造未完成');
        }
        log('========================================');
        
        // 打印NFT合约链接
        log(`NFT合约: https://nile.tronscan.org/#/token20/${CONFIG.nftContract}`);
        log(`钱包NFT: https://nile.tronscan.org/#/address/${CONFIG.playerAddress}`);
        
    } catch (error) {
        log(`❌ 错误: ${error.message}`);
        console.error(error);
    } finally {
        // 清理
        if (client) {
            await client.close();
        }
        if (bot) {
            bot.kill();
        }
        
        log('流程结束');
    }
}

// 运行
main().catch(console.error);
