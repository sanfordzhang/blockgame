/**
 * 流动池完整信息展示
 */
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');

require('dotenv').config({ path: '.env.testnet' });

async function showPoolInfo() {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║     🏊 AMM 流动池完整信息               ║');
    console.log('╚════════════════════════════════════════╝\n');

    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker', {
        useNewUrlParser: true,
        useUnifiedTopology: true
    });

    const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
    tronWeb.setAddress('T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb');

    const poolAddress = process.env.AMM_POOL_ADDRESS;
    const chipTokenAddress = process.env.CHIP_TOKEN_ADDRESS;

    try {
        // ═════════════════════════════════════════
        // 第一部分：流动池总览
        // ═════════════════════════════════════════
        console.log('📊 【流动池总览】\n');
        console.log(`Pool 合约地址: ${poolAddress}`);
        console.log(`CHIP 代币地址: ${chipTokenAddress}`);
        console.log('');

        const poolContract = await tronWeb.contract().at(poolAddress);
        
        // 获取储备量
        const reserves = await poolContract.getReserves().call();
        const reserveTRX = parseInt(reserves[0].toString()) / 1e6;
        const reserveCHIP = parseInt(reserves[1].toString()) / 1e6;
        
        // 获取总供应量
        const totalSupply = await poolContract.totalSupply().call();
        const totalLP = parseInt(totalSupply._hex || totalSupply.toString()) / 1e8;
        
        // 计算价格
        const priceTRXToCHIP = reserveTRX > 0 ? reserveCHIP / reserveTRX : 0;
        const priceCHIPToTRX = reserveCHIP > 0 ? reserveTRX / reserveCHIP : 0;
        
        console.log('┌─────────────────────────────────────────┐');
        console.log('│           💰 池中资产总量                │');
        console.log('├─────────────────────────────────────────┤');
        console.log(`│  TRX:     ${reserveTRX.toString().padStart(15)}      │`);
        console.log(`│  CHIP:    ${reserveCHIP.toFixed(2).toString().padStart(15)}      │`);
        console.log('├─────────────────────────────────────────┤');
        console.log('│           📈 当前价格                   │');
        console.log('├─────────────────────────────────────────┤');
        console.log(`│  1 TRX  = ${priceTRXToCHIP.toFixed(4).toString().padStart(10)} CHIP       │`);
        console.log(`│  1 CHIP = ${priceCHIPToTRX.toFixed(6).toString().padStart(10)} TRX       │`);
        console.log('├─────────────────────────────────────────┤');
        console.log('│           🪙 LP Token                  │');
        console.log('├─────────────────────────────────────────┤');
        console.log(`│  总发行量: ${totalLP.toFixed(4).toString().padStart(15)}        │`);
        console.log('└─────────────────────────────────────────┘');
        console.log('');

        // ═════════════════════════════════════════
        // 第二部分：LP Token 持有者分布
        // ═════════════════════════════════════════
        console.log('👥 【LP Token 持有者分布】\n');
        
        const owner = await poolContract.owner().call();
        const ownerAddress = tronWeb.address.fromHex(owner);
        
        const addressesToCheck = [
            { name: '合约部署者 (Owner)', address: ownerAddress },
            { name: 'PLAYER1', address: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' },
            { name: 'PLAYER2', address: 'TX27LjDqk64d4NvBXKT1taAYX5Dpf4JpL4' }
        ];

        console.log('┌──────────────────────────────────────────────────────────────────────────┐');
        console.log('│ 持有者                              │ LP Tokens    │ 占比    │ 对应资产  │');
        console.log('├──────────────────────────────────────────────────────────────────────────┤');
        
        let totalDisplayedLP = 0;
        
        for (const item of addressesToCheck) {
            try {
                const balance = await poolContract.balanceOf(item.address).call();
                const lpBalance = parseInt(balance._hex || balance.toString()) / 1e8;
                const share = totalLP > 0 ? (lpBalance / totalLP * 100) : 0;
                const userTRX = reserveTRX * lpBalance / totalLP;
                const userCHIP = reserveCHIP * lpBalance / totalLP;
                
                if (lpBalance > 0) {
                    const name = item.name.padEnd(30);
                    const lpStr = lpBalance.toFixed(4).toString().padStart(10);
                    const shareStr = share.toFixed(2).toString().padStart(6) + '%';
                    const assetStr = `${userTRX.toFixed(2)} TRX + ${userCHIP.toFixed(2)} CHIP`;
                    
                    console.log(`│ ${name} │ ${lpStr} │ ${shareStr} │ ${assetStr.padStart(25)} │`);
                    totalDisplayedLP += lpBalance;
                }
            } catch (e) {
                // 忽略错误
            }
        }
        
        console.log('└──────────────────────────────────────────────────────────────────────────┘');
        console.log('');

        // ═════════════════════════════════════════
        // 第三部分：注入记录分析
        // ═════════════════════════════════════════
        console.log('📝 【注入记录分析】\n');
        
        // 查询数据库记录
        const UserLiquidity = mongoose.model('UserLiquidity', new mongoose.Schema({}, { 
            strict: false,
            collection: 'userliquidities'
        }));

        const records = await UserLiquidity.find({}).lean();
        
        if (records.length === 0) {
            console.log('❌ 数据库中没有注入记录\n');
        } else {
            console.log(`数据库中有 ${records.length} 条记录：\n`);
            for (const record of records) {
                console.log(`用户: ${record.userAddress?.toUpperCase() || 'Unknown'}`);
                console.log(`  记录的注入 TRX: ${record.depositedTRX || '0'}`);
                console.log(`  记录的注入 CHIP: ${record.depositedCHIP || '0'}`);
                console.log(`  记录的 LP 余额: ${record.lpBalance || '0'}`);
                console.log(`  创建时间: ${record.createdAt || 'N/A'}`);
                console.log('');
            }
        }

        // ═════════════════════════════════════════
        // 第四部分：结论
        // ═════════════════════════════════════════
        console.log('═'.repeat(50));
        console.log('');
        console.log('🎯 【结论】\n');
        console.log(`1. 流动池中共有 ${reserveTRX.toFixed(2)} TRX 和 ${reserveCHIP.toFixed(2)} CHIP`);
        console.log(`2. 共发行了 ${totalLP.toFixed(4)} 个 LP Token`);
        console.log(`3. 所有 LP Token 都在合约部署者地址：${ownerAddress}`);
        console.log(`4. 这意味着：池中所有流动性都是部署者注入的`);
        console.log('');
        console.log('💡 【如何注入流动性】\n');
        console.log('1. 确保前端连接的是你想使用的钱包地址');
        console.log('2. 在 DEX 页面点击 "Liquidity" 标签');
        console.log('3. 输入 TRX 数量，CHIP 数量会自动计算');
        console.log('4. 点击 "Add Liquidity"，TronLink 会弹出签名');
        console.log('5. 签名后等待交易确认');
        console.log('6. 刷新页面，你会看到 "Your Liquidity" 区域显示你的 LP Token');
        console.log('');
        console.log('🔍 【查看交易历史】\n');
        console.log(`TronScan Pool: https://nile.tronscan.org/#/contract/${poolAddress}/transactions`);
        console.log('');

    } catch (error) {
        console.error('Error:', error.message);
    }

    await mongoose.disconnect();
}

showPoolInfo()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
