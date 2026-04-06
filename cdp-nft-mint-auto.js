/**
 * CDP 自动化 NFT 锻造流程
 * 
 * 流程：
 * 1. 连接到锦标赛页面
 * 2. 勾选 Mock 模式
 * 3. 等待机器人创建的锦标赛
 * 4. 加入游戏并自动操作
 * 5. 检测 NFT 成就弹窗
 * 6. 自动点击"锻造 NFT"
 * 7. 处理 TronLink 签名
 * 8. 验证锻造结果
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const SERVER_URL = 'http://127.0.0.1:7778';
const FRONTEND_URL = 'http://127.0.0.1:3001';
const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

// TronLink 窗口坐标
const TRONLINK = {
    iconX: 1238,
    iconY: 50,
    signBtnX: 1414,
    signBtnY: 635,
    windowX: 1127,
    windowY: 34,
    windowW: 385,
    windowH: 953
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (msg, data = null) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ${msg}`);
    if (data) console.log('  ', JSON.stringify(data, null, 2));
};

const error = (msg) => {
    console.error(`\x1b[31m[ERROR] ${msg}\x1b[0m`);
};

const success = (msg) => {
    console.log(`\x1b[32m[SUCCESS] ${msg}\x1b[0m`);
};

const warn = (msg) => {
    console.log(`\x1b[33m[WARN] ${msg}\x1b[0m`);
};

async function joinTournament(Page, Runtime) {
    log('加入锦标赛...');
    
    // 勾选 Mock 游戏开关
    const mockResult = await Runtime.evaluate({
        expression: `
            const checkbox = document.querySelector('input[data-testid="mock-game-checkbox"]');
            if (checkbox && !checkbox.checked) {
                checkbox.click();
                'Mock 开关已勾选';
            } else {
                'Mock 开关已勾选或不存在';
            }
        `
    });
    log(mockResult.result.value);
    
    await sleep(1000);
    
    // 点击锦标赛卡片
    const clickResult = await Runtime.evaluate({
        expression: `
            const cards = document.querySelectorAll('.sc-bypJrT.ilegoF');
            let clicked = false;
            for (const card of cards) {
                if ((card.innerText || '').includes('1 / 2')) {
                    card.click();
                    clicked = true;
                    break;
                }
            }
            clicked ? '已点击锦标赛卡片' : '未找到锦标赛卡片';
        `
    });
    log(clickResult.result.value);
    
    await sleep(2000);
    
    // 点击 Confirm
    const confirmResult = await Runtime.evaluate({
        expression: `
            const buttons = document.querySelectorAll('button');
            let clicked = false;
            for (const btn of buttons) {
                if (btn.textContent.trim() === 'Confirm') {
                    btn.click();
                    clicked = true;
                    break;
                }
            }
            clicked ? '已点击 Confirm' : '未找到 Confirm 按钮';
        `
    });
    log(confirmResult.result.value);
}

async function playGame(Runtime) {
    log('游戏开始，自动操作...');
    
    let gameEnded = false;
    let operationCount = 0;
    const maxOperations = 50; // 最多50次操作
    
    while (!gameEnded && operationCount < maxOperations) {
        await sleep(3000);
        
        // 检查是否有操作按钮
        const actionResult = await Runtime.evaluate({
            expression: `
                const buttons = Array.from(document.querySelectorAll('button'))
                    .filter(b => !b.disabled)
                    .map(b => b.textContent.trim());
                
                // 优先级: Check > Call > Fold
                let action = null;
                if (buttons.includes('Check')) {
                    action = 'Check';
                } else if (buttons.includes('Call')) {
                    action = 'Call';
                } else if (buttons.includes('Fold')) {
                    action = 'Fold';
                }
                
                if (action) {
                    const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === action);
                    if (btn && !btn.disabled) {
                        btn.click();
                        '执行操作: ' + action;
                    } else {
                        '按钮不可用: ' + action;
                    }
                } else {
                    '等待操作按钮...';
                }
            `
        });
        
        log(actionResult.result.value);
        operationCount++;
        
        // 检查游戏是否结束
        const endCheck = await Runtime.evaluate({
            expression: `
                const endModal = document.querySelector('.swal2-popup');
                const tournamentEnd = document.querySelector('[class*="tournament-ended"]');
                (endModal || tournamentEnd) ? '游戏已结束' : '游戏进行中';
            `
        });
        
        if (endCheck.result.value === '游戏已结束') {
            gameEnded = true;
            log('检测到游戏结束');
        }
    }
}

async function handleNFTMint(Runtime) {
    log('检查 NFT 成就弹窗...');
    
    await sleep(3000);
    
    // 检查 NFT 弹窗
    const nftModalResult = await Runtime.evaluate({
        expression: `
            const modal = document.querySelector('.swal2-popup');
            const nftTitle = document.querySelector('.swal2-title');
            if (modal && nftTitle && (nftTitle.textContent.includes('成就达成') || nftTitle.textContent.includes('Achievement'))) {
                const content = nftTitle.textContent;
                console.log('[CDP] 检测到 NFT 成就弹窗:', content);
                content;
            } else {
                null;
            }
        `
    });
    
    if (!nftModalResult.result.value) {
        warn('未检测到 NFT 成就弹窗');
        return false;
    }
    
    success(`检测到 NFT 成就: ${nftModalResult.result.value}`);
    
    // 点击"锻造 NFT"按钮
    await sleep(1000);
    const mintBtnResult = await Runtime.evaluate({
        expression: `
            const buttons = document.querySelectorAll('.swal2-confirm');
            let clicked = false;
            for (const btn of buttons) {
                if (btn.textContent.includes('锻造 NFT') || btn.textContent.includes('Mint NFT')) {
                    btn.click();
                    clicked = true;
                    console.log('[CDP] 已点击锻造 NFT 按钮');
                    break;
                }
            }
            clicked ? '已点击锻造按钮' : '未找到锻造按钮';
        `
    });
    
    log(mintBtnResult.result.value);
    
    return mintBtnResult.result.value === '已点击锻造按钮';
}

async function handleTronLinkSignature() {
    log('处理 TronLink 签名...');
    
    await sleep(3);
    
    // 使用 cliclick 点击 TronLink 图标（如果窗口未出现）
    const { execSync } = require('child_process');
    
    try {
        // 检查 TronLink 窗口
        const windowCheck = execSync(
            `osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null || echo ""`,
            { encoding: 'utf-8' }
        );
        
        if (!windowCheck.includes('TronLink')) {
            warn('TronLink 窗口未出现，点击图标...');
            execSync(`cliclick c:${TRONLINK.iconX},${TRONLINK.iconY}`);
            await sleep(3);
        }
        
        // 截图保存
        execSync(`screencapture -x -R${TRONLINK.windowX},${TRONLINK.windowY},${TRONLINK.windowW},${TRONLINK.windowH} /tmp/tl-nft-window.png`);
        log('已截取 TronLink 窗口');
        
        // 点击签名按钮（多次）
        for (let i = 0; i < 3; i++) {
            execSync(`cliclick c:${TRONLINK.signBtnX},${TRONLINK.signBtnY}`);
            await sleep(1);
        }
        
        success('已点击签名按钮 3 次');
        
    } catch (err) {
        error(`处理 TronLink 签名失败: ${err.message}`);
        return false;
    }
    
    return true;
}

async function verifyNFTMint() {
    log('验证 NFT 锻造结果...');
    
    await sleep(10);
    
    // 查询数据库
    const mongoose = require('mongoose');
    const NFTClaim = require('./server/models/NFTClaim');
    
    try {
        await mongoose.connect('mongodb://localhost:27017/poker-game');
        const nfts = await NFTClaim.findByPlayer(PLAYER1_ADDRESS);
        
        log(`数据库中 NFT 数量: ${nfts.length}`);
        
        if (nfts.length > 0) {
            const latestNFT = nfts[0];
            success(`最新 NFT: ${latestNFT.achievementType} - ${latestNFT.handDescription}`);
        }
        
        await mongoose.disconnect();
        
    } catch (err) {
        error(`数据库查询失败: ${err.message}`);
    }
    
    // 查询链上（通过 Tronscan API）
    try {
        const axios = require('axios');
        const response = await axios.get(
            `https://nile.tronscan.org/api/token20/${NFT_CONTRACT}/holders?address=${PLAYER1_ADDRESS}`
        );
        
        const balance = response.data.data?.[0]?.balance || 0;
        log(`链上 NFT 数量: ${balance}`);
        
        if (balance > 0) {
            success(`链上验证成功！查看: https://nile.tronscan.org/#/token20/${NFT_CONTRACT}`);
        }
        
    } catch (err) {
        warn(`链上查询失败: ${err.message}`);
    }
}

async function takeScreenshot(Page, name) {
    const screenshot = await Page.captureScreenshot();
    const buffer = Buffer.from(screenshot.data, 'base64');
    const filepath = path.join(__dirname, 'test-results', `nft-${name}.png`);
    fs.writeFileSync(filepath, buffer);
    log(`截图已保存: ${filepath}`);
}

async function main() {
    console.log('\n========================================');
    console.log('🚀 NFT 锻造自动化流程启动');
    console.log(`   玩家: ${PLAYER1_ADDRESS}`);
    console.log(`   合约: ${NFT_CONTRACT}`);
    console.log('========================================\n');
    
    let client;
    
    try {
        // 连接到 Chrome
        client = await CDP({ port: 9222 });
        const { Page, Runtime } = client;
        
        log('✅ 已连接到 Chrome CDP');
        
        // 导航到锦标赛页面
        await Page.navigate({ url: `${FRONTEND_URL}/tournament` });
        await Page.loadEventFired();
        log('已导航到锦标赛页面');
        
        await sleep(3000);
        await takeScreenshot(Page, '01-tournament-page');
        
        // 加入锦标赛
        await joinTournament(Page, Runtime);
        await sleep(5000);
        await takeScreenshot(Page, '02-joined-game');
        
        // 玩游戏
        await playGame(Runtime);
        await takeScreenshot(Page, '03-game-ended');
        
        // 处理 NFT 锻造
        const hasNFT = await handleNFTMint(Runtime);
        
        if (hasNFT) {
            await takeScreenshot(Page, '04-nft-modal');
            
            // 处理 TronLink 签名
            const signed = await handleTronLinkSignature();
            
            if (signed) {
                await sleep(15);
                await takeScreenshot(Page, '05-mint-completed');
                
                // 验证锻造结果
                await verifyNFTMint();
            }
        }
        
        success('流程完成！');
        
    } catch (err) {
        error(`流程失败: ${err.message}`);
        console.error(err.stack);
    } finally {
        if (client) {
            await client.close();
        }
    }
    
    console.log('\n========================================');
    console.log('✅ 脚本执行完成');
    console.log('========================================\n');
}

// 检查依赖
try {
    require('chrome-remote-interface');
    require('mongoose');
} catch (err) {
    error('缺少依赖，请运行: npm install chrome-remote-interface mongoose axios');
    process.exit(1);
}

main().catch(console.error);
