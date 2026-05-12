// NFT 锻造完整游戏流程
// 使用 Socket.io 直接操作，完成游戏并触发 NFT 铸造

const io = require('socket.io-client');
const { TronWeb } = require('tronweb');

const PLAYER1_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2_ADDRESS = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const SERVER_URL = 'http://127.0.0.1:7778';
const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

let player1Socket = null;
let player2Socket = null;
let tournamentId = null;
let gameState = null;

async function main() {
    console.log('==========================================');
    console.log('  NFT 锻造完整游戏流程');
    console.log('==========================================');

    // Step 1: 连接玩家1 Socket
    console.log('[1] 连接玩家1 Socket...');
    player1Socket = io(SERVER_URL, { transports: ['websocket'] });
    
    await new Promise((resolve) => {
        player1Socket.on('connect', () => {
            console.log('✅ 玩家1 Socket 已连接:', player1Socket.id);
            resolve();
        });
    });

    // Step 2: 连接玩家2 Socket（机器人）
    console.log('[2] 连接玩家2 Socket...');
    player2Socket = io(SERVER_URL, { transports: ['websocket'] });
    
    await new Promise((resolve) => {
        player2Socket.on('connect', () => {
            console.log('✅ 玩家2 Socket 已连接:', player2Socket.id);
            resolve();
        });
    });

    // Step 3: 获取或创建锦标赛
    console.log('[3] 获取锦标赛列表...');
    const response = await fetch(`${SERVER_URL}/api/tournament/list`);
    const tournaments = await response.json();
    
    // 查找 IN_PROGRESS 或 WAITING 状态的锦标赛
    let targetTournament = tournaments.find(t => t.status === 'IN_PROGRESS' || t.status === 'WAITING');
    
    if (!targetTournament) {
        console.log('创建新锦标赛...');
        const createRes = await fetch(`${SERVER_URL}/api/tournament/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ configId: 3, walletAddress: PLAYER1_ADDRESS, mockGame: true })
        });
        const createData = await createRes.json();
        targetTournament = createData.tournament;
        console.log('锦标赛已创建:', targetTournament.id);
    }
    
    tournamentId = targetTournament.id;
    console.log('目标锦标赛:', tournamentId, '状态:', targetTournament.status);

    // Step 4: 加入锦标赛
    console.log('[4] 加入锦标赛...');
    
    // 玩家1 加入
    player1Socket.emit('CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: PLAYER1_ADDRESS });
    player1Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: PLAYER1_ADDRESS });
    
    // 玩家2 加入
    player2Socket.emit('CS_TOURNAMENT_JOIN', { tournamentId, walletAddress: PLAYER2_ADDRESS });
    player2Socket.emit('CS_TOURNAMENT_ROOM_JOIN', { tournamentId, walletAddress: PLAYER2_ADDRESS });

    // Step 5: 监听游戏状态
    console.log('[5] 监听游戏状态...');
    
    player1Socket.on('SC_TOURNAMENT_GAME_STATE', (state) => {
        gameState = state;
        console.log('游戏状态更新: turn=' + state.turn + ', street=' + state.street + ', pot=' + state.pot);
    });

    player1Socket.on('SC_NFT_ACHIEVEMENT', (data) => {
        console.log('🎉 NFT 成就!', data);
    });

    // Step 6: 等待游戏开始并执行操作
    console.log('[6] 等待游戏开始...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // 执行游戏操作
    for (let round = 0; round < 20; round++) {
        if (!gameState) {
            console.log('等待游戏状态...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
        }

        // 检查是否轮到玩家
        const mySeat = gameState.turn;
        const isMyTurn = gameState.seats[mySeat]?.player?.id?.toLowerCase() === PLAYER1_ADDRESS.toLowerCase();

        if (isMyTurn) {
            console.log(`回合 ${round}: 轮到玩家1，执行 Check`);
            player1Socket.emit('CS_TOURNAMENT_CHECK', { tournamentId });
        } else {
            console.log(`回合 ${round}: 轮到玩家2，执行 Check`);
            player2Socket.emit('CS_TOURNAMENT_CHECK', { tournamentId });
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // 检查游戏是否结束
        if (gameState?.street === 'showdown' || gameState?.winner) {
            console.log('游戏结束!');
            break;
        }
    }

    // Step 7: 等待 NFT 成就
    console.log('[7] 等待 NFT 成就...');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Step 8: 查询 NFT 余额
    console.log('[8] 查询 NFT 余额...');
    const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
    tronWeb.setAddress(PLAYER1_ADDRESS);
    
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    const balance = await contract.balanceOf(PLAYER1_ADDRESS).call();
    console.log('NFT 余额:', balance.toString());

    // 清理
    player1Socket.disconnect();
    player2Socket.disconnect();

    console.log('==========================================');
    console.log('  流程完成!');
    console.log('==========================================');
}

main().catch(console.error);
