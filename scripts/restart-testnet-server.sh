#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-testnet-server}"
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-7778}"
ENV_FILE="${ENV_FILE:-.env.testnet}"

cd "$APP_DIR"

echo "[restart] app: $APP_NAME"
echo "[restart] dir: $APP_DIR"
echo "[restart] port: $PORT"
echo "[restart] env: $ENV_FILE"

# --- MongoDB 健康检查（跨平台） ---
echo "[restart] checking MongoDB..."
MONGO_OK=false
MONGO_PORT="${MONGO_PORT:-27017}"

# 检测 MongoDB 是否可连接（最可靠的方式）
if command -v mongosh >/dev/null 2>&1; then
  if mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
    MONGO_OK=true
  fi
elif command -v mongo >/dev/null 2>&1; then
  if mongo --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
    MONGO_OK=true
  fi
fi

# 如果连不上，尝试按平台启动
if [ "$MONGO_OK" = false ]; then
  echo "[restart] MongoDB not responding on port $MONGO_PORT, attempting to start..."
  OS="$(uname -s)"
  case "$OS" in
    Darwin)
      # macOS: 使用 Homebrew
      if command -v brew >/dev/null 2>&1; then
        brew services start mongodb-community 2>/dev/null \
          || brew services restart mongodb-community 2>/dev/null \
          || { echo "[restart] WARNING: failed to start MongoDB via brew"; }
        sleep 3
      else
        echo "[restart] WARNING: brew not found, cannot auto-start MongoDB"
      fi
      ;;
    Linux)
      # Linux 服务器: 使用 systemctl（仅提示，不自动重启系统服务）
      echo "[restart] NOTE: on Linux servers, MongoDB is managed by systemd"
      echo "[restart] run manually: sudo systemctl start mongod (or sudo systemctl restart mongod)"
      ;;
    *)
      echo "[restart] WARNING: unsupported OS ($OS), cannot auto-start MongoDB"
      ;;
  esac

  # 再次验证
  if command -v mongosh >/dev/null 2>&1; then
    if mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
      MONGO_OK=true
    fi
  elif command -v mongo >/dev/null 2>&1; then
    if mongo --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1; then
      MONGO_OK=true
    fi
  fi

  if [ "$MONGO_OK" = true ]; then
    echo "[restart] MongoDB is now running ✓"
  else
    echo "[restart] WARNING: MongoDB still not reachable — backend may fail to start"
  fi
else
  echo "[restart] MongoDB OK ✓"
fi

echo "[restart] stopping PM2 app if it exists"
if command -v pm2 >/dev/null 2>&1; then
  pm2 stop "$APP_NAME" 2>/dev/null || true

  echo "[restart] deleting stale PM2 app entry if it exists"
  pm2 delete "$APP_NAME" 2>/dev/null || true
else
  echo "[restart] pm2 not found, skipping PM2 cleanup (install with: npm i -g pm2)"
fi

echo "[restart] killing any remaining process on port $PORT"
if command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -ti tcp:"$PORT" 2>/dev/null || true)"
  if [ -n "$pids" ]; then
    echo "[restart] killing PIDs: $pids"
    kill $pids 2>/dev/null || true
    sleep 1
    kill -9 $pids 2>/dev/null || true
  else
    echo "[restart] no process found on port $PORT"
  fi
elif command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" 2>/dev/null || true
else
  echo "[restart] neither lsof nor fuser is available; skipping port cleanup"
fi

sleep 1

echo "[restart] starting server"
USE_PM2=false
if command -v pm2 >/dev/null 2>&1; then
  USE_PM2=true
  echo "[restart] using PM2 (cluster mode)"
  NODE_ENV=production \
  ENV_FILE="$ENV_FILE" \
  SERVER_PORT="$PORT" \
  pm2 start server/server.js --name "$APP_NAME" -i 1 --time

  echo "[restart] status"
  pm2 status "$APP_NAME" 2>/dev/null || true
else
  echo "[restart] pm2 not found, using node (foreground mode, Ctrl+C to stop)"

  # 双重确认端口未被占用
  if command -v lsof >/dev/null 2>&1 && lsof -ti tcp:"$PORT" >/dev/null 2>&1; then
    echo "[restart] ERROR: port $PORT still in use"
    exit 1
  fi

  # 后台启动，等健康检查后再决定是否保持
  ENV_FILE="$ENV_FILE" SERVER_PORT="$PORT" node server/server.js &
  SERVER_PID=$!
fi

echo "[restart] health check"
HEALTHY=false
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/tournament/list" >/dev/null; then
    HEALTHY=true
    break
  fi

  echo "[restart] waiting for backend on port ${PORT} (${attempt}/30)"
  sleep 1
done

if [ "$HEALTHY" = false ]; then
  echo "[restart] backend did not pass health check"
  if [ "$USE_PM2" = true ]; then
    pm2 logs "$APP_NAME" --lines 80 --nostream || true
  else
    kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null
  fi
  exit 1
fi

if [ "$USE_PM2" = true ]; then
  pm2 save
  echo "[restart] ok (managed by PM2)"
else
  echo "[restart] ok (running as PID $SERVER_PID, press Ctrl+C to stop)"
  # 前台挂起，Ctrl+C 可终止子进程
  trap "kill $SERVER_PID 2>/dev/null; wait $SERVER_PID 2>/dev/null" EXIT INT TERM
  wait $SERVER_PID
fi
