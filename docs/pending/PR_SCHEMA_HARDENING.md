# Pull Request: Schema Hardening & Loyalty Infrastructure

## Summary
Hardens the database schema across six forward-only, backward-compatible migrations (`2026_11_15_000100` to `2026_11_16_000100`) providing archive tracking, settled invoice refund history, expanded patient marketing consent types, tooth chart branch data backfill, critical performance indexes created concurrently, and complete loyalty ledger infrastructure with row-locking concurrency guards.

---

## 1. Migration Apply Order

The migrations must be applied in sequential order:

1. `2026_11_15_000100_add_archive_columns_to_core_tables.php`
   - Adds nullable `archived_at`, `archived_by_user_id`, and `archive_reason` to `invoices`, `visits`, `prescriptions`, and `user_notifications`.
2. `2026_11_15_000200_create_invoice_refunds_table.php`
   - Creates append-only `invoice_refunds` ledger for settled PayMongo/manual refunds and adds `refund_status` to `invoices`.
3. `2026_11_15_000300_expand_patient_consents_check.php`
   - Safely expands `patient_consents_consent_type_check` to accept `'marketing'` and `'promotional_sms'` alongside clinical consent types.
4. `2026_11_15_000400_backfill_tooth_chart_branch.php`
   - Backfills historical `tooth_chart_entries.branch_id` from linked treatments/encounters and patient preferred branches.
   - **Important:** Contains **backfill only**. The `CHECK (branch_id IS NOT NULL) NOT VALID` tightening constraint has been split out to `docs/pending/draft_tighten_tooth_chart_branch.php` and must ship together with the `DentalChartController` fix, not before.
5. `2026_11_15_000500_add_critical_foreign_key_and_analytics_indexes.php`
   - Creates 8 critical FK and date-range indexes `CONCURRENTLY` to prevent table locking on busy tables (`appointments`, `treatments`, `invoices`, `payments`, `visits`).
6. `2026_11_16_000100_create_loyalty_and_referrals_tables.php`
   - Creates `loyalty_accounts`, `referrals`, append-only `loyalty_ledger`, `loyalty_lot_consumptions`, and `loyalty_lot_balances` view.
   - Includes PostgreSQL row-locking triggers (`PERFORM 1 FROM loyalty_ledger WHERE id = NEW.earn_entry_id FOR UPDATE;`) in `validate_lot_consumption()` and `validate_ledger_reversal()` to eliminate race conditions and over-reversals.

---

## 2. Infrastructure & Connection Requirements

- **Migration 5 Concurrent Indexing:** Uses `public $withinTransaction = false;` and `CREATE INDEX CONCURRENTLY`.
- **Database Connection Mode:**
  - Must run through a direct PostgreSQL connection (port 5432) or Supabase session-mode pooler.
  - **Do NOT** run via Supabase transaction-mode connection poolers (port 6543 with transaction pooling enabled), as PostgreSQL prohibits `CREATE INDEX CONCURRENTLY` inside pooled transactions.

---

## 3. Rollback Instructions

All 6 migrations support clean downward rollback:
```bash
php artisan migrate:rollback --step=6
```
Verified in scratch testing: safely drops triggers, constraints, views, indexes, and tables without leaving orphaned catalog records or blocking schema updates.

---

## 4. Post-Migration Verification Queries

Run the following queries to verify the production schema after deployment:

```sql
-- 1. Verify migration count (baseline was 76, should now be 82)
SELECT count(*) FROM migrations;

-- 2. Verify new tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_name IN ('invoice_refunds', 'loyalty_accounts', 'loyalty_ledger', 'loyalty_lot_consumptions', 'referrals');

-- 3. Verify append-only triggers are active (tgenabled = 'O')
SELECT tgrelid::regclass AS table_name, tgname, tgenabled
FROM pg_trigger 
WHERE tgname IN (
    'tooth_chart_entries_append_only',
    'invoice_refunds_append_only',
    'loyalty_ledger_append_only',
    'loyalty_lot_consumptions_append_only'
);

-- 4. Verify loyalty_lot_balances view exists
SELECT viewname FROM pg_views WHERE viewname = 'loyalty_lot_balances';
```

---

## 5. Test Suite Verification & Baseline Comparison

- **Full Suite Run:** 871 tests, 808 passed, 62 failures, 1 error (9,426 assertions).
- **Baseline Comparison:** Executed against a baseline copy (`%TEMP%\backend_baseline`) with all 6 new migrations removed. The pass, failure, and error counts were **100% identical**:
  - Tests failing with new migrations but passing in baseline: **0**
  - Tests failing in baseline but passing with new migrations: **0**
  - **Conclusion:** Zero regressions introduced.
- **Root Cause of the 63 Baseline Failures:**
  1. **32 Subprocess Concurrency Failures:** Windows test runner invokes `php.exe` without `-n`, causing subprocesses in `proc_open` to inherit XAMPP's PHP 8.2 `php.ini` (module API mismatch: compiled with 20220829, running on 20230831).
  2. **31 Orphaned Automation/Feedback Tests:** Endpoints `/api/automation` and `/api/feedback` were retired in commit `84a9965` during the Phase 1 25-module transition, and table `patient_feedback` was dropped in migration `2026_11_10_000100`. The test files in `Feature/Automation` and `Feature/Feedback` were orphaned.
  3. **GD Extension Requirement:** Locally, PHP CLI requires `-d extension=gd` to run Dompdf receipt and branding generation tests without error.

---

## 6. Repeatable Integrity & Concurrency Test Scripts

Repeatable SQL verification suites are committed under `backend/tests/database/`:
- `loyalty_integrity_test.sql`: 10-part integrity test verifying self-referrals, referee uniqueness, idempotency keys, append-only triggers, shortfall entries (`points = 0`, `unrecovered_points > 0`), and over-reversal guards.
- `concurrency_setup.sql`, `concurrency_session1.sql`, `concurrency_session2.sql`, `concurrency_verify.sql`: Concurrent redemption proof demonstrating PostgreSQL row-level locks prevent overspending when parallel transactions compete for the same earn lot.
- `README.md`: Instructions for running test scripts against scratch databases.
