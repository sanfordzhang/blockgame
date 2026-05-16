#!/usr/bin/env bash
set -euo pipefail

APP_NAME="${APP_NAME:-testnet-server}"
APP_DIR="${APP_DIR:-/home/ubuntu/game-core}"
PORT="${PORT:-7778}"
ENV_FILE="${ENV_FILE:-.env.testnet}"

cd "$APP_DIR"

echo "[restart] app: $APP_NAME"
echo "[restart] dir: $APP_DIR"
echo "[restart] port: $PORT"
echo "[restart] env: $ENV_FILE"

echo "[restart] stopping PM2 app if it exists"
pm2 stop "$APP_NAME" || true

echo "[restart] deleting stale PM2 app entry if it exists"
pm2 delete "$APP_NAME" || true

echo "[restart] killing any remaining process on port $PORT"
if command -v fuser >/dev/null 2>&1; then
  fuser -k "${PORT}/tcp" || true
elif command -v lsof >/dev/null 2>&1; then
  pids="$(lsof -ti tcp:"$PORT" || true)"
  if [ -n "$pids" ]; then
    kill $pids || true
    sleep 1
    kill -9 $pids || true
  fi
else
  echo "[restart] neither fuser nor lsof is available; skipping port cleanup"
fi

sleep 1

echo "[restart] starting PM2 app"
NODE_ENV=production \
ENV_FILE="$ENV_FILE" \
SERVER_PORT="$PORT" \
pm2 start server/server.js --name "$APP_NAME" -i 1 --time

echo "[restart] status"
pm2 status "$APP_NAME"

echo "[restart] health check"
for attempt in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/tournament/list" >/dev/null; then
    pm2 save
    echo "[restart] ok"
    exit 0
  fi

  echo "[restart] waiting for backend on port ${PORT} (${attempt}/30)"
  sleep 1
done

echo "[restart] backend did not pass health check"
pm2 logs "$APP_NAME" --lines 80 --nostream || true
exit 1
