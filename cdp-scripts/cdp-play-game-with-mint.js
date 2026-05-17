/**
 * CDP 测试：Mock 顺子游戏 + 通过前端流程铸造 NFT
 * 
 * 关键改进：在 CDP 环境中注入 TronWeb，让前端能正常调用合约
 * 使用方法: node cdp-play-game-with-mint.js
 */
const CDP = require('chrome-remote-interface');
const http = require('http');
const WebSocket = require('ws');
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const API_URL = 'http://127.0.0.1:7778';
const BASE_URL = 'http://127.0.0.1:3001';

const PLAYER1 = {
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
    privateKey: PLAYER1_PRIVATE_KEY
};
const BOT = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

const NFT_CONTRACT = process.env.NFT_CONTRACT_ONCHAIN;

const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = msg => console.log(`[${new Date().toLocaleTimeString()}] ${msg}`);

function httpPost(url, data) {
    return new Promise((resolve, reject) => {
        const body = JSON.stringify(data);
        const opts = { method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) } };
        const u = new URL(url);
        const req = http.request({ ...opts, hostname: u.hostname, port: u.port, path: u.pathname }, res => {
            let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
        });
        req.on('error', reject); req.write(body); req.end();
    });
}

async function startBot(tournamentId) {
    const botState = { tournamentId, lastTurnKey: '', lastActionTime: 0 };
    return new Promise((resolve) => {
        const ws = new WebSocket(`ws://127.0.0.1:7778/socket.io/?EIO=4&transport=websocket`);
        ws.on('open', () => { ws.send('40'); });
        ws.on('message', raw => {
            const data = raw.toString();
            if (data === '2') { ws.send('3'); return; }
            if (data.startsWith('40')) {
                setTimeout(() => {
                    ws.send('42' + JSON.stringify(['CS_LOBBY_CONNECT', { walletAddress: BOT.address }]));
                    setTimeout(() => {
                        ws.send('42' + JSON.stringify(['CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: BOT.address }]));
                        setTimeout(() => {
                            ws.send('42' + JSON.stringify(['CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: BOT.address }]));
                            resolve(ws);
                        }, 800);
                    }, 1000);
                }, 500);
            }
            if (data.startsWith('42[')) {
                try {
                    const [event, state] = JSON.parse(data.slice(2));
                    if (['tournament_game_state', 'SC_GAME_STATE', 'game_state'].includes(event)) {
                        handleBotTurn(ws, state, botState);
                    }
                } catch (_) {}
            }
        });
        ws.on('error', e => log('Bot error: ' + e.message));
    });
}

function handleBotTurn(ws, state, botState) {
    if (!state?.seats) return;
    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (!seat?.player) continue;
        const addr = (typeof seat.player === 'string' ? seat.player : seat.player.id || '').toLowerCase();
        if (addr !== BOT.address.toLowerCase()) continue;
        if (state.turn !== parseInt(seatId) || seat.folded) continue;
        const key = `${state.turn}-${state.street}`;
        const now = Date.now();
        if (botState.lastTurnKey !== key) { botState.lastTurnKey = key; botState.lastActionTime = 0; }
        if (now - botState.lastActionTime > 2000) {
            botState.lastActionTime = now;
            setTimeout(() => {
                const action = state.callAmount > 0 ? 'CALL' : 'CHECK';
                ws.send('42' + JSON.stringify([`CS_TOURNAMENT_${action}`, { tournamentId: botState.tournamentId }]));
                log(`Bot: ${action}`);
            }, 1200);
        }
    }
}

async function test() {
    if (!fs.existsSync('test-results')) fs.mkdirSync('test-results');

    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    await Runtime.enable();

    const screenshot = async (name) => {
        try {
            const { data } = await Page.captureScreenshot();
            fs.writeFileSync(`test-results/${name}.png`, Buffer.from(data, 'base64'));
            log(`📸 ${name}`);
        } catch (e) {
            log(`⚠️ 截图失败 ${name}: ${e.message}`);
        }
    };

    const eval_ = async (expr) => {
        const r = await Runtime.evaluate({ expression: expr, returnByValue: true, awaitPromise: true });
        return r.result?.value;
    };

    log('=== CDP游戏测试 Mock顺子NFT (通过前端流程铸造) ===');

    // Step 1: 创建 Mock 锦标赛
    log('[1] 创建 Mock 锦标赛');
    const createRes = await httpPost(`${API_URL}/api/tournament/create`, {
        configId: 3, walletAddress: PLAYER1.address, mockGame: true
    });
    if (!createRes.success) { log('创建失败: ' + JSON.stringify(createRes)); process.exit(1); }
    const tournamentId = createRes.tournament?.tournamentId || createRes.tournament?.id;
    log(`锦标赛ID: ${tournamentId}`);

    // Step 2: 导航到游戏页面
    log('[2] 导航到游戏页面');
    await Page.navigate({ url: `${BASE_URL}/tournament/${tournamentId}/play?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('01-play-page');

    // Step 3: 注入带私钥的 TronWeb 到页面（关键步骤！）
    log('[3] 注入带私钥的 TronWeb 到页面环境');
    const injectResult = await eval_(`
        (async function() {
            // 动态加载 TronWeb（如果还没有）
            if (!window.TronWeb) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tronweb@6.0.0/dist/TronWeb.js';
                document.head.appendChild(script);
                await new Promise(resolve => script.onload = resolve);
            }
            
            // 创建带私钥的 TronWeb 实例（强制覆盖 window.tronWeb）
            const tronWeb = new window.TronWeb({
                fullHost: 'https://nile.trongrid.io',
                privateKey: '${PLAYER1.privateKey}'
            });
            
            // 设置默认地址
            tronWeb.setAddress('${PLAYER1.address}');
            
            // 强制覆盖 window.tronWeb（即使 TronLink 已经注入）
            window.tronWeb = tronWeb;
            
            // 设置全局合约地址
            window.__NFT_CONTRACT_ONCHAIN = '${NFT_CONTRACT}';
            
            console.log('[CDP] TronWeb injected with private key');
            return 'TronWeb injected (forced): ' + tronWeb.defaultAddress?.base58;
        })()
    `);
    log(`注入结果: ${injectResult}`);
    await sleep(2000);

    // 验证注入
    const verifyResult = await eval_(`({
        tronWeb: !!window.tronWeb,
        hasPrivateKey: !!window.tronWeb?.defaultPrivateKey,
        address: window.tronWeb?.defaultAddress?.base58,
        nftContract: window.__NFT_CONTRACT_ONCHAIN
    })`);
    log(`验证: ${JSON.stringify(verifyResult)}`);
    await screenshot('02-tronweb-injected');

    // Step 4: Bot 加入锦标赛
    log('[4] Bot 加入锦标赛');
    const botWs = await startBot(tournamentId);
    await sleep(3000);

    // Step 5: 游戏循环
    log('[5] 游戏循环开始');
    let nftButtonClicked = false;
    let mintSuccess = false;
    
    for (let round = 1; round <= 60; round++) {
        await sleep(1000);
        
        // 检查页面状态
        const state = await eval_(`({
            buttons: Array.from(document.querySelectorAll('button')).filter(b=>!b.disabled).map(b=>b.textContent.trim()),
            url: window.location.href,
            swalVisible: document.querySelector('.swal2-popup') !== null,
            swalTitle: document.querySelector('.swal2-title')?.textContent
        })`);
        const btns = state?.buttons || [];
        log(`Round ${round}: [${btns.slice(0, 5).join(',')}] Swal:${state?.swalVisible ? state.swalTitle : 'no'}`);

        if (round % 10 === 0) await screenshot(`round-${round}`);

        // 检测并点击铸造按钮
        if (!nftButtonClicked) {
            // 检查是否有 Swal 弹窗
            const swalBtns = await eval_(`Array.from(document.querySelectorAll('.swal2-popup button')).map(b => b.textContent.trim())`);
            const mintBtn = swalBtns?.find(b => b.includes('铸造 NFT') || b.includes('Mint NFT'));
            
            if (mintBtn) {
                log('🎉 检测到 Swal 弹窗中的铸造按钮！');
                await screenshot('nft-button-detected');
                
                // 点击铸造按钮
                await eval_(`(function() {
                    const buttons = document.querySelectorAll('.swal2-popup button');
                    for (const btn of buttons) {
                        if (btn.textContent.includes('铸造 NFT') || btn.textContent.includes('Mint NFT')) {
                            btn.click();
                            return 'clicked mint button';
                        }
                    }
                    return 'not found';
                })()`);
                
                nftButtonClicked = true;
                log('✅ 已点击铸造 NFT 按钮，等待前端铸造...');
                await sleep(3000);
                await screenshot('after-mint-click');
                
                // 等待铸造完成
                for (let waitRound = 0; waitRound < 15; waitRound++) {
                    await sleep(1000);
                    const mintState = await eval_(`({
                        swalTitle: document.querySelector('.swal2-title')?.textContent,
                        swalHtml: document.querySelector('.swal2-html-container')?.textContent
                    })`);
                    log(`铸造等待 ${waitRound}: ${mintState?.swalTitle} - ${mintState?.swalHtml?.substring(0, 50)}`);
                    
                    if (mintState?.swalTitle?.includes('成功') || mintState?.swalHtml?.includes('上链铸造成功')) {
                        log('🎉 前端铸造成功！');
                        mintSuccess = true;
                        await screenshot('mint-success');
                        break;
                    }
                    
                    if (mintState?.swalTitle?.includes('失败')) {
                        log('❌ 铸造失败');
                        break;
                    }
                }
            }
        }
        
        // 如果铸造成功，退出循环
        if (mintSuccess) break;

        // 正常游戏操作
        if (btns.includes('Check')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Check' && !b.disabled)].click()`);
            log('Clicked: Check');
        } else if (btns.includes('Call')) {
            await eval_(`document.querySelectorAll('button')[Array.from(document.querySelectorAll('button')).findIndex(b=>b.textContent.trim()==='Call' && !b.disabled)].click()`);
            log('Clicked: Call');
        }
    }

    await screenshot('final-game');
    botWs.close();

    // Step 6: 检查数据库验证铸造结果
    log('[6] 检查数据库验证铸造结果');
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/poker_game');
    const col = mongoose.connection.collection('nftclaims');

    // 检查当前锦标赛的 NFT 记录
    const currentNft = await col.findOne({
        playerAddress: { $regex: new RegExp(PLAYER1.address, 'i') },
        gameId: { $regex: tournamentId.toString() }
    });
    
    if (currentNft) {
        log(`\n=== NFT 记录 ===`);
        log(`类型: ${currentNft.achievementType}`);
        log(`游戏ID: ${currentNft.gameId}`);
        log(`交易哈希: ${currentNft.txHash || '未上链'}`);
        log(`Token ID: ${currentNft.onchainTokenId || '无'}`);
        
        if (currentNft.txHash) {
            log(`\n✅ 链上铸造成功！`);
            log(`   https://nile.tronscan.org/#/transaction/${currentNft.txHash}`);
        } else {
            log(`\n❌ 未上链铸造，需要检查前端代码`);
        }
    } else {
        log('未找到当前锦标赛的 NFT 记录');
    }

    // Step 7: 验证 NFT 画廊
    log('[7] 验证 NFT 画廊');
    await Page.navigate({ url: `${BASE_URL}/nft?address=${PLAYER1.address}` });
    await Page.loadEventFired();
    await sleep(3000);
    await screenshot('nft-gallery');

    const totalNfts = await col.countDocuments({ playerAddress: { $regex: new RegExp(PLAYER1.address, 'i') } });
    const mintedNfts = await col.countDocuments({ 
        playerAddress: { $regex: new RegExp(PLAYER1.address, 'i') }, 
        txHash: { $exists: true, $ne: null } 
    });
    
    log(`\n=== 最终统计 ===`);
    log(`总 NFT 记录: ${totalNfts}`);
    log(`已上链铸造: ${mintedNfts}`);

    await mongoose.disconnect();
    await client.close();
    
    if (currentNft?.txHash) {
        log('\n✅ 测试完成 - 通过前端流程铸造成功！');
    } else {
        log('\n⚠️ 测试完成 - 但前端流程铸造失败，需要检查');
    }
}

test().catch(e => { console.error(e); process.exit(1); });
