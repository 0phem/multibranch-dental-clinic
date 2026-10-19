#!/usr/bin/env bash
# Reset the DEMO database to a fresh demo clinic (never the clinic database dental_clinic):
#   rebuilds every table of dental_clinic_demo, seeds the demo accounts, the real branches, the assistant's draft answers and the
#   demo clinic (patients, appointments, paid invoices, one unpaid invoice, one conversation), then optionally gives the demo
#   Patient a real inbox again. Safe while scripts/demo-start.sh is running: the worker, scheduler and Reverb are reloaded with the new
#   code and checked afterwards (restarted in the background if they stopped). Reload the browser afterwards.
#
#   scripts/demo-reset.sh                                  asks you to type RESET
#   scripts/demo-reset.sh --yes                            no question (for a rehearsal)
#   DEMO_PATIENT_EMAIL=you+demo@gmail.com scripts/demo-reset.sh --yes
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
export DB_DATABASE="${DEMO_DB:-dental_clinic_demo}"
if [ "$DB_DATABASE" = "dental_clinic" ]; then echo "Refusing: the demo reset never runs on the clinic database dental_clinic." >&2; exit 1; fi
if grep -q '^APP_ENV=production' "$BACKEND/.env" 2>/dev/null; then echo "Refusing: APP_ENV=production." >&2; exit 1; fi
if [ "${1:-}" != "--yes" ]; then
  read -r -p "This deletes everything in $DB_DATABASE and rebuilds the demo clinic. Type RESET to continue: " answer
  [ "$answer" = "RESET" ] || { echo "Nothing changed."; exit 1; }
fi
cd "$BACKEND"
# Which demo processes were running before the rebuild (they are reloaded and checked afterwards).
pgrep -f "artisan queue:work" >/dev/null && HAD_WORKER=1 || HAD_WORKER=0
pgrep -f "artisan schedule:work" >/dev/null && HAD_SCHEDULER=1 || HAD_SCHEDULER=0
pgrep -f "artisan reverb:start" >/dev/null && HAD_REVERB=1 || HAD_REVERB=0
echo "== Rebuilding $DB_DATABASE"
php artisan migrate:fresh --force --no-interaction >/dev/null
php artisan db:seed --force --no-interaction >/dev/null
php artisan db:seed --class=DemoClinicSeeder --force --no-interaction | grep -E "Demo clinic ready|Real branch|Assistant answers|Interview round 2" || true
if [ -n "${DEMO_PATIENT_EMAIL:-}" ]; then "$ROOT/scripts/payment-test.sh" patient-email "$DEMO_PATIENT_EMAIL"; fi

# Keep the running demo alive (scripts/demo-start.sh): reload the worker and Reverb with the new code, then wait until the
# worker, scheduler and Reverb are healthy. A demo started by an older demo-start.sh (no restart loop, database cache) may
# have stopped while the cache table was rebuilt: then a supervised replacement is started here in the background.
REVERB_PORT="${REVERB_PORT:-$(grep -E '^REVERB_SERVER_PORT=' "$BACKEND/.env" 2>/dev/null | cut -d= -f2 | tr -d '"' || true)}"; REVERB_PORT="${REVERB_PORT:-8080}"
if [ "${HAD_WORKER:-0}${HAD_REVERB:-0}${HAD_SCHEDULER:-0}" != "000" ]; then
  echo "== Reloading the running demo processes with the new code"
  CACHE_STORE=file php artisan queue:restart >/dev/null 2>&1 || true
  CACHE_STORE=file php artisan reverb:restart >/dev/null 2>&1 || true
  LOGS="$BACKEND/storage/logs"
  up() { case "$1" in worker) pgrep -f "artisan queue:work" >/dev/null ;; scheduler) pgrep -f "artisan schedule:work" >/dev/null ;;
    reverb) lsof -ti tcp:"$REVERB_PORT" -sTCP:LISTEN >/dev/null 2>&1 ;; esac; }
  # A restart loop already looks after it (demo-start.sh's "supervise NAME", or a fallback loop from an earlier reset).
  supervised() { pgrep -f "supervise $1 " >/dev/null || pgrep -f "while :; do CACHE_STORE=file.*$2" >/dev/null; }
  wanted() { case "$1" in worker) [ "${HAD_WORKER:-0}" = 1 ] ;; scheduler) [ "${HAD_SCHEDULER:-0}" = 1 ] ;; reverb) [ "${HAD_REVERB:-0}" = 1 ] ;; esac; }
  all_up() { local n; for n in worker scheduler reverb; do if wanted "$n" && ! up "$n"; then return 1; fi; done; }
  # First give the restart loops time to bring each process back (Reverb takes a few seconds to listen again).
  for _ in $(seq 1 20); do all_up && break; sleep 1; done
  fallback() { # fallback NAME PATTERN COMMAND...: only when still down AND nothing restarts it, so the reset never adds a duplicate
    local name="$1" pattern="$2"; shift 2
    if ! wanted "$name" || up "$name" || supervised "$name" "$pattern"; then return 0; fi
    nohup bash -c 'while :; do CACHE_STORE=file "$@"; sleep 1; done' _ "$@" >"$LOGS/demo-$name.log" 2>&1 &
    disown || true
    echo "   $name was down: restarted in the background (log: backend/storage/logs/demo-$name.log)"
  }
  fallback worker queue:work php artisan queue:work --queue=mail,default
  fallback scheduler schedule:work php artisan schedule:work
  fallback reverb reverb:start php artisan reverb:start --port="$REVERB_PORT"
  healthy=""
  for _ in $(seq 1 30); do all_up && { healthy=yes; break; }; sleep 1; done
  count() { pgrep -f "artisan $1" | while read -r pid; do ps -o command= -p "$pid"; done | grep -c "^php artisan $1" || true; }
  dup=""; for c in queue:work schedule:work reverb:start; do [ "$(count "$c")" -gt 1 ] && dup="$dup $c"; done
  if [ -n "$dup" ]; then echo "   WARNING: more than one copy running:$dup (stop the extras, or restart scripts/demo-start.sh)" >&2; fi
  if [ -n "$healthy" ]; then echo "   worker, scheduler and Reverb are running"; else echo "   WARNING: not every demo process came back; run scripts/predefense-check.sh" >&2; fi
fi
echo "== Demo reset done. Reload the browser and sign in again."
