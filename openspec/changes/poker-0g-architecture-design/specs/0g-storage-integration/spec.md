# Spec: 0G Storage Integration

## ADDED Requirements

### Requirement: Storage Service Initialization

系统 SHALL 在服务启动时初始化 0G Storage 客户端连接。

#### Scenario: Successful initialization
- **GIVEN** `.env` 配置中包含有效的 `ZEROG_STORAGE_INDEXER_RPC` 和 `ZEROG_STORAGE_ENDPOINT`
- **WHEN** 服务启动
- **THEN** 系统创建 0G Storage 客户端实例
- **AND** 日志输出 `[ZeroGStorageService] Initialized at endpoint: {url}`
- **AND** `this.initialized = true`

#### Scenario: Missing configuration
- **GIVEN** `.env` 缺少 `ZEROG_STORAGE_INDEXER_RPC`
- **WHEN** 服务启动
- **THEN** 系统输出警告日志 `[ZeroGStorageService] Storage not configured, using fallback mode`
- **AND** 存储操作返回 mock 结果

#### Scenario: Mock mode enabled
- **GIVEN** `ZEROG_MOCK=true`
- **WHEN** 调用任何上传/下载方法
- **THEN** 系统返回预定义的 mock root hash（如 `"QmMockHash123"`）
- **AND** 不实际调用 0G Storage 网络

---

### Requirement: File Upload

系统 SHALL 支持将文件上传至 0G 去中心化存储网络并获取 Merkle root hash。

#### Scenario: Upload image file
- **WHEN** 调用 `uploadFile(imageBuffer, { contentType: 'image/png' })`
- **THEN** 系统将 buffer 通过 0G Storage SDK 上传
- **AND** 返回 `{ rootHash: '0x...', merkleProof: [...], fileSize: 12345 }`
- **AND** 文件经过 Erasure Coding 分片存储

#### Scenario: Upload JSON metadata
- **WHEN** 调用 `uploadMetadata({ name: "Royal Flush", image: "...", attributes: [...] })`
- **THEN** 系统序列化 JSON 为 UTF-8 buffer 并上传
- **AND** 返回 root hash 可用于 NFT metadataURI 引用

#### Scenario: Upload with encryption
- **WHEN** 调用 `uploadFile(buffer, { encrypt: true, publicKey: '0x...' })`
- **THEN** 系统使用公钥加密文件内容后上传
- **AND** 返回的 root hash 对应加密后的数据

#### Scenario: Upload retry on failure
- **WHEN** 上传请求因网络错误失败
- **THEN** 系统自动重试，采用指数退避策略（1s → 2s → 4s）
- **AND** 最多重试 3 次
- **AND** 重试耗尽后抛出异常

#### Scenario: Async upload queue
- **WHEN** 多个上传请求同时到达
- **THEN** 系统将请求放入内存异步队列
- **AND** 按 FIFO 顺序处理
- **AND** 不阻塞游戏主循环

---

### Requirement: File Download and Verification

系统 SHALL 支持通过 root hash 下载文件并验证数据完整性。

#### Scenario: Download valid file
- **WHEN** 调用 `downloadFile(rootHash)`
- **THEN** 系统从 0G Storage 网络检索文件分片
- **AND** 使用 Merkle proof 验证完整性
- **AND** 返回原始文件 Buffer

#### Scenario: Download with corrupted data
- **WHEN** 下载的文件 Merkle proof 验证失败
- **THEN** 系统抛出 `IntegrityError` 异常
- **AND** 包含错误信息 `"Merkle verification failed for hash: {rootHash}"`

#### Scenario: Download cached file
- **WHEN** 同一 rootHash 在缓存 TTL 内被重复请求
- **THEN** 系统直接返回缓存内容
- **AND** 不发起网络请求

---

### Requirement: NFT Image Storage Integration

系统 SHALL 将 NFT 牌型图片自动上传至 0G Storage 并更新元数据引用。

#### Scenario: Auto-upload on NFT achievement
- **WHEN** 玩家达成牌型成就触发 NFT 铸造流程
- **AND** 当前运行在 0G 模式下（`config.ZEROG_ENABLED === true`）
- **THEN** 系统生成牌型图片（SVG/PNG）
- **AND** 调用 ZeroGStorageService.uploadFile() 上传图片
- **AND** 将返回的 root hash 写入 NFT metadata 的 `image` 字段
- **AND** 格式为 `zerog://{rootHash}` 或完整的 Storage URL

#### Scenario: Fallback to centralized storage
- **WHEN** 0G Storage 服务不可用或未启用
- **THEN** 系统回退到原有的中心化存储方式
- **AND** metadata URI 使用原有格式

---

### Requirement: Game Log Storage

系统 SHALL 支持将完整游戏历史记录上传至 0G Storage 用于审计。

#### Scenario: Store game log after settlement
- **WHEN** 一手牌结算完成
- **AND** `config.ZEROG_LOG_STORAGE === true`
- **THEN** 系统序列化完整游戏状态（玩家动作、牌面、结果）为 JSON
- **AND** 上传至 0G Storage
- **AND** 将 root hash 存入 MongoDB 的 `game_records.storageHash` 字段

#### Scenario: Query game log by hash
- **WHEN** 用户或管理员查询某手牌的历史记录
- **THEN** 系统通过 storageHash 从 0G Storage 下载完整日志
- **AND** 返回可读的游戏过程详情
