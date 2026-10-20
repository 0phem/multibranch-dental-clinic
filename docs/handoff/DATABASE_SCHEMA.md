# Database Schema & Migrations: Multi-Branch Dental Clinic System

Authoritative database engine: **PostgreSQL 16**.
All primary keys use auto-incrementing BigInt or ULID `public_id` strings for public-facing identifiers.
Multiple clinical and financial tables enforce **append-only semantics via PostgreSQL triggers** that raise exceptions on `UPDATE` or `DELETE`.

---

## 1. Identity & Access Management (M1)

### `persons` (Hub of Identity)
- Created by: `0000_01_01_000000_create_persons_table.php`
- Columns: `id` (PK, bigserial), `first_name` (varchar), `last_name` (varchar), `email` (varchar, unique, nullable), `phone` (varchar), `date_of_birth` (date, nullable), `sex` (varchar, nullable), `address` (text, nullable), `timestamps`.
- Relationships: Shared root referenced by `users.person_id` and `patients.person_id`.

### `users` (Staff, Dentists, Owners & Online Patients)
- Created by: `0001_01_01_000000_create_users_table.php`
- Additions: `2026_09_25_140000_add_deleted_at_to_users_table.php`, `2026_09_29_000100_add_public_id_to_users_table.php`, `2026_10_29_000300_harden_account_claims.php`
- Columns: `id` (PK, bigserial), `public_id` (ulid, unique), `person_id` (FK -> persons.id, unique), `email` (varchar, unique), `password` (varchar), `role` (enum: patient, staff, dentist, owner), `title` (varchar, display only), `account_status` (enum: Active, Inactive), `auth_version` (integer), `pending_claim` (boolean, default false), `deleted_at` (timestamp, soft delete), `timestamps`.

### `user_branch_scopes`
- Created by: `2026_09_28_000100_create_user_branch_scopes_table.php`
- Columns: `id` (PK), `user_id` (FK -> users.id), `branch_id` (FK -> branches.id), `timestamps`.

### `email_verification_otps`
- Created by: `2026_09_30_000100_create_email_verification_otps_table.php`, modified by `2026_10_19_000100_add_purpose_to_email_verification_otps.php`
- Columns: `id` (PK), `email` (varchar), `code_hash` (varchar), `purpose` (varchar: register, reset, claim, email_change), `attempts` (smallint), `expires_at` (timestamp), `used_at` (timestamp, nullable), `timestamps`.

---

## 2. Patients & Intake (M1, M4)

### `patients`
- Created by: `2026_09_24_000200_create_patients_table.php`
- Additions: `2026_09_28_000050_add_public_id_to_patients_table.php`, `2026_10_11_000100_add_patient_record_fields.php`, `2026_10_28_000500_create_accepted_hmos_and_patient_hmo_fields.php`
- Columns: `id` (PK), `public_id` (ulid, unique), `person_id` (FK -> persons.id, unique), `patient_code` (varchar, unique: P-YYYYMM-XXXX), `consent` (boolean), `emergency_contact_name` (varchar, nullable), `emergency_contact_phone` (varchar, nullable), `hmo_provider_id` (FK -> accepted_hmos.id, nullable), `hmo_member_number_enc` (text, nullable), `id_verified_at` (timestamp, nullable), `id_verified_by` (FK -> users.id, nullable), `id_type` (varchar, nullable), `id_last4` (varchar, nullable), `timestamps`.
- Rule: No hard delete.

### `counter_registrations` & `daily_branch_codes`
- Created by: `2026_10_29_000200_create_intake_tables.php`
- Columns (`daily_branch_codes`): `id`, `branch_id` (FK), `date` (date), `code` (varchar(4)), `expires_at`, `timestamps`.
- Columns (`counter_registrations`): `id`, `branch_id` (FK), `temp_payload` (jsonb), `status` (pending, verified, cancelled, expired), `expires_at`, `timestamps`.

### `account_claim_invites`
- Created by: `2026_10_29_000300_harden_account_claims.php`
- Columns: `id`, `patient_id` (FK), `token_hash` (varchar, unique), `expires_at` (24 hours), `used_at`, `created_by` (FK -> users.id), `timestamps`.

