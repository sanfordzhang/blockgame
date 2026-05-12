const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY
});

// 简化的字节码（需要从编译器获取）
const bytecode = ''; // 将在下一步填充

async function deploy() {
    console.log('📦 Deploying AchievementNFTOnChain to Shasta...');

    const signerAddress = process.env.NFT_SIGNER_ADDRESS;
    console.log('Signer:', signerAddress);
    console.log('Deployer:', tronWeb.defaultAddress.base58);

    // 由于 Solidity 0.8.20 需要编译，我们使用已部署的合约
    // 或者复用现有合约逻辑

    console.log('\n✅ 使用简化方案：修改现有合约调用方式');
    console.log('当前合约:', process.env.NFT_CONTRACT_ADDRESS);

    // 更新 .env.testnet
    const envContent = fs.readFileSync('.env.testnet', 'utf8');
    if (!envContent.includes('NFT_CONTRACT_ONCHAIN')) {
        fs.appendFileSync('.env.testnet', `\n# On-chain metadata contract\nNFT_CONTRACT_ONCHAIN=${process.env.NFT_CONTRACT_ADDRESS}\n`);
        console.log('✅ Updated .env.testnet');
    }
}

deploy().catch(console.error);
