# FINAL DATABASE SCHEMA HANDOFF — MULTIBRANCH DENTAL CLINIC OPERATIONS PLATFORM

**Date:** October 26, 2026<br>
**Audience:** Joevan (Hosted Database Administrator / Supabase Lead), Backend Development Team, Project Defense Panel<br>
**System Target:** Hosted Supabase (PostgreSQL 15+) / Railway (Laravel 13 API) / Vercel (React/Vite Frontend)<br>
**Status:** Authoritative Post-Audit Baseline (Covers all 83 Migrations)<br>

---

## 1. Executive Summary & Evidence-Based Schema Metrics

This document serves as the **authoritative database handoff package** for the Dr. Dana E. Roxas Dental Clinic Operations System. It provides Joevan, as the database administrator managing the hosted Supabase PostgreSQL instance, with a complete, internally consistent specification of the intended final database architecture.

### 1.1 Evidence Categorization Standard
To prevent ambiguity between code repository facts, local testing evidence, and hosted cloud infrastructure, all claims in this document follow these strict evidence standards:
* **[Verified from project source]:** Directly confirmed by inspecting migration files, Eloquent models, controllers, and services in `backend/`.
* **[Verified in local test environment]:** Confirmed via local `dental_clinic_test` test runs and migration status.
* **[Reported by project owner]:** Status communicated by the project owner but not independently verified on the remote database.
* **[Not verified on hosted Supabase]:** Status must be verified by Joevan using the provided read-only SQL scripts.
* **[Pending / unresolved]:** Implementation or approval is incomplete.

### 1.2 Audited Schema Metrics Summary

All metrics below are derived from static source inspection of `backend/database/migrations/`. Exact metrics are backed by line-level migration evidence in the Data Dictionary; figures that depend on database engine catalog resolution are explicitly designated as **ESTIMATED**.

