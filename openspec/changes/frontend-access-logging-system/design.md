## Context

当前项目是一个基于 React + Express/Socket.io 的 Web3 德州扑克游戏。前端使用 React Router 6 管理页面路由（`src/components/routing/Routes.js`），后端使用 Mongoose + MongoDB 持久化数据，路由注册在 `server/routes/index.js`。

现有日志体系仅包含 `AuditLog`（审计日志，记录管理员和系统操作）和各处散落的 `console.log`，**没有任何前端用户行为追踪**能力。无法回答以下运营关键问题：
- 用户访问了哪些页面？顺序是什么？
- 每个页面停留多长时间？
- 日活跃用户数（DAU）是多少？
- 总用户数和总访问次数？

**技术约束**：
- 前端 React 16（无 hooks 外部依赖限制，但已使用 useState/useEffect）
- 后端 Express 4 + Mongoose
- 数据库：MongoDB
- 钱包地址通过 `TronContext` 获取，非登录制（用户可能不连接钱包）

## Goals / Non-Goals

**Goals:**
1. 自动采集每个页面访问的：路径、进入时间、离开时间、停留时长、钱包地址（如有）、session ID、UA
2. 支持批量上报 + 页面切换时即时上报，使用 sendBeacon 保底
3. 后端提供统计 API：总用户数、总访问次数、DAU、页面 PV/UV 排行
4. 数据准确、实时性好、前端性能影响 < 5%
5. 与现有代码零侵入集成

**Non-Goals:**
- 不做可视化 Dashboard UI（仅提供 API）
- 不做实时 WebSocket 推送统计
- 不收集点击热力图、滚动深度等细粒度行为
- 不做用户隐私脱敏/匿名化处理（本阶段面向 testnet）
- 不引入外部分析 SDK（如 Google Analytics、Mixpanel）

## Decisions

### D1: 前端采集方案 — useLocation + useEffect 监听路由变化

**选择**: 在 `App.js` 层级用 `useLocation()` hook 监听路由变化触发日志事件。

**替代方案**:
- (a) 每个 page 组件内加 `useEffect` — **拒绝**: 10+ 页面需逐一修改，高侵入
- (b) 自定义 history listener — **可行** 但 React Router v6 推荐 `useLocation`
- (c) 中间件拦截 — **不支持**: React Router v6 无传统中间件机制

**理由**: `useLocation` 是 React Router v6 的标准做法，在 `App.js` 单点注入即可全局覆盖所有路由变化，对现有组件零侵入。结合 `useRef` 记录上一页的 entryTime 可计算停留时长。

### D2: 上报策略 — 内存队列 + 批量发送 + sendBeacon 兜底

**选择**: 三层上报策略：
1. **正常流程**: 路由切换时立即将上一页日志推入内存队列，每 **10 秒** 批量 flush 到 `/api/analytics/log`
2. **页面隐藏时**: 监听 `visibilitychange`，立即 flush 队列
3. **页面关闭时**: 使用 `navigator.sendBeacon()` 发送剩余日志，确保不丢失

**替代方案**:
- (a) 每次路由变化立刻 fetch — **拒绝**: 高频导航会产生大量请求
- (b) 仅 localStorage 缓存 — **拒绝**: 无法服务端聚合统计
- (c) Socket.io 上报 — **过度**: 统计数据不需要实时双向通信

**理由**: 批量上报将网络请求数减少 90%+；sendBeacon 是浏览器原生 API，页面关闭时也能可靠发出请求；三层策略兼顾性能与可靠性。

### D3: Session 管理 — UUID v4 存储在 sessionStorage

**选择**: 首次加载时生成 UUID v4 作为 sessionId，存入 `sessionStorage`（标签页级别唯一）。

**替代方案**:
- (a) localStorage — **拒绝**: 跨标签页共享 session 不符合"一次访问"的语义
- (b) Cookie — **不必要**: 不需要跨域携带
- (c) 服务端生成 — **增加复杂度**: 前端生成足够且无额外请求

**理由**: sessionStorage 在同一标签页内持久，关闭即清除，天然匹配一次"访问会话"的定义。UUID v4 碰撞概率可忽略。

