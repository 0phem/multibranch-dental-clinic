# Pending clinic-database migrations (`dental_clinic`)

Inspected 2026-10-13. **Not applied.** The local clinic database is migrated through `2026_10_08_000100_create_automation_tables`. The migrations below exist in the code and are applied in the isolated test database (`dental_clinic_test`) on every test run, but not in `dental_clinic`. Applying them is a team/Owner decision; this document is the input for it.

## Read-only preflight (2026-10-13, `SELECT` only)

| Check | Result | Matters for |
| --- | --- | --- |
| Database size | 13 MB | backup time (seconds) |
| `documents` rows; duplicate `file_path` | 0; 0 | 2026_10_12 unique index |
| PayMongo `payments` with a provider reference; duplicates | 0; 0 | 2026_10_14 partial unique index |
| `invoices` rows | 0 | 2026_10_14 constraints (added `NOT VALID`) |
| `audit_logs` rows | 40 | 2026_10_13 append-only trigger (existing rows untouched) |
| `patients` rows | 4 | 2026_10_11 new columns |
| `sessions` rows | 87 | 2026_10_09 forces every session to sign in again |

No preflight condition blocks the migrations on today's data.

## The nine migrations

| Migration | Effect | Depends on | Rollback (`down`) |
| --- | --- | --- | --- |
| `2026_10_09_000100_add_auth_version_to_users` | Adds `users.auth_version` (default 0). Every existing session has no version, so **everyone must sign in again**. Required by the account-status, invitation-acceptance and password code that already runs. | users | **None (forward-only)**: removing it would revive stale sessions. |
| `2026_10_10_000100_add_branch_public_identity` | Adds `branches.public_id` (ULID), backfills one per branch, then makes it NOT NULL and unique. Branch public references (M2, M21 filters) need it. | branches | **None (forward-only)**: public ids must survive once issued. |
| `2026_10_11_000100_add_patient_record_fields` | Adds `patients.revision` (default 1), `emergency_contact`, `preferred_branch_id` (FK, RESTRICT). | patients, branches | Drops the three columns — **any values entered are lost**. |
| `2026_10_12_000100_harden_document_integrity` | Unique `documents.file_path`; Patient FKs on documents/consents change from CASCADE to RESTRICT (a Patient with documents can no longer be deleted). | documents, patient_consents | Restores CASCADE and drops the unique index (reintroduces silent deletion). |
| `2026_10_13_000100_enforce_audit_log_append_only` | Trigger function + triggers forbidding UPDATE/DELETE/TRUNCATE on `audit_logs` (except the FK `SET NULL` when an account row is removed). | audit_logs | Drops the triggers; existing rows unchanged. |
| `2026_10_14_000100_harden_m11_payment_integrity` | Creates `payment_checkout_sessions` and `payment_provider_events`; a partial unique index on PayMongo payment references; amount/settlement CHECKs added `NOT VALID` (existing rows are not re-checked). | invoices, payments, receipts, users | Drops both tables and the constraints — **recorded checkout sessions and provider events are lost**. |
| `2026_10_15_000100_create_inquiry_tables` | Creates `inquiries` and append-only `inquiry_history` with guard triggers. | branches, users, patients, appointments | Drops both tables — **inquiry records are lost**. |
| `2026_10_16_000100_create_messaging_tables` | Creates `conversations`, `conversation_participants`, immutable `conversation_messages` with guard triggers. | patients, branches, users | Drops the tables — **messages are lost**. |
| `2026_10_17_000100_create_patient_feedback_table` | Creates immutable `patient_feedback`. | patients, visits | Drops the table — **feedback is lost**. |
| `2026_10_18_000100_create_mail_dispatch_tables` (added 2026-10-13, M18) | Creates `mail_dispatches` and append-only `mail_dispatch_attempts`. | users | Drops both tables — **send history is lost**. |

Order matters only through the listed dependencies; `php artisan migrate` runs them in filename order, each in its own transaction (PostgreSQL DDL is transactional), so a failing migration leaves the earlier ones applied and itself rolled back.

## Required before applying

1. **Backup** — a full logical dump, verified by restoring it into a scratch database:
   `pg_dump -Fc -d dental_clinic -f dental_clinic_YYYYMMDD_HHMM.dump` then `createdb dental_clinic_restore_check && pg_restore -d dental_clinic_restore_check dental_clinic_YYYYMMDD_HHMM.dump`.
2. Stop the API (and any queue worker) so no request writes during the migration.
3. `php artisan migrate --pretend` against `dental_clinic` to review the SQL, then `php artisan migrate` (never `migrate:fresh`, `migrate:refresh`, `db:wipe` or seeders).
4. Tell users they will be signed out (2026_10_09).

## Rollback limits

Three migrations are forward-only and several `down` methods delete data (table above). The dependable rollback is **restoring the backup**, not `migrate:rollback`. A restore discards anything written after the backup.
