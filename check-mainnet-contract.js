const { TronWeb } = require('tronweb');
require('dotenv').config();

async function checkMainnetContract() {
    const contractAddress = process.env.MAINNET_CONTRACT_ADDRESS;

    if (!contractAddress) {
        console.error('❌ 未配置 MAINNET_CONTRACT_ADDRESS');
        process.exit(1);
    }

    const tronWeb = new TronWeb({
        fullHost: 'https://api.trongrid.io',
        privateKey: process.env.MAINNET_PRIVATE_KEY
    });

    console.log('🔍 检查主网合约状态...\n');
    console.log('合约地址:', contractAddress);
    console.log('');

    try {
        const contract = await tronWeb.contract().at(contractAddress);

        // 检查 owner
        const owner = await contract.owner().call();
        const ownerBase58 = tronWeb.address.fromHex(owner);
        console.log('✅ Owner:', ownerBase58);

        // 检查抽水比例
        const rakeRate = await contract.rakeRate().call();
        console.log('✅ 抽水比例:', Number(rakeRate) / 100, '%');

        // 检查抽水接收地址
        const rakeRecipient = await contract.rakeRecipient().call();
        const recipientBase58 = tronWeb.address.fromHex(rakeRecipient);
        console.log('✅ 抽水接收地址:', recipientBase58);

        // 检查服务器钱包余额
        const serverAddress = recipientBase58;
        const balance = await tronWeb.trx.getBalance(serverAddress);
        console.log('✅ 服务器钱包余额:', balance / 1e6, 'TRX');

        console.log('');
        console.log('🎉 合约状态正常！');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        process.exit(1);
    }
}

checkMainnetContract();
