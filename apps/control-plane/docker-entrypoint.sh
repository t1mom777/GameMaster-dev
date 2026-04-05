#!/bin/sh
set -eu

npm run payload -- migrate
HOSTNAME="${HOSTNAME:-0.0.0.0}" npm run start
