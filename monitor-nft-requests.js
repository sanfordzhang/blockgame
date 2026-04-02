/**
 * 监控TronLink的NFT请求
 * 实时显示服务器收到的请求
 */

const express = require('express');
const app = express();

// 请求日志中间件
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log('\n========================================');
    console.log(`[${timestamp}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('User-Agent:', req.headers['user-agent']);
    console.log('========================================');
    next();
});

// 模拟NFT元数据端点
app.get('/api/nft/metadata/:achievementType/:tokenId', (req, res) => {
    const { achievementType, tokenId } = req.params;

    console.log('\n📍 收到元数据请求:');
    console.log('   achievementType:', achievementType);
    console.log('   tokenId:', tokenId);

    const metadata = {
        "name": `Straight #${tokenId}`,
        "description": "Synced Token #10 - Straight hand",
        "image": "https://via.placeholder.com/400x400?text=STRAIGHT",
        "external_url": "http://localhost:3001/nft/10",
        "attributes": [
            {
                "trait_type": "Achievement",
                "value": "STRAIGHT"
            },
            {
                "trait_type": "Rarity",
                "value": "COMMON"
            },
            {
                "trait_type": "Cards",
                "value": "10h 9d 8c 7s 6h"
            }
        ]
    };

    console.log('\n📤 返回元数据:');
    console.log(JSON.stringify(metadata, null, 2));

    res.json(metadata);
});

const PORT = 9999;
app.listen(PORT, () => {
    console.log(`\n🔍 NFT请求监控服务启动在端口 ${PORT}`);
    console.log('等待TronLink请求...\n');
});