---

## 3. Branches & Reference Data (M2, M13)

### `branches`
- Created by: `2026_09_25_000100_create_branches_table.php`, modified by `2026_10_21_000100_add_bir_fields_to_branches.php`, `2026_10_25_000200_add_email_to_branches.php`, `2026_10_26_000100_add_weekly_hours_to_branches.php`
- Columns: `id` (PK), `name` (varchar), `legacy_ref` (varchar: branch-a, branch-b, branch-c), `phone` (varchar), `email` (varchar, nullable), `address` (text), `latitude` (numeric), `longitude` (numeric), `weekly_hours` (jsonb), `tin` (varchar, nullable), `bir_permit_no` (varchar, nullable), `is_active` (boolean), `timestamps`.

### `branch_closures`
- Created by: `2026_10_28_000300_create_branch_closures_table.php`
- Columns: `id`, `branch_id` (FK, nullable for all branches), `start_date` (date), `end_date` (date), `reason` (varchar), `is_partial` (boolean), `partial_hours` (jsonb, nullable), `created_by` (FK), `timestamps`.

### `services` & `service_prices`
- Created by: `2026_09_25_000200_create_services_table.php`, `2026_10_03_000100_create_service_prices_table.php`
- Columns (`services`): `id`, `name`, `code` (varchar, unique), `category` (varchar), `duration_minutes` (integer), `online_booking_mode` (enum: online, consultation_first, hidden), `consultation_service_id` (FK, self-reference), `timestamps`.
- Columns (`service_prices`): `id`, `service_id` (FK), `amount_cents` (bigint), `effective_from` (timestamp), `effective_to` (timestamp, nullable), `source` (varchar), `retracted_at` (timestamp, nullable).

---

## 4. Work Schedules, Leave & Handovers (M3, M15, M25)

### `work_schedules` & `dentist_schedule_exceptions`
- Created by: `2026_10_30_000100_create_work_schedules.php`
- Columns (`work_schedules`): `id`, `dentist_profile_id` (FK), `branch_id` (FK), `day_of_week` (smallint: 0=Sun..6=Sat), `start_time` (time), `end_time` (time), `break_start` (time, nullable), `break_end` (time, nullable), `timestamps`.
- Columns (`dentist_schedule_exceptions`): `id`, `dentist_profile_id` (FK), `branch_id` (FK), `date` (date), `is_day_off` (boolean), `start_time`, `end_time`, `timestamps`.

### `leave_requests`
- Created by: `2026_10_30_000200_create_leave_requests.php`
- Columns: `id`, `user_id` (FK), `start_date` (date), `end_date` (date), `leave_type` (varchar: vacation, sick, other), `private_note_enc` (text, encrypted at rest), `status` (pending, approved, declined, cancelled), `reviewed_by` (FK -> users.id, nullable), `reviewed_at` (timestamp, nullable), `timestamps`.

### `patient_handovers`
- Created by: `2026_10_30_000300_create_patient_handovers.php`
- Columns: `id`, `patient_id` (FK), `from_branch_id` (FK), `to_branch_id` (FK), `sending_user_id` (FK), `target_dentist_id` (FK, nullable), `summary_enc` (text, encrypted), `status` (sent, acknowledged, cancelled, expired), `expires_at` (timestamp, default 60 days after ack), `acknowledged_at` (timestamp), `timestamps`.

---

## 5. Appointments, Visits & Queue (M6, M8, M9)

### `appointments`
- Created by: `2026_09_28_000200_create_appointments_table.php`, modified by `2026_09_29_000200_add_appointment_code_to_appointments_table.php`
- Constraint: PostgreSQL `btree_gist` exclusion constraint prevents overlapping bookings for the same dentist or patient.
- Columns: `id` (PK), `appointment_code` (varchar, unique: A-YYYYMM-XXXX), `patient_id` (FK), `dentist_profile_id` (FK), `branch_id` (FK), `service_id` (FK), `date` (date), `start_time` (time), `end_time` (time), `status` (Pending, Confirmed, CheckedIn, Completed, Cancelled, NoShow), `is_late_cancellation` (boolean), `cancellation_reason` (text, nullable), `timestamps`.

