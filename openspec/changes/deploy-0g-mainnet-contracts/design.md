## Context

项目当前已在 0G Testnet（Chain ID: 16602）成功部署并验证 PokerGame0G 和 PokerHandINFT 两个合约。部署地址记录在 `deployments/zerog-zerogTestnet.json`：
- PokerGame0G: `0xc6F5495D411405630dF5d5ad32225d7F51Dc1645`
- PokerHandINFT: `0xC96368bbE503a13BCDBE0d38E06c167486d9ccC3`

现在需要将相同的合约部署到 **0G Mainnet**（Chain ID: 16661, RPC: `https://rpc.0g.ai`, Explorer: `https://chainscan.0g.ai`）。部署钱包 `0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc` 已充值 1.0 0G。

**约束条件**：
- 主网交易不可逆，部署前必须确认合约代码正确
- 复用现有测试网验证过的合约源码，不做任何修改
- 部署脚本 `deploy/deploy-0g.js` 已支持 `--network zerogMainnet`
- hardhat.config.js 已配置 zerogMainnet 网络

## Goals / Non-Goals

**Goals:**
- 在 0G 主网成功部署 PokerGame0G + PokerHandINFT 合约
- 完成角色授权（OPERATOR → server wallet, MINTER → PokerGame0G）
- 更新所有配置文件指向主网地址
- 生成主网部署记录供后续验证

**Non-Goals:**
- 不修改合约源码（复用测试网已验证版本）
- 不做前端 UI 改动（仅更新环境变量配置）
- 不迁移测试网数据或状态
- 不执行游戏流程端到端测试（属于后续验证阶段）

## Decisions

### D1: 复用同一份部署脚本而非创建新脚本

**选择**: 使用现有的 `deploy/deploy-0g.js`，通过 `--network zerogMainnet` 参数切换目标网络。

**替代方案**:
- 创建独立的 `deploy-0g-mainnet.js`: 增加维护成本，逻辑完全相同
- 使用 Hardhat Ignition 模块: 过度工程化，当前脚本足够

**理由**: 脚本已通过参数化支持多网络部署，无需重复代码。

### D2: .env.0g 文件统一管理主网与测试网配置

**选择**: 单一 `.env.0g` 文件包含所有 0G 相关变量（RPC URL、私钥、服务器钱包地址），部署后追加主网合约地址。

**理由**: 与 `.env.testnet` 模式保持一致，服务端通过 `ENV_FILE=.env.0g` 加载。测试网和主网的区分通过 RPC URL 自动处理。

### D3: 部署后自动同步 deploy-dual.sh 构建配置

**选择**: 在 tasks 中手动更新 `deploy-dual.sh` 的 `REACT_APP_ZEROG_POKERGAME_ADDRESS_MAINNET` 等变量。

**理由**: 前端构建需要硬编码主网合约地址用于用户端交互验证。

### D4: 部署顺序：PokerGame0G → PokerHandINFT → 角色授权

**选择**: 先部署 PokerGame0G（因为 INFT 的 MINTER_ROLE 需要引用 PokerGame0G 地址）。

**依赖关系**: PokerGame0G 地址是授权 INFT MINTER_ROLE 的输入参数，必须先部署完成。

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| **主网部署不可逆** | 合约代码缺陷无法修复 | 使用测试网已验证的相同源码；部署前 `npx hardhat compile` 确认无编译错误 |
| **Gas 价格波动** | 部署成本超预期 | 1.0 0G 是预估费用（~0.008 0G）的 ~125 倍，充足缓冲 |
| **私钥泄露风险** | 资金损失 | `.env.0g` 已在 `.gitignore`；绝不提交私钥到仓库 |
| **角色授权错误** | 合约权限失控 | 脚本自动从环境变量读取 `ZEROG_SERVER_WALLET`，部署日志输出完整角色映射 |
| **前端配置不同步** | 用户连接到错误网络 | 部署后立即更新 `deploy-dual.sh` 并重新构建 |

## Migration Plan

### 部署步骤

```bash
# Step 1: 编译合约（确保无编译错误）
npx hardhat compile

# Step 2: 部署到 0G 主网
ENV_FILE=.env.0g npx hardhat run deploy/deploy-0g.js --network zerogMainnet

# Step 3: 验证部署结果
cat deployments/zerog-zerogMainnet.json

# Step 4: 在 0G Explorer 验证合约
# https://chainscan.0g/api/address/<pokerGameAddress>
# https://chainscan.0g/api/address/<inftAddress>

# Step 5: 更新 .env.0g 配置（追加主网合约地址）

# Step 6: 更新 deploy-dual.sh 构建配置
```

### Rollback 策略

- 主网合约无法"回滚删除"，但可以 **废弃不用** — 通过不更新配置指向旧地址来弃用
- 如果部署失败（out of gas 等），交易不会上链，直接重试即可
- 如果角色授权错误，ADMIN 可以调用 `revokeRole` + `grantRole` 修正

## Open Questions

- （无 — 所有决策点已在上方明确）
