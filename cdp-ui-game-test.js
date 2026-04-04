/**
 * CDP 完整游戏流程 - 真实浏览器 UI 操作
 * 1. 浏览器导航到锦标赛页面
 * 2. 开启 Mock 模式，创建锦标赛
 * 3. 机器人（socket）加入
 * 4. 浏览器玩家1加入并完成游戏
 * 5. 等待"Mint NFT"弹窗，CDP 点击按钮
 * 6. TronLink 弹出签名窗口（用户手动确认 or 自动）
 */

const CDP = require('chrome-remote-interface');
const io = require('socket.io-client');
const axios = require('axios');
const fs = require('fs');

const API = 'http://127.0.0.1:7778';
const FRONTEND = 'http://127.0.0.1:3001';
const BOT = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function screenshot(Page, name) {
    const { data } = await Page.captureScreenshot({ format: 'png' });
    const file = `test-results/${name}.png`;
    fs.writeFileSync(file, data, 'base64');
    log(`📸 ${file}`);
}

async function evalJS(Runtime, expr) {
    const r = await Runtime.evaluate({ expression: expr, awaitPromise: true });
    if (r.exceptionDetails) {
        log(`⚠️  JS错误: ${r.exceptionDetails.text}`);
        return null;
    }
    return r.result?.value;
}

async function clickButtonByText(Runtime, text) {
    return evalJS(Runtime, `
        (function() {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.trim().includes('${text}') && !b.disabled);
            if (btn) { btn.click(); return true; }
            return false;
        })()
    `);
}

async function waitForButton(Runtime, text, timeoutMs = 20000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        const found = await evalJS(Runtime, `
            Array.from(document.querySelectorAll('button'))
                .some(b => b.textContent.trim().includes('${text}') && !b.disabled)
        `);
        if (found) return true;
        await sleep(500);
    }
    return false;
}

