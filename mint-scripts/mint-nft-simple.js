/**
 * Simple NFT Mint Script
 * Uses the server's NFT service to mint NFT to blockchain
 */

const mongoose = require('mongoose');
const { TronWeb } = require('tronweb');
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

async function mintNFT() {
    try {
        console.log('========================================');
        console.log('🚀 NFT上链流程');
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
        console.log('  玩家地址:', unmintedNFT.playerAddress.toUpperCase());
        console.log('  游戏ID:', unmintedNFT.gameId);
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
        console.log('  服务器地址:', tronWeb.defaultAddress.base58);
        console.log('');

        // Load contract
        const contractABI = require('./build/contracts/AchievementNFTSimple.json').abi;
        const contractAddress = process.env.NFT_CONTRACT_ADDRESS;
        const contract = await tronWeb.contract(contractABI, contractAddress);

        console.log('✅ 智能合约已加载:', contractAddress);
        console.log('');

        // Generate signature
        const timestamp = Math.floor(Date.now() / 1000);
        const achievementTypeId = unmintedNFT.achievementTypeId;
        const gameId = unmintedNFT.gameId;
        const playerAddress = unmintedNFT.playerAddress.toUpperCase();

        console.log('📝 准备签名参数:');
        console.log('  玩家地址:', playerAddress);
        console.log('  成就类型ID:', achievementTypeId);
        console.log('  时间戳:', timestamp);
        console.log('  游戏ID:', gameId);
        console.log('');

        // Create message hash
        const crypto = require('crypto');
        const messageData = JSON.stringify({
            player: playerAddress,
            achievementTypeId,
            timestamp,
            gameId
        });
        const hash = crypto.createHash('sha256').update(messageData).digest('hex');
        const message = '0x' + hash;

        console.log('⏳ 生成签名...');
        const signature = await tronWeb.trx.sign(message, process.env.SERVER_PRIVATE_KEY);
        console.log('✅ 签名已生成');
        console.log('');

        // Parse signature into v, r, s
        const sig = signature.replace(/^0x/, '');
        const r = '0x' + sig.slice(0, 64);
        const s = '0x' + sig.slice(64, 128);
        const v = parseInt(sig.slice(128, 130), 16);

        console.log('📝 签名组件:');
        console.log('  v:', v);
        console.log('  r:', r.substring(0, 20) + '...');
        console.log('  s:', s.substring(0, 20) + '...');
        console.log('');

        // Call claimNFT function from player's wallet
        console.log('⏳ 正在调用智能合约claimNFT函数...');
        console.log('  注意: 这需要玩家的私钥来签署交易');
        console.log('');

        // For testing, we'll use the server wallet to call the function
        // In production, this should be called from the player's wallet (TronLink)
        const tx = await contract.claimNFT(
            achievementTypeId,
            timestamp,
            gameId,
            v,
            r,
            s
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
        console.log('  Token ID:', unmintedNFT.tokenId);
        console.log('  类型:', unmintedNFT.achievementType);
        console.log('  玩家:', playerAddress);
        console.log('  交易哈希:', tx);
        console.log('');
        console.log('🔗 查看交易:');
        console.log(`  https://nile.tronscan.org/#/transaction/${tx}`);
        console.log('');
        console.log('🔗 查看NFT:');
        console.log(`  https://nile.tronscan.org/#/contract/${contractAddress}`);
        console.log('');
        console.log('💡 说明:');
        console.log('  NFT已成功mint到区块链');
        console.log('  TronScan会自动爬取Mint事件');
        console.log('  Cards信息会显示在TronLink中');
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
mintNFT();
