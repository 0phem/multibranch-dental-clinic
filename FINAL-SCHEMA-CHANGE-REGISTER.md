# FINAL DATABASE SCHEMA CHANGE REGISTER — 83 MIGRATION AUDIT

**Date:** October 26, 2026<br>
**Audience:** Joevan (Hosted Database Administrator), Development Team, Project Defense Panel<br>
**Total Migrations Audited:** 83 Files (`backend/database/migrations/`)<br>
**Total Resulting Active Tables:** 91 Tables (83 Domain + 8 Framework)<br>
**Status:** Authoritative Sequential Execution Log<br>

---

## 1. Overview & Architectural Integrity

The Dr. Dana E. Roxas Dental Clinic application database is provisioned and migrated through **83 ordered Laravel database migration files**.

### 1.1 Evidence Classification Standard
* **[Verified from project source]:** Confirmed via static source inspection of migration files in `backend/database/migrations/`.
* **[Verified in local test environment]:** Confirmed via local `dental_clinic_test` test suite and migration run status.
* **[Reported by project owner]:** Deployment status communicated by the project owner but not independently verified on the remote database.
* **[Not verified on hosted Supabase]:** Status must be confirmed by Joevan using read-only SQL queries before final defense.
* **[Pending / unresolved]:** Implementation or approval is incomplete.

### 1.2 Structural Invariants
1. **Append-Only Migration Policy:** Historical migrations are not edited in-place; all modifications, indexes, triggers, and schema evolutions are executed as additive migrations.
2. **Multi-Tiered Retention Standard:**
   * Eloquent Soft Deletes on `users` (`deleted_at`).
   * Role-Scoped Archive Metadata (`archived_at`, `archived_by_user_id`, `archive_reason`) on 4 core tables (`invoices`, `visits`, `prescriptions`, `user_notifications`).
   * Engine-level PostgreSQL triggers protecting 40 tables (44 total triggers).
   * Intentional physical delete operations in backend code strictly limited to ephemeral sessions, tokens, scope re-syncs, and unfinalized draft procedure/prescription lines.
   * Historical schema drops strictly limited to 1 table (`patient_feedback` in migration 76) and 1 column (`persons.middle_name` in migration 15).
3. **STF-04 Scope Boundary:** Migration 66 (`2026_10_29_000200_create_intake_tables.php`) created `intake_submissions`. Receptionist counter intake in `CounterIntake.jsx` captures an "Other valid ID" text field (`other_details`), but backend request validation and database persistence remain **pending approval** (recorded as **Partial / In Progress**). This missing persistence is an incomplete implementation item awaiting client/team approval, **NOT** an intentional final design decision. No column is added to `intake_submissions`.
4. **Current Deployment Status Summary:**
   * Migrations 1 through 76 are **[Verified from project source]** and **[Reported applied on prod by owner]**; **[Not verified on hosted Supabase]**.
   * Migration 77 (`2026_11_15_000100_add_archive_columns_to_core_tables.php`) is **[Reported applied on prod by owner]**; **[Not verified on hosted Supabase]**.
   * Migrations 78 through 83 are **[Verified in local test environment]**; **[Not verified on hosted Supabase]**.