### `visits` & `queue_entries`
- Created by: `2026_09_30_000100_create_visits_table.php`, `2026_10_01_000100_create_queue_tables.php`
- Columns (`visits`): `id`, `public_id` (ulid), `patient_id` (FK), `branch_id` (FK), `appointment_id` (FK, nullable), `dentist_profile_id` (FK), `type` (booked, walk_in), `check_in_at` (timestamp), `status` (CheckedIn, InProgress, Completed), `timestamps`.
- Columns (`queue_entries`): `id`, `visit_id` (FK, unique), `branch_id` (FK), `dentist_profile_id` (FK), `queue_number` (integer), `phase` (waiting, called, in_treatment, completed, skipped), `is_moved_to_end` (boolean), `timestamps`.
- Trigger: `prevent_visit_delete` and `prevent_queue_entry_delete` guarantee append-only record keeping.

---

## 6. Clinical Records: Treatments & Dental Charts (M5, M10)

### `treatments` & `treatment_lines`
- Created by: `2026_10_02_000100_create_treatment_tables.php`
- Columns (`treatments`): `id`, `visit_id` (FK, unique), `patient_id` (FK), `dentist_profile_id` (FK), `status` (Draft, Completed), `completed_at` (timestamp), `notes_enc` (text), `timestamps`.
- Columns (`treatment_lines`): `id`, `treatment_id` (FK), `service_id` (FK), `tooth_number` (smallint, nullable), `surface` (varchar, nullable), `notes` (text, nullable), `timestamps`.
- Trigger: `lock_completed_treatment` trigger rejects any row updates or line insertions after `status='Completed'`.

### `dental_charts`
- Created by: `2026_10_31_000300_create_dental_charts.php`
- Columns: `id` (PK, bigserial), `patient_id` (FK -> patients.id), `tooth_number` (smallint: 11-48 FDI or 1-32 Universal), `is_primary` (boolean), `status` (varchar: healthy, caries, filled, crown, root_canal, missing, extracted, implant, to_monitor), `surfaces` (varchar(5), nullable: M,O,D,B,L), `notes_enc` (text, encrypted, nullable), `recorded_by_dentist_id` (FK -> dentist_profiles.id), `treatment_id` (FK, nullable), `created_at` (timestamp).
- Trigger: `dental_charts_append_only_trigger` refuses all `UPDATE` and `DELETE` queries.

---

## 7. Prescriptions & Follow-Ups (M19, M20)

### `prescriptions` & `prescription_lines`
- Created by: `2026_10_31_000100_create_prescriptions.php`
- Columns (`prescriptions`): `id`, `prescription_no` (varchar, unique: RX-YYYY-000001 gapless), `patient_id` (FK), `dentist_profile_id` (FK), `branch_id` (FK), `treatment_id` (FK, nullable), `status` (Active, Voided), `void_reason` (text, nullable), `voided_at` (timestamp, nullable), `dentist_license_no` (varchar, nullable), `notes_enc` (text, nullable), `timestamps`.
- Columns (`prescription_lines`): `id`, `prescription_id` (FK), `line_order` (smallint), `medication` (varchar), `dosage` (varchar), `frequency` (varchar), `duration` (varchar), `instructions` (text), `timestamps`.
- Trigger: `prescriptions_append_only_trigger` locks lines and active prescription details permanently.

### `followup_tasks`
- Created by: `2026_10_31_000200_create_followup_tasks.php`
- Columns: `id`, `patient_id` (FK), `branch_id` (FK), `service_id` (FK), `created_by_user_id` (FK), `treatment_id` (FK, nullable), `status` (Open, Contacted, Booked, Closed), `due_date` (date), `reason` (varchar), `closing_note` (text, nullable), `booked_appointment_id` (FK, nullable), `timestamps`.

---

## 8. Billing, Payments & PayMongo (M11, M23)

