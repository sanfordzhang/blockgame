# TronLink 签名自动化操作指南

## 概述

通过 `cliclick` 模拟鼠标点击，自动完成 TronLink 钱包的签名确认操作，无需手动干预。

## 屏幕环境

- 屏幕分辨率: 3024x1964 Retina (逻辑分辨率 1512x982, 2x缩放)
- cliclick 使用屏幕逻辑坐标（与 pynput 监听到的坐标一致）

## 关键坐标

### TronLink 钱包操作

| 操作 | 逻辑坐标 | 说明 |
|------|---------|------|
| TronLink 图标 | (1364, 100) | Chrome 扩展栏中的 TronLink 图标 |
| 收藏品 Tab | (1099, 402) | 钱包弹窗中的收藏品标签页 |

### 签名弹窗操作

| 按钮 | 逻辑坐标 | 说明 |
|------|---------|------|
| **签名 (Sign)** | **(1414, 635)** | 绿色确认按钮，点击完成签名 |
| 拒绝 (Reject) | (~1300, 635) | 白色拒绝按钮，取消签名 |

> 已验证: 2026-04-06，通过 pynput 监听用户实际点击录制。

## 自动签名脚本

### 完整 Deposit + 签名流程（已验证稳定）

```bash
# 1. 点击 Deposit 按钮 (normX=0.475, normY=0.803 -> 逻辑坐标 718,788)
cliclick m:718,788 && sleep 0.5 && cliclick c:718,788

# 2. 等待 TronLink 签名弹窗出现（约4-5秒）
sleep 5

# 3. 点击签名按钮 (1406,638) — 两次点击：第一次聚焦，第二次确认
cliclick m:1406,638 && sleep 2 && cliclick c:1406,638 && sleep 2 && cliclick c:1406,638
```

> 注意：签名需要两次点击 — 第一次聚焦钱包窗口，第二次触发签名。直接单次点击可能无效。

### 等待并签名

```bash
# 等待签名弹窗出现后自动签名（配合截图检测）
sign_tronlink() {
  echo "⏳ 等待 TronLink 签名弹窗..."
  sleep 3
  cliclick c:1395,631
  echo "✅ 已点击签名按钮"
}
sign_tronlink
```

### 完整充值 + 自动签名流程

```bash
# 1. 触发充值操作（通过 CDP 或页面按钮）
# 2. 等待 TronLink 签名弹窗出现
sleep 3
# 3. 自动签名
cliclick c:1395,631
echo "✅ 签名完成"
# 4. 等待交易确认
sleep 5
# 5. 截图确认结果
screencapture -x /tmp/tronlink-sign-result.png
```

### 多次签名（连续交易）

```bash
# 某些操作可能触发多次签名请求
auto_sign_multiple() {
  local count=${1:-1}
  for i in $(seq 1 $count); do
    echo "📝 等待第 $i 次签名..."
    sleep 3
    cliclick c:1395,631
    echo "✅ 第 $i 次签名完成"
    sleep 2
  done
}

# 使用: auto_sign_multiple 3  # 连续签名3次
```

## 完整自动化流程示例

```bash
#!/bin/bash
# === TronLink 全自动操作 ===

# 1. 打开 TronLink 钱包
cliclick c:1364,100
sleep 2

# 2. 查看收藏品（检查 NFT）
cliclick c:1099,402
sleep 3
screencapture -x /tmp/nft-before.png
echo "📸 操作前 NFT 截图已保存"

# 3. 关闭钱包弹窗（点击页面其他区域）
cliclick c:400,400
sleep 1

# 4. 执行游戏操作（触发交易）...
# node cdp-play-game.js

# 5. 等待签名弹窗并自动签名
sleep 3
cliclick c:1395,631
echo "✅ 签名完成"

# 6. 等待交易上链
sleep 10

# 7. 再次检查 NFT 数量
cliclick c:1364,100
sleep 2
cliclick c:1099,402
sleep 3
screencapture -x /tmp/nft-after.png
echo "📸 操作后 NFT 截图已保存"
echo "🔍 对比 /tmp/nft-before.png 和 /tmp/nft-after.png 查看变化"
```

## 注意事项

1. **坐标依赖窗口位置**: 如果 Chrome 窗口移动或缩放，坐标需要重新校准
2. **弹窗加载时间**: `sleep` 时间可能需要根据网络状况调整
3. **多次签名**: 某些合约操作（如 approve + transfer）会触发多次签名
4. **签名超时**: TronLink 签名弹窗有超时机制，需要在弹窗出现后及时点击
5. **坐标校准方法**: 运行 `python3 listen-sign-click.py` 监听实际点击位置，或用 `cliclick p` 获取当前鼠标位置
