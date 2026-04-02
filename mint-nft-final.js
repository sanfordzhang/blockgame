/**
 * Final NFT Mint Script - Direct blockchain mint
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

async function mintNFT() {
    try {
        console.log('========================================');
        console.log('🚀 NFT上链流程');
        console.log('========================================\n');

        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/bridge-poker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ 已连接到MongoDB\n');

        const NFTClaim = mongoose.models.NFTClaim || mongoose.model('NFTClaim', NFTClaimSchema);
        const unmintedNFT = await NFTClaim.findOne({ txHash: null }).sort({ claimedAt: -1 });

        if (!unmintedNFT) {
            console.log('❌ 没有找到未上链的NFT');
            await mongoose.disconnect();
            return;
        }

        console.log('📋 NFT信息:');
        console.log('  Token ID:', unmintedNFT.tokenId);
        console.log('  类型:', unmintedNFT.achievementType);
        console.log('  玩家地址:', unmintedNFT.playerAddress.toUpperCase());
        console.log('  Cards:', unmintedNFT.cards.map(c => `${c.rank}${c.suit}`).join(' '));
        console.log('');

        // Initialize TronWeb with player's private key (for testing)
        // In production, this would be done via TronLink
        const tronWeb = new TronWeb({
            fullHost: 'https://nile.trongrid.io',
            headers: { 'TRON-PRO-API-KEY': process.env.TRONGRID_API_KEY },
            privateKey: process.env.TESTNET_PRIVATE_KEY
        });

        console.log('✅ TronWeb已初始化');
        console.log('  网络: Nile Testnet\n');

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

        const sig = signature.replace(/^0x/, '');
        const r = '0x' + sig.slice(0, 64);
        const s = '0x' + sig.slice(64, 128);
        const v = parseInt(sig.slice(128, 130), 16);

        console.log('✅ 签名已生成\n');

        console.log('⏳ 调用智能合约claimNFT...');

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

        console.log('✅ 交易成功!');
        console.log('  交易哈希:', tx);
        console.log('');

        // Update database
        unmintedNFT.txHash = tx;
        await unmintedNFT.save();

        console.log('✅ 数据库已更新\n');

        console.log('========================================');
        console.log('🎉 NFT上链成功！');
        console.log('========================================\n');

        console.log('📊 NFT详情:');
        console.log('  Token ID:', unmintedNFT.tokenId);
        console.log('  类型:', unmintedNFT.achievementType);
        console.log('  玩家:', playerAddress);
        console.log('  交易哈希:', tx);
        console.log('');

        console.log('🔗 查看链接:');
        console.log(`  TronScan: https://nile.tronscan.org/#/transaction/${tx}`);
        console.log(`  NFT详情: https://nile.tronscan.org/#/contract/${contractAddress}`);
        console.log('');

        // Wait for transaction confirmation
        console.log('⏳ 等待交易确认...');
        await new Promise(r => setTimeout(r, 10000));

        // Check NFT on chain
        console.log('');
        console.log('========================================');
        console.log('🔍 验证NFT上链状态');
        console.log('========================================\n');

        try {
            const owner = await contract.ownerOf(unmintedNFT.tokenId).call();
            console.log('✅ NFT已上链确认');
            console.log('  Token ID:', unmintedNFT.tokenId);
            console.log('  Owner:', tronWeb.address.fromHex(owner));
            console.log('');

            const tokenURI = await contract.tokenURI(unmintedNFT.tokenId).call();
            console.log('✅ Token URI:', tokenURI);
            console.log('');

            console.log('🎉 验证完成！');
            console.log('');
            console.log('💡 TronLink显示:');
            console.log('  1. 打开TronLink钱包');
            console.log('  2. 切换到Nile测试网');
            console.log('  3. 查看NFT收藏');
            console.log('  4. 可以看到Cards信息');
            console.log('');

        } catch (error) {
            console.log('⏳ NFT正在确认中，请稍后在TronLink中查看');
            console.log('');
        }

        await mongoose.disconnect();
        console.log('✅ 完成！');

    } catch (error) {
        console.error('❌ 错误:', error.message);
        if (error.error) {
            console.error('详细:', error.error);
        }
        await mongoose.disconnect();
        process.exit(1);
    }
}

mintNFT();