### `invoices` & `invoice_lines`
- Created by: `2026_10_05_000100_create_billing_tables.php`, modified by `2026_10_14_000100_harden_m11_payment_integrity.php`
- Columns (`invoices`): `id`, `invoice_no` (varchar, unique: INV-YYYYMM-XXXX), `patient_id` (FK), `treatment_id` (FK, unique), `branch_id` (FK), `total_cents` (bigint), `status` (Draft, Issued, Paid, Voided), `issued_at` (timestamp), `paid_at` (timestamp), `timestamps`.
- Columns (`invoice_lines`): `id`, `invoice_id` (FK), `service_id` (FK), `description` (varchar), `quantity` (smallint), `unit_price_cents` (bigint), `total_price_cents` (bigint), `timestamps`.
- Trigger: `lock_issued_invoice` prevents modifications to amounts or lines once `Issued` or `Paid`.

### `payments`
- Created by: `2026_10_05_000100_create_billing_tables.php`
- Columns: `id`, `invoice_id` (FK), `amount_cents` (bigint), `method` (cash, gcash, card, hmo), `status` (pending, paid, failed, refunded), `paymongo_checkout_id` (varchar, nullable), `paymongo_payment_id` (varchar, nullable), `idempotency_key` (varchar, unique), `receipt_no` (varchar, unique: REC-YYYYMM-XXXX), `paid_at` (timestamp), `timestamps`.

---

## 9. Communication, Outbox & Audit (M17, M18, M22)

### `conversations` & `messages`
- Created by: `2026_10_16_000100_create_messaging_tables.php`, modified by `2026_10_20_000100_m17_routing_and_encryption.php`
- Columns (`conversations`): `id`, `patient_id` (FK), `branch_id` (FK), `status` (Open, Closed), `last_message_at` (timestamp), `timestamps`.
- Columns (`messages`): `id`, `conversation_id` (FK), `sender_id` (FK -> users.id), `body_enc` (text, encrypted with APP_KEY), `read_at` (timestamp, nullable), `timestamps`.

### `mail_outbox`
- Created by: `2026_10_18_000100_create_mail_dispatch_tables.php`, modified by `2026_10_29_000100_add_suppressed_mail_status.php`
- Columns: `id`, `recipient_email` (varchar), `template` (varchar), `subject` (varchar), `payload_enc` (text, encrypted), `status` (pending, sending, sent, failed, suppressed), `attempts` (smallint), `error_message` (text, nullable), `sent_at` (timestamp, nullable), `timestamps`.

### `audit_logs`
- Created by: `2026_10_07_000100_create_audit_logs_table.php`, modified by `2026_10_13_000100_enforce_audit_log_append_only.php`
- Columns: `id` (bigserial), `user_id` (FK, nullable), `action` (varchar), `entity_type` (varchar), `entity_id` (varchar), `changed_fields` (jsonb, field names only, no PHI/secrets), `ip_address` (varchar), `created_at` (timestamp).
- Trigger: `audit_logs_append_only_trigger` prevents any `UPDATE` or `DELETE` on the audit log.

---

## 10. Database Status & Pending Clinic Migrations

### Currently Applied on `dental_clinic_demo` and `dental_clinic_test`:
All 73 migrations listed above (through `2026_10_31_000300_create_dental_charts.php`) are fully applied and active on the demo and test databases.

### Pending for Real Clinic Database `dental_clinic` (Do NOT run now):
Per Hard Rule 1, changes to `dental_clinic` require the clinic owner's explicit written approval:
1. `2026_10_23_000100_create_clinic_settings_table`
2. `2026_10_25_000200_add_email_to_branches` & `2026_10_26_000100_add_weekly_hours_to_branches`
3. `2026_10_27_000100` to `000400` (Automations A1–A6)
4. `2026_10_28_000100` to `000500` (Interview round 2: templates, closures, HMO fields)
5. `2026_10_29_000100` to `000300` (Counter intake, ID checks, hardened claim links)
6. `2026_10_30_000100` to `000300` (Work schedules, leave requests, handovers)
7. `2026_10_31_000100` to `000300` (Prescriptions, follow-ups, dental charts)
Approval and execution sequence is documented in [`docs/POST_DEFENSE_TASKS.md`](../POST_DEFENSE_TASKS.md).
