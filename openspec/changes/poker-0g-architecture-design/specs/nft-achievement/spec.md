# Specification: NFT Achievement System (0G Enhanced)

## MODIFIED Requirements

### Requirement: NFT Metadata

系统 SHALL 为每个NFT提供元数据URI，**0G 模式下引用去中心化存储**。

#### Scenario: Token URI generation (0G mode)
- **WHEN** 查询 `tokenURI(tokenId)`
- **AND** 当前运行在 0G 网络（`config.ZEROG_ENABLED === true`）
- **THEN** 返回格式为 `zerog://{storageRootHash}` 或 `https://storage.0g.ai/{rootHash}/metadata.json`
- **AND** metadata JSON 的 image 字段同样引用 0G Storage root hash

#### Scenario: Metadata content (enhanced for 0G)
- **GIVEN** NFT元数据API（0G 模式）
- **WHEN** 访问 tokenURI
- **THEN** 返回JSON包含：
  - name: 成就名称
  - description: 成就描述
  - image: **0G Storage URI（zerog://{rootHash}）**
  - attributes: 稀有度、达成时间等
  - **blockchain_metadata**: **新增字段**
    - network: "0g-testnet" 或 "0g-mainnet"
    - contract_address: PokerHandINFT 合约地址
    - **da_proof_hash**: 对应 DA 层证明哈希
    - **fairness_verify_url**: 公平性验证链接
    - **storage_root_hash**: 0G Storage 文件根哈希

#### Scenario: Token URI generation (TRON legacy mode)
- **WHEN** 查询 `tokenURI(tokenId)`
- **AND** 当前运行在 TRON 网络（非 0G 模式）
- **THEN** 返回格式不变：`https://api.poker-game.com/nft/{achievementTypeId}/{tokenId}`
- **确保向后兼容**

---

### Requirement: NFT Minting with Signature

系统 SHALL 验证签名后铸造NFT，**0G 模式下走 PokerHandINFT 合约**。

#### Scenario: Successful NFT minting on 0G chain
- **WHEN** 玩家调用 NFT 铸造流程
- **AND** 当前为 0G 模式
- **AND** 签名有效（未过期、签名正确）
- **AND** 月度限量未达上限
- **THEN** 系统先上传 NFT 图片和元数据至 0G Storage
- **AND** 调用 `PokerHandINFT.mint(to, handType, storageRootHash, metadataURI)`
- **AND** 月度铸造计数+1
- **AND** 记录该签名已使用（防止重复铸造）
- **AND** 触发 Socket 事件 `nft:minted`（增强版，含 txHash 和 tokenId）

#### Scenario: Successful NFT minting on TRON chain (unchanged)
- **WHEN** 玩家调用 `claimNFT(achievementTypeId, timestamp, signature)`
- **AND** 当前为 TRON 模式
- **AND** 签名有效
- **THEN** 行为与修改前完全一致（调用 TRON 链 AchievementNFTOnChainV2 合约）

---

### Requirement: NFT Ownership and Transfer

系统 SHALL 遵循 TRC721/ERC721 标准，**0G 模式额外支持 INFT 特有操作**。

#### Scenario: Transfer NFT (0G mode with INFT features)
- **WHEN** NFT 持有者在 0G 模式下调用 `transferFrom(from, to, tokenId)`
- **THEN** NFT 所有权转移给新地址
- **AND** 触发 `Transfer` 事件
- **AND** **新增**: 如果该 INFT 绑定了 AI Agent，转移后 Agent 绑定保留（新主人可选择 unbind）

#### Scenario: Encrypted transfer option (new for 0G)
- **WHEN** 0G 模式下的 INFT 持有者
- **THEN** 除了普通 transfer 外，还可选择 `encryptedTransfer(to, encryptedMetadata)` 进行加密转移
- **AND** 此选项在 TRON 模式的 NFT 上不可用

---

### Requirement: NFT Service Events

系统 SHALL 通过Socket推送NFT相关事件给客户端，**0G 模式下事件增强**。

#### Scenario: Notify achievement unlocked (enhanced)
- **WHEN** 玩家达成成就
- **THEN** 系统推送 `nft:achievement_unlocked` 事件
- **AND** 包含：
  - 成就类型（原有）
  - 签名数据（原有）
  - 铸造价格（原有）
  - 有效期（原有）
  - **新增**: `storageReady: boolean`（0G Storage 是否可用）
  - **新增**: `targetChain: "tron" | "0g"`（目标铸币链）

#### Scenario: Notify monthly limit reached (unchanged)
- **WHEN** 玩家达成成就但月度限量已满
- **THEN** 系统推送 `nft:limit_reached` 事件（行为不变）
