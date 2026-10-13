#!/usr/bin/env bash
# PayMongo TEST-MODE live check helper (Priority 3, TD-07). Uses a SEPARATE demo database, `dental_clinic_demo`, so demo prices,
# visits and invoices never enter the clinic database `dental_clinic`. Never prints a key or secret.
#
#   scripts/payment-test.sh demo-db          create/migrate/seed dental_clinic_demo (first time) and issue one unpaid demo invoice
#   scripts/payment-test.sh invoice          issue one more unpaid demo invoice (PHP 1,800: cleaning + filling, demo prices)
#   scripts/payment-test.sh patient-email A  give the demo Patient (in the DEMO database only) a real inbox A, so receipt emails arrive;
#                                            sign in as A afterwards (same demo password)
#   scripts/payment-test.sh api              serve the API on :8000 against dental_clinic_demo (stop `php artisan serve` first)
#   scripts/payment-test.sh worker           queue worker against dental_clinic_demo (receipt emails)
#   scripts/payment-test.sh tunnel           ngrok on :8000 using NGROK_DOMAIN (falls back to cloudflared if ngrok is missing)
#   scripts/payment-test.sh check [host]     local config check + webhook reachability through the tunnel host
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
DEMO_DB="dental_clinic_demo"
export DB_DATABASE="$DEMO_DB"

refuse_production() {
  if grep -q '^APP_ENV=production' "$BACKEND/.env" 2>/dev/null; then echo "Refusing: APP_ENV=production." >&2; exit 1; fi
}

case "${1:-}" in
  demo-db)
    refuse_production
    if psql -lqt | cut -d'|' -f1 | grep -qw "$DEMO_DB"; then
      echo "$DEMO_DB exists: applying any new migrations only."
      (cd "$BACKEND" && php artisan migrate --force)
    else
      createdb "$DEMO_DB"
      (cd "$BACKEND" && php artisan migrate --force && php artisan db:seed --force)
    fi
    (cd "$BACKEND" && php artisan db:seed --class=DemoUnpaidInvoiceSeeder --force)
    ;;
  invoice)
    refuse_production
    (cd "$BACKEND" && php artisan db:seed --class=DemoUnpaidInvoiceSeeder --force)
    ;;
  patient-email)
    refuse_production
    addr="$(printf '%s' "${2:-}" | tr '[:upper:]' '[:lower:]')"
    [[ "$addr" =~ ^[^@[:space:]\']+@[^@[:space:]\']+\.[^@[:space:]\']+$ ]] || { echo "Usage: $0 patient-email you+demo@gmail.com" >&2; exit 1; }
    taken="$(psql -d "$DEMO_DB" -tAc "select count(*) from users where email='$addr'")"
    [ "$taken" = "0" ] || { echo "$addr is already used in $DEMO_DB." >&2; exit 1; }
    psql -d "$DEMO_DB" -v ON_ERROR_STOP=1 -q -c "begin; update persons set email='$addr' where email=(select email from users where role='patient' and email in ('patient@example.test') limit 1); update users set email='$addr' where email='patient@example.test' and role='patient'; commit;"
    echo "Demo Patient in $DEMO_DB now signs in as $addr (password unchanged). dental_clinic is not touched."
    ;;
  api)
    if lsof -ti tcp:8000 -sTCP:LISTEN >/dev/null 2>&1; then echo "Port 8000 is in use: stop 'php artisan serve' first (Ctrl+C in its terminal)." >&2; exit 1; fi
    # PHP's built-in server, NOT `php artisan serve`: artisan serve does not pass DB_DATABASE to its child process.
    cd "$BACKEND/public" && exec php -S localhost:8000 ../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php
    ;;
  worker)
    cd "$BACKEND" && exec php artisan queue:work --queue=mail,default
    ;;
  tunnel)
    if command -v ngrok >/dev/null 2>&1; then
      : "${NGROK_DOMAIN:?Set NGROK_DOMAIN to your free static domain, e.g. NGROK_DOMAIN=your-name.ngrok-free.app}"
      exec ngrok http --url="$NGROK_DOMAIN" 8000
    elif command -v cloudflared >/dev/null 2>&1; then
      echo "ngrok not found: using cloudflared (the URL CHANGES on every start; update the PayMongo webhook each time)."
      exec cloudflared tunnel --url http://localhost:8000
    else
      echo "Install ngrok (brew install ngrok) or cloudflared (brew install cloudflared)." >&2; exit 1
    fi
    ;;
  check)
    env_has() { grep -qE "^$1=.+" "$BACKEND/.env" && echo present || echo MISSING; }
    echo "== backend/.env (values never printed)"
    for k in PAYMONGO_PUBLIC_KEY PAYMONGO_SECRET_KEY PAYMONGO_WEBHOOK_SECRET PAYMONGO_MODE PAYMONGO_PAYMENT_METHOD_TYPES; do printf '  %-30s %s\n' "$k" "$(env_has "$k")"; done
    grep -qE '^PAYMONGO_MODE=test$' "$BACKEND/.env" && echo "  mode                           test" || echo "  mode                           NOT test (must be PAYMONGO_MODE=test)"
    grep -qE '^PAYMONGO_SECRET_KEY=sk_test_' "$BACKEND/.env" && echo "  secret key prefix              sk_test_ (test mode)" || echo "  secret key prefix              NOT sk_test_"
    grep -qE '^PAYMONGO_PUBLIC_KEY=pk_test_' "$BACKEND/.env" && echo "  public key prefix              pk_test_ (test mode)" || echo "  public key prefix              NOT pk_test_"
    grep -E '^PAYMONGO_PAYMENT_METHOD_TYPES=' "$BACKEND/.env" | sed 's/^/  /' || true
    echo "== local API"
    printf '  http://localhost:8000/up -> %s\n' "$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8000/up || echo down)"
    printf '  unpaid demo invoices in %s: %s\n' "$DEMO_DB" "$(psql -d "$DEMO_DB" -tAc "select count(*) from invoices where status='Issued'" 2>/dev/null || echo 'no demo database')"
    HOST="${2:-${NGROK_DOMAIN:-}}"
    if [ -n "$HOST" ]; then
      HOST="${HOST#https://}"; HOST="${HOST%/}"
      echo "== through the tunnel: https://$HOST"
      printf '  GET  /up                    -> %s (expect 200)\n' "$(curl -s -o /dev/null -w '%{http_code}' "https://$HOST/up")"
      body="$(curl -s -w ' [HTTP %{http_code}]' -X POST "https://$HOST/api/webhooks/paymongo" -H 'Content-Type: application/json' -d '{}')"
      echo "  POST /api/webhooks/paymongo -> $body"
      echo "     expect HTTP 400 'Invalid or missing webhook signature.' (proves it reaches our code and unsigned calls are refused)"
      echo "     HTTP 503 'not configured' means a PAYMONGO_* value is missing or the mode and key prefix disagree"
    else
      echo "(pass the tunnel host, or set NGROK_DOMAIN, to check reachability from outside)"
    fi
    ;;
  *)
    sed -n '2,12p' "$0"; exit 1
    ;;
esac
