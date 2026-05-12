# CHIP Token 使用指南

## 📋 合约信息

| 属性 | 值 |
|------|-----|
| 合约地址 | `TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n` |
| 名称 | CHIP Token |
| 符号 | CHIP |
| 精度 | 6 |
| 总供应量 | 100,000,000 CHIP |
| 网络 | TRON Nile测试网 |

---

## 问题1：发行的代币在TronLink钱包里怎么查看？

### 方法：手动添加代币

1. **打开TronLink钱包**
   - 确保已安装TronLink浏览器扩展

2. **切换网络**
   - 点击左上角网络选择器
   - 选择 **"TRON Nile测试网"**（Nile Testnet）

3. **添加代币**
   - 点击底部 **"资产"** 标签
   - 点击右上角 **"+"** 或 **"添加代币"** 按钮
   - 选择 **"自定义代币"**

4. **输入合约地址**
   ```
   TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n
   ```

5. **确认添加**
   - 系统会自动识别代币信息
   - 显示：CHIP Token (CHIP)
   - 点击 **"确认"**

6. **查看余额**
   - 返回资产页面
   - 您的CHIP余额将显示在列表中
   - 当前余额：**50,000 CHIP** ✅

### 验证方法
- 区块链浏览器查看：https://nile.tronscan.org/#/token20/TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n

---

## 问题2：如何将TRX和自己发行的代币进行兑换？

### 方案1：通过游戏系统兑换（当前已实现）

**存款流程**：
1. 访问 http://127.0.0.1:3001/wallet
2. 连接TronLink钱包
3. 点击 **"存款"** 按钮
4. 输入TRX数量
5. 确认交易
6. 系统自动发放对应CHIP到游戏账户

**提现流程**：
1. 在钱包页面点击 **"提现"**
2. 输入CHIP数量
3. 确认交易
4. CHIP从游戏账户转入TronLink钱包

### 方案2：部署DEX交易所（未来可扩展）

需要实现：
- 流动性池合约
- AMM自动做市商
- TRX/CHIP交易对

### 方案3：场外交易（OTC）

- 用户间直接协商转账
- 在Telegram/Discord群组交易

---

## 问题3：怎么给自己的钱包充值代币？

### 方法1：管理员铸造（测试环境推荐）

```bash
# 运行脚本给指定地址转账CHIP
node transfer-chip.js
```

修改 `transfer-chip.js` 中的参数：
```javascript
const RECIPIENT = '您的钱包地址';
const amount = 10000 * 1e6;  // 转账数量
```

### 方法2：游戏获得

1. **参与游戏**
   - 加入牌桌游戏
   - 赢得筹码

2. **提现**
   - 游戏结束后提现到钱包

### 方法3：测试水龙头（开发中）

- 访问测试水龙头页面
- 连接钱包
- 点击领取测试CHIP

---

## 🛠️ 常用操作命令

### 查询余额
```bash
node -e "
const { TronWeb } = require('tronweb');
const tronWeb = new TronWeb({ fullHost: 'https://nile.trongrid.io' });

(async () => {
    const contract = await tronWeb.contract().at('TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n');
    const balance = await contract.balanceOf('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
    console.log('CHIP余额:', Number(balance) / 1e6);
})();
"
```

### 转账CHIP
```bash
node transfer-chip.js
```

### 查看合约信息
```bash
node verify-chip.js
```

---

## 📊 当前状态

| 账户 | CHIP余额 |
|------|----------|
| 部署者 (TW2Bx...XuA) | 99,950,000 CHIP |
| 您的钱包 (TU8rh...SMv) | 50,000 CHIP ✅ |

---

## 🔗 相关链接

- **区块链浏览器**: https://nile.tronscan.org
- **合约页面**: https://nile.tronscan.org/#/token20/TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n
- **测试水龙头**: https://nileex.io/join/getJoinPage

---

## 💡 提示

1. **测试网环境**：当前使用的是TRON Nile测试网，代币无真实价值
2. **获取测试TRX**：访问水龙头 https://nileex.io/join/getJoinPage
3. **生产部署**：主网部署需要替换合约地址和配置

---

**部署时间**: 2026-03-29
**部署者**: TW2BxbsK6VoqMiotWuc56gsupF6gaEsXuA
