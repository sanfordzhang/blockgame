/**
 * 查询合约中所有玩家余额
 * Usage: node check-contract-balance.js
 */

const path = require('path');
const fs = require('fs');
const { TronWeb } = require('tronweb');

// 测试网配置 - 设置一个默认地址用于读取合约
const tronWeb = new TronWeb({
  fullHost: 'https://nile.trongrid.io',
});

const CONTRACT_ADDRESS = 'TPrXy7qsoY3rEutSPmEF14sJjjijxpHGpv';

// 设置默认地址（用于合约调用）
tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'); // 零地址

// 已知的玩家地址列表
const KNOWN_PLAYERS = [
  'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',  // 玩家2 (合约Owner)
  'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA',  // 服务器钱包
];

async function checkContractBalance() {
  try {
    // 加载 ABI
    const buildPath = path.join(__dirname, 'build/contracts/BridgeGameV1.json');
    const artifact = JSON.parse(fs.readFileSync(buildPath, 'utf8'));
    const abi = artifact.abi;
    
    // 加载合约
    const contract = tronWeb.contract(abi, CONTRACT_ADDRESS);
    
    console.log('='.repeat(60));
    console.log('合约余额查询');
    console.log('合约地址:', CONTRACT_ADDRESS);
    console.log('='.repeat(60));
    
    // 查询合约地址本身的 TRX 余额
    const contractBalance = await tronWeb.trx.getBalance(CONTRACT_ADDRESS);
    console.log('\n合约地址 TRX 余额:', contractBalance / 1e6, 'TRX');
    
    // 查询累计抽水
    try {
      const accumulatedRake = await contract.accumulatedRake().call();
      console.log('累计抽水:', accumulatedRake.toString() / 1e6, 'TRX');
    } catch (e) {
      console.log('累计抽水: 查询失败 -', e.message);
    }
    
    // 查询抽水率
    try {
      const rakeRate = await contract.rakeRate().call();
      console.log('当前抽水率:', rakeRate.toString() / 100, '%');
    } catch (e) {
      console.log('当前抽水率: 查询失败 -', e.message);
    }
    
    // 查询游戏总数
    try {
      const totalGames = await contract.totalGamesPlayed().call();
      console.log('游戏总数:', totalGames.toString());
    } catch (e) {
      console.log('游戏总数: 查询失败 -', e.message);
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('玩家余额明细');
    console.log('='.repeat(60));
    
    // 查询已知玩家的余额
    for (const playerAddr of KNOWN_PLAYERS) {
      try {
        const playerInfo = await contract.getPlayerInfo(playerAddr).call();
        const balance = BigInt(playerInfo.balance) / 1000000n;
        const locked = BigInt(playerInfo.lockedAmount) / 1000000n;
        const isRegistered = playerInfo.isRegistered;
        
        console.log(`\n玩家: ${playerAddr}`);
        console.log(`  注册状态: ${isRegistered ? '已注册' : '未注册'}`);
        console.log(`  可用余额: ${balance} TRX`);
        console.log(`  锁定金额: ${locked} TRX`);
        console.log(`  总计: ${balance + locked} TRX`);
      } catch (err) {
        console.log(`\n玩家: ${playerAddr} - 查询失败:`, err.message);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('说明:');
    console.log('合约地址 TRX 余额 = 所有玩家 balance + lockedAmount + accumulatedRake');
    console.log('如果余额为 0，说明玩家已全部提现');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('查询失败:', error.message);
  }
}

checkContractBalance();
