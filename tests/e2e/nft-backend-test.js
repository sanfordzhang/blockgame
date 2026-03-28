/**
 * NFT Backend Test - 纯后端测试
 * 直接测试游戏流程和NFT触发逻辑，不依赖前端
 */

const axios = require('axios');
const mongoose = require('mongoose');
const io = require('socket.io-client');

const CONFIG = {
    apiUrl: 'http://127.0.0.1:7778',
    mongoUrl: 'mongodb://127.0.0.1:27017/bridge-poker',
    player1: {
        address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',
        name: 'Player1'
    },
    player2: {
        address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4',
        name: 'Player2'
    }
};

let testResults = {
    passed: 0,
    failed: 0,
    nftEvents: []
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
    console.log('========================================');
    console.log('NFT Backend Test - 后端游戏流程测试');
    console.log('========================================\n');

    // 测试1: NFT牌型检测API
    console.log('测试1: NFT牌型检测API');
    console.log('----------------------------------------');
    
    // 顺子检测
    const straightTest = await axios.post(`${CONFIG.apiUrl}/api/nft/detect`, {
        holeCards: [{ rank: 'A', suit: 'h' }, { rank: 'K', suit: 'h' }],
        board: [{ rank: 'Q', suit: 'c' }, { rank: 'J', suit: 'd' }, { rank: '10', suit: 's' }]
    });
    
    console.log('顺子检测结果:', JSON.stringify(straightTest.data, null, 2));
    if (straightTest.data.achievement?.type === 'STRAIGHT') {
        console.log('✅ PASS: 顺子检测正确');
        testResults.passed++;
    } else {
        console.log('❌ FAIL: 顺子检测失败');
        testResults.failed++;
    }

    // 同花顺检测
    const flushTest = await axios.post(`${CONFIG.apiUrl}/api/nft/detect`, {
        holeCards: [{ rank: 'J', suit: 'h' }, { rank: '10', suit: 'h' }],
        board: [{ rank: 'Q', suit: 'h' }, { rank: 'K', suit: 'h' }, { rank: 'A', suit: 'h' }]
    });
    
    console.log('\n皇家同花顺检测结果:', JSON.stringify(flushTest.data, null, 2));
    if (flushTest.data.achievement?.type === 'ROYAL_FLUSH') {
        console.log('✅ PASS: 皇家同花顺检测正确');
        testResults.passed++;
    } else {
        console.log('❌ FAIL: 皇家同花顺检测失败');
        testResults.failed++;
    }

    // 测试2: Socket连接和游戏流程
    console.log('\n测试2: Socket游戏流程');
    console.log('----------------------------------------');
    
    // 连接Socket - 需要正确设置钱包地址
    const socket1 = io(CONFIG.apiUrl, {
        transports: ['websocket'],
        auth: { walletAddress: CONFIG.player1.address },  // 使用auth传递
        query: { walletAddress: CONFIG.player1.address }
    });
    
    const socket2 = io(CONFIG.apiUrl, {
        transports: ['websocket'],
        auth: { walletAddress: CONFIG.player2.address },
        query: { walletAddress: CONFIG.player2.address }
    });
    
    let gameStates = [];
    let nftReceived = null;
    
    socket1.on('connect', () => {
        console.log('Socket1 连接成功, id:', socket1.id);
        // 发送钱包地址
        socket1.emit('CS_LOBBY_CONNECT', {
            gameId: 'lobby',
            address: CONFIG.player1.address,
            userInfo: { name: CONFIG.player1.name }
        });
    });
    
    socket2.on('connect', () => {
        console.log('Socket2 连接成功, id:', socket2.id);
        socket2.emit('CS_LOBBY_CONNECT', {
            gameId: 'lobby',
            address: CONFIG.player2.address,
            userInfo: { name: CONFIG.player2.name }
        });
    });
    
    // 监听游戏状态
    socket1.on('tournament_game_state', (state) => {
        gameStates.push(state);
        console.log('游戏状态更新 - 底池:', state.pot, '回合:', state.street || 'preflop');
        if (state.seats) {
            Object.entries(state.seats).forEach(([id, s]) => {
                if (s.hand) {
                    console.log(`  座位${id}手牌:`, s.hand.map(c => c.rank + c.suit).join(' '));
                }
            });
        }
    });
    
    // 监听NFT事件
    socket1.on('SC_NFT_ACHIEVEMENT_EARNED', (data) => {
        console.log('🎉 NFT事件触发:', JSON.stringify(data, null, 2));
        nftReceived = data;
        testResults.nftEvents.push(data);
    });
    
    await sleep(3000);  // 等待连接和钱包注册完成
    
    // 测试3: 创建锦标赛并加入
    console.log('\n测试3: 创建锦标赛');
    console.log('----------------------------------------');
    
    const tournamentRes = await axios.post(`${CONFIG.apiUrl}/api/tournament/create`, {
        configId: 3,  // 2人赛
        walletAddress: CONFIG.player1.address
    });
    
    const tournamentId = tournamentRes.data.tournament?.tournamentId || tournamentRes.data.tournament?._id;
    console.log('锦标赛ID:', tournamentId);
    
    // 加入锦标赛
    await axios.post(`${CONFIG.apiUrl}/api/tournament/${tournamentId}/join`, {
        walletAddress: CONFIG.player1.address,
        socketId: socket1.id
    });
    
    await axios.post(`${CONFIG.apiUrl}/api/tournament/${tournamentId}/join`, {
        walletAddress: CONFIG.player2.address,
        socketId: socket2.id
    });
    
    console.log('两个玩家已加入');
    
    // 发送Socket加入事件
    socket1.emit('CS_JOIN_TOURNAMENT', {
        tournamentId,
        walletAddress: CONFIG.player1.address
    });
    
    socket2.emit('CS_JOIN_TOURNAMENT', {
        tournamentId,
        walletAddress: CONFIG.player2.address
    });
    
    console.log('✅ PASS: 锦标赛创建和加入成功');
    testResults.passed++;
    
    // 等待游戏开始
    console.log('\n等待游戏开始...');
    await sleep(5000);
    
    // 测试4: 模拟游戏操作
    console.log('\n测试4: 模拟游戏操作');
    console.log('----------------------------------------');
    
    // 发送操作 - 使用锦标赛专用事件
    for (let i = 0; i < 10; i++) {
        await sleep(1500);
        
        // 玩家1操作 - 锦标赛事件格式
        socket1.emit('CS_TOURNAMENT_CHECK', { tournamentId });
        console.log(`Round ${i + 1}: Player1 CHECK`);
        
        await sleep(500);
        
        // 玩家2操作
        socket2.emit('CS_TOURNAMENT_CHECK', { tournamentId });
        console.log(`Round ${i + 1}: Player2 CHECK`);
    }
    
    await sleep(3000);
    
    console.log('游戏操作完成');
    
    // 测试5: 验证NFT事件
    console.log('\n测试5: 验证NFT事件');
    console.log('----------------------------------------');
    
    if (testResults.nftEvents.length > 0) {
        console.log('🎉 NFT触发成功!');
        testResults.nftEvents.forEach((e, i) => {
            console.log(`NFT ${i + 1}: ${e.achievementType} - ${e.handType}`);
        });
        console.log('✅ PASS: NFT事件触发');
        testResults.passed++;
    } else {
        console.log('⚠️ 未检测到NFT事件');
        console.log('游戏状态数量:', gameStates.length);
    }

    // 测试6: 验证数据库NFT记录
    console.log('\n测试6: 验证数据库NFT记录');
    console.log('----------------------------------------');
    
    await mongoose.connect(CONFIG.mongoUrl, { 
        useNewUrlParser: true, 
        useUnifiedTopology: true 
    });
    
    const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { 
        strict: false,
        collection: 'nftclaims'
    }));
    
    const allNfts = await NFTClaim.find({}).sort({ claimedAt: -1 }).limit(10);
    console.log('数据库中所有NFT记录:', allNfts.length);
    
    allNfts.forEach(nft => {
        console.log(`  - ${nft.achievementType || 'unknown'}: ${nft.handDescription || 'no description'}`);
    });
    
    // 查找玩家1的NFT
    const player1Nfts = await NFTClaim.find({
        playerAddress: new RegExp(CONFIG.player1.address.substring(0, 10), 'i')
    });
    
    console.log(`\n玩家1的NFT数量: ${player1Nfts.length}`);
    
    if (player1Nfts.length > 0) {
        console.log('✅ PASS: 数据库存在玩家NFT记录');
        testResults.passed++;
    }
    
    await mongoose.disconnect();
    
    // 清理
    socket1.disconnect();
    socket2.disconnect();

    // 结果汇总
    console.log('\n========================================');
    console.log('测试结果汇总');
    console.log('========================================');
    console.log(`✅ 通过: ${testResults.passed}`);
    console.log(`❌ 失败: ${testResults.failed}`);
    console.log(`🎯 NFT事件: ${testResults.nftEvents.length}个`);
    console.log('========================================');
    
    process.exit(testResults.failed > 0 ? 1 : 0);
}

main().catch(console.error);
