# TRON 区块链集成部署指南

本文档提供从开发到生产环境的完整部署流程。

---

## 目录

1. [环境准备](#1-环境准备)
2. [申请 TronGrid API Key](#2-申请-trongrid-api-key)
3. [部署合约到测试网](#3-部署合约到测试网)
4. [配置环境变量](#4-配置环境变量)
5. [运行测试](#5-运行测试)
6. [部署到生产环境](#6-部署到生产环境)

---

## 1. 环境准备

### 1.1 安装 TronLink 钱包

1. 下载并安装 [TronLink 浏览器扩展](https://www.tronlink.org/)
2. 创建或导入钱包
3. 切换到 **Nile 测试网**（用于开发测试）
   - 点击 TronLink 扩展右上角的网络选择器
   - 选择 "Nile Testnet"

### 1.2 获取测试网 TRX

访问以下方式获取测试 TRX：

**方式一：TronLink 钱包内置领取（最推荐）**
1. 打开 TronLink 钱包扩展
2. 切换到 **Nile 测试网**
3. 点击钱包界面中的 **"领取测试币"** 或 **"Faucet"** 按钮
4. 每天可领取 10,000 测试 TRX

**方式二：通过 TronLink 移动端 App**
1. 下载 TronLink App (iOS/Android)
2. 切换到 Nile 测试网
3. 进入 "发现" → 搜索 "faucet"
4. 直接在 App 内领取

**方式三：GitHub 搜索最新水龙头**
```
https://github.com/search?q=tron+testnet+faucet
```
查找社区维护的最新水龙头项目

**方式四：官方文档**
```
https://developers.tron.network/docs/getting-testnet-tokens-on-tron
```
访问官方文档查看最新的水龙头地址

---

## 2. 申请 TronGrid API Key

TronGrid 是 TRON 网络的 API 服务提供商，用于查询区块链数据。

### 2.1 注册步骤

1. 访问 [TronGrid 官网](https://www.trongrid.io/)
2. 点击 "Sign Up" 注册账号
3. 填写邮箱和密码，完成验证
4. 登录后进入 Dashboard

### 2.2 创建 API Key

1. 点击 "Create New Key"
2. 选择套餐（免费套餐足够开发使用）
3. 填写应用信息：
   - Application Name: `Bridge Game`
   - Description: `Texas Hold'em Poker Game on TRON`
4. 提交后获取 API Key

### 2.3 保存 API Key

```bash
# 记录你的 API Key，格式类似：
TRONGRID_API_KEY=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## 3. 部署合约到测试网

### 3.1 配置部署账户

编辑 `.env` 文件（先复制模板）：

```bash
cp .env.template .env
```

在 `.env` 中添加部署者私钥：

```env
# 测试网部署私钥 (请勿在主网使用测试私钥!)
NILE_PRIVATE_KEY=你的测试钱包私钥
```

**获取私钥方法**：
1. 打开 TronLink 钱包
2. 点击头像 → 导出私钥
3. 输入密码确认
4. 复制私钥（64位十六进制字符串）

### 3.2 部署命令

```bash
# 进入项目目录
cd /Users/yingfengzhang/1JackSource/blockchain/game-core

# 部署到 Nile 测试网
npx tronbox migrate --network nile

# 如果遇到权限问题，添加 --reset 强制重新部署
npx tronbox migrate --network nile --reset
```

### 3.3 记录合约地址

部署成功后会显示：

```
Deploying 'BridgeGameV1'
------------------------
> transaction hash:    0x...
> contract address:    TRXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
> block number:        xxxxxx
> block timestamp:     xxxxxx
```

**重要**：将合约地址保存到 `.env`：

```env
NILE_CONTRACT_ADDRESS=TRXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 3.4 验证部署

在 TronScan 测试网浏览器查看合约：

```
https://nile.tronscan.org/#/contract/你的合约地址
```

---

## 4. 配置环境变量

### 4.1 完整 .env 配置

创建 `.env` 文件，填入以下配置：

```env
# ===========================================
# 服务器配置
# ===========================================
PORT=3001
NODE_ENV=development

# ===========================================
# 数据库配置 (MongoDB)
# ===========================================
MONGODB_URI=mongodb://localhost:27017/bridge-game

# ===========================================
# Redis 配置
# ===========================================
REDIS_URL=redis://localhost:6379

# ===========================================
# TRON 配置
# ===========================================

# TronGrid API Key (从 https://www.trongrid.io 获取)
TRONGRID_API_KEY=your-trongrid-api-key-here

# 测试网配置
NILE_PRIVATE_KEY=your-test-wallet-private-key
NILE_CONTRACT_ADDRESS=your-deployed-contract-address-on-nile

# 主网配置 (生产环境使用)
# MAINNET_PRIVATE_KEY=your-production-wallet-private-key
# MAINNET_CONTRACT_ADDRESS=your-deployed-contract-address-on-mainnet

# ===========================================
# 合约配置
# ===========================================

# 初始抽水率 (basis points, 250 = 2.5%)
DEFAULT_RAKE_RATE=250

# 最小抽水率 (1%)
MIN_RAKE_RATE=100

# 最大抽水率 (10%)
MAX_RAKE_RATE=1000

# ===========================================
# 游戏配置
# ===========================================

# 最小存款 (TRX)
MIN_DEPOSIT=10

# 最大存款 (TRX)
MAX_DEPOSIT=100000

# 游戏桌子买入
DEFAULT_BUYIN=50

# ===========================================
# 管理员配置
# ===========================================

# 管理员钱包地址 (逗号分隔多个)
ADMIN_ADDRESSES=TRX_ADMIN_ADDRESS_1,TRX_ADMIN_ADDRESS_2

# JWT 密钥
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# ===========================================
# 前端配置
# ===========================================

# API 基础 URL
REACT_APP_API_URL=http://localhost:3001

# 合约地址 (前端使用)
REACT_APP_NILE_CONTRACT_ADDRESS=your-nile-contract-address
# REACT_APP_MAINNET_CONTRACT_ADDRESS=your-mainnet-contract-address
```

### 4.2 安全注意事项

```bash
# 确保 .env 文件不被提交到 Git
echo ".env" >> .gitignore

# 检查 .gitignore 是否已包含 .env
cat .gitignore | grep ".env"
```

---

## 5. 运行测试

### 5.1 智能合约测试

```bash
# 运行合约单元测试
npx tronbox test

# 指定网络运行测试
npx tronbox test --network nile
```

### 5.2 后端 API 测试

```bash
# 安装测试依赖
npm install --save-dev jest supertest

# 运行 API 测试
npm run test:api

# 或直接运行
npx jest tests/api
```

### 5.3 前端组件测试

```bash
# 安装测试依赖
npm install --save-dev @testing-library/react @testing-library/jest-dom

# 运行组件测试
npm run test:frontend

# 或直接运行
npx jest tests/frontend
```

### 5.4 E2E 端到端测试

```bash
# 安装 Playwright
npx playwright install

# 运行 E2E 测试
npx playwright test

# 带界面的调试模式
npx playwright test --ui

# 生成测试报告
npx playwright show-report
```

### 5.5 一键运行所有测试

```bash
# 添加到 package.json scripts
npm pkg set scripts.test:all="npm run test:contract && npm run test:api && npm run test:frontend && npm run test:e2e"

# 运行所有测试
npm run test:all
```

---

## 6. 部署到生产环境

### 6.1 前置检查清单

- [ ] 合约通过安全审计
- [ ] 所有测试通过
- [ ] 准备好主网部署资金（TRX 用于支付能量/带宽）
- [ ] 准备好管理员钱包（建议使用硬件钱包）
- [ ] 配置好生产环境服务器
- [ ] 设置好监控和告警

### 6.2 部署合约到主网

```bash
# ⚠️ 警告：主网部署涉及真实资金，请确保已完成审计

# 1. 配置主网私钥
# 编辑 .env 文件，添加 MAINNET_PRIVATE_KEY

# 2. 部署到主网
npx tronbox migrate --network mainnet

# 3. 记录合约地址
# 保存 MAINNET_CONTRACT_ADDRESS 到 .env
```

### 6.3 部署后端服务

```bash
# 方式一：使用 PM2 部署
npm install -g pm2

# 启动服务
pm2 start server/index.js --name "bridge-game-api"

# 查看日志
pm2 logs bridge-game-api

# 设置开机自启
pm2 startup
pm2 save
```

```bash
# 方式二：使用 Docker 部署
# 创建 Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server/index.js"]
EOF

# 构建镜像
docker build -t bridge-game-api .

# 运行容器
docker run -d \
  --name bridge-game-api \
  -p 3001:3001 \
  --env-file .env \
  bridge-game-api
```

### 6.4 部署前端应用

```bash
# 构建生产版本
npm run build

# 部署到 Nginx
# 1. 将 build 目录内容复制到服务器
scp -r build/* user@server:/var/www/bridge-game/

# 2. Nginx 配置示例
cat > /etc/nginx/sites-available/bridge-game << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        root /var/www/bridge-game;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

# 启用站点
ln -s /etc/nginx/sites-available/bridge-game /etc/nginx/sites-enabled/
nginx -t && nginx -s reload
```

### 6.5 配置 HTTPS (推荐)

```bash
# 使用 Certbot 获取免费 SSL 证书
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 7. 常用命令速查

```bash
# 开发环境启动
npm run dev

# 合约编译
npx tronbox compile

# 合约部署 (测试网)
npx tronbox migrate --network nile

# 合约部署 (主网)
npx tronbox migrate --network mainnet

# 运行测试
npm test

# 查看合约状态
npx tronbox console --network nile

# 在控制台中交互
# const contract = await BridgeGameV1.deployed()
# const rate = await contract.rakeRate()
# console.log(rate.toString())
```

---

## 8. 故障排查

### 问题 1: 部署失败 - Insufficient Energy

```bash
# 解决方案：冻结 TRX 获取能量
# 在 TronLink 中操作：钱包 -> 冻结 -> 获取能量
```

### 问题 2: TronGrid API 限流

```bash
# 解决方案：升级 TronGrid 套餐或使用自建节点
# 或者添加请求延迟
```

### 问题 3: 合约调用失败

```bash
# 在 TronScan 查看交易详情
# https://tronscan.org/#/transaction/tx_hash

# 常见错误：
# - REVERT: 检查合约 require 条件
# - OUT_OF_ENERGY: 增加能量或优化合约
```

### 问题 4: 前端连接钱包失败

```javascript
// 检查 TronLink 是否正确安装
if (!window.tronLink) {
  console.error('TronLink not installed');
}

// 检查网络是否正确
const { node } = await window.tronLink.request({ method: 'tronRequest' });
console.log('Connected network:', node.fullNode);
```

---

## 9. 相关链接

| 资源 | 链接 |
|------|------|
| TronLink 钱包 | https://www.tronlink.org/ |
| TronGrid API | https://www.trongrid.io/ |
| TRON 开发者文档 | https://developers.tron.network/docs/getting-testnet-tokens-on-tron |
| Nile 区块浏览器 | https://nile.tronscan.org |
| 主网区块浏览器 | https://tronscan.org |
| TronBox 文档 | https://developers.tron.network/docs/tronbox |
| TronWeb 文档 | https://developers.tron.network/reference/tronweb-object |

---

## 10. 联系支持

如遇到问题，请：
1. 查看 Tron 开发者文档：https://developers.tron.network
2. 加入 Tron 开发者社区
3. 提交 Issue 到项目仓库
