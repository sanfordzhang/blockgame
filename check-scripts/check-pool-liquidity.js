/**
 * 查询流动池信息
 * 显示：池中TRX/CHIP数量、各用户注入的流动性
 */
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

// 加载环境变量
require('dotenv').config({ path: '.env.testnet' });

async function checkPoolLiquidity() {
    // 连接数据库
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
    console.log('✓ Connected to MongoDB');

    // 初始化TronWeb
    const tronWeb = new TronWeb({
        fullHost: 'https://nile.trongrid.io'
    });
    
    // 设置默认地址（TronWeb v6 需要）
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb'); // 任意有效地址

    // 获取配置
    const poolAddress = process.env.AMM_POOL_ADDRESS;
    const chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS;

    console.log('\n========================================');
    console.log('📊 AMM Pool Liquidity Information');
    console.log('========================================');
    console.log(`Pool Address: ${poolAddress}`);
    console.log(`CHIP Token: ${chipTokenAddress}`);

    try {
        // 1. 查询链上储备量
        console.log('\n--- 链上储备量 ---');
        const poolContract = await tronWeb.contract().at(poolAddress);
        
        const reserves = await poolContract.getReserves().call();
        const reserveTRX = (parseInt(reserves[0].toString()) / 1e6).toFixed(4);
        const reserveCHIP = (parseInt(reserves[1].toString()) / 1e6).toFixed(2);
        
        console.log(`TRX Reserve: ${reserveTRX} TRX`);
        console.log(`CHIP Reserve: ${reserveCHIP} CHIP`);

        // 查询总流动性代币
        const totalSupplyResult = await poolContract.totalSupply().call();
        const totalLPTokens = (parseInt(totalSupplyResult._hex || totalSupplyResult.toString()) / 1e8).toFixed(4);
        console.log(`Total LP Tokens: ${totalLPTokens}`);
        
        // 计算价格
        const price = (reserveCHIP / reserveTRX).toFixed(6);
        console.log(`Price: ${price} CHIP/TRX`);

        // 2. 查询数据库中的用户流动性记录
        console.log('\n--- 用户流动性记录 (数据库) ---');
        const UserLiquidity = mongoose.model('UserLiquidity', new mongoose.Schema({}, { 
            strict: false,
            collection: 'userliquidities'
        }));
        
        const userLiquidities = await UserLiquidity.find({}).sort({ createdAt: -1 }).lean();
        
        if (userLiquidities.length === 0) {
            console.log('❌ No user liquidity records found in database');
        } else {
            console.log(`Found ${userLiquidities.length} liquidity provider(s):\n`);
            
            for (const record of userLiquidities) {
                const userAddress = record.userAddress || 'Unknown';
                // LP Token 的精度需要确认，可能是 1e8
                const lpAmount = record.lpBalance ? (parseInt(record.lpBalance) / 1e8).toFixed(4) : '0';
                const totalLPNum = parseInt(totalSupplyResult._hex || totalSupplyResult.toString());
                const userLPNum = parseInt(record.lpBalance || 0);
                const share = totalLPNum > 0 
                    ? ((userLPNum / totalLPNum) * 100).toFixed(2) 
                    : '0.00';
                
                console.log(`User: ${userAddress.toUpperCase()}`);
                console.log(`  LP Tokens: ${lpAmount}`);
                console.log(`  Share: ${share}%`);
                console.log(`  Deposited TRX: ${record.depositedTRX || '0'}`);
                console.log(`  Deposited CHIP: ${record.depositedCHIP || '0'}`);
                
                if (record.trxAmount && record.chipAmount) {
                    const trxAmount = (record.trxAmount / 1e6).toFixed(4);
                    const chipAmount = (record.chipAmount / 1e6).toFixed(2);
                    console.log(`  Deposited: ${trxAmount} TRX + ${chipAmount} CHIP`);
                }
                
                if (record.createdAt) {
                    console.log(`  Time: ${new Date(record.createdAt).toLocaleString()}`);
                }
                console.log('');
            }
        }

        // 3. 查询池状态历史
        console.log('\n--- 池状态历史 ---');
        const PoolState = mongoose.model('PoolState', new mongoose.Schema({}, { 
            strict: false,
            collection: 'poolstates'
        }));
        
        const poolStates = await PoolState.find({})
            .sort({ updatedAt: -1 })
            .limit(5)
            .lean();
        
        if (poolStates.length > 0) {
            console.log('Recent pool states:\n');
            for (const state of poolStates) {
                const trxReserve = state.reserve0 ? (parseInt(state.reserve0) / 1e6).toFixed(4) : 'N/A';
                const chipReserve = state.reserve1 ? (parseInt(state.reserve1) / 1e6).toFixed(2) : 'N/A';
                const totalLP = state.totalSupply ? (parseInt(state.totalSupply) / 1e8).toFixed(4) : 'N/A';
                
                console.log(`Time: ${new Date(state.updatedAt).toLocaleString()}`);
                console.log(`  TRX Reserve: ${trxReserve}`);
                console.log(`  CHIP Reserve: ${chipReserve}`);
                console.log(`  Total LP Tokens: ${totalLP}`);
                console.log(`  Price: ${state.price0?.toFixed(6) || 'N/A'} CHIP/TRX`);
                console.log('');
            }
        }

        // 4. 查询交易历史
        console.log('\n--- 近期交易记录 ---');
        const SwapEvent = mongoose.model('SwapEvent', new mongoose.Schema({}, { 
            strict: false,
            collection: 'swapevents'
        }));
        
        const swapEvents = await SwapEvent.find({})
            .sort({ blockTimestamp: -1 })
            .limit(10)
            .lean();
        
        if (swapEvents.length === 0) {
            console.log('No swap events found');
        } else {
            console.log(`Found ${swapEvents.length} recent swaps:\n`);
            for (const event of swapEvents) {
                const time = event.blockTimestamp ? new Date(event.blockTimestamp * 1000).toLocaleString() : 'N/A';
                const user = event.user || event.sender || 'Unknown';
                console.log(`[${time}] User: ${user}`);
                console.log(`  ${event.amountTRXIn ? 'TRX→CHIP' : 'CHIP→TRX'}`);
                if (event.amountTRXIn) {
                    console.log(`  In: ${(event.amountTRXIn / 1e6).toFixed(4)} TRX`);
                    console.log(`  Out: ${(event.amountCHIPOut / 1e6).toFixed(2)} CHIP`);
                } else if (event.amountCHIPIn) {
                    console.log(`  In: ${(event.amountCHIPIn / 1e6).toFixed(2)} CHIP`);
                    console.log(`  Out: ${(event.amountTRXOut / 1e6).toFixed(4)} TRX`);
                }
                console.log('');
            }
        }

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }

    await mongoose.disconnect();
    console.log('\n✓ Done');
}

checkPoolLiquidity()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
