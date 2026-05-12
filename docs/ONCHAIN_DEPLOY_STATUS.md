# On-Chain NFT 部署状态

## 当前进度

### ✅ 已完成
1. 合约编译成功：`build/AchievementNFTOnChain.json`
2. 元数据生成器：`utils/metadata-generator.js`
3. 部署脚本：`deploy-contract.js`

### ⏸️ 待完成
**部署合约到 Shasta 测试网**

## 阻塞问题

**账户余额不足**
- 账户：`TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA`
- 当前余额：0 TRX
- 需要：至少 1000 TRX 用于部署

## 解决方案

### 获取测试币
访问：https://www.trongrid.io/shasta/#/
输入地址：`TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA`
点击"Submit"获取 10,000 TRX

### 部署命令
```bash
node deploy-contract.js
```

## 部署后步骤

1. 更新 `.env.testnet`：
   ```
   NFT_CONTRACT_ONCHAIN=<新合约地址>
   ```

2. 修改 NFTService 支持 on-chain mint

3. 测试铸造 NFT
