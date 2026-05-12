/**
 * Mint NFT to blockchain
 * This script mints the latest unminted NFT to the blockchain
 */

const { TronWeb } = require('tronweb');
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });

const NFTClaimSchema = new mongoose.Schema({
    playerAddress: { type: String, required: true, lowercase: true, index: true },
    achievementTypeId: { type: Number, required: true, min: 1, max: 6 },
    achievementType: { type: String, required: true },
    rarity: { type: String, required: true },
    tokenId: { type: Number, required: true },
    txHash: { type: String, default: null },
    handDescription: { type: String, default: null },
    gameId: { type: String, default: null },
    cards: [{ rank: String, suit: String }],
    yearMonth: { type: Number, required: true, index: true },
    claimedAt: { type: Date, default: Date.now, index: true }
});

// Load contract ABI
const contractABI = require('./build/contracts/AchievementNFTSimple.json').abi;

async function mintNFTToChain() {
    try {
        console.log('========================================');
        console.log('🚀 开始NFT上链流程');
        console.log('========================================\n');

        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到MongoDB\n');

        const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);

        // Find the latest unminted NFT
        const unmintedNFT = await NFTClaim.findOne({ txHash: null }).sort({ claimedAt: -1 });

        if (!unmintedNFT) {
            console.log('❌ 没有找到未上链的NFT');
            await mongoose.disconnect();
            return;
        }

        console.log('📋 找到未上链的NFT:');
        console.log('  Token ID:', unmintedNFT.tokenId);
        console.log('  类型:', unmintedNFT.achievementType);
        console.log('  玩家地址:', unmintedNFT.playerAddress);
        console.log('  Cards:', unmintedNFT.cards.map(c => `${c.rank}${c.suit}`).join(' '));
        console.log('');

        // Initialize TronWeb
        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY },
            privateKey: process.env.TESTNET_PRIVATE_KEY
        });

        console.log('✅ TronWeb已初始化');
        console.log('  网络: Nile Testnet');
        console.log('  钱包地址:', tronWeb.defaultAddress.base58);
        console.log('');

        // Load contract
        const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
        const contract = await tronWeb.contract(contractABI, contractAddress);
        console.log('✅ 智能合约已加载:', contractAddress);
        console.log('');

        // Prepare mint parameters
        const playerAddress = unmintedNFT.playerAddress.toUpperCase();
        const achievementTypeId = unmintedNFT.achievementTypeId;
        const tokenId = unmintedNFT.tokenId;

        // Convert cards to contract format
        const cards = unmintedNFT.cards.map(card => {
            const rankMap = {
                'A': 14, 'K': 13, 'Q': 12, 'J': 11, '10': 10,
                '9': 9, '8': 8, '7': 7, '6': 6, '5': 5, '4': 4, '3': 3, '2': 2
            };
            const suitMap = { 'h': 0, 'd': 1, 'c': 2, 's': 3 };

            return {
                rank: rankMap[card.rank] || 0,
                suit: suitMap[card.suit] || 0
            };
        });

        console.log('📝 准备Mint参数:');
        console.log('  玩家地址:', playerAddress);
        console.log('  成就类型ID:', achievementTypeId);
        console.log('  Token ID:', tokenId);
        console.log('  Cards数量:', cards.length);
        console.log('');

        // Call mint function
        console.log('⏳ 正在调用智能合约mint函数...');
        console.log('');

        const tx = await contract.mintWithCards(
            playerAddress,
            achievementTypeId,
            tokenId,
            cards
        ).send({
            feeLimit: 1000000000,
            callValue: 0,
            shouldPollResponse: true
        });

        console.log('✅ 交易已发送!');
        console.log('  交易哈希:', tx);
        console.log('');

        // Update database with txHash
        unmintedNFT.txHash = tx;
        await unmintedNFT.save();

        console.log('✅ 数据库已更新，txHash已保存');
        console.log('');

        console.log('========================================');
        console.log('🎉 NFT上链成功！');
        console.log('========================================');
        console.log('');
        console.log('📊 NFT详情:');
        console.log('  Token ID:', tokenId);
        console.log('  类型:', unmintedNFT.achievementType);
        console.log('  玩家:', playerAddress);
        console.log('  交易哈希:', tx);
        console.log('');
        console.log('🔗 查看交易:');
        console.log(`  https://nile.tronscan.org/#/transaction/${tx}`);
        console.log('');
        console.log('🔗 查看NFT:');
        console.log(`  https://nile.tronscan.org/#/token721/${contractAddress}/${tokenId}`);
        console.log('');

        await mongoose.disconnect();
        console.log('✅ 完成！');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.error) {
            console.error('详细错误:', error.error);
        }
        await mongoose.disconnect();
        process.exit(1);
    }
}

// Run the script
mintNFTToChain();
