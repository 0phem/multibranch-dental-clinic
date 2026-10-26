# FINAL DATA DICTIONARY — MULTIBRANCH DENTAL CLINIC OPERATIONS PLATFORM

**Date:** October 26, 2026<br>
**Audience:** Joevan (Database Administrator), Backend Engineers, System Auditors<br>
**Active Schema Tables:** 91 Tables (83 Domain + 8 Framework)<br>
**Total Audited Columns:** 1,111 Physical Schema Columns [EXACT]<br>
**Database Engine Target:** PostgreSQL 15+ (Hosted Supabase)<br>

---

## 1. Architectural Invariants, Date Discrepancy & Evidence Standards

### 1.1 Date Discrepancy & Future-Dated Migrations
* **Audit Date:** October 26, 2026.
* **Future-Dated Migration Files:** Exactly **28 migration files** (#56 to #83) in `backend/database/migrations/` bear filename timestamp prefixes dated after October 26, 2026 (ranging from October 27 to November 16, 2026). Future timestamp prefixes are a possible explanation (e.g., forward-dated sprint milestone identifiers), but this convention has not been formally confirmed by the project owner.
* **Migration Renaming & Tracking Invariant:** Changing the filename of a migration that has already run can cause Laravel to treat the renamed file as a different, pending migration because the recorded name in the `migrations` table no longer matches. Depending on the migration, re-execution may fail or cause unintended schema changes. Therefore, do not rename applied migrations without a reviewed migration-history and deployment plan.
* **Owner-Reported Production Status vs. Filename Contradiction:** Migration 77's production status remains owner-reported (`2026_11_15_000100_add_archive_columns_to_core_tables.php` was communicated as already applied on production `dental_clinic`), not independently verified by this static audit. This date contradiction (dated November 15 but reported applied on or before October 26) is preserved as reported but explicitly marked as **[Not verified on hosted Supabase]**.
* **Local Test vs. Hosted Status:** Migration 83 is recorded as `Ran` in local `dental_clinic_test`; its hosted Supabase status remains unverified. Joevan must independently confirm hosted status using read-only verification queries.

### 1.2 Audit Safety Scope & Metric Designations
* **Audit Safety Scope:** This corrective documentation pass performed **zero database operations, zero SQL executions, and zero Git index or worktree mutations**. Earlier development workflow steps in prior turns included focused local testing against `dental_clinic_test`. Neither production `dental_clinic` nor hosted Supabase has been inspected.
* **Exact vs. Estimated Metrics:**
  * Active Canonical Tables: **91 tables** (83 domain + 8 framework) **[EXACT]** — derived from 92 unique tables created minus 1 dropped (`patient_feedback`).
  * Total Columns: **1,111 physical columns** **[EXACT]** — distinct physical column definitions in the intended final schema across all 91 canonical tables, after applying migration-created columns, later additions and alterations, and documented drops (exhaustively documented in `FINAL-ERD-DICTIONARY.md`). Excludes Markdown headers, separator rows, descriptions, constraint notes, and relationship notes.
  * Migration-Defined Triggers: **44 triggers** **[EXACT]** — net active triggers in migrations across 40 distinct tables.
  * Trigger-Protected Tables: **40 distinct tables** **[EXACT]** — accounting for 4 overlapping tables (`audit_logs`, `loyalty_ledger`, `loyalty_lot_consumptions`, `treatments`).
  * Foreign Keys: **~232 constraints** **[ESTIMATED]** — static source estimate.
  * Unique Constraints & Indexes: **~106 constraints/indexes** **[ESTIMATED]** — static source estimate.
  * Check Constraints: **~125 constraints** **[ESTIMATED]** — static net active check constraints.
  * Plain Secondary Indexes: **~58 indexes** **[ESTIMATED]** — static source estimate.
* **STF-04 Scope Boundary:** In `CounterIntake.jsx`, the receptionist counter form provides an "Other valid ID" text field (`other_details`). Backend request validation and database persistence for this field remain **pending approval** (recorded as **Partial / In Progress**). This missing persistence is an incomplete implementation item awaiting client/team approval, **NOT** an intentional final design decision. No column is added to `intake_submissions`.
* **Multi-Tier Retention Model:**
  * Eloquent Soft Deletes on `users` (`deleted_at`).
  * Role-Scoped Archive Metadata (`archived_at`, `archived_by_user_id`, `archive_reason`) on 4 core tables: `invoices`, `visits`, `prescriptions`, `user_notifications`.
  * Status transitions on primary business records (`appointments`, `visits`, `invoices`, `hmo_cases`).
  * PostgreSQL engine-level triggers protecting 40 tables (44 total net active triggers).
  * 20 specific code-level physical deletions handling ephemeral tokens, sessions, scope re-syncs, and unfinalized draft lines.
  * Historical schema drops: Table `patient_feedback` (migration 76) and column `persons.middle_name` (migration 15).

---

## Table of Contents


### M1 (Framework)
- [password_reset_tokens](#password-reset-tokens)
- [personal_access_tokens](#personal-access-tokens)
- [sessions](#sessions)

### M1 Identity & Personnel
- [account_claim_invites](#account-claim-invites)
- [email_verification_otps](#email-verification-otps)
- [persons](#persons)
- [user_branch_scopes](#user-branch-scopes)
- [users](#users)

### M10 Dental Charts
- [tooth_chart_entries](#tooth-chart-entries)

### M11 Billing & Invoicing
- [invoice_histories](#invoice-histories)
- [invoice_lines](#invoice-lines)
- [invoices](#invoices)

### M11 Billing & Payments
- [payments](#payments)
- [receipts](#receipts)

### M11 Billing & Refunds
- [invoice_refunds](#invoice-refunds)

### M11 Billing Transition
- [m11_billing_cutovers](#m11-billing-cutovers)

### M11 Payment Gateway
- [payment_checkout_sessions](#payment-checkout-sessions)
- [payment_provider_events](#payment-provider-events)

### M12 HMO Claims
- [accepted_hmos](#accepted-hmos)
- [hmo_case_events](#hmo-case-events)
- [hmo_case_requirements](#hmo-case-requirements)
- [hmo_cases](#hmo-cases)
- [patient_hmo_memberships](#patient-hmo-memberships)

### M13 Service Catalog
- [branch_services](#branch-services)
- [services](#services)

### M13 Service Pricing
- [service_prices](#service-prices)

### M14 Consent Management
- [patient_consents](#patient-consents)

### M14 OCR Document Extraction
- [document_extractions](#document-extractions)

### M14 Patient Documents
- [documents](#documents)

### M15 Clinic Configuration
- [clinic_settings](#clinic-settings)

### M15 Leave Management
- [leave_requests](#leave-requests)

### M16 Inquiry Management
- [inquiries](#inquiries)
- [inquiry_history](#inquiry-history)

### M17 Patient Messaging
- [conversation_messages](#conversation-messages)
- [conversation_participants](#conversation-participants)
- [conversations](#conversations)

### M18 Email Dispatch
- [mail_dispatch_attempts](#mail-dispatch-attempts)
- [mail_dispatches](#mail-dispatches)

### M18 Notifications
- [message_templates](#message-templates)
- [user_notifications](#user-notifications)

### M19 Digital Prescriptions
- [prescription_counters](#prescription-counters)
- [prescription_lines](#prescription-lines)
- [prescriptions](#prescriptions)

### M2 Clinical Branches
- [branch_closures](#branch-closures)
- [branches](#branches)

### M20 Patient Follow-Up
- [followup_tasks](#followup-tasks)

### M22 Audit Trail
- [audit_logs](#audit-logs)

### M23 Workflow Automation
- [automated_actions](#automated-actions)
- [automation_deliveries](#automation-deliveries)
- [automation_settings](#automation-settings)
- [system_events](#system-events)
- [workflow_rules](#workflow-rules)

### M24 Referral & Loyalty
- [loyalty_accounts](#loyalty-accounts)
- [loyalty_ledger](#loyalty-ledger)
- [loyalty_lot_consumptions](#loyalty-lot-consumptions)
- [referrals](#referrals)

### M25 Patient Handovers
- [patient_handovers](#patient-handovers)

### M3 Work Schedules
- [dentist_branches](#dentist-branches)
- [dentist_profiles](#dentist-profiles)
- [dentist_schedule_exceptions](#dentist-schedule-exceptions)
- [dentist_schedules](#dentist-schedules)
- [dentist_service_assignments](#dentist-service-assignments)
- [staff_profiles](#staff-profiles)

### M4 Patient Records
- [patient_guardians](#patient-guardians)
- [patients](#patients)

### M5 Clinical Treatment
- [treatment_history](#treatment-history)
- [treatment_procedures](#treatment-procedures)
- [treatments](#treatments)

### M6 Appointment Booking
- [appointment_command_keys](#appointment-command-keys)
- [appointment_history](#appointment-history)
- [appointment_responses](#appointment-responses)
- [appointments](#appointments)
- [no_show_flags](#no-show-flags)
- [slot_offers](#slot-offers)
- [slot_openings](#slot-openings)
- [waitlist_entries](#waitlist-entries)

### M7 Patient AI Support
- [assistant_answers](#assistant-answers)
- [assistant_usage](#assistant-usage)

### M8 Patient Check-In
- [branch_join_codes](#branch-join-codes)
- [command_keys](#command-keys)
- [intake_submissions](#intake-submissions)
- [visit_history](#visit-history)
- [visits](#visits)

### M9 Patient Queue
- [dentist_queues](#dentist-queues)
- [queue_entries](#queue-entries)
- [queue_entry_history](#queue-entry-history)

### Queue Worker
- [failed_jobs](#failed-jobs)
- [job_batches](#job-batches)
- [jobs](#jobs)

### System Cache
- [cache](#cache)
- [cache_locks](#cache-locks)

---

## `accepted_hmos`
**Module:** M12 HMO Claims<br>
**Description:** Managed catalog of recognized HMO insurance providers and operational terms.<br>
**Created In:** `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached (1):**<br>
- `accepted_hmos_no_delete` (No-Delete Guard: BEFORE DELETE via `accepted_hmos_no_delete()` in `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `verified_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `name` | `varchar(120)` | NO | *None* | *None* | Attribute name for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `note` | `varchar(200)` | YES | *None* | *None* | Attribute note for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `verified_by_clinic` | `boolean` | NO | `false` | *None* | Attribute verified_by_clinic for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `verified_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated verified_by_user record. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `verified_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when verified occurred (Asia/Manila). | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `active` | `boolean` | NO | `true` | *None* | Attribute active for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for accepted_hmos. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |

---

## `account_claim_invites`
**Module:** M1 Identity & Personnel<br>
**Description:** Single-use cryptographic tokens allowing patients or guardians to claim online portal access.<br>
**Created In:** `2026_10_29_000300_harden_account_claims.php`<br>
**Total Columns:** 9<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** token_hash
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for account_claim_invites. | `2026_10_29_000300_harden_account_claims.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_29_000300_harden_account_claims.php` |
| `email` | `varchar(255)` | NO | *None* | *None* | Attribute email for account_claim_invites. | `2026_10_29_000300_harden_account_claims.php` |
| `token_hash` | `char(64)` | NO | *None* | `UNIQUE` | Attribute token_hash for account_claim_invites. | `2026_10_29_000300_harden_account_claims.php` |
| `issued_by_kind` | `varchar(10)` | NO | *None* | *None* | Attribute issued_by_kind for account_claim_invites. | `2026_10_29_000300_harden_account_claims.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_29_000300_harden_account_claims.php` |
| `expires_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when expires occurred (Asia/Manila). | `2026_10_29_000300_harden_account_claims.php` |
| `used_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when used occurred (Asia/Manila). | `2026_10_29_000300_harden_account_claims.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_29_000300_harden_account_claims.php` |

---

## `appointment_command_keys`
**Module:** M6 Appointment Booking<br>
**Description:** Idempotency keys ensuring appointment operations serialize safely.<br>
**Created In:** `2026_09_28_000400_create_appointment_command_keys_table.php`<br>
**Total Columns:** 9<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `user_id` -> users.id (CASCADE); `appointment_id` -> appointments.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for appointment_command_keys. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `user_id` | `bigint` | NO | *None* | `FK -> users.id (CASCADE)` | Foreign key referencing the associated user record. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `idempotency_key` | `varchar(255)` | NO | *None* | *None* | Attribute idempotency_key for appointment_command_keys. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `command` | `varchar(255)` | NO | *None* | *None* | Attribute command for appointment_command_keys. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `request_hash` | `char(64)` | NO | *None* | *None* | Attribute request_hash for appointment_command_keys. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `response_status` | `smallint` | YES | *None* | *None* | Attribute response_status for appointment_command_keys. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `response_body` | `json` | YES | *None* | *None* | Byte-for-byte stored HTTP response payload for idempotency replay. | `2026_09_28_000400_create_appointment_command_keys_table.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_28_000400_create_appointment_command_keys_table.php` |

---

## `appointment_history`
**Module:** M6 Appointment Booking<br>
**Description:** Append-only audit history of appointment status changes and reschedules.<br>
**Created In:** `2026_09_28_000300_create_appointment_history_table.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached (1):**<br>
- `appointment_history_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `appointment_history_append_only()` in `2026_09_28_000300_create_appointment_history_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `appointment_id` -> appointments.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `appointment_id` | `bigint` | NO | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_09_28_000300_create_appointment_history_table.php` |
| `event` | `varchar(255)` | NO | *None* | *None* | Attribute event for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `to_status` | `varchar(255)` | NO | *None* | *None* | Attribute to_status for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `revision` | `integer` | NO | *None* | *None* | Attribute revision for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_09_28_000300_create_appointment_history_table.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_09_28_000300_create_appointment_history_table.php` |
| `starts_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when starts occurred (Asia/Manila). | `2026_09_28_000300_create_appointment_history_table.php` |
| `ends_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when ends occurred (Asia/Manila). | `2026_09_28_000300_create_appointment_history_table.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_09_28_000300_create_appointment_history_table.php` |
| `actor_role` | `varchar(255)` | YES | *None* | *None* | Attribute actor_role for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `assignment_rule_version` | `varchar(255)` | YES | *None* | *None* | Attribute assignment_rule_version for appointment_history. | `2026_09_28_000300_create_appointment_history_table.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_09_28_000300_create_appointment_history_table.php` |

---

## `appointment_responses`
**Module:** M6 Appointment Booking<br>
**Description:** Patient responses to pre-arrival confirmation requests and move-up offers.<br>
**Created In:** `2026_10_28_000200_create_arrival_and_freed_slot_tables.php`<br>
**Total Columns:** 7<br>
**PostgreSQL Triggers Attached (1):**<br>
- `appointment_responses_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `appointment_responses_append_only()` in `2026_10_28_000200_create_arrival_and_freed_slot_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** link_hash
- **Foreign Keys:** `appointment_id` -> appointments.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for appointment_responses. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `appointment_id` | `bigint` | NO | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `appointment_revision` | `integer` | NO | *None* | *None* | Attribute appointment_revision for appointment_responses. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `response` | `varchar(20)` | NO | *None* | *None* | Attribute response for appointment_responses. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `via` | `varchar(10)` | NO | *None* | *None* | Attribute via for appointment_responses. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `link_hash` | `char(64)` | YES | *None* | `UNIQUE` | Attribute link_hash for appointment_responses. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |

---

## `appointments`
**Module:** M6 Appointment Booking<br>
**Description:** Scheduled and confirmed clinic appointments across all branches.<br>
**Created In:** `2026_09_28_000200_create_appointments_table.php`<br>
**Total Columns:** 30<br>
**PostgreSQL Triggers Attached (1):**<br>
- `appointments_code_immutable` (Column Immutability Guard: BEFORE UPDATE OF APPOINTMENT_CODE via `appointments_code_immutable()` in `2026_09_29_000200_add_appointment_code_to_appointments_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, appointment_code (UK: appointments_appointment_code_unique)
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `service_id` -> services.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_09_28_000200_create_appointments_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_09_28_000200_create_appointments_table.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_09_28_000200_create_appointments_table.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_09_28_000200_create_appointments_table.php` |
| `starts_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when starts occurred (Asia/Manila). | `2026_09_28_000200_create_appointments_table.php` |
| `ends_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when ends occurred (Asia/Manila). | `2026_09_28_000200_create_appointments_table.php` |
| `duration_minutes` | `smallint` | NO | *None* | *None* | Snapshot of service duration in minutes applied at booking time. | `2026_09_28_000200_create_appointments_table.php` |
| `status` | `varchar(255)` | NO | *None* | *None* | Current operational workflow status for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `source` | `varchar(255)` | NO | *None* | *None* | Attribute source for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `assignment_method` | `varchar(255)` | NO | *None* | *None* | Attribute assignment_method for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `assignment_rule_version` | `varchar(255)` | YES | *None* | *None* | Attribute assignment_rule_version for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for appointments. | `2026_09_28_000200_create_appointments_table.php` |
| `notes` | `text` | YES | *None* | *None* | Free-form administrative or clinical text notes. | `2026_09_28_000200_create_appointments_table.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_09_28_000200_create_appointments_table.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_09_28_000200_create_appointments_table.php` |
| `cancelled_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when cancelled occurred (Asia/Manila). | `2026_09_28_000200_create_appointments_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_28_000200_create_appointments_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_28_000200_create_appointments_table.php` |
| `appointment_code` | `varchar(20)` | NO | `('APT-' || ...)` | `UK (appointments_appointment_code_unique)` | Human-readable immutable appointment identifier backed by sequence and immutability trigger. | `2026_09_29_000200_add_appointment_code_to_appointments_table.php` |
| `late_cancellation` | `boolean` | NO | `false` | *None* | Flag indicating whether cancellation occurred past policy deadline. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `booking_fee_php` | `numeric(10, 2)` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_payment_status` | `varchar(20)` | NO | `'unpaid'` | *None* | Attribute booking_payment_status for appointments. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_hold_expires_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when booking_hold_expires occurred (Asia/Manila). | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_payment_method` | `varchar(60)` | YES | *None* | *None* | Attribute booking_payment_method for appointments. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_payment_ref` | `varchar(120)` | YES | *None* | *None* | Attribute booking_payment_ref for appointments. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_paid_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when booking_paid occurred (Asia/Manila). | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_refund_ref` | `varchar(120)` | YES | *None* | *None* | Attribute booking_refund_ref for appointments. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |
| `booking_refunded_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when booking_refunded occurred (Asia/Manila). | `2026_11_01_000100_add_booking_payment_to_appointments.php` |

---

## `assistant_answers`
**Module:** M7 Patient AI Support<br>
**Description:** Clinic-curated FAQ knowledge base entries powering the patient AI assistant.<br>
**Created In:** `2026_10_25_000100_create_assistant_answers_table.php`<br>
**Total Columns:** 15<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, seed_key
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `updated_by` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `seed_key` | `varchar(60)` | YES | *None* | `UNIQUE` | Attribute seed_key for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `question` | `varchar(200)` | NO | *None* | *None* | Attribute question for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `answer` | `varchar(1000)` | NO | *None* | *None* | Attribute answer for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `keywords` | `jsonb` | NO | `DB::raw("'[]'::jsonb"` | *None* | Attribute keywords for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `category` | `varchar(40)` | NO | *None* | *None* | Attribute category for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `active` | `boolean` | NO | `true` | *None* | Attribute active for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `draft` | `boolean` | NO | `true` | *None* | Attribute draft for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `source` | `varchar(200)` | YES | *None* | *None* | Attribute source for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `updated_by` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Attribute updated_by for assistant_answers. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_25_000100_create_assistant_answers_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_25_000100_create_assistant_answers_table.php` |

---

## `assistant_usage`
**Module:** M7 Patient AI Support<br>
**Description:** Rate-limiting and token usage tracking for Gemini-powered patient assistance.<br>
**Created In:** `2026_10_24_000200_create_assistant_usage_table.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `user_id` -> users.id (CASCADE)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `user_id` | `bigint` | NO | *None* | `FK -> users.id (CASCADE)` | Foreign key referencing the associated user record. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `clinic_date` | `date` | NO | *None* | *None* | Attribute clinic_date for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `mode` | `varchar(20)` | NO | *None* | *None* | Attribute mode for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `outcome` | `varchar(30)` | NO | *None* | *None* | Attribute outcome for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `tools` | `jsonb` | YES | *None* | *None* | Attribute tools for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `input_tokens` | `integer` | YES | *None* | *None* | Attribute input_tokens for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `output_tokens` | `integer` | YES | *None* | *None* | Attribute output_tokens for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `latency_ms` | `integer` | YES | *None* | *None* | Attribute latency_ms for assistant_usage. | `2026_10_24_000200_create_assistant_usage_table.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_24_000200_create_assistant_usage_table.php` |

---

## `audit_logs`
**Module:** M22 Audit Trail<br>
**Description:** Immutable PostgreSQL trigger-protected audit log of clinic events and overrides.<br>
**Created In:** `2026_10_07_000100_create_audit_logs_table.php`<br>
**Total Columns:** 15<br>
**PostgreSQL Triggers Attached (2):**<br>
- `audit_logs_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `audit_logs_guard()` in `2026_10_13_000100_enforce_audit_log_append_only.php`)
- `audit_logs_no_truncate` (No-Truncate Guard: BEFORE TRUNCATE via `audit_logs_guard()` in `2026_10_13_000100_enforce_audit_log_append_only.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `actor_user_id` -> users.id (SET NULL); `branch_id` -> branches.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_10_07_000100_create_audit_logs_table.php` |
| `actor_role` | `varchar(50)` | YES | *None* | *None* | Attribute actor_role for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `actor_name` | `varchar(255)` | YES | *None* | *None* | Attribute actor_name for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (SET NULL)` | Foreign key referencing the associated branch record. | `2026_10_07_000100_create_audit_logs_table.php` |
| `action` | `varchar(100)` | NO | *None* | *None* | Attribute action for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `category` | `varchar(50)` | NO | `'general'` | *None* | Attribute category for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `severity` | `varchar(20)` | NO | `'info'` | `Index` | Log severity classification (info, warning, critical). | `2026_10_07_000100_create_audit_logs_table.php` |
| `auditable_type` | `varchar(100)` | YES | *None* | `Index` | Polymorphic entity model class name audited by this log entry. | `2026_10_07_000100_create_audit_logs_table.php` |
| `auditable_public_id` | `varchar(50)` | YES | *None* | *None* | Foreign key referencing the associated auditable_public record. | `2026_10_07_000100_create_audit_logs_table.php` |
| `ip_address` | `varchar(45)` | YES | *None* | *None* | Attribute ip_address for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `user_agent` | `text` | YES | *None* | *None* | Attribute user_agent for audit_logs. | `2026_10_07_000100_create_audit_logs_table.php` |
| `payload` | `jsonb` | YES | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_07_000100_create_audit_logs_table.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_07_000100_create_audit_logs_table.php` |

---

## `automated_actions`
**Module:** M23 Workflow Automation<br>
**Description:** Automated task executions dispatched by system event triggers.<br>
**Created In:** `2026_10_08_000100_create_automation_tables.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, idempotency_key
- **Foreign Keys:** `workflow_rule_id` -> workflow_rules.id (CASCADE); `system_event_id` -> system_events.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for automated_actions. | `2026_10_08_000100_create_automation_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for automated_actions. | `2026_10_08_000100_create_automation_tables.php` |
| `workflow_rule_id` | `bigint` | NO | *None* | `FK -> workflow_rules.id (CASCADE)` | Foreign key referencing the associated workflow_rule record. | `2026_10_08_000100_create_automation_tables.php` |
| `system_event_id` | `bigint` | YES | *None* | `FK -> system_events.id (SET NULL)` | Foreign key referencing the associated system_event record. | `2026_10_08_000100_create_automation_tables.php` |
| `idempotency_key` | `varchar(150)` | NO | *None* | `UNIQUE` | Attribute idempotency_key for automated_actions. | `2026_10_08_000100_create_automation_tables.php` |
| `status` | `varchar(30)` | NO | *None* | *None* | Current operational workflow status for automated_actions. | `2026_10_08_000100_create_automation_tables.php` |
| `result_summary` | `text` | NO | *None* | *None* | Execution outcome summary or diagnostic payload for the automated action. | `2026_10_08_000100_create_automation_tables.php` |
| `details` | `json` | YES | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_08_000100_create_automation_tables.php` |
| `executed_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when executed occurred (Asia/Manila). | `2026_10_08_000100_create_automation_tables.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_08_000100_create_automation_tables.php` |

---

## `automation_deliveries`
**Module:** M23 Workflow Automation<br>
**Description:** Delivery audit logs for scheduled automated notifications and jobs.<br>
**Created In:** `2026_10_27_000100_create_automation_settings_and_deliveries.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `automation_deliveries_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `automation_deliveries_append_only()` in `2026_10_27_000100_create_automation_settings_and_deliveries.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** dedupe_key
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `mail_dispatch_id` -> mail_dispatches.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for automation_deliveries. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `automation` | `varchar(40)` | NO | *None* | *None* | Attribute automation for automation_deliveries. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `dedupe_key` | `varchar(191)` | NO | *None* | `UNIQUE` | Attribute dedupe_key for automation_deliveries. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `outcome` | `varchar(20)` | NO | *None* | *None* | Attribute outcome for automation_deliveries. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `reason` | `varchar(60)` | YES | *None* | *None* | Attribute reason for automation_deliveries. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `subject_type` | `varchar(40)` | YES | *None* | *None* | Attribute subject_type for automation_deliveries. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `subject_public_id` | `varchar(50)` | YES | *None* | *None* | Foreign key referencing the associated subject_public record. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `mail_dispatch_id` | `bigint` | YES | *None* | `FK -> mail_dispatches.id (RESTRICT)` | Foreign key referencing the associated mail_dispatch record. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |

---

## `automation_settings`
**Module:** M23 Workflow Automation<br>
**Description:** Configuration parameters controlling clinic automations and schedules.<br>
**Created In:** `2026_10_27_000100_create_automation_settings_and_deliveries.php`<br>
**Total Columns:** 8<br>
**PostgreSQL Triggers Attached (1):**<br>
- `automation_settings_no_delete` (No-Delete Guard: BEFORE DELETE via `automation_settings_no_delete()` in `2026_10_27_000100_create_automation_settings_and_deliveries.php`)

**Key Constraints:**
- **Primary Key:** key
- **Foreign Keys:** `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `key` | `varchar(40)` | NO | *None* | `PK` | Attribute key for automation_settings. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `enabled` | `boolean` | NO | *None* | *None* | Attribute enabled for automation_settings. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `settings` | `jsonb` | NO | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for automation_settings. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `last_run_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when last_run occurred (Asia/Manila). | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_27_000100_create_automation_settings_and_deliveries.php` |

---

## `branch_closures`
**Module:** M2 Clinical Branches<br>
**Description:** Branch holiday and temporary closure schedules with affected appointments.<br>
**Created In:** `2026_10_28_000300_create_branch_closures_table.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached (1):**<br>
- `branch_closures_no_delete` (No-Delete Guard: BEFORE DELETE via `branch_closures_no_delete()` in `2026_10_28_000300_create_branch_closures_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_28_000300_create_branch_closures_table.php` |
| `closed_on` | `date` | NO | *None* | *None* | Attribute closed_on for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `reason` | `varchar(120)` | YES | *None* | *None* | Attribute reason for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `open_time` | `time` | YES | *None* | *None* | Attribute open_time for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `close_time` | `time` | YES | *None* | *None* | Attribute close_time for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `status` | `varchar(20)` | NO | `'active'` | *None* | Current operational workflow status for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `source` | `varchar(20)` | NO | `'owner'` | *None* | Attribute source for branch_closures. | `2026_10_28_000300_create_branch_closures_table.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_28_000300_create_branch_closures_table.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_28_000300_create_branch_closures_table.php` |
| `patients_notified_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when patients_notified occurred (Asia/Manila). | `2026_10_28_000300_create_branch_closures_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_28_000300_create_branch_closures_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_28_000300_create_branch_closures_table.php` |

---

## `branch_join_codes`
**Module:** M8 Patient Check-In<br>
**Description:** Daily rotating 8-character codes displayed at front desks for QR check-in.<br>
**Created In:** `2026_10_29_000200_create_intake_tables.php`<br>
**Total Columns:** 8<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for branch_join_codes. | `2026_10_29_000200_create_intake_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_29_000200_create_intake_tables.php` |
| `clinic_date` | `date` | NO | *None* | *None* | Attribute clinic_date for branch_join_codes. | `2026_10_29_000200_create_intake_tables.php` |
| `code` | `varchar(8)` | NO | *None* | *None* | Unique alphanumeric identifier or reference code. | `2026_10_29_000200_create_intake_tables.php` |
| `active` | `boolean` | NO | `true` | *None* | Attribute active for branch_join_codes. | `2026_10_29_000200_create_intake_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_29_000200_create_intake_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_29_000200_create_intake_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_29_000200_create_intake_tables.php` |

---

## `branch_services`
**Module:** M13 Service Catalog<br>
**Description:** Branch-service assignment pivot controlling procedure availability per location.<br>
**Created In:** `2026_09_25_000300_create_branch_services_table.php`<br>
**Total Columns:** 7<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `service_id` -> services.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for branch_services. | `2026_09_25_000300_create_branch_services_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_09_25_000300_create_branch_services_table.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_09_25_000300_create_branch_services_table.php` |
| `active` | `boolean` | NO | `true` | *None* | Attribute active for branch_services. | `2026_09_25_000300_create_branch_services_table.php` |
| `duration_override_minutes` | `smallint` | YES | *None* | *None* | Attribute duration_override_minutes for branch_services. | `2026_09_25_000300_create_branch_services_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000300_create_branch_services_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000300_create_branch_services_table.php` |

---

## `branches`
**Module:** M2 Clinical Branches<br>
**Description:** Clinic branch locations, BIR tax identifiers, contact info, and operating configuration.<br>
**Created In:** `2026_09_25_000100_create_branches_table.php`<br>
**Total Columns:** 24<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** legacy_ref, branch_code, name

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for branches. | `2026_09_25_000100_create_branches_table.php` |
| `legacy_ref` | `varchar(255)` | YES | *None* | `UNIQUE` | Attribute legacy_ref for branches. | `2026_09_25_000100_create_branches_table.php` |
| `branch_code` | `varchar(255)` | NO | *None* | `UNIQUE` | Unique alphanumeric identifier or reference code. | `2026_09_25_000100_create_branches_table.php` |
| `name` | `varchar(255)` | NO | *None* | `UNIQUE` | Attribute name for branches. | `2026_09_25_000100_create_branches_table.php` |
| `city` | `varchar(255)` | NO | *None* | *None* | Attribute city for branches. | `2026_09_25_000100_create_branches_table.php` |
| `address` | `varchar(255)` | NO | *None* | *None* | Attribute address for branches. | `2026_09_25_000100_create_branches_table.php` |
| `phone` | `varchar(255)` | YES | *None* | *None* | Attribute phone for branches. | `2026_09_25_000100_create_branches_table.php` |
| `open_time` | `time` | NO | *None* | *None* | Attribute open_time for branches. | `2026_09_25_000100_create_branches_table.php` |
| `close_time` | `time` | NO | *None* | *None* | Attribute close_time for branches. | `2026_09_25_000100_create_branches_table.php` |
| `status` | `varchar(255)` | NO | `'Open'` | *None* | Current operational workflow status for branches. | `2026_09_25_000100_create_branches_table.php` |
| `capacity_threshold` | `smallint` | NO | `80` | *None* | Attribute capacity_threshold for branches. | `2026_09_25_000100_create_branches_table.php` |
| `latitude` | `numeric(10, 7)` | YES | *None* | *None* | Attribute latitude for branches. | `2026_09_25_000100_create_branches_table.php` |
| `longitude` | `numeric(10, 7)` | YES | *None* | *None* | Attribute longitude for branches. | `2026_09_25_000100_create_branches_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000100_create_branches_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000100_create_branches_table.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | *None* | Deterministic, URL-safe public obfuscated identifier for branches. | `2026_10_10_000100_add_branch_public_identity.php` |
| `bir_registered_name` | `varchar(255)` | YES | *None* | *None* | Attribute bir_registered_name for branches. | `2026_10_21_000100_add_bir_fields_to_branches.php` |
| `bir_tin` | `varchar(30)` | YES | *None* | *None* | Attribute bir_tin for branches. | `2026_10_21_000100_add_bir_fields_to_branches.php` |
| `bir_registered_address` | `varchar(255)` | YES | *None* | *None* | Attribute bir_registered_address for branches. | `2026_10_21_000100_add_bir_fields_to_branches.php` |
| `bir_vat_status` | `varchar(10)` | YES | *None* | *None* | Attribute bir_vat_status for branches. | `2026_10_21_000100_add_bir_fields_to_branches.php` |
| `bir_permit_numbers` | `varchar(255)` | YES | *None* | *None* | Attribute bir_permit_numbers for branches. | `2026_10_21_000100_add_bir_fields_to_branches.php` |
| `operating_days` | `jsonb` | YES | *None* | *None* | Attribute operating_days for branches. | `2026_10_24_000100_patient_portal_foundations.php` |
| `email` | `varchar(150)` | YES | *None* | *None* | Attribute email for branches. | `2026_10_25_000200_add_email_to_branches.php` |
| `weekly_hours` | `jsonb` | YES | *None* | *None* | Attribute weekly_hours for branches. | `2026_10_26_000100_add_weekly_hours_to_branches.php` |

---

## `cache`
**Module:** System Cache<br>
**Description:** Laravel framework database cache table.<br>
**Created In:** `0001_01_01_000001_create_cache_table.php`<br>
**Total Columns:** 3<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** key

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `key` | `varchar(255)` | NO | *None* | `PK` | Attribute key for cache. | `0001_01_01_000001_create_cache_table.php` |
| `value` | `text` | NO | *None* | *None* | Attribute value for cache. | `0001_01_01_000001_create_cache_table.php` |
| `expiration` | `bigint` | NO | *None* | *None* | Attribute expiration for cache. | `0001_01_01_000001_create_cache_table.php` |

---

## `cache_locks`
**Module:** System Cache<br>
**Description:** Laravel framework atomic lock table.<br>
**Created In:** `0001_01_01_000001_create_cache_table.php`<br>
**Total Columns:** 3<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** key

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `key` | `varchar(255)` | NO | *None* | `PK` | Attribute key for cache_locks. | `0001_01_01_000001_create_cache_table.php` |
| `owner` | `varchar(255)` | NO | *None* | *None* | Attribute owner for cache_locks. | `0001_01_01_000001_create_cache_table.php` |
| `expiration` | `bigint` | NO | *None* | *None* | Attribute expiration for cache_locks. | `0001_01_01_000001_create_cache_table.php` |

---

## `clinic_settings`
**Module:** M15 Clinic Configuration<br>
**Description:** System-wide white-label branding, operating settings, and automation parameters.<br>
**Created In:** `2026_10_23_000100_create_clinic_settings_table.php`<br>
**Total Columns:** 4<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** key
- **Foreign Keys:** `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `key` | `varchar(60)` | NO | *None* | `PK` | Attribute key for clinic_settings. | `2026_10_23_000100_create_clinic_settings_table.php` |
| `value` | `jsonb` | YES | *None* | *None* | Attribute value for clinic_settings. | `2026_10_23_000100_create_clinic_settings_table.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_23_000100_create_clinic_settings_table.php` |
| `updated_at` | `timestamp with time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_23_000100_create_clinic_settings_table.php` |

---

## `command_keys`
**Module:** M8 Patient Check-In<br>
**Description:** Idempotency keys preventing duplicate arrivals, check-ins, or walk-ins.<br>
**Created In:** `2026_09_30_000100_create_visits_table.php`<br>
**Total Columns:** 8<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `user_id` -> users.id (CASCADE)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for command_keys. | `2026_09_30_000100_create_visits_table.php` |
| `user_id` | `bigint` | NO | *None* | `FK -> users.id (CASCADE)` | Foreign key referencing the associated user record. | `2026_09_30_000100_create_visits_table.php` |
| `idempotency_key` | `varchar(255)` | NO | *None* | *None* | Attribute idempotency_key for command_keys. | `2026_09_30_000100_create_visits_table.php` |
| `command` | `varchar(255)` | NO | *None* | *None* | Attribute command for command_keys. | `2026_09_30_000100_create_visits_table.php` |
| `request_hash` | `char(64)` | NO | *None* | *None* | Attribute request_hash for command_keys. | `2026_09_30_000100_create_visits_table.php` |
| `response_status` | `smallint` | YES | *None* | *None* | Attribute response_status for command_keys. | `2026_09_30_000100_create_visits_table.php` |
| `response_body` | `json` | YES | *None* | *None* | Byte-for-byte stored HTTP response payload for generic idempotency replay. | `2026_09_30_000100_create_visits_table.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_30_000100_create_visits_table.php` |

---

## `conversation_messages`
**Module:** M17 Patient Messaging<br>
**Description:** Encrypted chat messages exchanged in conversation threads.<br>
**Created In:** `2026_10_16_000100_create_messaging_tables.php`<br>
**Total Columns:** 7<br>
**PostgreSQL Triggers Attached (1):**<br>
- `conversation_messages_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `conversation_messages_immutable()` in `2026_10_16_000100_create_messaging_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `conversation_id` -> conversations.id (RESTRICT); `sender_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for conversation_messages. | `2026_10_16_000100_create_messaging_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for conversation_messages. | `2026_10_16_000100_create_messaging_tables.php` |
| `conversation_id` | `bigint` | NO | *None* | `FK -> conversations.id (RESTRICT)` | Foreign key referencing the associated conversation record. | `2026_10_16_000100_create_messaging_tables.php` |
| `sender_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated sender_user record. | `2026_10_16_000100_create_messaging_tables.php` |
| `body` | `text` | NO | *None* | *None* | Attribute body for conversation_messages. | `2026_10_16_000100_create_messaging_tables.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_16_000100_create_messaging_tables.php` |
| `body_encrypted` | `text` | YES | *None* | *None* | AES-256 encrypted message ciphertext for confidential patient-staff messaging. | `2026_10_20_000100_m17_routing_and_encryption.php` |

---

## `conversation_participants`
**Module:** M17 Patient Messaging<br>
**Description:** Staff, dentist, and patient participants joined to a conversation thread.<br>
**Created In:** `2026_10_16_000100_create_messaging_tables.php`<br>
**Total Columns:** 6<br>
**PostgreSQL Triggers Attached (1):**<br>
- `conversation_participants_guard` (Update Guard: BEFORE UPDATE via `conversation_participants_guard()` in `2026_10_16_000100_create_messaging_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `conversation_id` -> conversations.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for conversation_participants. | `2026_10_16_000100_create_messaging_tables.php` |
| `conversation_id` | `bigint` | NO | *None* | `FK -> conversations.id (RESTRICT)` | Foreign key referencing the associated conversation record. | `2026_10_16_000100_create_messaging_tables.php` |
| `user_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated user record. | `2026_10_16_000100_create_messaging_tables.php` |
| `last_read_message_id` | `bigint` | YES | *None* | *None* | Foreign key referencing the associated last_read_message record. | `2026_10_16_000100_create_messaging_tables.php` |
| `last_read_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when last_read occurred (Asia/Manila). | `2026_10_16_000100_create_messaging_tables.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_16_000100_create_messaging_tables.php` |

---

## `conversations`
**Module:** M17 Patient Messaging<br>
**Description:** In-app secure messaging threads between verified patients and clinic staff/dentists.<br>
**Created In:** `2026_10_16_000100_create_messaging_tables.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached (1):**<br>
- `conversations_guard` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `conversations_guard()` in `2026_10_16_000100_create_messaging_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `closed_by_user_id` -> users.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT); `assigned_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for conversations. | `2026_10_16_000100_create_messaging_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for conversations. | `2026_10_16_000100_create_messaging_tables.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_16_000100_create_messaging_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_16_000100_create_messaging_tables.php` |
| `context` | `varchar(200)` | NO | *None* | *None* | Attribute context for conversations. | `2026_10_16_000100_create_messaging_tables.php` |
| `status` | `varchar(255)` | NO | `'Open'` | *None* | Current operational workflow status for conversations. | `2026_10_16_000100_create_messaging_tables.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for conversations. | `2026_10_16_000100_create_messaging_tables.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_16_000100_create_messaging_tables.php` |
| `closed_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated closed_by_user record. | `2026_10_16_000100_create_messaging_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_16_000100_create_messaging_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_16_000100_create_messaging_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_16_000100_create_messaging_tables.php` |
| `assigned_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Staff or dentist user assigned as the active handler for the conversation thread. | `2026_10_20_000100_m17_routing_and_encryption.php` |

---

## `dentist_branches`
**Module:** M3 Work Schedules<br>
**Description:** Junction table associating dentists with authorized practice branches.<br>
**Created In:** `2026_09_25_000600_create_dentist_branches_table.php`<br>
**Total Columns:** 5<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `dentist_profile_id` -> dentist_profiles.id (CASCADE); `branch_id` -> branches.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for dentist_branches. | `2026_09_25_000600_create_dentist_branches_table.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (CASCADE)` | Foreign key referencing the associated dentist_profile record. | `2026_09_25_000600_create_dentist_branches_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_09_25_000600_create_dentist_branches_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000600_create_dentist_branches_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000600_create_dentist_branches_table.php` |

---

## `dentist_profiles`
**Module:** M3 Work Schedules<br>
**Description:** Dentist professional profile, license numbers, and scheduling defaults.<br>
**Created In:** `2026_09_25_000500_create_dentist_profiles_table.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** legacy_ref, person_id, license_no
- **Foreign Keys:** `person_id` -> UNIQUE, persons.id (CASCADE); `assistant_staff_id` -> staff_profiles.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `legacy_ref` | `varchar(255)` | YES | *None* | `UNIQUE` | Attribute legacy_ref for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `legacy_user_ref` | `varchar(255)` | YES | *None* | *None* | Attribute legacy_user_ref for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `person_id` | `bigint` | NO | *None* | `UNIQUE, FK -> persons.id (CASCADE)` | Foreign key referencing the associated person record. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `license_no` | `varchar(255)` | YES | *None* | `UNIQUE` | Attribute license_no for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `specialty` | `varchar(255)` | YES | *None* | *None* | Attribute specialty for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `shift_start` | `time` | NO | *None* | *None* | Attribute shift_start for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `shift_end` | `time` | NO | *None* | *None* | Attribute shift_end for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `available` | `boolean` | NO | `true` | *None* | Attribute available for dentist_profiles. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `assistant_staff_id` | `bigint` | YES | *None* | `FK -> staff_profiles.id (SET NULL)` | Foreign key referencing the associated assistant_staff record. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000500_create_dentist_profiles_table.php` |
| `rx_license_no` | `varchar(40)` | YES | *None* | *None* | S2 narcotics and controlled substances prescription license number. | `2026_10_31_000100_create_prescriptions.php` |

---

## `dentist_queues`
**Module:** M9 Patient Queue<br>
**Description:** Per-branch, per-dentist, per-day queue container and atomic number counter.<br>
**Created In:** `2026_10_01_000100_create_queue_tables.php`<br>
**Total Columns:** 7<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for dentist_queues. | `2026_10_01_000100_create_queue_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_01_000100_create_queue_tables.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_01_000100_create_queue_tables.php` |
| `clinic_date` | `date` | NO | *None* | *None* | Attribute clinic_date for dentist_queues. | `2026_10_01_000100_create_queue_tables.php` |
| `next_number` | `integer` | NO | `0` | *None* | Attribute next_number for dentist_queues. | `2026_10_01_000100_create_queue_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_01_000100_create_queue_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_01_000100_create_queue_tables.php` |

---

## `dentist_schedule_exceptions`
**Module:** M3 Work Schedules<br>
**Description:** Date-specific overrides and single-day shift alterations for dentists.<br>
**Created In:** `2026_10_30_000100_create_work_schedules.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached (1):**<br>
- `{dentist_schedule_exceptions}_no_delete` (No-Delete Guard: BEFORE DELETE via `{dentist_schedule_exceptions}_no_delete()` in `2026_10_30_000100_create_work_schedules.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_30_000100_create_work_schedules.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_30_000100_create_work_schedules.php` |
| `on_date` | `date` | NO | *None* | *None* | Attribute on_date for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `kind` | `varchar(12)` | NO | *None* | *None* | Attribute kind for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `start_time` | `time` | YES | *None* | *None* | Attribute start_time for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `end_time` | `time` | YES | *None* | *None* | Attribute end_time for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `reason` | `varchar(120)` | YES | *None* | *None* | Attribute reason for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `status` | `varchar(10)` | NO | `'active'` | *None* | Current operational workflow status for dentist_schedule_exceptions. | `2026_10_30_000100_create_work_schedules.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_30_000100_create_work_schedules.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_30_000100_create_work_schedules.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_30_000100_create_work_schedules.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_30_000100_create_work_schedules.php` |

---

## `dentist_schedules`
**Module:** M3 Work Schedules<br>
**Description:** Weekly recurring shift rosters for dentists across clinic branches.<br>
**Created In:** `2026_10_30_000100_create_work_schedules.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached (1):**<br>
- `{dentist_schedules}_no_delete` (No-Delete Guard: BEFORE DELETE via `{dentist_schedules}_no_delete()` in `2026_10_30_000100_create_work_schedules.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_30_000100_create_work_schedules.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_30_000100_create_work_schedules.php` |
| `weekday` | `unsignedTinyInteger` | NO | *None* | *None* | Attribute weekday for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `start_time` | `time` | NO | *None* | *None* | Attribute start_time for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `end_time` | `time` | NO | *None* | *None* | Attribute end_time for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `break_start` | `time` | YES | *None* | *None* | Attribute break_start for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `break_end` | `time` | YES | *None* | *None* | Attribute break_end for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `status` | `varchar(10)` | NO | `'active'` | *None* | Current operational workflow status for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `demo` | `boolean` | NO | `false` | *None* | Attribute demo for dentist_schedules. | `2026_10_30_000100_create_work_schedules.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_30_000100_create_work_schedules.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_30_000100_create_work_schedules.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_30_000100_create_work_schedules.php` |

---

## `dentist_service_assignments`
**Module:** M3 Work Schedules<br>
**Description:** Procedures each dentist is credentialed/authorized to perform.<br>
**Created In:** `2026_09_25_000700_create_dentist_service_assignments_table.php`<br>
**Total Columns:** 6<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `dentist_profile_id` -> dentist_profiles.id (CASCADE); `service_id` -> services.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for dentist_service_assignments. | `2026_09_25_000700_create_dentist_service_assignments_table.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (CASCADE)` | Foreign key referencing the associated dentist_profile record. | `2026_09_25_000700_create_dentist_service_assignments_table.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_09_25_000700_create_dentist_service_assignments_table.php` |
| `is_authorized` | `boolean` | NO | `true` | *None* | Boolean flag indicating is authorized. | `2026_09_25_000700_create_dentist_service_assignments_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000700_create_dentist_service_assignments_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000700_create_dentist_service_assignments_table.php` |

---

## `document_extractions`
**Module:** M14 OCR Document Extraction<br>
**Description:** OCR-extracted draft field data from uploaded physical documents or IDs.<br>
**Created In:** `2026_10_06_000100_create_document_tables.php`<br>
**Total Columns:** 11<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for document_extractions. | `2026_10_06_000100_create_document_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for document_extractions. | `2026_10_06_000100_create_document_tables.php` |
| `document_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated document record. | `2026_10_06_000100_create_document_tables.php` |
| `extraction_method` | `varchar(64)` | NO | `'native_text'` | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_06_000100_create_document_tables.php` |
| `status` | `varchar(32)` | NO | `'Draft'` | *None* | Current operational workflow status for document_extractions. | `2026_10_06_000100_create_document_tables.php` |
| `raw_text` | `text` | YES | *None* | *None* | Attribute raw_text for document_extractions. | `2026_10_06_000100_create_document_tables.php` |
| `structured_payload` | `jsonb` | YES | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_06_000100_create_document_tables.php` |
| `confidence_score` | `numeric(5, 2)` | YES | *None* | *None* | Attribute confidence_score for document_extractions. | `2026_10_06_000100_create_document_tables.php` |
| `extracted_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when extracted occurred (Asia/Manila). | `2026_10_06_000100_create_document_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_06_000100_create_document_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_06_000100_create_document_tables.php` |

---

## `documents`
**Module:** M14 Patient Documents<br>
**Description:** Patient document repository metadata, file URIs, MIME types, and encryption flags.<br>
**Created In:** `2026_10_06_000100_create_document_tables.php`<br>
**Total Columns:** 21<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `branch_id` -> branches.id (SET NULL); `uploaded_by_user_id` -> users.id (RESTRICT); `retracted_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for documents. | `2026_10_06_000100_create_document_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for documents. | `2026_10_06_000100_create_document_tables.php` |
| `patient_id` | `foreign` | NO | *None* | *None* | Foreign key referencing the associated patient record. | `2026_10_12_000100_harden_document_integrity.php` |
| `visit_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated visit record. | `2026_10_06_000100_create_document_tables.php` |
| `hmo_case_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated hmo_case record. | `2026_10_06_000100_create_document_tables.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (SET NULL)` | Foreign key referencing the associated branch record. | `2026_10_06_000100_create_document_tables.php` |
| `category` | `varchar(64)` | NO | *None* | *None* | Attribute category for documents. | `2026_10_06_000100_create_document_tables.php` |
| `title` | `varchar(255)` | NO | *None* | *None* | Attribute title for documents. | `2026_10_06_000100_create_document_tables.php` |
| `file_path` | `unique` | NO | *None* | *None* | Attribute file_path for documents. | `2026_10_12_000100_harden_document_integrity.php` |
| `original_filename` | `varchar(255)` | NO | *None* | *None* | Attribute original_filename for documents. | `2026_10_06_000100_create_document_tables.php` |
| `mime_type` | `varchar(128)` | NO | *None* | *None* | Attribute mime_type for documents. | `2026_10_06_000100_create_document_tables.php` |
| `file_size_bytes` | `bigint` | NO | *None* | *None* | Attribute file_size_bytes for documents. | `2026_10_06_000100_create_document_tables.php` |
| `checksum_sha256` | `index` | NO | *None* | *None* | Attribute checksum_sha256 for documents. | `2026_10_06_000100_create_document_tables.php` |
| `status` | `varchar(32)` | NO | `'Active'` | *None* | Current operational workflow status for documents. | `2026_10_06_000100_create_document_tables.php` |
| `metadata` | `jsonb` | YES | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_06_000100_create_document_tables.php` |
| `uploaded_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated uploaded_by_user record. | `2026_10_06_000100_create_document_tables.php` |
| `retracted_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when retracted occurred (Asia/Manila). | `2026_10_06_000100_create_document_tables.php` |
| `retracted_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated retracted_by_user record. | `2026_10_06_000100_create_document_tables.php` |
| `retraction_reason` | `varchar(255)` | YES | *None* | *None* | Attribute retraction_reason for documents. | `2026_10_06_000100_create_document_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_06_000100_create_document_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_06_000100_create_document_tables.php` |

---

## `email_verification_otps`
**Module:** M1 Identity & Personnel<br>
**Description:** One-time verification passwords for registration, password reset, and email updates.<br>
**Created In:** `2026_09_30_000100_create_email_verification_otps_table.php`<br>
**Total Columns:** 11<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `user_id` -> users.id (CASCADE)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for email_verification_otps. | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `user_id` | `bigint` | NO | *None* | `FK -> users.id (CASCADE)` | Foreign key referencing the associated user record. | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `digest` | `varchar(255)` | NO | *None* | *None* | Attribute digest for email_verification_otps. | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `attempts` | `unsignedTinyInteger` | NO | `0` | *None* | Attribute attempts for email_verification_otps. | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `expires_at` | `timestamp without time zone` | NO | *None* | *None* | Timestamp recording when expires occurred (Asia/Manila). | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `sent_at` | `timestamp without time zone` | NO | *None* | *None* | Timestamp recording when sent occurred (Asia/Manila). | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `consumed_at` | `timestamp without time zone` | YES | *None* | *None* | Timestamp recording when consumed occurred (Asia/Manila). | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_30_000100_create_email_verification_otps_table.php` |
| `purpose` | `varchar(30)` | NO | `'email_verification'` | *None* | Attribute purpose for email_verification_otps. | `2026_10_19_000100_add_purpose_to_email_verification_otps.php` |
| `new_email` | `varchar(255)` | YES | *None* | *None* | Attribute new_email for email_verification_otps. | `2026_10_19_000100_add_purpose_to_email_verification_otps.php` |

---

## `failed_jobs`
**Module:** Queue Worker<br>
**Description:** Laravel dead-letter table recording failed background job executions.<br>
**Created In:** `0001_01_01_000002_create_jobs_table.php`<br>
**Total Columns:** 7<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** uuid

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for failed_jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `uuid` | `varchar(255)` | NO | *None* | `UNIQUE` | Attribute uuid for failed_jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `connection` | `varchar(255)` | NO | *None* | *None* | Attribute connection for failed_jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `queue` | `varchar(255)` | NO | *None* | *None* | Attribute queue for failed_jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `payload` | `text` | NO | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `0001_01_01_000002_create_jobs_table.php` |
| `exception` | `text` | NO | *None* | *None* | Attribute exception for failed_jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `failed_at` | `timestamp without time zone` | NO | *None* | *None* | Timestamp recording when failed occurred (Asia/Manila). | `0001_01_01_000002_create_jobs_table.php` |

---

## `followup_tasks`
**Module:** M20 Patient Follow-Up<br>
**Description:** Post-treatment follow-up recalls, patient care check-ins, and reminders.<br>
**Created In:** `2026_10_31_000200_create_followup_tasks.php`<br>
**Total Columns:** 22<br>
**PostgreSQL Triggers Attached (1):**<br>
- `followup_tasks_no_delete` (No-Delete Guard: BEFORE DELETE via `followup_tasks_no_delete()` in `2026_10_31_000200_create_followup_tasks.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `treatment_id` -> treatments.id (RESTRICT); `service_id` -> services.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `assignee_user_id` -> users.id (SET NULL); `appointment_id` -> appointments.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_31_000200_create_followup_tasks.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_31_000200_create_followup_tasks.php` |
| `treatment_id` | `bigint` | YES | *None* | `FK -> treatments.id (RESTRICT)` | Foreign key referencing the associated treatment record. | `2026_10_31_000200_create_followup_tasks.php` |
| `service_id` | `bigint` | YES | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_10_31_000200_create_followup_tasks.php` |
| `dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_31_000200_create_followup_tasks.php` |
| `reason` | `text` | NO | *None* | *None* | Attribute reason for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `due_on` | `date` | NO | *None* | *None* | Attribute due_on for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `assignee_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated assignee_user record. | `2026_10_31_000200_create_followup_tasks.php` |
| `source` | `varchar(12)` | NO | *None* | *None* | Attribute source for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `status` | `varchar(10)` | NO | `'Open'` | *None* | Current operational workflow status for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_10_31_000200_create_followup_tasks.php` |
| `close_note` | `text` | YES | *None* | *None* | Attribute close_note for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `contacted_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when contacted occurred (Asia/Manila). | `2026_10_31_000200_create_followup_tasks.php` |
| `booked_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when booked occurred (Asia/Manila). | `2026_10_31_000200_create_followup_tasks.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_31_000200_create_followup_tasks.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_31_000200_create_followup_tasks.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_31_000200_create_followup_tasks.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for followup_tasks. | `2026_10_31_000200_create_followup_tasks.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_31_000200_create_followup_tasks.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_31_000200_create_followup_tasks.php` |

---

## `hmo_case_events`
**Module:** M12 HMO Claims<br>
**Description:** Append-only audit log of insurer communications and claim adjudication events.<br>
**Created In:** `2026_10_04_000100_create_hmo_tables.php`<br>
**Total Columns:** 17<br>
**PostgreSQL Triggers Attached (1):**<br>
- `hmo_case_events_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `hmo_case_events_append_only()` in `2026_10_04_000100_create_hmo_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `hmo_case_id` -> hmo_cases.id (RESTRICT); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `hmo_case_id` | `bigint` | NO | *None* | `FK -> hmo_cases.id (RESTRICT)` | Foreign key referencing the associated hmo_case record. | `2026_10_04_000100_create_hmo_tables.php` |
| `kind` | `varchar(255)` | NO | *None* | *None* | Attribute kind for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `submission_cycle` | `integer` | NO | *None* | *None* | Attribute submission_cycle for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `to_status` | `varchar(255)` | NO | *None* | *None* | Attribute to_status for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `revision` | `integer` | NO | *None* | *None* | Attribute revision for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `method` | `varchar(255)` | YES | *None* | *None* | Attribute method for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `note` | `text` | YES | *None* | *None* | Attribute note for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `next_action` | `text` | YES | *None* | *None* | Attribute next_action for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `provider_reference` | `varchar(120)` | YES | *None* | *None* | Attribute provider_reference for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `outcome` | `varchar(255)` | YES | *None* | *None* | Attribute outcome for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `approved_amount` | `numeric(12, 2)` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_04_000100_create_hmo_tables.php` |
| `rule_keys` | `jsonb` | YES | *None* | *None* | Attribute rule_keys for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_10_04_000100_create_hmo_tables.php` |
| `actor_role` | `varchar(255)` | YES | *None* | *None* | Attribute actor_role for hmo_case_events. | `2026_10_04_000100_create_hmo_tables.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_10_04_000100_create_hmo_tables.php` |

---

## `hmo_case_requirements`
**Module:** M12 HMO Claims<br>
**Description:** Checklist of documentary requirements required by HMO providers per claim.<br>
**Created In:** `2026_10_04_000100_create_hmo_tables.php`<br>
**Total Columns:** 9<br>
**PostgreSQL Triggers Attached (1):**<br>
- `hmo_requirements_guard` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `hmo_requirements_guard()` in `2026_10_04_000100_create_hmo_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `hmo_case_id` -> hmo_cases.id (RESTRICT); `validated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for hmo_case_requirements. | `2026_10_04_000100_create_hmo_tables.php` |
| `hmo_case_id` | `bigint` | NO | *None* | `FK -> hmo_cases.id (RESTRICT)` | Foreign key referencing the associated hmo_case record. | `2026_10_04_000100_create_hmo_tables.php` |
| `rule_key` | `varchar(255)` | NO | *None* | *None* | Attribute rule_key for hmo_case_requirements. | `2026_10_04_000100_create_hmo_tables.php` |
| `state` | `varchar(255)` | NO | *None* | *None* | Attribute state for hmo_case_requirements. | `2026_10_04_000100_create_hmo_tables.php` |
| `document_label` | `varchar(200)` | YES | *None* | *None* | Attribute document_label for hmo_case_requirements. | `2026_10_04_000100_create_hmo_tables.php` |
| `validated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated validated_by_user record. | `2026_10_04_000100_create_hmo_tables.php` |
| `validated_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when validated occurred (Asia/Manila). | `2026_10_04_000100_create_hmo_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_04_000100_create_hmo_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_04_000100_create_hmo_tables.php` |

---

## `hmo_cases`
**Module:** M12 HMO Claims<br>
**Description:** Insurance claim cases tracking approval, submission, and settlement cycles.<br>
**Created In:** `2026_10_04_000100_create_hmo_tables.php`<br>
**Total Columns:** 19<br>
**PostgreSQL Triggers Attached (1):**<br>
- `hmo_cases_guard` (Insert Limit Guard: BEFORE INSERT OR UPDATE OR DELETE via `hmo_cases_guard()` in `2026_10_04_000100_create_hmo_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, visit_id
- **Foreign Keys:** `visit_id` -> UNIQUE, visits.id (RESTRICT); `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `membership_id` -> patient_hmo_memberships.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `visit_id` | `bigint` | NO | *None* | `UNIQUE, FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_10_04_000100_create_hmo_tables.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_04_000100_create_hmo_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_04_000100_create_hmo_tables.php` |
| `membership_id` | `bigint` | NO | *None* | `FK -> patient_hmo_memberships.id (RESTRICT)` | Foreign key referencing the associated membership record. | `2026_10_04_000100_create_hmo_tables.php` |
| `provider_name` | `varchar(120)` | NO | *None* | *None* | Attribute provider_name for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `member_number` | `varchar(80)` | NO | *None* | *None* | Attribute member_number for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `status` | `varchar(255)` | NO | *None* | *None* | Current operational workflow status for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `submission_cycle` | `integer` | NO | `0` | *None* | Attribute submission_cycle for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `submitted_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when submitted occurred (Asia/Manila). | `2026_10_04_000100_create_hmo_tables.php` |
| `escalated_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when escalated occurred (Asia/Manila). | `2026_10_04_000100_create_hmo_tables.php` |
| `final_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when final occurred (Asia/Manila). | `2026_10_04_000100_create_hmo_tables.php` |
| `approved_amount` | `numeric(12, 2)` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_04_000100_create_hmo_tables.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for hmo_cases. | `2026_10_04_000100_create_hmo_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_04_000100_create_hmo_tables.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_04_000100_create_hmo_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_04_000100_create_hmo_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_04_000100_create_hmo_tables.php` |

---

## `inquiries`
**Module:** M16 Inquiry Management<br>
**Description:** Front-desk social and phone inquiry leads tracked through conversion or closure.<br>
**Created In:** `2026_10_15_000100_create_inquiry_tables.php`<br>
**Total Columns:** 20<br>
**PostgreSQL Triggers Attached (1):**<br>
- `inquiries_guard` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `inquiries_guard()` in `2026_10_15_000100_create_inquiry_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `assigned_user_id` -> users.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT); `patient_id` -> patients.id (RESTRICT); `appointment_id` -> appointments.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `source` | `varchar(255)` | NO | *None* | *None* | Attribute source for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `capture_method` | `varchar(255)` | NO | `'staff_manual'` | *None* | Attribute capture_method for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `contact_name` | `varchar(120)` | NO | *None* | *None* | Attribute contact_name for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `contact_detail` | `varchar(200)` | YES | *None* | *None* | Attribute contact_detail for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `topic` | `varchar(500)` | NO | *None* | *None* | Attribute topic for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_15_000100_create_inquiry_tables.php` |
| `assigned_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated assigned_user record. | `2026_10_15_000100_create_inquiry_tables.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_15_000100_create_inquiry_tables.php` |
| `patient_id` | `bigint` | YES | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_15_000100_create_inquiry_tables.php` |
| `appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_10_15_000100_create_inquiry_tables.php` |
| `status` | `varchar(255)` | NO | `'Open'` | *None* | Current operational workflow status for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for inquiries. | `2026_10_15_000100_create_inquiry_tables.php` |
| `received_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when received occurred (Asia/Manila). | `2026_10_15_000100_create_inquiry_tables.php` |
| `responded_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when responded occurred (Asia/Manila). | `2026_10_15_000100_create_inquiry_tables.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_15_000100_create_inquiry_tables.php` |
| `converted_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when converted occurred (Asia/Manila). | `2026_10_15_000100_create_inquiry_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_15_000100_create_inquiry_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_15_000100_create_inquiry_tables.php` |

---

## `inquiry_history`
**Module:** M16 Inquiry Management<br>
**Description:** Append-only log of inquiry lifecycle status changes and responses.<br>
**Created In:** `2026_10_15_000100_create_inquiry_tables.php`<br>
**Total Columns:** 9<br>
**PostgreSQL Triggers Attached (1):**<br>
- `inquiry_history_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `inquiry_history_append_only()` in `2026_10_15_000100_create_inquiry_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `inquiry_id` -> inquiries.id (RESTRICT); `actor_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for inquiry_history. | `2026_10_15_000100_create_inquiry_tables.php` |
| `inquiry_id` | `bigint` | NO | *None* | `FK -> inquiries.id (RESTRICT)` | Foreign key referencing the associated inquiry record. | `2026_10_15_000100_create_inquiry_tables.php` |
| `event` | `varchar(255)` | NO | *None* | *None* | Attribute event for inquiry_history. | `2026_10_15_000100_create_inquiry_tables.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for inquiry_history. | `2026_10_15_000100_create_inquiry_tables.php` |
| `to_status` | `varchar(255)` | NO | *None* | *None* | Attribute to_status for inquiry_history. | `2026_10_15_000100_create_inquiry_tables.php` |
| `revision` | `integer` | NO | *None* | *None* | Attribute revision for inquiry_history. | `2026_10_15_000100_create_inquiry_tables.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | User who transitioned inquiry status or recorded the inquiry history event. | `2026_10_15_000100_create_inquiry_tables.php` |
| `actor_role` | `varchar(255)` | YES | *None* | *None* | Attribute actor_role for inquiry_history. | `2026_10_15_000100_create_inquiry_tables.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_10_15_000100_create_inquiry_tables.php` |

---

## `intake_submissions`
**Module:** M8 Patient Check-In<br>
**Description:** Encrypted patient self-registration forms submitted at counter QR or account.<br>
**Created In:** `2026_10_29_000200_create_intake_tables.php`<br>
**Total Columns:** 21<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

> [!IMPORTANT] STF-04 Scope Boundary:
> In `CounterIntake.jsx`, the receptionist counter form provides an 'Other valid ID' text field (`other_details`). Backend request validation and database persistence for this field remain **pending approval** (recorded as **Partial / In Progress**). This missing persistence is an incomplete implementation item awaiting client/team schema approval, **NOT** an intentional final design decision. No column has been added to `intake_submissions`.


**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, reference
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `account_patient_id` -> patients.id (RESTRICT); `patient_id` -> patients.id (RESTRICT); `visit_id` -> visits.id (RESTRICT); `confirmed_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `reference` | `varchar(12)` | NO | *None* | `UNIQUE` | Attribute reference for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_29_000200_create_intake_tables.php` |
| `channel` | `varchar(10)` | NO | *None* | *None* | Intake acquisition channel ('phone' or 'account'). Physical kiosk self-registration channel permanently removed under GEN-05. | `2026_10_29_000200_create_intake_tables.php` |
| `data` | `text` | YES | *None* | *None* | Attribute data for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `id_type` | `varchar(30)` | YES | *None* | *None* | Type of government-issued or valid identification presented during intake. | `2026_10_29_000200_create_intake_tables.php` |
| `scanned_fields` | `jsonb` | NO | `DB::raw("'[]'::jsonb"` | *None* | Attribute scanned_fields for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `join_queue` | `boolean` | NO | `false` | *None* | Attribute join_queue for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `visit_for` | `varchar(40)` | NO | `'self'` | *None* | Attribute visit_for for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `account_patient_id` | `bigint` | YES | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated account_patient record. | `2026_10_29_000200_create_intake_tables.php` |
| `status` | `varchar(20)` | NO | `'pending'` | *None* | Current operational workflow status for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `patient_id` | `bigint` | YES | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_29_000200_create_intake_tables.php` |
| `visit_id` | `bigint` | YES | *None* | `FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_10_29_000200_create_intake_tables.php` |
| `confirmed_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated confirmed_by_user record. | `2026_10_29_000200_create_intake_tables.php` |
| `confirmed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when confirmed occurred (Asia/Manila). | `2026_10_29_000200_create_intake_tables.php` |
| `consent_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when consent occurred (Asia/Manila). | `2026_10_29_000200_create_intake_tables.php` |
| `consent_version` | `varchar(20)` | NO | *None* | *None* | Attribute consent_version for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `device_hash` | `char(64)` | YES | *None* | *None* | Attribute device_hash for intake_submissions. | `2026_10_29_000200_create_intake_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_29_000200_create_intake_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_29_000200_create_intake_tables.php` |

---

## `invoice_histories`
**Module:** M11 Billing & Invoicing<br>
**Description:** Append-only audit trail of billing lifecycle events and payments.<br>
**Created In:** `2026_10_05_000100_create_billing_tables.php`<br>
**Total Columns:** 9<br>
**PostgreSQL Triggers Attached (1):**<br>
- `invoice_histories_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `m11_financial_append_only()` in `2026_10_05_000100_create_billing_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `invoice_id` -> invoices.id (CASCADE); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for invoice_histories. | `2026_10_05_000100_create_billing_tables.php` |
| `invoice_id` | `bigint` | NO | *None* | `FK -> invoices.id (CASCADE)` | Foreign key referencing the associated invoice record. | `2026_10_05_000100_create_billing_tables.php` |
| `event` | `varchar(255)` | NO | *None* | *None* | Attribute event for invoice_histories. | `2026_10_05_000100_create_billing_tables.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for invoice_histories. | `2026_10_05_000100_create_billing_tables.php` |
| `to_status` | `varchar(255)` | YES | *None* | *None* | Attribute to_status for invoice_histories. | `2026_10_05_000100_create_billing_tables.php` |
| `settlement_type` | `varchar(255)` | YES | *None* | *None* | Attribute settlement_type for invoice_histories. | `2026_10_05_000100_create_billing_tables.php` |
| `snapshot` | `jsonb` | YES | *None* | *None* | Attribute snapshot for invoice_histories. | `2026_10_05_000100_create_billing_tables.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_10_05_000100_create_billing_tables.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_10_05_000100_create_billing_tables.php` |

---

## `invoice_lines`
**Module:** M11 Billing & Invoicing<br>
**Description:** Itemized fee line items for performed services and applied discounts.<br>
**Created In:** `2026_10_05_000100_create_billing_tables.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `invoice_id` -> invoices.id (CASCADE); `service_id` -> services.id (RESTRICT); `service_price_id` -> service_prices.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for invoice_lines. | `2026_10_05_000100_create_billing_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for invoice_lines. | `2026_10_05_000100_create_billing_tables.php` |
| `invoice_id` | `bigint` | NO | *None* | `FK -> invoices.id (CASCADE)` | Foreign key referencing the associated invoice record. | `2026_10_05_000100_create_billing_tables.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_10_05_000100_create_billing_tables.php` |
| `service_price_id` | `bigint` | NO | *None* | `FK -> service_prices.id (RESTRICT)` | Foreign key referencing the associated service_price record. | `2026_10_05_000100_create_billing_tables.php` |
| `line_no` | `integer` | NO | *None* | *None* | Attribute line_no for invoice_lines. | `2026_10_05_000100_create_billing_tables.php` |
| `service_code` | `varchar(255)` | NO | *None* | *None* | Unique alphanumeric identifier or reference code. | `2026_10_05_000100_create_billing_tables.php` |
| `service_name` | `varchar(255)` | NO | *None* | *None* | Attribute service_name for invoice_lines. | `2026_10_05_000100_create_billing_tables.php` |
| `quantity` | `integer` | NO | *None* | *None* | Attribute quantity for invoice_lines. | `2026_10_05_000100_create_billing_tables.php` |
| `unit_price` | `numeric(12, 2)` | NO | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `line_total` | `numeric(12, 2)` | NO | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_05_000100_create_billing_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_05_000100_create_billing_tables.php` |

---

## `invoice_refunds`
**Module:** M11 Billing & Refunds<br>
**Description:** Audit-controlled refund records for returned payments or booking deposits.<br>
**Created In:** `2026_11_15_000200_create_invoice_refunds_table.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `invoice_refunds_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `invoice_refunds_append_only()` in `2026_11_15_000200_create_invoice_refunds_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, provider_refund_id
- **Foreign Keys:** `invoice_id` -> invoices.id (RESTRICT); `payment_id` -> payments.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for invoice_refunds. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for invoice_refunds. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `invoice_id` | `bigint` | NO | *None* | `FK -> invoices.id (RESTRICT)` | Foreign key referencing the associated invoice record. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `payment_id` | `bigint` | NO | *None* | `FK -> payments.id (RESTRICT)` | Foreign key referencing the associated payment record. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `provider_refund_id` | `varchar(120)` | YES | *None* | `UNIQUE` | Foreign key referencing the associated provider_refund record. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `amount` | `numeric(12, 2)` | NO | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `reason` | `varchar(255)` | NO | *None* | *None* | Attribute reason for invoice_refunds. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `refunded_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when refunded occurred (Asia/Manila). | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_11_15_000200_create_invoice_refunds_table.php` |

---

## `invoices`
**Module:** M11 Billing & Invoicing<br>
**Description:** Patient invoices generated from completed treatments or appointment bookings.<br>
**Created In:** `2026_10_05_000100_create_billing_tables.php`<br>
**Total Columns:** 30<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

> [!NOTE] GEN-11 Archive Columns Status:
> Columns `archived_at`, `archived_by_user_id`, and `archive_reason` are **[Reported by project owner as applied on production `dental_clinic`]** via migration `2026_11_15_000100_add_archive_columns_to_core_tables.php`. They are **[Not verified on hosted Supabase]** and require Joevan's confirmation.


**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, treatment_id, invoice_number
- **Foreign Keys:** `treatment_id` -> UNIQUE, treatments.id (RESTRICT); `visit_id` -> visits.id (RESTRICT); `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT); `updated_by_user_id` -> users.id (RESTRICT); `archived_by_user_id` -> users.id (RESTRICT)
- **Indexes:** archived_at

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `treatment_id` | `bigint` | NO | *None* | `UNIQUE, FK -> treatments.id (RESTRICT)` | Foreign key referencing the associated treatment record. | `2026_10_05_000100_create_billing_tables.php` |
| `visit_id` | `bigint` | NO | *None* | `FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_10_05_000100_create_billing_tables.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_05_000100_create_billing_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_05_000100_create_billing_tables.php` |
| `invoice_number` | `varchar(255)` | NO | *None* | `UNIQUE` | Attribute invoice_number for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `status` | `varchar(20)` | NO | *None* | *None* | Current operational workflow status for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `gross_amount` | `numeric(12, 2)` | NO | `0` | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `hmo_coverage_amount` | `numeric(12, 2)` | NO | `0` | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `patient_responsibility_amount` | `numeric(12, 2)` | NO | `0` | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `paid_amount` | `numeric(12, 2)` | NO | `0` | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `hmo_status` | `varchar(255)` | YES | *None* | *None* | Attribute hmo_status for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `hmo_approved_amount` | `numeric(12, 2)` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `settlement_type` | `varchar(255)` | YES | *None* | *None* | Attribute settlement_type for invoices. | `2026_10_05_000100_create_billing_tables.php` |
| `issued_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when issued occurred (Asia/Manila). | `2026_10_05_000100_create_billing_tables.php` |
| `paid_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when paid occurred (Asia/Manila). | `2026_10_05_000100_create_billing_tables.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_05_000100_create_billing_tables.php` |
| `updated_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated updated_by_user record. | `2026_10_05_000100_create_billing_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_05_000100_create_billing_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_05_000100_create_billing_tables.php` |
| `billed_to_name` | `varchar(255)` | YES | *None* | *None* | Attribute billed_to_name for invoices. | `2026_10_24_000100_patient_portal_foundations.php` |
| `discount_type` | `varchar(30)` | YES | *None* | *None* | Attribute discount_type for invoices. | `2026_11_02_000100_add_discounts_and_feedback_review.php` |
| `discount_id_number` | `varchar(50)` | YES | *None* | *None* | Attribute discount_id_number for invoices. | `2026_11_02_000100_add_discounts_and_feedback_review.php` |
| `discount_amount` | `numeric(12, 2)` | NO | `0` | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_11_02_000100_add_discounts_and_feedback_review.php` |
| `refund_status` | `varchar(40)` | NO | `'none'` | *None* | Attribute refund_status for invoices. | `2026_11_15_000200_create_invoice_refunds_table.php` |
| `archived_at` | `timestamp with time zone` | YES | *None* | `INDEX` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Soft-delete archive timestamp under the GEN-11 non-destructive standard. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archived_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Foreign key to users.id recording actor who archived this record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archive_reason` | `text` | YES | *None* | *None* | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Textual explanation provided when archiving the record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |

---

## `job_batches`
**Module:** Queue Worker<br>
**Description:** Laravel job batch management and progress tracking.<br>
**Created In:** `0001_01_01_000002_create_jobs_table.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `varchar(255)` | NO | *None* | `PK` | Primary surrogate key auto-incremented integer for job_batches. | `0001_01_01_000002_create_jobs_table.php` |
| `name` | `varchar(255)` | NO | *None* | *None* | Attribute name for job_batches. | `0001_01_01_000002_create_jobs_table.php` |
| `total_jobs` | `integer` | NO | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `0001_01_01_000002_create_jobs_table.php` |
| `pending_jobs` | `integer` | NO | *None* | *None* | Attribute pending_jobs for job_batches. | `0001_01_01_000002_create_jobs_table.php` |
| `failed_jobs` | `integer` | NO | *None* | *None* | Attribute failed_jobs for job_batches. | `0001_01_01_000002_create_jobs_table.php` |
| `failed_job_ids` | `text` | NO | *None* | *None* | Attribute failed_job_ids for job_batches. | `0001_01_01_000002_create_jobs_table.php` |
| `options` | `text` | YES | *None* | *None* | Attribute options for job_batches. | `0001_01_01_000002_create_jobs_table.php` |
| `cancelled_at` | `integer` | YES | *None* | *None* | Timestamp recording when cancelled occurred (Asia/Manila). | `0001_01_01_000002_create_jobs_table.php` |
| `created_at` | `integer` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `0001_01_01_000002_create_jobs_table.php` |
| `finished_at` | `integer` | YES | *None* | *None* | Timestamp recording when finished occurred (Asia/Manila). | `0001_01_01_000002_create_jobs_table.php` |

---

## `jobs`
**Module:** Queue Worker<br>
**Description:** Laravel database queue table for background job execution.<br>
**Created In:** `0001_01_01_000002_create_jobs_table.php`<br>
**Total Columns:** 7<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `queue` | `varchar(255)` | NO | *None* | *None* | Attribute queue for jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `payload` | `text` | NO | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `0001_01_01_000002_create_jobs_table.php` |
| `attempts` | `smallint` | NO | *None* | *None* | Attribute attempts for jobs. | `0001_01_01_000002_create_jobs_table.php` |
| `reserved_at` | `integer` | YES | *None* | *None* | Timestamp recording when reserved occurred (Asia/Manila). | `0001_01_01_000002_create_jobs_table.php` |
| `available_at` | `integer` | NO | *None* | *None* | Timestamp recording when available occurred (Asia/Manila). | `0001_01_01_000002_create_jobs_table.php` |
| `created_at` | `integer` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `0001_01_01_000002_create_jobs_table.php` |

---

## `leave_requests`
**Module:** M15 Leave Management<br>
**Description:** Leave requests filed by staff and dentists with owner decision workflow.<br>
**Created In:** `2026_10_30_000200_create_leave_requests.php`<br>
**Total Columns:** 17<br>
**PostgreSQL Triggers Attached (1):**<br>
- `leave_requests_no_delete` (No-Delete Guard: BEFORE DELETE via `leave_requests_no_delete()` in `2026_10_30_000200_create_leave_requests.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `requester_user_id` -> users.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `staff_profile_id` -> staff_profiles.id (RESTRICT); `decided_by_user_id` -> users.id (SET NULL); `cancelled_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for leave_requests. | `2026_10_30_000200_create_leave_requests.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for leave_requests. | `2026_10_30_000200_create_leave_requests.php` |
| `requester_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated requester_user record. | `2026_10_30_000200_create_leave_requests.php` |
| `dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_30_000200_create_leave_requests.php` |
| `staff_profile_id` | `bigint` | YES | *None* | `FK -> staff_profiles.id (RESTRICT)` | Foreign key referencing the associated staff_profile record. | `2026_10_30_000200_create_leave_requests.php` |
| `type` | `varchar(12)` | NO | *None* | *None* | Attribute type for leave_requests. | `2026_10_30_000200_create_leave_requests.php` |
| `starts_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when starts occurred (Asia/Manila). | `2026_10_30_000200_create_leave_requests.php` |
| `ends_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when ends occurred (Asia/Manila). | `2026_10_30_000200_create_leave_requests.php` |
| `private_note` | `text` | YES | *None* | *None* | Attribute private_note for leave_requests. | `2026_10_30_000200_create_leave_requests.php` |
| `status` | `varchar(10)` | NO | `'Pending'` | *None* | Current operational workflow status for leave_requests. | `2026_10_30_000200_create_leave_requests.php` |
| `decided_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated decided_by_user record. | `2026_10_30_000200_create_leave_requests.php` |
| `decided_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when decided occurred (Asia/Manila). | `2026_10_30_000200_create_leave_requests.php` |
| `cancelled_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated cancelled_by_user record. | `2026_10_30_000200_create_leave_requests.php` |
| `cancelled_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when cancelled occurred (Asia/Manila). | `2026_10_30_000200_create_leave_requests.php` |
| `patients_notified_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when patients_notified occurred (Asia/Manila). | `2026_10_30_000200_create_leave_requests.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_30_000200_create_leave_requests.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_30_000200_create_leave_requests.php` |

---

## `loyalty_accounts`
**Module:** M24 Referral & Loyalty<br>
**Description:** Patient reward point balances, tier status, and referral codes.<br>
**Created In:** `2026_11_16_000100_create_loyalty_and_referrals_tables.php`<br>
**Total Columns:** 8<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, patient_id, referral_code
- **Foreign Keys:** `patient_id` -> UNIQUE, patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for loyalty_accounts. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for loyalty_accounts. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `patient_id` | `bigint` | NO | *None* | `UNIQUE, FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `referral_code` | `varchar(32)` | NO | *None* | `UNIQUE` | Unique alphanumeric identifier or reference code. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `current_balance` | `integer` | NO | `0` | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |

---

## `loyalty_ledger`
**Module:** M24 Referral & Loyalty<br>
**Description:** Append-only ledger entries recording points earned, redeemed, or expired.<br>
**Created In:** `2026_11_16_000100_create_loyalty_and_referrals_tables.php`<br>
**Total Columns:** 17<br>
**PostgreSQL Triggers Attached (2):**<br>
- `check_ledger_reversal_limit` (Insert Limit Guard: BEFORE INSERT via `validate_ledger_reversal()` in `2026_11_16_000100_create_loyalty_and_referrals_tables.php`)
- `loyalty_ledger_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `loyalty_ledger_append_only()` in `2026_11_16_000100_create_loyalty_and_referrals_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, idempotency_key
- **Foreign Keys:** `loyalty_account_id` -> loyalty_accounts.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `refund_id` -> invoice_refunds.id (RESTRICT); `invoice_id` -> invoices.id (RESTRICT); `visit_id` -> visits.id (RESTRICT); `referral_id` -> referrals.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for loyalty_ledger. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for loyalty_ledger. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `loyalty_account_id` | `bigint` | NO | *None* | `FK -> loyalty_accounts.id (RESTRICT)` | Foreign key referencing the associated loyalty_account record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `points` | `integer` | NO | *None* | *None* | Attribute points for loyalty_ledger. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `entry_type` | `varchar(30)` | NO | *None* | *None* | Attribute entry_type for loyalty_ledger. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `reason_code` | `varchar(60)` | NO | *None* | *None* | Unique alphanumeric identifier or reference code. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `reverses_entry_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated reverses_entry record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `refund_id` | `bigint` | YES | *None* | `FK -> invoice_refunds.id (RESTRICT)` | Foreign key referencing the associated refund record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `invoice_id` | `bigint` | YES | *None* | `FK -> invoices.id (RESTRICT)` | Foreign key referencing the associated invoice record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `visit_id` | `bigint` | YES | *None* | `FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `referral_id` | `bigint` | YES | *None* | `FK -> referrals.id (RESTRICT)` | Foreign key referencing the associated referral record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `idempotency_key` | `varchar(120)` | YES | *None* | `UNIQUE` | Attribute idempotency_key for loyalty_ledger. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `expires_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when expires occurred (Asia/Manila). | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `unrecovered_points` | `integer` | NO | `0` | *None* | Attribute unrecovered_points for loyalty_ledger. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |

---

## `loyalty_lot_consumptions`
**Module:** M24 Referral & Loyalty<br>
**Description:** FIFO point consumption records tracking redemptions against specific earned lots.<br>
**Created In:** `2026_11_16_000100_create_loyalty_and_referrals_tables.php`<br>
**Total Columns:** 6<br>
**PostgreSQL Triggers Attached (2):**<br>
- `loyalty_lot_consumptions_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `loyalty_lot_consumptions_append_only()` in `2026_11_16_000100_create_loyalty_and_referrals_tables.php`)
- `check_lot_consumption_limit` (Insert Limit Guard: BEFORE INSERT via `validate_lot_consumption()` in `2026_11_16_000100_create_loyalty_and_referrals_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `redeem_entry_id` -> loyalty_ledger.id (RESTRICT); `earn_entry_id` -> loyalty_ledger.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for loyalty_lot_consumptions. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for loyalty_lot_consumptions. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `redeem_entry_id` | `bigint` | NO | *None* | `FK -> loyalty_ledger.id (RESTRICT)` | Foreign key referencing the associated redeem_entry record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `earn_entry_id` | `bigint` | NO | *None* | `FK -> loyalty_ledger.id (RESTRICT)` | Foreign key referencing the associated earn_entry record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `points` | `integer` | NO | *None* | *None* | Attribute points for loyalty_lot_consumptions. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |

---

## `m11_billing_cutovers`
**Module:** M11 Billing Transition<br>
**Description:** Cutover marker establishing migration date for backend-authoritative billing.<br>
**Created In:** `2026_10_05_000100_create_billing_tables.php`<br>
**Total Columns:** 4<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for m11_billing_cutovers. | `2026_10_05_000100_create_billing_tables.php` |
| `established_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when established occurred (Asia/Manila). | `2026_10_05_000100_create_billing_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_05_000100_create_billing_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_05_000100_create_billing_tables.php` |

---

## `mail_dispatch_attempts`
**Module:** M18 Email Dispatch<br>
**Description:** Append-only log of SMTP delivery attempts, response codes, and errors.<br>
**Created In:** `2026_10_18_000100_create_mail_dispatch_tables.php`<br>
**Total Columns:** 9<br>
**PostgreSQL Triggers Attached (1):**<br>
- `mail_dispatch_attempts_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `mail_dispatch_attempts_append_only()` in `2026_10_18_000100_create_mail_dispatch_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `mail_dispatch_id` -> mail_dispatches.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for mail_dispatch_attempts. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `mail_dispatch_id` | `bigint` | NO | *None* | `FK -> mail_dispatches.id (RESTRICT)` | Foreign key referencing the associated mail_dispatch record. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `attempt_no` | `smallint` | NO | *None* | *None* | Attribute attempt_no for mail_dispatch_attempts. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `outcome` | `varchar(30)` | NO | *None* | *None* | Attribute outcome for mail_dispatch_attempts. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `mailer` | `varchar(40)` | YES | *None* | *None* | Attribute mailer for mail_dispatch_attempts. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `transport_kind` | `varchar(20)` | YES | *None* | *None* | Attribute transport_kind for mail_dispatch_attempts. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `error_class` | `varchar(191)` | YES | *None* | *None* | PHP exception or mail transport error class name captured during failed dispatch. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `started_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when started occurred (Asia/Manila). | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `finished_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when finished occurred (Asia/Manila). | `2026_10_18_000100_create_mail_dispatch_tables.php` |

---

## `mail_dispatches`
**Module:** M18 Email Dispatch<br>
**Description:** Asynchronous email queue tracking dispatch status, templates, and recipients.<br>
**Created In:** `2026_10_18_000100_create_mail_dispatch_tables.php`<br>
**Total Columns:** 22<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, dedupe_key (UK: mail_dispatches_dedupe_key_unique)
- **Foreign Keys:** `recipient_user_id` -> users.id (SET NULL); `created_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `purpose` | `varchar(60)` | NO | *None* | *None* | Attribute purpose for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `dedupe_key` | `varchar(191)` | NO | *None* | `UK (mail_dispatches_dedupe_key_unique)` | Unique deduplication key preventing duplicate outbound email transmissions. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `subject_type` | `varchar(40)` | YES | *None* | *None* | Attribute subject_type for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `subject_public_id` | `varchar(50)` | YES | *None* | *None* | Foreign key referencing the associated subject_public record. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `subject_revision` | `integer` | YES | *None* | *None* | Attribute subject_revision for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `recipient_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated recipient_user record. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `retryable` | `boolean` | NO | `true` | *None* | Attribute retryable for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `status` | `varchar(30)` | NO | `'pending'` | *None* | Current operational workflow status for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `attempts` | `smallint` | NO | `0` | *None* | Attribute attempts for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `max_attempts` | `smallint` | NO | `1` | *None* | Attribute max_attempts for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `next_attempt_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when next_attempt occurred (Asia/Manila). | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `locked_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when locked occurred (Asia/Manila). | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `failure_reason` | `varchar(40)` | YES | *None* | *None* | Attribute failure_reason for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `mailer` | `varchar(40)` | YES | *None* | *None* | Attribute mailer for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `transport_kind` | `varchar(20)` | YES | *None* | *None* | Attribute transport_kind for mail_dispatches. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `completed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when completed occurred (Asia/Manila). | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `delivery_confirmed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when delivery_confirmed occurred (Asia/Manila). | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_18_000100_create_mail_dispatch_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_18_000100_create_mail_dispatch_tables.php` |

---

## `message_templates`
**Module:** M18 Notifications<br>
**Description:** Owner-configured and dentist-approved message wording templates.<br>
**Created In:** `2026_10_28_000100_create_message_templates_table.php`<br>
**Total Columns:** 12<br>
**PostgreSQL Triggers Attached (1):**<br>
- `message_templates_no_delete` (No-Delete Guard: BEFORE DELETE via `message_templates_no_delete()` in `2026_10_28_000100_create_message_templates_table.php`)

**Key Constraints:**
- **Primary Key:** key
- **Foreign Keys:** `approved_by_user_id` -> users.id (SET NULL); `dentist_approved_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `key` | `varchar(40)` | NO | *None* | `PK` | Attribute key for message_templates. | `2026_10_28_000100_create_message_templates_table.php` |
| `subject` | `varchar(160)` | NO | *None* | *None* | Attribute subject for message_templates. | `2026_10_28_000100_create_message_templates_table.php` |
| `body` | `text` | NO | *None* | *None* | Attribute body for message_templates. | `2026_10_28_000100_create_message_templates_table.php` |
| `needs_dentist` | `boolean` | NO | `false` | *None* | Attribute needs_dentist for message_templates. | `2026_10_28_000100_create_message_templates_table.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for message_templates. | `2026_10_28_000100_create_message_templates_table.php` |
| `approved_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated approved_by_user record. | `2026_10_28_000100_create_message_templates_table.php` |
| `approved_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when approved occurred (Asia/Manila). | `2026_10_28_000100_create_message_templates_table.php` |
| `dentist_approved_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated dentist_approved_by_user record. | `2026_10_28_000100_create_message_templates_table.php` |
| `dentist_approved_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when dentist_approved occurred (Asia/Manila). | `2026_10_28_000100_create_message_templates_table.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_28_000100_create_message_templates_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_28_000100_create_message_templates_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_28_000100_create_message_templates_table.php` |

---

## `no_show_flags`
**Module:** M6 Appointment Booking<br>
**Description:** Predictive and marked no-show tracking for front-desk follow-up.<br>
**Created In:** `2026_10_27_000200_create_no_show_flags_table.php`<br>
**Total Columns:** 11<br>
**PostgreSQL Triggers Attached (1):**<br>
- `no_show_flags_guard` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `no_show_flags_guard()` in `2026_10_27_000200_create_no_show_flags_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, appointment_id
- **Foreign Keys:** `appointment_id` -> UNIQUE, appointments.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `resolved_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for no_show_flags. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for no_show_flags. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `appointment_id` | `bigint` | NO | *None* | `UNIQUE, FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `appointment_revision` | `integer` | NO | *None* | *None* | Attribute appointment_revision for no_show_flags. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `status` | `varchar(20)` | NO | `'open'` | *None* | Current operational workflow status for no_show_flags. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `flagged_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when flagged occurred (Asia/Manila). | `2026_10_27_000200_create_no_show_flags_table.php` |
| `resolved_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when resolved occurred (Asia/Manila). | `2026_10_27_000200_create_no_show_flags_table.php` |
| `resolved_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated resolved_by_user record. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_27_000200_create_no_show_flags_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_27_000200_create_no_show_flags_table.php` |

---

## `password_reset_tokens`
**Module:** M1 (Framework)<br>
**Description:** Laravel framework table for secure password reset tokens.<br>
**Created In:** `0001_01_01_000000_create_users_table.php`<br>
**Total Columns:** 3<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** email

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `email` | `varchar(255)` | NO | *None* | `PK` | Attribute email for password_reset_tokens. | `0001_01_01_000000_create_users_table.php` |
| `token` | `varchar(255)` | NO | *None* | *None* | Attribute token for password_reset_tokens. | `0001_01_01_000000_create_users_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `0001_01_01_000000_create_users_table.php` |

---

## `patient_consents`
**Module:** M14 Consent Management<br>
**Description:** Formal medical and data privacy consent records granted or withdrawn by patients.<br>
**Created In:** `2026_10_06_000100_create_document_tables.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `document_id` -> documents.id (SET NULL); `recorded_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for patient_consents. | `2026_10_06_000100_create_document_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for patient_consents. | `2026_10_06_000100_create_document_tables.php` |
| `patient_id` | `foreign` | NO | *None* | *None* | Foreign key referencing the associated patient record. | `2026_10_12_000100_harden_document_integrity.php` |
| `document_id` | `bigint` | YES | *None* | `FK -> documents.id (SET NULL)` | Foreign key referencing the associated document record. | `2026_10_06_000100_create_document_tables.php` |
| `consent_type` | `varchar(64)` | NO | *None* | *None* | Attribute consent_type for patient_consents. | `2026_10_06_000100_create_document_tables.php` |
| `version` | `varchar(32)` | NO | `'1.0'` | *None* | Attribute version for patient_consents. | `2026_10_06_000100_create_document_tables.php` |
| `status` | `varchar(32)` | NO | `'Granted'` | *None* | Current operational workflow status for patient_consents. | `2026_10_06_000100_create_document_tables.php` |
| `notes` | `text` | YES | *None* | *None* | Free-form administrative or clinical text notes. | `2026_10_06_000100_create_document_tables.php` |
| `signed_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when signed occurred (Asia/Manila). | `2026_10_06_000100_create_document_tables.php` |
| `withdrawn_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when withdrawn occurred (Asia/Manila). | `2026_10_06_000100_create_document_tables.php` |
| `recorded_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated recorded_by_user record. | `2026_10_06_000100_create_document_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_06_000100_create_document_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_06_000100_create_document_tables.php` |

---

## `patient_guardians`
**Module:** M4 Patient Records<br>
**Description:** Guardian/dependent relationships linking minors or dependents to parents/guardians.<br>
**Created In:** `2026_10_29_000200_create_intake_tables.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached (1):**<br>
- `patient_guardians_guard` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `patient_guardians_guard()` in `2026_10_29_000200_create_intake_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `dependent_patient_id` -> patients.id (RESTRICT); `guardian_patient_id` -> patients.id (RESTRICT); `consent_by_user_id` -> users.id (SET NULL); `ended_by_user_id` -> users.id (SET NULL); `created_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for patient_guardians. | `2026_10_29_000200_create_intake_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for patient_guardians. | `2026_10_29_000200_create_intake_tables.php` |
| `dependent_patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated dependent_patient record. | `2026_10_29_000200_create_intake_tables.php` |
| `guardian_patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated guardian_patient record. | `2026_10_29_000200_create_intake_tables.php` |
| `relationship` | `varchar(40)` | NO | *None* | *None* | Attribute relationship for patient_guardians. | `2026_10_29_000200_create_intake_tables.php` |
| `consent_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when consent occurred (Asia/Manila). | `2026_10_29_000200_create_intake_tables.php` |
| `consent_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated consent_by_user record. | `2026_10_29_000200_create_intake_tables.php` |
| `status` | `varchar(10)` | NO | `'active'` | *None* | Current operational workflow status for patient_guardians. | `2026_10_29_000200_create_intake_tables.php` |
| `ended_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when ended occurred (Asia/Manila). | `2026_10_29_000200_create_intake_tables.php` |
| `ended_reason` | `varchar(30)` | YES | *None* | *None* | Attribute ended_reason for patient_guardians. | `2026_10_29_000200_create_intake_tables.php` |
| `ended_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated ended_by_user record. | `2026_10_29_000200_create_intake_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_29_000200_create_intake_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_29_000200_create_intake_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_29_000200_create_intake_tables.php` |

---

## `patient_handovers`
**Module:** M25 Patient Handovers<br>
**Description:** Shift handovers and patient transfer logs between clinical team members.<br>
**Created In:** `2026_10_30_000300_create_patient_handovers.php`<br>
**Total Columns:** 19<br>
**PostgreSQL Triggers Attached (1):**<br>
- `patient_handovers_no_delete` (No-Delete Guard: BEFORE DELETE via `patient_handovers_no_delete()` in `2026_10_30_000300_create_patient_handovers.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `from_branch_id` -> branches.id (RESTRICT); `to_branch_id` -> branches.id (RESTRICT); `from_dentist_profile_id` -> dentist_profiles.id (RESTRICT); `to_dentist_profile_id` -> dentist_profiles.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT); `acknowledged_by_user_id` -> users.id (SET NULL); `cancelled_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for patient_handovers. | `2026_10_30_000300_create_patient_handovers.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for patient_handovers. | `2026_10_30_000300_create_patient_handovers.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_30_000300_create_patient_handovers.php` |
| `from_branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated from_branch record. | `2026_10_30_000300_create_patient_handovers.php` |
| `to_branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated to_branch record. | `2026_10_30_000300_create_patient_handovers.php` |
| `from_dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated from_dentist_profile record. | `2026_10_30_000300_create_patient_handovers.php` |
| `to_dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated to_dentist_profile record. | `2026_10_30_000300_create_patient_handovers.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_30_000300_create_patient_handovers.php` |
| `summary` | `text` | NO | *None* | *None* | Attribute summary for patient_handovers. | `2026_10_30_000300_create_patient_handovers.php` |
| `pending_treatment` | `text` | YES | *None* | *None* | Attribute pending_treatment for patient_handovers. | `2026_10_30_000300_create_patient_handovers.php` |
| `notes` | `text` | YES | *None* | *None* | Free-form administrative or clinical text notes. | `2026_10_30_000300_create_patient_handovers.php` |
| `document_ids` | `jsonb` | NO | `DB::raw("'[]'::jsonb"` | *None* | Attribute document_ids for patient_handovers. | `2026_10_30_000300_create_patient_handovers.php` |
| `status` | `varchar(14)` | NO | `'Sent'` | *None* | Current operational workflow status for patient_handovers. | `2026_10_30_000300_create_patient_handovers.php` |
| `acknowledged_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated acknowledged_by_user record. | `2026_10_30_000300_create_patient_handovers.php` |
| `acknowledged_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when acknowledged occurred (Asia/Manila). | `2026_10_30_000300_create_patient_handovers.php` |
| `cancelled_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated cancelled_by_user record. | `2026_10_30_000300_create_patient_handovers.php` |
| `cancelled_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when cancelled occurred (Asia/Manila). | `2026_10_30_000300_create_patient_handovers.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_30_000300_create_patient_handovers.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_30_000300_create_patient_handovers.php` |

---

## `patient_hmo_memberships`
**Module:** M12 HMO Claims<br>
**Description:** Patient insurance policy records, member IDs, and active coverage status.<br>
**Created In:** `2026_10_04_000100_create_hmo_tables.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `hmo_memberships_history` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `hmo_memberships_history()` in `2026_10_04_000100_create_hmo_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT); `ended_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for patient_hmo_memberships. | `2026_10_04_000100_create_hmo_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for patient_hmo_memberships. | `2026_10_04_000100_create_hmo_tables.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_04_000100_create_hmo_tables.php` |
| `provider_name` | `varchar(120)` | NO | *None* | *None* | Attribute provider_name for patient_hmo_memberships. | `2026_10_04_000100_create_hmo_tables.php` |
| `member_number` | `varchar(80)` | NO | *None* | *None* | Attribute member_number for patient_hmo_memberships. | `2026_10_04_000100_create_hmo_tables.php` |
| `status` | `varchar(255)` | NO | *None* | *None* | Current operational workflow status for patient_hmo_memberships. | `2026_10_04_000100_create_hmo_tables.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_04_000100_create_hmo_tables.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_04_000100_create_hmo_tables.php` |
| `ended_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when ended occurred (Asia/Manila). | `2026_10_04_000100_create_hmo_tables.php` |
| `ended_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated ended_by_user record. | `2026_10_04_000100_create_hmo_tables.php` |

---

## `patients`
**Module:** M4 Patient Records<br>
**Description:** Clinical patient profile linked to persons hub, emergency contacts, and HMO metadata.<br>
**Created In:** `2026_09_24_000200_create_patients_table.php`<br>
**Total Columns:** 20<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** person_id, patient_code (UK: patients_patient_code_unique)
- **Foreign Keys:** `person_id` -> UNIQUE, persons.id (CASCADE); `preferred_branch_id` -> branches.id (RESTRICT); `id_verified_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for patients. | `2026_09_24_000200_create_patients_table.php` |
| `person_id` | `bigint` | NO | *None* | `UNIQUE, FK -> persons.id (CASCADE)` | Foreign key referencing the associated person record. | `2026_09_24_000200_create_patients_table.php` |
| `patient_code` | `varchar(255)` | NO | *None* | `UK (patients_patient_code_unique)` | Canonical clinic patient code (e.g. PAT-000123) for clinic identification. | `2026_09_24_000200_create_patients_table.php` |
| `consent` | `boolean` | NO | `false` | *None* | Attribute consent for patients. | `2026_09_24_000200_create_patients_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_24_000200_create_patients_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_24_000200_create_patients_table.php` |
| `public_id` | `unique` | NO | *None* | *None* | Deterministic, URL-safe public obfuscated identifier for patients. | `2026_09_28_000050_add_public_id_to_patients_table.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for patients. | `2026_10_11_000100_add_patient_record_fields.php` |
| `emergency_contact` | `varchar(500)` | YES | *None* | *None* | Attribute emergency_contact for patients. | `2026_10_11_000100_add_patient_record_fields.php` |
| `preferred_branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated preferred_branch record. | `2026_10_11_000100_add_patient_record_fields.php` |
| `billing_address` | `jsonb` | YES | *None* | *None* | Attribute billing_address for patients. | `2026_10_22_000100_billing_address_and_checkout_fingerprint.php` |
| `confirmation_required_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when confirmation_required occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `attendance_cleared_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when attendance_cleared occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `hmo_provider_name` | `varchar(120)` | YES | *None* | *None* | Attribute hmo_provider_name for patients. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `hmo_member_number` | `text` | YES | *None* | *None* | Attribute hmo_member_number for patients. | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` |
| `registration_source` | `varchar(20)` | YES | *None* | *None* | Attribute registration_source for patients. | `2026_10_29_000200_create_intake_tables.php` |
| `id_type` | `varchar(30)` | YES | *None* | *None* | Attribute id_type for patients. | `2026_10_29_000200_create_intake_tables.php` |
| `id_last4` | `varchar(4)` | YES | *None* | *None* | Attribute id_last4 for patients. | `2026_10_29_000200_create_intake_tables.php` |
| `id_verified_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated id_verified_by_user record. | `2026_10_29_000200_create_intake_tables.php` |
| `id_verified_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when id_verified occurred (Asia/Manila). | `2026_10_29_000200_create_intake_tables.php` |

---

## `payment_checkout_sessions`
**Module:** M11 Payment Gateway<br>
**Description:** PayMongo hosted checkout sessions for online and card payments.<br>
**Created In:** `2026_10_14_000100_harden_m11_payment_integrity.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, provider_session_id
- **Foreign Keys:** `initiated_by_user_id` -> users.id (RESTRICT); `appointment_id` -> appointments.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for payment_checkout_sessions. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for payment_checkout_sessions. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `invoice_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated invoice record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `provider` | `varchar(20)` | NO | `'paymongo'` | *None* | Attribute provider for payment_checkout_sessions. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `provider_session_id` | `varchar(120)` | NO | *None* | `UNIQUE` | Foreign key referencing the associated provider_session record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `checkout_url` | `text` | YES | *None* | *None* | Attribute checkout_url for payment_checkout_sessions. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `amount` | `numeric(12,2)` | NO | *None* | *None* | Exact monetary amount in PHP authorized for the checkout session. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `currency` | `char(3)` | NO | `'PHP'` | *None* | Attribute currency for payment_checkout_sessions. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `status` | `varchar(20)` | NO | `'Open'` | *None* | Current operational workflow status for payment_checkout_sessions. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `initiated_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated initiated_by_user record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `request_fingerprint` | `char(64)` | YES | *None* | *None* | Attribute request_fingerprint for payment_checkout_sessions. | `2026_10_22_000100_billing_address_and_checkout_fingerprint.php` |
| `appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |

---

## `payment_provider_events`
**Module:** M11 Payment Gateway<br>
**Description:** Append-only log of PayMongo webhook events for idempotency.<br>
**Created In:** `2026_10_14_000100_harden_m11_payment_integrity.php`<br>
**Total Columns:** 17<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, provider_event_id
- **Foreign Keys:** `invoice_id` -> invoices.id (RESTRICT); `appointment_id` -> appointments.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `provider` | `varchar(20)` | NO | `'paymongo'` | *None* | Attribute provider for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `provider_event_id` | `varchar(120)` | NO | *None* | `UNIQUE` | Foreign key referencing the associated provider_event record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `event_type` | `varchar(100)` | NO | *None* | *None* | Attribute event_type for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `provider_session_id` | `varchar(120)` | YES | *None* | *None* | Foreign key referencing the associated provider_session record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `provider_payment_id` | `varchar(120)` | YES | *None* | *None* | Foreign key referencing the associated provider_payment record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `invoice_id` | `bigint` | YES | *None* | `FK -> invoices.id (RESTRICT)` | Foreign key referencing the associated invoice record. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `amount_centavos` | `bigint` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `currency` | `char(3)` | YES | *None* | *None* | Attribute currency for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `status` | `index` | NO | *None* | *None* | Current operational workflow status for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `reason` | `varchar(60)` | YES | *None* | *None* | Attribute reason for payment_provider_events. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `received_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when received occurred (Asia/Manila). | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `processed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when processed occurred (Asia/Manila). | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_14_000100_harden_m11_payment_integrity.php` |
| `appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_11_01_000100_add_booking_payment_to_appointments.php` |

---

## `payments`
**Module:** M11 Billing & Payments<br>
**Description:** Recorded financial transactions (cash, credit card, GCash, Maya, PayMongo).<br>
**Created In:** `2026_10_05_000100_create_billing_tables.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `payments_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `m11_financial_append_only()` in `2026_10_05_000100_create_billing_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, invoice_id
- **Foreign Keys:** `invoice_id` -> UNIQUE, invoices.id (RESTRICT); `recorded_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for payments. | `2026_10_05_000100_create_billing_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for payments. | `2026_10_05_000100_create_billing_tables.php` |
| `invoice_id` | `bigint` | NO | *None* | `UNIQUE, FK -> invoices.id (RESTRICT)` | Foreign key referencing the associated invoice record. | `2026_10_05_000100_create_billing_tables.php` |
| `amount` | `numeric(12, 2)` | NO | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `method` | `varchar(30)` | NO | *None* | *None* | Attribute method for payments. | `2026_10_05_000100_create_billing_tables.php` |
| `external_reference` | `varchar(255)` | YES | *None* | *None* | Attribute external_reference for payments. | `2026_10_05_000100_create_billing_tables.php` |
| `recorded_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated recorded_by_user record. | `2026_10_05_000100_create_billing_tables.php` |
| `recorded_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when recorded occurred (Asia/Manila). | `2026_10_05_000100_create_billing_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_05_000100_create_billing_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_05_000100_create_billing_tables.php` |

---

## `personal_access_tokens`
**Module:** M1 (Framework)<br>
**Description:** Laravel Sanctum API tokens for mobile/stateless API authentication.<br>
**Created In:** `2026_09_24_045331_create_personal_access_tokens_table.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** token

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for personal_access_tokens. | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `tokenable_type` | `varchar(255)` | NO | *None* | `Index (tokenable_type, tokenable_id)` | Polymorphic parent model class name (typically App\Models\User). | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `tokenable_id` | `bigint` | NO | *None* | `Index (tokenable_type, tokenable_id)` | Polymorphic parent model primary key integer. | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `name` | `text` | NO | *None* | *None* | Attribute name for personal_access_tokens. | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `token` | `varchar(64)` | NO | *None* | `UNIQUE` | Attribute token for personal_access_tokens. | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `abilities` | `text` | YES | *None* | *None* | Attribute abilities for personal_access_tokens. | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `last_used_at` | `timestamp without time zone` | YES | *None* | *None* | Timestamp recording when last_used occurred (Asia/Manila). | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `expires_at` | `timestamp without time zone` | YES | *None* | *None* | Timestamp recording when expires occurred (Asia/Manila). | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_24_045331_create_personal_access_tokens_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_24_045331_create_personal_access_tokens_table.php` |

---

## `persons`
**Module:** M1 Identity & Personnel<br>
**Description:** Core identity hub for all individuals in the clinic system (patients, staff, dentists, owners).<br>
**Created In:** `0000_01_01_000000_create_persons_table.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for persons. | `0000_01_01_000000_create_persons_table.php` |
| `first_name` | `varchar(255)` | NO | *None* | *None* | Given first name of the individual. | `0000_01_01_000000_create_persons_table.php` |
| `last_name` | `varchar(255)` | NO | *None* | *None* | Surname / family name of the individual. | `0000_01_01_000000_create_persons_table.php` |
| `phone` | `varchar(255)` | YES | *None* | *None* | Primary contact mobile/telephone number. | `0000_01_01_000000_create_persons_table.php` |
| `date_of_birth` | `date` | YES | *None* | *None* | Legal calendar date of birth. | `0000_01_01_000000_create_persons_table.php` |
| `sex` | `varchar(255)` | YES | *None* | *None* | Biological sex assigned at birth ('M' or 'F'). | `0000_01_01_000000_create_persons_table.php` |
| `address` | `varchar(255)` | YES | *None* | *None* | Attribute address for persons. | `0000_01_01_000000_create_persons_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `0000_01_01_000000_create_persons_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `0000_01_01_000000_create_persons_table.php` |
| `email` | `unique` | NO | *None* | *None* | Primary contact email address. | `0000_01_01_000000_create_persons_table.php` |

---

## `prescription_counters`
**Module:** M19 Digital Prescriptions<br>
**Description:** Atomic annual sequence counter for gapless prescription numbering.<br>
**Created In:** `2026_10_31_000100_create_prescriptions.php`<br>
**Total Columns:** 2<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** year

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `year` | `smallint` | NO | *None* | `PK` | Attribute year for prescription_counters. | `2026_10_31_000100_create_prescriptions.php` |
| `last_number` | `integer` | NO | `0` | *None* | Attribute last_number for prescription_counters. | `2026_10_31_000100_create_prescriptions.php` |

---

## `prescription_lines`
**Module:** M19 Digital Prescriptions<br>
**Description:** Itemized prescription medications, dosages, frequency, and instructions.<br>
**Created In:** `2026_10_31_000100_create_prescriptions.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `prescription_lines_guard` (Insert Limit Guard: BEFORE INSERT OR UPDATE OR DELETE via `prescription_lines_guard()` in `2026_10_31_000100_create_prescriptions.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `prescription_id` -> prescriptions.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `prescription_id` | `bigint` | NO | *None* | `FK -> prescriptions.id (RESTRICT)` | Foreign key referencing the associated prescription record. | `2026_10_31_000100_create_prescriptions.php` |
| `line_no` | `smallint` | NO | *None* | *None* | Attribute line_no for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `medicine` | `text` | NO | *None* | *None* | Attribute medicine for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `dosage` | `text` | YES | *None* | *None* | Attribute dosage for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `frequency` | `text` | YES | *None* | *None* | Attribute frequency for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `duration` | `text` | YES | *None* | *None* | Attribute duration for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `instructions` | `text` | YES | *None* | *None* | Attribute instructions for prescription_lines. | `2026_10_31_000100_create_prescriptions.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_31_000100_create_prescriptions.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_31_000100_create_prescriptions.php` |

---

## `prescriptions`
**Module:** M19 Digital Prescriptions<br>
**Description:** Dentist-issued electronic prescriptions with digital signature references.<br>
**Created In:** `2026_10_31_000100_create_prescriptions.php`<br>
**Total Columns:** 23<br>
**PostgreSQL Triggers Attached (1):**<br>
- `prescriptions_guard` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `prescriptions_guard()` in `2026_10_31_000100_create_prescriptions.php`)

> [!NOTE] GEN-11 Archive Columns Status:
> Columns `archived_at`, `archived_by_user_id`, and `archive_reason` are **[Reported by project owner as applied on production `dental_clinic`]** via migration `2026_11_15_000100_add_archive_columns_to_core_tables.php`. They are **[Not verified on hosted Supabase]** and require Joevan's confirmation.


**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, number
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `visit_id` -> visits.id (RESTRICT); `treatment_id` -> treatments.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT); `issued_by_user_id` -> users.id (SET NULL); `voided_by_user_id` -> users.id (SET NULL); `archived_by_user_id` -> users.id (RESTRICT)
- **Indexes:** archived_at

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `number` | `varchar(20)` | YES | *None* | `UNIQUE` | Attribute number for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_31_000100_create_prescriptions.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_31_000100_create_prescriptions.php` |
| `visit_id` | `bigint` | NO | *None* | `FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_10_31_000100_create_prescriptions.php` |
| `treatment_id` | `bigint` | YES | *None* | `FK -> treatments.id (RESTRICT)` | Foreign key referencing the associated treatment record. | `2026_10_31_000100_create_prescriptions.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_31_000100_create_prescriptions.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_31_000100_create_prescriptions.php` |
| `status` | `varchar(8)` | NO | `'Draft'` | *None* | Current operational workflow status for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `note` | `text` | YES | *None* | *None* | Attribute note for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `license_no` | `varchar(40)` | YES | *None* | *None* | Attribute license_no for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `issued_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when issued occurred (Asia/Manila). | `2026_10_31_000100_create_prescriptions.php` |
| `issued_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated issued_by_user record. | `2026_10_31_000100_create_prescriptions.php` |
| `voided_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when voided occurred (Asia/Manila). | `2026_10_31_000100_create_prescriptions.php` |
| `voided_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated voided_by_user record. | `2026_10_31_000100_create_prescriptions.php` |
| `void_reason` | `varchar(300)` | YES | *None* | *None* | Attribute void_reason for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for prescriptions. | `2026_10_31_000100_create_prescriptions.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_31_000100_create_prescriptions.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_31_000100_create_prescriptions.php` |
| `archived_at` | `timestamp with time zone` | YES | *None* | `INDEX` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Soft-delete archive timestamp under the GEN-11 non-destructive standard. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archived_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Foreign key to users.id recording actor who archived this record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archive_reason` | `text` | YES | *None* | *None* | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Textual explanation provided when archiving the record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |

---

## `queue_entries`
**Module:** M9 Patient Queue<br>
**Description:** Individual patient waiting queue state, queue numbers, priority, and timestamps.<br>
**Created In:** `2026_10_01_000100_create_queue_tables.php`<br>
**Total Columns:** 15<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, visit_id
- **Foreign Keys:** `visit_id` -> UNIQUE, visits.id (RESTRICT); `dentist_queue_id` -> dentist_queues.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `visit_id` | `bigint` | NO | *None* | `UNIQUE, FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_10_01_000100_create_queue_tables.php` |
| `dentist_queue_id` | `bigint` | NO | *None* | `FK -> dentist_queues.id (RESTRICT)` | Foreign key referencing the associated dentist_queue record. | `2026_10_01_000100_create_queue_tables.php` |
| `queue_number` | `integer` | NO | *None* | *None* | Attribute queue_number for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `status` | `varchar(255)` | NO | *None* | *None* | Current operational workflow status for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `priority` | `varchar(255)` | NO | `'Normal'` | *None* | Attribute priority for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `priority_reason` | `text` | YES | *None* | *None* | Attribute priority_reason for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for queue_entries. | `2026_10_01_000100_create_queue_tables.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_01_000100_create_queue_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_01_000100_create_queue_tables.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_01_000100_create_queue_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_01_000100_create_queue_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_01_000100_create_queue_tables.php` |
| `late_arrival` | `boolean` | NO | `false` | *None* | Flag indicating patient arrived past the check-in grace period. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |

---

## `queue_entry_history`
**Module:** M9 Patient Queue<br>
**Description:** Append-only audit history of patient queue state transitions.<br>
**Created In:** `2026_10_01_000100_create_queue_tables.php`<br>
**Total Columns:** 12<br>
**PostgreSQL Triggers Attached (1):**<br>
- `queue_entry_history_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `queue_entry_history_append_only()` in `2026_10_01_000100_create_queue_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `queue_entry_id` -> queue_entries.id (RESTRICT); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `queue_entry_id` | `bigint` | NO | *None* | `FK -> queue_entries.id (RESTRICT)` | Foreign key referencing the associated queue_entry record. | `2026_10_01_000100_create_queue_tables.php` |
| `event` | `varchar(255)` | NO | *None* | *None* | Attribute event for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `to_status` | `varchar(255)` | NO | *None* | *None* | Attribute to_status for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `from_priority` | `varchar(255)` | YES | *None* | *None* | Attribute from_priority for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `to_priority` | `varchar(255)` | NO | *None* | *None* | Attribute to_priority for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `priority_reason` | `text` | YES | *None* | *None* | Attribute priority_reason for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `revision` | `integer` | NO | *None* | *None* | Attribute revision for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_10_01_000100_create_queue_tables.php` |
| `actor_role` | `varchar(255)` | YES | *None* | *None* | Attribute actor_role for queue_entry_history. | `2026_10_01_000100_create_queue_tables.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_10_01_000100_create_queue_tables.php` |

---

## `receipts`
**Module:** M11 Billing & Payments<br>
**Description:** Official payment receipts issued for settled invoices and booking deposits.<br>
**Created In:** `2026_10_05_000100_create_billing_tables.php`<br>
**Total Columns:** 12<br>
**PostgreSQL Triggers Attached (1):**<br>
- `receipts_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `m11_financial_append_only()` in `2026_10_05_000100_create_billing_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, payment_id, receipt_number
- **Foreign Keys:** `payment_id` -> UNIQUE, payments.id (RESTRICT); `invoice_id` -> invoices.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for receipts. | `2026_10_05_000100_create_billing_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for receipts. | `2026_10_05_000100_create_billing_tables.php` |
| `payment_id` | `bigint` | NO | *None* | `UNIQUE, FK -> payments.id (RESTRICT)` | Foreign key referencing the associated payment record. | `2026_10_05_000100_create_billing_tables.php` |
| `invoice_id` | `bigint` | NO | *None* | `FK -> invoices.id (RESTRICT)` | Foreign key referencing the associated invoice record. | `2026_10_05_000100_create_billing_tables.php` |
| `receipt_number` | `varchar(255)` | NO | *None* | `UNIQUE` | Attribute receipt_number for receipts. | `2026_10_05_000100_create_billing_tables.php` |
| `amount` | `numeric(12, 2)` | NO | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_05_000100_create_billing_tables.php` |
| `method` | `varchar(30)` | NO | *None* | *None* | Attribute method for receipts. | `2026_10_05_000100_create_billing_tables.php` |
| `external_reference` | `varchar(255)` | YES | *None* | *None* | Attribute external_reference for receipts. | `2026_10_05_000100_create_billing_tables.php` |
| `issued_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when issued occurred (Asia/Manila). | `2026_10_05_000100_create_billing_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_05_000100_create_billing_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_05_000100_create_billing_tables.php` |
| `received_from_name` | `varchar(255)` | YES | *None* | *None* | Attribute received_from_name for receipts. | `2026_10_24_000100_patient_portal_foundations.php` |

---

## `referrals`
**Module:** M24 Referral & Loyalty<br>
**Description:** Referral attribution tracking linking new patients to referring account holders.<br>
**Created In:** `2026_11_16_000100_create_loyalty_and_referrals_tables.php`<br>
**Total Columns:** 11<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, referee_patient_id
- **Foreign Keys:** `referee_patient_id` -> UNIQUE, patients.id (RESTRICT); `qualifying_invoice_id` -> invoices.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for referrals. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for referrals. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `referrer_patient_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated referrer_patient record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `referee_patient_id` | `bigint` | NO | *None* | `UNIQUE, FK -> patients.id (RESTRICT)` | Foreign key referencing the associated referee_patient record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `referral_code_used` | `varchar(32)` | NO | *None* | *None* | Unique alphanumeric identifier or reference code. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `status` | `varchar(40)` | NO | `'Pending'` | *None* | Current operational workflow status for referrals. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `qualifying_invoice_id` | `bigint` | YES | *None* | `FK -> invoices.id (RESTRICT)` | Foreign key referencing the associated qualifying_invoice record. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `qualified_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when qualified occurred (Asia/Manila). | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `rewarded_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when rewarded occurred (Asia/Manila). | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` |

---

## `service_prices`
**Module:** M13 Service Pricing<br>
**Description:** Owner-confirmed, effective-dated, append-only price versions for clinic billing.<br>
**Created In:** `2026_10_03_000100_create_service_prices_table.php`<br>
**Total Columns:** 12<br>
**PostgreSQL Triggers Attached (1):**<br>
- `service_prices_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `service_prices_append_only()` in `2026_10_03_000100_create_service_prices_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `service_id` -> services.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `retracted_by_user_id` -> users.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for service_prices. | `2026_10_03_000100_create_service_prices_table.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for service_prices. | `2026_10_03_000100_create_service_prices_table.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_10_03_000100_create_service_prices_table.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_03_000100_create_service_prices_table.php` |
| `kind` | `varchar(255)` | NO | *None* | *None* | Attribute kind for service_prices. | `2026_10_03_000100_create_service_prices_table.php` |
| `amount` | `numeric(12, 2)` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_10_03_000100_create_service_prices_table.php` |
| `effective_from` | `date` | NO | *None* | *None* | Attribute effective_from for service_prices. | `2026_10_03_000100_create_service_prices_table.php` |
| `source` | `varchar(255)` | NO | *None* | *None* | Attribute source for service_prices. | `2026_10_03_000100_create_service_prices_table.php` |
| `retracted_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when retracted occurred (Asia/Manila). | `2026_10_03_000100_create_service_prices_table.php` |
| `retracted_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated retracted_by_user record. | `2026_10_03_000100_create_service_prices_table.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_03_000100_create_service_prices_table.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_03_000100_create_service_prices_table.php` |

---

## `services`
**Module:** M13 Service Catalog<br>
**Description:** Clinic procedures and dental services catalog with booking modes and durations.<br>
**Created In:** `2026_09_25_000200_create_services_table.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** legacy_ref, code
- **Foreign Keys:** `consultation_service_id` -> services.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for services. | `2026_09_25_000200_create_services_table.php` |
| `legacy_ref` | `varchar(255)` | YES | *None* | `UNIQUE` | Attribute legacy_ref for services. | `2026_09_25_000200_create_services_table.php` |
| `code` | `varchar(255)` | NO | *None* | `UNIQUE` | Unique alphanumeric identifier or reference code. | `2026_09_25_000200_create_services_table.php` |
| `name` | `varchar(255)` | NO | *None* | *None* | Attribute name for services. | `2026_09_25_000200_create_services_table.php` |
| `duration_minutes` | `smallint` | NO | *None* | *None* | Attribute duration_minutes for services. | `2026_09_25_000200_create_services_table.php` |
| `reference_fee_php` | `numeric(10, 2)` | YES | *None* | *None* | Financial amount in Philippine Pesos (PHP) represented as numeric/decimal. | `2026_09_25_000200_create_services_table.php` |
| `category` | `varchar(255)` | NO | *None* | *None* | Attribute category for services. | `2026_09_25_000200_create_services_table.php` |
| `status` | `varchar(255)` | NO | `'Active'` | *None* | Current operational workflow status for services. | `2026_09_25_000200_create_services_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000200_create_services_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000200_create_services_table.php` |
| `description` | `varchar(300)` | YES | *None* | *None* | Attribute description for services. | `2026_10_24_000100_patient_portal_foundations.php` |
| `online_booking` | `varchar(20)` | NO | `'bookable'` | *None* | Attribute online_booking for services. | `2026_10_28_000400_add_online_booking_mode_to_services.php` |
| `consultation_service_id` | `bigint` | YES | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated consultation_service record. | `2026_10_28_000400_add_online_booking_mode_to_services.php` |

---

## `sessions`
**Module:** M1 (Framework)<br>
**Description:** Laravel database session driver storage for authenticated browser sessions.<br>
**Created In:** `0001_01_01_000000_create_users_table.php`<br>
**Total Columns:** 6<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `varchar(255)` | NO | *None* | `PK` | Primary surrogate key auto-incremented integer for sessions. | `0001_01_01_000000_create_users_table.php` |
| `user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated user record. | `0001_01_01_000000_create_users_table.php` |
| `ip_address` | `varchar(45)` | YES | *None* | *None* | Attribute ip_address for sessions. | `0001_01_01_000000_create_users_table.php` |
| `user_agent` | `text` | YES | *None* | *None* | Attribute user_agent for sessions. | `0001_01_01_000000_create_users_table.php` |
| `payload` | `text` | NO | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `0001_01_01_000000_create_users_table.php` |
| `last_activity` | `integer` | NO | *None* | *None* | Attribute last_activity for sessions. | `0001_01_01_000000_create_users_table.php` |

---

## `slot_offers`
**Module:** M6 Appointment Booking<br>
**Description:** Targeted move-up offers extended to eligible patients for opened slots.<br>
**Created In:** `2026_10_28_000200_create_arrival_and_freed_slot_tables.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `slot_offers_closes_once` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `slot_offers_closes_once()` in `2026_10_28_000200_create_arrival_and_freed_slot_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `slot_opening_id` -> slot_openings.id (RESTRICT); `appointment_id` -> appointments.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for slot_offers. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for slot_offers. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `slot_opening_id` | `bigint` | NO | *None* | `FK -> slot_openings.id (RESTRICT)` | Foreign key referencing the associated slot_opening record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `appointment_id` | `bigint` | NO | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `appointment_revision` | `integer` | NO | *None* | *None* | Attribute appointment_revision for slot_offers. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `status` | `varchar(20)` | NO | `'offered'` | *None* | Current operational workflow status for slot_offers. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `offered_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when offered occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |

---

## `slot_openings`
**Module:** M6 Appointment Booking<br>
**Description:** Cancellation-freed appointment slots made available for rapid backfill.<br>
**Created In:** `2026_10_28_000200_create_arrival_and_freed_slot_tables.php`<br>
**Total Columns:** 19<br>
**PostgreSQL Triggers Attached (1):**<br>
- `slot_openings_closes_once` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `slot_openings_closes_once()` in `2026_10_28_000200_create_arrival_and_freed_slot_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `branch_id` -> branches.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `appointment_id` -> appointments.id (RESTRICT); `filled_appointment_id` -> appointments.id (RESTRICT); `closed_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `starts_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when starts occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `ends_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when ends occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `clinic_date` | `date` | NO | *None* | *None* | Attribute clinic_date for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `source` | `varchar(20)` | NO | *None* | *None* | Attribute source for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `appointment_id` | `bigint` | NO | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `appointment_revision` | `integer` | NO | *None* | *None* | Attribute appointment_revision for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `status` | `varchar(20)` | NO | `'open'` | *None* | Current operational workflow status for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `filled_via` | `varchar(20)` | YES | *None* | *None* | Attribute filled_via for slot_openings. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `filled_appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated filled_appointment record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `offers_sent_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when offers_sent occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `waitlist_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when waitlist occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `closed_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated closed_by_user record. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` |

---

## `staff_profiles`
**Module:** M3 Work Schedules<br>
**Description:** Staff member profile, title, duty assignments, and basic schedule defaults.<br>
**Created In:** `2026_09_25_000400_create_staff_profiles_table.php`<br>
**Total Columns:** 11<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** legacy_ref, person_id
- **Foreign Keys:** `person_id` -> UNIQUE, persons.id (CASCADE); `branch_id` -> branches.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for staff_profiles. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `legacy_ref` | `varchar(255)` | YES | *None* | `UNIQUE` | Attribute legacy_ref for staff_profiles. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `legacy_user_ref` | `varchar(255)` | YES | *None* | *None* | Attribute legacy_user_ref for staff_profiles. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `person_id` | `bigint` | NO | *None* | `UNIQUE, FK -> persons.id (CASCADE)` | Foreign key referencing the associated person record. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `shift_start` | `time` | NO | *None* | *None* | Attribute shift_start for staff_profiles. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `shift_end` | `time` | NO | *None* | *None* | Attribute shift_end for staff_profiles. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `available` | `boolean` | NO | `true` | *None* | Attribute available for staff_profiles. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_25_000400_create_staff_profiles_table.php` |
| `title` | `varchar(255)` | YES | *None* | *None* | Attribute title for staff_profiles. | `2026_09_25_120000_add_title_to_staff_profiles_table.php` |

---

## `system_events`
**Module:** M23 Workflow Automation<br>
**Description:** Append-only event bus queue storing domain events for rule evaluation.<br>
**Created In:** `2026_10_08_000100_create_automation_tables.php`<br>
**Total Columns:** 12<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, idempotency_key
- **Foreign Keys:** `branch_id` -> branches.id (SET NULL); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for system_events. | `2026_10_08_000100_create_automation_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for system_events. | `2026_10_08_000100_create_automation_tables.php` |
| `event_type` | `varchar(100)` | NO | *None* | *None* | Attribute event_type for system_events. | `2026_10_08_000100_create_automation_tables.php` |
| `idempotency_key` | `varchar(150)` | NO | *None* | `UNIQUE` | Attribute idempotency_key for system_events. | `2026_10_08_000100_create_automation_tables.php` |
| `domain` | `varchar(50)` | NO | *None* | *None* | Attribute domain for system_events. | `2026_10_08_000100_create_automation_tables.php` |
| `aggregate_type` | `varchar(50)` | YES | *None* | *None* | Attribute aggregate_type for system_events. | `2026_10_08_000100_create_automation_tables.php` |
| `aggregate_id` | `varchar(100)` | YES | *None* | *None* | Foreign key referencing the associated aggregate record. | `2026_10_08_000100_create_automation_tables.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (SET NULL)` | Foreign key referencing the associated branch record. | `2026_10_08_000100_create_automation_tables.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_10_08_000100_create_automation_tables.php` |
| `payload` | `json` | YES | *None* | *None* | Structured JSONB payload storing dynamic attributes and contextual settings. | `2026_10_08_000100_create_automation_tables.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_10_08_000100_create_automation_tables.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_08_000100_create_automation_tables.php` |

---

## `tooth_chart_entries`
**Module:** M10 Dental Charts<br>
**Description:** Per-tooth condition and procedure findings across anatomical/occlusal views.<br>
**Created In:** `2026_10_31_000300_create_dental_charts.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached (1):**<br>
- `tooth_chart_entries_append_only` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `tooth_chart_entries_append_only()` in `2026_10_31_000300_create_dental_charts.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `treatment_id` -> treatments.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `created_by_user_id` -> users.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_31_000300_create_dental_charts.php` |
| `tooth` | `varchar(2)` | NO | *None* | *None* | Attribute tooth for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `surfaces` | `jsonb` | NO | `DB::raw("'[]'::jsonb"` | *None* | Attribute surfaces for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `status` | `varchar(40)` | NO | *None* | *None* | Current operational workflow status for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `recorded_on` | `date` | NO | *None* | *None* | Attribute recorded_on for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `note` | `text` | YES | *None* | *None* | Attribute note for tooth_chart_entries. | `2026_10_31_000300_create_dental_charts.php` |
| `treatment_id` | `bigint` | YES | *None* | `FK -> treatments.id (RESTRICT)` | Foreign key referencing the associated treatment record. | `2026_10_31_000300_create_dental_charts.php` |
| `branch_id` | `bigint` | YES | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_31_000300_create_dental_charts.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_31_000300_create_dental_charts.php` |
| `created_by_user_id` | `bigint` | NO | *None* | `FK -> users.id (RESTRICT)` | Foreign key referencing the associated created_by_user record. | `2026_10_31_000300_create_dental_charts.php` |
| `created_at` | `timestamp with time zone` | NO | `DB::raw('now(` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_31_000300_create_dental_charts.php` |

---

## `treatment_history`
**Module:** M5 Clinical Treatment<br>
**Description:** Append-only revision snapshots of committed treatment documentation.<br>
**Created In:** `2026_10_02_000100_create_treatment_tables.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `treatment_history_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `treatment_history_append_only()` in `2026_10_02_000100_create_treatment_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `treatment_id` -> treatments.id (RESTRICT); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `treatment_id` | `bigint` | NO | *None* | `FK -> treatments.id (RESTRICT)` | Foreign key referencing the associated treatment record. | `2026_10_02_000100_create_treatment_tables.php` |
| `event` | `varchar(255)` | NO | *None* | *None* | Attribute event for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `to_status` | `varchar(255)` | NO | *None* | *None* | Attribute to_status for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `revision` | `integer` | NO | *None* | *None* | Attribute revision for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `snapshot` | `jsonb` | NO | *None* | *None* | Attribute snapshot for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_10_02_000100_create_treatment_tables.php` |
| `actor_role` | `varchar(255)` | YES | *None* | *None* | Attribute actor_role for treatment_history. | `2026_10_02_000100_create_treatment_tables.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_10_02_000100_create_treatment_tables.php` |

---

## `treatment_procedures`
**Module:** M5 Clinical Treatment<br>
**Description:** Actual performed procedure line items linked to canonical services.<br>
**Created In:** `2026_10_02_000100_create_treatment_tables.php`<br>
**Total Columns:** 11<br>
**PostgreSQL Triggers Attached (1):**<br>
- `treatment_procedures_guard` (Insert Limit Guard: BEFORE INSERT OR UPDATE OR DELETE via `treatment_procedure_guard()` in `2026_10_02_000100_create_treatment_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `treatment_id` -> treatments.id (RESTRICT); `service_id` -> services.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for treatment_procedures. | `2026_10_02_000100_create_treatment_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for treatment_procedures. | `2026_10_02_000100_create_treatment_tables.php` |
| `treatment_id` | `bigint` | NO | *None* | `FK -> treatments.id (RESTRICT)` | Foreign key referencing the associated treatment record. | `2026_10_02_000100_create_treatment_tables.php` |
| `line_no` | `integer` | NO | *None* | *None* | Attribute line_no for treatment_procedures. | `2026_10_02_000100_create_treatment_tables.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_10_02_000100_create_treatment_tables.php` |
| `quantity` | `integer` | NO | *None* | *None* | Attribute quantity for treatment_procedures. | `2026_10_02_000100_create_treatment_tables.php` |
| `notes` | `text` | YES | *None* | *None* | Free-form administrative or clinical text notes. | `2026_10_02_000100_create_treatment_tables.php` |
| `service_code` | `varchar(255)` | NO | *None* | *None* | Snapshot of service catalog code at procedure execution time. | `2026_10_02_000100_create_treatment_tables.php` |
| `service_name` | `varchar(255)` | NO | *None* | *None* | Attribute service_name for treatment_procedures. | `2026_10_02_000100_create_treatment_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_02_000100_create_treatment_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_02_000100_create_treatment_tables.php` |

---

## `treatments`
**Module:** M5 Clinical Treatment<br>
**Description:** Clinical encounter documentation, diagnoses, tooth observations, and treatment notes.<br>
**Created In:** `2026_10_02_000100_create_treatment_tables.php`<br>
**Total Columns:** 22<br>
**PostgreSQL Triggers Attached (2):**<br>
- `treatments_completed_read_only` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `treatment_completed_read_only()` in `2026_10_02_000100_create_treatment_tables.php`)
- `treatments_visit_consistency` (Relational Consistency Guard: AFTER INSERT OR UPDATE OF STATUS via `treatment_visit_consistency()` in `2026_10_02_000100_create_treatment_tables.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, visit_id
- **Foreign Keys:** `visit_id` -> UNIQUE, visits.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT); `assistant_staff_profile_id` -> staff_profiles.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `visit_id` | `bigint` | NO | *None* | `UNIQUE, FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_10_02_000100_create_treatment_tables.php` |
| `dentist_profile_id` | `bigint` | NO | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_02_000100_create_treatment_tables.php` |
| `status` | `varchar(255)` | NO | *None* | *None* | Current operational workflow status for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `chief_complaint` | `text` | YES | *None* | *None* | Attribute chief_complaint for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `treatment_plan` | `text` | YES | *None* | *None* | Attribute treatment_plan for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `procedure_summary` | `text` | YES | *None* | *None* | Attribute procedure_summary for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `clinical_notes` | `text` | YES | *None* | *None* | Free-form administrative or clinical text notes. | `2026_10_02_000100_create_treatment_tables.php` |
| `assistant_staff_profile_id` | `bigint` | YES | *None* | `FK -> staff_profiles.id (RESTRICT)` | Dental assistant staff profile assigned to assist during the treatment session. | `2026_10_02_000100_create_treatment_tables.php` |
| `prescription_required` | `boolean` | NO | `false` | *None* | Attribute prescription_required for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `followup_required` | `boolean` | NO | `false` | *None* | Attribute followup_required for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `followup_recommended_date` | `date` | YES | *None* | *None* | Attribute followup_recommended_date for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `followup_reason` | `text` | YES | *None* | *None* | Attribute followup_reason for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `followup_interval` | `varchar(255)` | YES | *None* | *None* | Attribute followup_interval for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `started_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when started occurred (Asia/Manila). | `2026_10_02_000100_create_treatment_tables.php` |
| `completed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when completed occurred (Asia/Manila). | `2026_10_02_000100_create_treatment_tables.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for treatments. | `2026_10_02_000100_create_treatment_tables.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_10_02_000100_create_treatment_tables.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_10_02_000100_create_treatment_tables.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_02_000100_create_treatment_tables.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_02_000100_create_treatment_tables.php` |

---

## `user_branch_scopes`
**Module:** M1 Identity & Personnel<br>
**Description:** Associative junction mapping staff members to authorized branch locations.<br>
**Created In:** `2026_09_28_000100_create_user_branch_scopes_table.php`<br>
**Total Columns:** 5<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `user_id` -> users.id (CASCADE)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for user_branch_scopes. | `2026_09_28_000100_create_user_branch_scopes_table.php` |
| `user_id` | `bigint` | NO | *None* | `FK -> users.id (CASCADE)` | Foreign key referencing the associated user record. | `2026_09_28_000100_create_user_branch_scopes_table.php` |
| `branch_id` | `index` | NO | *None* | *None* | Foreign key referencing the associated branch record. | `2026_09_28_000100_create_user_branch_scopes_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_28_000100_create_user_branch_scopes_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_28_000100_create_user_branch_scopes_table.php` |

---

## `user_notifications`
**Module:** M18 Notifications<br>
**Description:** Identity-specific in-app notifications generated by server workflow events.<br>
**Created In:** `2026_10_24_000100_patient_portal_foundations.php`<br>
**Total Columns:** 14<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

> [!NOTE] GEN-11 Archive Columns Status:
> Columns `archived_at`, `archived_by_user_id`, and `archive_reason` are **[Reported by project owner as applied on production `dental_clinic`]** via migration `2026_11_15_000100_add_archive_columns_to_core_tables.php`. They are **[Not verified on hosted Supabase]** and require Joevan's confirmation.


**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, dedupe_key
- **Foreign Keys:** `user_id` -> users.id (CASCADE); `archived_by_user_id` -> users.id (RESTRICT)
- **Indexes:** archived_at

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `user_id` | `bigint` | NO | *None* | `FK -> users.id (CASCADE)` | Foreign key referencing the associated user record. | `2026_10_24_000100_patient_portal_foundations.php` |
| `kind` | `varchar(40)` | NO | *None* | *None* | Attribute kind for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `title` | `varchar(160)` | NO | *None* | *None* | Attribute title for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `body` | `varchar(300)` | YES | *None* | *None* | Attribute body for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `target_page` | `varchar(30)` | YES | *None* | *None* | Attribute target_page for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `target_id` | `varchar(40)` | YES | *None* | *None* | Foreign key referencing the associated target record. | `2026_10_24_000100_patient_portal_foundations.php` |
| `dedupe_key` | `varchar(191)` | NO | *None* | `UNIQUE` | Attribute dedupe_key for user_notifications. | `2026_10_24_000100_patient_portal_foundations.php` |
| `created_at` | `timestamp with time zone` | NO | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_24_000100_patient_portal_foundations.php` |
| `read_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when read occurred (Asia/Manila). | `2026_10_24_000100_patient_portal_foundations.php` |
| `archived_at` | `timestamp with time zone` | YES | *None* | `INDEX` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Soft-delete archive timestamp under the GEN-11 non-destructive standard. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archived_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Foreign key to users.id recording actor who archived this record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archive_reason` | `text` | YES | *None* | *None* | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Textual explanation provided when archiving the record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |

---

## `users`
**Module:** M1 Identity & Personnel<br>
**Description:** Authentication and login account credentials, role assignment, and account status.<br>
**Created In:** `0001_01_01_000000_create_users_table.php`<br>
**Total Columns:** 15<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, email (UK: users_email_unique), person_id (UK: users_person_id_unique)
- **Foreign Keys:** `person_id` -> persons.id (CASCADE)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for users. | `0001_01_01_000000_create_users_table.php` |
| `person_id` | `bigint` | NO | *None* | `UK, FK -> persons.id (CASCADE)` | Foreign key referencing the associated physical Person record. | `0001_01_01_000000_create_users_table.php` |
| `email` | `varchar(255)` | NO | *None* | `UK (users_email_unique)` | Login email address and unique identity attribute. | `0001_01_01_000000_create_users_table.php` |
| `role` | `varchar(255)` | NO | *None* | *None* | Canonical top-level role (Patient, Staff, Dentist, Owner). | `0001_01_01_000000_create_users_table.php` |
| `account_status` | `varchar(255)` | NO | `'Active'` | *None* | Account operational status (Active, Inactive, Suspended). | `0001_01_01_000000_create_users_table.php` |
| `title` | `varchar(255)` | YES | *None* | *None* | Display-only job title or duty focus (e.g. Receptionist, Dental Assistant). | `0001_01_01_000000_create_users_table.php` |
| `email_verified_at` | `timestamp without time zone` | YES | *None* | *None* | Timestamp recording when email_verified occurred (Asia/Manila). | `0001_01_01_000000_create_users_table.php` |
| `password` | `varchar(255)` | NO | *None* | *None* | Bcrypt salted hash of the user login password. | `0001_01_01_000000_create_users_table.php` |
| `remember_token` | `varchar(100)` | YES | *None* | *None* | Attribute remember_token for users. | `0001_01_01_000000_create_users_table.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `0001_01_01_000000_create_users_table.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `0001_01_01_000000_create_users_table.php` |
| `deleted_at` | `timestamp without time zone` | YES | *None* | *None* | Laravel Eloquent soft-delete timestamp (SoftDeletes trait) enabling non-destructive account archiving. | `2026_09_25_140000_add_deleted_at_to_users_table.php` |
| `public_id` | `unique` | NO | *None* | *None* | Deterministic, URL-safe public obfuscated identifier for users. | `2026_09_29_000100_add_public_id_to_users_table.php` |
| `auth_version` | `integer` | NO | `0` | *None* | Monotonically increasing integer invalidating tokens upon password change. | `2026_10_09_000100_add_auth_version_to_users.php` |
| `pending_claim` | `boolean` | NO | `false` | *None* | Flag indicating patient account is pending ownership claim and activation. | `2026_10_29_000300_harden_account_claims.php` |

---

## `visit_history`
**Module:** M8 Patient Check-In<br>
**Description:** Append-only audit history of clinical encounter lifecycle events.<br>
**Created In:** `2026_09_30_000100_create_visits_table.php`<br>
**Total Columns:** 10<br>
**PostgreSQL Triggers Attached (1):**<br>
- `visit_history_no_update_delete` (Strict Append-Only (Unconditional Block on UPDATE & DELETE): BEFORE UPDATE OR DELETE via `visit_history_append_only()` in `2026_09_30_000100_create_visits_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Foreign Keys:** `visit_id` -> visits.id (RESTRICT); `responsible_dentist_profile_id` -> dentist_profiles.id (RESTRICT); `actor_user_id` -> users.id (SET NULL)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for visit_history. | `2026_09_30_000100_create_visits_table.php` |
| `visit_id` | `bigint` | NO | *None* | `FK -> visits.id (RESTRICT)` | Foreign key referencing the associated visit record. | `2026_09_30_000100_create_visits_table.php` |
| `event` | `varchar(255)` | NO | *None* | *None* | Attribute event for visit_history. | `2026_09_30_000100_create_visits_table.php` |
| `from_status` | `varchar(255)` | YES | *None* | *None* | Attribute from_status for visit_history. | `2026_09_30_000100_create_visits_table.php` |
| `to_status` | `varchar(255)` | NO | *None* | *None* | Attribute to_status for visit_history. | `2026_09_30_000100_create_visits_table.php` |
| `revision` | `integer` | NO | *None* | *None* | Attribute revision for visit_history. | `2026_09_30_000100_create_visits_table.php` |
| `responsible_dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated responsible_dentist_profile record. | `2026_09_30_000100_create_visits_table.php` |
| `actor_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated actor_user record. | `2026_09_30_000100_create_visits_table.php` |
| `actor_role` | `varchar(255)` | YES | *None* | *None* | Attribute actor_role for visit_history. | `2026_09_30_000100_create_visits_table.php` |
| `occurred_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when occurred occurred (Asia/Manila). | `2026_09_30_000100_create_visits_table.php` |

---

## `visits`
**Module:** M8 Patient Check-In<br>
**Description:** Physical clinic encounter (scheduled arrival or walk-in), anchoring queue and care.<br>
**Created In:** `2026_09_30_000100_create_visits_table.php`<br>
**Total Columns:** 20<br>
**PostgreSQL Triggers Attached (1):**<br>
- `visits_treatment_consistency` (Relational Consistency Guard: AFTER INSERT OR UPDATE OF STATUS via `visit_treatment_consistency()` in `2026_10_02_000100_create_treatment_tables.php`)

> [!NOTE] GEN-11 Archive Columns Status:
> Columns `archived_at`, `archived_by_user_id`, and `archive_reason` are **[Reported by project owner as applied on production `dental_clinic`]** via migration `2026_11_15_000100_add_archive_columns_to_core_tables.php`. They are **[Not verified on hosted Supabase]** and require Joevan's confirmation.


**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `appointment_id` -> appointments.id (RESTRICT); `responsible_dentist_profile_id` -> dentist_profiles.id (RESTRICT); `requested_service_id` -> services.id (RESTRICT); `created_by_user_id` -> users.id (SET NULL); `updated_by_user_id` -> users.id (SET NULL); `archived_by_user_id` -> users.id (RESTRICT)
- **Indexes:** archived_at

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for visits. | `2026_09_30_000100_create_visits_table.php` |
| `public_id` | `ulid (char(26))` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for visits. | `2026_09_30_000100_create_visits_table.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_09_30_000100_create_visits_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_09_30_000100_create_visits_table.php` |
| `appointment_id` | `bigint` | YES | *None* | `FK -> appointments.id (RESTRICT)` | Foreign key referencing the associated appointment record. | `2026_09_30_000100_create_visits_table.php` |
| `source` | `varchar(255)` | NO | *None* | *None* | Attribute source for visits. | `2026_09_30_000100_create_visits_table.php` |
| `status` | `varchar(255)` | NO | *None* | *None* | Current operational workflow status for visits. | `2026_09_30_000100_create_visits_table.php` |
| `responsible_dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Dentist profile responsible for patient care during this clinical visit. | `2026_09_30_000100_create_visits_table.php` |
| `requested_service_id` | `bigint` | YES | *None* | `FK -> services.id (RESTRICT)` | Service requested by or assigned to the patient for this encounter. | `2026_09_30_000100_create_visits_table.php` |
| `arrived_at` | `timestamp with time zone` | NO | *None* | *None* | Timestamp recording when arrived occurred (Asia/Manila). | `2026_09_30_000100_create_visits_table.php` |
| `clinic_date` | `date` | NO | *None* | *None* | Attribute clinic_date for visits. | `2026_09_30_000100_create_visits_table.php` |
| `revision` | `integer` | NO | `1` | *None* | Attribute revision for visits. | `2026_09_30_000100_create_visits_table.php` |
| `created_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated created_by_user record. | `2026_09_30_000100_create_visits_table.php` |
| `updated_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (SET NULL)` | Foreign key referencing the associated updated_by_user record. | `2026_09_30_000100_create_visits_table.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_09_30_000100_create_visits_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_09_30_000100_create_visits_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_09_30_000100_create_visits_table.php` |
| `archived_at` | `timestamp with time zone` | YES | *None* | `INDEX` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Soft-delete archive timestamp under the GEN-11 non-destructive standard. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archived_by_user_id` | `bigint` | YES | *None* | `FK -> users.id (RESTRICT)` | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Foreign key to users.id recording actor who archived this record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |
| `archive_reason` | `text` | YES | *None* | *None* | [Reported by project owner as applied on production; Not verified on hosted Supabase]. Textual explanation provided when archiving the record. | `2026_11_15_000100_add_archive_columns_to_core_tables.php` |

---

## `waitlist_entries`
**Module:** M6 Appointment Booking<br>
**Description:** Patient waitlist entries for fully booked days awaiting cancellations.<br>
**Created In:** `2026_10_27_000300_create_waitlist_entries_table.php`<br>
**Total Columns:** 12<br>
**PostgreSQL Triggers Attached (1):**<br>
- `waitlist_entries_guard` (Conditional / Lifecycle Immutability Guard: BEFORE UPDATE OR DELETE via `waitlist_entries_guard()` in `2026_10_27_000300_create_waitlist_entries_table.php`)

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id
- **Foreign Keys:** `patient_id` -> patients.id (RESTRICT); `branch_id` -> branches.id (RESTRICT); `service_id` -> services.id (RESTRICT); `dentist_profile_id` -> dentist_profiles.id (RESTRICT)

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for waitlist_entries. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for waitlist_entries. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `patient_id` | `bigint` | NO | *None* | `FK -> patients.id (RESTRICT)` | Foreign key referencing the associated patient record. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `branch_id` | `bigint` | NO | *None* | `FK -> branches.id (RESTRICT)` | Foreign key referencing the associated branch record. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `service_id` | `bigint` | NO | *None* | `FK -> services.id (RESTRICT)` | Foreign key referencing the associated service record. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `dentist_profile_id` | `bigint` | YES | *None* | `FK -> dentist_profiles.id (RESTRICT)` | Foreign key referencing the associated dentist_profile record. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `clinic_date` | `date` | NO | *None* | *None* | Attribute clinic_date for waitlist_entries. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `status` | `varchar(20)` | NO | `'waiting'` | *None* | Current operational workflow status for waitlist_entries. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `notified_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when notified occurred (Asia/Manila). | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `closed_at` | `timestamp with time zone` | YES | *None* | *None* | Timestamp recording when closed occurred (Asia/Manila). | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `created_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_27_000300_create_waitlist_entries_table.php` |
| `updated_at` | `timestamp with time zone` | NO | `now()` | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_27_000300_create_waitlist_entries_table.php` |

---

## `workflow_rules`
**Module:** M23 Workflow Automation<br>
**Description:** Deterministic business rule definitions governing cross-module automation.<br>
**Created In:** `2026_10_08_000100_create_automation_tables.php`<br>
**Total Columns:** 13<br>
**PostgreSQL Triggers Attached:** None (Standard relational table)<br>

**Key Constraints:**
- **Primary Key:** id
- **Unique Constraints:** public_id, rule_code

| Column | PostgreSQL Type | Nullable | Default | Key / Constraint | Description | Evidence |
| :--- | :--- | :---: | :--- | :--- | :--- | :--- |
| `id` | `bigint` | NO | `nextval(...) (PK)` | `PK` | Primary surrogate key auto-incremented integer for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `public_id` | `char(26)` | NO | *None* | `UNIQUE` | Deterministic, URL-safe public obfuscated identifier for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `rule_code` | `varchar(50)` | NO | *None* | `UNIQUE` | Unique alphanumeric identifier or reference code. | `2026_10_08_000100_create_automation_tables.php` |
| `name` | `varchar(150)` | NO | *None* | *None* | Attribute name for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `trigger_event` | `varchar(100)` | NO | *None* | *None* | Attribute trigger_event for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `target_domains` | `json` | NO | *None* | *None* | Attribute target_domains for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `condition_description` | `text` | NO | *None* | *None* | Attribute condition_description for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `action_description` | `text` | NO | *None* | *None* | Attribute action_description for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `owner_domain` | `varchar(50)` | NO | *None* | *None* | Attribute owner_domain for workflow_rules. | `2026_10_08_000100_create_automation_tables.php` |
| `is_active` | `boolean` | NO | `true` | *None* | Boolean flag indicating is active. | `2026_10_08_000100_create_automation_tables.php` |
| `is_system_protected` | `boolean` | NO | `true` | *None* | Boolean flag indicating is system protected. | `2026_10_08_000100_create_automation_tables.php` |
| `created_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of record creation. | `2026_10_08_000100_create_automation_tables.php` |
| `updated_at` | `timestamp without time zone` | YES | *None* | *None* | PostgreSQL timestamp with time zone of last record update. | `2026_10_08_000100_create_automation_tables.php` |

---
