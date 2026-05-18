#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"

MAINNET_BACKEND_PORT="${MAINNET_BACKEND_PORT:-7777}"
TESTNET_BACKEND_PORT="${TESTNET_BACKEND_PORT:-7778}"
MAINNET_FRONTEND_PORT="${MAINNET_FRONTEND_PORT:-3000}"
TESTNET_FRONTEND_PORT="${TESTNET_FRONTEND_PORT:-3001}"
MAINNET_ENV_FILE="${MAINNET_ENV_FILE:-.env.0g}"
TESTNET_ENV_FILE="${TESTNET_ENV_FILE:-.env.testnet}"
DUAL_RESTART_MODE="${DUAL_RESTART_MODE:-auto}"

kill_port() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -ti tcp:"$port" 2>/dev/null || true)"
    if [ -n "$pids" ]; then
      echo "[restart-dual] stopping port $port: $pids"
      kill $pids 2>/dev/null || true
      sleep 1
      kill -9 $pids 2>/dev/null || true
    fi
  elif command -v fuser >/dev/null 2>&1; then
    fuser -k "${port}/tcp" 2>/dev/null || true
  fi
}

check_mongo() {
  if command -v mongosh >/dev/null 2>&1; then
    mongosh --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1 && return 0
  elif command -v mongo >/dev/null 2>&1; then
    mongo --quiet --eval "db.adminCommand('ping').ok" >/dev/null 2>&1 && return 0
  fi
  echo "[restart-dual] WARNING: MongoDB ping failed or mongo shell is unavailable"
}

wait_http() {
  local url="$1"
  local label="$2"
  for attempt in $(seq 1 45); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "[restart-dual] $label OK"
      return 0
    fi
    sleep 1
  done
  echo "[restart-dual] ERROR: $label did not become healthy: $url"
  return 1
}

start_detached() {
  local name="$1"
  local log_file="$2"
  shift 2

  mkdir -p logs

  if command -v screen >/dev/null 2>&1; then
    local session="game-core-${name}"
    local app_dir_quoted
    local log_file_quoted
    local cmd_string

    printf -v app_dir_quoted '%q' "$APP_DIR"
    printf -v log_file_quoted '%q' "$log_file"
    printf -v cmd_string '%q ' "$@"

    screen -S "$session" -X quit >/dev/null 2>&1 || true
    screen -dmS "$session" bash -lc "cd $app_dir_quoted && exec $cmd_string >> $log_file_quoted 2>&1"
    echo "$session" > "logs/${name}.session"
    return
  fi

  nohup "$@" > "$log_file" 2>&1 < /dev/null &
  echo $! > "logs/${name}.pid"
}

start_backend() {
  local name="$1"
  local env_file="$2"
  local port="$3"
  local log_file="logs/${name}.log"

  echo "[restart-dual] starting $name backend on :$port with $env_file"
  start_detached "$name" "$log_file" \
    env ENV_FILE="$env_file" SERVER_PORT="$port" NODE_ENV=production PUBLIC_HOST="${LOCAL_PUBLIC_HOST:-}" \
    node server/server.js
}

start_frontend() {
  local name="$1"
  local build_dir="$2"
  local backend_port="$3"
  local frontend_port="$4"
  local log_file="logs/${name}.log"

  if [ ! -d "$build_dir" ]; then
    echo "[restart-dual] ERROR: $build_dir does not exist. Build it before restart."
    exit 1
  fi

  echo "[restart-dual] serving $build_dir on :$frontend_port -> backend :$backend_port"
  start_detached "$name" "$log_file" \
    env \
    BUILD_DIR="$APP_DIR/$build_dir" \
    BACKEND_TARGET="http://127.0.0.1:$backend_port" \
    FRONTEND_PORT="$frontend_port" \
    node deploy/static-frontend-server.js
}