| Metric | Stated Value | Metric Nature | Methodology & Source Evidence |
| :--- | :---: | :---: | :--- |
| **Total Migration Files** | **83** | **EXACT** | Filesystem count of ordered migration files in `backend/database/migrations/` (from `0000_01_01_000000` to `2026_11_16_000200`). |
| **Distinct Tables Created in History** | **92** | **EXACT** | Unique table names declared across all `Schema::create()` statements in migrations 1–83. Zero tables were recreated or renamed. |
| **Tables Subsequently Dropped** | **1** | **EXACT** | Exactly 1 table dropped in `up()`: `patient_feedback` (dropped in migration 76: `2026_11_10_000100_remove_patient_feedback_table.php`). |
| **Intended Active Tables** | **91** | **EXACT** | Canonical active table count: `92 unique created - 1 dropped = 91 active tables`. |
| **— Application Domain Tables** | **83** | **EXACT** | Clinical, financial, scheduling, administrative, and patient portal tables. |
| **— Framework Infrastructure Tables**| **8** | **EXACT** | Laravel/Sanctum framework tables (`password_reset_tokens`, `sessions`, `personal_access_tokens`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`). |
| **Total Documented Columns** | **1,111** | **EXACT** | Distinct physical column definitions in the intended final schema across all 91 canonical tables, after applying migration-created columns, later additions and alterations, and documented drops (exhaustively documented in `FINAL-ERD-DICTIONARY.md`). Excludes Markdown headers, separator rows, descriptions, constraint notes, and relationship notes. |
| **Migration-Defined Triggers** | **44** | **EXACT** | Net active triggers defined in migrations after dropping patient_feedback_no_update_delete in migration 76 (45 created in up() minus 1 dropped = 44 active). |
| **Trigger-Protected Distinct Tables** | **40** | **EXACT** | Exactly 40 unique tables protected by the 44 triggers (4 tables have overlapping multiple triggers: udit_logs, loyalty_ledger, loyalty_lot_consumptions, 	reatments). (Earlier unverified count of 49 across 45 included 5 design proposals). |
| **Foreign Key Constraints (FK)** | **~232** | **ESTIMATED** | Static estimate of foreign key constraint definitions. Exact count on hosted PostgreSQL depends on naming and composite cascade catalog entries. |
| **Unique Constraints & Indexes (UK)**| **~106** | **ESTIMATED** | Static estimate combining single-column unique constraints, composite unique constraints, and raw `CREATE UNIQUE INDEX` statements. |
| **Check Constraints (CHECK)** | **~125** | **ESTIMATED** | Net active check constraints defined via `ADD CONSTRAINT ... CHECK` after accounting for constraints dropped and re-added across migrations. |
| **Plain Secondary Indexes (INDEX)** | **~58** | **ESTIMATED** | Static estimate of plain lookup indexes defined via `$table->index()` and raw `CREATE INDEX` (excluding primary and unique keys). |

--- | :---: | :---: | :--- |
| **Total Migration Files** | **83** | Verified from project source | Sequential directory count of `backend/database/migrations/` (from `0000_01_01_000000` to `2026_11_16_000200`). |
| **Tables Created in History** | **92** | Verified from project source | Total unique tables created via `Schema::create()` across migrations 1–83. |
| **Tables Subsequently Dropped** | **1** | Verified from project source | Exactly 1 table dropped in `up()`: `patient_feedback` (dropped in migration 76: `2026_11_10_000100_remove_patient_feedback_table.php`). |
| **Active Application Tables** | **91** | Verified from project source | Calculated as `92 created - 1 dropped = 91 active tables`. |
| **— Application Domain Tables** | **83** | Verified from project source | Core clinical, financial, administrative, and communication tables. |
| **— Framework Infrastructure Tables**| **8** | Verified from project source | Laravel/Sanctum framework tables (`password_reset_tokens`, `sessions`, `personal_access_tokens`, `cache`, `cache_locks`, `jobs`, `job_batches`, `failed_jobs`). |
| **Total Documented Columns** | **1,111** | Verified from project source [EXACT] | Distinct physical column definitions in the intended final schema across all 91 canonical tables, after applying migration-created columns, later additions and alterations, and documented drops (exhaustively documented in `FINAL-ERD-DICTIONARY.md`). Excludes Markdown headers, separator rows, descriptions, constraint notes, and relationship notes. |
| **Migration-Defined Triggers** | **44** | Verified from project source | Static count of distinct net active CREATE TRIGGER statements across all active migrations. |
| **Trigger-Guarded Tables** | **40** | Verified from project source | 40 unique tables protected by 44 triggers (4 tables have overlapping multiple triggers). |
| **Foreign Key Constraints (FK)** | **226–245** | Static Source Estimate | 226 FKs in base column definitions; up to 245 including alter table references and composite cascades. |
| **Unique Constraints / Indexes (UK)**| **86–106** | Static Source Estimate | 86 single-column unique constraints; up to 106 including composite keys and partial unique indexes. |
| **Check Constraints (CHECK)** | **125–164** | Static Source Estimate | Enforces status enumerations, channel values, money bounds, and operating schedules. |
| **Plain Secondary Indexes (INDEX)** | **58–71** | Static Source Estimate | Secondary lookup indexes defined across migration files. |

---

## 2. Date Discrepancy & Future-Dated Migration Filenames

### 2.1 Audit Date vs. Migration Timestamps
* **Documented Audit Date:** October 26, 2026 (Asia/Manila local time).
* **Future-Dated Migrations in Repository:** Exactly **28 migration files** (files #56 through #83) bear filename timestamp prefixes dated **after** the October 26, 2026 audit date:
  * Migrations 56–59: Dated October 27, 2026 (`2026_10_27_...`)
  * Migrations 60–64: Dated October 28, 2026 (`2026_10_28_...`)
  * Migrations 65–67: Dated October 29, 2026 (`2026_10_29_...`)
  * Migrations 68–70: Dated October 30, 2026 (`2026_10_30_...`)
  * Migrations 71–73: Dated October 31, 2026 (`2026_10_31_...`)
  * Migration 74: Dated November 1, 2026 (`2026_11_01_...`)
  * Migration 75: Dated November 2, 2026 (`2026_11_02_...`)
  * Migration 76: Dated November 10, 2026 (`2026_11_10_...`)
  * Migrations 77–81: Dated November 15, 2026 (`2026_11_15_...`)
  * Migrations 82–83: Dated November 16, 2026 (`2026_11_16_...`)

### 2.2 Distinguishing Repository, Local, Reported, and Hosted Realities
To maintain complete integrity, the release gate strictly distinguishes between these four states:
1. **Repository Files:** All 83 migration files physically exist in `backend/database/migrations/`. Future timestamp prefixes are a possible explanation (e.g., forward-dated sprint milestone identifiers), but this convention has not been formally confirmed by the project owner. Changing the filename of a migration that has already run can cause Laravel to treat the renamed file as a different, pending migration because the recorded name in the `migrations` table no longer matches. Depending on the migration, re-execution may fail or cause unintended schema changes. Therefore, do not rename applied migrations without a reviewed migration-history and deployment plan.
2. **Local Test Environment (`dental_clinic_test`):** Migration 83 is recorded as `Ran` in local `dental_clinic_test`; its hosted Supabase status remains unverified.
3. **Owner-Reported Production Status:** Migration 77's production status remains owner-reported (`2026_11_15_000100_add_archive_columns_to_core_tables.php` was communicated by the owner as already applied on production `dental_clinic`), not independently verified by this static audit. This introduces a known date contradiction (a file dated November 15 reported applied on or before October 26), which is flagged as unverified on hosted Supabase.
4. **Hosted Supabase Deployment Status:** **Unverified.** Neither production `dental_clinic` nor hosted Supabase was connected to, queried, or inspected during this audit. Joevan must independently verify which migrations have been applied using the provided read-only verification queries.

---
## 3. Non-Negotiable Operational Rules for Joevan

### Rule 1: Never Execute Destructive SQL on Production / Demo
* **Prohibited Statements:** Never run `DROP TABLE`, `DROP COLUMN`, `TRUNCATE`, or unconstrained `DELETE` statements on `dental_clinic` or `dental_clinic_demo`.
* **Historical Schema Drop Exception:** The only dropped table in the system history is `patient_feedback` (dropped via migration 76). The only dropped column is `middle_name` from `persons` (dropped via migration 15).
* **Do Not Recreate Dropped Objects:** Do not recreate `patient_feedback` on Supabase.

### Rule 2: Multi-Tiered Retention & Physical Deletion Boundaries
Blanket claims of "zero physical deletions across the entire database" are technically inaccurate. The system employs **six distinct retention mechanisms**:
1. **Eloquent Soft Deletes:** Table `users` uses Laravel's `SoftDeletes` trait via `deleted_at`. Calling `$user->delete()` performs an update setting `deleted_at = now()`, NOT a physical row deletion.
2. **Role-Scoped Archive Metadata (GEN-11):** Tables `invoices`, `visits`, `prescriptions`, and `user_notifications` contain `archived_at` (`TIMESTAMPTZ`), `archived_by_user_id` (`BIGINT FK -> users.id`), and `archive_reason` (`TEXT`). *(Note: Archive columns do NOT exist on every table; they are implemented specifically on these 4 core tables).*
3. **Status-Based Lifecycles:** Primary business entities use non-destructive status transitions (e.g., `appointments.status` -> `'cancelled'`, `visits.status` -> `'completed'`, `invoices.status` -> `'void'`).
4. **PostgreSQL Immutability Triggers:** 40 tables are protected by 44 database-level triggers blocking unauthorized `UPDATE` or `DELETE` operations.
5. **Physical Deletions in Backend Code:** A static audit of `backend/app/` identified 20 intentional physical delete operations strictly limited to:
   * Ephemeral authentication sessions: `DB::table('sessions')->delete()`
   * Ephemeral API tokens: `$user->tokens()->delete()` (`personal_access_tokens`)
   * Ephemeral password tokens: `DB::table('password_reset_tokens')->delete()`
   * Scope re-synchronization: `UserBranchScope::whereNotIn(...)->delete()`
   * Unfinalized draft lines: Draft prescription lines before doctor signing (`$p->lines()->delete()`) and unkept draft treatment procedure lines before completion (`$existing->reject(...)->delete()`). Once finalized, triggers block all modifications.
   * Administrative backfill rollbacks: In `QueueBackfill` and `VisitBackfill` command rollback routines.
   * Settings reset: Removing custom override rows in `clinic_settings` when reverting to system default.
   * Disk files: Deleting orphaned storage files via `$disk->delete()`.
6. **Historical Schema Drops:** Dropping `patient_feedback` table (migration 76) and `middle_name` column (migration 15).

### Rule 3: Archive Migration Deployment Status (Migration 77)
* Migration 77 (`2026_11_15_000100_add_archive_columns_to_core_tables.php`) is **[Reported by project owner]** as already applied on production `dental_clinic`.
* **[Not verified on hosted Supabase]:** Joevan must independently confirm its presence using Query 4 below before running subsequent migrations.
* **DO NOT** re-run, modify, or roll back migration 77.
* Any future role tracking (`archived_by_role`) must be implemented via a **NEW, separate additive migration** with nullable columns.

### Rule 4: GEN-05 Kiosk Self-Registration Removal Protocol (Migration 83)
* Migration 83 (`2026_11_16_000200_remove_kiosk_channel_from_intake_submissions.php`) removed the kiosk self-registration channel.
* **Status:** **[Verified in local test environment]**; **[Not verified on hosted Supabase]**.
* **Pre-Migration Assertion Guard:** The migration executes a preflight count check:
  ```php
  $kioskCount = DB::table('intake_submissions')->where('channel', 'kiosk')->count();
  if ($kioskCount > 0) {
      throw new \RuntimeException("Cannot remove 'kiosk' channel: $kioskCount existing submissions found.");
  }
  ```
* Before running migration 83 on Supabase, Joevan must verify `SELECT count(*) FROM public.intake_submissions WHERE channel = 'kiosk';` returns `0`.
* The updated check constraint strictly enforces: `CHECK (channel IN ('phone', 'account'))`.

### Rule 5: STF-04 Scope Boundary & Other Details Status
* In `CounterIntake.jsx`, the receptionist counter form provides an "Other valid ID" text field (`other_details`).
* **Current Status:** **[Pending / unresolved]**; recorded in QA backlog as **Partial / In Progress**.
* **Architecture Clarification:** Backend request validation and database persistence for `other_details` have **not** been implemented. This missing persistence is an incomplete implementation item awaiting client/team schema approval, **NOT** an intentional final design decision.
* **Instruction for Joevan:** Do **not** add an `other_details` column to `intake_submissions` or `patients` as if it were approved. Keep STF-04 strictly separated from the approved GEN-05 kiosk removal.

### Rule 6: Database Trigger Precedence & Overlap Analysis
* The database contains **44 triggers** protecting **40 distinct tables**.
* The trigger count (44) does not equal the table count (40) because **4 tables have multiple overlapping triggers**:
  1. `audit_logs` (2 triggers): `audit_logs_no_update_delete` (Blocks UPDATE/DELETE) + `audit_logs_no_truncate` (Blocks TRUNCATE).
  2. `loyalty_ledger` (2 triggers): `loyalty_ledger_append_only` (Blocks UPDATE/DELETE) + `check_ledger_reversal_limit` (Validates reversals on INSERT).
  3. `loyalty_lot_consumptions` (2 triggers): `loyalty_lot_consumptions_append_only` (Blocks UPDATE/DELETE) + `check_lot_consumption_limit` (Validates limits on INSERT).
  4. `treatments` (2 triggers): `treatments_completed_read_only` (Blocks UPDATE/DELETE once completed) + `treatments_visit_consistency` (Relational check with visits).
* Database triggers take precedence over application code. Bulk maintenance scripts must respect these triggers.

---

### Rule 7: Cautious Deployment Protocol for Pending Migrations
Joevan must NOT apply migrations 77 through 83 as an uninspected blanket operation. Follow this five-step protocol:
1. **Inspect Actual Hosted Migration State:** Execute read-only verification queries (Queries 1–5 below) to audit which migrations have actually run on Supabase and confirm existing schema state.
2. **Compare Pending Migrations Individually:** Review each pending migration's filename, prerequisites, schema changes, and rollback functions individually before running it.
3. **Verify Preconditions for Migration 83 (GEN-05):** Before applying migration 83 (2026_11_16_000200_remove_kiosk_channel_from_intake_submissions.php), run Query 3A (SELECT count(*) FROM public.intake_submissions WHERE channel = 'kiosk';) to ensure zero kiosk rows exist. If kiosk rows exist, migration 83 will abort with a RuntimeException.
4. **Treat Migration 77 Status Respectfully but Unverified:** Respect the owner-reported status of migration 77 (2026_11_15_000100_add_archive_columns_to_core_tables.php), but do not assume it has been applied until Query 4 independently confirms the presence of rchived_at, rchived_by_user_id, and rchive_reason across invoices, isits, prescriptions, and user_notifications.
5. **Apply Only Individually Reviewed, Approved Migrations:** Apply pending migrations forward-only in strict chronological order through the established deployment process. Never claim the hosted database is synchronized or corrected until verification queries confirm each change.

---

## 4. Trigger Classification Matrix (44 Triggers across 40 Tables)

| Classification Category | Trigger Count | Distinct Tables | Protected Tables List |
| :--- | :---: | :---: | :--- |
| **Strict Append-Only**<br>*(Unconditionally blocks `UPDATE` & `DELETE`)* | 21 | 21 | `appointment_history`, `appointment_responses`, `audit_logs`, `automation_deliveries`, `conversation_messages`, `hmo_case_events`, `hmo_case_requirements`, `inquiry_history`, `invoice_histories`, `invoice_refunds`, `loyalty_ledger`, `loyalty_lot_consumptions`, `mail_dispatch_attempts`, `patient_hmo_memberships`, `payments`, `queue_entry_history`, `receipts`, `service_prices`, `tooth_chart_entries`, `treatment_history`, `visit_history` |
| **No-Delete Guard**<br>*(Blocks `DELETE`, permits audited `UPDATE`)* | 9 | 9 | `accepted_hmos`, `automation_settings`, `branch_closures`, `dentist_schedule_exceptions`, `dentist_schedules`, `followup_tasks`, `leave_requests`, `message_templates`, `patient_handovers` |
| **Conditional / Lifecycle Immutability**<br>*(Blocks edits once finalized/closed)* | 9 | 9 | `conversations`, `inquiries`, `no_show_flags`, `patient_guardians`, `prescriptions`, `slot_offers`, `slot_openings`, `treatments`, `waitlist_entries` |
| **Insert Limit Guards**<br>*(Validates business bounds on `INSERT`)* | 5 | 5 | `hmo_cases`, `loyalty_ledger`, `loyalty_lot_consumptions`, `prescription_lines`, `treatment_procedures` |
| **Relational Consistency Guards**<br>*(Cross-table deferred constraint check)* | 2 | 2 | `treatments` (`treatments_visit_consistency`), `visits` (`visits_treatment_consistency`) |
| **Column Immutability Guard**<br>*(Blocks changes to specific column)* | 1 | 1 | `appointments` (`appointments_code_immutable` on `appointment_code`) |
| **Update Guard**<br>*(Conditional checks on participant updates)* | 1 | 1 | `conversation_participants` (`conversation_participants_guard`) |
| **No-Truncate Guard**<br>*(Blocks table `TRUNCATE`)* | 1 | 1 | `audit_logs` (`audit_logs_no_truncate`) |

*(Total Unique Tables Protected: Exactly 40 Tables; earlier figure of 45 tables/49 triggers included 5 design-proposal triggers not implemented in migrations).*

---

## 5. Hosted Supabase Pre-Flight Verification Script

Joevan must execute the following **read-only** SQL queries on the hosted Supabase instance to verify alignment with the repository baseline.

### Query 1: Canonical Application Tables Inventory & Physical Base Table Reconciliation
* **What it proves:** Verifies that all 91 canonical application and framework tables exist in schema public via an explicit allowlist, identifies Laravel's internal migrations repository table, and separates any unexpected or extension-created base tables.
* **Context & Expected Baseline:**
  - **Canonical Application Schema (Migrations 1–83):** Exactly **91 active tables** (83 domain tables + 8 framework infrastructure tables).
  - **Laravel Migration Repository:** Exactly **1 table** (migrations, created automatically by Laravel framework runtime on first migration).
  - **Physical Database Count:** Exactly **92 physical base tables** in an ordinary migrated database (91 canonical + 1 migrations).
  - **Hosted Supabase Status:** **[Not verified on hosted Supabase]**. Do not assume the remote hosted database matches local test counts until Joevan runs this query. Additional extension tables (e.g. spatial_ref_sys from PostGIS) will appear as unexpected_or_extension_tables and are cleanly excluded from the canonical count.
* **Expected Query Results:**
  - canonical_tables_found = 91
  - domain_tables_found = 83
  - framework_tables_found = 8
  - missing_canonical_tables = 0
  - migration_repository_found = 1
  - unexpected_or_extension_tables = 0 (or N if extensions like PostGIS are installed)
  - total_physical_base_tables = 92 (or 92 + N if extension tables exist)
  - Query 1C returns **0 rows** (true discrepancy check: no missing canonical tables and no unexpected extra tables; expected presence of migrations repository table is verified separately via Query 1B).

```sql
-- ============================================================================
-- 1A. Canonical Catalog CTE & Physical Base Table Classification
-- Lists all public base tables and classifies them against the 91 canonical allowlist.
-- ============================================================================
WITH canonical_catalog(table_name, expected_subsystem) AS (
  VALUES
    -- 8 Framework Infrastructure Tables
    ('cache', 'Framework Infrastructure'),
    ('cache_locks', 'Framework Infrastructure'),
    ('failed_jobs', 'Framework Infrastructure'),
    ('job_batches', 'Framework Infrastructure'),
    ('jobs', 'Framework Infrastructure'),
    ('password_reset_tokens', 'Framework Infrastructure'),
    ('personal_access_tokens', 'Framework Infrastructure'),
    ('sessions', 'Framework Infrastructure'),
    -- 83 Application Domain Tables
    ('accepted_hmos', 'Application Domain'),
    ('account_claim_invites', 'Application Domain'),
    ('appointment_command_keys', 'Application Domain'),
    ('appointment_history', 'Application Domain'),
    ('appointment_responses', 'Application Domain'),
    ('appointments', 'Application Domain'),
    ('assistant_answers', 'Application Domain'),
    ('assistant_usage', 'Application Domain'),
    ('audit_logs', 'Application Domain'),
    ('automated_actions', 'Application Domain'),
    ('automation_deliveries', 'Application Domain'),
    ('automation_settings', 'Application Domain'),
    ('branch_closures', 'Application Domain'),
    ('branch_join_codes', 'Application Domain'),
    ('branch_services', 'Application Domain'),
    ('branches', 'Application Domain'),
    ('clinic_settings', 'Application Domain'),
    ('command_keys', 'Application Domain'),
    ('conversation_messages', 'Application Domain'),
    ('conversation_participants', 'Application Domain'),
    ('conversations', 'Application Domain'),
    ('dentist_branches', 'Application Domain'),
    ('dentist_profiles', 'Application Domain'),
    ('dentist_queues', 'Application Domain'),
    ('dentist_schedule_exceptions', 'Application Domain'),
    ('dentist_schedules', 'Application Domain'),
    ('dentist_service_assignments', 'Application Domain'),
    ('document_extractions', 'Application Domain'),
    ('documents', 'Application Domain'),
    ('email_verification_otps', 'Application Domain'),
    ('followup_tasks', 'Application Domain'),
    ('hmo_case_events', 'Application Domain'),
    ('hmo_case_requirements', 'Application Domain'),
    ('hmo_cases', 'Application Domain'),
    ('inquiries', 'Application Domain'),
    ('inquiry_history', 'Application Domain'),
    ('intake_submissions', 'Application Domain'),
    ('invoice_histories', 'Application Domain'),
    ('invoice_lines', 'Application Domain'),
    ('invoice_refunds', 'Application Domain'),
    ('invoices', 'Application Domain'),
    ('leave_requests', 'Application Domain'),
    ('loyalty_accounts', 'Application Domain'),
    ('loyalty_ledger', 'Application Domain'),
    ('loyalty_lot_consumptions', 'Application Domain'),
    ('m11_billing_cutovers', 'Application Domain'),
    ('mail_dispatch_attempts', 'Application Domain'),
    ('mail_dispatches', 'Application Domain'),
    ('message_templates', 'Application Domain'),
    ('no_show_flags', 'Application Domain'),
    ('patient_consents', 'Application Domain'),
    ('patient_guardians', 'Application Domain'),
    ('patient_handovers', 'Application Domain'),
    ('patient_hmo_memberships', 'Application Domain'),
    ('patients', 'Application Domain'),
    ('payment_checkout_sessions', 'Application Domain'),
    ('payment_provider_events', 'Application Domain'),
    ('payments', 'Application Domain'),
    ('persons', 'Application Domain'),
    ('prescription_counters', 'Application Domain'),
    ('prescription_lines', 'Application Domain'),
    ('prescriptions', 'Application Domain'),
    ('queue_entries', 'Application Domain'),
    ('queue_entry_history', 'Application Domain'),
    ('receipts', 'Application Domain'),
    ('referrals', 'Application Domain'),
    ('service_prices', 'Application Domain'),
    ('services', 'Application Domain'),
    ('slot_offers', 'Application Domain'),
    ('slot_openings', 'Application Domain'),
    ('staff_profiles', 'Application Domain'),
    ('system_events', 'Application Domain'),
    ('tooth_chart_entries', 'Application Domain'),
    ('treatment_history', 'Application Domain'),
    ('treatment_procedures', 'Application Domain'),
    ('treatments', 'Application Domain'),
    ('user_branch_scopes', 'Application Domain'),
    ('user_notifications', 'Application Domain'),
    ('users', 'Application Domain'),
    ('visit_history', 'Application Domain'),
    ('visits', 'Application Domain'),
    ('waitlist_entries', 'Application Domain'),
    ('workflow_rules', 'Application Domain')
),
public_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
)
SELECT
  p.table_name,
  CASE
    WHEN c.table_name IS NOT NULL THEN c.expected_subsystem
    WHEN p.table_name = 'migrations' THEN 'Laravel Migration Repository'
    ELSE 'Unexpected / Extension Table'
  END AS subsystem_classification
