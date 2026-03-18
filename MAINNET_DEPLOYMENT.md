# 🚀 TRON 主网部署完整指南

## 📊 资金需求估算

### 部署钱包（Owner）
- 合约部署费用：2,000-3,000 TRX
- 初始化操作（setRakeRate等）：500 TRX
- 预留余额：1,000 TRX
- **小计：4,000-5,000 TRX**

### 服务器钱包
- 每次 joinTableFor：50-100 TRX
- 每次 leaveTableFor：100-200 TRX
- 按每天 100 次操作估算：5,000-10,000 TRX/天
- **建议初始充值：50,000 TRX**

### 💰 总计
**约 55,000 TRX**（建议准备 60,000 TRX 含缓冲）

---

## 📝 操作步骤

### 步骤 1: 生成钱包

```bash
# 生成服务器钱包
node generate-wallet.js
```

**输出示例：**
```
地址: TXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
私钥: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **重要：立即备份私钥到安全位置！**

---

### 步骤 2: 币安购买 TRX

1. 登录 [币安](https://www.binance.com)
2. 进入【交易】→【现货交易】
3. 搜索 **TRX/USDT** 交易对
4. 市价购买 **60,000 TRX**
5. 等待订单成交

---

### 步骤 3: 提现到主网

#### 3.1 提现到部署钱包
- 金额：**5,000 TRX**
- 网络：**TRC20**
- 地址：[你的 TronLink 主网地址]
- 预计到账：1-5 分钟

#### 3.2 提现到服务器钱包
- 金额：**50,000 TRX**
- 网络：**TRC20**
- 地址：[generate-wallet.js 生成的地址]
- 预计到账：1-5 分钟

⚠️ **注意：**
- 确认网络选择 TRC20（不是 TRX 或其他网络）
- 首次提现建议先小额测试

---

### 步骤 4: 配置环境变量

编辑 `.env` 文件：

```bash
# 主网配置
MAINNET_PRIVATE_KEY=你的部署钱包私钥
SERVER_PRIVATE_KEY=服务器钱包私钥
MAINNET_CONTRACT_ADDRESS=  # 部署后填写
```

---

### 步骤 5: 部署合约

```bash
# 部署到主网
npm run deploy:mainnet
```

**预计时间：5-10 分钟**

部署成功后会显示：
```
BridgeGameV2 deployed at: TXxxxxxxxxxxxxx
```

将合约地址填入 `.env` 的 `MAINNET_CONTRACT_ADDRESS`

---

### 步骤 6: 验证部署

```bash
# 检查合约状态
node check-mainnet-contract.js
```

应该显示：
- ✅ 合约地址正确
- ✅ Owner 地址正确
- ✅ 抽水比例：10%
- ✅ 服务器钱包余额充足

---

## ✅ 部署后检查清单

- [ ] 合约已部署到主网
- [ ] 合约地址已更新到 .env
- [ ] 服务器钱包已授权为 delegate
- [ ] 抽水比例已设置为 10%
- [ ] 前端配置已更新为主网地址
- [ ] 测试充值功能正常
- [ ] 测试游戏流程正常
- [ ] 测试提现功能正常
- [ ] 测试抽水功能正常

---

## 🔧 常见问题

### Q: 部署失败怎么办？
A: 检查部署钱包余额是否充足，至少需要 5,000 TRX

### Q: 服务器钱包余额不足怎么办？
A: 从币安再次提现 TRX 到服务器钱包地址

### Q: 如何查看抽水记录？
A: 运行 `node check-rake.js`

---

## 📞 紧急联系

如遇问题，保存以下信息：
- 部署钱包地址
- 服务器钱包地址
- 合约地址
- 交易哈希