async function main() {
    log('🎮 完整 UI 游戏流程测试\n');

    // 连接 CDP（指定 tournament 页面）
    const pages = await new Promise((res, rej) => {
        const http = require('http');
        http.get('http://localhost:9222/json', r => {
            let data = '';
            r.on('data', c => data += c);
            r.on('end', () => res(JSON.parse(data)));
        }).on('error', rej);
    });

    const targetPage = pages.find(p => p.type === 'page' && !p.url.includes('chrome-extension'));
    if (!targetPage) throw new Error('找不到浏览器页面');

    const client = await CDP({ target: targetPage.webSocketDebuggerUrl });
    const { Page, Runtime, Input } = client;
    await Page.enable();
    await Runtime.enable();
    log(`✅ CDP 连接到页面: ${targetPage.url}`);

    // === 步骤1: 导航到锦标赛页面 ===
    log('\n=== 步骤1: 导航到锦标赛页面 ===');
    await Page.navigate({ url: `${FRONTEND}/tournament` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot(Page, 'step1-tournament');

    // === 步骤2: 启用 Mock 模式 ===
    log('\n=== 步骤2: 启用 Mock 模式 ===');
    const mockResult = await evalJS(Runtime, `
        (function() {
            const cb = document.querySelector('input[data-testid="mock-game-checkbox"]');
            if (cb) {
                if (!cb.checked) cb.click();
                return 'enabled: ' + cb.checked;
            }
            return 'not found';
        })()
    `);
    log(`Mock 开关: ${mockResult}`);
    await sleep(500);
    await screenshot(Page, 'step2-mock');

    // === 步骤3: 创建锦标赛 ===
    log('\n=== 步骤3: 创建锦标赛 ===');
    const createRes = await axios.post(`${API}/api/tournament/create`, {
        configId: 3,
        walletAddress: BOT.address,
        mockGame: true
    });
    const tournamentId = createRes.data.tournament?.tournamentId || createRes.data.tournamentId;
    log(`✅ 锦标赛: ${tournamentId}`);

    // === 步骤4: 机器人加入（后台 socket） ===
    log('\n=== 步骤4: 机器人加入 ===');
    const bot = io(API, { transports: ['websocket'] });
    await new Promise(resolve => bot.on('connect', resolve));
    bot.emit('CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: BOT.address });
    bot.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: BOT.address });
    log('✅ 机器人已加入');

    bot.on('tournament_game_state', state => {
        const seat = Object.values(state.seats || {}).find(s => {
            const addr = typeof s.player === 'string' ? s.player : (s.player?.id || '');
            return addr.toLowerCase() === BOT.address.toLowerCase();
        });
        if (seat?.turn) {
            const callAmount = state.callAmount || 0;
            if (callAmount === 0) {
                bot.emit('CS_TOURNAMENT_CHECK', { tournamentId });
            } else {
                bot.emit('CS_TOURNAMENT_CALL', { tournamentId });
            }
        }
    });

    // === 步骤5: 浏览器中找到并点击锦标赛 ===
    log('\n=== 步骤5: 浏览器点击加入锦标赛 ===');
    await sleep(1500);
    await screenshot(Page, 'step5-before-click');

    // 点击包含 "1 / 2" 的锦标赛卡片
    const clicked = await evalJS(Runtime, `
        (function() {
            const cards = Array.from(document.querySelectorAll('*'));
            const card = cards.find(el => el.textContent.includes('1 / 2') && el.onclick !== null);
            if (card) { card.click(); return 'clicked: ' + card.tagName; }
            // 尝试直接点击卡片容器
            const all = Array.from(document.querySelectorAll('[class*="Card"], [class*="card"], [class*="Tournament"], [class*="tournament"]'));
            const target = all.find(el => el.innerText?.includes('1 / 2'));
            if (target) { target.click(); return 'clicked div: ' + target.className.substring(0,50); }
            return 'not found, buttons: ' + Array.from(document.querySelectorAll('button')).map(b=>b.textContent.trim()).join(', ');
        })()
    `);
    log(`卡片点击: ${clicked}`);
    await sleep(1500);
    await screenshot(Page, 'step5-after-click');

    // 点击 Confirm 按钮
    const confirmClicked = await clickButtonByText(Runtime, 'Confirm');
    log(`Confirm 点击: ${confirmClicked}`);
    await sleep(2000);
    await screenshot(Page, 'step5-confirmed');

    // === 步骤6: 等待游戏进行并操作 ===
    log('\n=== 步骤6: 游戏进行中 ===');

    // 连接浏览器玩家的 socket（监听 NFT 事件）
    let nftAchievementData = null;
    const player1Socket = io(API, { transports: ['websocket'] });
    await new Promise(resolve => player1Socket.on('connect', resolve));

    // 不 join socket（浏览器已经 join 了），只监听广播
    player1Socket.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
        log(`\n🏆 NFT 成就事件: ${data.achievementType}`);
        nftAchievementData = data;
    });

    // 等待游戏操作按钮出现并自动 check/call
    for (let i = 0; i < 20; i++) {
        await sleep(2000);

        const buttons = await evalJS(Runtime, `
            Array.from(document.querySelectorAll('button'))
                .filter(b => !b.disabled)
                .map(b => b.textContent.trim())
                .filter(t => ['Check','Call','Fold','Raise'].includes(t))
                .join(',')
        `);

        if (buttons) {
            log(`回合 ${i+1} 可用按钮: ${buttons}`);
            if (buttons.includes('Check')) {
                await clickButtonByText(Runtime, 'Check');
                log('  → Click: Check');
            } else if (buttons.includes('Call')) {
                await clickButtonByText(Runtime, 'Call');
                log('  → Click: Call');
            }
            await screenshot(Page, `step6-round${i+1}`);
        }

        // 检查是否有 Mint NFT 按钮弹出
        const mintBtn = await evalJS(Runtime, `
            Array.from(document.querySelectorAll('button'))
                .some(b => b.textContent.trim().includes('Mint'))
        `);
        if (mintBtn) {
            log('\n🎉 发现 Mint NFT 按钮！');
            await screenshot(Page, 'step6-mint-popup');
            break;
        }
    }

    // === 步骤7: 点击 Mint NFT 按钮 ===
    log('\n=== 步骤7: 点击 Mint NFT ===');
    await screenshot(Page, 'step7-before-mint');

    const mintClicked = await clickButtonByText(Runtime, 'Mint');
    log(`Mint 按钮点击: ${mintClicked}`);
    await sleep(3000);
    await screenshot(Page, 'step7-after-mint');

    // 等待 TronLink 签名弹窗（需要用户手动确认）
    log('\n⏳ 等待 TronLink 弹窗签名... (请在 TronLink 中确认)');
    await sleep(10000);
    await screenshot(Page, 'step7-tronlink-wait');

    // === 步骤8: 验证结果 ===
    log('\n=== 步骤8: 验证 NFT 结果 ===');

    // 检查数据库
    const nftsRes = await axios.get(`${API}/api/nft/collection/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv`);
    const nfts = nftsRes.data.nfts || [];
    const newNFTs = nfts.filter(n => n.gameId?.includes(tournamentId) || n.txHash !== null && n.txHash !== 'synced_from_chain');
    log(`\n数据库 NFT 总数: ${nfts.length}`);
    if (newNFTs.length > 0) {
        log('本次生成的 NFT:');
        newNFTs.forEach(n => log(`  #${n.tokenId} ${n.achievementType} txHash:${n.txHash}`));
    } else {
        log('最新 3 条:');
        nfts.slice(-3).forEach(n => log(`  #${n.tokenId} ${n.achievementType} tx:${n.txHash}`));
    }

    await screenshot(Page, 'step8-final');

    bot.disconnect();
    player1Socket.disconnect();
    await client.close();
    log('\n✅ 测试完成！');
}

main().catch(err => {
    console.error('❌ 错误:', err.message);
    process.exit(1);
});