FROM public_tables p
LEFT JOIN canonical_catalog c ON p.table_name = c.table_name
ORDER BY subsystem_classification, p.table_name;

-- ============================================================================
-- 1B. Reconciled Count Audit (Strictly Allowlist-Driven)
-- Computes canonical counts from the allowlist; isolates repository & extensions.
-- ============================================================================
WITH canonical_catalog(table_name, expected_subsystem) AS (
  VALUES
    ('cache', 'Framework Infrastructure'), ('cache_locks', 'Framework Infrastructure'),
    ('failed_jobs', 'Framework Infrastructure'), ('job_batches', 'Framework Infrastructure'),
    ('jobs', 'Framework Infrastructure'), ('password_reset_tokens', 'Framework Infrastructure'),
    ('personal_access_tokens', 'Framework Infrastructure'), ('sessions', 'Framework Infrastructure'),
    ('accepted_hmos', 'Application Domain'), ('account_claim_invites', 'Application Domain'),
    ('appointment_command_keys', 'Application Domain'), ('appointment_history', 'Application Domain'),
    ('appointment_responses', 'Application Domain'), ('appointments', 'Application Domain'),
    ('assistant_answers', 'Application Domain'), ('assistant_usage', 'Application Domain'),
    ('audit_logs', 'Application Domain'), ('automated_actions', 'Application Domain'),
    ('automation_deliveries', 'Application Domain'), ('automation_settings', 'Application Domain'),
    ('branch_closures', 'Application Domain'), ('branch_join_codes', 'Application Domain'),
    ('branch_services', 'Application Domain'), ('branches', 'Application Domain'),
    ('clinic_settings', 'Application Domain'), ('command_keys', 'Application Domain'),
    ('conversation_messages', 'Application Domain'), ('conversation_participants', 'Application Domain'),
    ('conversations', 'Application Domain'), ('dentist_branches', 'Application Domain'),
    ('dentist_profiles', 'Application Domain'), ('dentist_queues', 'Application Domain'),
    ('dentist_schedule_exceptions', 'Application Domain'), ('dentist_schedules', 'Application Domain'),
    ('dentist_service_assignments', 'Application Domain'), ('document_extractions', 'Application Domain'),
    ('documents', 'Application Domain'), ('email_verification_otps', 'Application Domain'),
    ('followup_tasks', 'Application Domain'), ('hmo_case_events', 'Application Domain'),
    ('hmo_case_requirements', 'Application Domain'), ('hmo_cases', 'Application Domain'),
    ('inquiries', 'Application Domain'), ('inquiry_history', 'Application Domain'),
    ('intake_submissions', 'Application Domain'), ('invoice_histories', 'Application Domain'),
    ('invoice_lines', 'Application Domain'), ('invoice_refunds', 'Application Domain'),
    ('invoices', 'Application Domain'), ('leave_requests', 'Application Domain'),
    ('loyalty_accounts', 'Application Domain'), ('loyalty_ledger', 'Application Domain'),
    ('loyalty_lot_consumptions', 'Application Domain'), ('m11_billing_cutovers', 'Application Domain'),
    ('mail_dispatch_attempts', 'Application Domain'), ('mail_dispatches', 'Application Domain'),
    ('message_templates', 'Application Domain'), ('no_show_flags', 'Application Domain'),
    ('patient_consents', 'Application Domain'), ('patient_guardians', 'Application Domain'),
    ('patient_handovers', 'Application Domain'), ('patient_hmo_memberships', 'Application Domain'),
    ('patients', 'Application Domain'), ('payment_checkout_sessions', 'Application Domain'),
    ('payment_provider_events', 'Application Domain'), ('payments', 'Application Domain'),
    ('persons', 'Application Domain'), ('prescription_counters', 'Application Domain'),
    ('prescription_lines', 'Application Domain'), ('prescriptions', 'Application Domain'),
    ('queue_entries', 'Application Domain'), ('queue_entry_history', 'Application Domain'),
    ('receipts', 'Application Domain'), ('referrals', 'Application Domain'),
    ('service_prices', 'Application Domain'), ('services', 'Application Domain'),
    ('slot_offers', 'Application Domain'), ('slot_openings', 'Application Domain'),
    ('staff_profiles', 'Application Domain'), ('system_events', 'Application Domain'),
    ('tooth_chart_entries', 'Application Domain'), ('treatment_history', 'Application Domain'),
    ('treatment_procedures', 'Application Domain'), ('treatments', 'Application Domain'),
    ('user_branch_scopes', 'Application Domain'), ('user_notifications', 'Application Domain'),
    ('users', 'Application Domain'), ('visit_history', 'Application Domain'),
    ('visits', 'Application Domain'), ('waitlist_entries', 'Application Domain'),
    ('workflow_rules', 'Application Domain')
),
public_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
)
SELECT
  -- 1. Canonical tables verified present in public schema (Expected: 91)
  - canonical_tables_found = 91

  -- 2. Domain tables verified present (Expected: 83)
  - domain_tables_found = 83

  -- 3. Framework tables verified present (Expected: 8)
  - framework_tables_found = 8

  -- 4. Missing canonical tables (Expected: 0)
  - missing_canonical_tables = 0

  -- 5. Laravel migrations repository table (Expected: 1)
  - migration_repository_found = 1

  -- 6. Unexpected extra tables in public schema (e.g. spatial_ref_sys from PostGIS)
  - unexpected_or_extension_tables = 0 (or N if extensions like PostGIS are installed)

  -- 7. Total physical base tables present in public schema (Expected: 92 in standard migrated installation)
  - total_physical_base_tables = 92 (or 92 + N if extension tables exist)
