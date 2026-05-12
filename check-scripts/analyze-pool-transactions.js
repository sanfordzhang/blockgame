/**
 * 分析流动池的所有交易
 */
const { TronWeb } = require('tronweb');

require('dotenv').config({ path: '.env.testnet' });

async function analyzePoolTransactions() {
    const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

    const poolAddress = process.env.AMM_POOL_ADDRESS;
    const routerAddress = process.env.AMM_ROUTER_ADDRESS;
    
    console.log('========================================');
    console.log('🔍 Pool Transaction Analysis');
    console.log('========================================\n');
    console.log(`Pool: ${poolAddress}`);
    console.log(`Router: ${routerAddress}\n`);

    try {
        // 1. 查询池合约的所有者
        const poolContract = await tronWeb.contract().at(poolAddress);
        const owner = await poolContract.owner().call();
        const ownerAddress = tronWeb.address.fromHex(owner);
        console.log('Pool Owner:', ownerAddress);

        // 2. 查询当前储备
        const reserves = await poolContract.getReserves().call();
        const reserveTRX = parseInt(reserves[0].toString()) / 1e6;
        const reserveCHIP = parseInt(reserves[1].toString()) / 1e6;
        
        console.log(`\n当前储备:`);
        console.log(`  TRX: ${reserveTRX.toFixed(4)}`);
        console.log(`  CHIP: ${reserveCHIP.toFixed(2)}`);

        // 3. 查询总 LP 供应量
        const totalSupply = await poolContract.totalSupply().call();
        const totalLP = parseInt(totalSupply._hex || totalSupply.toString()) / 1e8;
        console.log(`  Total LP: ${totalLP.toFixed(4)}`);

        // 4. 查询主要地址的 LP 余额
        console.log('\n--- LP Token 持有情况 ---\n');
        
        const addressesToCheck = [
            { name: 'Owner (Deployer)', address: ownerAddress },
            { name: 'Pool Contract', address: poolAddress },
            { name: 'Router Contract', address: routerAddress },
            { name: 'PLAYER1', address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' },
            { name: 'PLAYER2', address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' }
        ];

        for (const item of addressesToCheck) {
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
                console.log(`${item.name}: 查询失败 - ${e.message}\n`);
            }
        }

        // 5. 通过 TronGrid API 查询交易历史
        console.log('\n--- 查询池的 TRX 转账记录 ---\n');
        
        try {
            // 查询发送到池的 TRX 交易
            const txList = await tronWeb.trx.getTransactionsRelated(poolAddress, 'to', 20);
            
            if (txList && txList.length > 0) {
                console.log(`找到 ${txList.length} 笔交易:\n`);
                
                for (const tx of txList) {
                    const txId = tx.txID;
                    const from = tronWeb.address.fromHex(tx.raw_data.contract[0].parameter.value.owner_address);
                    const amount = tx.raw_data.contract[0].parameter.value.amount / 1e6;
                    const timestamp = new Date(tx.raw_data.timestamp).toLocaleString();
                    
                    // 判断交易类型
                    const contractType = tx.raw_data.contract[0].type;
                    
                    console.log(`[${timestamp}]`);
                    console.log(`  TX: ${txId}`);
                    console.log(`  From: ${from}`);
                    console.log(`  Type: ${contractType}`);
                    
                    if (contractType === 'TriggerSmartContract') {
                        console.log(`  Contract Call (可能是添加流动性或 Swap)`);
                    } else if (amount > 0) {
                        console.log(`  Amount: ${amount.toFixed(4)} TRX`);
                    }
                    console.log('');
                }
            } else {
                console.log('未找到交易记录');
            }
        } catch (e) {
            console.log('查询交易历史失败:', e.message);
        }

        // 6. 检查最近的交易（通过 TronScan API）
        console.log('\n--- 在 TronScan 上查看交易 ---');
        console.log(`https://nile.tronscan.org/#/contract/${poolAddress}/transactions`);

    } catch (error) {
        console.error('Error:', error.message);
        console.error(error.stack);
    }

    console.log('\n✓ Done');
}

analyzePoolTransactions()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
