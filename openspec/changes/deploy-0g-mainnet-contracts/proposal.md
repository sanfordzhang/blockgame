## Why

0G 测试网（Chain ID: 16602）已成功部署 PokerGame0G 和 PokerHandINFT 两个合约并完成验证。项目需要将合约部署到 0G 主网（Chain ID: 16661）以支持生产环境运行，使玩家能够在主网进行存款、提款、结算和 NFT 铸造等链上操作。部署钱包 `0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc` 已充值 1.0 0G（预估部署费用约 0.008 0G，绰绰有余）。

## What Changes

- **部署 PokerGame0G 合约到 0G 主网** — 游戏主合约，包含 AccessControl 角色管理、deposit/withdraw/settle/delegate 等核心功能
- **部署 PokerHandINFT 合约到 0G 主网** — ERC-7857 Interactive NFT 合约，支持 mint/encryptedTransfer/clone/bindAgent
- **配置角色授权**：
  - PokerGame0G 的 OPERATOR_ROLE 授权给服务器钱包
  - PokerHandINFT 的 MINTER_ROLE 授权给 PokerGame0G 合约地址
- **更新 `.env.0g` 配置文件** — 填入主网合约地址和环境变量
- **更新部署记录** — 在 `deployments/` 目录生成主网部署 JSON
- **更新前端构建配置** — `deploy-dual.sh` 中的 `REACT_APP_ZEROG_*` 主网地址变量

## Capabilities

### New Capabilities

- `zerog-mainnet-deploy`: 0G 主网智能合约部署与配置，包括双合约部署、角色授权、环境变量更新、部署记录生成及前端构建配置同步

### Modified Capabilities

（无现有 spec 级别的需求变更，仅新增主网部署能力）

## Impact

- **合约代码**：`contracts/0g/PokerGame0G.sol`、`contracts/0g/PokerHandINFT.sol`（编译后部署）
- **部署脚本**：`deploy/deploy-0g.js`（复用现有脚本，通过 `--network zerogMainnet` 执行）
- **配置文件**：`.env.0g`（需创建或更新主网合约地址）、`hardhat.config.js`（已含 zerogMainnet 配置）
- **部署记录**：`deployments/zerog-zerogMainnet.json`（自动生成）
- **构建脚本**：`deploy/deploy-dual.sh`（更新 REACT_APP_ZEROG_POKERGAME_ADDRESS / REACT_APP_ZEROG_INFT_ADDRESS 主网值）
- **服务端代码**：`server/blockchain/ZeroGContractService.js`、`server/blockchain/ZeroGEventListener.js`（需指向主网地址）
- **前端代码**：`src/context/zero-g/ZeroGContext.js`（主网 RPC 地址切换）