FROM canonical_catalog c
FULL OUTER JOIN public_tables p ON c.table_name = p.table_name;

-- ============================================================================
-- 1C. Discrepancy Gate: Missing Canonical or Unexpected Extra Tables
-- True Discrepancy Result: Excludes the expected 'migrations' table (which is
-- verified separately in Query 1B via migration_repository_found = 1).
-- Expected Result: Exactly 0 rows in a clean, complete installation.
-- Returns rows ONLY if canonical tables are missing or unexpected extra tables exist.
-- ============================================================================
WITH canonical_catalog(table_name, expected_subsystem) AS (
  VALUES
    ('cache', 'Framework Infrastructure'), ('cache_locks', 'Framework Infrastructure'),
    ('failed_jobs', 'Framework Infrastructure'), ('job_batches', 'Framework Infrastructure'),
    ('jobs', 'Framework Infrastructure'), ('password_reset_tokens', 'Framework Infrastructure'),
    ('personal_access_tokens', 'Framework Infrastructure'), ('sessions', 'Framework Infrastructure'),
    ('accepted_hmos', 'Application Domain'), ('account_claim_invites', 'Application Domain'),
    ('appointment_command_keys', 'Application Domain'), ('appointment_history', 'Application Domain'),
    ('appointment_responses', 'Application Domain'), ('appointments', 'Application Domain'),
    ('assistant_answers', 'Application Domain'), ('assistant_usage', 'Application Domain'),
    ('audit_logs', 'Application Domain'), ('automated_actions', 'Application Domain'),
    ('automation_deliveries', 'Application Domain'), ('automation_settings', 'Application Domain'),
    ('branch_closures', 'Application Domain'), ('branch_join_codes', 'Application Domain'),
    ('branch_services', 'Application Domain'), ('branches', 'Application Domain'),
    ('clinic_settings', 'Application Domain'), ('command_keys', 'Application Domain'),
    ('conversation_messages', 'Application Domain'), ('conversation_participants', 'Application Domain'),
    ('conversations', 'Application Domain'), ('dentist_branches', 'Application Domain'),
    ('dentist_profiles', 'Application Domain'), ('dentist_queues', 'Application Domain'),
    ('dentist_schedule_exceptions', 'Application Domain'), ('dentist_schedules', 'Application Domain'),
    ('dentist_service_assignments', 'Application Domain'), ('document_extractions', 'Application Domain'),
    ('documents', 'Application Domain'), ('email_verification_otps', 'Application Domain'),
    ('followup_tasks', 'Application Domain'), ('hmo_case_events', 'Application Domain'),
    ('hmo_case_requirements', 'Application Domain'), ('hmo_cases', 'Application Domain'),
    ('inquiries', 'Application Domain'), ('inquiry_history', 'Application Domain'),
    ('intake_submissions', 'Application Domain'), ('invoice_histories', 'Application Domain'),
    ('invoice_lines', 'Application Domain'), ('invoice_refunds', 'Application Domain'),
    ('invoices', 'Application Domain'), ('leave_requests', 'Application Domain'),
    ('loyalty_accounts', 'Application Domain'), ('loyalty_ledger', 'Application Domain'),
    ('loyalty_lot_consumptions', 'Application Domain'), ('m11_billing_cutovers', 'Application Domain'),
    ('mail_dispatch_attempts', 'Application Domain'), ('mail_dispatches', 'Application Domain'),
    ('message_templates', 'Application Domain'), ('no_show_flags', 'Application Domain'),
    ('patient_consents', 'Application Domain'), ('patient_guardians', 'Application Domain'),
    ('patient_handovers', 'Application Domain'), ('patient_hmo_memberships', 'Application Domain'),
    ('patients', 'Application Domain'), ('payment_checkout_sessions', 'Application Domain'),
    ('payment_provider_events', 'Application Domain'), ('payments', 'Application Domain'),
    ('persons', 'Application Domain'), ('prescription_counters', 'Application Domain'),
    ('prescription_lines', 'Application Domain'), ('prescriptions', 'Application Domain'),
    ('queue_entries', 'Application Domain'), ('queue_entry_history', 'Application Domain'),
    ('receipts', 'Application Domain'), ('referrals', 'Application Domain'),
    ('service_prices', 'Application Domain'), ('services', 'Application Domain'),
    ('slot_offers', 'Application Domain'), ('slot_openings', 'Application Domain'),
    ('staff_profiles', 'Application Domain'), ('system_events', 'Application Domain'),
    ('tooth_chart_entries', 'Application Domain'), ('treatment_history', 'Application Domain'),
    ('treatment_procedures', 'Application Domain'), ('treatments', 'Application Domain'),
    ('user_branch_scopes', 'Application Domain'), ('user_notifications', 'Application Domain'),
    ('users', 'Application Domain'), ('visit_history', 'Application Domain'),
    ('visits', 'Application Domain'), ('waitlist_entries', 'Application Domain'),
    ('workflow_rules', 'Application Domain')
),
public_tables AS (
  SELECT table_name
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_type = 'BASE TABLE'
)
SELECT
  COALESCE(c.table_name, p.table_name) AS table_name,
  CASE
    WHEN p.table_name IS NULL THEN 'MISSING CANONICAL TABLE (Action Required)'
    WHEN c.table_name IS NULL THEN 'UNEXPECTED / EXTENSION TABLE (Audit Required)'
  END AS audit_status
