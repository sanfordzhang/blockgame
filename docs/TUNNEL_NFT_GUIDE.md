# 云隧道方案 - TronLink钱包访问本地Cards信息

## 📋 概述

本方案通过Cloudflare Tunnel实现公网访问本地服务器，让TronLink钱包能够读取到Cards信息，适用于测试阶段。

## 🏗️ 架构

```
┌──────────────────────────────────────────────────────────┐
│          数据访问流程                                      │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  TronLink钱包                                             │
│     │                                                    │
│     ├─ 调用合约: tokenURI(tokenId)                        │
│     └─ 返回: https://your-tunnel.trycloudflare.com/...  │
│                                                          │
│  公网请求                                                 │
│     │                                                    │
│     ▼                                                    │
│  Cloudflare边缘节点                                       │
│     │                                                    │
│     ├─ 解析域名                                           │
│     ├─ 查找隧道                                           │
│     └─ 加密转发                                           │
│                                                          │
│  本地cloudflared客户端                                    │
│     │                                                    │
│     └─ 转发到: http://localhost:7778                      │
│                                                          │
│  本地Express服务器 (localhost:7778)                       │
│     │                                                    │
│     ├─ 路由: /api/nft/metadata/:tokenId                  │
│     └─ NFTService.getNFTMetadata(tokenId)                │
│                                                          │
│  MongoDB数据库                                            │
│     │                                                    │
│     ├─ NFTClaim表                                        │
│     ├─ cards字段: [{ rank, suit }]                       │
│     └─ gameScreenshot字段: base64                        │
│                                                          │
│  响应返回                                                 │
│     │                                                    │
│     └─ JSON元数据 → TronLink显示                         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 前置条件

1. **安装cloudflared**
   ```bash
   # macOS
   brew install cloudflare/cloudflare/cloudflared
   
   # Linux
   wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
   sudo dpkg -i cloudflared-linux-amd64.deb
   ```

2. **启动本地服务**
   ```bash
   # 启动MongoDB
   brew services start mongodb-community
   
   # 启动后端 (新终端)
   ENV_FILE=.env.testnet node server/server.js
   
   # 启动前端 (可选，新终端)
   REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client
   ```

3. **创建测试数据**
   ```bash
   node test-tunnel-nft.js
   ```

### 步骤详解

#### 1️⃣ 启动云隧道

```bash
# 在新终端运行
cloudflared tunnel --url http://localhost:7778

# 输出示例:
# Your quick Tunnel has been created! Visit it at:
# https://abc-xyz-123-trycloudflare-com.trycloudflare.com
```

**重要**: 复制输出的URL，每次重启会生成新的URL。

#### 2️⃣ 设置NFT合约baseURI

```bash
# 使用上面复制的URL
node set-nft-baseuri-public.js https://YOUR-TUNNEL-URL/api/nft/metadata/

# 示例:
node set-nft-baseuri-public.js https://abc-xyz-123-trycloudflare-com.trycloudflare.com/api/nft/metadata/

