/**
 * 机器人 + CDP 完整游戏测试
 * 
 * 1. 启动机器人创建2人锦标赛
 * 2. 用CDP连接浏览器加入游戏
 * 3. 验证机器人自动操作
 */

const CDP = require('chrome-remote-interface');
const io = require('socket.io-client');

// 玩家配置
const PLAYER1 = {
    name: 'Player1',
    address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv'
};

const BOT = {
    name: 'Bot_Alice',
    address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4'
};

const SERVER_URL = 'http://127.0.0.1:7778';
const CDP_PORT = 9222;

let tournamentId = null;
let botSocket = null;
let gameState = { isMyTurn: false, lastActionTime: 0 };

// 延迟函数
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function log(prefix, msg, data = null) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [${prefix}] ${msg}`);
    if (data) console.log('  ', JSON.stringify(data, null, 2));
}

// ============ 机器人部分 ============
async function startBot() {
    return new Promise((resolve, reject) => {
        log('BOT', '启动机器人...');
        
        const socket = io(SERVER_URL, {
            transports: ['websocket'],
            query: { walletAddress: BOT.address }
        });
        
        socket.on('connect', async () => {
            log('BOT', '✅ 连接成功');
            botSocket = socket;
            
            // 发送钱包连接
            socket.emit('CS_LOBBY_CONNECT', {
                gameId: 'lobby',
                address: BOT.address,
                userInfo: { name: BOT.name }
            });
            
            await sleep(1000);
            
            // 创建锦标赛
            try {
                const resp = await fetch(`${SERVER_URL}/api/tournament/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        configId: 3,
                        walletAddress: BOT.address
                    })
                });
                const data = await resp.json();
                
                if (data.success && data.tournament) {
                    tournamentId = data.tournament.tournamentId || data.tournament.id;
                    log('BOT', `✅ 锦标赛创建成功: ${tournamentId}`);
                    
                    // 加入锦标赛
                    await sleep(500);
                    socket.emit('CS_TOURNAMENT_JOIN', {
                        tournamentId: tournamentId,
                        walletAddress: BOT.address
                    });
                    
                    await sleep(500);
                    socket.emit('CS_TOURNAMENT_ROOM_JOIN', {
                        tournamentId: tournamentId,
                        walletAddress: BOT.address
                    });
                    
                    log('BOT', '✅ 已加入锦标赛，等待玩家...');
                    resolve(socket);
                } else {
                    reject(new Error('创建锦标赛失败'));
                }
            } catch (err) {
                reject(err);
            }
        });
        
        socket.on('connect_error', reject);
        
        // 监听游戏状态
        socket.on('tournament_game_state', (state) => {
            handleBotGameState(state);
        });
        
        socket.on('SC_GAME_STATE', (state) => {
            handleBotGameState(state);
        });
        
        socket.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
            log('BOT', '🎉 NFT成就!', data);
        });
    });
}

// 机器人处理游戏状态
async function handleBotGameState(state) {
    if (!state || !state.seats) return;
    
    const botAddrLower = BOT.address.toLowerCase();
    
    for (const [seatId, seat] of Object.entries(state.seats)) {
        if (seat && seat.player && seat.player.address?.toLowerCase() === botAddrLower) {
            if (seat.hand) {
                log('BOT', `🃏 手牌: ${seat.hand.map(c => c.rank + c.suit).join(' ')}`);
            }
            
            const isMyTurn = state.turn === parseInt(seatId) && !seat.folded;
            const now = Date.now();
            
            if (isMyTurn && now - gameState.lastActionTime > 3000) {
                gameState.lastActionTime = now;
                log('BOT', `🎯 轮到我了！座位: ${seatId}`);
                
                await sleep(1500);
                
                let action = (!state.callAmount || state.callAmount === 0) ? 'CHECK' : 'CALL';
                log('BOT', `🤖 执行: ${action}`);
                
                botSocket.emit(`CS_TOURNAMENT_${action}`, { tournamentId });
            }
        }
    }
}

// ============ CDP 玩家部分 ============
async function connectBrowser() {
    log('CDP', '连接浏览器...');
    
    const client = await CDP({ port: CDP_PORT });
    const { Page, Runtime, Network } = client;
    
    await Page.enable();
    await Runtime.enable();
    await Network.enable();
    
    log('CDP', '✅ 浏览器已连接');
    return client;
}

