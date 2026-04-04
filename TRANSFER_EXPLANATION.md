# CHIP Transfer 问题解析

## 问题回顾

用户在前端钱包页面点击Transfer转账后显示成功，但TronLink钱包没有任何变化。

## 根本原因

**前端Transfer功能只更新数据库，没有调用区块链合约！**

### 代码分析

`server/routes/api/chip.js` 原始代码：

```javascript
router.post('/transfer', async (req, res) => {
    // ❌ 只创建数据库记录，没有调用合约！
    await ChipTransaction.createTransaction({
        walletAddress,
        type: 'transfer',
        amount: -amount,
        // ...
    });

    await ChipTransaction.createTransaction({
        walletAddress: to,
        type: 'receive',
        amount: amount,
        // ...
    });

    res.json({ success: true }); // 返回成功，但链上没有变化
});
```

## 两套余额系统

| 系统 | 存储位置 | 显示位置 | Transfer操作 |
|------|----------|----------|--------------|
| **游戏内余额** | MongoDB数据库 | 前端钱包页面 | ✅ 更新 |
| **区块链余额** | TRON智能合约 | TronLink钱包 | ❌ 未调用 |

## 解决方案

### 1. 添加链上转账功能

新增 `handleOnChainTransfer` 函数：

```javascript
const handleOnChainTransfer = async () => {
    // 检查TronLink
    if (!window.tronWeb) {
      alert('TronLink wallet not detected!');
      return;
    }

    // 获取合约实例
    const CHIP_CONTRACT = 'TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n';
    const contract = await window.tronWeb.contract().at(CHIP_CONTRACT);

    // 调用合约transfer函数
    const tx = await contract.transfer(toAddress, amount).send({
      feeLimit: 100_000_000
    });

    // ✅ 真正的链上转账！
};
```

### 2. 修改UI，提供两个选项

| 按钮 | 功能 | 影响 |
|------|------|------|
| **Game Transfer** | 更新数据库 | 只影响游戏内余额 |
| **On-Chain Transfer** | 调用合约 | 影响TronLink余额 |

## 验证方法

### 1. 检查数据库余额
```bash
curl http://localhost:7778/api/chip/balance/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv
```

### 2. 检查区块链余额
```javascript
const contract = await tronWeb.contract().at('TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n');
const balance = await contract.balanceOf('TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv').call();
console.log(Number(balance) / 1e6, 'CHIP');
```

### 3. 查看交易记录
```
区块链浏览器: https://nile.tronscan.org/#/address/TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv
```

## 当前状态

| 余额类型 | 金额 |
|----------|------|
| 游戏内余额 | 22,640 CHIP |
| 区块链余额 | **55,000 CHIP** |

## 使用指南

### 游戏内转账
1. 点击 "Game Transfer" 按钮
2. 只影响游戏内余额
3. 用于游戏玩家间筹码转移

### 链上转账
1. 点击 "On-Chain Transfer" 按钮
2. TronLink会弹出签名请求
3. 确认后链上余额会变化
4. 可在TronScan查看交易

## 合约信息

| 属性 | 值 |
|------|-----|
| 合约地址 | `TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n` |
| 名称 | CHIP Token |
| 符号 | CHIP |
| 精度 | 6 |
| 网络 | TRON Nile测试网 |

## 已完成的修改

1. ✅ `server/routes/api/chip.js` - 添加链上转账API
2. ✅ `src/pages/CHIPWallet.js` - 添加链上转账功能和UI
3. ✅ 创建测试脚本 `transfer-chip-onchain.js`

---

**修改完成后，重启前端服务即可使用新的转账功能！**
