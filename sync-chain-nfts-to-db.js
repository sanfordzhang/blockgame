/**
 * 将链上NFT同步到数据库
 * 这样钱包页面就能显示NFT了
 */

require('dotenv').config({ path: '.env.testnet' });
const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

const serverPrivateKey = process.env.SERVER_PRIVATE_KEY || process.env.NILE_PRIVATE_KEY;
const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io',
    privateKey: serverPrivateKey
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

// Achievement type映射
const ACHIEVEMENT_TYPES = {
    1: 'ROYAL_FLUSH',
    2: 'STRAIGHT_FLUSH', 
    3: 'FOUR_OF_A_KIND',
    4: 'FULL_HOUSE',
    5: 'FLUSH',
    6: 'STRAIGHT'
};

const RARITY_MAP = {
    'ROYAL_FLUSH': 'LEGENDARY',
    'STRAIGHT_FLUSH': 'EPIC',
    'FOUR_OF_A_KIND': 'RARE',
    'FULL_HOUSE': 'RARE',
    'FLUSH': 'COMMON',
    'STRAIGHT': 'COMMON'
};

// 牌型描述映射
const HAND_DESCRIPTIONS = {
    'ROYAL_FLUSH': 'Royal Flush - A-K-Q-J-10 of same suit',
    'STRAIGHT_FLUSH': 'Straight Flush - 5 consecutive cards of same suit',
    'FOUR_OF_A_KIND': 'Four of a Kind - 4 cards of same rank',
    'FULL_HOUSE': 'Full House - 3 of a kind + a pair',
    'FLUSH': 'Flush - 5 cards of same suit',
    'STRAIGHT': 'Straight - 5 consecutive cards'
};

// 生成随机牌型数据（用于展示）
function generateCards(achievementType) {
    const suits = ['h', 'd', 'c', 's']; // hearts, diamonds, clubs, spades
    const ranks = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];
    
    switch (achievementType) {
        case 'ROYAL_FLUSH':
            return [
                { rank: 'A', suit: 'h' },
                { rank: 'K', suit: 'h' },
                { rank: 'Q', suit: 'h' },
                { rank: 'J', suit: 'h' },
                { rank: '10', suit: 'h' }
            ];
        case 'STRAIGHT_FLUSH':
            return [
                { rank: '9', suit: 's' },
                { rank: '8', suit: 's' },
                { rank: '7', suit: 's' },
                { rank: '6', suit: 's' },
                { rank: '5', suit: 's' }
            ];
        case 'FOUR_OF_A_KIND':
            return [
                { rank: 'K', suit: 'h' },
                { rank: 'K', suit: 'd' },
                { rank: 'K', suit: 'c' },
                { rank: 'K', suit: 's' },
                { rank: 'A', suit: 'h' }
            ];
        case 'FULL_HOUSE':
            return [
                { rank: 'Q', suit: 'h' },
                { rank: 'Q', suit: 'd' },
                { rank: 'Q', suit: 'c' },
                { rank: 'J', suit: 's' },
                { rank: 'J', suit: 'h' }
            ];
        case 'FLUSH':
            return [
                { rank: 'A', suit: 'd' },
                { rank: 'J', suit: 'd' },
                { rank: '9', suit: 'd' },
                { rank: '7', suit: 'd' },
                { rank: '3', suit: 'd' }
            ];
        case 'STRAIGHT':
        default:
            return [
                { rank: '10', suit: 'h' },
                { rank: '9', suit: 'd' },
                { rank: '8', suit: 'c' },
                { rank: '7', suit: 's' },
                { rank: '6', suit: 'h' }
            ];
    }
}

// 已知的NFT分布 (从check-all-nfts.js获取)
const KNOWN_NFTS = [
    { tokenId: 1, owner: 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv' },
    { tokenId: 2, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 3, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 4, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 5, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 6, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 7, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 8, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' },
    { tokenId: 9, owner: 'TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA' }
];

async function main() {
    console.log('========================================');
    console.log('🔄 链上NFT同步到数据库');
    console.log('========================================\n');
    
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker');
    console.log('✅ 数据库连接成功');
    
    const contract = await tronWeb.contract().at(NFT_CONTRACT);
    console.log('✅ 合约连接成功:', NFT_CONTRACT);
    
    // 检查数据库中已有的NFT
    const existingNFTs = await NFTClaim.find({});
    console.log(`📋 数据库中已有 ${existingNFTs.length} 个NFT\n`);
    
    let synced = 0;
    
    for (const nftInfo of KNOWN_NFTS) {
        try {
            // 检查是否已存在
            const existing = await NFTClaim.findOne({ tokenId: nftInfo.tokenId });
            if (existing) {
                console.log(`NFT #${nftInfo.tokenId} 已在数据库`);
                continue;
            }
            
            // 验证链上所有权
            const owner = await contract.ownerOf(nftInfo.tokenId).call();
            const ownerAddress = tronWeb.address.fromHex(owner);
            
            if (ownerAddress.toLowerCase() !== nftInfo.owner.toLowerCase()) {
                console.log(`NFT #${nftInfo.tokenId} 所有权已变更: ${ownerAddress}`);
                nftInfo.owner = ownerAddress;
            }
            
            // 获取NFT类型
            const achievementTypeId = await contract.tokenAchievementType(nftInfo.tokenId).call();
            const typeId = parseInt(achievementTypeId.toString());
            const achievementType = ACHIEVEMENT_TYPES[typeId] || 'UNKNOWN';
            
            // 创建数据库记录
            const cards = generateCards(achievementType);
            const nft = new NFTClaim({
                playerAddress: nftInfo.owner.toLowerCase(),
                achievementTypeId: typeId,
                achievementType: achievementType,
                rarity: RARITY_MAP[achievementType] || 'COMMON',
                tokenId: nftInfo.tokenId,
                txHash: 'synced_from_chain',
                gameId: `synced-${nftInfo.tokenId}`,
                handDescription: HAND_DESCRIPTIONS[achievementType] || achievementType,
                cards: cards,
                yearMonth: 202603,
                claimedAt: new Date()
            });
            
            await nft.save();
            console.log(`✅ NFT #${nftInfo.tokenId} (${achievementType}) -> ${nftInfo.owner.slice(0, 8)}...`);
            synced++;
            
        } catch (err) {
            console.error(`❌ NFT #${nftInfo.tokenId} 失败:`, err.message);
        }
    }
    
    console.log(`\n========================================`);
    console.log(`📊 同步完成: ${synced} 个NFT已添加到数据库`);
    console.log('========================================\n');
    
    // 显示最终结果
    const allNFTs = await NFTClaim.find({});
    console.log('📋 数据库中的NFT:');
    for (const nft of allNFTs) {
        console.log(`   #${nft.tokenId}: ${nft.achievementType} -> ${nft.playerAddress}`);
    }
    
    await mongoose.disconnect();
}

main().catch(err => {
    console.error('错误:', err);
    process.exit(1);
});
