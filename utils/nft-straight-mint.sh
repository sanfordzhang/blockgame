#!/bin/bash
# === 顺子 NFT 完整锻造流程 ===
# 按照 docs/GAME_BOT_TEST_FLOW.md 流程
# 1. 连接 Chrome CDP
# 2. 导航锦标赛页面
# 3. 勾选 Mock 模式（顺子牌型）
# 4. 加入锦标赛并完成游戏
# 5. 监听 NFT 成就并完成签名

set -e
cd /Users/yingfengzhang/1JackSource/blockchain/game-core

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }

# TronLink 窗口参数（来自 deposit-auto-final.sh）
TL_X=1127
TL_Y=34
TL_W=385
TL_H=953
TRONLINK_ICON_X=1238
TRONLINK_ICON_Y=50
SIGN_BTN_X=1414
SIGN_BTN_Y=635

log "=========================================="
log "  顺子 NFT 锻造流程"
log "=========================================="

# Step 1: 检查 Chrome CDP
log "[1] 检查 Chrome CDP..."
if ! curl -s http://127.0.0.1:9222/json/version > /dev/null 2>&1; then
    err "Chrome CDP 未运行！请启动 Chrome:"
    echo '  /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222 --user-data-dir="/tmp/chrome-debug" "http://127.0.0.1:3001/" &'
    exit 1
fi
log "✅ Chrome CDP 运行中"

# Step 2: 检查游戏机器人
log "[2] 检查游戏机器人..."
if ! pgrep -f "game-bot" > /dev/null; then
    warn "游戏机器人未运行，正在启动..."
    node scripts/game-bot.js > bot.log 2>&1 &
    sleep 3
fi
log "✅ 游戏机器人运行中"

# Step 3: 获取当前锦标赛信息
log "[3] 获取锦标赛信息..."
TOURNAMENTS=$(curl -s http://127.0.0.1:7778/api/tournament/list)
log "当前锦标赛: $TOURNAMENTS"

# Step 4: 执行游戏流程（使用 Node.js CDP）
log "[4] 执行游戏流程..."
node << 'NODESCRIPT'
const CDP = require('chrome-remote-interface');
const fs = require('fs');
const path = require('path');

const TL_X = 1127, TL_Y = 34, TL_W = 385, TL_H = 953;
const TRONLINK_ICON_X = 1238, TRONLINK_ICON_Y = 50;
const SIGN_BTN_X = 1414, SIGN_BTN_Y = 635;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const log = (msg) => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

async function main() {
    log('连接 Chrome CDP...');
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    // 导航到锦标赛页面
    log('导航到锦标赛页面...');
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(3000);

    // 截图保存当前状态
    const screenshot1 = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-step1-tournament.png', Buffer.from(screenshot1.data, 'base64'));
    log('截图保存: /tmp/nft-step1-tournament.png');

    // 设置 Mock 模式
    log('设置 Mock 游戏模式...');
    await Runtime.evaluate({
        expression: `
            localStorage.setItem('mockGame', 'true');
            console.log('Mock mode enabled');
        `
    });

    // 刷新页面使 Mock 模式生效
    await Page.navigate({ url: 'http://127.0.0.1:3001/tournament' });
    await Page.loadEventFired();
    await sleep(2000);

    // 查找并加入锦标赛
    log('查找可加入的锦标赛...');
    const findTournament = `
        (function() {
            const cards = document.querySelectorAll('[class*="sc-"]');
            for (const card of cards) {
                const text = card.innerText || '';
                if (text.includes('1 / 2') || text.includes('1/2')) {
                    console.log('Found tournament card:', text.substring(0, 50));
                    card.click();
                    return 'found';
                }
            }
            return 'not found';
        })()
    `;

    let result = await Runtime.evaluate({ expression: findTournament });
    log(`查找结果: ${result.result.value}`);

    await sleep(2000);

    // 截图
    const screenshot2 = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-step2-found.png', Buffer.from(screenshot2.data, 'base64'));

    // 点击 Confirm 加入
    log('点击 Confirm 加入锦标赛...');
    const clickConfirm = `
        (function() {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.trim() === 'Confirm') {
                    btn.click();
                    return 'clicked';
                }
            }
            return 'not found';
        })()
    `;

    result = await Runtime.evaluate({ expression: clickConfirm });
    log(`Confirm 结果: ${result.result.value}`);

    await sleep(3000);

    // 截图游戏状态
    const screenshot3 = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-step3-joined.png', Buffer.from(screenshot3.data, 'base64'));

    log('等待游戏开始...');
    await sleep(5000);

    // 游戏操作循环
    let round = 0;
    const maxRounds = 20;
    let gameEnded = false;

    while (!gameEnded && round < maxRounds) {
        round++;
        log(`--- Round ${round} ---`);

        // 截图当前状态
        const screenshot = await Page.captureScreenshot();
        fs.writeFileSync(`/tmp/nft-game-round-${round}.png`, Buffer.from(screenshot.data, 'base64'));

        // 检查游戏状态
        const checkButtons = `
            (function() {
                const buttons = Array.from(document.querySelectorAll('button'))
                    .filter(b => !b.disabled)
                    .map(b => b.textContent.trim());
                return JSON.stringify(buttons);
            })()
        `;

        const btnResult = await Runtime.evaluate({ expression: checkButtons });
        const buttons = JSON.parse(btnResult.result.value || '[]');
        log(`可用按钮: ${buttons.join(', ')}`);

        // 检查是否游戏结束
        const checkEnd = `
            (function() {
                const text = document.body.innerText;
                if (text.includes('Tournament Winner') || text.includes('Game Over') || text.includes('恭喜')) {
                    return 'ended';
                }
                return 'playing';
            })()
        `;

        const endResult = await Runtime.evaluate({ expression: checkEnd });
        if (endResult.result.value === 'ended') {
            log('游戏结束！');
            gameEnded = true;
            break;
        }

        // 执行操作（优先 Check > Call）
        if (buttons.includes('Check')) {
            log('执行 Check...');
            await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === 'Check') {
                                btn.click();
                                return 'check';
                            }
                        }
                    })()
                `
            });
        } else if (buttons.includes('Call')) {
            log('执行 Call...');
            await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === 'Call') {
                                btn.click();
                                return 'call';
                            }
                        }
                    })()
                `
            });
        } else if (buttons.includes('Fold')) {
            log('执行 Fold...');
            await Runtime.evaluate({
                expression: `
                    (function() {
                        const buttons = document.querySelectorAll('button');
                        for (const btn of buttons) {
                            if (btn.textContent.trim() === 'Fold') {
                                btn.click();
                                return 'fold';
                            }
                        }
                    })()
                `
            });
        } else if (buttons.length === 0) {
            log('没有可用按钮，等待...');
        }

        await sleep(3000);
    }

    // 最终截图
    const finalScreenshot = await Page.captureScreenshot();
    fs.writeFileSync('/tmp/nft-final.png', Buffer.from(finalScreenshot.data, 'base64'));
    log('最终截图保存: /tmp/nft-final.png');

    // 检查是否有 NFT 弹窗
    log('检查 NFT 成就弹窗...');
    const checkNFT = `
        (function() {
            const modals = document.querySelectorAll('[class*="modal"], [class*="Modal"], [class*="achievement"]');
            const results = [];
            modals.forEach(m => {
                const text = m.innerText || '';
                if (text.includes('NFT') || text.includes('Straight') || text.includes('顺子') || text.includes('Achievement')) {
                    results.push(text.substring(0, 100));
                }
            });
            return JSON.stringify(results);
        })()
    `;

    const nftResult = await Runtime.evaluate({ expression: checkNFT });
    log(`NFT 弹窗内容: ${nftResult.result.value}`);

    await client.close();
    log('CDP 连接关闭');
}

