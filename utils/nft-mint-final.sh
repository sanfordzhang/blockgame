#!/bin/bash
# NFT锻造最终完整解决方案
# 通过deposit-auto-final.sh类似方式完成签名

echo "========================================"
echo "  NFT锻造最终完整流程"
echo "========================================"
echo ""

# 1. 准备锻造数据
echo "[1] 准备锻造数据..."
RESPONSE=$(curl -s http://127.0.0.1:7778/api/nft/prepare-mint \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv",
    "achievementType": "STRAIGHT",
    "gameSessionId": "tournament-1775492306823"
  }')

echo "$RESPONSE"

# 提取参数
TOKEN_ID=$(echo "$RESPONSE" | jq -r '.tokenId' 2>/dev/null)
TIMESTAMP=$(echo "$RESPONSE" | jq -r '.signature.timestamp' 2>/dev/null)
GAME_ID=$(echo "$RESPONSE" | jq -r '.signature.gameId' 2>/dev/null)
TYPE_ID=$(echo "$RESPONSE" | jq -r '.signature.achievementTypeId' 2>/dev/null)
V=$(echo "$RESPONSE" | jq -r '.signature.v' 2>/dev/null)
R=$(echo "$RESPONSE" | jq -r '.signature.r' 2>/dev/null)
S=$(echo "$RESPONSE" | jq -r '.signature.s' 2>/dev/null)

echo ""
echo "[2] 锻造参数:"
echo "  Token ID: $TOKEN_ID"
echo "  Timestamp: $TIMESTAMP"
echo "  Game ID: $GAME_ID"
echo "  Type ID: $TYPE_ID"
echo "  V: $V"
echo "  R: $R"
echo "  S: $S"
echo ""

# 2. 在浏览器中调用合约
echo "[3] 在浏览器中调用合约..."
node -e "
const CDP = require('chrome-remote-interface');
(async () => {
    const client = await CDP({ port: 9222 });
    const { Page, Runtime } = client;
    await Page.enable();
    
    // 导航到NFT页面
    await Page.navigate({ url: 'http://127.0.0.1:3001/nft' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 2000));
    
    // 调用合约（6个参数）
    const result = await Runtime.evaluate({
        expression: \`(async function() {
            try {
                const contract = await window.tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC');
                const tx = await contract.claimNFT(
                    $TYPE_ID,
                    $TIMESTAMP,
                    '$GAME_ID',
                    $V,
                    '$R',
                    '$S'
                ).send({
                    feeLimit: 100000000,
                    callValue: 5 * 1e6
                });
                return JSON.stringify({ success: true, tx: tx });
            } catch (e) {
                return JSON.stringify({ success: false, error: e.message });
            }
        })()\`,
        returnByValue: true,
        awaitPromise: true
    });
    
    console.log('合约调用结果:', result.result.value);
    
    await new Promise(r => setTimeout(r, 3000));
    await client.close();
})();
"

# 3. 等待TronLink签名窗口
echo ""
echo "[4] 等待TronLink签名请求 (5秒)..."
sleep 5

# 4. 点击签名按钮
echo "[5] 点击签名按钮..."
cliclick c:1238,50
sleep 2
cliclick c:1414,635
sleep 1
cliclick c:1414,635
sleep 1
cliclick c:1414,635

echo ""
echo "[6] 等待交易确认 (15秒)..."
sleep 15

# 5. 验证结果
echo ""
echo "[7] 验证NFT锻造结果..."
node -e "
const mongoose = require('mongoose');
require('dotenv').config({ path: '.env.testnet' });
mongoose.connect(process.env.MONGODB_URI);
const NFTClaim = mongoose.model('NFTClaim', new mongoose.Schema({}, { strict: false }), 'nftclaims');

(async () => {
    const latest = await NFTClaim.find({ 
        playerAddress: 'tu8rhtpfqusgpbe9sxqafg8bdxf52ggsmv'
    }).sort({ _id: -1 }).limit(1);
    
    if (latest.length > 0) {
        const nft = latest[0].toObject();
        console.log('最新NFT记录:');
        console.log('  Token ID:', nft.tokenId);
        console.log('  TX Hash:', nft.txHash || '无');
        console.log('  Game ID:', nft.gameId);
    }
    
    await mongoose.disconnect();
})();
"

# 6. 截图保存
screencapture -x test-results/nft-final-result.png
echo ""
echo "📸 截图已保存: test-results/nft-final-result.png"
echo ""
echo "========================================"
echo "  流程完成！"
echo "  NFT合约: https://nile.tronscan.org/#/token20/TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC"
echo "  钱包地址: https://nile.tronscan.org/#/address/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv"
echo "========================================"
