#!/bin/bash
# 启动cloudflare tunnel提供公网访问
# TronLink需要公网地址才能读取NFT元数据

echo "启动Cloudflare Tunnel..."
echo "注意：需要安装cloudflared: brew install cloudflare/cloudflare/cloudflared"

# 启动tunnel指向本地7778端口
cloudflared tunnel --url http://localhost:7778

# 启动后会显示类似这样的URL：
# https://xxx-xxx-xxx.trycloudflare.com
#
# 然后运行以下命令设置baseURI：
# node set-nft-baseuri-public.js https://xxx-xxx-xxx.trycloudflare.com/api/nft/metadata/
