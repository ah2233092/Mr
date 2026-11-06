#!/usr/bin/env bash
# ChatGPT (personal) — one-command server install for an Ubuntu/Debian VPS.
#
#   git clone https://github.com/ah2233092/Mr.git && cd Mr && git checkout claude/wizardly-shannon-hklz40
#   cd chat-app && sudo bash install.sh
#
# Everything is automatic: Docker, passwords/secrets, HTTPS link (no domain needed),
# OmniRoute and its API key. Run it again any time to update or repair.
# Own domain?  sudo DOMAIN=chat.example.com bash install.sh
set -euo pipefail
cd "$(dirname "$0")"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
getkv() { grep -E "^$1=" .env 2>/dev/null | head -1 | cut -d= -f2- || true; }
setkv() {
  if grep -qE "^$1=" .env; then sed -i "s|^$1=.*|$1=$2|" .env; else printf '%s=%s\n' "$1" "$2" >> .env; fi
}

if [ "$(id -u)" -ne 0 ] && [ -z "${DRY_RUN:-}" ]; then echo "Please run with sudo:  sudo bash install.sh"; exit 1; fi

# 1) Docker
if [ -z "${DRY_RUN:-}" ] && ! command -v docker >/dev/null 2>&1; then
  say "Installing Docker…"
  curl -fsSL https://get.docker.com | sh
fi

# 2) Settings file with secrets generated for you (kept on later runs)
[ -f .env ] || cp .env.example .env
if [ "$(getkv ADMIN_EMAILS)" = "you@example.com" ]; then setkv ADMIN_EMAILS ""; fi   # first account becomes admin
if [ -n "${DOMAIN:-}" ]; then
  setkv DOMAIN "$DOMAIN"
elif [ -z "$(getkv DOMAIN)" ] || [ "$(getkv DOMAIN)" = "chat.example.com" ]; then
  IP="${PUBLIC_IP:-$(curl -fsS4 --max-time 10 https://api.ipify.org || curl -fsS4 --max-time 10 https://ifconfig.me)}"
  # <ip>.sslip.io points at this server, so HTTPS works without buying a domain
  setkv DOMAIN "$(echo "$IP" | tr . -).sslip.io"
fi
DOMAIN="$(getkv DOMAIN)"
setkv PUBLIC_URL "https://$DOMAIN"
[ -n "$(getkv OMNIROUTE_DASHBOARD_PASSWORD)" ] || setkv OMNIROUTE_DASHBOARD_PASSWORD "$(openssl rand -hex 12)"
[ -n "$(getkv OMNIROUTE_JWT_SECRET)" ] || setkv OMNIROUTE_JWT_SECRET "$(openssl rand -hex 32)"
[ -n "$(getkv OMNIROUTE_API_KEY_SECRET)" ] || setkv OMNIROUTE_API_KEY_SECRET "$(openssl rand -hex 32)"
chmod 600 .env

if [ -n "${DRY_RUN:-}" ]; then say "DRY_RUN: .env prepared for https://$DOMAIN"; exit 0; fi

# 3) Open the web ports if a firewall is active
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 80/tcp >/dev/null; ufw allow 443/tcp >/dev/null
fi

# 4) Start everything (app + OmniRoute + HTTPS)
say "Starting the app, OmniRoute and HTTPS…"
docker compose up -d --build

# 5) Create the app's OmniRoute API key automatically (first run only)
if [ -z "$(getkv OMNIROUTE_API_KEY)" ]; then
  say "Connecting the app to OmniRoute…"
  PASS="$(getkv OMNIROUTE_DASHBOARD_PASSWORD)"
  JAR="$(mktemp)"
  for _ in $(seq 1 60); do
    if curl -fsS -c "$JAR" -H 'Content-Type: application/json' -d "{\"password\":\"$PASS\"}" \
         http://127.0.0.1:20128/api/auth/login 2>/dev/null | grep -q '"success":true'; then break; fi
    sleep 3
  done
  KEY="$(curl -fsS -b "$JAR" -H 'Content-Type: application/json' -d '{"name":"chat-app"}' \
         http://127.0.0.1:20128/api/keys 2>/dev/null | sed -n 's/.*"key":"\([^"]*\)".*/\1/p' || true)"
  rm -f "$JAR"
  if [ -n "$KEY" ]; then
    setkv OMNIROUTE_API_KEY "$KEY"
    docker compose up -d app
  else
    echo "Could not create the OmniRoute key automatically — the app still works with the keys you add in Settings → AI keys."
  fi
fi

case "$DOMAIN" in *.sslip.io) SSH_HOST="$(echo "${DOMAIN%.sslip.io}" | tr - .)";; *) SSH_HOST="$DOMAIN";; esac
say "✅ Ready:  https://$DOMAIN"
cat <<EOF
  1. Open that link on your phone and on your PC.
  2. Sign up — the FIRST account is the admin.
  3. The app opens "AI keys": paste a free key (Groq / Cerebras / Gemini) and press Save.
  4. Install it as an app:
       Android (Chrome): menu ⋮ → Install app      iPhone (Safari): Share → Add to Home Screen
       Windows / Mac (Chrome or Edge): install icon in the address bar

  OmniRoute dashboard (optional): from your PC run
       ssh -L 20128:localhost:20128 root@$SSH_HOST
  then open http://localhost:20128  — password: $(getkv OMNIROUTE_DASHBOARD_PASSWORD)
  (all passwords are saved in chat-app/.env)
EOF
