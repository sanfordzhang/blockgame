#!/bin/bash
echo "🔧 TronLink NFT修复 - 一键执行"
echo "================================"

# 停止旧隧道
echo "1. 停止旧cloudflared..."
pkill cloudflared
sleep 2

# 启动新隧道
echo "2. 启动新隧道（指向7777端口）..."
echo ""
echo "⚠️  请在新终端运行以下命令："
echo ""
echo "   cloudflared tunnel --url http://localhost:7777"
echo ""
echo "3. 复制输出中的URL（如 https://xxx.trycloudflare.com）"
echo "4. 运行: node set-nft-baseuri-public.js <URL>/api/nft/metadata/"
echo "5. 运行: node fix-and-verify.js 验证"
echo ""
