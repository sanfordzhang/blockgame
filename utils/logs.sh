#!/bin/bash
# ============================================
# QEntrix 日志查看脚本
# 用法: bash logs.sh [选项]
#
# 选项:
#   mainnet         主网后端实时日志（默认）
#   testnet         测试网后端实时日志
#   mainnet-err     主网后端错误日志
#   testnet-err     测试网后端错误日志
#   nginx           Nginx访问日志
#   nginx-err       Nginx错误日志
#   mongo           MongoDB日志
#   balance [addr]  查看某地址的余额同步日志
#   all             查看所有服务最新日志
# ============================================

SERVER_HOST="43.163.114.175"
SERVER_USER="ubuntu"
SERVER_PASS="QWer!@34"
SERVER="$SERVER_USER@$SERVER_HOST"

ssh_run() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$1"
}
ssh_tail() {
    # 实时追踪日志（Ctrl+C退出）
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no -t "$SERVER" "$1"
}

CMD="${1:-mainnet}"
ADDR="${2:-}"

case "$CMD" in
    mainnet)
        echo "=== 主网后端实时日志 (Ctrl+C 退出) ==="
        ssh_tail "pm2 logs mainnet-server --lines 50"
        ;;
    testnet)
        echo "=== 测试网后端实时日志 (Ctrl+C 退出) ==="
        ssh_tail "pm2 logs testnet-server --lines 50"
        ;;
    mainnet-out)
        echo "=== 主网后端输出日志(最近100行) ==="
        ssh_run "pm2 logs mainnet-server --lines 100 --nostream 2>&1 | grep '0|main'"
        ;;
    testnet-out)
        echo "=== 测试网后端输出日志(最近100行) ==="
        ssh_run "pm2 logs testnet-server --lines 100 --nostream 2>&1 | grep '1|test'"
        ;;
    mainnet-err)
        echo "=== 主网后端错误日志 ==="
        ssh_run "cat /home/ubuntu/.pm2/logs/mainnet-server-error-0.log 2>/dev/null | tail -100 || echo '无错误日志'"
        ;;
    testnet-err)
        echo "=== 测试网后端错误日志 ==="
        ssh_run "cat /home/ubuntu/.pm2/logs/testnet-server-error-0.log 2>/dev/null | tail -100 || echo '无错误日志'"
        ;;
    nginx)
        echo "=== Nginx 访问日志(最近50行) ==="
        ssh_run "sudo tail -50 /var/log/nginx/access.log"
        ;;
    nginx-err)
        echo "=== Nginx 错误日志(最近50行) ==="
        ssh_run "sudo tail -50 /var/log/nginx/error.log"
        ;;
    mongo)
        echo "=== MongoDB 日志(最近50行) ==="
        ssh_run "sudo tail -50 /var/log/mongodb/mongod.log 2>/dev/null || sudo journalctl -u mongod --no-pager -n 50"
        ;;
    balance)
        if [ -z "$ADDR" ]; then
            echo "用法: bash logs.sh balance <钱包地址>"
            echo "例如: bash logs.sh balance TU8rhtpFQUsgpbe9sXQAfG8bdxF52GgSMv"
            exit 1
        fi
        echo "=== 查询地址 $ADDR 的余额日志 ==="
        SHORT="${ADDR:0:10}"
        ssh_run "pm2 logs mainnet-server --lines 500 --nostream 2>&1 | grep -i '$SHORT\|balance\|bankroll\|sync' | tail -30"
        ;;
    all)
        echo "================================================"
        echo "=== 主网后端最近20行 ==="
        ssh_run "pm2 logs mainnet-server --lines 20 --nostream 2>&1 | grep '0|main' | tail -20"
        echo ""
        echo "=== 测试网后端最近20行 ==="
        ssh_run "pm2 logs testnet-server --lines 20 --nostream 2>&1 | grep '1|test' | tail -20"
        echo ""
        echo "=== 主网错误日志 ==="
        ssh_run "cat /home/ubuntu/.pm2/logs/mainnet-server-error-0.log 2>/dev/null | tail -10 || echo '无'"
        echo ""
        echo "=== 测试网错误日志 ==="
        ssh_run "cat /home/ubuntu/.pm2/logs/testnet-server-error-0.log 2>/dev/null | tail -10 || echo '无'"
        echo ""
        echo "=== Nginx错误日志 ==="
        ssh_run "sudo tail -10 /var/log/nginx/error.log 2>/dev/null"
        ;;
    *)
        echo "未知选项: $CMD"
        echo ""
        echo "用法: bash logs.sh [选项]"
        echo ""
        echo "  mainnet      主网后端实时日志（默认，Ctrl+C退出）"
        echo "  testnet      测试网后端实时日志"
        echo "  mainnet-out  主网输出日志（最近100行，不实时）"
        echo "  testnet-out  测试网输出日志（最近100行，不实时）"
        echo "  mainnet-err  主网错误日志"
        echo "  testnet-err  测试网错误日志"
        echo "  nginx        Nginx访问日志"
        echo "  nginx-err    Nginx错误日志"
        echo "  mongo        MongoDB日志"
        echo "  balance <地址>  查看某钱包地址的余额日志"
        echo "  all          查看所有服务最新日志"
        exit 1
        ;;
esac
