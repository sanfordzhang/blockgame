## 1. 后端 — 数据模型层

- [x] 1.1 创建 `server/models/AccessLog.js`，定义 Mongoose Schema（sessionId, walletAddress, path, entryTime, exitTime, duration, referrer, userAgent, screenWidth, screenHeight），添加复合索引 `{ walletAddress: 1, entryTime: -1 }` 和 `{ path: 1, entryTime: -1 }`
- [x] 1.2 在 AccessLog model 上定义静态方法 `cleanup()`，删除 90 天前的旧文档

## 2. 后端 — 服务层

- [x] 2.1 创建 `server/services/AccessLogService.js`，实现 `saveLogs(logsArray)` 方法：校验必填字段（sessionId/path/entryTime），使用 `bulkWrite` 批量写入 MongoDB，返回成功数量
- [x] 2.2 实现 `getStats(fromDate, toDate)` 方法：聚合计算 totalUsers（去重 walletAddress）、totalVisits（去重 sessionId）、totalPageviews、avgSessionDuration、topPages（PV/UV 排行前 10），支持内存缓存 TTL=5 分钟
- [x] 2.3 实现 `getDAU(daysOrFromDate)` 方法：按日分组聚合 connectedUsers（钱包去重）和 visits（session 去重），返回每日数据 + 摘要统计（avg DAU、peak date）
- [x] 2.4 实现 `getUserTrail(walletAddress, limit)` 方法：按 entryTime 降序返回单个用户的最近访问轨迹

## 3. 后端 — API 路由层

- [x] 3.1 创建 `server/routes/api/analytics.js`，实现 `POST /log` 端点：接收单条或批量 logs 数组（兼容两种格式），调用 AccessLogService.saveLogs()，返回 `{ success, received }`；空数组返回 400
- [x] 3.2 实现 `GET /stats` 端点：接收可选 from/to query 参数（默认最近 30 天），调用 getStats() 返回统计数据
- [x] 3.3 实现 `GET /dau` 端点：接收可选 days(默认7, 最大90)和 from 参数，调用 getDAU() 返回 DAU 数据
- [x] 3.4 实现 `GET /user/:walletAddress/trail` 端点：接收可选 limit 参数（默认20, 最大100），调用 getUserTrail() 返回用户轨迹
- [x] 3.5 在 `server/routes/index.js` 中注册 `app.use('/api/analytics', require('./api/analytics'))`

## 4. 前端 — 日志采集核心

- [x] 4.1 创建 `src/utils/accessLogger.js`，实现 AccessLogger 类：
    - `init()` 方法：生成/恢复 sessionId（UUID v4 → sessionStorage）
    - `recordPageView(path, walletAddress)` 方法：记录 entryTime 到当前页面 state
    - `flush()` 方法：批量 POST 队列到 `/api/analytics/log`
    - `forceFlushOnHide()` 方法：监听 visibilitychange → hidden 时立即 flush
    - `sendBeaconOnUnload()` 方法：beforeunload/unload 时用 sendBeacon 发送剩余日志
    - 内部维护队列数组，上限 100 条自动强制 flush，10 秒定时 flush

## 5. 前端 — React 集成

- [x] 5.1 创建 `src/hooks/useAccessLog.js` 自定义 Hook：内部使用 useLocation() 监听路由变化，从 TronContext 获取当前 walletAddress，路由切换时调用 accessLogger.recordPageView() 计算上一页 duration 并入队
- [x] 5.2 修改 `src/App.js`，引入 useAccessLog Hook 或在组件内调用 accessLogger.init() + 使用 Hook 注入采集逻辑，确保全局生效且对现有组件零侵入
- [x] 5.3 确保 walletAddress 变化时后续日志能正确关联新地址

## 6. 测试与验证

- [x] 6.1 编写后端单元测试：验证 POST /log 单条写入、批量写入、字段缺失拒绝、空数组拒绝
- [x] 6.2 编写后端单元测试：验证 GET /stats 统计数据准确性（mock 数据验证 totalUsers/totalVisits/topPages 计算）
- [x] 6.3 编写后端单元测试：验证 GET /dau 按 day 分组聚合正确性
- [x] 6.4 手动/E2E 测试：启动前后端，在浏览器中访问多个页面，检查 MongoDB 中是否正确记录了 pageview 数据（含 walletAddress、duration、path 等）
- [x] 6.5 验证性能：确认批量上报正常工作（10 秒窗口）、关闭标签页时 sendBeacon 触发、前端无 console 报错、bundle size 影响可接受
