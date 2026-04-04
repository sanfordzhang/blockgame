const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ 
    fullHost: 'https://nile.trongrid.io',
    privateKey: '0000000000000000000000000000000000000000000000000000000000000001'
});

(async () => {
    const CHIP = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
    const STAKING = 'TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW';
    const WALLET = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    
    console.log('\n========================================');
    console.log('您的CHIP资产状态');
    console.log('========================================\n');
    console.log('钱包地址:', WALLET);
    
    // 使用triggerSmartContract查询余额
    const balanceResult = await tronWeb.transactionBuilder.triggerSmartContract(
        CHIP, 
        'balanceOf(address)', 
        {},
        [{ type: 'address', value: WALLET }]
    );
    const balance = parseInt(balanceResult.constant_result[0], 16);
    console.log('\nCHIP余额 (TronLink):', balance / 1e6, 'CHIP');
    
    // 查询授权额度
    const allowanceResult = await tronWeb.transactionBuilder.triggerSmartContract(
        CHIP, 
        'allowance(address,address)', 
        {},
        [
            { type: 'address', value: WALLET },
            { type: 'address', value: STAKING }
        ]
    );
    const allowance = parseInt(allowanceResult.constant_result[0], 16);
    console.log('已授权Staking合约:', allowance / 1e6, 'CHIP');
    
    // 查询质押信息
    const stakeResult = await tronWeb.transactionBuilder.triggerSmartContract(
        STAKING, 
        'stakes(address)', 
        {},
        [{ type: 'address', value: WALLET }]
    );
    
    // 解析返回值 (amount, startTime, lockedUntil, rewardDebt, isActive)
    const stakeData = stakeResult.constant_result[0];
    const amount = parseInt(stakeData.substring(0, 64), 16);
    const startTime = parseInt(stakeData.substring(64, 128), 16);
    const lockedUntil = parseInt(stakeData.substring(128, 192), 16);
    const isActive = parseInt(stakeData.substring(256, 320), 16);
    
    if (isActive && amount > 0) {
        console.log('\n当前质押信息:');
        console.log('  金额:', amount / 1e6, 'CHIP');
        if (lockedUntil > 0) {
            console.log('  解锁时间:', new Date(lockedUntil * 1000).toLocaleString());
        }
    } else {
        console.log('\n当前质押: 无活跃质押');
    }
    
    // 查询总质押金额
    const totalResult = await tronWeb.transactionBuilder.triggerSmartContract(
        STAKING, 
        'totalStaked()', 
        {},
        []
    );
    const totalStaked = parseInt(totalResult.constant_result[0], 16);
    console.log('\n平台总质押:', totalStaked / 1e6, 'CHIP');
    
    console.log('\n========================================');
    console.log('如何质押CHIP？');
    console.log('========================================');
    console.log('\n方法1: 使用脚本（推荐）');
    console.log('  node stake-chip-onchain.js <金额> <天数>');
    console.log('  示例: node stake-chip-onchain.js 1000 30');
    console.log('\n方法2: 通过TronScan');
    console.log('  访问: https://nile.tronscan.org/#/contract/' + STAKING);
    console.log('  连接TronLink钱包');
    console.log('  调用 stake(uint256 amount, uint256 lockDuration)');
    console.log('\n最小质押: 100 CHIP');
    console.log('锁定范围: 7-365 天');
})();
