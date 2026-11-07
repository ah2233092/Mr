#!/usr/bin/env bash
# ChatGPT Pro — start the website on this computer: http://localhost:3000
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1 || ! node -e "process.exit(+process.versions.node.split('.')[0] >= 22 ? 0 : 1)"; then
  echo "Node.js 22+ chahiye: https://nodejs.org (LTS) install karein, phir dobara chalayein."
  exit 1
fi
export LOCAL_SIGNUP_ONLY=1
echo "ChatGPT Pro chal raha hai:  http://localhost:3000   (band karne ke liye Ctrl+C)"
( sleep 3; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) ) >/dev/null 2>&1 &
exec node server/index.js
