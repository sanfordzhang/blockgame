# 通过 TronLink 钱包检查 NFT 数量变化

## 方法概述

通过 cliclick 模拟鼠标点击打开 TronLink 钱包收藏品页面，截图后读取 PANFT 数量，判断 NFT 是否有变化。

## 前置条件

- Chrome 调试浏览器已启动（`--remote-debugging-port=9222`）
- TronLink 插件已安装并登录
- `cliclick` 已安装（`brew install cliclick`）

## 关键坐标

| 元素 | 坐标 |
|------|------|
| TronLink 图标 | (1364, 100) |
| 收藏品 Tab | (1099, 402) |

> 注意：坐标基于当前屏幕分辨率和浏览器窗口位置，如果窗口位置变化需要重新确认。

## 操作步骤

```bash
# 1. 点击 TronLink 图标打开钱包
cliclick c:1364,100

# 2. 等待钱包弹窗加载
sleep 2

# 3. 点击收藏品 Tab
cliclick c:1099,402

# 4. 等待收藏品页面加载
sleep 3

# 5. 截图
screencapture -x /tmp/tronlink-collectibles.png
```

## 读取结果

截图后通过 Claude 读取图片，识别 PANFT 文字右侧的数字。

### 当前基准数据（2026-04-06）

| NFT 名称 | 数量 |
|---------|------|
| TNFT (TESTNFT) | 0 |
| ttt (Wat_bct21) | 0 |
| PANFT (Poker Achieve...) | 40 |
| PANFT | 3 |

**PANFT 总计: 43 个**

## 一键检查脚本

```bash
# 完整流程：点击 → 截图 → 输出
cliclick c:1364,100 && sleep 2 && cliclick c:1099,402 && sleep 3 && screencapture -x /tmp/tronlink-collectibles.png && echo "截图已保存: /tmp/tronlink-collectibles.png"
```

截图保存后，让 Claude 读取 `/tmp/tronlink-collectibles.png` 提取 PANFT 数量，与基准数据对比即可判断 NFT 是否有变化。
