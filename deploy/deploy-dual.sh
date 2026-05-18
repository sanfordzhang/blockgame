#!/bin/bash
set -euo pipefail

# ===========================================
# QEntrix 双网络部署脚本
# 主网:   http://$SERVER_HOST:3000 (PORT 3000 -> build-mainnet, 后端 7777)
# 测试网: http://$SERVER_HOST:3001 (PORT 3001 -> build-testnet, 后端 7778)
# ===========================================

SERVER_HOST="${SERVER_HOST:-}"
SERVER_USER="${SERVER_USER:-ubuntu}"
SERVER_PASS="${SSH_PASS:-}"

if [ -z "$SERVER_HOST" ]; then
    echo "ERROR: SERVER_HOST is required. Example: SERVER_HOST=<server-ip-or-domain> SSH_PASS=... $0"
    exit 1
fi

SERVER="$SERVER_USER@$SERVER_HOST"
APP_DIR="${APP_DIR:-/home/ubuntu/game-core}"
LOCAL_DIR="${LOCAL_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
CONTROL_PATH="/tmp/game-core-deploy-${SERVER_USER}-${SERVER_HOST}-22.sock"

SSH_BASE_OPTS=(
    -o StrictHostKeyChecking=no
    -o UserKnownHostsFile=/dev/null
    -o ControlPath="$CONTROL_PATH"
)

cleanup_mux() {
    ssh -o ControlPath="$CONTROL_PATH" -O exit "$SERVER" >/dev/null 2>&1 || true
}
trap cleanup_mux EXIT

ensure_mux() {
    rm -f "$CONTROL_PATH"
    sshpass -p "$SERVER_PASS" ssh \
        "${SSH_BASE_OPTS[@]}" \
        -o ControlMaster=yes \
        -o ControlPersist=10m \
        -fN \
        "$SERVER"
}

run_ssh() {
    ssh "${SSH_BASE_OPTS[@]}" -o ControlMaster=no "$SERVER" "$1"
}

run_rsync() {
    local ssh_cmd
    ssh_cmd="ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ControlMaster=no -o ControlPath=$CONTROL_PATH"
    rsync -avz -e "$ssh_cmd" "$@"
}

echo "================================================"
echo "  QEntrix 双网络部署"
echo "  主网:   http://$SERVER_HOST:3000"
echo "  测试网: http://$SERVER_HOST:3001"
echo "================================================"

echo ""
echo "=== Step 0: 建立 SSH 复用连接 ==="
ensure_mux
run_ssh "echo 'SSH multiplexing ready'"

# ---- Step 1: 同步最新源码 ----
echo ""
echo "=== Step 1: 同步源码 ==="
run_rsync \
    --exclude='node_modules/' \
    --exclude='build/' \
    --exclude='build-mainnet/' \
    --exclude='build-testnet/' \
    --exclude='build-*-next/' \
    --exclude='build-*.previous/' \
    --exclude='build-*.bak.*/' \
    --exclude='build-rewired-test-backup/' \
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
run_ssh "set -e; cd $APP_DIR && \
    rm -rf build build-mainnet-next && \
    NODE_OPTIONS='--openssl-legacy-provider' \
    NODE_ENV=production \
    GENERATE_SOURCEMAP=false \
    REACT_APP_NETWORK=mainnet \
    REACT_APP_SERVER_URI=http://$SERVER_HOST:3000 \
    REACT_APP_SERVER_PORT=7777 \
    REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd \
    REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c \
    REACT_APP_NFT_CONTRACT_ONCHAIN=TZ44KG9TPtWzFWKHy4SJxHFmzwbgTZU9fc \
    REACT_APP_ZEROG_POKERGAME_ADDRESS_MAINNET=0x4A39B124A0660BBbE403B02D5B37C9878B0BC8bc \
    REACT_APP_ZEROG_INFT_ADDRESS_MAINNET=0xc6F5495D411405630dF5d5ad32225d7F51dC1645 \
    npx react-app-rewired --openssl-legacy-provider build > /tmp/game-core-build-mainnet.log 2>&1 \
    && tail -8 /tmp/game-core-build-mainnet.log \
    && mv build build-mainnet-next \
    && if [ -d build-mainnet/static ]; then mkdir -p build-mainnet-next/static && cp -an build-mainnet/static/. build-mainnet-next/static/; fi \
    && find build-mainnet-next -type f \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.svg' -o -name '*.html' -o -name '*.ttf' -o -name '*.woff' -o -name '*.woff2' \) -print0 | xargs -0 -r gzip -kf -9 \
    && mkdir -p build-mainnet \
    && rsync -a --delete --delay-updates build-mainnet-next/ build-mainnet/ \
    && rm -rf build-mainnet-next \
    && echo '主网构建完成 -> build-mainnet/'"

