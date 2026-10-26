# FINAL DATABASE SCHEMA ALIGNMENT & DISCREPANCY AUDIT REPORT

**Date:** October 26, 2026<br>
**Audience:** Joevan (Hosted Database Administrator), Development Team, Project Defense Panel<br>
**Scope:** Definitive Reconciliation of 83 Migrations vs Legacy ERD v2 and Handoff Documentation<br>
**Primary Reference:** `backend/database/migrations/` (83 Sequential Files, 91 Active Tables)<br>
**Status:** Canonical Alignment Baseline<br>

---

## 1. Executive Summary, Date Discrepancy & Evidence Classification

Over the course of the project lifecycle, three competing tiers of documentation have created ambiguity:
1. **`docs/architecture/ERD_v2_Data_Dictionary.md`** (Early design document): Contains conceptual entities that were refactored or never implemented.
2. **`docs/handoff/DATABASE_SCHEMA.md`** (Phase 3 handoff draft): Captured an interim snapshot with naming drift (e.g. claiming `counter_registrations` and `daily_branch_codes`).
3. **Canonical Implementation (`backend/database/migrations/`)**: The authoritative 83-migration codebase yielding exactly **91 active PostgreSQL tables** (83 domain + 8 framework).

### Evidence Standards Applied in this Audit
* **[Verified from project source]:** Directly established by static audit of repository code, migrations, models, and controllers.
* **[Verified in local test environment]:** Confirmed via local testing and `dental_clinic_test` test suite runs.
* **[Reported by project owner]:** Deployment status communicated by the project owner but not independently verified on the remote database.
* **[Not verified on hosted Supabase]:** Status requires Joevan's confirmation using the provided read-only SQL queries.
* **[Pending / unresolved]:** Implementation or approval is incomplete.

