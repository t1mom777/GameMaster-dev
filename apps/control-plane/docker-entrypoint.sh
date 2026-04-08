#!/bin/sh
set -eu

npm run payload -- migrate
npm run bootstrap
HOSTNAME="${HOSTNAME:-0.0.0.0}" node .next/standalone/server.js
