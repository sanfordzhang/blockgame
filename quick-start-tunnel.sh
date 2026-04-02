#!/bin/bash

echo "========================================"
echo "🚀 快速启动云隧道方案"
echo "========================================"
echo ""

# 检查MongoDB
echo "📝 步骤1: 检查MongoDB..."
if brew services list | grep -q "mongodb-community.*started"; then
    echo "✅ MongoDB运行中"
else
    echo "⚠️  MongoDB未运行，正在启动..."
    brew services start mongodb-community
    sleep 2
fi
echo ""

# 检查后端服务
echo "📝 步骤2: 检查后端服务..."
BACKEND_PID=$(lsof -ti:7778)
if [ ! -z "$BACKEND_PID" ]; then
    echo "✅ 后端服务运行中 (PID: $BACKEND_PID)"
else
    echo "⚠️  后端服务未运行，正在启动..."
    osascript -e 'tell application "Terminal" to do script "cd \"'$(pwd)'\" && ENV_FILE=.env.testnet node server/server.js"'
    sleep 3
fi
echo ""

# 创建测试数据
echo "📝 步骤3: 创建测试NFT数据..."
node -e "
const mongoose = require('mongoose');
const NFTClaim = require('./server/models/NFTClaim');

(async () => {
    await mongoose.connect('mongodb://localhost:27017/bridgepoker');
    
    const testWallet = 'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv';
    const existing = await NFTClaim.findOne({ playerAddress: testWallet.toLowerCase() });
    
    if (existing) {
        console.log('✅ 找到已存在的NFT:');
        console.log('   Token ID:', existing.tokenId);
        console.log('   Cards:', existing.cards.map(c => c.rank + c.suit).join(' '));
    } else {
        const nft = new NFTClaim({
            playerAddress: testWallet.toLowerCase(),
            achievementTypeId: 1,
            achievementType: 'ROYAL_FLUSH',
            rarity: 'LEGENDARY',
            tokenId: Date.now(),
            handDescription: 'Royal Flush - Ah Kh Qh Jh 10h',
            gameId: 'test-' + Date.now(),
            cards: [
                { rank: 'A', suit: 'h' },
                { rank: 'K', suit: 'h' },
                { rank: 'Q', suit: 'h' },
                { rank: 'J', suit: 'h' },
                { rank: '10', suit: 'h' }
            ],
            yearMonth: NFTClaim.getYearMonth()
        });
        await nft.save();
        console.log('✅ 创建测试NFT成功:');
        console.log('   Token ID:', nft.tokenId);
        console.log('   Cards:', nft.cards.map(c => c.rank + c.suit).join(' '));
    }
    
    await mongoose.disconnect();
})();
"
echo ""

# 检查cloudflared
echo "📝 步骤4: 检查cloudflared..."
if command -v cloudflared &> /dev/null; then
    echo "✅ cloudflared已安装"
else
    echo "❌ cloudflared未安装"
    echo "请运行: brew install cloudflare/cloudflare/cloudflared"
    exit 1
fi
echo ""

# 启动云隧道
echo "========================================"
echo "🎯 下一步操作"
echo "========================================"
echo ""
echo "1️⃣  在新终端窗口运行:"
echo "    cloudflared tunnel --url http://localhost:7778"
echo ""
echo "2️⃣  复制输出的公网URL（例如: https://xxx.trycloudflare.com）"
echo ""
echo "3️⃣  在新终端窗口运行:"
echo "    node set-nft-baseuri-public.js https://YOUR-TUNNEL-URL/api/nft/metadata/"
echo ""
echo "4️⃣  在TronLink钱包中:"
echo "    - 切换到TRON Nile测试网"
echo "    - 添加NFT合约: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC"
echo "    - 查看NFT详情，应该能看到Cards信息"
echo ""
echo "详细文档请查看: TUNNEL_NFT_GUIDE.md"
echo ""