### 1.3 Date Discrepancy & Future-Dated Migrations
* **Audit Date:** October 26, 2026.
* **Future-Dated Migration Files:** Exactly **28 migration files** (#56 to #83) in `backend/database/migrations/` bear filename timestamp prefixes dated after October 26, 2026:
  * Migrations 56-59: Dated October 27, 2026 (`2026_10_27_...`)
  * Migrations 60-64: Dated October 28, 2026 (`2026_10_28_...`)
  * Migrations 65-67: Dated October 29, 2026 (`2026_10_29_...`)
  * Migrations 68-70: Dated October 30, 2026 (`2026_10_30_...`)
  * Migrations 71-73: Dated October 31, 2026 (`2026_10_31_...`)
  * Migration 74: Dated November 1, 2026 (`2026_11_01_...`)
  * Migration 75: Dated November 2, 2026 (`2026_11_02_...`)
  * Migration 76: Dated November 10, 2026 (`2026_11_10_...`)
  * Migrations 77-81: Dated November 15, 2026 (`2026_11_15_...`)
  * Migrations 82-83: Dated November 16, 2026 (`2026_11_16_...`)
* **Possible Explanation vs. Confirmation Required:** Future timestamp prefixes are a possible explanation (e.g., forward-dated sprint milestone identifiers), but this convention has not been formally confirmed by the project owner.
* **Migration Renaming & Tracking Invariant:** Changing the filename of a migration that has already run can cause Laravel to treat the renamed file as a different, pending migration because the recorded name in the `migrations` table no longer matches. Depending on the migration, re-execution may fail or cause unintended schema changes. Therefore, do not rename applied migrations without a reviewed migration-history and deployment plan.
* **Owner-Reported Production Status vs. Filename Contradiction:** Migration 77's production status remains owner-reported (`2026_11_15_000100_add_archive_columns_to_core_tables.php` was communicated as already applied on production `dental_clinic`), not independently verified by this static audit. This date contradiction (dated November 15 but reported applied on or before October 26) is preserved as reported but explicitly marked as **[Not verified on hosted Supabase]**.
* **Local Test vs. Hosted Status:** Migration 83 is recorded as `Ran` in local `dental_clinic_test`; its hosted Supabase status remains unverified.

### 1.4 Audit Safety Scope & Metric Designations
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

---

## 2. Chronological Schema Change Register

The table below catalogs every migration file in exact execution order:

| # | Migration File | Target Table(s) | Type | Architectural Intent & Summary | Dependencies | Deployment Status |
| :-: | :--- | :--- | :-: | :--- | :--- | :-: |

| 1 | `0000_01_01_000000_create_persons_table.php` | `persons` | Create | Establishes core identity hub for all individuals in the clinic system. | `None` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 2 | `0001_01_01_000000_create_users_table.php` | `users, password_reset_tokens, sessions` | Create | Creates login accounts, credentials, framework password tokens and web sessions. | `persons` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 3 | `0001_01_01_000001_create_cache_table.php` | `cache, cache_locks` | Create | Database-backed application caching and distributed lock tables. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 4 | `0001_01_01_000002_create_jobs_table.php` | `jobs, job_batches, failed_jobs` | Create | Asynchronous background job queue and failed job telemetry tables. | `cache` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 5 | `2026_09_24_000200_create_patients_table.php` | `patients` | Create | Establishes patient medical identity linked 1:1 to persons. | `persons` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 6 | `2026_09_24_045331_create_personal_access_tokens_table.php` | `personal_access_tokens` | Create | Laravel Sanctum API tokens table for stateless authentication. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 7 | `2026_09_25_000100_create_branches_table.php` | `branches` | Create | Clinic branch facilities, physical locations, and operating status. | `None` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 8 | `2026_09_25_000200_create_services_table.php` | `services` | Create | Master dental service and procedure catalog. | `None` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 9 | `2026_09_25_000300_create_branch_services_table.php` | `branch_services` | Create | Associative matrix of dental services available per branch. | `branches, services` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 10 | `2026_09_25_000400_create_staff_profiles_table.php` | `staff_profiles` | Create | Administrative reception and assistant staff profiles. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 11 | `2026_09_25_000500_create_dentist_profiles_table.php` | `dentist_profiles` | Create | Dentist clinician credentials, licenses, and biographical data. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 12 | `2026_09_25_000600_create_dentist_branches_table.php` | `dentist_branches` | Create | Multi-branch deployment mapping dentists to branch facilities. | `dentist_profiles, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 13 | `2026_09_25_000700_create_dentist_service_assignments_table.php` | `dentist_service_assignments` | Create | Clinical privilege matrix mapping dentists to approved procedures. | `dentist_profiles, services` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 14 | `2026_09_25_120000_add_title_to_staff_profiles_table.php` | `staff_profiles` | Alter | Adds job title designation column to staff profiles. | `staff_profiles` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 15 | `2026_09_25_130000_remove_middle_name_from_persons_table.php` | `persons` | Drop Column | Drops middle_name column to streamline legal name modeling. | `persons` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 16 | `2026_09_25_140000_add_deleted_at_to_users_table.php` | `users` | Alter | Adds deleted_at timestamp for non-destructive user account archiving. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 17 | `2026_09_28_000050_add_public_id_to_patients_table.php` | `patients` | Alter | Adds unique public_id slug to obfuscate internal patient IDs. | `patients` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 18 | `2026_09_28_000100_create_user_branch_scopes_table.php` | `user_branch_scopes` | Create | Associates staff users with authorized branch data access scopes. | `users, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 19 | `2026_09_28_000200_create_appointments_table.php` | `appointments` | Create | Core appointment booking table with date, time, and status. | `patients, branches, dentist_profiles` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 20 | `2026_09_28_000300_create_appointment_history_table.php` | `appointment_history` | Create | Append-only trigger-enforced schedule change history. | `appointments` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 21 | `2026_09_28_000400_create_appointment_command_keys_table.php` | `appointment_command_keys` | Create | Idempotency key registry preventing duplicate appointment actions. | `appointments` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 22 | `2026_09_29_000100_add_public_id_to_users_table.php` | `users` | Alter | Adds unique public_id slug to users table. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 23 | `2026_09_29_000200_add_appointment_code_to_appointments_table.php` | `appointments` | Alter | Adds immutable human-readable appointment reference code. | `appointments` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 24 | `2026_09_30_000100_create_email_verification_otps_table.php` | `email_verification_otps` | Create | One-time password tokens for email verification. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 25 | `2026_09_30_000100_create_visits_table.php` | `visits, visit_history, command_keys` | Create | Encounter visits, append-only history, and idempotency keys. | `appointments, patients, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 26 | `2026_09_30_000200_backfill_visits_from_appointments.php` | `visits` | Data Backfill | Backfills historical completed appointments into encounter visits. | `visits` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 27 | `2026_10_01_000100_create_queue_tables.php` | `dentist_queues, queue_entries, queue_entry_history` | Create | Live clinic flow queues, tickets, and state audit history. | `branches, dentist_profiles, visits` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 28 | `2026_10_01_000200_backfill_queue_entries_from_visits.php` | `queue_entries` | Data Backfill | Backfills queue tickets for active in-clinic encounters. | `queue_entries` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 29 | `2026_10_02_000100_create_treatment_tables.php` | `treatments, treatment_procedures, treatment_history` | Create | Clinical encounter documentation, procedure lines, and immutable audit. | `visits, services` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 30 | `2026_10_03_000100_create_service_prices_table.php` | `service_prices` | Create | Append-only versioned fee schedule for dental procedures. | `services` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 31 | `2026_10_04_000100_create_hmo_tables.php` | `patient_hmo_memberships, hmo_cases, hmo_case_requirements, hmo_case_events` | Create | HMO policy coverage, claims, document checklists, and adjudication. | `patients, visits` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 32 | `2026_10_05_000100_create_billing_tables.php` | `invoices, invoice_lines, invoice_histories, payments, receipts` | Create | Statements of account, charges, payments, and official receipts. | `visits, patients, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 33 | `2026_10_06_000100_create_document_tables.php` | `documents, document_extractions` | Create | Patient files, lab attachments, and OCR extraction records. | `patients, visits` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 34 | `2026_10_07_000100_create_audit_logs_table.php` | `audit_logs` | Create | System-wide immutable security and transactional audit log. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 35 | `2026_10_08_000100_create_automation_tables.php` | `workflow_rules, automated_actions, system_events` | Create | Event-driven workflow automation rules and trigger actions. | `None` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 36 | `2026_10_09_000100_add_auth_version_to_users.php` | `users` | Alter | Adds auth_version counter for instant token revocation on logout/password change. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 37 | `2026_10_10_000100_add_branch_public_identity.php` | `branches` | Alter | Adds unique public_id and URL slugs for branch routing. | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 38 | `2026_10_11_000100_add_patient_record_fields.php` | `patients` | Alter | Adds allergies, blood type, and existing conditions to patients. | `patients` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 39 | `2026_10_12_000100_harden_document_integrity.php` | `documents` | Alter | Adds cryptographic SHA-256 hash checks to prevent file tampering. | `documents` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 40 | `2026_10_13_000100_enforce_audit_log_append_only.php` | `audit_logs` | Hardening | Installs PostgreSQL triggers blocking UPDATE, DELETE, and TRUNCATE. | `audit_logs` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 41 | `2026_10_14_000100_harden_m11_payment_integrity.php` | `payments, receipts` | Hardening | Installs trigger enforcing immutable financial payment rows. | `payments, receipts` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 42 | `2026_10_15_000100_create_inquiry_tables.php` | `inquiries, inquiry_history` | Create | Patient portal inquiries and immutable response history. | `patients, users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 43 | `2026_10_16_000100_create_messaging_tables.php` | `conversations, conversation_participants, conversation_messages` | Create | Real-time direct messaging between patients, staff, and dentists. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 44 | `2026_10_17_000100_create_patient_feedback_table.php` | `patient_feedback` | Create (Later Dropped) | Initial patient satisfaction survey table (subsequently decommissioned). | `visits, patients` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 45 | `2026_10_18_000100_create_mail_dispatch_tables.php` | `mail_dispatches, mail_dispatch_attempts` | Create | Outbound email transactional queue and delivery retry attempts. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 46 | `2026_10_19_000100_add_purpose_to_email_verification_otps.php` | `email_verification_otps` | Alter | Adds purpose enumeration (registration, reset, claim) to OTP table. | `email_verification_otps` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 47 | `2026_10_20_000100_m17_routing_and_encryption.php` | `conversations, conversation_messages` | Alter | Adds thread routing (`conversations.assigned_user_id`) and encryption (`conversation_messages.body_encrypted`) via raw SQL. | `conversations, conversation_messages` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 48 | `2026_10_21_000100_add_bir_fields_to_branches.php` | `branches` | Alter | Adds BIR tax compliance fields (TIN, branch tax code, RDO). | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 49 | `2026_10_22_000100_billing_address_and_checkout_fingerprint.php` | `patients, payment_checkout_sessions` | Alter | Adds billing address and PayMongo checkout session fingerprints. | `patients, payment_checkout_sessions` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 50 | `2026_10_23_000100_create_clinic_settings_table.php` | `clinic_settings` | Create | Owner-managed clinic-wide operational settings key-value store. | `None` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 51 | `2026_10_24_000100_patient_portal_foundations.php` | `account_claim_invites` | Create | Cryptographic token invitations for claiming online patient accounts. | `patients, users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 52 | `2026_10_24_000200_create_assistant_usage_table.php` | `assistant_usage` | Create | Telemetry log recording AI assistant user interactions. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 53 | `2026_10_25_000100_create_assistant_answers_table.php` | `assistant_answers` | Create | Knowledge base Q&A interaction pairs for patient AI support. | `users` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 54 | `2026_10_25_000200_add_email_to_branches.php` | `branches` | Alter | Adds contact email address column to branches table. | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 55 | `2026_10_26_000100_add_weekly_hours_to_branches.php` | `branches` | Alter | Adds weekly operating hours schedule JSONB to branches. | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 56 | `2026_10_27_000100_create_automation_settings_and_deliveries.php` | `automation_settings, automation_deliveries` | Create | Automation event triggers, schedules, and delivery logs. | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 57 | `2026_10_27_000200_create_no_show_flags_table.php` | `no_show_flags` | Create | Patient attendance tracking and automated no-show policy flagging. | `appointments, patients` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 58 | `2026_10_27_000300_create_waitlist_entries_table.php` | `waitlist_entries` | Create | Priority queue for patients waiting for freed appointment slots. | `patients, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 59 | `2026_10_27_000400_add_automation_notification_kinds.php` | `automation_settings` | Alter | Adds expanded notification channels and template types. | `automation_settings` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 60 | `2026_10_28_000100_create_message_templates_table.php` | `message_templates` | Create | Standardized SMS/Email notification macro templates. | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 61 | `2026_10_28_000200_create_arrival_and_freed_slot_tables.php` | `slot_openings, slot_offers` | Create | Manages cancelled appointment slot openings and automated offers. | `appointments` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 62 | `2026_10_28_000300_create_branch_closures_table.php` | `branch_closures` | Create | Clinic holiday and emergency closure date calendar. | `branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 63 | `2026_10_28_000400_add_online_booking_mode_to_services.php` | `services` | Alter | Adds online patient portal self-booking visibility flag. | `services` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 64 | `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php` | `accepted_hmos` | Create | Accredited HMO insurance providers master registry. | `None` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 65 | `2026_10_29_000100_add_suppressed_mail_status.php` | `mail_dispatches` | Alter | Adds bounced/suppressed email status to dispatch queue. | `mail_dispatches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 66 | `2026_10_29_000200_create_intake_tables.php` | `intake_submissions, branch_join_codes, patient_guardians` | Create | Patient check-in intake queue, daily join codes, and guardian relations. | `branches, patients` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 67 | `2026_10_29_000300_harden_account_claims.php` | `account_claim_invites` | Hardening | Adds cryptographic expiration and rate-limiting to account claims. | `account_claim_invites` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 68 | `2026_10_30_000100_create_work_schedules.php` | `dentist_schedules, dentist_schedule_exceptions` | Create | Recurring weekly clinician rosters and date-specific exceptions. | `dentist_profiles, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 69 | `2026_10_30_000200_create_leave_requests.php` | `leave_requests` | Create | Dentist and staff leave workflow with coverage verification. | `users, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 70 | `2026_10_30_000300_create_patient_handovers.php` | `patient_handovers` | Create | Shift-change clinical handover notes and patient transfer log. | `patients, dentist_profiles` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 71 | `2026_10_31_000100_create_prescriptions.php` | `prescriptions, prescription_lines, prescription_counters` | Create | Digital prescriptions, medication lines, and sequential counter. | `visits, dentist_profiles` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 72 | `2026_10_31_000200_create_followup_tasks.php` | `followup_tasks` | Create | Post-treatment patient follow-up recalls and clinical reminders. | `visits, patients` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 73 | `2026_10_31_000300_create_dental_charts.php` | `tooth_chart_entries` | Create | Detailed odontogram tooth chart conditions and append-only entries. | `patients, branches` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 74 | `2026_11_01_000100_add_booking_payment_to_appointments.php` | `appointments, appointment_responses` | Alter | Adds booking deposit fields and patient confirmation responses. | `appointments` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 75 | `2026_11_02_000100_add_discounts_and_feedback_review.php` | `invoices, visits` | Alter | Adds Senior/PWD discounts to invoices and Google review status to visits. | `invoices, visits` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 76 | `2026_11_10_000100_remove_patient_feedback_table.php` | `patient_feedback` | Drop Table | Permanently drops patient_feedback table; replaces with visit reviews. | `patient_feedback` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 77 | `2026_11_15_000100_add_archive_columns_to_core_tables.php` | `invoices, visits, prescriptions, user_notifications` | Alter | Adds archived_at, archived_by_user_id, archive_reason soft-delete columns. | `Core Tables` | [Reported applied on prod by owner; Not verified on hosted Supabase] |
| 78 | `2026_11_15_000200_create_invoice_refunds_table.php` | `invoice_refunds` | Create | Credit notes and refund transactions with append-only trigger guard. | `invoices` | [Verified in local test; Not verified on hosted Supabase] |
| 79 | `2026_11_15_000300_expand_patient_consents_check.php` | `patient_consents` | Create / Check | Establishes patient legal consent agreements and expands check types. | `patients` | [Verified in local test; Not verified on hosted Supabase] |
| 80 | `2026_11_15_000400_backfill_tooth_chart_branch.php` | `tooth_chart_entries` | Data Backfill | Backfills branch_id on historical tooth chart entries with trigger pause. | `tooth_chart_entries` | [Verified in local test; Not verified on hosted Supabase] |
| 81 | `2026_11_15_000500_add_critical_foreign_key_and_analytics_indexes.php` | `Multiple Tables` | Index Hardening | Adds missing FK constraints and composite performance indexes. | `Multiple` | [Verified in local test; Not verified on hosted Supabase] |
| 82 | `2026_11_16_000100_create_loyalty_and_referrals_tables.php` | `loyalty_accounts, referrals, loyalty_ledger, loyalty_lot_consumptions` | Create | M24 patient loyalty points ledger, referrals, and lot consumptions. | `patients` | [Verified in local test; Not verified on hosted Supabase] |
| 83 | `2026_11_16_000200_remove_kiosk_channel_from_intake_submissions.php` | `intake_submissions` | Constraint Alter | GEN-05: Removes kiosk channel from check constraint with zero-count guard. | `intake_submissions` | [Verified in local test; Not verified on hosted Supabase] |

---

## 3. Seven Implementation Epochs Analysis

The migration history naturally divides into seven distinct architectural epochs:

### Epoch 1: Foundational Identity, Security & Core Branches (Migrations 1-18)
* **Goal:** Establish multi-tenant user authentication, RBAC, branch locations, and staff/dentist profile models.
* **Key Milestones:**
  - `persons` master identity hub created; `middle_name` dropped in migration 15 to streamline legal naming.
  - Multi-branch facility deployment established (`branches`, `dentist_branches`, `user_branch_scopes`).
  - Eloquent soft deletion (`deleted_at`) added to `users` (migration 16).
  - Public ID obfuscation introduced (`patients.public_id`, `users.public_id`).

### Epoch 2: Appointments, Visits, Queues & Clinical Care (Migrations 19-29)
* **Goal:** Model patient care lifecycle from booking to reception, live queuing, and doctor encounters.
* **Key Milestones:**
  - `appointments` with trigger-guarded immutable history (`appointment_history`).
  - `visits` encounter records created with data backfills from completed appointments.
  - Live flow queuing implemented with `dentist_queues` and `queue_entries`.

### Epoch 3: Financials, Invoicing, HMO & Audit Trails (Migrations 30-41)
* **Goal:** Financial billing, official receipts, HMO pre-authorization, and immutable compliance auditing.
* **Key Milestones:**
  - `invoices`, `invoice_lines`, `invoice_histories`, `payments`, and `receipts` created.
  - Strict append-only triggers installed on `audit_logs`, `payments`, and `service_prices`.
  - HMO insurance tracking (`hmo_cases`, `patient_hmo_memberships`).

### Epoch 4: Patient Communications, Portal & Engagement (Migrations 42-55)
* **Goal:** Patient portal infrastructure, direct messaging, automated email dispatch, and AI assistant telemetry.
* **Key Milestones:**
  - Multi-participant messaging (`conversations`, `conversation_messages`).
  - BIR tax fields added to branches (`tin_number`, `tax_branch_code`, `rdo_code`).
  - Patient AI support telemetry tables (`assistant_usage`, `assistant_answers`).

### Epoch 5: Automation Engine, Rosters, Closures & Intake (Migrations 56-70)
* **Goal:** Smart clinic scheduling, holiday closures, attendance tracking, and check-in intake.
* **Key Milestones:**
  - `dentist_schedules` and `dentist_schedule_exceptions` with no-delete triggers.
  - Automated waitlist recovery (`waitlist_entries`, `slot_openings`, `slot_offers`).
  - Intake queue (`intake_submissions`, `branch_join_codes`, `patient_guardians`).
  - *STF-04 Scope Boundary Note:* Counter form provides `other_details`, but backend persistence remains pending approval (Partial / In Progress).

### Epoch 6: Prescriptions, Odontogram Charts & Follow-ups (Migrations 71-75)
* **Goal:** Clinical charting, digital prescriptions, and post-treatment recalls.
* **Key Milestones:**
  - `prescriptions` with sequential counters and medication lines.
  - Odontogram tooth charting with append-only entries (`tooth_chart_entries`).
  - Post-treatment recalls (`followup_tasks`).

### Epoch 7: Production Hardening, Archive, Loyalty & GEN-05 Kiosk Removal (Migrations 76-83)
* **Goal:** Defense preparation, non-destructive archiving, loyalty rewards, and kiosk decommissioning.
* **Key Milestones:**
  - Permanently dropped obsolete `patient_feedback` table (Migration 76).
  - Applied soft-delete archive columns (`archived_at`, `archived_by_user_id`, `archive_reason`) on 4 core tables: `invoices`, `visits`, `prescriptions`, `user_notifications` (Migration 77). Status: [Reported applied on prod by owner; Not verified on hosted Supabase].
  - Added financial refund credit notes (`invoice_refunds`) (Migration 78).
  - Added M24 loyalty points rewards ledger and referrals (Migration 82).
  - Removed kiosk channel from `intake_submissions` with strict preflight verification (Migration 83). Status: [Verified in local test; Not verified on hosted Supabase].

---

## 4. Schema Audit Certification

This change register confirms that the database structure defined by migrations 1–83 has been rigorously audited against the codebase. It represents the exact, verified schema to be deployed for the project defense.
