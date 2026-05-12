/**
 * CDP 完整游戏测试流程
 * 按照 docs/GAME_BOT_TEST_FLOW.md 执行
 * - Mock 顺子模式
 * - 机器人 + 玩家1 双人赛
 * - 触发 NFT 铸造（on-chain metadata）
 */
const CDP = require('chrome-remote-interface');
const io = require('socket.io-client');
const axios = require('axios');
const fs = require('fs');

const API = 'http://127.0.0.1:7778';
const FRONTEND = 'http://127.0.0.1:3001';

const PLAYER1 = { address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' };
const BOT     = { address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' };

let client, Page, Runtime;
let screenshotDir = 'test-results';

function log(msg) { console.log(`[${new Date().toLocaleTimeString()}] ${msg}`); }

async function screenshot(name) {
    if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);
    const { data } = await Page.captureScreenshot({ format: 'png' });
    const file = `${screenshotDir}/${name}.png`;
    fs.writeFileSync(file, data, 'base64');
    log(`📸 截图: ${file}`);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function evalJS(expr) {
    const r = await Runtime.evaluate({ expression: expr, awaitPromise: true });
    return r.result?.value;
}

async function clickButton(text) {
    return evalJS(`
        (function() {
            const btns = Array.from(document.querySelectorAll('button'));
            const btn = btns.find(b => b.textContent.trim() === '${text}' && !b.disabled);
            if (btn) { btn.click(); return true; }
            return false;
        })()
    `);
}

async function step1_startBot(tournamentId) {
    log('\n=== 步骤1: 启动机器人 ===');
    return new Promise((resolve, reject) => {
        const bot = io(API, { transports: ['websocket'] });

        bot.on('connect', () => {
            log(`✅ 机器人已连接: ${bot.id}`);

            // 加入锦标赛
            bot.emit('CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: BOT.address });
            bot.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: BOT.address });
            log(`机器人已加入锦标赛: ${tournamentId}`);

            // 监听游戏状态，自动操作
            bot.on('tournament_game_state', (state) => {
                const seat = Object.values(state.seats || {}).find(s => {
                    const addr = typeof s.player === 'string' ? s.player : (s.player?.id || s.player?.address || '');
                    return addr.toLowerCase() === BOT.address.toLowerCase();
                });

                if (seat?.turn) {
                    const callAmount = state.callAmount || 0;
                    if (callAmount === 0) {
                        log('机器人: Check');
                        bot.emit('CS_TOURNAMENT_CHECK', { tournamentId });
                    } else {
                        log(`机器人: Call ${callAmount}`);
                        bot.emit('CS_TOURNAMENT_CALL', { tournamentId });
                    }
                }
            });

            // 监听成就
            bot.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
                log(`🏆 机器人收到 NFT 成就: ${JSON.stringify(data)}`);
            });
        });

        bot.on('connect_error', reject);
        resolve(bot);
    });
}

async function step2_player1Join(tournamentId) {
    log('\n=== 步骤2: 玩家1加入锦标赛 ===');
    return new Promise((resolve) => {
        const player = io(API, { transports: ['websocket'] });

        player.on('connect', () => {
            log(`✅ 玩家1已连接: ${player.id}`);
            player.emit('CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: PLAYER1.address });
            player.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: PLAYER1.address });
            log('玩家1已加入锦标赛');

            // 监听游戏状态
            player.on('tournament_game_state', (state) => {
                const seat = Object.values(state.seats || {}).find(s => {
                    const addr = typeof s.player === 'string' ? s.player : (s.player?.id || s.player?.address || '');
                    return addr.toLowerCase() === PLAYER1.address.toLowerCase();
                });

                if (seat?.turn) {
                    const callAmount = state.callAmount || 0;
                    if (callAmount === 0) {
                        log('玩家1: Check');
                        player.emit('CS_TOURNAMENT_CHECK', { tournamentId });
                    } else {
                        log(`玩家1: Call ${callAmount}`);
                        player.emit('CS_TOURNAMENT_CALL', { tournamentId });
                    }
                }
            });

            // 监听 NFT 成就
            player.on('SC_NFT_ACHIEVEMENT_EARNED', async (data) => {
                log(`\n🏆 玩家1获得 NFT 成就!`);
                log(`   类型: ${data.achievement?.name || data.achievementType}`);
                log(`   牌型: ${data.achievement?.cards?.join(' ') || ''}`);
                resolve({ player, achievementData: data });
            });

            player.on('SC_TOURNAMENT_ENDED', () => {
                log('锦标赛结束');
                resolve({ player });
            });
        });
    });
}

