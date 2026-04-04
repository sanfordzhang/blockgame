const TronWeb = require('tronweb');
const { generateMetadata } = require('./utils/metadata-generator');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.OWNER_PRIVATE_KEY
});

// 简化的 ABI（只包含需要的方法）
const ABI = [
    {"inputs":[{"name":"_signer","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[{"name":"achievementTypeId","type":"uint256"},{"name":"timestamp","type":"uint256"},{"name":"gameId","type":"string"},{"name":"metadata","type":"string"},{"name":"v","type":"uint8"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"}],"name":"claimNFT","outputs":[{"type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"}
];

async function main() {
    console.log('🚀 Starting on-chain NFT deployment...\n');

    // 步骤 1: 部署合约（手动部署后填入地址）
    const contractAddress = process.env.NFT_CONTRACT_ONCHAIN || 'TBD';

    if (contractAddress === 'TBD') {
        console.log('⚠️  请先手动部署合约，然后设置 NFT_CONTRACT_ONCHAIN 环境变量');
        console.log('合约文件: contracts/AchievementNFTOnChain.sol');
        console.log('构造参数: signer address =', process.env.SIGNER_ADDRESS);
        return;
    }

    // 步骤 2: 测试元数据生成
    console.log('📝 Testing metadata generation...');
    const testMetadata = generateMetadata('Straight', 1, '5h 6h 7h 8h 9d');
    console.log('✅ Metadata length:', testMetadata.length, 'bytes');
    console.log('Preview:', testMetadata.substring(0, 100) + '...\n');

    // 步骤 3: 连接合约
    console.log('🔗 Connecting to contract:', contractAddress);
    const contract = await tronWeb.contract(ABI, contractAddress);

    // 步骤 4: 测试读取（如果有已 mint 的 NFT）
    try {
        const uri = await contract.tokenURI(1).call();
        console.log('✅ Token #1 URI:', uri.substring(0, 100) + '...\n');
    } catch (e) {
        console.log('ℹ️  No token #1 yet\n');
    }

    console.log('✅ Setup complete!');
    console.log('\n下一步：');
    console.log('1. 修改 NFTService.js 的 recordClaim 方法，调用新合约时传入 metadata');
    console.log('2. 前端调用 claimNFT 时传入 metadata 参数');
}

main().catch(console.error);
