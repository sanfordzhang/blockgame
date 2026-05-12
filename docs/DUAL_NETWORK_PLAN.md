# 双网络运行方案（测试网 + 主网）

## 目标

同一台服务器同时运行两套游戏环境：
- **主网**：真实 TRX，端口 7777（后端）+ 3000（前端）
- **测试网**：测试 TRX，端口 7778（后端）+ 3001（前端）

---

## 方案概述

通过环境变量文件区分两套配置，启动时指定加载哪个配置文件。前端通过不同端口连接不同后端。

---

## 一、后端改动

### 1. 修改 `server/config/loadEnv.js`

支持通过 `ENV_FILE` 环境变量指定配置文件：

```js
function loadEnv() {
    const rootDir = path.resolve(__dirname, "../..");
    const envFile = process.env.ENV_FILE || '.env';
    dotenv.config({ path: path.join(rootDir, envFile) });
}
```

### 2. 新增配置文件

**`***REMOVED***`**（主网配置）：
```
BLOCKCHAIN_ENABLED=true
TRON_NETWORK=mainnet
SERVER_PORT=7777
MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd
MAINNET_SERVER_PRIVATE_KEY=REDACTED_KEY_4
TRONGRID_API_KEY=b9ffe304-85f2-4ba1-ad7a-d51c4f87c290
```

**`.env.testnet`**（测试网配置）：
```
BLOCKCHAIN_ENABLED=true
TRON_NETWORK=testnet
SERVER_PORT=7778
TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c
TESTNET_PRIVATE_KEY=b185b511ad8314b5cf787108676581223ce354321428f6efb46ef2370c882905
TRONGRID_API_KEY=b9ffe304-85f2-4ba1-ad7a-d51c4f87c290
```

### 3. 启动命令

```bash
# 主网后端（端口 7777）
ENV_FILE=***REMOVED*** node server/server.js

# 测试网后端（端口 7778）
ENV_FILE=.env.testnet node server/server.js
```

---

## 二、前端改动

### 1. 修改 `src/utils/tronInteract.js`

前端需要知道连接哪个后端。通过 `REACT_APP_NETWORK` 环境变量控制默认网络。

⚠️ 注意：不能用 `getEnvVar('REACT_APP_NETWORK')` — webpack 无法替换动态 key 访问。
必须直接写静态引用，webpack 构建时才能正确注入：

```js
// 正确写法（webpack 可静态替换）
let currentNetwork = process.env.REACT_APP_NETWORK || 'mainnet';
```

### 2. 修改 `src/clientConfig.js`

根据环境变量指定 socket 连接地址：

```js
socketURI: isProd
  ? getEnvVar('REACT_APP_SERVER_URI', '')
  : `http://${window.location.hostname}:${getEnvVar('REACT_APP_SERVER_PORT', '7777')}/`,
```

### 3. 新增前端配置文件

**`***REMOVED***.local`**（主网前端）：
```
REACT_APP_NETWORK=mainnet
REACT_APP_SERVER_PORT=7777
REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd
PORT=3000
```

**`.env.testnet.local`**（测试网前端）：
```
REACT_APP_NETWORK=testnet
REACT_APP_SERVER_PORT=7778
REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c
PORT=3001
```

### 4. 启动命令

```bash
# 主网前端（端口 3000）
REACT_APP_NETWORK=mainnet REACT_APP_SERVER_PORT=7777 PORT=3000 npm start

# 测试网前端（端口 3001）
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm start
```

---

### 3. 修改 `src/context/tron/TronContext.js`

`gameMode` 初始值根据环境变量决定，同样必须用静态写法：

```js
const [gameMode, setGameMode] = useState(
  process.env.REACT_APP_NETWORK === 'testnet' ? 'fun' : 'real'
);
```

---

## 四、需要修改的文件清单

| 文件 | 改动 |
|------|------|
| `server/config/loadEnv.js` | 支持 `ENV_FILE` 环境变量 |
| `src/utils/tronInteract.js` | `currentNetwork` 从环境变量读取 |
| `src/clientConfig.js` | `socketURI` 端口从环境变量读取 |
| `src/context/tron/TronContext.js` | `gameMode` 初始值从环境变量读取 |
| 新增 `***REMOVED***` | 主网后端配置 |
| 新增 `.env.testnet` | 测试网后端配置 |

---

## 五、注意事项

1. `***REMOVED***` 和 `.env.testnet` 包含私钥，加入 `.gitignore`
2. 当前 `.env` 保留作为备份，不影响新方案
3. 前端两个实例需要在不同终端分别启动
4. 测试网前端访问 `http://localhost:3001`，主网访问 `http://localhost:3000`
