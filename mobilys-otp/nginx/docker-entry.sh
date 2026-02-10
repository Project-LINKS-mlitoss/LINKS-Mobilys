#!/usr/bin/env bash
set -euo pipefail

RESOLVER_IP=$(awk '/^nameserver/{print $2; exit}' /etc/resolv.conf || true)
if [ -n "$RESOLVER_IP" ]; then
  echo "resolver ${RESOLVER_IP} valid=10s ipv6=off;" > /etc/nginx/conf.d/_resolver.conf
fi

# Background watcher: reload nginx when any conf changes
(
  mkdir -p /etc/nginx/conf.d/routers
  inotifywait -m -e close_write,create,delete,move /etc/nginx/conf.d/routers \
  | while read -r _; do
      echo "[nginx] change detected -> reload"
      nginx -s reload 2>/dev/null || true
    done
) &

