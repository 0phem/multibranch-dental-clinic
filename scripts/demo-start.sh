#!/usr/bin/env bash
# One command for the whole demo, on the SEPARATE demo database (never the clinic's dental_clinic):
#   API (:8000), frontend (:5173), queue worker, scheduler, Reverb (live messages) and, when NGROK_DOMAIN is set, the ngrok tunnel.
#
#   scripts/demo-start.sh                                         # everything except the tunnel
#   NGROK_DOMAIN=your-name.ngrok-free.dev scripts/demo-start.sh   # plus the tunnel (PayMongo webhook)
#
# First run: creates, migrates and seeds dental_clinic_demo (demo accounts, branding settings, demo clinic data).
# Later runs: applies new migrations to the demo database only. Ctrl+C stops every process it started.
# Logs from all processes are shown here, each line prefixed with its process name. Never prints a key or secret.
# Ports can be moved with API_PORT, WEB_PORT and REVERB_PORT (defaults 8000, 5173 and REVERB_SERVER_PORT from backend/.env);
# the portal and the PayMongo return links expect 8000 and 5173, so only move them for testing.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
DEMO_DB="${DEMO_DB:-dental_clinic_demo}"
export DB_DATABASE="$DEMO_DB"

if [ "$DEMO_DB" = "dental_clinic" ]; then echo "Refusing: the demo never runs on the clinic database dental_clinic." >&2; exit 1; fi
if grep -q '^APP_ENV=production' "$BACKEND/.env" 2>/dev/null; then echo "Refusing: APP_ENV=production." >&2; exit 1; fi

API_PORT="${API_PORT:-8000}"; WEB_PORT="${WEB_PORT:-5173}"
if [ -z "${REVERB_PORT:-}" ]; then REVERB_PORT="$(grep -E '^REVERB_SERVER_PORT=' "$BACKEND/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' || true)"; fi
REVERB_PORT="${REVERB_PORT:-8080}"
busy=""
for port in "$API_PORT" "$WEB_PORT" "$REVERB_PORT"; do
  if lsof -ti tcp:"$port" -sTCP:LISTEN >/dev/null 2>&1; then busy="$busy $port"; fi
done
if [ -n "$busy" ]; then
  echo "Port(s)$busy already in use. Stop what is running there first (for example the separate terminals from docs/PAYMENT_LIVE_TEST.md)." >&2
  exit 1
fi

echo "== Demo database: $DEMO_DB"
if ! databases="$(psql -lqt 2>&1)"; then
  echo "PostgreSQL could not be reached: $(printf '%s' "$databases" | head -1)" >&2
  echo "Start PostgreSQL (Postgres.app) and, if it asks, allow this terminal to connect; then run this again." >&2
  exit 1
fi
if printf '%s\n' "$databases" | cut -d'|' -f1 | grep -qw "$DEMO_DB"; then
  (cd "$BACKEND" && php artisan migrate --force --no-interaction >/dev/null && php artisan db:seed --class=ClinicSettingsSeeder --force --no-interaction >/dev/null)
  echo "   up to date (new migrations applied, branding settings present)"
else
  createdb "$DEMO_DB"
  (cd "$BACKEND" && php artisan migrate --force --no-interaction && php artisan db:seed --force --no-interaction && php artisan db:seed --class=DemoClinicSeeder --force --no-interaction)
fi

pids=()
run() { # run NAME DIR COMMAND...: start in the background (its PID is the real process), every output line prefixed by [NAME]
  local name="$1" dir="$2"; shift 2
  ( cd "$dir" && exec "$@" ) > >(awk -v p="[$name]" '{ print p, $0; fflush() }') 2>&1 &
  pids+=("$!")
}
tree() { local pid="$1" child; echo "$pid"; for child in $(pgrep -P "$pid" 2>/dev/null); do tree "$child"; done; }
stop() {
  trap - INT TERM EXIT
  echo; echo "== Stopping the demo"
  local all=() pid
  for pid in "${pids[@]}"; do all+=($(tree "$pid")); done   # npm starts Vite as a grandchild: stop the whole tree
  kill -TERM "${all[@]}" 2>/dev/null || true
  for _ in 1 2 3 4 5 6 7 8; do kill -0 "${all[@]}" 2>/dev/null || break; sleep 1; done
  kill -KILL "${all[@]}" 2>/dev/null || true   # e.g. schedule:work only exits at the next minute on TERM
  echo "== Stopped"
}
trap stop INT TERM EXIT

echo "== Starting (Ctrl+C stops everything)"
# PHP's built-in server, not `php artisan serve`, which does not pass DB_DATABASE to its child process. It runs several worker
# processes (PHP_CLI_SERVER_WORKERS, default 4; API_WORKERS overrides), so a slow request such as a PDF or the booking calendar
# does not hold up the others.
export PHP_CLI_SERVER_WORKERS="${API_WORKERS:-4}"
run api "$BACKEND/public" php -S "localhost:$API_PORT" ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
run worker "$BACKEND" php artisan queue:work --queue=mail,default
run scheduler "$BACKEND" php artisan schedule:work
run reverb "$BACKEND" php artisan reverb:start --port="$REVERB_PORT"
run web "$ROOT" npm run dev -- --port "$WEB_PORT" --strictPort
if [ -n "${NGROK_DOMAIN:-}" ]; then
  if command -v ngrok >/dev/null 2>&1; then run tunnel "$ROOT" ngrok http --url="$NGROK_DOMAIN" "$API_PORT" --log=stdout --log-level=warn
  else echo "[tunnel] ngrok is not installed (brew install ngrok); continuing without the tunnel"; fi
fi

sleep 4
echo "== Demo running: portal http://localhost:$WEB_PORT · API http://localhost:$API_PORT${NGROK_DOMAIN:+ · tunnel https://$NGROK_DOMAIN}"
echo "   Check it any time in another terminal: ${NGROK_DOMAIN:+NGROK_DOMAIN=$NGROK_DOMAIN }scripts/predefense-check.sh"
wait
