require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');

const MONGO_URL = 'mongodb://127.0.0.1:27017/bridge-poker';
const NFT_CONTRACT = process.env.NFT_CONTRACT_ONCHAIN || 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';
const PLAYER_ADDRESS = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: process.env.SERVER_PRIVATE_KEY
});

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: String,
    achievementType: String,
    achievementTypeId: Number,
    displayName: String,
    handDescription: String,
    cards: Array,
    rarity: String,
    gameId: String,
    tokenId: Number,
    onchainTokenId: Number,
    txHash: String,
    claimedAt: Date,
    mintedAt: Date,
    gameScreenshot: String
}, { timestamps: true });

async function main() {
    console.log('========================================');
    console.log('创建测试 NFT');
    console.log('========================================\n');

    // 连接数据库
    await mongoose.connect(MONGO_URL);
    const NFTClaim = mongoose.model('NFTClaim', NFTClaimSchema);

    // 生成唯一的 tokenId
    const tokenId = Date.now();
    console.log('tokenId:', tokenId);

    // 创建数据库记录
    const nftData = {
        playerAddress: PLAYER_ADDRESS,
        achievementType: 'STRAIGHT',
        achievementTypeId: 6,
        displayName: 'Poker name test1',
        handDescription: 'STRAIGHT - 5h 6h 7h 8h 9d 2c 3s',
        cards: [
            { rank: '5', suit: 'h' },
            { rank: '6', suit: 'h' },
            { rank: '7', suit: 'h' },
            { rank: '8', suit: 'h' },
            { rank: '9', suit: 'd' },
            { rank: '2', suit: 'c' },
            { rank: '3', suit: 's' }
        ],
        rarity: 'COMMON',
        gameId: 'test-game-' + tokenId,
        tokenId: tokenId,
        claimedAt: new Date(),
        gameScreenshot: ''
    };

    console.log('创建数据库记录...');
    const nftClaim = await NFTClaim.create(nftData);
    console.log('✅ 数据库记录已创建\n');

    // 铸造到链上
    console.log('铸造到链上...');
    const contract = await tronWeb.contract().at(NFT_CONTRACT);

    const tx = await contract.mint(PLAYER_ADDRESS, tokenId).send({
        feeLimit: 100000000,
        callValue: 0,
        shouldPollResponse: true
    });

    console.log('✅ 铸造交易已发送');
    console.log('txHash:', tx);

    // 更新数据库
    nftClaim.onchainTokenId = tokenId;
    nftClaim.txHash = tx;
    nftClaim.mintedAt = new Date();
    await nftClaim.save();

    console.log('\n========================================');
    console.log('✅ NFT 创建完成！');
    console.log('========================================');
    console.log('tokenId:', tokenId);
    console.log('合约地址:', NFT_CONTRACT);
    console.log('玩家地址:', PLAYER_ADDRESS);
    console.log('\n元数据 URL:');
    console.log(`http://43.163.114.175:7778/api/nft/metadata/6/${tokenId}`);
    console.log('\n请在 TronLink 中刷新收藏品，查看新 NFT');
    console.log('========================================');

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
