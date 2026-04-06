/**
 * NFT 顺子锻造 - 完整游戏流程
 * 1. 获取机器人创建的锦标赛
 * 2. 通过 CDP 加入锦标赛
 * 3. 完成游戏操作
 * 4. 监听 NFT 成就并签名
 */

const CDP = require('chrome-remote-interface');
const fs = require('fs');
const { spawn } = require('child_process');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

// TronLink 窗口参数
const TL_X = 1127, TL_Y = 34, TL_W = 385, TL_H = 953;
const SIGN_BTN_X = 1414, SIGN_BTN_Y = 635;

async function main() {
    // Step 1: 获取等待中的锦标赛
    log('获取锦标赛列表...');
    const tournamentsResp = await fetch('http://127.0.0.1:7778/api/tournament/list');
    const tournamentsData = await tournamentsResp.json();
    
    // 找到 WAITING 状态的锦标赛
    const waitingTournament = tournamentsData.tournaments?.find(t => t.status === 'WAITING');
    
    if (!waitingTournament) {
        log('❌ 没有找到等待中的锦标赛');
        process.exit(1);
    }
    
    const tournamentId = waitingTournament.tournamentId;
    log(`✅ 找到锦标赛: ${tournamentId}`);
    log(`   玩家数: ${waitingTournament.players?.length || 0} / ${waitingTournament.playerCount}`);
    
    // Step 2: 连接 Chrome CDP
    log('连接 Chrome CDP...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();
    
    // Step 3: 导航到锦标赛页面
    log('导航到锦标赛页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(3000);
    
    // 设置 Mock 模式
    log('设置 Mock 游戏模式（顺子牌型）...');
    await Runtime.evaluate({
        expression: `localStorage.setItem('mockGame', 'true');`
    });
    
    // 刷新页面
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(3000);
    
    // 截图
    const screenshot1 = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-tournament-list.png', Buffer.from(screenshot1.data, 'base64'));
    log('截图: /tmp/nft-tournament-list.png');
    
    // Step 4: 找到并点击锦标赛卡片
    log('查找锦标赛卡片...');
    const clickResult = await Runtime.evaluate({
        expression: `
(function() {
    // 查找所有可能的卡片元素
    const allElements = document.querySelectorAll('*');
    let found = false;
    
    for (const el of allElements) {
        const text = el.innerText || el.textContent || '';
        // 查找包含 "1 / 2" 或 "1/2" 的卡片
        if ((text.includes('1 / 2') || text.includes('1/2')) && text.includes('TRX')) {
            console.log('Found tournament card with text:', text.substring(0, 100));
            el.click();
            found = true;
            break;
        }
    }
    
    if (!found) {
        // 尝试查找状态为 WAITING 的卡片
        for (const el of allElements) {
            const text = el.innerText || el.textContent || '';
            if (text.toLowerCase().includes('waiting')) {
                console.log('Found WAITING card');
                el.click();
                found = true;
                break;
            }
        }
    }
    
    return found ? 'clicked' : 'not found';
})()
        `
    });
    log(`点击结果: ${clickResult.result.value}`);
    
    await sleep(2000);
    
    // 截图
    const screenshot2 = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-after-click.png', Buffer.from(screenshot2.data, 'base64'));
    
    // Step 5: 点击 Confirm 加入
    log('点击 Confirm 加入...');
    const confirmResult = await Runtime.evaluate({
        expression: `
(function() {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        const text = btn.textContent.trim();
        if (text === 'Confirm' || text === 'confirm') {
            btn.click();
            return 'clicked';
        }
    }
    return 'not found';
})()
        `
    });
    log(`Confirm 结果: ${confirmResult.result.value}`);
    
    await sleep(3000);
    
    // 截图
    const screenshot3 = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-after-join.png', Buffer.from(screenshot3.data, 'base64'));
    
    // Step 6: 等待游戏开始并执行操作
    log('等待游戏开始...');
    await sleep(5000);
    
    let round = 0;
    const maxRounds = 30;
    let gameEnded = false;
    
    while (!gameEnded && round < maxRounds) {
        round++;
        log(`--- Round ${round} ---`);
        
        // 截图
        const screenshot = await Page.captureScreenshot();
        fs.writeFileSync(`/tmp/nft-game-round-${round}.png`, Buffer.from(screenshot.data, 'base64'));
        
        // 检查游戏状态
        const stateResult = await Runtime.evaluate({
            expression: `
(function() {
    // 检查是否在游戏页面
    const url = window.location.href;
    const isGamePage = url.includes('/play') || url.includes('/tournament/');
    
    // 获取所有按钮
    const buttons = Array.from(document.querySelectorAll('button'))
        .filter(b => !b.disabled && b.offsetParent !== null)
        .map(b => b.textContent.trim());
    
    // 检查页面文本
    const bodyText = document.body.innerText;
    const isEnded = bodyText.includes('Tournament Winner') || 
                    bodyText.includes('Game Over') || 
                    bodyText.includes('恭喜') ||
                    bodyText.includes('Winner');
    
    // 检查 NFT 弹窗
    const hasNFTModal = bodyText.includes('NFT') || 
                        bodyText.includes('Straight') || 
                        bodyText.includes('顺子') ||
                        bodyText.includes('Achievement');
    
    return JSON.stringify({
        url,
        isGamePage,
        buttons,
        isEnded,
        hasNFTModal,
        bodyPreview: bodyText.substring(0, 200)
    });
})()
            `
        });
        
        const state = JSON.parse(stateResult.result.value || '{}');
        log(`URL: ${state.url}`);
        log(`按钮: ${state.buttons?.join(', ')}`);
        
        if (state.isEnded) {
            log('🎉 游戏结束！');
            gameEnded = true;
        }
        
        if (state.hasNFTModal) {
            log('🎨 检测到 NFT 弹窗！');
        }
        
        // 执行游戏操作
        if (!gameEnded && state.buttons?.length > 0) {
            // 过滤掉非游戏按钮
            const gameButtons = state.buttons.filter(b => 
                ['Check', 'Call', 'Raise', 'Fold', 'All In'].some(gb => b.includes(gb))
            );
            
            if (gameButtons.length > 0) {
                log(`游戏按钮: ${gameButtons.join(', ')}`);
                
                // 优先 Check > Call > Fold
                let action = null;
                if (gameButtons.includes('Check')) {
                    action = 'Check';
                } else if (gameButtons.some(b => b.includes('Call'))) {
                    action = gameButtons.find(b => b.includes('Call'));
                } else if (gameButtons.includes('Fold')) {
                    action = 'Fold';
                } else if (gameButtons.some(b => b.includes('Raise'))) {
                    action = gameButtons.find(b => b.includes('Raise'));
                }
                
                if (action) {
                    log(`执行操作: ${action}`);
                    await Runtime.evaluate({
                        expression: `
(function() {
    const buttons = document.querySelectorAll('button');
    for (const btn of buttons) {
        if (btn.textContent.trim().includes('${action}')) {
            btn.click();
            return 'clicked ${action}';
        }
    }
    return 'not found';
})()
                        `
                    });
                }
            }
        }
        
        await sleep(3000);
    }
    
    // 最终截图
    const finalScreenshot = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-game-final.png', Buffer.from(finalScreenshot.data, 'base64'));
    
    // Step 7: 检查 NFT 成就
    log('检查 NFT 成就...');
    const nftCheck = await Runtime.evaluate({
        expression: `
(function() {
    const body = document.body.innerText;
    const hasNFT = body.includes('NFT') || body.includes('Straight') || body.includes('顺子');
    
    // 查找 Mint 按钮
    const buttons = document.querySelectorAll('button');
    let mintButton = null;
    for (const btn of buttons) {
        if (btn.textContent.toLowerCase().includes('mint') || 
            btn.textContent.includes('锻造') ||
            btn.textContent.includes('领取')) {
            mintButton = btn.textContent.trim();
            btn.click();
            break;
        }
    }
    
    return JSON.stringify({ hasNFT, mintButton });
})()
        `
    });
    
    const nftState = JSON.parse(nftCheck.result.value || '{}');
    log(`NFT 状态: ${JSON.stringify(nftState)}`);
    
    // Step 8: 检查 TronLink 签名
    log('检查 TronLink 签名窗口...');
    await sleep(3000);
    
    // 使用 cliclick 截取全屏
    const { execSync } = require('child_process');
    execSync('screencapture -x /tmp/nft-fullscreen-check.png');
    
    // 检查 TronLink 窗口
    try {
        const windowNames = execSync(
            `osascript -e 'tell application "Google Chrome" to get name of every window'`
        ).toString();
        
        if (windowNames.includes('TronLink')) {
            log('✅ 检测到 TronLink 签名窗口！');
            
            // 截取 TronLink 窗口
            execSync(`screencapture -x -R${TL_X},${TL_Y},${TL_W},${TL_H} /tmp/nft-tronlink.png`);
            
            // 点击签名按钮
            log('点击签名按钮...');
            execSync(`cliclick c:${SIGN_BTN_X},${SIGN_BTN_Y}`);
            await sleep(1000);
            execSync(`cliclick c:${SIGN_BTN_X},${SIGN_BTN_Y}`);
            await sleep(1000);
            execSync(`cliclick c:${SIGN_BTN_X},${SIGN_BTN_Y}`);
            
            log('✅ 已点击签名按钮 3 次');
        } else {
            log('未检测到 TronLink 签名窗口');
        }
    } catch (e) {
        log(`检查窗口出错: ${e.message}`);
    }
    
    await client.close();
    log('CDP 连接关闭');
    
    // Step 9: 验证 NFT
    log('验证 NFT 锻造结果...');
    await sleep(5000);
    
    // 查询链上 NFT
    try {
        const { TronWeb } = require('tronweb');
        const tronWeb = new TronWeb({ fullHost: 'https://api.nile.trongrid.io' });
        const nftAddr = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
        const p1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
        
        const c = await tronWeb.contract().at(nftAddr);
        const bal = await c.balanceOf(p1).call();
        log(`Player1 NFT 余额: ${bal.toString()}`);
        
        // 获取最新 token
        const totalSupply = await c.totalSupply().call();
        log(`总供应量: ${totalSupply.toString()}`);
        
        if (parseInt(totalSupply.toString()) > 0) {
            const latestTokenId = parseInt(totalSupply.toString());
            const owner = await c.ownerOf(latestTokenId).call();
            log(`Token #${latestTokenId} 拥有者: ${tronWeb.address.fromHex(owner)}`);
        }
    } catch (e) {
        log(`查询 NFT 出错: ${e.message}`);
    }
    
    log('========================================');
    log('✅ 流程完成！');
    log('========================================');
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
