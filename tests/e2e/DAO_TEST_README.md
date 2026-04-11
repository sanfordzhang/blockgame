# DAO Governance 测试文档

## 📋 DAO 模块功能说明

### 四个 Tab 功能

| Tab | 功能说明 | 状态筛选 |
|-----|---------|---------|
| **Active** | 显示投票进行中的提案 | `state=ACTIVE` |
| **Passed** | 显示已通过的提案 | `state=PASSED` |
| **All** | 显示所有状态的提案 | 无筛选 |
| **Create** | 创建新提案的表单 | - |

### Active Tab
- 显示当前正在投票的提案
- 每个提案显示：
  - 标题和描述
  - 投票统计（赞成/反对/法定人数）
  - 投票进度条
  - 投票截止时间
  - 投票按钮（Vote For / Vote Against）
- 只有连接钱包且持有 CHIP 的用户才能投票
- 每个用户对每个提案只能投票一次

### Passed Tab
- 显示投票已结束且通过的提案
- 通过条件：
  - 赞成票 > 反对票
  - 达到法定人数（Quorum）
- 不显示投票按钮（投票已结束）

### All Tab
- 显示所有提案，包括：
  - `ACTIVE` - 投票中
  - `PASSED` - 已通过
  - `EXECUTED` - 已执行
  - `REJECTED` - 已拒绝
- 可以查看提案的完整历史

### Create Tab
- 提案创建表单
- 需要满足条件：
  - 钱包已连接
  - CHIP 余额 >= 提案门槛（Proposal Threshold）
- 表单字段：
  - **Title** - 提案标题（必填）
  - **Description** - 提案描述（必填）
- 提交后自动切换到 Active Tab 显示新创建的提案

---

## 🧪 测试文件说明

### 1. `dao-cdp-e2e.js` - 基础 CDP 测试
**功能**: 连接真实后端 API，通过 CDP 操作浏览器进行端对端测试

**测试内容**:
- ✅ 页面加载和导航
- ✅ 四个 Tab 切换
- ✅ 提案列表显示
- ✅ 创建提案表单填写
- ✅ 投票按钮交互
- ✅ 投票统计显示
- ✅ 提案状态 Badge 显示

**运行条件**:
```bash
# 1. 启动后端服务
ENV_FILE=.env.testnet node server/server.js

# 2. 启动前端服务
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client

# 3. 启动调试 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/"

# 4. 运行测试
node tests/e2e/dao-cdp-e2e.js
```

**截图输出**: `tests/e2e/screenshots/dao/dao-*.png`

---

### 2. `dao-cdp-mock-e2e.js` - Mock API 测试
**功能**: 启动 Mock API 服务器，无需真实后端即可测试前端 UI

**测试内容**:
- ✅ 所有 `dao-cdp-e2e.js` 的测试内容
- ✅ Mock 数据包含 5 个不同状态的提案
- ✅ 模拟投票 API 调用
- ✅ 模拟创建提案 API 调用
- ✅ 详细的测试报告（PASS/FAIL/WARN）

**Mock 数据**:
- 2 个 ACTIVE 提案（可投票）
- 1 个 PASSED 提案
- 1 个 EXECUTED 提案
- 1 个 REJECTED 提案

**运行条件**:
```bash
# 1. 启动前端服务（无需后端）
REACT_APP_NETWORK=testnet PORT=3001 npm run start:client

# 2. 启动调试 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/"

# 3. 运行测试（自动启动 Mock API）
node tests/e2e/dao-cdp-mock-e2e.js
```

**Mock API 端口**: `7780`

**截图输出**: `tests/e2e/screenshots/dao/dao-*.png`

---

### 3. `dao-governance.spec.js` - Playwright 测试
**功能**: 使用 Playwright 进行基础页面测试

**测试内容**:
- ✅ 页面加载
- ✅ 提案列表或空状态显示
- ✅ 按钮区域存在
- ✅ 投票界面元素

**运行条件**:
```bash
# 需要 Playwright 环境
npx playwright test tests/e2e/dao-governance.spec.js
```

---

### 4. `dao.api.test.js` - API 单元测试
**功能**: 测试 DAO API 端点（使用 Mock Service）

**测试内容**:
- ✅ GET /api/dao/proposals - 获取提案列表
- ✅ GET /api/dao/proposals/:id - 获取提案详情
- ✅ POST /api/dao/proposals/create - 创建提案
- ✅ POST /api/dao/proposals/:id/vote - 投票
- ✅ GET /api/dao/proposals/:id/votes - 获取投票统计
- ✅ GET /api/dao/proposals/:id/voted/:address - 检查是否已投票
- ✅ POST /api/dao/proposals/:id/execute - 执行提案
- ✅ 认证和权限验证
- ✅ 错误处理（重复投票、余额不足等）

**运行条件**:
```bash
npm test tests/api/dao.api.test.js
```

---

## 🚀 快速开始

### 完整端对端测试（推荐）

```bash
# 1. 清理环境
kill -9 $(lsof -ti:7778)
kill -9 $(lsof -ti:3001)

# 2. 启动服务
ENV_FILE=.env.testnet node server/server.js &
REACT_APP_NETWORK=testnet REACT_APP_SERVER_PORT=7778 PORT=3001 npm run start:client &

# 3. 等待服务启动
sleep 5

# 4. 启动调试 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/dao" &

# 5. 等待浏览器启动
sleep 3

# 6. 运行测试
node tests/e2e/dao-cdp-e2e.js
```

