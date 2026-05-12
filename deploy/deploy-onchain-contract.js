const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY
});

async function deploy() {
    console.log('📦 Deploying AchievementNFTOnChain...');
    console.log('Signer:', process.env.NFT_SIGNER_ADDRESS);

    // 读取合约源码
    const source = fs.readFileSync('./contracts/AchievementNFTOnChain.sol', 'utf8');

    // 部署参数
    const params = {
        abi: [],
        bytecode: '',
        feeLimit: 1500000000,
        callValue: 0,
        userFeePercentage: 100,
        originEnergyLimit: 10000000,
        parameters: [process.env.NFT_SIGNER_ADDRESS],
        name: 'AchievementNFTOnChain'
    };

    console.log('\n⚠️  请手动部署合约：');
    console.log('1. 访问 https://www.tronide.io/');
    console.log('2. 粘贴 contracts/AchievementNFTOnChain.sol');
    console.log('3. 编译并部署，构造参数:', process.env.NFT_SIGNER_ADDRESS);
    console.log('4. 部署后将合约地址添加到 .env.testnet: NFT_CONTRACT_ONCHAIN=...');
}

deploy().catch(console.error);