# ---- Step 5: 构建测试网前端 ----
echo ""
echo "=== Step 5: 构建测试网前端 ==="
run_ssh "set -e; cd $APP_DIR && \
    rm -rf build build-testnet-next && \
    NODE_OPTIONS='--openssl-legacy-provider' \
    NODE_ENV=production \
    GENERATE_SOURCEMAP=false \
    REACT_APP_NETWORK=testnet \
    REACT_APP_SERVER_URI=http://$SERVER_HOST:3001 \
    REACT_APP_SERVER_PORT=7778 \
    REACT_APP_MAINNET_CONTRACT_ADDRESS=THNteSEUMe15zY9cywgv1K8Ymc4XRpkmsd \
    REACT_APP_TESTNET_CONTRACT_ADDRESS=TQiG3UXV9uSLyW5Ax7Pa9WwcT9EhEJnU4c \
    REACT_APP_NFT_CONTRACT_ONCHAIN=TXiaxLfirc3bMTT8uJjesBAW2Vvx1VABcC \
    REACT_APP_ZEROG_INFT_ADDRESS=0x5d36eE3Bd3D9D42B552C873EEd1Eef23535443a5 \
    REACT_APP_ZEROG_POKERGAME_ADDRESS=0xc4975D55aD2607B14616E97B9a8E5622778eF5aE \
    REACT_APP_TOURNAMENT_MOCK_GAME_ENABLED=true \
    npx react-app-rewired --openssl-legacy-provider build > /tmp/game-core-build-testnet.log 2>&1 \
    && tail -8 /tmp/game-core-build-testnet.log \
    && mv build build-testnet-next \
    && if [ -d build-testnet/static ]; then mkdir -p build-testnet-next/static && cp -an build-testnet/static/. build-testnet-next/static/; fi \
    && find build-testnet-next -type f \( -name '*.js' -o -name '*.css' -o -name '*.json' -o -name '*.svg' -o -name '*.html' -o -name '*.ttf' -o -name '*.woff' -o -name '*.woff2' \) -print0 | xargs -0 -r gzip -kf -9 \
    && mkdir -p build-testnet \
    && rsync -a --delete --delay-updates build-testnet-next/ build-testnet/ \
    && rm -rf build-testnet-next \
    && echo '测试网构建完成 -> build-testnet/'"

# ---- Step 6: 修复权限 ----
echo ""
echo "=== Step 6: 修复目录权限 ==="
run_ssh "chmod o+x /home/ubuntu && chmod -R o+r $APP_DIR/build-mainnet $APP_DIR/build-testnet"

# ---- Step 7: 配置 PM2 双后端 ----
echo ""
echo "=== Step 7: 配置 PM2 双后端 ==="
cat << 'PM2EOF' | ssh "${SSH_BASE_OPTS[@]}" -o ControlMaster=no "$SERVER" "cat > $APP_DIR/ecosystem.config.js"
const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(path.resolve(__dirname, filePath), 'utf8');
    const env = {};
    content.split('\n').forEach(line => {
      line = line.trim();
      if (!line || line.startsWith('#')) return;
      const idx = line.indexOf('=');
      if (idx < 0) return;
      const key = line.slice(0, idx).trim();
      let val = line.slice(idx + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    });
    return env;
  } catch (e) {
    return {};
  }
}

const mainnetEnv = loadEnvFile('***REMOVED***');
const testnetEnv = loadEnvFile('.env.testnet');
const publicHost = process.env.SERVER_HOST || process.env.PUBLIC_HOST || '';

function publicOrigin(port) {
  return publicHost ? `http://${publicHost}:${port}` : '';
}

function mergeRuntimeEnv(env, fallback = {}) {
  return {
    ...env,
    CORS_ORIGINS: process.env.CORS_ORIGINS || fallback.CORS_ORIGINS || env.CORS_ORIGINS || '',
    SERVER_HOSTNAME: process.env.SERVER_HOSTNAME || fallback.SERVER_HOSTNAME || env.SERVER_HOSTNAME || '',
    NFT_PUBLIC_BASE_URL: process.env.NFT_PUBLIC_BASE_URL || fallback.NFT_PUBLIC_BASE_URL || env.NFT_PUBLIC_BASE_URL || '',
    PUBLIC_API_BASE_URL: process.env.PUBLIC_API_BASE_URL || fallback.PUBLIC_API_BASE_URL || env.PUBLIC_API_BASE_URL || ''
  };
}

