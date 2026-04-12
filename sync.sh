#!/bin/bash
# ============================================
# sync.sh - 本地代码同步到云服务器并重新构建
#
# 用法:
#   bash sync.sh           # 同步+构建两个前端
#   bash sync.sh src-only  # 只同步源码，不构建
#   bash sync.sh mainnet   # 同步+只构建主网前端
#   bash sync.sh testnet   # 同步+只构建测试网前端
#   bash sync.sh server    # 只同步并重启后端（不构建前端）
# ============================================

SERVER_HOST="43.163.114.175"
SERVER_USER="ubuntu"
SERVER_PASS="QWer!@34"
SERVER="$SERVER_USER@$SERVER_HOST"
APP_DIR="/home/ubuntu/game-core"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"  # 脚本所在目录（项目根目录）

run_ssh() { sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$1"; }
run_rsync() {
    sshpass -p "$SERVER_PASS" rsync -avz --progress \
        -e "ssh -o StrictHostKeyChecking=no" \
        "$@"
}

CMD="${1:-all}"

# ---- 同步源码 ----
sync_src() {
    echo "=== 同步源码到服务器 ==="
    run_rsync \
        --exclude='node_modules/' \
        --exclude='build/' \
        --exclude='build-mainnet/' \
        --exclude='build-testnet/' \
        --exclude='.git/' \
        --exclude='*.log' \
        --exclude='ai_engine/models/' \
        --exclude='.claude/' \
        --exclude='playwright-report/' \
        --exclude='test-results*' \
        --exclude='cache/' \
        --exclude='artifacts/' \
        "$LOCAL_DIR/" \
        "$SERVER:$APP_DIR/"
    echo "源码同步完成"
}

# ---- 构建主网前端 ----
build_mainnet() {
    echo ""
    echo "=== 构建主网前端 ==="
    run_ssh "cd $APP_DIR && \
        NODE_OPTIONS='--openssl-legacy-provider' \
        NODE_ENV=production \
        REACT_APP_NETWORK=mainnet \
        REACT_APP_SERVER_URI=http://$SERVER_HOST \
        REACT_APP_SERVER_PORT=7777 \
        REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd \
        REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c \
        REACT_APP_NFT_CONTRACT_ONCHAIN=TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc \
        npx react-scripts --openssl-legacy-provider build 2>&1 | tail -5 \
        && rm -rf build-mainnet && mv build build-mainnet \
        && chmod -R o+r build-mainnet \
        && echo '✅ 主网前端构建完成 -> http://$SERVER_HOST'"
}

# ---- 构建测试网前端 ----
build_testnet() {
    echo ""
    echo "=== 构建测试网前端 ==="
    run_ssh "cd $APP_DIR && \
        NODE_OPTIONS='--openssl-legacy-provider' \
        NODE_ENV=production \
        REACT_APP_NETWORK=testnet \
        REACT_APP_SERVER_URI=http://$SERVER_HOST:3001 \
        REACT_APP_SERVER_PORT=7778 \
        REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd \
        REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c \
        REACT_APP_NFT_CONTRACT_ONCHAIN=TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC \
        npx react-scripts --openssl-legacy-provider build 2>&1 | tail -5 \
        && rm -rf build-testnet && mv build build-testnet \
        && chmod -R o+r build-testnet \
        && echo '✅ 测试网前端构建完成 -> http://$SERVER_HOST:3001'"
}

# ---- reload nginx ----
reload_nginx() {
    echo ""
    echo "=== 重载 Nginx ==="
    run_ssh "sudo systemctl reload nginx && echo 'Nginx reloaded'"
}

# ---- 执行 ----
case "$CMD" in
    src-only)
        sync_src
        ;;
    mainnet)
        sync_src
        build_mainnet
        reload_nginx
        ;;
    testnet)
        sync_src
        build_testnet
        reload_nginx
        ;;
    server)
        sync_src
        echo ""
        echo "=== 重启后端服务 ==="
        run_ssh "cd $APP_DIR && pm2 restart mainnet-server testnet-server && sleep 2 && pm2 status"
        ;;
    all|*)
        sync_src
        build_mainnet
        build_testnet
        reload_nginx
        echo ""
        echo "=== 验证 ==="
        run_ssh "curl -s -o /dev/null -w '主网:   HTTP %{http_code}\n' http://localhost/"
        run_ssh "curl -s -o /dev/null -w '测试网: HTTP %{http_code}\n' http://localhost:3001/"
        echo ""
        echo "================================================"
        echo "  同步部署完成!"
        echo "  主网:   http://$SERVER_HOST"
        echo "  测试网: http://$SERVER_HOST:3001"
        echo "================================================"
        ;;
esac
