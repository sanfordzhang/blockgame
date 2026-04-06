#!/bin/bash
# NFT锻造最终流程 - 手动触发签名

echo "=== NFT锻造最终流程 ==="
echo ""
echo "步骤1: 准备锻造数据"
echo "----------------------------------------"

# 准备锻造数据
RESPONSE=$(curl -s http://127.0.0.1:7778/api/nft/prepare-mint \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv",
    "achievementType": "STRAIGHT",
    "gameSessionId": "tournament-1775492306823"
  }')

echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# 提取签名数据
TOKEN_ID=$(echo "$RESPONSE" | jq -r '.tokenId' 2>/dev/null)
V=$(echo "$RESPONSE" | jq -r '.signature.v' 2>/dev/null)
R=$(echo "$RESPONSE" | jq -r '.signature.r' 2>/dev/null)
S=$(echo "$RESPONSE" | jq -r '.signature.s' 2>/dev/null)

echo ""
echo "步骤2: 在浏览器中执行合约调用"
echo "----------------------------------------"
echo "Token ID: $TOKEN_ID"
echo "V: $V"
echo "R: $R"
echo "S: $S"
echo ""
echo "请在浏览器控制台执行以下代码："
echo ""
echo "const contract = await window.tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');"
echo "const tx = await contract.safeMint("
echo "  'TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv',"
echo "  6,"
echo "  'tournament-1775492306823',"
echo "  $V,"
echo "  '$R',"
echo "  '$S'"
echo ").send({ feeLimit: 100000000 });"
echo "console.log('TX:', tx);"
echo ""
echo "或者运行: node call-contract-mint-fixed.js"
