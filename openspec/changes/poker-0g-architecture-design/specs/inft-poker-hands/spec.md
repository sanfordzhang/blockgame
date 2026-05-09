# Spec: INFT Poker Hands (ERC-7857)

## ADDED Requirements

### Requirement: INFT Minting Flow

系统 SHALL 实现基于 0G 链的 INFT 完整铸造流程。

#### Scenario: Trigger INFT mint on poker achievement
- **WHEN** 玩家在 0G 模式下达成了符合条件的牌型成就
- **AND** 月度限量未满
- **THEN** 系统执行以下流程：
  1. 生成牌型图片（SVG 渲染）
  2. 上传图片到 0G Storage → 获取 `storageRootHash`
  3. 构建 INFT 元数据 JSON（引用 storageRootHash 作为 image）
  4. 上传元数据到 0G Storage → 获取 `metadataURI`
  5. 调用 PokerHandINFT.mint(to, handType, storageRootHash, metadataURI)
  6. 记录铸造结果到 MongoDB

#### Scenario: INFT metadata format
- **WHEN** 构建 INFT 元数据
- **THEN** 符合以下 JSON Schema：
```json
{
  "name": "Royal Flush #42",
  "description": "Achieved a Royal Flush in Texas Hold'em on 0G Poker",
  "image": "zerog://0xabc123...{storageRootHash}",
  "external_url": "https://poker-game.com/nft/42",
  "attributes": [
    {
      "trait_type": "Hand Type",
      "value": "Royal Flush"
    },
    {
      "trait_type": "Cards",
      "value": "A♠ K♠ Q♠ J♠ T♠"
    },
    {
      "trait_type": "Rarity",
      "value": "Legendary"
    },
    {
      "trait_type": "Achieved At",
      "value": 1709251200,
      "display_type": "date"
    },
    {
      "trait_type": "Table ID",
      "value": "tbl_0g_001"
    },
    {
      "trait_type": "Network",
      "value": "0G Chain"
    }
  ],
  "blockchain_metadata": {
    "network": "0g-testnet",
    "contract_address": "0x...",
    "da_proof_hash": "0x...",
    "fairness_verified": true
  }
}
```

#### Scenario: INFT minting cost
- **WHEN** 玩家铸造 INFT
- **THEN** 铸造费用为 0.001 ETH（testnet 免费）
- **AND** 费用从玩家托管余额扣除
- **AND** 若余额不足则提示先充值

---

### Requirement: INFT Types and Rarity

系统 SHALL 定义 6 种 INFT 牌型类型及其稀有度。

| Type ID | 名称 | 稀有度 | 月限量 | 特殊属性 |
|---------|------|--------|--------|----------|
| 0 | 皇家同花顺 (Royal Flush) | 传说 | 10 | 自动绑定 AI Agent |
| 1 | 同花顺 (Straight Flush) | 史诗 | 50 | 加密元数据 |
| 2 | 四条 (Four of a Kind) | 稀有 | 200 | 标准格式 |
| 3 | 葫芦 (Full House) | 普通 | 500 | 标准格式 |
| 4 | 同花 (Flush) | 普通 | 1000 | 标准格式 |
| 5 | 顺子 (Straight) | 普通 | 2000 | 标准格式 |

#### Scenario: Legendary INFT auto-binds AI Agent
- **WHEN** 玩家获得皇家同花顺 INFT（Type 0）
- **THEN** 铸造成功后自动调用 `bindAgent(aiAgentAddress)`
- **AND** 该 INFT 关联一个专属 AI Agent
- **AND** AI Agent 可在锦标赛中使用该 INFT 作为身份标识

---

### Requirement: INFT Encrypted Transfer

系统 SHALL 支持 INFT 加密元数据的安全转移功能。

#### Scenario: Encrypt and transfer INFT
- **WHEN** INFT 持有者调用加密转移接口
- **THEN** 系统使用接收方公钥加密元数据的敏感部分（如卡牌详情、达成时间戳）
- **AND** 调用合约的 `encryptedTransfer(to, encryptedMetadata)`
- **AND** 只有持有对应私钥的接收方可解密

#### Scenario: Decrypt received INFT metadata
- **WHEN** 玩家接收到加密转移的 INFT
- **AND** 使用自己的私钥解密
- **THEN** 显示完整的 NFT 元数据和卡牌图片
- **AND** 解密失败时显示"需要正确的密钥解锁此 NFT"

---

### Requirement: INFT Cloning

系统 SHALL 支持 INFT 克隆功能，创建具有相同结构的副本。

#### Scenario: Clone own INFT
- **WHEN** INFT 持有者调用 clone(newOwner)
- **AND** 持有者支付克隆费用（0.0005 ETH）
- **THEN** 创建新 token 给 newOwner
- **AND** 新 token 继承原 token 的 handType 和基础属性
- **AND** 原 token 不受影响
- **AND** 新 token 获得独立的 tokenId 和新的 timestamp

#### Scenario: Clone restrictions
- **WHEN** 非 holder 尝试克隆某 INFT
- **THEN** 合约 revert `"Only token holder can clone"`
- **WHEN** 传说级 INFT（皇家同花顺）被尝试克隆
- **THEN** 合约 revert `"Legendary INFT cannot be cloned"`

---

### Requirement: INFT Gallery Display

系统 SHALL 在前端展示 INFT 收藏画廊。

#### Scenario: View owned INFTs
- **WHEN** 用户访问 NFT 页面且已连接 0G 钱包
- **THEN** 页面展示用户拥有的所有 PokerHandINFT
- **AND** 每张卡片显示：
  - 牌型名称和图片（从 0G Storage 加载）
  - 稀有度标签（颜色区分）
  - Token ID
  - 达成日期
  - AI Agent 绑定状态（如有）

#### Scenario: INFT detail view
- **WHEN** 点击某张 INFT 卡片
- **THEN** 弹出详情面板显示：
  - 高清牌型图片
  - 完整属性列表
  - 0G Storage root hash（可验证）
  - DA 证明链接（如可用）
  - 转移 / 克隆 / 绑定 Agent 按钮

#### Scenario: Cross-chain INFT view
- **WHEN** 用户同时拥有 TRON NFT 和 0G INFT
- **THEN** NFT 页面提供 Tab 切换："TRON NFT" | "0G INFT"
- **AND** 分别展示两条链上的收藏

---

### Requirement: INFT Event Notifications

系统 SHALL 通过 Socket 推送 INFT 相关事件。

#### Scenario: Notify INFT mint success
- **WHEN** INFT 成功铸造上链
- **THEN** 推送 `inft:minted` 事件给玩家
- **AND** 包含：tokenId, handType, metadataURI, txHash

#### Scenario: Notify INFT transfer received
- **WHEN** 玩家收到加密转移的 INFT
- **THEN** 推送 `inft:received` 事件
- **AND** 包含：tokenId, fromAddress, isEncrypted

#### Scenario: Notify AI Agent binding
- **WHEN** INFT 绑定了 AI Agent
- **THEN** 推送 `inft:agent_bound` 事件
- **AND** 包含：tokenId, agentAddress