### 快速 Mock 测试（无需后端）

```bash
# 1. 启动前端
REACT_APP_NETWORK=testnet PORT=3001 npm run start:client &

# 2. 启动调试 Chrome
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/dao" &

# 3. 运行测试（自动启动 Mock API）
node tests/e2e/dao-cdp-mock-e2e.js
```

---

## 📸 测试截图

测试运行后会在 `tests/e2e/screenshots/dao/` 目录生成截图：

```
dao-01-page-loaded.png          # 页面初始加载
dao-02-tab-active.png           # Active Tab
dao-03-tab-passed.png           # Passed Tab
dao-04-tab-all.png              # All Tab
dao-05-tab-create.png           # Create Tab
dao-06-create-form-filled.png   # 填写创建表单
dao-07-create-submitted.png     # 提交提案
dao-08-proposals-list.png       # 提案列表
dao-09-vote-for.png             # 投票操作
dao-10-vote-stats.png           # 投票统计
dao-11-final-state.png          # 最终状态
```

---

## 🔍 测试验证点

### UI 层面
- [x] 页面标题显示 "DAO Governance"
- [x] 四个 Tab 按钮可见且可点击
- [x] Tab 切换后内容正确更新
- [x] 提案卡片显示完整信息（标题、描述、状态、投票数）
- [x] 投票进度条正确显示
- [x] 状态 Badge 颜色正确（ACTIVE=绿色、PASSED=蓝色等）
- [x] 创建表单包含标题和描述输入框
- [x] 投票按钮在 ACTIVE 提案上显示

### 功能层面
- [x] Active Tab 只显示 ACTIVE 状态提案
- [x] Passed Tab 只显示 PASSED 状态提案
- [x] All Tab 显示所有状态提案
- [x] 创建提案需要钱包连接和足够 CHIP
- [x] 投票需要钱包连接和持有 CHIP
- [x] 每个用户对每个提案只能投票一次
- [x] 投票后统计数据实时更新

### API 层面
- [x] GET /api/dao/proposals 支持 state 参数筛选
- [x] POST /api/dao/proposals/create 验证提案门槛
- [x] POST /api/dao/proposals/:id/vote 防止重复投票
- [x] 投票权重基于 CHIP 余额
- [x] 法定人数（Quorum）计算正确

---

## 🐛 常见问题

### 1. 测试显示 "Vote buttons not found"
**原因**: 钱包未连接或没有 ACTIVE 提案

**解决**:
- 确保测试账户有 CHIP 余额
- 检查数据库中是否有 ACTIVE 状态的提案
- 使用 Mock 测试可以避免此问题

### 2. "Create Proposal button disabled"
**原因**: CHIP 余额低于提案门槛

**解决**:
- 检查 `DAOService.getProposalThreshold()` 返回值
- 确保测试账户余额 >= threshold
- Mock 测试中已设置 votingPower=5000, threshold=1000

### 3. CDP 连接失败
**原因**: Chrome 未以调试模式启动

**解决**:
```bash
# 先关闭所有 Chrome 实例
osascript -e 'quit app "Google Chrome"'

# 重新启动调试模式
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/"
```

### 4. Mock API 端口冲突
**原因**: 端口 7780 被占用

**解决**:
```bash
# 查找占用进程
lsof -ti:7780

# 杀掉进程
kill -9 $(lsof -ti:7780)
```

---

## 📊 测试报告示例

```
╔════════════════════════════════════════════╗
║              Test Results                  ║
╚════════════════════════════════════════════╝
  ✅ Passed:   18
  ❌ Failed:   0
  ⚠️  Warnings: 2
  📸 Screenshots: 11 saved to tests/e2e/screenshots/dao

Warnings (expected if no wallet connected):
  - Vote For button not clickable
  - Create Proposal button is disabled
```

---

## 🔗 相关文件

- **前端组件**: `src/pages/DAO.js`
- **后端路由**: `server/routes/api/dao.js`
- **服务层**: `server/services/DAOService.js`
- **数据模型**: `server/models/Proposal.js`, `server/models/Vote.js`
- **API 测试**: `tests/api/dao.api.test.js`
- **集成测试**: `tests/integration/dao.voting.test.js`
- **服务测试**: `tests/services/DAOService.test.js`

---

## 📝 测试清单

运行完整测试套件：

```bash
# 1. 单元测试
npm test tests/api/dao.api.test.js
npm test tests/services/DAOService.test.js

# 2. 集成测试
npm test tests/integration/dao.voting.test.js

# 3. E2E 测试（真实后端）
node tests/e2e/dao-cdp-e2e.js

# 4. E2E 测试（Mock API）
node tests/e2e/dao-cdp-mock-e2e.js

# 5. Playwright 测试
npx playwright test tests/e2e/dao-governance.spec.js
```

---

## ✅ 测试完成标准

- [ ] 所有 Tab 切换正常
- [ ] 提案列表正确显示
- [ ] 创建提案表单可用
- [ ] 投票功能正常
- [ ] 投票统计准确
- [ ] 状态 Badge 显示正确
- [ ] API 响应正确
- [ ] 错误处理完善
- [ ] 截图清晰完整
- [ ] 无 JavaScript 错误

---

**最后更新**: 2026-04-11
**维护者**: Claude Code
