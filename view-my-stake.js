const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ 
    fullHost: 'https://nile.trongrid.io',
    privateKey: '01'
});

(async () => {
    const WALLET = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const CHIP = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
    const STAKING = 'TLQUifq6SDHz2rNBLTzJ2kEqsbhQXMfRCs';
    
    console.log('\n========================================');
    console.log('CHIP 资产状态');
    console.log('========================================');
    console.log('钱包地址:', WALLET);
    
    // CHIP 余额
    const chip = await tronWeb.contract().at(CHIP);
    const bal = await chip.balanceOf(WALLET).call();
    console.log('\nCHIP 余额:', Number(bal) / 1e6, 'CHIP');
    
    // 授权额度
    const allowance = await chip.allowance(WALLET, STAKING).call();
    console.log('已授权质押合约:', Number(allowance) / 1e6, 'CHIP');
    
    // 质押信息
    const staking = await tronWeb.contract().at(STAKING);
    const stakeData = await staking.stakes(WALLET).call();
    
    console.log('\n--- 质押信息 ---');
    if (stakeData.isActive && Number(stakeData.amount) > 0) {
        console.log('质押金额:', Number(stakeData.amount) / 1e6, 'CHIP');
        console.log('开始时间:', new Date(Number(stakeData.startTime) * 1000).toLocaleString());
        console.log('解锁时间:', new Date(Number(stakeData.lockedUntil) * 1000).toLocaleString());
        
        const now = Date.now() / 1000;
        const remaining = Number(stakeData.lockedUntil) - now;
        if (remaining > 0) {
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            console.log('剩余锁定:', days, '天', hours, '小时');
        } else {
            console.log('✅ 已解锁，可以提取');
        }
    } else {
        console.log('暂无质押');
    }
    
    // 总质押
    const total = await staking.totalStaked().call();
    console.log('\n平台总质押:', Number(total) / 1e6, 'CHIP');
    
    console.log('\n========================================');
    console.log('查看质押的其他方式');
    console.log('========================================');
    console.log('1. TronScan质押合约页面:');
    console.log('   https://nile.tronscan.org/#/contract/' + STAKING);
    console.log('   点击 "Read Contract" -> stakes(地址)');
    console.log('\n2. 运行本脚本:');
    console.log('   node view-my-stake.js');
})();