FROM canonical_catalog c
FULL OUTER JOIN public_tables p ON c.table_name = p.table_name
WHERE p.table_name IS NULL
   OR (c.table_name IS NULL AND p.table_name != 'migrations')
ORDER BY audit_status, table_name;
`
### Query 2: Decommissioned Feedback Table Check
* **What it proves:** Confirms that `patient_feedback` (dropped in migration 76) does not exist on Supabase.
* **Expected Result:** `ghost_feedback_table_count = 0`.
```sql
SELECT count(*) AS ghost_feedback_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'patient_feedback';
```

### Query 3: GEN-05 Kiosk Removal Preflight & Constraint Check
* **What it proves:** Confirms zero lingering kiosk records exist and checks whether the updated channel constraint is applied.
* **Expected Result (3A):** `existing_kiosk_rows = 0`.
* **Expected Result (3B):** `check_clause` matches `CHECK (channel IN ('phone', 'account'))`.
```sql
-- 3A. Preflight check before migration
SELECT count(*) AS existing_kiosk_rows
FROM public.intake_submissions
WHERE channel = 'kiosk';

-- 3B. Constraint definition inspection
SELECT conname AS constraint_name,
       pg_get_constraintdef(c.oid) AS check_clause
FROM pg_constraint c
JOIN pg_class t ON c.conrelid = t.oid
JOIN pg_namespace n ON t.relnamespace = n.oid
WHERE n.nspname = 'public'
  AND t.relname = 'intake_submissions'
  AND c.contype = 'c'
  AND conname LIKE '%channel%';
