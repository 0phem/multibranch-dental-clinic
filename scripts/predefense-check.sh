#!/usr/bin/env bash
# Pre-defense check: PASS / WARN / FAIL for every process, email (SMTP login), the PayMongo test keys, the tunnel, the PayMongo
# webhook URL versus the current tunnel, the demo data and the queue, with what to do by hand for anything that fails.
# Read-only (add --send=you@example.com to also send one diagnostic email). Exit code 1 when anything FAILs.
#
#   scripts/predefense-check.sh
#   NGROK_DOMAIN=your-name.ngrok-free.dev scripts/predefense-check.sh --send=you@example.com
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DB_DATABASE="${DEMO_DB:-dental_clinic_demo}"
cd "$ROOT/backend" && exec php artisan demo:check ${NGROK_DOMAIN:+--tunnel="$NGROK_DOMAIN"} "$@"
