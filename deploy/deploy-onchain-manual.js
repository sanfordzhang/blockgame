const TronWeb = require('tronweb');
const fs = require('fs');
require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://api.shasta.trongrid.io',
    privateKey: process.env.TESTNET_PRIVATE_KEY
});

// 合约 ABI
const abi = [
    {"inputs":[{"name":"_signer","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},
    {"inputs":[{"name":"achievementTypeId","type":"uint256"},{"name":"timestamp","type":"uint256"},{"name":"gameId","type":"string"},{"name":"metadata","type":"string"},{"name":"v","type":"uint8"},{"name":"r","type":"bytes32"},{"name":"s","type":"bytes32"}],"name":"claimNFT","outputs":[{"type":"uint256"}],"stateMutability":"payable","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"}],"name":"tokenURI","outputs":[{"type":"string"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"name":"tokenId","type":"uint256"},{"name":"metadata","type":"string"}],"name":"setTokenMetadata","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

console.log('⚠️  请手动部署合约：\n');
console.log('1. 访问 https://www.tronide.io/');
console.log('2. 复制 contracts/AchievementNFTOnChain.sol 内容');
console.log('3. 编译器版本: 0.8.20');
console.log('4. 构造参数:', process.env.NFT_SIGNER_ADDRESS);
console.log('5. 部署后将地址保存到 .env.testnet: NFT_CONTRACT_ONCHAIN=...\n');
console.log('合约 ABI 已准备好，保存到 contract-abi.json');

fs.writeFileSync('contract-abi.json', JSON.stringify(abi, null, 2));
console.log('✅ ABI 已保存');
