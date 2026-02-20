#!/usr/bin/env sh
set -eu

run_cleanup() {
  python - <<'PY'
from app import config
from app.main import cleanup_dynamic_routers_on_shutdown

if config.CLEANUP_DYNAMIC_ROUTERS_ON_SHUTDOWN:
    cleanup_dynamic_routers_on_shutdown()
PY
}

on_term() {
  run_cleanup
  if [ -n "${UVICORN_PID:-}" ]; then
    kill -TERM "${UVICORN_PID}" 2>/dev/null || true
    wait "${UVICORN_PID}" || true
  fi
  exit 0
}

trap on_term TERM INT

uvicorn app.main:app --host 0.0.0.0 --port 8001 --workers 4 &
UVICORN_PID=$!
wait "${UVICORN_PID}"
