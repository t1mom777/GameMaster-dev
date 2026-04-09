#!/bin/sh
set -eu

npm run payload -- migrate
HOSTNAME="${HOSTNAME:-0.0.0.0}" node server.js &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}

trap cleanup INT TERM

node src/scripts/bootstrap-http.mjs

wait "$SERVER_PID"
