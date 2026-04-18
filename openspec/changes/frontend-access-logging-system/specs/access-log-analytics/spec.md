## ADDED Requirements

### Requirement: AccessLog 数据模型

后端 MUST 定义 `AccessLog` Mongoose Schema，字段定义如下：

| 字段 | 类型 | 必填 | 索引 | 说明 |
|---|---|---|---|---|
| sessionId | String | 是 | ✅ | UUID v4 |
| walletAddress | String | 否 | ✅ | TRON 钱包地址（小写），未连接为 null |
| path | String | 是 | ✅ | 访问的页面路径 |
| entryTime | Date | 是 | ✅ | 页面进入时间 |
| exitTime | Date | 否 | - | 页面离开时间 |
| duration | Number | 否 | - | 停留时长（秒） |
| referrer | String | 否 | - | 来源页面路径 |
| userAgent | String | 否 | - | 浏览器 UA |
| screenWidth | Number | 否 | - | 屏幕宽度 |
| screenHeight | Number | 否 | - | 屏幕高度 |

复合索引：`{ walletAddress: 1, entryTime: -1 }`, `{ path: 1, entryTime: -1 }`

#### Scenario: 接收单条日志写入
- **WHEN** 后端收到 POST /api/analytics/log，body 含有效 sessionId/path/entryTime
- **THEN** 创建一条 AccessLog 文档并保存至 MongoDB

#### Scenario: 接收批量日志写入
- **WHEN** 后端收到 POST /api/analytics/log，body.logs 为包含 5 条有效日志的数组
- **THEN** 使用 bulkWrite 批量插入 5 条文档

#### Scenario: 缺少必填字段拒绝
- **WHEN** 后端收到的日志缺少 sessionId 或 path 或 entryTime
- **THEN** 返回 400 错误，不写入数据库

---

### Requirement: 日志接收 API

后端 MUST 提供 `POST /api/analytics/log` 端点接收前端上报的日志：

**Request Body** (支持单条或批量):
```json
{
  "logs": [
    {
      "sessionId": "uuid-v4",
      "walletAddress": "TUxxx...或null",
      "path": "/play",
      "entryTime": "2026-04-18T10:00:00Z",
      "exitTime": "2026-04-18T10:00:30Z",
      "duration": 30.5,
      "referrer": "/",
      "userAgent": "...",
      "screenWidth": 1920,
      "screenHeight": 1080
    }
  ]
}
```

**Response**: `{ "success": true, "received": N }`

该接口 MUST 支持 CORS（同域无需额外配置）、无认证要求（公开端点）、fire-and-forget 异步处理模式。

#### Scenario: 成功接收批量日志
- **WHEN** POST /api/analytics/log body 含 3 条有效日志
- **THEN** 返回 200 { success: true, received: 3 }

#### Scenario: 空数组请求
- **WHEN** POST /api/analytics/log body.logs 为空数组
- **THEN** 返回 400 { success: false, error: "logs array is empty" }

#### Scenario: 单条日志格式兼容
- **WHEN** POST /api/analytics/log body 直接是单条日志对象（非数组包裹）
- **THEN** 兼容处理，将其包装为数组后写入

---

### Requirement: 统计概览 API

后端 MUST 提供 `GET /api/an/stats?from=YYYY-MM-DD&to=YYYY-MM-DD` 端点返回统计概览：

```json
{
  "period": { "from": "2026-04-01", "to": "2026-04-18" },
  "totalUsers": 150,
  "totalVisits": 1200,
  "totalPageviews": 4500,
  "avgSessionDuration": 185.3,
  "topPages": [
    { "path": "/", "pv": 500, "uv": 120 },
    { "path": "/play", "pv": 300, "uv": 80 }
  ]
}
```