### D4: 后端存储 — 独立 AccessLog Model + MongoDB 聚合管道

**选择**: 新建 `AccessLog` Mongoose model，复用现有 MongoDB 连接。统计查询使用 MongoDB Aggregation Pipeline。

Schema 设计:
```
{
  sessionId:       String,   indexed
  walletAddress:   String,   indexed (nullable, 未连接钱包为 null)
  path:            String,   indexed
  entryTime:       Date,     indexed
  exitTime:        Date,
  duration:        Number,   // seconds
  referrer:        String,
  userAgent:       String,
  screenWidth:     Number,
  screenHeight:    Number
}
```

复合索引: `{ walletAddress: 1, entryTime: -1 }`, `{ path: 1, entryTime: -1 }`

**DAU 计算**: 按 `walletAddress`（去重）或 `sessionId`（未连接钱包时 fallback）+ 日期分组聚合。

**替代方案**:
- (a) Redis 时序数据库 — **过度**: 当前规模 MongoDB 足够
- (b) 写入 AuditLog — **混用**: AuditLog 语义是系统操作审计，不是用户行为追踪
- (c) PostgreSQL — **不适用**: 项目统一使用 MongoDB

### D5: 性能保护措施

| 措施 | 说明 |
|---|---|
| 防抖上报 | 10 秒批量窗口，避免频繁请求 |
| 内存队列上限 | 队列 > 100 条时强制 flush |
| 采样率配置 | 支持 `ACCESS_LOG_SAMPLE_RATE`（默认 1.0 = 全量） |
| 统计结果缓存 | DAU/总览接口 5 分钟内存缓存 |
| 日志 TTL | AccessLog 文档保留 90 天，后台定时清理 |
| 异步写入 | 上报接口 fire-and-forget，不 await |

## Risks / Trade-offs

| 风险 | 影响 | 缓解 |
|---|---|---|
| **[R1] SPA 路由切换无法捕获浏览器后退/前进按钮的精确时间** | duration 可能略有偏差 | useLocation 能捕获所有路由变化（包括 popstate）；duration 用于趋势分析而非精确计时，可接受 |
| **[R2] 未连接钱包的用户只能以 sessionId 标识** | DAU 可能偏高（同一人多个标签页算多用户 | DAU 报告同时提供 "connected DAU"（钱包维度）和 "visit DAU"（session 维度）；后续可引入 fingerprint 去重 |
| **[R3] 高并发下 MongoDB 写入压力** | 大量用户同时上报可能造成 DB 延迟 | 批量写入（bulkWrite）减少连接开销；accesslogs collection 可考虑 capped collection 或分表 |
| **[R4] sendBeacon payload 限制 (~64KB)** | 极端情况下队列数据超限 | 队列满 100 条时自动 flush，单条日志 ~200B，100 条约 20KB，远低于限制 |
| **[R5] 前端 bundle 体积增大** | accessLogger.js 增加初始加载体积 | 代码精简（目标 < 3KB gzip），无外部依赖；可进一步用 lazy import |

## Migration Plan

1. **Phase 1 — 后端基础**: 创建 `AccessLog` Model + `AccessLogService` + `/api/analytics` 路由 + 注册到 `routes/index.js`
2. **Phase 2 — 前端采集**: 创建 `accessLogger.js` + `useAccessLog.js` Hook，在 `App.js` 注入
3. **Phase 3 — 测试验证**: E2E 测试验证日志上报正确性，检查 bundle size 和网络请求数
4. **回滚策略**: 删除 `routes/index.js` 中 analytics 路由注册即可完全禁用；前端注释掉 App.js 中一行即可移除

## Open Questions

- Q1: 是否需要记录 `referer`（来源页面）用于漏斗分析？**决定**: 记录，成本低价值高。
- Q2: Admin 面板是否需要展示统计数据？**决定**: 本阶段仅提供 API，Admin Dashboard 集成作为后续迭代（不在本次 scope）。
- Q3: 是否需要 IP 地址？**决定**: 不记录 IP（隐私考量 + 对运营分析帮助有限），如需地理分布可通过 UA 语言推断。