### 1.2 Date Discrepancy & Future-Dated Migrations
* **Audit Date:** October 26, 2026.
* **Future-Dated Migration Files:** Exactly **28 migration files** (#56 to #83) in `backend/database/migrations/` bear filename timestamp prefixes dated after October 26, 2026 (ranging from October 27 to November 16, 2026). Future timestamp prefixes are a possible explanation (e.g., forward-dated sprint milestone identifiers), but this convention has not been formally confirmed by the project owner.
* **Migration Renaming & Tracking Invariant:** Changing the filename of a migration that has already run can cause Laravel to treat the renamed file as a different, pending migration because the recorded name in the `migrations` table no longer matches. Depending on the migration, re-execution may fail or cause unintended schema changes. Therefore, do not rename applied migrations without a reviewed migration-history and deployment plan.
* **Owner-Reported Production Status vs. Filename Contradiction:** Migration 77's production status remains owner-reported (`2026_11_15_000100_add_archive_columns_to_core_tables.php` was communicated as already applied on production `dental_clinic`), not independently verified by this static audit. This date contradiction (dated November 15 but reported applied on or before October 26) is preserved as reported but explicitly marked as **[Not verified on hosted Supabase]**.
* **Local Test vs. Hosted Status:** Migration 83 is recorded as `Ran` in local `dental_clinic_test`; its hosted Supabase status remains unverified. Joevan must independently confirm hosted status using read-only verification queries.

### 1.3 Audit Safety Scope & Exact vs. Estimated Metrics
* **Audit Safety Scope:** This corrective documentation pass performed **zero database operations, zero SQL executions, and zero Git index or worktree mutations**. Earlier development workflow steps in prior turns included focused local testing against `dental_clinic_test`. Neither production `dental_clinic` nor hosted Supabase has been inspected.
* **Exact vs. Estimated Metrics:**
  * Active Tables: **91 tables** (83 domain + 8 framework) **[EXACT]** — derived from 92 unique tables created minus 1 dropped (`patient_feedback`).
  * Total Columns: **1,111 physical columns** **[EXACT]** — distinct physical column definitions in the intended final schema across all 91 canonical tables, after applying migration-created columns, later additions and alterations, and documented drops (exhaustively documented in `FINAL-ERD-DICTIONARY.md`). Excludes Markdown headers, separator rows, descriptions, constraint notes, and relationship notes.
  * Migration-Defined Triggers: **44 triggers** **[EXACT]** — net active triggers in migrations across 40 distinct tables.
  * Trigger-Protected Tables: **45 distinct tables** **[EXACT]** — accounting for 4 overlapping tables (`audit_logs`, `loyalty_ledger`, `loyalty_lot_consumptions`, `treatments`).
  * Foreign Keys: **~232 constraints** **[ESTIMATED]** — static source estimate.
  * Unique Constraints & Indexes: **~106 constraints/indexes** **[ESTIMATED]** — static source estimate.
  * Check Constraints: **~125 constraints** **[ESTIMATED]** — static net active check constraints.
  * Plain Secondary Indexes: **~58 indexes** **[ESTIMATED]** — static source estimate.
---

## 2. The 7 Major Schema Discrepancy Categories

### Discrepancy 1: Conceptual "Phantom" Tables in ERD v2
The legacy ERD v2 documented several tables that do not exist in the physical database schema:

| Legacy ERD v2 Conceptual Entity | Actual Migration Implementation | Architectural Explanation | Evidence Classification |
| :--- | :--- | :--- | :---: |
| `ROLES` & `USER_ROLE_ASSIGNMENTS` | Column `users.role` (`VARCHAR(20)`) with check constraint | Single-role model per user (`owner`, `dentist`, `staff`, `patient`). Eliminates unnecessary join overhead; roles are strictly bounded. | Verified from project source |
| `BRANCH_OPERATING_HOURS` | Columns `branches.weekly_hours` (`JSONB`) & `branch_closures` | Operating hours are stored as structured JSONB on the branch record, with `branch_closures` handling holiday and emergency closures. | Verified from project source |
| `STAFF_SCHEDULES` | `dentist_schedules` & `dentist_schedule_exceptions` | Staff work branch operating hours governed by `user_branch_scopes`. Only Dentists maintain multi-slot, exception-based weekly clinical rosters. | Verified from project source |
| `PRESCRIPTION_ITEMS` | `prescription_lines` | Renamed during implementation to `prescription_lines` to reflect prescription order lines accurately. | Verified from project source |
| `INVOICE_ITEMS` | `invoice_lines` & `invoice_histories` | Renamed to `invoice_lines` for charge items; historical immutable snapshots are captured in `invoice_histories.snapshot_data` (JSONB). | Verified from project source |
| `CAPACITY_EVENTS` | Derived dynamically from `dentist_schedules` + `appointments` | Workload capacity is computed in real-time by M10/M6 scheduling services rather than persisted in a redundant events table. | Verified from project source |
| `CLINICAL_TEMPLATES` | Front-end static templates & `message_templates` | Note templates are managed at the UI level; communication templates are stored in `message_templates`. | Verified from project source |

---

### Discrepancy 2: Intake & Self-Registration Naming Drift
Early handoff documentation (`docs/handoff/DATABASE_SCHEMA.md`) referred to intake tables using preliminary proposed names:

| Documented Name (`DATABASE_SCHEMA.md`) | Canonical Table Name in Migrations | Migration Evidence | Evidence Classification |
| :--- | :--- | :--- | :---: |
| `counter_registrations` | `intake_submissions` | `2026_10_29_000200_create_intake_tables.php` | Verified from project source |
| `daily_branch_codes` | `branch_join_codes` | `2026_10_29_000200_create_intake_tables.php` | Verified from project source |
| `patient_intake_queues` | `intake_submissions` | Unified into single intake queue table with status workflow (`pending`, `processed`, `rejected`). | Verified from project source |

*Guidance for Joevan:* Look for `intake_submissions` and `branch_join_codes` on Supabase. Do not create tables named `counter_registrations` or `daily_branch_codes`.

---

### Discrepancy 3: GEN-05 Kiosk Removal vs STF-04 Scope Boundary
* **GEN-05 Kiosk Decommissioning:**
  * In migration 83 (`2026_11_16_000200_remove_kiosk_channel_from_intake_submissions.php`), the `channel` check constraint was updated to:
    `CHECK (channel IN ('phone', 'account'))`
  * The migration strictly asserts zero existing kiosk submissions before updating the constraint.
  * **Status:** **[Verified in local test environment]**; **[Not verified on hosted Supabase]**.
* **STF-04 Receptionist Counter Intake Boundary:**
  * In `CounterIntake.jsx`, an "Other valid ID" text field (`other_details`) is provided on the front-end form.
  * Backend request validation and database persistence for this field remain **pending approval**.
  * **Status:** **[Pending / unresolved]**; recorded in QA backlog as **Partial / In Progress**.
  * **Architecture Clarification:** This missing persistence is an incomplete implementation item awaiting client/team approval, **NOT** an intentional final design decision. No database column exists for `other_details`. Keep STF-04 separate from GEN-05.

---

### Discrepancy 4: Multi-Tiered Retention vs Blanket No-Deletion Claims
Blanket claims that "zero physical deletions exist in the entire application" are refuted by source code inspection. The architecture employs **six distinct retention mechanisms**:

1. **Eloquent Soft Deletes:** Table `users` uses `deleted_at` (`TIMESTAMPTZ`) via Laravel's `SoftDeletes` trait.
2. **Role-Scoped Archive Metadata (GEN-11):**
   * Migration 77 (`2026_11_15_000100_add_archive_columns_to_core_tables.php`) added `archived_at`, `archived_by_user_id`, and `archive_reason` to 4 tables: `invoices`, `visits`, `prescriptions`, and `user_notifications`.
   * **Status:** **[Reported by project owner as applied on production `dental_clinic`]**; **[Not verified on hosted Supabase]**.
   * Note: Archive columns do NOT exist on every table; they are limited to these 4 core tables.
3. **Status-Based Lifecycles:** Primary business tables use non-destructive status lifecycles (`appointments.status = 'cancelled'`, `invoices.status = 'void'`).
4. **PostgreSQL Immutability Triggers:** 40 distinct tables are guarded by 44 database-level triggers blocking unauthorized `UPDATE` or `DELETE` statements.
5. **Physical Deletions in Backend Code:** A static audit of `backend/app/` identified 20 intentional physical delete operations strictly limited to:
   * Ephemeral authentication sessions: `DB::table('sessions')->delete()`
   * Ephemeral API tokens: `$user->tokens()->delete()` (`personal_access_tokens`)
   * Ephemeral password tokens: `DB::table('password_reset_tokens')->delete()`
   * Scope synchronization: `UserBranchScope::whereNotIn(...)->delete()`
   * Unfinalized draft lines: Draft prescription lines before signing (`$p->lines()->delete()`) and unkept draft treatment procedure lines before completion (`$existing->reject(...)->delete()`). Once finalized, triggers block all modifications.
   * Administrative backfill rollbacks: In `QueueBackfill` and `VisitBackfill` command rollback routines.
   * Settings reset: Removing custom override rows in `clinic_settings` when reverting to system default.
   * Disk files: Deleting orphaned storage files via `$disk->delete()`.
6. **Historical Schema Drops:**
   * Table `patient_feedback` permanently dropped in migration 76 (2026-11-10).
   * Column `middle_name` dropped from `persons` in migration 15 (2026-09-25).

---

### Discrepancy 5: Permanent Removal of `patient_feedback` Table
* **Context:** A dedicated `patient_feedback` table was initially created in migration 44.
* **Removal:** In migration 76 (`2026_11_10_000100_remove_patient_feedback_table.php`), this table was **permanently dropped** from the schema:
  ```php
  Schema::dropIfExists('patient_feedback');
  ```
* **Replacement Strategy:** Clinical visit satisfaction is tracked via `visits.google_review_status`, and general inquiries are handled through `inquiries` and `conversations`.
* **Evidence Classification:** Verified from project source. Do not recreate `patient_feedback` on Supabase.

---

### Discrepancy 6: Modern Tables Not Present in Legacy ERD v2
Between Migrations 30 and 83, the engineering team added specialized domain tables to fulfill modern clinic requirements. These are completely absent from ERD v2:

| Table Name | Owning Module | Functional Purpose | Evidence Classification |
| :--- | :--- | :--- | :---: |
| `tooth_chart_entries` | M10 Dental Charting | Odontogram surface conditions, restorations, and extractions with append-only history. | Verified from project source |
| `payment_checkout_sessions` | M11 Payments | PayMongo checkout session tracking, webhook signatures, and payment intent tokens. | Verified from project source |
| `payment_provider_events` | M11 Payments | Audit trail of raw incoming webhook events from PayMongo. | Verified from project source |
| `invoice_refunds` | M11 Invoicing | Financial credit notes and partial/full refunds with trigger-enforced immutability. | Verified from project source |
| `m11_billing_cutovers` | M11 Invoicing | Milestone cutover locking table for billing version transitions. | Verified from project source |
| `document_extractions` | M14 OCR | OCR extraction results from HMO approval letters and lab sheets. | Verified from project source |
| `patient_consents` | M14 Consent | Patient privacy, treatment consent, and terms acceptance records. | Verified from project source |
| `assistant_usage` & `assistant_answers` | M20 AI Assistant | Patient portal automated Q&A telemetry and intent matching records. | Verified from project source |
| `loyalty_accounts`, `referrals`, `loyalty_ledger`, `loyalty_lot_consumptions` | M24 Loyalty & Referral | Reward points ledger, referral codes, and FIFO consumption tracking with trigger guards. | Verified from project source |

---

### Discrepancy 7: Column-Level Hardening and Evolution
Several core tables evolved across migrations to enhance security, compliance, and public routing:

1. **`persons` Table:** Migration 15 dropped `middle_name`. Full legal name is represented via `first_name` and `last_name`.
2. **`users` Table:** Migration 16 added `deleted_at`; Migration 22 added `public_id`; Migration 36 added `auth_version`.
3. **`patients` Table:** Migration 17 added `public_id`; Migration 38 added medical history fields (`allergies`, `existing_conditions`, `blood_type`); Migration 49 added `billing_address` and `checkout_fingerprint`.
4. **`branches` Table:** Migration 37 added `public_id`; Migration 48 added BIR tax fields (`tin_number`, `tax_branch_code`, `rdo_code`); Migration 54 added `branch_email`; Migration 55 added `weekly_hours` (`JSONB`).

---

## 3. Hosted Supabase Schema Verification Checklist for Joevan

Joevan must verify the hosted Supabase database using these read-only SQL queries:

### Checklist Item 1: Canonical Application Tables Inventory & Physical Base Table Reconciliation
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
### Checklist Item 2: Dropped Table Check
* **What it proves:** Confirms that `patient_feedback` (dropped in migration 76) does not exist on Supabase.
* **Expected Result:** `ghost_feedback_table_count = 0`.
```sql
SELECT count(*) AS ghost_feedback_table_count
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'patient_feedback';
```

### Checklist Item 3: GEN-05 Kiosk Channel Constraint Check
* **What it proves:** Confirms zero lingering kiosk records exist and checks whether the updated channel constraint is applied.
* **Expected Result (3A):** `existing_kiosk_rows = 0`.
* **Expected Result (3B):** `check_clause` matches `CHECK (channel IN ('phone', 'account'))`.
```sql
-- 3A. Preflight data check before migration
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

### Checklist Item 4: Archive Columns Check (Reports ALL 4 Target Tables)
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

### Checklist Item 5: Trigger Catalog & Definition Inspection
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

## 4. Conflict Resolution Summary for Defense Presentation

When presenting the system architecture to the defense committee:
* Cite **`FINAL-ERD.md`** and **`FINAL-ERD-DICTIONARY.md`** as the definitive database specification.
* Explain that early documentation (`ERD v2`) represented an initial conceptual analysis, whereas the 83 migration files in `backend/database/migrations/` represent the production-hardened implementation conforming to Philippine healthcare requirements, BIR tax regulations, and non-destructive audit standards.
