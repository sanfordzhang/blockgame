const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

(async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/bridgepoker', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        
        const tokenId = 1774788248313;
        
        // 测试查询
        console.log('测试查询 Token ID:', tokenId);
        console.log('查询条件:', { tokenId: parseInt(tokenId) });
        
        const nft = await NFTClaim.findOne({ tokenId: parseInt(tokenId) });
        
        if (nft) {
            console.log('\n✅ 找到NFT:');
            console.log('  Achievement:', nft.achievementType);
            console.log('  Rarity:', nft.rarity);
            console.log('  Cards:', nft.cards.map(c => `${c.rank}${c.suit}`).join(' '));
            console.log('  Hand Description:', nft.handDescription);
            
            // 构建元数据
            const cardsAttribute = nft.cards && nft.cards.length > 0 
                ? { trait_type: 'Cards', value: nft.cards.map(c => `${c.rank}${c.suit}`).join(' ') }
                : null;
            
            const attributes = [
                { trait_type: 'Achievement', value: nft.achievementType },
                { trait_type: 'Rarity', value: nft.rarity },
                { trait_type: 'Game ID', value: nft.gameId },
                { trait_type: 'Token ID', value: nft.tokenId, display_type: 'number' }
            ];
            
            if (cardsAttribute) {
                attributes.push(cardsAttribute);
            }
            
            const metadata = {
                name: `${nft.displayName || nft.achievementType} #${nft.tokenId}`,
                description: nft.handDescription || `${nft.achievementType} achievement earned in poker game`,
                image: `https://via.placeholder.com/400x400?text=${encodeURIComponent(nft.achievementType)}`,
                external_url: `http://localhost:3001/nft/${nft.tokenId}`,
                attributes: attributes
            };
            
            console.log('\n📦 生成的元数据:');
            console.log(JSON.stringify(metadata, null, 2));
        } else {
            console.log('❌ 未找到NFT');
            
            // 列出所有NFT
            const allNFTs = await NFTClaim.find({}).limit(5);
            console.log('\n数据库中的NFT:');
            allNFTs.forEach(n => {
                console.log(`  Token ID: ${n.tokenId}, Achievement: ${n.achievementType}`);
            });
        }
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ 错误:', error);
        process.exit(1);
    }
})();
