/**
 * 查询用户注入流动性的详细记录
 */
const mongoose = require('mongoose');
const { TronWeb } = require('tronweb');

require('dotenv').config({ path: '.env.testnet' });

async function checkUserLiquidityHistory() {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });
    console.log('✓ Connected to MongoDB\n');

    // 初始化 TronWeb
    const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

    const poolAddress = process.env.AMM_POOL_ADDRESS;
    const chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS;

    console.log('========================================');
    console.log('💧 User Liquidity Injection Records');
    console.log('========================================\n');

    try {
        // 1. 查询所有 UserLiquidity 记录
        const UserLiquidity = mongoose.model('UserLiquidity', new mongoose.Schema({}, { 
            strict: false,
            collection: 'userliquidities'
        }));

        const allUsers = await UserLiquidity.find({}).lean();
        
        console.log('=== 数据库中的用户流动性记录 ===\n');
        
        for (const user of allUsers) {
            console.log(`用户地址: ${user.userAddress?.toUpperCase() || 'Unknown'}`);
            console.log(`  注入 TRX 总量: ${user.depositedTRX || '0'}`);
            console.log(`  注入 CHIP 总量: ${user.depositedCHIP || '0'}`);
            console.log(`  LP Token 余额: ${user.lpBalance || '0'}`);
            console.log(`  占比: ${user.share || 0}%`);
            console.log(`  最后更新: ${user.lastUpdateAt || 'N/A'}`);
            console.log('');
        }

        // 2. 查询链上当前状态
        console.log('\n=== 链上当前状态 ===\n');
        
        const poolContract = await tronWeb.contract().at(poolAddress);
        
        const reserves = await poolContract.getReserves().call();
        const reserveTRX = (parseInt(reserves[0].toString()) / 1e6).toFixed(4);
        const reserveCHIP = (parseInt(reserves[1].toString()) / 1e6).toFixed(2);
        const totalSupply = await poolContract.totalSupply().call();
        const totalLP = (parseInt(totalSupply._hex || totalSupply.toString()) / 1e8).toFixed(4);
        
        console.log(`池中 TRX: ${reserveTRX}`);
        console.log(`池中 CHIP: ${reserveCHIP}`);
        console.log(`总 LP Tokens: ${totalLP}\n`);

        // 3. 查询每个用户的链上余额
        console.log('=== 用户链上 LP Token 余额 ===\n');
        
        const uniqueAddresses = [...new Set(allUsers.map(u => u.userAddress?.toUpperCase()).filter(Boolean))];
        
        for (const addr of uniqueAddresses) {
            try {
                const balance = await poolContract.balanceOf(addr).call();
                const lpBalance = (parseInt(balance._hex || balance.toString()) / 1e8).toFixed(4);
                const share = totalLP > 0 ? ((lpBalance / totalLP) * 100).toFixed(2) : '0.00';
                
                console.log(`${addr}:`);
                console.log(`  LP Tokens: ${lpBalance}`);
                console.log(`  占比: ${share}%`);
                
                // 根据比例计算对应的 TRX 和 CHIP
                const userTRX = (reserveTRX * (lpBalance / totalLP)).toFixed(4);
                const userCHIP = (reserveCHIP * (lpBalance / totalLP)).toFixed(2);
                console.log(`  对应资产: ${userTRX} TRX + ${userCHIP} CHIP`);
                console.log('');
            } catch (e) {
                console.log(`${addr}: 查询失败 - ${e.message}`);
            }
        }

        // 4. 查询池状态变化历史
        console.log('\n=== 池状态变化历史 ===\n');
        
        const PoolState = mongoose.model('PoolState', new mongoose.Schema({}, { 
            strict: false,
            collection: 'poolstates'
        }));

        const poolStates = await PoolState.find({})
            .sort({ updatedAt: -1 })
            .limit(10)
            .lean();

        if (poolStates.length > 0) {
            let prevTRX = null;
            let prevCHIP = null;
            
            for (const state of poolStates) {
                const time = new Date(state.updatedAt).toLocaleString();
                const trx = (parseInt(state.reserve0) / 1e6).toFixed(4);
                const chip = (parseInt(state.reserve1) / 1e6).toFixed(2);
                const lp = (parseInt(state.totalSupply) / 1e8).toFixed(4);
                
                let change = '';
                if (prevTRX !== null) {
                    const trxChange = (parseFloat(trx) - parseFloat(prevTRX)).toFixed(4);
                    const chipChange = (parseFloat(chip) - parseFloat(prevCHIP)).toFixed(2);
                    
                    if (parseFloat(trxChange) > 0) {
                        change = ` [注入: +${trxChange} TRX, +${chipChange} CHIP]`;
                    } else if (parseFloat(trxChange) < 0) {
                        change = ` [移除: ${trxChange} TRX, ${chipChange} CHIP]`;
                    }
                }
                
                console.log(`[${time}] TRX: ${trx}, CHIP: ${chip}, LP: ${lp}${change}`);
                
                prevTRX = trx;
                prevCHIP = chip;
            }
        } else {
            console.log('无历史记录');
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }

    await mongoose.disconnect();
    console.log('\n✓ Done');
}

checkUserLiquidityHistory()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