async function navigateToTournament(client) {
    const { Page, Runtime } = client;
    
    // 导航到锦标赛页面
    const url = `http://127.0.0.1:3001/tournament`;
    log('CDP', `导航到: ${url}`);
    
    await Page.navigate({ url });
    await Page.loadEventFired();
    await sleep(3000);
    
    log('CDP', '✅ 页面加载完成');
}

async function joinTournament(client) {
    const { Runtime } = client;
    
    log('CDP', '加入锦标赛...');
    
    // 找到并点击加入按钮
    const clickResult = await Runtime.evaluate({
        expression: `
            (function() {
                // 找到锦标赛卡片或加入按钮
                const buttons = document.querySelectorAll('button');
                for (const btn of buttons) {
                    if (btn.textContent.includes('加入') || btn.textContent.includes('Join')) {
                        console.log('找到加入按钮:', btn.textContent);
                        btn.click();
                        return 'clicked join button';
                    }
                }
                
                // 如果没有找到按钮，检查是否已经在游戏中
                const gameArea = document.querySelector('[class*="game"], [class*="table"]');
                if (gameArea) {
                    return 'already in game';
                }
                
                return 'no join button found';
            })()
        `
    });
    
    log('CDP', '加入结果:', clickResult.result.value);
    await sleep(2000);
}

async function playGame(client) {
    const { Runtime } = client;
    
    log('CDP', '开始游戏循环...');
    
    for (let round = 0; round < 20; round++) {
        await sleep(2000);
        
        // 检查游戏状态
        const stateResult = await Runtime.evaluate({
            expression: `
                (function() {
                    const result = {
                        buttons: [],
                        cards: [],
                        pot: 0,
                        turn: null
                    };
                    
                    // 获取按钮
                    const buttons = document.querySelectorAll('button');
                    buttons.forEach(btn => {
                        if (btn.textContent.trim()) {
                            result.buttons.push({
                                text: btn.textContent.trim(),
                                disabled: btn.disabled,
                                visible: btn.offsetParent !== null
                            });
                        }
                    });
                    
                    // 获取手牌显示
                    const cardEls = document.querySelectorAll('[class*="card"], [class*="Card"]');
                    cardEls.forEach(el => {
                        if (el.textContent && el.textContent.length <= 3) {
                            result.cards.push(el.textContent.trim());
                        }
                    });
                    
                    // 获取底池
                    const potEl = document.querySelector('[class*="pot"], [class*="Pot"]');
                    if (potEl) {
                        result.pot = potEl.textContent;
                    }
                    
                    return result;
                })()
            `
        });
        
        const state = stateResult.result.value;
        log('CDP', `回合 ${round + 1}:`, state);
        
        // 查找可点击的操作按钮
        let actionClicked = false;
        for (const btn of state.buttons) {
            if (btn.visible && !btn.disabled) {
                const action = btn.text.toLowerCase();
                if (['check', 'call', 'raise'].some(a => action.includes(a))) {
                    log('CDP', `点击: ${btn.text}`);
                    
                    await Runtime.evaluate({
                        expression: `
                            (function() {
                                const buttons = document.querySelectorAll('button');
                                for (const btn of buttons) {
                                    if (btn.textContent.includes('${btn.text}') && !btn.disabled) {
                                        btn.click();
                                        return 'clicked ${btn.text}';
                                    }
                                }
                                return 'button not found';
                            })()
                        `
                    });
                    
                    actionClicked = true;
                    await sleep(2000);
                    break;
                }
            }
        }
        
        if (!actionClicked) {
            log('CDP', '没有可点击的操作按钮，等待...');
        }
    }
    
    log('CDP', '游戏循环结束');
}

// ============ 主函数 ============
async function main() {
    console.log('\n========================================');
    console.log('🤖 机器人 + CDP 游戏测试');
    console.log('========================================\n');
    
    try {
        // 1. 启动机器人
        await startBot();
        
        // 2. 等待一下
        await sleep(2000);
        
        // 3. 连接浏览器
        const client = await connectBrowser();
        
        // 4. 导航到锦标赛页面
        await navigateToTournament(client);
        
        // 5. 加入锦标赛
        await joinTournament(client);
        
        // 6. 游戏循环
        await playGame(client);
        
        // 保持运行
        log('TEST', '测试完成，按 Ctrl+C 退出');
        
    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

main();
