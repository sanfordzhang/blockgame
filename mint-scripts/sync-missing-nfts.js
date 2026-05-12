const mongoose = require('mongoose');
const { TronWeb } = require('tronweb');
const NFTClaim = require('./server/models/NFTClaim');

require('dotenv').config({ path: '.env.testnet' });

const tronWeb = new TronWeb({
    fullHost: 'https://nile.trongrid.io'
});

const NFT_CONTRACT = 'TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC';

async function syncNFTs() {
    try {
        // 连接数据库
        await mongoose.connect('mongodb://localhost:27017/bridge-poker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ MongoDB连接成功');

        // 加载合约
        const contract = await tronWeb.contract().at(NFT_CONTRACT);
        console.log('✅ 合约加载成功');

        // 获取总供应量
        const totalSupply = await contract.totalSupply().call();
        console.log(`📊 合约总供应量: ${totalSupply.toNumber()}`);

        // 获取当前数据库中的Token IDs
        const existingTokens = await NFTClaim.find({}, { tokenId: 1 });
        const existingTokenIds = new Set(existingTokens.map(n => n.tokenId));
        console.log(`📊 数据库中已有 ${existingTokenIds.size} 个NFT`);

        // 遍历所有Token，找到缺失的
        const missingTokens = [];
        for (let i = 1; i <= totalSupply.toNumber(); i++) {
            if (!existingTokenIds.has(i)) {
                missingTokens.push(i);
            }
        }

        console.log(`\n🔍 发现 ${missingTokens.length} 个缺失的NFT需要同步:`);
        console.log(`   Token IDs: ${missingTokens.join(', ')}`);

        // 同步缺失的NFT
        for (const tokenId of missingTokens) {
            try {
                console.log(`\n📝 同步 Token #${tokenId}...`);

                // 获取owner
                const owner = await contract.ownerOf(tokenId).call();
                const ownerAddress = tronWeb.address.fromHex(owner);
                console.log(`   Owner: ${ownerAddress}`);

                // 创建基础NFT记录（没有cards信息，需要从游戏数据补充）
                const nft = new NFTClaim({
                    playerAddress: ownerAddress.toLowerCase(),
                    achievementTypeId: 6, // 默认STRAIGHT
                    achievementType: 'STRAIGHT',
                    rarity: 'COMMON',
                    tokenId: tokenId,
                    handDescription: `Synced from blockchain - Token #${tokenId}`,
                    gameId: `synced-${tokenId}`,
                    cards: [
                        { rank: '10', suit: 'h' },
                        { rank: '9', suit: 'd' },
                        { rank: '8', suit: 'c' },
                        { rank: '7', suit: 's' },
                        { rank: '6', suit: 'h' }
                    ], // 默认cards，实际应该从游戏记录获取
                    yearMonth: NFTClaim.getYearMonth()
                });

                await nft.save();
                console.log(`   ✅ Token #${tokenId} 已同步`);
            } catch (error) {
                console.error(`   ❌ Token #${tokenId} 同步失败:`, error.message);
            }
        }

        // 验证同步结果
        const finalCount = await NFTClaim.countDocuments();
        console.log(`\n✅ 同步完成！数据库现在有 ${finalCount} 个NFT`);

        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
}

syncNFTs();
