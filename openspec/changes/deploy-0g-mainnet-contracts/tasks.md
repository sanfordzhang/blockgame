## 1. 部署前准备

- [x] 1.1 确认 `.env.0g` 文件存在且配置正确（`ZEROG_RPC_URL`, `ZEROG_PRIVATE_KEY`, `ZEROG_SERVER_WALLET`）
- [x] 1.2 确认部署钱包 `0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc` 余额 >= 0.01 0G (实际: 0.999 0G)
- [x] 1.3 执行 `npx hardhat compile` 编译合约，确认无编译错误

## 2. 合约部署到 0G 主网

- [x] 2.1 执行部署命令：`ENV_FILE=.env.0g node deploy/deploy-0g-mainnet.js` (绕过 Hardhat Node.js v24 兼容性问题)
- [x] 2.2 部署日志中确认 PokerGame0G 合约地址输出 → `0x4A39B124A0660BBbE403B02D5B37C9878B0BC8bc`
- [x] 2.3 部署日志中确认 PokerHandINFT 合约地址输出 → `0xc6F5495D411405630dF5d5ad32225d7F51dC1645`
- [x] 2.4 确认 OPERATOR_ROLE 授权给服务器钱包成功 (deployer = server wallet, 已有角色)
- [x] 2.5 确认 MINTER_ROLE 授权给 PokerGame0G 地址成功
- [x] 2.6 在 0G Explorer (https://chainscan.0g.ai) 通过 RPC 验证两个合约地址可见且字节码正常

## 3. 部署记录与配置更新

- [x] 3.1 确认 `deployments/zerog-zerogMainnet.json` 文件已生成，内容完整（chainId=16661, 双合约地址, 角色映射）
- [x] 3.2 更新 `.env.0g` 文件：追加 `ZEROG_MAINNET_POKERGAME_ADDRESS` / `ZEROG_MAINNET_INFT_ADDRESS`
- [x] 3.3 更新 `deploy/deploy-dual.sh`：将主网合约地址写入 `REACT_APP_ZEROG_POKERGAME_ADDRESS_MAINNET` 和 `REACT_APP_ZEROG_INFT_ADDRESS_MAINNET`

## 4. 验证与收尾

- [x] 4.1 检查服务端代码（ZeroGContractService.js / ZeroGEventListener.js / ZeroGService.js）读取 `.env.0g` 后指向正确的主网地址 (修复硬编码 rpc.0g.ai → evmrpc.0g.ai)
- [x] 4.2 检查前端 ZeroGContext.js 在主网模式下连接 `https://evmrpc.0g.ai` (修复 rpc.0g.ai + explorer URL)
- [x] 4.3 记录最终部署摘要（合约地址、txHash、角色映射）供团队参考
