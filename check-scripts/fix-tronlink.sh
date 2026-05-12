#!/bin/bash
# 修复TronLink NFT显示问题

echo "🔧 修复TronLink NFT显示"
echo "========================"
echo ""

# 1. 检查服务端口
echo "1️⃣ 检查服务..."
SERVER_PORT=$(lsof -nP -iTCP -sTCP:LISTEN | grep "node.*server" | awk '{print $9}' | cut -d: -f2)
echo "   服务运行在端口: $SERVER_PORT"

# 2. 启动cloudflared
echo ""
echo "2️⃣ 启动cloudflared隧道..."
pkill cloudflared 2>/dev/null
cloudflared tunnel --url http://localhost:$SERVER_PORT &
TUNNEL_PID=$!
echo "   等待隧道启动..."
sleep 5

# 3. 获取隧道URL
echo ""
echo "3️⃣ 获取隧道URL..."
echo "   请查看上方输出中的 https://xxx.trycloudflare.com"
echo ""
echo "4️⃣ 下一步操作:"
echo "   复制隧道URL后运行:"
echo "   node set-nft-baseuri-public.js <URL>/api/nft/metadata/"