module.exports = {
  apps: [
    {
      name: 'mainnet-server',
      script: 'server/server.js',
      cwd: '/home/ubuntu/game-core',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        ...mergeRuntimeEnv(mainnetEnv, {
          CORS_ORIGINS: publicOrigin(3000),
          SERVER_HOSTNAME: publicHost,
          NFT_PUBLIC_BASE_URL: publicOrigin(3000),
          PUBLIC_API_BASE_URL: publicOrigin(3000)
        }),
        ENV_FILE: '***REMOVED***',
        NODE_ENV: 'production',
        SERVER_PORT: 7777,
        MONGODB_URI: 'mongodb://localhost:27017/bridge-poker-mainnet',
      }
    },
    {
      name: 'testnet-server',
      script: 'server/server.js',
      cwd: '/home/ubuntu/game-core',
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        ...mergeRuntimeEnv(testnetEnv, {
          CORS_ORIGINS: publicOrigin(3001),
          SERVER_HOSTNAME: publicHost,
          NFT_PUBLIC_BASE_URL: publicOrigin(3001),
          PUBLIC_API_BASE_URL: publicOrigin(3001)
        }),
        ENV_FILE: '.env.testnet',
        NODE_ENV: 'production',
        SERVER_PORT: 7778,
        MONGODB_URI: 'mongodb://localhost:27017/bridge-poker-testnet',
      }
    }
  ]
};
PM2EOF

run_ssh "set -e; cd $APP_DIR && SERVER_HOST='$SERVER_HOST' pm2 startOrReload ecosystem.config.js --update-env && (pm2 delete testnet-frontend 2>/dev/null || true) && sleep 3 && pm2 status"
run_ssh "pm2 save"

# ---- Step 8: 配置 nginx (主网3000；测试网3001均由 Nginx 直接服务静态文件) ----
echo ""
echo "=== Step 8: 配置 Nginx ==="
cat << 'NGINXEOF' | ssh "${SSH_BASE_OPTS[@]}" -o ControlMaster=no "$SERVER" "sudo tee /etc/nginx/sites-available/game-core > /dev/null"
server {
    listen 3000;
    server_name _;
    keepalive_timeout 0;
    send_timeout 60s;

    root /home/ubuntu/game-core/build-mainnet;
    index index.html;

    sendfile off;
    tcp_nopush off;
    tcp_nodelay on;
    gzip off;
    gzip_static on;

    types {
        text/html html;
        text/css css;
        application/javascript js;
        application/json json map;
        image/png png;
        image/jpeg jpg jpeg;
        image/gif gif;
        image/x-icon ico;
        image/svg+xml svg;
        font/ttf ttf;
        font/woff woff;
        font/woff2 woff2;
        application/vnd.ms-fontobject eot;
    }

    location = /service-worker.js {
        default_type application/javascript;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        return 200 "self.addEventListener('install', event => { self.skipWaiting(); });\nself.addEventListener('activate', event => { event.waitUntil((async () => { if (self.caches) { const keys = await caches.keys(); await Promise.all(keys.map(key => caches.delete(key))); } await self.clients.claim(); await self.registration.unregister(); const clients = await self.clients.matchAll({ type: 'window' }); clients.forEach(client => client.navigate(client.url)); })()); });\n";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:7777/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:7777/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_cache_bypass $http_upgrade;
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }
}

server {
    listen 3001;
    server_name _;
    keepalive_timeout 0;
    send_timeout 60s;

    root /home/ubuntu/game-core/build-testnet;
    index index.html;

    sendfile off;
    tcp_nopush off;
    tcp_nodelay on;
    gzip off;
    gzip_static on;

    types {
        text/html html;
        text/css css;
        application/javascript js;
        application/json json map;
        image/png png;
        image/jpeg jpg jpeg;
        image/gif gif;
        image/x-icon ico;
        image/svg+xml svg;
        font/ttf ttf;
        font/woff woff;
        font/woff2 woff2;
        application/vnd.ms-fontobject eot;
    }

    location = /service-worker.js {
        default_type application/javascript;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
        return 200 "self.addEventListener('install', event => { self.skipWaiting(); });\nself.addEventListener('activate', event => { event.waitUntil((async () => { if (self.caches) { const keys = await caches.keys(); await Promise.all(keys.map(key => caches.delete(key))); } await self.clients.claim(); await self.registration.unregister(); const clients = await self.clients.matchAll({ type: 'window' }); clients.forEach(client => client.navigate(client.url)); })()); });\n";
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|map|json)$ {
        try_files $uri =404;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:7778/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:7778/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        proxy_cache_bypass $http_upgrade;
        add_header Cache-Control "no-cache";
    }

    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate" always;
    }
}
NGINXEOF

run_ssh "sudo nginx -t && sudo systemctl reload nginx && echo 'Nginx reloaded'"

# ---- Step 9: 验证 ----
echo ""
echo "=== Step 9: 验证部署 ==="
echo "--- 主网前端 ---"
run_ssh "curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:3000/"
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
echo "  主网:   http://$SERVER_HOST:3000"
echo "  测试网: http://$SERVER_HOST:3001"
echo "================================================"
