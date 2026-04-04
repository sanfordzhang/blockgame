# CHIP Staking 功能说明

## 问题1：怎么将抵押的CHIP在TronLink钱包里显示？

### 当前状态

- **Staking合约地址**: `TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW`
- **CHIP代币合约**: `TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n`
- **网络**: TRON Nile测试网

### 如何质押CHIP到区块链

#### 方法1：通过前端页面（推荐）

1. 访问钱包页面: http://127.0.0.1:3001/wallet
2. 切换到 **"Stake"** 标签页
3. 点击 **"Stake CHIP"** 按钮
4. 输入质押金额和锁定天数
5. 通过TronLink签名确认交易

**注意**: 需要先实现前端调用Staking合约的功能！

#### 方法2：直接通过TronLink

1. 打开TronLink钱包
2. 进入"合约"或"DApp"页面
3. 输入Staking合约地址: `TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW`
4. 调用 `stake(uint256 amount, uint256 lockDuration)` 函数
   - amount: 质押金额（单位：SUN，1 CHIP = 1,000,000 SUN）
   - lockDuration: 锁定时间（单位：秒，最小7天 = 604800秒）

示例：
- 质押 1000 CHIP，锁定30天
- amount = 1000000000 (1000 * 1e6)
- lockDuration = 2592000 (30 * 24 * 60 * 60)

#### 方法3：使用脚本质押

```bash
# 创建质押脚本
node stake-chip.js
```

### TronLink显示质押的CHIP

当您质押CHIP到Staking合约后：

1. **TronLink会自动显示**：
   - CHIP余额减少（转入Staking合约）
   - 在合约交互记录中可以看到质押操作

2. **查看质押详情**：
   - 访问: https://nile.tronscan.org/#/contract/TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW
   - 点击"Read Contract"
   - 调用 `stakes(address)` 查询您的质押信息

---

## 问题2：质押的Stake有什么作用？

### 主要功能

#### 1. 🏆 VIP等级提升

| 质押金额 | VIP等级 | 手续费折扣 |
|---------|---------|----------|
| < 10,000 CHIP | BRONZE | 0% |
| ≥ 10,000 CHIP | SILVER | 5% |
| ≥ 100,000 CHIP | GOLD | 10% |
| ≥ 500,000 CHIP | PLATINUM | 15% |

#### 2. 💰 质押奖励

- **奖励来源**: 游戏平台收入（抽成Rake）
- **分配方式**: 按质押比例分配
- **收益计算**: 
  ```
  您的奖励 = (您的质押金额 / 总质押金额) × 奖励池金额
  ```

#### 3. 🎮 游戏特权

- **优先入座**: VIP玩家优先匹配
- **特殊锦标赛**: 专属VIP锦标赛
- **NFT空投**: 质押用户优先获得NFT奖励

#### 4. 🔒 锁定期与惩罚

- **最短锁定期**: 7天
- **最长锁定期**: 365天
- **提前解押惩罚**: 10%本金

---

## 质押流程图

```
┌─────────────┐
│ CHIP余额    │
│ (游戏内)    │
└──────┬──────┘
       │
       │ 提现到钱包
       ▼
┌─────────────┐
│ CHIP余额    │
│ (TronLink)  │
└──────┬──────┘
       │
       │ stake() 质押
       ▼
┌─────────────┐
│ Staking合约 │ ← 质押期间获得奖励
│ (锁定CHIP)  │
└──────┬──────┘
       │
       │ unstake() 解押
       ▼
┌─────────────┐
│ CHIP余额    │
│ (TronLink)  │
└─────────────┘
```

---

## 下一步操作

### 立即质押CHIP

1. 确保您的TronLink钱包有CHIP余额
2. 访问: https://nile.tronscan.org/#/contract/TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW
3. 连接TronLink钱包
4. 调用 `stake()` 函数

### 查看质押信息

```bash
# 查询您的质押信息
node check-my-stake.js
```

---

## 常见问题

### Q: 质押后能随时取回吗？
A: 不能。必须等待锁定期结束，否则会扣除10%惩罚金。

### Q: 奖励如何领取？
A: 调用Staking合约的 `claimReward()` 函数领取待领奖励。

### Q: 质押会显示在TronLink吗？
A: 会。质押后CHIP会从您的钱包转到Staking合约，在交易记录中可见。

### Q: 可以增加质押金额吗？
A: 可以。再次调用 `stake()` 会叠加质押金额，锁定期重新计算。

---

## 合约信息

| 项目 | 地址 |
|------|------|
| CHIP代币 | `TX2R1MbjvVGiNA48iuVcf7bzJGCP3q9x2n` |
| Staking合约 | `TBrmQ4pGBYYKrRv8SYaLACkBodwA7f1RGW` |
| 区块链浏览器 | https://nile.tronscan.org |
