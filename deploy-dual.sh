#!/bin/bash
# ===========================================
# QEntrix 双网络部署脚本
# 主网:   http://43.163.114.175      (PORT 80 -> 3000, 后端 7777)
# 测试网: http://43.163.114.175:3001 (PORT 3001,        后端 7778)
# ===========================================

SERVER_HOST="43.163.114.175"
SERVER_USER="ubuntu"
SERVER_PASS="QWer!@34"
SERVER="$SERVER_USER@$SERVER_HOST"
APP_DIR="/home/ubuntu/game-core"
LOCAL_DIR="/Users/yingfengzhang/1JackSource/blockchain/game-core"

run_ssh() {
    sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "$1"
}
run_rsync() {
    sshpass -p "$SERVER_PASS" rsync -avz -e "ssh -o StrictHostKeyChecking=no" "$@"
}

echo "================================================"
echo "  QEntrix 双网络部署"
echo "  主网:   http://$SERVER_HOST"
echo "  测试网: http://$SERVER_HOST:3001"
echo "================================================"

# ---- Step 1: 同步最新源码 ----
echo ""
echo "=== Step 1: 同步源码 ==="
run_rsync \
    --exclude='node_modules/' \
    --exclude='build/' \
    --exclude='build-mainnet/' \
    --exclude='build-testnet/' \
    --exclude='.git/' \
    --exclude='*.log' \
    --exclude='ai_engine/models/' \
    --exclude='.claude/' \
    "$LOCAL_DIR/" \
    "$SERVER:$APP_DIR/"

# ---- Step 2: 上传env文件 ----
echo ""
echo "=== Step 2: 上传主网和测试网 env 文件 ==="
run_rsync "$LOCAL_DIR/***REMOVED***" "$SERVER:$APP_DIR/***REMOVED***"
run_rsync "$LOCAL_DIR/.env.testnet" "$SERVER:$APP_DIR/.env.testnet"

# ---- Step 3: 安装依赖（只需一次）----
echo ""
echo "=== Step 3: 安装依赖 ==="
run_ssh "cd $APP_DIR && npm install --legacy-peer-deps 2>&1 | tail -5"

# ---- Step 4: 构建主网前端 ----
echo ""
echo "=== Step 4: 构建主网前端 ==="
run_ssh "cd $APP_DIR && \
    NODE_OPTIONS='--openssl-legacy-provider' \
    NODE_ENV=production \
    REACT_APP_NETWORK=mainnet \
    REACT_APP_SERVER_URI=http://$SERVER_HOST \
    REACT_APP_SERVER_PORT=7777 \
    REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd \
    REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c \
    REACT_APP_NFT_CONTRACT_ONCHAIN=TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc \
    npx react-scripts --openssl-legacy-provider build 2>&1 | tail -8 \
    && mv build build-mainnet \
    && echo '主网构建完成 -> build-mainnet/'"

# ---- Step 5: 构建测试网前端 ----
echo ""
echo "=== Step 5: 构建测试网前端 ==="
run_ssh "cd $APP_DIR && \
    NODE_OPTIONS='--openssl-legacy-provider' \
    NODE_ENV=production \
    REACT_APP_NETWORK=testnet \
    REACT_APP_SERVER_URI=http://$SERVER_HOST:3001 \
    REACT_APP_SERVER_PORT=7778 \
    REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd \
    REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c \
    REACT_APP_NFT_CONTRACT_ONCHAIN=TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC \
    npx react-scripts --openssl-legacy-provider build 2>&1 | tail -8 \
    && mv build build-testnet \
    && echo '测试网构建完成 -> build-testnet/'"

# ---- Step 6: 修复权限 ----
echo ""
echo "=== Step 6: 修复目录权限 ==="
run_ssh "chmod o+x /home/ubuntu && chmod -R o+r $APP_DIR/build-mainnet $APP_DIR/build-testnet"

# ---- Step 7: 配置 PM2 双后端 ----
echo ""
echo "=== Step 7: 配置 PM2 双后端 ==="
cat << 'PM2EOF' | sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "cat > $APP_DIR/ecosystem.config.js"
module.exports = {
  apps: [
    {
      name: 'mainnet-server',
      script: 'server/server.js',
      cwd: '/home/ubuntu/game-core',
      instances: 1,
      autorestart: true,
      watch: false,
      env_file: '***REMOVED***',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 7777,
        MONGODB_URI: 'mongodb://localhost:27017/bridge-poker-mainnet',
        CORS_ORIGINS: 'http://43.163.114.175',
      }
    },
    {
      name: 'testnet-server',
      script: 'server/server.js',
      cwd: '/home/ubuntu/game-core',
      instances: 1,
      autorestart: true,
      watch: false,
      env_file: '.env.testnet',
      env: {
        NODE_ENV: 'production',
        SERVER_PORT: 7778,
        MONGODB_URI: 'mongodb://localhost:27017/bridge-poker-testnet',
        CORS_ORIGINS: 'http://43.163.114.175:3001',
      }
    }
  ]
};
PM2EOF

run_ssh "cd $APP_DIR && pm2 delete all 2>/dev/null || true && pm2 start ecosystem.config.js && sleep 3 && pm2 status"
run_ssh "pm2 save"

# ---- Step 8: 配置 nginx (主网80 + 测试网3001) ----
echo ""
echo "=== Step 8: 配置 Nginx ==="
NGINX_CONF='server {
    listen 80;
    server_name _;

    root /home/ubuntu/game-core/build-mainnet;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:7777/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /socket.io/ {
        proxy_pass http://localhost:7777/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}

server {
    listen 3001;
    server_name _;

    root /home/ubuntu/game-core/build-testnet;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:7778/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }

    location /socket.io/ {
        proxy_pass http://localhost:7778/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
}'

echo "$NGINX_CONF" | sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER" "sudo tee /etc/nginx/sites-available/game-core > /dev/null"
run_ssh "sudo nginx -t && sudo systemctl reload nginx && echo 'Nginx reloaded'"

# ---- Step 9: 验证 ----
echo ""
echo "=== Step 9: 验证部署 ==="
echo "--- 主网前端 ---"
run_ssh "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost/"
echo ""
echo "--- 测试网前端 ---"
run_ssh "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3001/"
echo ""
echo "--- 主网后端 ---"
run_ssh "curl -s http://localhost:7777/ | head -c 50"
echo ""
echo "--- 测试网后端 ---"
run_ssh "curl -s http://localhost:7778/ | head -c 50"
echo ""
echo "--- PM2 进程 ---"
run_ssh "pm2 status"

echo ""
echo "================================================"
echo "  部署完成!"
echo "  主网:   http://$SERVER_HOST"
echo "  测试网: http://$SERVER_HOST:3001"
echo "================================================"