main().catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
});
NODESCRIPT

log "游戏流程完成"

# Step 5: 检查 TronLink 是否有签名请求
log "[5] 检查 TronLink 签名请求..."
sleep 3

# 截取全屏
screencapture -x /tmp/nft-fullscreen.png

# 检查 TronLink 窗口
window_check=$(osascript -e 'tell application "Google Chrome" to get name of every window' 2>/dev/null || echo "")
if [[ "$window_check" == *"TronLink"* ]]; then
    log "检测到 TronLink 签名窗口！"
    
    # 截取 TronLink 窗口
    screencapture -x -R${TL_X},${TL_Y},${TL_W},${TL_H} /tmp/nft-tronlink.png
    
    # OCR 检测
    tl_content=$(swift ocr-vision.swift /tmp/nft-tronlink.png 2>/dev/null | grep -i "sign\|签名\|confirm\|mint" || echo "未检测到签名按钮")
    log "TronLink 内容: $tl_content"
    
    # 点击签名按钮
    log "点击签名按钮..."
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    sleep 1
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    sleep 1
    cliclick c:$SIGN_BTN_X,$SIGN_BTN_Y
    
    log "✅ 已点击签名按钮"
else
    warn "未检测到 TronLink 签名窗口"
fi

# Step 6: 等待并验证 NFT
log "[6] 验证 NFT 锻造结果..."
sleep 5

# 查询 NFT 余额
node << 'NODESCRIPT2'
const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://api.nile.trongrid.io' });

async function check() {
    const nftAddr = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
    const p1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    
    try {
        const c = await tronWeb.contract().at(nftAddr);
        const bal = await c.balanceOf(p1).call();
        console.log('Player1 NFT Balance:', bal.toString());
        
        // 查询最新的 NFT owner
        const totalSupply = await c.totalSupply().call();
        console.log('Total Supply:', totalSupply.toString());
        
        // 检查最新几个 token
        const latest = parseInt(totalSupply.toString());
        if (latest > 0) {
            const owner = await c.ownerOf(latest).call();
            console.log(`Token #${latest} owner:`, tronWeb.address.fromHex(owner));
        }
    } catch(e) {
        console.log('Error:', e.message);
    }
}

check();
NODESCRIPT2

# 复制截图
cp /tmp/nft-*.png test-results/ 2>/dev/null || true

log "=========================================="
log "  ✅ 流程完成！"
log "  截图保存在 test-results/"
log "=========================================="