```

### Query 4: Core Archive Columns Inspection (Reports ALL 4 Tables)
* **What it proves:** Verifies that `archived_at`, `archived_by_user_id`, and `archive_reason` exist across all 4 target tables, even if a table has missing columns.
* **Expected Result:** Exactly 4 rows returned, all showing `true` for all three boolean columns and `archive_columns_found = 3`.
```sql
WITH expected_tables(table_name) AS (
  VALUES ('invoices'), ('visits'), ('prescriptions'), ('user_notifications')
)
SELECT e.table_name,
       COALESCE(bool_or(c.column_name = 'archived_at'), false) AS has_archived_at,
       COALESCE(bool_or(c.column_name = 'archived_by_user_id'), false) AS has_archived_by,
       COALESCE(bool_or(c.column_name = 'archive_reason'), false) AS has_archive_reason,
       count(c.column_name) AS archive_columns_found
FROM expected_tables e
LEFT JOIN information_schema.columns c
  ON c.table_schema = 'public'
 AND c.table_name = e.table_name
 AND c.column_name IN ('archived_at', 'archived_by_user_id', 'archive_reason')
GROUP BY e.table_name
ORDER BY e.table_name;
```

### Query 5: Trigger Catalog & Definition Inspection
* **What it proves:** Lists every non-internal trigger in schema `public` with its target table, events, and exact definition.
* **Expected Result:** 44 triggers across 40 tables (net active from migrations).
* **Limitations:** Verifying trigger existence confirms installation, but function behavior must be verified by inspecting the definition.
```sql
-- 5A. Distinct guarded table count (Expected: 40 net active migration-defined tables)
SELECT count(DISTINCT event_object_table) AS guarded_table_count
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name NOT LIKE 'RI_ConstraintTrigger%';

