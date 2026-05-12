/**
 * 检查特定用户的注入记录和 LP Token 余额
 */
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');

require('dotenv').config({ path: '.env.testnet' });

const PLAYER1 = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
const PLAYER2 = 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4';
const DEPLOYER = 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA';

async function checkMyInjections() {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    
    const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');
    
    const poolAddress = process.env.AMM_POOL_ADDRESS;
    const poolContract = await tronWeb.contract().at(poolAddress);
    
    console.log('========================================');
    console.log('🔍 检查你的流动性注入记录');
    console.log('========================================\n');
    
    // 1. 获取当前池状态
    const reserves = await poolContract.getReserves().call();
    const totalSupply = await poolContract.totalSupply().call();
    const totalLP = parseInt(totalSupply._hex || totalSupply.toString()) / 1e8;
    const reserveTRX = parseInt(reserves[0].toString()) / 1e6;
    const reserveCHIP = parseInt(reserves[1].toString()) / 1e6;
    
    console.log('当前池状态:');
    console.log(`  TRX: ${reserveTRX.toFixed(4)}`);
    console.log(`  CHIP: ${reserveCHIP.toFixed(2)}`);
    console.log(`  Total LP: ${totalLP.toFixed(4)}\n`);
    
    // 2. 检查各地址的 LP 余额
    const addresses = [
        { name: 'PLAYER1', address: PLAYER1 },
        { name: 'PLAYER2', address: PLAYER2 },
        { name: 'Deployer', address: DEPLOYER }
    ];
    
    console.log('--- LP Token 余额 ---\n');
    
    for (const item of addresses) {
        try {
            const balance = await poolContract.balanceOf(item.address).call();
            const lpBalance = parseInt(balance._hex || balance.toString()) / 1e8;
            const share = totalLP > 0 ? (lpBalance / totalLP * 100).toFixed(2) : '0';
            const userTRX = (reserveTRX * lpBalance / totalLP).toFixed(4);
            const userCHIP = (reserveCHIP * lpBalance / totalLP).toFixed(2);
            
            console.log(`${item.name} (${item.address}):`);
            console.log(`  LP Tokens: ${lpBalance.toFixed(4)} (${share}%)`);
            if (lpBalance > 0) {
                console.log(`  对应资产: ${userTRX} TRX + ${userCHIP} CHIP`);
            }
            console.log('');
        } catch (e) {
            console.log(`${item.name}: Error - ${e.message}\n`);
        }
    }
    
    // 3. 检查数据库记录
    console.log('--- 数据库注入记录 ---\n');
    
    const UserLiquidity = mongoose.model('UserLiquidity', new mongoose.Schema({}, { 
        strict: false,
        collection: 'userliquidities'
    }));
    
    const records = await UserLiquidity.find({}).lean();
    
    if (records.length === 0) {
        console.log('❌ 数据库中没有任何注入记录\n');
    } else {
        for (const record of records) {
            console.log(`用户: ${record.userAddress?.toUpperCase() || 'Unknown'}`);
            console.log(`  注入 TRX: ${record.depositedTRX || '0'}`);
            console.log(`  注入 CHIP: ${record.depositedCHIP || '0'}`);
            console.log(`  LP 余额: ${record.lpBalance || '0'}`);
            console.log(`  时间: ${record.createdAt}\n`);
        }
    }
    
    // 4. 查询 Router 合约的最近调用
    console.log('--- 如何查看你的注入交易 ---\n');
    console.log('方法1: 在 TronScan 查看你的钱包交易历史');
    console.log(`  PLAYER1: https://nile.tronscan.org/#/address/${PLAYER1}\n`);
    console.log(`  PLAYER2: https://nile.tronscan.org/#/address/${PLAYER2}\n`);
    
    console.log('方法2: 在 TronScan 查看 Pool 合约的交易历史');
    console.log(`  Pool: https://nile.tronscan.org/#/contract/${poolAddress}/transactions\n`);
    
    // 5. 推测注入情况
    console.log('--- 分析 ---\n');
    console.log('根据链上数据:');
    console.log(`  总池中有 ${reserveTRX.toFixed(2)} TRX 和 ${reserveCHIP.toFixed(2)} CHIP`);
    console.log(`  所有 LP Token 都在 Deployer 地址 (${DEPLOYER})`);
    console.log('\n可能的原因:');
    console.log('  1. 你注入时使用的是 Deployer 钱包（服务器私钥）');
    console.log('  2. 或者注入交易是通过后端 API 发起的，而不是通过前端钱包');
    console.log('\n解决方法:');
    console.log('  1. 如果你想用 PLAYER1 注入，确保前端连接的是 PLAYER1 的钱包');
    console.log('  2. 或者让 Deployer 转 LP Token 给你');
    
    await mongoose.disconnect();
}

checkMyInjections()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