detect_public_host() {
  if [ -n "${SERVER_HOST:-}" ]; then
    echo "$SERVER_HOST"
    return
  fi
  if [ -n "${PUBLIC_HOST:-}" ]; then
    echo "$PUBLIC_HOST"
    return
  fi
  if command -v ipconfig >/dev/null 2>&1; then
    local iface detected
    for iface in en0 en1 bridge100; do
      detected="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
      if [ -n "$detected" ]; then
        echo "$detected"
        return
      fi
    done
  fi
  if command -v hostname >/dev/null 2>&1; then
    local detected
    detected="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
    if [ -n "$detected" ]; then
      echo "$detected"
      return
    fi
    hostname 2>/dev/null || true
  fi
}

restart_pm2_stack() {
  local public_host
  public_host="$(detect_public_host)"

  echo "[restart-dual] restarting PM2 dual-network backend stack"
  if [ -n "$public_host" ]; then
    echo "[restart-dual] SERVER_HOST=$public_host"
  else
    echo "[restart-dual] WARNING: SERVER_HOST/PUBLIC_HOST is not set; CORS public-host fallback will be empty"
  fi

  SERVER_HOST="$public_host" pm2 startOrReload ecosystem.config.js --update-env
  pm2 save || true

  if [ "${RELOAD_NGINX:-true}" = "true" ] && command -v nginx >/dev/null 2>&1; then
    echo "[restart-dual] reloading nginx"
    sudo nginx -t && sudo systemctl reload nginx || echo "[restart-dual] WARNING: nginx reload failed; check manually"
  fi

  wait_http "http://127.0.0.1:$MAINNET_BACKEND_PORT/api/blockchain/config" "mainnet backend"
  wait_http "http://127.0.0.1:$TESTNET_BACKEND_PORT/api/blockchain/config" "testnet backend"
  wait_http "http://127.0.0.1:$MAINNET_FRONTEND_PORT/" "mainnet frontend"
  wait_http "http://127.0.0.1:$TESTNET_FRONTEND_PORT/" "testnet frontend"

  echo "[restart-dual] done (PM2/nginx mode)"
}

if { [ "$DUAL_RESTART_MODE" = "pm2" ] || { [ "$DUAL_RESTART_MODE" = "auto" ] && [ "$APP_DIR" = "/home/ubuntu/game-core" ]; }; } &&
  [ -f ecosystem.config.js ] &&
  command -v pm2 >/dev/null 2>&1; then
  restart_pm2_stack
  exit 0
fi

echo "[restart-dual] restarting local dual-network stack"
check_mongo || true
LOCAL_PUBLIC_HOST="${LOCAL_PUBLIC_HOST:-$(detect_public_host || true)}"
if [ -n "$LOCAL_PUBLIC_HOST" ]; then
  echo "[restart-dual] PUBLIC_HOST=$LOCAL_PUBLIC_HOST"
fi

for port in "$MAINNET_FRONTEND_PORT" "$TESTNET_FRONTEND_PORT" "$MAINNET_BACKEND_PORT" "$TESTNET_BACKEND_PORT"; do
  kill_port "$port"
done

start_backend mainnet-server "$MAINNET_ENV_FILE" "$MAINNET_BACKEND_PORT"
start_backend testnet-server "$TESTNET_ENV_FILE" "$TESTNET_BACKEND_PORT"

wait_http "http://127.0.0.1:$MAINNET_BACKEND_PORT/api/blockchain/config" "mainnet backend"
wait_http "http://127.0.0.1:$TESTNET_BACKEND_PORT/api/blockchain/config" "testnet backend"

start_frontend mainnet-frontend build-mainnet "$MAINNET_BACKEND_PORT" "$MAINNET_FRONTEND_PORT"
start_frontend testnet-frontend build-testnet "$TESTNET_BACKEND_PORT" "$TESTNET_FRONTEND_PORT"

wait_http "http://127.0.0.1:$MAINNET_FRONTEND_PORT/" "mainnet frontend"
wait_http "http://127.0.0.1:$TESTNET_FRONTEND_PORT/" "testnet frontend"

echo "[restart-dual] done"
echo "[restart-dual] mainnet: http://127.0.0.1:$MAINNET_FRONTEND_PORT"
echo "[restart-dual] testnet: http://127.0.0.1:$TESTNET_FRONTEND_PORT"
