#!/bin/bash
# ============================================
# QEntrix Game Server - 服务重启脚本
# 服务器: ubuntu@43.163.114.175
#
# 使用方法:
#   bash restart.sh [service]
#
# service 选项:
#   status            - 查看所有服务状态
#   all               - 重启全部服务
#   mainnet           - 重启主网（后端+nginx）
#   testnet           - 重启测试网（后端+nginx）
#   backend           - 重启两个后端
#   backend-mainnet   - 只重启主网后端
#   backend-testnet   - 只重启测试网后端
#   frontend          - 重新构建两个前端
#   frontend-mainnet  - 只构建主网前端
#   frontend-testnet  - 只构建测试网前端
#   mongo             - 重启 MongoDB
#   nginx             - 重启 Nginx
# ============================================

SERVER_HOST="43.163.114.175"
SERVER_USER="ubuntu"
SERVER_PASS="QWer!@34"
SERVER="$SERVER_USER@$SERVER_HOST"
APP_DIR="/home/ubuntu/game-core"

ssh_run() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$1"
}

SERVICE="${1:-status}"

restart_mongo() {
    echo "--- 重启 MongoDB ---"
    ssh_run "sudo systemctl restart mongod && sudo systemctl is-active mongod"
}

restart_nginx() {
    echo "--- 重启 Nginx ---"
    ssh_run "sudo nginx -t && sudo systemctl restart nginx && sudo systemctl is-active nginx"
}

restart_backend_mainnet() {
    echo "--- 重启主网后端 (port 7777) ---"
    ssh_run "cd $APP_DIR && pm2 restart mainnet-server && sleep 2 && pm2 show mainnet-server | grep -E 'status|pid|restarts'"
}

restart_backend_testnet() {
    echo "--- 重启测试网后端 (port 7778) ---"
    ssh_run "cd $APP_DIR && pm2 restart testnet-server && sleep 2 && pm2 show testnet-server | grep -E 'status|pid|restarts'"
}

build_frontend_mainnet() {
    echo "--- 构建主网前端 (约2-3分钟) ---"
    ssh_run "cd $APP_DIR && \
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
        && echo '主网前端构建完成'"
}

build_frontend_testnet() {
    echo "--- 构建测试网前端 (约2-3分钟) ---"
    ssh_run "cd $APP_DIR && \
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
        && echo '测试网前端构建完成'"
}

show_status() {
    echo ""
    echo "================================================"
    echo "  QEntrix 服务状态"
    echo "================================================"
    echo ""
    echo "--- PM2 进程 ---"
    ssh_run "pm2 status"
    echo ""
    echo "--- 系统服务 ---"
    ssh_run "for s in mongod nginx; do echo \"  \$s: \$(sudo systemctl is-active \$s)\"; done"
    echo ""
    echo "--- 端口监听 ---"
    ssh_run "ss -tlnp | grep -E ':80|:3001|:7777|:7778|:27017' | awk '{print \$1, \$4}'"
    echo ""
    echo "--- 前端访问 ---"
    ssh_run "curl -s -o /dev/null -w '  主网   http://$SERVER_HOST -> HTTP %{http_code}\n' http://localhost/"
    ssh_run "curl -s -o /dev/null -w '  测试网 http://$SERVER_HOST:3001 -> HTTP %{http_code}\n' http://localhost:3001/"
    echo ""
    echo "--- 后端健康 ---"
    ssh_run "curl -s -o /dev/null -w '  主网后端   :7777 -> HTTP %{http_code}\n' http://localhost:7777/"
    ssh_run "curl -s -o /dev/null -w '  测试网后端 :7778 -> HTTP %{http_code}\n' http://localhost:7778/"
    echo ""
    echo "--- 主网后端日志(最新5行) ---"
    ssh_run "pm2 logs mainnet-server --lines 5 --nostream 2>&1 | grep '0|main' | tail -5"
    echo ""
    echo "--- 测试网后端日志(最新5行) ---"
    ssh_run "pm2 logs testnet-server --lines 5 --nostream 2>&1 | grep '1|test' | tail -5"
}

echo "================================================"
echo "  QEntrix 重启: $SERVICE"
echo "================================================"

case "$SERVICE" in
    status)
        show_status
        exit 0
        ;;
    all)
        restart_mongo
        echo ""
        restart_backend_mainnet
        echo ""
        restart_backend_testnet
        echo ""
        restart_nginx
        ;;
    mainnet)
        restart_backend_mainnet
        echo ""
        restart_nginx
        ;;
    testnet)
        restart_backend_testnet
        echo ""
        restart_nginx
        ;;
    backend)
        restart_backend_mainnet
        echo ""
        restart_backend_testnet
        ;;
    backend-mainnet)
        restart_backend_mainnet
        ;;
    backend-testnet)
        restart_backend_testnet
        ;;
    frontend)
        build_frontend_mainnet
        echo ""
        build_frontend_testnet
        echo ""
        restart_nginx
        ;;
    frontend-mainnet)
        build_frontend_mainnet
        echo ""
        restart_nginx
        ;;
    frontend-testnet)
        build_frontend_testnet
        echo ""
        restart_nginx
        ;;
    mongo)
        restart_mongo
        ;;
    nginx)
        restart_nginx
        ;;
    *)
        echo "未知选项: $SERVICE"
        echo ""
        echo "用法: bash restart.sh [选项]"
        echo ""
        echo "  status            查看所有服务状态"
        echo "  all               重启全部"
        echo "  mainnet           重启主网（后端+nginx）"
        echo "  testnet           重启测试网（后端+nginx）"
        echo "  backend           重启两个后端"
        echo "  backend-mainnet   只重启主网后端"
        echo "  backend-testnet   只重启测试网后端"
        echo "  frontend          重新构建两个前端"
        echo "  frontend-mainnet  只构建主网前端"
        echo "  frontend-testnet  只构建测试网前端"
        echo "  mongo             重启 MongoDB"
        echo "  nginx             重启 Nginx"
        exit 1
        ;;
esac

echo ""
show_status
