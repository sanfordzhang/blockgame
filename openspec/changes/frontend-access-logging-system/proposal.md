## Why

当前前端应用缺乏用户行为数据收集能力，无法了解用户访问轨迹、页面停留时长和日活跃用户数（DAU）等关键运营指标。需要构建一套全面的日志访问系统，为产品优化和数据驱动决策提供基础支撑。

## What Changes

- **前端日志采集模块**: 新增 `src/utils/accessLogger.js`，基于页面路由变化自动采集用户访问数据
- **后端日志存储服务**: 新增 MongoDB 模型 `AccessLog` 和对应的 REST API 端点，接收并持久化前端上报的访问日志
- **统计聚合 API**: 新增 `/api/analytics` 路由组，提供用户总数、总访问次数、DAU、页面停留时长等统计数据查询接口
- **前端集成**: 通过 React Context/Hook 方式在应用入口注入日志采集逻辑，对现有业务代码零侵入
- **性能保障**: 采用批量上报 + 本地缓存策略，避免频繁网络请求影响前端性能；使用内存缓存加速统计查询

## Capabilities

### New Capabilities
- `access-log-collection`: 前端用户访问日志采集与上报，包含钱包地址绑定、路由追踪、页面停留时长计算
- `access-log-analytics`: 后端日志存储、聚合统计与 DAU 计算，提供分析 API 接口

### Modified Capabilities
（无——不修改已有 spec 的 REQUIREMENTS）

## Impact

**前端代码影响**:
- `src/App.js`: 注入 AccessLogProvider 或 useEffect 初始化日志采集器
- `src/context/`: 可能新增 `AccessLogContext` 用于全局状态管理
- 新增文件: `src/utils/accessLogger.js`, `src/hooks/useAccessLog.js`
- 不修改现有页面组件的业务逻辑

**后端代码影响**:
- `server/models/AccessLog.js`: 新增 Mongoose Schema（walletAddress, path, entryTime, exitTime, duration, userAgent, sessionId）
- `server/routes/api/analytics.js`: 新增统计 API（GET /api/analytics/stats, GET /api/analytics/dau, POST /api/analytics/log）
- `server/services/AccessLogService.js`: 日志写入、聚合计算服务层
- `server/server.js`: 注册新路由

**数据库影响**:
- MongoDB 新增 `accesslogs` collection
- 建议对 `walletAddress + entryTime` 创建复合索引以提升查询性能

**性能考虑**:
- 前端采用防抖/节流 + 批量上报（每 10 秒或页面切换时批量发送），单次请求 < 2KB
- 使用 `navigator.sendBeacon()` 在页面关闭时确保数据不丢失
- 后端统计接口支持时间范围参数，默认返回最近 30 天数据
- 统计结果可做短时缓存（TTL 5 分钟）减少 DB 压力
