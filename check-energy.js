const { TronWeb } = require('tronweb');
require('dotenv').config();

async function checkEnergy() {
    const address = process.env.MAINNET_PRIVATE_KEY
        ? new TronWeb({ fullHost: 'https://api.trongrid.io', privateKey: process.env.MAINNET_PRIVATE_KEY }).defaultAddress.base58
        : null;

    if (!address) {
        console.error('❌ 未配置 MAINNET_PRIVATE_KEY');
        process.exit(1);
    }

    const tronWeb = new TronWeb({ fullHost: 'https://api.trongrid.io' });

    console.log('⚡ 检查能量状态...\n');
    console.log('地址:', address);
    console.log('');

    try {
        const accountResources = await tronWeb.trx.getAccountResources(address);

        const energyLimit = accountResources.EnergyLimit || 0;
        const energyUsed = accountResources.EnergyUsed || 0;
        const energyAvailable = energyLimit - energyUsed;

        console.log('📊 能量状态：');
        console.log('  总能量:', energyLimit.toLocaleString());
        console.log('  已使用:', energyUsed.toLocaleString());
        console.log('  可用:', energyAvailable.toLocaleString());
        console.log('');

        // 检查 TRX 余额
        const balance = await tronWeb.trx.getBalance(address);
        console.log('💰 TRX 余额:', (balance / 1e6).toFixed(2), 'TRX');
        console.log('');

        // 评估是否需要租赁
        const deployNeed = 300000;
        const dailyNeed = 1000000;

        console.log('📋 需求评估：');
        console.log('  部署合约需要:', deployNeed.toLocaleString(), '能量');
        console.log('  日常运营需要:', dailyNeed.toLocaleString(), '能量/天');
        console.log('');

        if (energyAvailable < deployNeed) {
            console.log('⚠️  能量不足，建议租赁');
            console.log('');
            console.log('🔗 能量租赁平台：');
            console.log('  1. https://tronenergy.market (推荐)');
            console.log('  2. https://justlend.org');
            console.log('  3. https://tronnrg.com');
            console.log('');
            console.log('💡 租赁建议：');
            console.log('  部署：租赁 500,000 能量（1天）≈ 30 TRX');
            console.log('  运营：租赁 1,000,000 能量/天 ≈ 50 TRX/天');
        } else {
            console.log('✅ 能量充足，可以部署');
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

checkEnergy();
