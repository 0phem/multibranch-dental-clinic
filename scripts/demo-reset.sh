#!/usr/bin/env bash
# Reset the DEMO database to a fresh demo clinic (never the clinic database dental_clinic):
#   rebuilds every table of dental_clinic_demo, seeds the demo accounts, the real branches, the assistant's draft answers and the
#   demo clinic (patients, appointments, paid invoices, one unpaid invoice, one conversation), then optionally gives the demo
#   Patient a real inbox again. Safe while scripts/demo-start.sh is running; reload the browser afterwards.
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
echo "== Rebuilding $DB_DATABASE"
php artisan migrate:fresh --force --no-interaction >/dev/null
php artisan db:seed --force --no-interaction >/dev/null
php artisan db:seed --class=DemoClinicSeeder --force --no-interaction | grep -E "Demo clinic ready|Real branch|Assistant answers|Interview round 2" || true
if [ -n "${DEMO_PATIENT_EMAIL:-}" ]; then "$ROOT/scripts/payment-test.sh" patient-email "$DEMO_PATIENT_EMAIL"; fi
echo "== Demo reset done. Reload the browser and sign in again."
