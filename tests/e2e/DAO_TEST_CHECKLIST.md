# DAO Governance 测试验证清单

## 快速开始

```bash
# 方式 1: 快速 Mock 测试（推荐，无需后端）
./run-dao-test.sh mock

# 方式 2: 完整测试（需要后端）
./run-dao-test.sh full
```

---

## DAO 四个 Tab 功能说明

| Tab | 功能 | API 筛选 | 特点 |
|-----|------|---------|------|
| **Active** | 投票进行中的提案 | `state=ACTIVE` | 显示投票按钮，可以投票 |
| **Passed** | 已通过的提案 | `state=PASSED` | 投票已结束，显示最终结果 |
| **All** | 所有状态的提案 | 无筛选 | 显示完整历史，包含所有状态 |
| **Create** | 创建新提案 | - | 需要钱包连接 + CHIP >= 门槛 |

### Active Tab 详细说明
- **显示内容**: 正在投票的提案（投票期限未到）
- **用户操作**:
  - 点击 "Vote For" 支持提案
  - 点击 "Vote Against" 反对提案
  - 每个提案只能投票一次
- **显示信息**:
  - 提案标题和描述
  - 赞成票数 / 反对票数
  - 是否达到法定人数（Quorum）
  - 投票进度条
  - 投票截止时间

### Passed Tab 详细说明
- **显示内容**: 投票已结束且通过的提案
- **通过条件**:
  - 赞成票 > 反对票
  - 达到法定人数（Quorum）
- **用户操作**: 无（投票已结束）
- **可能操作**: Execute（执行提案，如果可执行）

### All Tab 详细说明
- **显示内容**: 所有提案，不限状态
- **状态类型**:
  - 🟢 ACTIVE - 投票中
  - 🔵 PASSED - 已通过
  - 🟣 EXECUTED - 已执行
  - 🔴 REJECTED - 已拒绝
- **用途**: 查看提案历史记录

### Create Tab 详细说明
- **显示内容**: 创建提案的表单
- **必填字段**:
  - Title - 提案标题
  - Description - 提案描述
- **提交条件**:
  - 钱包已连接
  - CHIP 余额 >= 提案门槛（Proposal Threshold）
- **提交后**: 自动切换到 Active Tab，新提案出现在列表顶部

---

## 测试验证清单

### ✅ UI 层面（11 项）

- [ ] 页面标题显示 "DAO Governance"
- [ ] 四个 Tab 按钮可见（Active/Passed/All/Create）
- [ ] Tab 按钮可点击
- [ ] 点击 Tab 后内容正确切换
- [ ] 提案卡片显示标题、描述、状态
- [ ] 投票进度条正确显示
- [ ] 状态 Badge 颜色正确（绿/蓝/紫/红）
- [ ] 创建表单包含标题和描述输入框
- [ ] ACTIVE 提案显示投票按钮
- [ ] 投票统计显示（For/Against/Quorum）
- [ ] 用户投票权重和提案门槛显示

### ✅ 功能层面（10 项）

- [ ] Active Tab 只显示 ACTIVE 状态提案
- [ ] Passed Tab 只显示 PASSED 状态提案
- [ ] All Tab 显示所有状态提案
- [ ] 创建提案需要钱包连接
- [ ] 创建提案需要足够 CHIP 余额
- [ ] 投票需要钱包连接
- [ ] 投票需要持有 CHIP
- [ ] 每个用户对每个提案只能投票一次
- [ ] 投票后统计数据实时更新
- [ ] 表单验证（必填字段）

### ✅ API 层面（11 项）

- [ ] GET /api/dao/proposals - 获取提案列表
- [ ] GET /api/dao/proposals?state=ACTIVE - 筛选 ACTIVE
- [ ] GET /api/dao/proposals?state=PASSED - 筛选 PASSED
- [ ] GET /api/dao/proposals/:id - 获取提案详情
- [ ] POST /api/dao/proposals/create - 创建提案
- [ ] POST /api/dao/proposals/:id/vote - 投票
- [ ] GET /api/dao/voting-power/:address - 获取投票权重
- [ ] GET /api/dao/threshold - 获取提案门槛
- [ ] GET /api/dao/quorum - 获取法定人数
- [ ] 认证中间件正常工作
- [ ] 错误处理（重复投票、余额不足等）

---

## 测试文件说明

| 文件 | 类型 | 用途 |
|------|------|------|
| `dao-cdp-e2e.js` | E2E | 真实后端测试 |
| `dao-cdp-mock-e2e.js` | E2E | Mock API 测试 |
| `dao-governance.spec.js` | Playwright | 基础页面测试 |
| `dao.api.test.js` | Unit | API 单元测试 |
| `run-dao-test.sh` | Script | 快速启动脚本 |

---

## 测试输出

### 截图位置
```
tests/e2e/screenshots/dao/
├── dao-01-initial-load.png
├── dao-02-tab-active.png
├── dao-03-tab-passed.png
├── dao-04-tab-all.png
├── dao-05-tab-create.png
├── dao-06-create-filled.png
├── dao-07-create-submitted.png
├── dao-08-proposals-list.png
├── dao-09-vote-for.png
├── dao-10-vote-stats.png
└── dao-11-final-state.png
```

### 日志位置
```
/tmp/dao-frontend.log  - 前端日志
/tmp/dao-backend.log   - 后端日志（full 模式）
```

---

## 常见问题

### Q1: "Vote buttons not found"
**原因**: 钱包未连接或没有 ACTIVE 提案
**解决**: 使用 Mock 测试或确保数据库有 ACTIVE 提案

### Q2: "Create Proposal button disabled"
**原因**: CHIP 余额低于提案门槛
**解决**: Mock 测试中已设置 votingPower=5000, threshold=1000

### Q3: CDP 连接失败
**原因**: Chrome 未以调试模式启动
**解决**:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chrome-debug" \
  "http://127.0.0.1:3001/dao" &
```

### Q4: 端口被占用
**解决**:
```bash
# 清理端口
kill -9 $(lsof -ti:3001)
kill -9 $(lsof -ti:7778)
kill -9 $(lsof -ti:7780)
```

---

## 测试成功标准

✅ 所有 Tab 切换正常
✅ 提案列表正确显示
✅ 创建提案表单可用
✅ 投票功能正常
✅ 投票统计准确
✅ 状态 Badge 显示正确
✅ API 响应正确
✅ 错误处理完善
✅ 截图清晰完整
✅ 无 JavaScript 错误

---

## 快速参考

### 启动测试
```bash
./run-dao-test.sh mock    # Mock 模式（推荐）
./run-dao-test.sh full    # 完整模式
```

### 查看截图
```bash
open tests/e2e/screenshots/dao/
```

### 查看日志
```bash
tail -f /tmp/dao-frontend.log
tail -f /tmp/dao-backend.log
```

### 清理环境
```bash
kill -9 $(lsof -ti:3001)
kill -9 $(lsof -ti:7778)
```

---

**版本**: 1.0.0
**日期**: 2026-04-11
**状态**: ✅ 可用