# 输出:
# ✅ 新baseURI已设置
# ✅ Token #1 URI: https://.../api/nft/metadata/1
```

#### 3️⃣ 在TronLink钱包中查看

1. **切换网络**
   - 打开TronLink钱包
   - 切换到 **TRON Nile测试网**

2. **添加NFT**
   - 进入"NFT收藏品"页面
   - 点击"添加NFT"
   - 输入合约地址: `TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC`
   - 点击"添加"

3. **查看Cards信息**
   - 点击NFT查看详情
   - 在"属性"(Attributes)中应该能看到:
     - **Achievement**: ROYAL_FLUSH
     - **Rarity**: LEGENDARY
     - **Cards**: Ah Kh Qh Jh 10h ← **这里就是Cards信息！**

## 📊 数据结构

### MongoDB Schema

```javascript
NFTClaim {
  playerAddress: String,      // 玩家钱包地址
  achievementType: String,    // 成就类型
  rarity: String,            // 稀有度
  tokenId: Number,           // NFT Token ID
  cards: [{                  // ← Cards信息存储在这里
    rank: String,            // "A", "K", "Q", "J", "10"...
    suit: String             // "h", "d", "c", "s"
  }],
  gameScreenshot: String,    // Base64编码的游戏截图
  handDescription: String,   // 手牌描述
  gameId: String,           // 游戏ID
  claimedAt: Date          // 领取时间
}
```

### NFT元数据格式

```json
{
  "name": "ROYAL_FLUSH #1234567890",
  "description": "Royal Flush - Ah Kh Qh Jh 10h",
  "image": "data:image/png;base64,iVBORw0...",
  "external_url": "http://localhost:3001/nft/1234567890",
  "attributes": [
    {
      "trait_type": "Achievement",
      "value": "ROYAL_FLUSH"
    },
    {
      "trait_type": "Rarity",
      "value": "LEGENDARY"
    },
    {
      "trait_type": "Game ID",
      "value": "test-game-1234567890"
    },
    {
      "trait_type": "Token ID",
      "value": 1234567890,
      "display_type": "number"
    },
    {
      "trait_type": "Cards",
      "value": "Ah Kh Qh Jh 10h"  ← Cards信息
    }
  ]
}
```

## 🧪 测试验证

### 本地测试

```bash
# 1. 测试MongoDB连接
node test-tunnel-nft.js

# 2. 测试API返回Cards信息
curl http://localhost:7778/api/nft/metadata/YOUR_TOKEN_ID

# 3. 验证Cards字段
# 应该返回类似:
# {
#   "name": "ROYAL_FLUSH #...",
#   "attributes": [
#     { "trait_type": "Cards", "value": "Ah Kh Qh Jh 10h" }
#   ]
# }
```

### 公网测试（云隧道启动后）

```bash
# 使用云隧道URL测试
curl https://YOUR-TUNNEL-URL/api/nft/metadata/YOUR_TOKEN_ID

# 应该返回相同的JSON元数据
```

### TronLink钱包测试

1. 打开TronLink钱包
2. 进入NFT收藏品页面
3. 查看NFT详情
4. 确认"Cards"属性显示正确的牌面信息

## 🔧 故障排查

### 问题1: 云隧道无法启动

```bash
# 检查cloudflared是否安装
which cloudflared

# 重新安装
brew reinstall cloudflare/cloudflare/cloudflared
```

### 问题2: TronLink无法加载NFT

**检查清单:**
- [ ] 云隧道是否正在运行
- [ ] 本地服务器是否运行在7778端口
- [ ] MongoDB是否运行
- [ ] NFT合约baseURI是否正确设置
- [ ] TronLink是否在正确的网络（Nile测试网）

```bash
# 检查后端服务
curl http://localhost:7778/api/health

# 检查baseURI
node -e "
const TronWeb = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });
tronWeb.contract().at('TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC').then(c => c.baseURI().call()).then(console.log);
"
```

### 问题3: Cards信息未显示

```bash
# 检查数据库中的cards字段
mongosh bridgepoker --eval "db.nftclaims.findOne({tokenId: YOUR_TOKEN_ID}, {cards: 1})"

# 应该返回:
# { _id: ..., cards: [ { rank: 'A', suit: 'h' }, ... ] }
```

### 问题4: 隧道URL变化

**问题**: 每次重启cloudflared都会生成新的URL，导致之前的baseURI失效。

**解决方案**:
```bash
# 方案A: 使用固定隧道（需Cloudflare账号）
# 1. 登录Cloudflare: cloudflared tunnel login
# 2. 创建隧道: cloudflared tunnel create poker-nft
# 3. 配置DNS: cloudflared tunnel route dns poker-nft nft.yourdomain.com
# 4. 运行隧道: cloudflared tunnel run poker-nft

# 方案B: 测试时每次更新baseURI（当前方案）
# 每次重启隧道后运行:
node set-nft-baseuri-public.js https://NEW-TUNNEL-URL/api/nft/metadata/
```

## 📈 性能优化

### 1. 图片优化

当前方案使用Base64编码的图片，导致元数据较大（~200KB）。

**优化方案**:
```javascript
// 方案A: 使用CDN存储图片
{
  "image": "https://your-cdn.com/nft-images/token-123.png"
}

