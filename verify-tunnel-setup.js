#!/bin/bash

echo "========================================"
echo "🔍 云隧道方案完整性验证"
echo "========================================"
echo ""

# 1. 检查MongoDB
echo "📝 1. 检查MongoDB服务..."
if brew services list | grep -q "mongodb-community.*started"; then
    echo "✅ MongoDB运行中"
else
    echo "❌ MongoDB未运行"
    exit 1
fi
echo ""

# 2. 检查后端服务
echo "📝 2. 检查后端服务..."
BACKEND_PID=$(lsof -ti:7778)
if [ ! -z "$BACKEND_PID" ]; then
    echo "✅ 后端服务运行中 (PID: $BACKEND_PID)"
else
    echo "❌ 后端服务未运行"
    exit 1
fi
echo ""

# 3. 检查云隧道
echo "📝 3. 检查云隧道..."
TUNNEL_PID=$(pgrep -f "cloudflared tunnel")
if [ ! -z "$TUNNEL_PID" ]; then
    echo "✅ 云隧道运行中 (PID: $TUNNEL_PID)"
    
    # 提取URL
    TUNNEL_URL=$(grep -o "https://[^\"]*\.trycloudflare\.com" /tmp/cloudflared-tunnel.log | tail -1)
    echo "   URL: $TUNNEL_URL"
else
    echo "❌ 云隧道未运行"
    exit 1
fi
echo ""

# 4. 测试本地API
echo "📝 4. 测试本地API..."
LOCAL_RESPONSE=$(curl -s http://localhost:7778/api/nft/metadata/1774788248313)
if echo "$LOCAL_RESPONSE" | grep -q "Ah Kh Qh Jh 10h"; then
    echo "✅ 本地API正常返回Cards信息"
else
    echo "❌ 本地API未返回Cards信息"
    echo "   响应: $LOCAL_RESPONSE"
fi
echo ""

# 5. 测试云隧道访问
echo "📝 5. 测试云隧道访问..."
TUNNEL_RESPONSE=$(curl -s "$TUNNEL_URL/api/nft/metadata/1774788248313")
if echo "$TUNNEL_RESPONSE" | grep -q "Ah Kh Qh Jh 10h"; then
    echo "✅ 云隧道正常返回Cards信息"
else
    echo "❌ 云隧道未返回Cards信息"
    echo "   响应: $TUNNEL_RESPONSE"
fi
echo ""

# 6. 测试合约baseURI
echo "📝 6. 验证合约baseURI..."
BASE_URI=$(node -e "
const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC')
    .then(c => c.baseURI().call())
    .then(uri => console.log(uri))
    .catch(() => console.log('ERROR'));
")

if [ "$BASE_URI" != "ERROR" ]; then
    echo "✅ 合约baseURI: $BASE_URI"
else
    echo "⚠️  无法读取合约baseURI"
fi
echo ""

# 7. 数据库数据检查
echo "📝 7. 检查数据库数据..."
NFT_COUNT=$(mongosh bridge-poker --quiet --eval "db.nftclaims.countDocuments()")
echo "✅ NFT数据总数: $NFT_COUNT"

CARDS_DATA=$(mongosh bridge-poker --quiet --eval "db.nftclaims.findOne({tokenId: 1774788248313}, {cards: 1})" | grep "cards:")
if [ ! -z "$CARDS_DATA" ]; then
    echo "✅ 测试NFT Cards数据存在"
else
    echo "❌ 测试NFT Cards数据不存在"
fi
echo ""

# 总结
echo "========================================"
echo "✅ 验证完成"
echo "========================================"
echo ""
echo "🌐 云隧道URL: $TUNNEL_URL"
echo "📍 NFT合约: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC"
echo "🎴 测试Token ID: 1774788248313"
echo ""
echo "📱 TronLink访问步骤:"
echo "1. 切换到TRON Nile测试网"
echo "2. 添加NFT合约: TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC"
echo "3. 查看NFT详情，应该能看到Cards信息: Ah Kh Qh Jh 10h"
echo ""
