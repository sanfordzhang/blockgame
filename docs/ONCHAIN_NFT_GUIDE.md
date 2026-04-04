# On-Chain NFT Metadata 解决方案

## 问题根因

TronLink 通过其服务器请求 tokenURI，局域网 IP 和临时隧道都无法从外网访问。

## 解决方案

将完整的 JSON 元数据编码为 base64 data URI，直接存储在链上。

## 文件清单

1. `contracts/AchievementNFTOnChain.sol` - 支持 on-chain metadata 的新合约
2. `utils/metadata-generator.js` - 元数据生成工具
3. `deploy-and-test-onchain.js` - 部署测试脚本

## 部署步骤

### 1. 编译合约

使用 TronIDE 或 tronbox 编译 `AchievementNFTOnChain.sol`

### 2. 部署合约

```bash
# 构造参数
signer: TYour...SignerAddress

# 部署后获得合约地址，例如：
# TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC
```

### 3. 配置环境变量

在 `.env.testnet` 添加：

```bash
NFT_CONTRACT_ONCHAIN=TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC
```

### 4. 测试元数据生成

```bash
node utils/metadata-generator.js
```

## 集成到现有代码

### 修改 NFTService.js

在 `recordClaim` 方法中生成 metadata：

```javascript
const { generateMetadata } = require('../utils/metadata-generator');

// 在调用合约前
const cardsStr = cards.map(c => `${c.rank}${c.suit}`).join(' ');
const metadata = generateMetadata(achievementType, tokenId, cardsStr);

// 调用合约时传入
await contract.claimNFT(
    achievementTypeId,
    timestamp,
    gameId,
    metadata,  // 新增参数
    v, r, s
).send({ callValue: price });
```

## 优势

✅ 无需服务器 - 元数据完全在链上
✅ TronLink 兼容 - 直接读取 data URI
✅ 永久可用 - 不依赖外部服务
✅ 简单高效 - 约 700-800 字节/NFT

## 测试验证

```bash
node deploy-and-test-onchain.js
```
