/**
 * 使用claimNFT mint新NFT，触发TronScan爬取
 */
require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.NILE_PRIVATE_KEY
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function claimNewNFT() {
    console.log('🎨 Claim新NFT（会触发TronScan爬取）\n');

    const myAddress = tronWeb.defaultAddress.base58;
    const contract = await tronWeb.contract().at(NFT_CONTRACT);

    // 准备签名参数（简化版，实际需要后端签名）
    const achievementType = 6; // STRAIGHT
    const timestamp = Math.floor(Date.now() / 1000);
    const deadline = timestamp + 7 * 24 * 60 * 60;

    console.log('接收地址:', myAddress);
    console.log('成就类型:', achievementType);

    try {
        // 尝试调用claimNFT
        const tx = await contract.claimNFT(
            achievementType,
            timestamp,
            deadline,
            27, // v
            '0x' + '0'.repeat(64), // r
            '0x' + '0'.repeat(64)  // s
        ).send({ feeLimit: 100_000_000 });

        console.log('✅ 交易:', tx);
    } catch (error) {
        console.log('❌ Claim失败:', error.message);
        console.log('\n需要有效的后端签名才能mint NFT');
        console.log('请使用前端页面的正常流程来mint NFT');
    }
}

claimNewNFT().catch(console.error);