// 方案B: 使用IPFS（推荐生产环境）
{
  "image": "ipfs://QmXyz.../token-123.png"
}
```

### 2. 缓存策略

```javascript
// 在server/routes/api/nft.js中添加缓存
router.get('/metadata/:tokenId', async (req, res) => {
    // 设置缓存头（15分钟）
    res.set('Cache-Control', 'public, max-age=900');
    
    const metadata = await NFTService.getNFTMetadata(req.params.tokenId);
    res.json(metadata);
});
```

## 🎯 生产环境迁移

### 从云隧道到云服务器

```bash
# 1. 部署到云服务器
# - AWS EC2 / 阿里云ECS / Azure VM
# - 安装Node.js, MongoDB
# - 配置Nginx反向代理
# - 申请SSL证书

# 2. 更新baseURI
node set-nft-baseuri-public.js https://your-domain.com/api/nft/metadata/

# 3. 迁移数据
mongodump --db bridgepoker
mongorestore --db bridgepoker dump/bridgepoker
```

### 从云隧道到IPFS

```javascript
// 1. 上传图片到IPFS
const ipfsClient = require('ipfs-http-client');
const ipfs = ipfsClient('https://ipfs.infura.io:5001');

const imageBuffer = Buffer.from(nft.gameScreenshot, 'base64');
const imageCID = await ipfs.add(imageBuffer);

// 2. 创建元数据JSON并上传
const metadata = {
  name: `${nft.achievementType} #${nft.tokenId}`,
  image: `ipfs://${imageCID.path}`,
  attributes: [...]
};

const metadataCID = await ipfs.add(JSON.stringify(metadata));

// 3. 更新合约baseURI
contract.setBaseURI(`ipfs://${metadataCID.path}/`);
```

## 📝 成本分析

### 云隧道方案（测试阶段）

```
Cloudflare Tunnel: 免费
MongoDB本地: 免费
本地服务器: 已有设备
────────────────────────
总成本: 0元 ✅
```

### 云服务器方案（生产环境）

```
云服务器（2核4G）: ~100元/月
带宽（5Mbps）: ~50元/月
MongoDB云服务: ~50元/月
域名+SSL: ~100元/年
CDN流量: ~30元/月
────────────────────────
月成本: ~230元
```

### IPFS方案（生产环境）

```
IPFS存储: ~$0.1/GB/月
Pinata/Infura: 免费/付费套餐
无服务器维护成本
────────────────────────
月成本: ~10-50元 ✅
```

## 🔐 安全考虑

### 1. 数据验证

```javascript
// 验证tokenId所有权
router.get('/metadata/:tokenId', async (req, res) => {
    const nft = await NFTClaim.findOne({ tokenId: req.params.tokenId });
    
    if (!nft) {
        return res.status(404).json({ error: 'NFT not found' });
    }
    
    // 可选: 验证tokenId与合约中的owner匹配
    // const owner = await contract.ownerOf(tokenId).call();
    // if (owner.toLowerCase() !== nft.playerAddress) {
    //     return res.status(403).json({ error: 'Unauthorized' });
    // }
    
    res.json(await NFTService.getNFTMetadata(req.params.tokenId));
});
```

### 2. 防止滥用

```javascript
// 添加速率限制
const rateLimit = require('express-rate-limit');

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 100 // 限制100次请求
});

router.use('/metadata', limiter);
```

## 📚 相关文档

- [Cloudflare Tunnel文档](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [ERC721元数据标准](https://eips.ethereum.org/EIPS/eip-721)
- [TronLink NFT开发指南](https://docs.tronlink.org/)

## 🎉 总结

通过云隧道方案，您可以：
- ✅ **零成本** 实现公网访问
- ✅ **快速部署** 一行命令启动
- ✅ **实时调试** 本地查看所有日志
- ✅ **完整功能** TronLink钱包正常显示Cards信息

适用于测试阶段，后续可无缝迁移到云服务器或IPFS方案。