-- 5B. Exhaustive trigger catalog with definition
SELECT t.event_object_table AS table_name,
       t.trigger_name,
       t.action_timing,
       t.event_manipulation,
       pg_get_triggerdef(trg.oid) AS trigger_definition
FROM information_schema.triggers t
JOIN pg_class c ON c.relname = t.event_object_table
JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = t.trigger_schema
JOIN pg_trigger trg ON trg.tgrelid = c.oid AND trg.tgname = t.trigger_name
WHERE t.trigger_schema = 'public'
  AND NOT trg.tgisinternal
ORDER BY t.event_object_table, t.trigger_name;
```

---

## 6. Summary of Companion Documentation Suite

This handoff document is cross-referenced with four companion technical artifacts in the repository root:

1. **[`FINAL-ERD.md`](file:///c:/Users/Yzhe%20Yu/Desktop/multibranch-dental-clinic-feat-auth-messaging-paymongo/FINAL-ERD.md):** Complete entity-relationship diagrams written in standard Mermaid syntax, including a global domain overview and 12 modular subsystem diagrams covering all 91 tables.
2. **[`FINAL-ERD-DICTIONARY.md`](file:///c:/Users/Yzhe%20Yu/Desktop/multibranch-dental-clinic-feat-auth-messaging-paymongo/FINAL-ERD-DICTIONARY.md):** Exhaustive 91-table data dictionary detailing all 1,111 distinct physical schema columns, data types, nullability, defaults, keys, constraints, and trigger rules.
3. **[`FINAL-ERD-ALIGNMENT.md`](file:///c:/Users/Yzhe%20Yu/Desktop/multibranch-dental-clinic-feat-auth-messaging-paymongo/FINAL-ERD-ALIGNMENT.md):** Discrepancy analysis contrasting the actual 83-migration database against legacy documents (ERD v2 and `DATABASE_SCHEMA.md`), explaining resolution rules and deployment facts.
4. **[`FINAL-SCHEMA-CHANGE-REGISTER.md`](file:///c:/Users/Yzhe%20Yu/Desktop/multibranch-dental-clinic-feat-auth-messaging-paymongo/FINAL-SCHEMA-CHANGE-REGISTER.md):** Chronological log of all 83 migration files, affected tables, architectural intent, and production deployment status.

---
*Authored and audited by the Multibranch Dental Clinic Engineering Team.*<br>
*Ready for Joevan's hosted Supabase verification and final defense presentation.*