async function main() {
    log('🎮 开始完整游戏流程测试（on-chain NFT）\n');

    // 连接 CDP
    client = await CDP({ port: 9222 });
    Page = client.Page;
    Runtime = client.Runtime;
    await Page.enable();
    await Runtime.enable();
    log('✅ CDP 连接成功');

    // 导航到锦标赛页面
    await Page.navigate({ url: `${FRONTEND}/tournament` });
    await sleep(3000);
    await screenshot('01-tournament-page');

    // 勾选 Mock 模式
    log('\n=== 启用 Mock 游戏模式 ===');
    const mockEnabled = await evalJS(`
        (function() {
            const cb = document.querySelector('input[data-testid="mock-game-checkbox"]');
            if (cb && !cb.checked) { cb.click(); return true; }
            return cb ? cb.checked : false;
        })()
    `);
    log(`Mock 模式: ${mockEnabled ? '✅ 已启用' : '⚠️  未找到开关，继续...'}`);
    await screenshot('02-mock-enabled');

    // 创建锦标赛（通过 API，确保 mockGame=true）
    log('\n=== 创建 Mock 锦标赛 ===');
    const createRes = await axios.post(`${API}/api/tournament/create`, {
        configId: 3,
        walletAddress: BOT.address,
        mockGame: true
    });
    const tournamentId = createRes.data.tournament?.tournamentId || createRes.data.tournamentId;
    log(`✅ 锦标赛创建: ${tournamentId}`);

    // 启动机器人
    const bot = await step1_startBot(tournamentId);
    await sleep(1000);

    // 玩家1加入（等待 NFT 成就）
    log('\n=== 玩家1加入，等待游戏完成 ===');
    const { player, achievementData } = await step2_player1Join(tournamentId);

    await sleep(3000);
    await screenshot('03-game-in-progress');

    // 等待游戏结束
    await sleep(10000);
    await screenshot('04-game-completed');

    // 检查 NFT 是否生成
    log('\n=== 检查 NFT 生成结果 ===');
    const nftsRes = await axios.get(`${API}/api/nft/player/${PLAYER1.address}`);
    const nfts = nftsRes.data.nfts || nftsRes.data;
    log(`玩家1 NFT 总数: ${Array.isArray(nfts) ? nfts.length : '?'}`);

    if (Array.isArray(nfts) && nfts.length > 0) {
        const latest = nfts[0];
        log(`最新 NFT: #${latest.tokenId} - ${latest.achievementType}`);
        log(`卡牌: ${latest.cards?.map(c => `${c.rank}${c.suit}`).join(' ') || latest.handDescription}`);

        // 验证 metadata
        const metaRes = await axios.get(`${API}/api/nft/metadata/6/${latest.tokenId}`);
        log(`\n✅ 元数据验证:`);
        log(`   name: ${metaRes.data.name}`);
        log(`   description: ${metaRes.data.description}`);
        log(`   image: ${metaRes.data.image?.substring(0, 40)}...`);
    }

    await screenshot('05-final-state');

    bot.disconnect?.();
    player.disconnect?.();
    await client.close();

    log('\n✅ 完整游戏流程测试结束！');
}

main().catch(err => {
    console.error('❌ 测试失败:', err.message);
    if (client) client.close();
    process.exit(1);
});
