## ADDED Requirements

### Requirement: 路由变化自动捕获

系统 MUST 在前端应用入口（App.js）层级通过 `useLocation()` hook 监听 React Router v6 路由变化，自动记录每次页面切换事件。该采集器 SHALL 对所有现有页面路由生效，包括 `/`, `/play`, `/tournament`, `/nft`, `/wallet`, `/dao`, `/dex` 及其子路径。

#### Scenario: 用户从首页导航到游戏页
- **WHEN** 用户当前位于 `/` 页面，然后导航到 `/play`
- **THEN** 系统记录首页的一条 pageview 日志（包含 entryTime, path="/", duration），并开始记录 /play 的 entryTime

#### Scenario: 用户在子路由间切换
- **WHEN** 用户从 `/tournament` 导航到 `/tournament/:id`
- **THEN** 系统分别记录两条独立的 pageview 日志，path 分别为 `/tournament` 和 `/tournament/:id`

---

### Requirement: 页面停留时长计算

系统 MUST 在用户离开当前页面时计算并记录该页面的停留时长（duration，单位：秒）。duration = 当前时间戳 - 该页面的 entryTime。精度保留到小数点后 1 位。

#### Scenario: 正常页面切换
- **WHEN** 用户在页面 A 停留 30.5 秒后切换到页面 B
- **THEN** 页面 A 的日志中 duration 字段值为 30.5

#### Scenario: 首次加载
- **WHEN** 用户首次进入应用的首页
- **THEN** 记录 entryTime 但不计算 duration（因为尚无离开事件）

#### Scenario: 页面关闭或标签隐藏
- **WHEN** 用户关闭浏览器标签页或将标签页切到后台（visibilitychange → hidden）
- **THEN** 系统立即计算当前页面 duration 并加入待上报队列

---

### Requirement: 钱包地址关联

系统 MUST 从 TronContext 获取当前连接的钱包地址（walletAddress），并将其关联到每条 pageview 日志。若用户未连接钱包，walletAddress 字段值 SHALL 为 `null`。

#### Scenario: 已连接钱包的用户访问
- **WHEN** 已连接钱包（address=TU8rhtp...）的用户访问 `/play`
- **THEN** 日志的 walletAddress 字段值为 "TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv"（小写）

#### Scenario: 未连接钱包的用户访问
- **WHEN** 未连接钱包的用户访问任意页面
- **THEN** 日志的 walletAddress 字段值为 null

#### Scenario: 访问过程中连接/断开钱包
- **WHEN** 用户在浏览过程中新连接了钱包
- **THEN** 后续 pageview 日志使用新的 walletAddress；之前的日志保持 null

---

### Requirement: Session 标识管理

系统 MUST 为每个浏览器标签页生成唯一的 sessionId（UUID v4 格式），存储在 sessionStorage 中。同一标签页内的所有 pageview 日志共享同一个 sessionId。

#### Scenario: 首次打开应用
- **WHEN** 用户首次在新标签页打开应用
- **THEN** 系统生成新的 UUID v4 作为 sessionId，存入 sessionStorage

#### Scenario: 同一标签页刷新
- **WHEN** 用户在同一标签页按 F5 刷新页面
- **THEN** sessionId 保持不变（sessionStorage 不被清除）

#### Scenario: 新标签页打开
- **WHEN** 用户在新标签页再次打开应用
- **THEN** 生成全新的 sessionId（与原标签页不同）

---

### Requirement: 批量上报策略

前端采集器 MUST 实现内存队列 + 批量上报机制：
1. 每次 route change 将上一页日志推入内存队列
2. 每 10 秒自动 flush 队列，批量 POST 到 `/api/analytics/log`
3. 当队列累积 >= 100 条时立即强制 flush
4. 上报成功后清空已发送的日志

#### Scenario: 正常批量上报
- **WHEN** 用户在 10 秒内访问了 3 个页面
- **THEN** 第 10 秒时一次性将 3 条日志 POST 到后端

#### Scenario: 高频访问强制 flush
- **WHEN** 队列累积到 100 条日志
- **THEN** 立即触发 flush，不等 10 秒定时器

#### Scenario: 上报失败重试
- **WHEN** 批量 POST 请求失败（网络异常）
- **THEN** 日志保留在队列中，下次 flush 时一并重试（最多保留 3 次）

---

### Requirement: 页面关闭保底上报

当用户关闭标签页或离开页面时，系统 MUST 使用 `navigator.sendBeacon()` API 将队列中剩余的所有日志发送到 `/api/analytics/log`，确保数据不丢失。

#### Scenario: 正常关闭标签页
- **WHEN** 用户关闭包含 2 条未上报日志的标签页
- **THEN** beforeunload/unload 事件触发 sendBeacon 发送 2 条日志到后端

#### Scenario: sendBeacon 不可用降级
- **WHEN** 浏览器不支持 sendBeacon（极老版本）
- **THEN** 降级为同步 XMLHttpRequest 发送（fallback）

---

### Requirement: 环境信息收集

每条 pageview 日志 MUST 包含以下环境元数据：
- `referrer`: 上一页面路径（document.referrer 解析后的内部 path）
- `userAgent`: navigator.userAgent 字符串
- `screenWidth`: window.screen.width
- `screenHeight`: window.screen.height

#### Scenario: 完整环境信息
- **WHEN** 用户从 `/` 进入 `/play`，屏幕 1920x1080，Chrome 浏览器
- **THEN** 日志包含 referrer="/", userAgent="Mozilla/...", screenWidth=1920, screenHeight=1080
