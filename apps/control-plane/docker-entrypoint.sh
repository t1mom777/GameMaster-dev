#!/bin/sh
set -eu

HOSTNAME="0.0.0.0" node server.js &
SERVER_PID=$!

cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
}

trap cleanup INT TERM

node bootstrap-http.mjs

wait "$SERVER_PID"