- **totalUsers**: 时间范围内去重的 walletAddress 数量（仅计已连接钱包）
- **totalVisits**: 时间范围内的 sessionId 去重数量
- **totalPageviews**: 总日志条数
- **avgSessionDuration**: 平均每个 session 的总停留秒数
- **topPages**: 按 PV 降序排列的前 10 个页面

查询结果 SHOULD 在服务端缓存 5 分钟（TTL）。默认时间范围为最近 30 天。

#### Scenario: 查询默认范围统计
- **WHEN** GET /api/analytics/stats 无参数
- **THEN** 返回最近 30 天的统计数据

#### Scenario: 查询指定范围统计
- **WHEN** GET /api/analytics/stats?from=2026-04-01&to=2026-04-18
- **THEN** 返回指定日期范围内的统计数据

#### Scenario: 无数据时返回零值
- **WHEN** 指定时间范围内无任何日志
- **THEN** 返回 totalUsers=0, totalVisits=0, totalPageviews=0, topPages=[]

---

### Requirement: DAU 统计 API

后端 MUST 提供 `GET /api/analytics/dau?days=N&from=YYYY-MM-DD` 端点返回日活跃用户数：

```json
{
  "period": { "from": "2026-04-12", "to": "2026-04-18" },
  "dau": [
    { "date": "2026-04-12", "connectedUsers": 45, "visits": 60 },
    { "date": "2026-04-13", "connectedUsers": 52, "visits": 70 }
  ],
  "summary": {
    "avgConnectedDAU": 48.5,
    "avgVisitDAU": 65.0,
    "peakDate": "2026-04-15",
    "peakUsers": 68
  }
}
```

- **connectedUsers**: 当日去重 walletAddress 数量（有钱包用户 DAU）
- **visits**: 当日去重 sessionId 数量（总访问 DAU）
- 默认返回最近 7 天数据，days 参数最大值 90

#### Scenario: 默认 7 天 DAU
- **WHEN** GET /api/analytics/dau 无参数
- **THEN** 返回最近 7 天每天的 connectedUsers 和 visits

#### Scenario: 自定义天数 DAU
- **WHEN** GET /api/analytics/dau?days=30
- **THEN** 返回最近 30 天的 DAU 数据

#### Scenario: 指定起始日期 DAU
- **WHEN** GET /api/analytics/dau?from=2026-04-01
- **THEN** 返回从 2026-04-01 至今天的数据（优先级高于 days）

---

### Requirement: 用户轨迹查询 API（可选增强）

后端 SHOULD 提供 `GET /api/analytics/user/:walletAddress/trail?limit=N` 端点查询单个用户的最近访问轨迹：

```json
{
  "walletAddress": "TU8rhtp...",
  "trails": [
    {
      "sessionId": "uuid",
      "path": "/play",
      "entryTime": "2026-04-18T10:00:00Z",
      "duration": 180.5
    }
  ],
  "totalPageviews": 42,
  "lastActiveAt": "2026-04-18T12:00:00Z"
}
```

默认 limit=20，最大 limit=100。按 entryTime 降序排列。

#### Scenario: 查询已知用户的轨迹
- **WHEN** GET /api/analytics/user/TU8rhtp.../trail
- **THEN** 返回该钱包地址最近的 20 条 pageview 记录

#### Scenario: 查询不存在的用户
- **WHEN** 查询的钱包地址没有任何日志记录
- **THEN** 返回 trails=[], totalPageviews=0

---

### Requirement: 数据清理与 TTL

AccessLog 文档 MUST 设置 90 天保留期。后端 SHOULD 提供定时任务或静态方法清理超过 90 天的旧数据，防止 MongoDB 无限增长。

#### Scenario: 清理过期数据
- **WHEN** 调用 AccessLogService.cleanup() 方法
- **THEN** 删除所有 entryTime 早于 90 天前的文档

#### Scenario: 定期执行清理
- **WHEN** 服务器启动或每天凌晨 3 点
- **THEN** 自动执行一次 cleanup（可选：通过 node-cron 或 setInterval）
