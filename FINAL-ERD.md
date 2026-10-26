# FINAL ENTITY-RELATIONSHIP DIAGRAMS (ERD) — MULTIBRANCH DENTAL CLINIC OPERATIONS PLATFORM

**Date:** October 26, 2026<br>
**Audience:** Joevan (Database Administrator), Engineering Team, Defense Committee<br>
**Total Tables Documented:** 91 Active Tables (83 Domain + 8 Framework)<br>
**Foreign Key Constraints (FK):** ~232 [ESTIMATED database constraints]<br>
**Format:** Native Mermaid `erDiagram` Specifications<br>

---

## 1. Architectural Invariants, Date Discrepancy & Evidence Standards

### 1.1 Date Discrepancy & Future-Dated Migrations
* **Audit Date:** October 26, 2026.
* **Future-Dated Migration Files:** Exactly **28 migration files** (#56 to #83) in `backend/database/migrations/` bear filename timestamp prefixes dated after October 26, 2026 (ranging from October 27 to November 16, 2026). Future timestamp prefixes are a possible explanation (e.g., forward-dated sprint milestone identifiers), but this convention has not been formally confirmed by the project owner.
* **Migration Renaming & Tracking Invariant:** Changing the filename of a migration that has already run can cause Laravel to treat the renamed file as a different, pending migration because the recorded name in the `migrations` table no longer matches. Depending on the migration, re-execution may fail or cause unintended schema changes. Therefore, do not rename applied migrations without a reviewed migration-history and deployment plan.
* **Owner-Reported Production Status vs. Filename Contradiction:** Migration 77's production status remains owner-reported (`2026_11_15_000100_add_archive_columns_to_core_tables.php` was communicated as already applied on production `dental_clinic`), not independently verified by this static audit. This date contradiction (dated November 15 but reported applied on or before October 26) is preserved as reported but explicitly marked as **[Not verified on hosted Supabase]**.
* **Local Test vs. Hosted Status:** Migration 83 is recorded as `Ran` in local `dental_clinic_test`; its hosted Supabase status remains unverified. Joevan must independently confirm hosted status using read-only verification queries.

### 1.2 Evidence Classifications & Safety Scope
* **Audit Safety Scope:** This corrective documentation pass performed **zero database queries, zero SQL executions, and zero Git index or worktree mutations**. Earlier development workflow steps in prior turns included focused local testing against `dental_clinic_test`. Neither production `dental_clinic` nor hosted Supabase has been inspected.
* **Exact vs. Estimated Metrics:**
  * Active Canonical Tables: **91 tables** (83 domain + 8 framework) **[EXACT]** — derived from 92 unique tables created minus 1 dropped (`patient_feedback`).
  * Total Columns: **1,111 physical columns** **[EXACT]** — distinct physical column definitions in the intended final schema across all 91 canonical tables, after applying migration-created columns, later additions and alterations, and documented drops (exhaustively documented in `FINAL-ERD-DICTIONARY.md`). Excludes Markdown headers, separator rows, descriptions, constraint notes, and relationship notes.
  * Migration-Defined Triggers: **44 triggers** **[EXACT]** — net active triggers in migrations (45 created in up() minus 1 dropped).
  * Trigger-Protected Tables: **40 distinct tables** **[EXACT]** — accounting for 4 overlapping tables (`audit_logs`, `loyalty_ledger`, `loyalty_lot_consumptions`, `treatments`).
  * Foreign Keys: **~232 constraints** **[ESTIMATED]** — static source estimate.
  * Unique Constraints & Indexes: **~106 constraints/indexes** **[ESTIMATED]** — static source estimate.
  * Check Constraints: **~125 constraints** **[ESTIMATED]** — static net active check constraints.
  * Plain Secondary Indexes: **~58 indexes** **[ESTIMATED]** — static source estimate.
* **STF-04 Scope Boundary:** In `CounterIntake.jsx`, the receptionist counter form provides an "Other valid ID" text field (`other_details`). Backend request validation and database persistence for this field remain **pending approval** (recorded as **Partial / In Progress**). This missing persistence is an incomplete implementation item awaiting client/team approval, **NOT** an intentional final design decision. No column is added to `intake_submissions`.
* **Multi-Tier Retention Model:**
  * `users` uses Laravel Eloquent soft deletion (`deleted_at`).
  * `invoices`, `visits`, `prescriptions`, and `user_notifications` contain archive metadata (`archived_at`, `archived_by_user_id`, `archive_reason`).
  * 40 tables are protected by 44 PostgreSQL engine-level triggers.
  * 20 specific backend delete operations handle ephemeral authentication sessions, tokens, scope re-syncs, and unfinalized draft procedure/prescription lines.
  * `patient_feedback` was permanently dropped in migration 76 and is omitted from all diagrams.

---
## 2. Global Core Domain Architecture Overview

The following high-level diagram visualizes the primary aggregate roots and relational backbone of the multi-branch dental clinic system:

```mermaid
erDiagram
    persons ||--o| users : "authenticates"
    persons ||--o| patients : "identifies"
    users ||--o{ staff_profiles : "staff_role"
    users ||--o{ dentist_profiles : "clinician_role"
    branches ||--o{ dentist_branches : "deploys"
    branches ||--o{ appointments : "hosts"
    branches ||--o{ dentist_queues : "operates"
    dentist_profiles ||--o{ dentist_branches : "assigned_to"
    dentist_profiles ||--o{ appointments : "attends"
    dentist_profiles ||--o{ dentist_queues : "queue_owner"
    patients ||--o{ appointments : "books"
    patients ||--o{ visits : "admitted"
    patients ||--o{ invoices : "billed_to"
    patients ||--o{ tooth_chart_entries : "dental_history"
    patients ||--o{ loyalty_accounts : "earns_rewards"
    appointments ||--o| visits : "encounter_origin"
    dentist_queues ||--o{ queue_entries : "contains"
    queue_entries ||--o| visits : "ticket_encounter"
    visits ||--o| treatments : "documents"
    visits ||--o{ prescriptions : "prescribes"
    visits ||--o| invoices : "generates_billing"
    treatments ||--o{ treatment_procedures : "procedure_lines"
    invoices ||--o{ invoice_lines : "charge_items"
    invoices ||--o{ payments : "settled_by"
    invoices ||--o{ invoice_refunds : "credited_by"
    payments ||--o| receipts : "official_tax_receipt"
    accepted_hmos ||--o{ patient_hmo_memberships : "covers"
    patient_hmo_memberships ||--o{ hmo_cases : "claims"
    visits ||--o{ hmo_cases : "claim_encounter"
```

---

## 3. Modular Subsystem Entity-Relationship Diagrams

To provide complete relational fidelity without overwhelming diagram parsers, the 91 active tables are documented across 12 focused subsystem domain models below. Every table, column type, key, and relationship is derived from audited PostgreSQL migration definitions.


### Subsystem 1: Identity, Authentication & Framework Infrastructure

*Foundational identity aggregate (persons, users), branch associations, authentication tokens, and Laravel framework session/job/cache tables.*

```mermaid
erDiagram
    persons {
bigint id PK
varchar first_name
varchar last_name
varchar phone
date date_of_birth
varchar sex
varchar address
timestamp created_at
timestamp updated_at
string email
    }
    users {
bigint id PK
timestamp email_verified_at
varchar password
varchar remember_token
timestamp created_at
timestamp updated_at
timestamp deleted_at
string public_id
int auth_version
    }
    user_branch_scopes {
bigint id PK
bigint user_id FK
string branch_id
timestamp created_at
timestamp updated_at
    }
    email_verification_otps {
bigint id PK
bigint user_id FK
varchar digest
int attempts
timestamp expires_at
timestamp sent_at
timestamp consumed_at
timestamp created_at
timestamp updated_at
varchar purpose
varchar new_email
    }
    account_claim_invites {
bigint id PK
bigint patient_id FK
varchar email
varchar token_hash UK
varchar issued_by_kind
bigint created_by_user_id FK
timestamp expires_at
timestamp used_at
timestamp created_at
    }
    password_reset_tokens {
varchar email PK
varchar token
timestamp created_at
    }
    sessions {
varchar id PK
bigint user_id FK
varchar ip_address
text user_agent
text payload
int last_activity
    }
    personal_access_tokens {
bigint id PK
string tokenable
text name
varchar token UK
text abilities
timestamp last_used_at
timestamp expires_at
timestamp created_at
timestamp updated_at
    }
    cache {
varchar key PK
text value
bigint expiration
    }
    cache_locks {
varchar key PK
varchar owner
bigint expiration
    }
    jobs {
bigint id PK
varchar queue
text payload
int attempts
int reserved_at
int available_at
int created_at
    }
    job_batches {
varchar id PK
varchar name
int total_jobs
int pending_jobs
int failed_jobs
text failed_job_ids
text options
int cancelled_at
int created_at
int finished_at
    }
    failed_jobs {
bigint id PK
varchar uuid UK
varchar connection
varchar queue
text payload
text exception
timestamp failed_at
    }
    users ||--o{ user_branch_scopes : "user_id"
    users ||--o{ email_verification_otps : "user_id"
    users ||--o{ account_claim_invites : "created_by_user_id"
    users ||--o{ sessions : "user_id"
```


### Subsystem 2: Clinic Facilities, Closures & System Configuration

*Physical branch infrastructure, operational closure calendars, global clinic configuration settings, command keys, and billing cutovers.*

```mermaid
erDiagram
    branches {
bigint id PK
varchar legacy_ref UK
varchar branch_code UK
varchar name UK
varchar city
varchar address
varchar phone
time open_time
time close_time
varchar status
int capacity_threshold
numeric latitude
numeric longitude
timestamp created_at
timestamp updated_at
varchar public_id
varchar bir_registered_name
varchar bir_tin
varchar bir_registered_address
varchar bir_vat_status
varchar bir_permit_numbers
jsonb operating_days
varchar email
jsonb weekly_hours
    }
    branch_closures {
bigint id PK
varchar public_id UK
bigint branch_id FK
date closed_on
varchar reason
time open_time
time close_time
varchar status
varchar source
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp patients_notified_at
timestamp created_at
timestamp updated_at
    }
    clinic_settings {
varchar key PK
jsonb value
bigint updated_by_user_id FK
timestamp updated_at
    }
    command_keys {
bigint id PK
bigint user_id FK
varchar idempotency_key
varchar command
varchar request_hash
int response_status
timestamp created_at
    }
    m11_billing_cutovers {
bigint id PK
timestamp established_at
timestamp created_at
timestamp updated_at
    }
    branches ||--o{ branch_closures : "branch_id"
```


### Subsystem 3: Personnel Rosters, Dentist Availability, Leave & Handovers

*Clinical and staff profiles, branch affiliations, recurring schedules, exceptions, coverage-first leave requests, and clinical shift handovers.*

```mermaid
erDiagram
    staff_profiles {
bigint id PK
varchar legacy_ref UK
varchar legacy_user_ref
bigint person_id FK
bigint branch_id FK
time shift_start
time shift_end
boolean available
timestamp created_at
timestamp updated_at
varchar title
    }
    dentist_profiles {
bigint id PK
varchar legacy_ref UK
varchar legacy_user_ref
bigint person_id FK
varchar license_no UK
varchar specialty
time shift_start
time shift_end
boolean available
bigint assistant_staff_id FK
timestamp created_at
timestamp updated_at
    }
    dentist_branches {
bigint id PK
bigint dentist_profile_id FK
bigint branch_id FK
timestamp created_at
timestamp updated_at
    }
    dentist_schedules {
bigint id PK
varchar public_id UK
bigint dentist_profile_id FK
bigint branch_id FK
int weekday
time start_time
time end_time
time break_start
time break_end
varchar status
boolean demo
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    dentist_schedule_exceptions {
bigint id PK
varchar public_id UK
bigint dentist_profile_id FK
bigint branch_id FK
date on_date
varchar kind
time start_time
time end_time
varchar reason
varchar status
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    dentist_service_assignments {
bigint id PK
bigint dentist_profile_id FK
bigint service_id FK
boolean is_authorized
timestamp created_at
timestamp updated_at
    }
    leave_requests {
bigint id PK
varchar public_id UK
bigint requester_user_id FK
bigint dentist_profile_id FK
bigint staff_profile_id FK
varchar type
timestamp starts_at
timestamp ends_at
text private_note
varchar status
bigint decided_by_user_id FK
timestamp decided_at
bigint cancelled_by_user_id FK
timestamp cancelled_at
timestamp patients_notified_at
timestamp created_at
timestamp updated_at
    }
    patient_handovers {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint from_branch_id FK
bigint to_branch_id FK
bigint from_dentist_profile_id FK
bigint to_dentist_profile_id FK
bigint created_by_user_id FK
text summary
text pending_treatment
text notes
jsonb document_ids
varchar status
bigint acknowledged_by_user_id FK
timestamp acknowledged_at
bigint cancelled_by_user_id FK
timestamp cancelled_at
timestamp created_at
timestamp updated_at
    }
    staff_profiles ||--o{ dentist_profiles : "assistant_staff_id"
    dentist_profiles ||--o{ dentist_branches : "dentist_profile_id"
    dentist_profiles ||--o{ dentist_schedules : "dentist_profile_id"
    dentist_profiles ||--o{ dentist_schedule_exceptions : "dentist_profile_id"
    dentist_profiles ||--o{ dentist_service_assignments : "dentist_profile_id"
    dentist_profiles ||--o{ leave_requests : "dentist_profile_id"
    staff_profiles ||--o{ leave_requests : "staff_profile_id"
    dentist_profiles ||--o{ patient_handovers : "from_dentist_profile_id"
```


### Subsystem 4: Dental Services, Fee Schedules & Pricing

*Master service catalog, branch-level service offerings, and append-only versioned fee schedules.*

```mermaid
erDiagram
    services {
bigint id PK
varchar legacy_ref UK
varchar code UK
varchar name
int duration_minutes
numeric reference_fee_php
varchar category
varchar status
timestamp created_at
timestamp updated_at
varchar description
varchar online_booking
bigint consultation_service_id FK
    }
    branch_services {
bigint id PK
bigint branch_id FK
bigint service_id FK
boolean active
int duration_override_minutes
timestamp created_at
timestamp updated_at
    }
    service_prices {
bigint id PK
varchar public_id UK
bigint service_id FK
bigint branch_id FK
varchar kind
numeric amount
date effective_from
varchar source
timestamp retracted_at
bigint retracted_by_user_id FK
bigint created_by_user_id FK
timestamp created_at
    }
    services ||--o{ services : "consultation_service_id"
    services ||--o{ branch_services : "service_id"
    services ||--o{ service_prices : "service_id"
```


### Subsystem 5: Patient Master Records, Guardianship & Intake Submissions

*Patient master profiles, legal guardian relationships, daily branch join codes, check-in intake submissions, and consent records.*

```mermaid
erDiagram
    patients {
bigint id PK
bigint person_id FK
boolean consent
timestamp created_at
timestamp updated_at
string public_id
int revision
varchar emergency_contact
bigint preferred_branch_id FK
jsonb billing_address
timestamp confirmation_required_at
timestamp attendance_cleared_at
varchar hmo_provider_name
text hmo_member_number
varchar registration_source
varchar id_type
varchar id_last4
bigint id_verified_by_user_id FK
timestamp id_verified_at
    }
    patient_guardians {
bigint id PK
varchar public_id UK
bigint dependent_patient_id FK
bigint guardian_patient_id FK
varchar relationship
timestamp consent_at
bigint consent_by_user_id FK
varchar status
timestamp ended_at
varchar ended_reason
bigint ended_by_user_id FK
bigint created_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    branch_join_codes {
bigint id PK
bigint branch_id FK
date clinic_date
varchar code
boolean active
bigint created_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    intake_submissions {
bigint id PK
varchar public_id UK
varchar reference UK
bigint branch_id FK
varchar channel
text data
jsonb scanned_fields
boolean join_queue
varchar visit_for
bigint account_patient_id FK
varchar status
bigint patient_id FK
bigint visit_id FK
bigint confirmed_by_user_id FK
timestamp confirmed_at
timestamp consent_at
varchar consent_version
varchar device_hash
timestamp created_at
timestamp updated_at
    }
    patient_consents {
bigint id PK
varchar public_id UK
string patient_id
bigint document_id FK
varchar consent_type
varchar version
varchar status
text notes
timestamp signed_at
timestamp withdrawn_at
bigint recorded_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    patients ||--o{ patient_guardians : "dependent_patient_id"
    patients ||--o{ intake_submissions : "account_patient_id"
```


### Subsystem 6: Appointments, Scheduling Engine, Rescheduling & Waitlists

*Central appointment booking entities, immutable rescheduling history, slot openings, offers, no-show flags, and prioritized waitlists.*

```mermaid
erDiagram
    appointments {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint branch_id FK
bigint service_id FK
bigint dentist_profile_id FK
timestamp starts_at
timestamp ends_at
varchar status
varchar source
varchar assignment_method
varchar assignment_rule_version
int revision
text notes
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp cancelled_at
timestamp created_at
timestamp updated_at
numeric booking_fee_php
varchar booking_payment_status
timestamp booking_hold_expires_at
varchar booking_payment_method
varchar booking_payment_ref
timestamp booking_paid_at
varchar booking_refund_ref
timestamp booking_refunded_at
    }
    appointment_history {
bigint id PK
bigint appointment_id FK
varchar event
varchar from_status
varchar to_status
int revision
bigint branch_id FK
bigint dentist_profile_id FK
timestamp starts_at
timestamp ends_at
bigint actor_user_id FK
varchar actor_role
varchar assignment_rule_version
timestamp occurred_at
    }
    appointment_command_keys {
bigint id PK
bigint user_id FK
varchar idempotency_key
varchar command
varchar request_hash
bigint appointment_id FK
int response_status
timestamp created_at
    }
    appointment_responses {
bigint id PK
bigint appointment_id FK
int appointment_revision
varchar response
varchar via
varchar link_hash UK
timestamp created_at
    }
    slot_openings {
bigint id PK
varchar public_id UK
bigint branch_id FK
bigint dentist_profile_id FK
timestamp starts_at
timestamp ends_at
date clinic_date
varchar source
bigint appointment_id FK
int appointment_revision
varchar status
varchar filled_via
bigint filled_appointment_id FK
timestamp offers_sent_at
timestamp waitlist_at
timestamp closed_at
bigint closed_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    slot_offers {
bigint id PK
varchar public_id UK
bigint slot_opening_id FK
bigint appointment_id FK
int appointment_revision
varchar status
timestamp offered_at
timestamp closed_at
timestamp created_at
timestamp updated_at
    }
    no_show_flags {
bigint id PK
varchar public_id UK
bigint appointment_id FK
bigint branch_id FK
int appointment_revision
varchar status
timestamp flagged_at
timestamp resolved_at
bigint resolved_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    waitlist_entries {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint branch_id FK
bigint service_id FK
bigint dentist_profile_id FK
date clinic_date
varchar status
timestamp notified_at
timestamp closed_at
timestamp created_at
timestamp updated_at
    }
    appointments ||--o{ appointment_history : "appointment_id"
    appointments ||--o{ appointment_command_keys : "appointment_id"
    appointments ||--o{ appointment_responses : "appointment_id"
    appointments ||--o{ slot_openings : "appointment_id"
    slot_openings ||--o{ slot_offers : "slot_opening_id"
    appointments ||--o{ slot_offers : "appointment_id"
    appointments ||--o{ no_show_flags : "appointment_id"
```


### Subsystem 7: Live Clinic Flow, Queues & Encounter Check-In

*Dentist queues, daily queue tickets, state change histories, clinical visit admissions, and encounter timelines.*

```mermaid
erDiagram
    dentist_queues {
bigint id PK
bigint branch_id FK
bigint dentist_profile_id FK
date clinic_date
int next_number
timestamp created_at
timestamp updated_at
    }
    queue_entries {
bigint id PK
varchar public_id UK
bigint visit_id FK
bigint dentist_queue_id FK
int queue_number
varchar status
varchar priority
text priority_reason
int revision
timestamp closed_at
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    queue_entry_history {
bigint id PK
bigint queue_entry_id FK
varchar event
varchar from_status
varchar to_status
varchar from_priority
varchar to_priority
text priority_reason
int revision
bigint actor_user_id FK
varchar actor_role
timestamp occurred_at
    }
    visits {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint branch_id FK
bigint appointment_id FK
varchar source
varchar status
timestamp arrived_at
date clinic_date
int revision
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp closed_at
timestamp created_at
timestamp updated_at
timestamp archived_at
bigint archived_by_user_id FK
text archive_reason
    }
    visit_history {
bigint id PK
bigint visit_id FK
varchar event
varchar from_status
varchar to_status
int revision
bigint responsible_dentist_profile_id FK
bigint actor_user_id FK
varchar actor_role
timestamp occurred_at
    }
    visits ||--o{ queue_entries : "visit_id"
    dentist_queues ||--o{ queue_entries : "dentist_queue_id"
    queue_entries ||--o{ queue_entry_history : "queue_entry_id"
    visits ||--o{ visit_history : "visit_id"
```


### Subsystem 8: Clinical Encounters, Treatments, Procedures & Tooth Charts

*Doctor clinical notes, completed procedures, treatment history, follow-up recalls, and tooth chart odontogram condition entries.*

```mermaid
erDiagram
    treatments {
bigint id PK
varchar public_id UK
bigint visit_id FK
bigint dentist_profile_id FK
varchar status
text chief_complaint
text treatment_plan
text procedure_summary
text clinical_notes
boolean prescription_required
boolean followup_required
date followup_recommended_date
text followup_reason
varchar followup_interval
timestamp started_at
timestamp completed_at
int revision
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    treatment_procedures {
bigint id PK
varchar public_id UK
bigint treatment_id FK
int line_no
bigint service_id FK
int quantity
text notes
varchar service_name
timestamp created_at
timestamp updated_at
    }
    treatment_history {
bigint id PK
bigint treatment_id FK
varchar event
varchar from_status
varchar to_status
int revision
jsonb snapshot
bigint actor_user_id FK
varchar actor_role
timestamp occurred_at
    }
    followup_tasks {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint branch_id FK
bigint treatment_id FK
bigint service_id FK
bigint dentist_profile_id FK
text reason
date due_on
bigint assignee_user_id FK
varchar source
varchar status
bigint appointment_id FK
text close_note
timestamp contacted_at
timestamp booked_at
timestamp closed_at
bigint created_by_user_id FK
bigint updated_by_user_id FK
int revision
timestamp created_at
timestamp updated_at
    }
    tooth_chart_entries {
bigint id PK
varchar public_id UK
bigint patient_id FK
varchar tooth
jsonb surfaces
varchar status
date recorded_on
text note
bigint treatment_id FK
bigint branch_id FK
bigint dentist_profile_id FK
bigint created_by_user_id FK
timestamp created_at
    }
    treatments ||--o{ treatment_procedures : "treatment_id"
    treatments ||--o{ treatment_history : "treatment_id"
    treatments ||--o{ followup_tasks : "treatment_id"
    treatments ||--o{ tooth_chart_entries : "treatment_id"
```


### Subsystem 9: Prescriptions & Pharmacy Dispensation

*Doctor digital prescriptions, line items, dosage/frequency instructions, and sequential prescription counter tracking.*

```mermaid
erDiagram
    prescriptions {
bigint id PK
varchar public_id UK
varchar number UK
bigint patient_id FK
bigint branch_id FK
bigint visit_id FK
bigint treatment_id FK
bigint dentist_profile_id FK
bigint created_by_user_id FK
varchar status
text note
varchar license_no
timestamp issued_at
bigint issued_by_user_id FK
timestamp voided_at
bigint voided_by_user_id FK
varchar void_reason
int revision
timestamp created_at
timestamp updated_at
timestamp archived_at
bigint archived_by_user_id FK
text archive_reason
    }
    prescription_lines {
bigint id PK
bigint prescription_id FK
int line_no
text medicine
text dosage
text frequency
text duration
text instructions
timestamp created_at
timestamp updated_at
    }
    prescription_counters {
int year PK
int last_number
    }
    prescriptions ||--o{ prescription_lines : "prescription_id"
```


### Subsystem 10: Invoicing, Payments, PayMongo Gateway & Receipts

*Statements of account (invoices), line items, billing history snapshots, refund credit notes, payments, official receipts, and PayMongo webhook/checkout sessions.*

```mermaid
erDiagram
    invoices {
bigint id PK
varchar public_id UK
bigint treatment_id FK
bigint visit_id FK
bigint patient_id FK
bigint branch_id FK
varchar invoice_number UK
varchar status
int revision
numeric gross_amount
numeric hmo_coverage_amount
numeric patient_responsibility_amount
numeric paid_amount
varchar hmo_status
numeric hmo_approved_amount
varchar settlement_type
timestamp issued_at
timestamp paid_at
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
varchar billed_to_name
varchar discount_type
varchar discount_id_number
numeric discount_amount
varchar refund_status
timestamp archived_at
bigint archived_by_user_id FK
text archive_reason
    }
    invoice_lines {
bigint id PK
varchar public_id UK
bigint invoice_id FK
bigint service_id FK
bigint service_price_id FK
int line_no
varchar service_code
varchar service_name
int quantity
numeric unit_price
numeric line_total
timestamp created_at
timestamp updated_at
    }
    invoice_histories {
bigint id PK
bigint invoice_id FK
varchar event
varchar from_status
varchar to_status
varchar settlement_type
jsonb snapshot
bigint actor_user_id FK
timestamp occurred_at
    }
    invoice_refunds {
bigint id PK
varchar public_id UK
bigint invoice_id FK
bigint payment_id FK
varchar provider_refund_id UK
numeric amount
varchar reason
timestamp refunded_at
bigint created_by_user_id FK
timestamp created_at
    }
    payments {
bigint id PK
varchar public_id UK
bigint invoice_id FK
numeric amount
varchar method
varchar external_reference
bigint recorded_by_user_id FK
timestamp recorded_at
timestamp created_at
timestamp updated_at
    }
    receipts {
bigint id PK
varchar public_id UK
bigint payment_id FK
bigint invoice_id FK
varchar receipt_number UK
numeric amount
varchar method
varchar external_reference
timestamp issued_at
timestamp created_at
timestamp updated_at
varchar received_from_name
    }
    payment_checkout_sessions {
bigint id PK
varchar public_id UK
string invoice_id
varchar provider
varchar provider_session_id UK
text checkout_url
varchar currency
varchar status
bigint initiated_by_user_id FK
timestamp created_at
timestamp updated_at
varchar request_fingerprint
bigint appointment_id FK
    }
    payment_provider_events {
bigint id PK
varchar public_id UK
varchar provider
varchar provider_event_id UK
varchar event_type
varchar provider_session_id
varchar provider_payment_id
bigint invoice_id FK
bigint amount_centavos
varchar currency
string status
varchar reason
timestamp received_at
timestamp processed_at
timestamp created_at
timestamp updated_at
bigint appointment_id FK
    }
    invoices ||--o{ invoice_lines : "invoice_id"
    invoices ||--o{ invoice_histories : "invoice_id"
    invoices ||--o{ invoice_refunds : "invoice_id"
    payments ||--o{ invoice_refunds : "payment_id"
    invoices ||--o{ payments : "invoice_id"
    payments ||--o{ receipts : "payment_id"
    invoices ||--o{ receipts : "invoice_id"
    invoices ||--o{ payment_provider_events : "invoice_id"
```


### Subsystem 11: HMO Providers, Patient Coverage & Claims Adjudication

*Accredited HMO insurance providers, patient memberships, pre-authorization cases, checklist requirements, and claim adjudication event trails.*

```mermaid
erDiagram
    accepted_hmos {
bigint id PK
varchar public_id UK
bigint branch_id FK
varchar name
varchar note
boolean verified_by_clinic
bigint verified_by_user_id FK
timestamp verified_at
boolean active
int revision
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    patient_hmo_memberships {
bigint id PK
varchar public_id UK
bigint patient_id FK
varchar provider_name
varchar member_number
varchar status
bigint created_by_user_id FK
timestamp created_at
timestamp ended_at
bigint ended_by_user_id FK
    }
    hmo_cases {
bigint id PK
varchar public_id UK
bigint visit_id FK
bigint patient_id FK
bigint branch_id FK
bigint membership_id FK
varchar provider_name
varchar member_number
varchar status
int submission_cycle
timestamp submitted_at
timestamp escalated_at
timestamp final_at
numeric approved_amount
int revision
bigint created_by_user_id FK
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    hmo_case_requirements {
bigint id PK
bigint hmo_case_id FK
varchar rule_key
varchar state
varchar document_label
bigint validated_by_user_id FK
timestamp validated_at
timestamp created_at
timestamp updated_at
    }
    hmo_case_events {
bigint id PK
bigint hmo_case_id FK
varchar kind
int submission_cycle
varchar from_status
varchar to_status
int revision
varchar method
text note
text next_action
varchar provider_reference
varchar outcome
numeric approved_amount
jsonb rule_keys
bigint actor_user_id FK
varchar actor_role
timestamp occurred_at
    }
    patient_hmo_memberships ||--o{ hmo_cases : "membership_id"
    hmo_cases ||--o{ hmo_case_requirements : "hmo_case_id"
    hmo_cases ||--o{ hmo_case_events : "hmo_case_id"
```


### Subsystem 12: Audit Trails, OCR Documents, Communications & Loyalty

*Tamper-evident audit logs, OCR documents, patient-staff messaging, notifications, mail dispatch, portal inquiries, AI telemetry, and M24 loyalty rewards.*

```mermaid
erDiagram
    audit_logs {
bigint id PK
varchar public_id UK
bigint actor_user_id FK
varchar actor_role
varchar actor_name
bigint branch_id FK
varchar action
varchar category
varchar auditable_public_id
varchar ip_address
text user_agent
jsonb payload
timestamp created_at
    }
    documents {
bigint id PK
varchar public_id UK
string patient_id
string visit_id
string hmo_case_id
bigint branch_id FK
varchar category
varchar title
string file_path
varchar original_filename
varchar mime_type
bigint file_size_bytes
string checksum_sha256
varchar status
jsonb metadata
bigint uploaded_by_user_id FK
timestamp retracted_at
bigint retracted_by_user_id FK
varchar retraction_reason
timestamp created_at
timestamp updated_at
    }
    document_extractions {
bigint id PK
varchar public_id UK
string document_id
varchar extraction_method
varchar status
text raw_text
jsonb structured_payload
numeric confidence_score
timestamp extracted_at
timestamp created_at
timestamp updated_at
    }
    conversations {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint branch_id FK
varchar context
varchar status
int revision
timestamp closed_at
bigint closed_by_user_id FK
bigint created_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    conversation_participants {
bigint id PK
bigint conversation_id FK
string user_id
bigint last_read_message_id
timestamp last_read_at
timestamp created_at
    }
    conversation_messages {
bigint id PK
varchar public_id UK
bigint conversation_id FK
bigint sender_user_id FK
text body
timestamp created_at
    }
    message_templates {
varchar key PK
varchar subject
text body
boolean needs_dentist
int revision
bigint approved_by_user_id FK
timestamp approved_at
bigint dentist_approved_by_user_id FK
timestamp dentist_approved_at
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    mail_dispatches {
bigint id PK
varchar public_id UK
varchar purpose
varchar subject_type
varchar subject_public_id
int subject_revision
bigint recipient_user_id FK
bigint created_by_user_id FK
boolean retryable
varchar status
int attempts
int max_attempts
timestamp next_attempt_at
timestamp locked_at
varchar failure_reason
varchar mailer
varchar transport_kind
timestamp completed_at
timestamp delivery_confirmed_at
timestamp created_at
timestamp updated_at
    }
    mail_dispatch_attempts {
bigint id PK
bigint mail_dispatch_id FK
int attempt_no
varchar outcome
varchar mailer
varchar transport_kind
timestamp started_at
timestamp finished_at
    }
    user_notifications {
bigint id PK
varchar public_id UK
bigint user_id FK
varchar kind
varchar title
varchar body
varchar target_page
varchar target_id
varchar dedupe_key UK
timestamp created_at
timestamp read_at
timestamp archived_at
bigint archived_by_user_id FK
text archive_reason
    }
    inquiries {
bigint id PK
varchar public_id UK
varchar source
varchar capture_method
varchar contact_name
varchar contact_detail
varchar topic
bigint branch_id FK
bigint assigned_user_id FK
bigint created_by_user_id FK
bigint patient_id FK
bigint appointment_id FK
varchar status
int revision
timestamp received_at
timestamp responded_at
timestamp closed_at
timestamp converted_at
timestamp created_at
timestamp updated_at
    }
    inquiry_history {
bigint id PK
bigint inquiry_id FK
varchar event
varchar from_status
varchar to_status
int revision
varchar actor_role
timestamp occurred_at
    }
    assistant_answers {
bigint id PK
varchar public_id UK
varchar seed_key UK
varchar question
varchar answer
jsonb keywords
varchar category
bigint branch_id FK
boolean active
boolean draft
varchar source
int revision
bigint updated_by FK
timestamp created_at
timestamp updated_at
    }
    assistant_usage {
bigint id PK
bigint user_id FK
date clinic_date
varchar mode
varchar outcome
jsonb tools
int input_tokens
int output_tokens
int latency_ms
timestamp created_at
    }
    automated_actions {
bigint id PK
varchar public_id UK
bigint workflow_rule_id FK
bigint system_event_id FK
varchar idempotency_key UK
varchar status
jsonb details
timestamp executed_at
timestamp created_at
    }
    automation_settings {
varchar key PK
boolean enabled
jsonb settings
int revision
timestamp last_run_at
bigint updated_by_user_id FK
timestamp created_at
timestamp updated_at
    }
    automation_deliveries {
bigint id PK
varchar automation
varchar dedupe_key UK
varchar outcome
varchar reason
varchar subject_type
varchar subject_public_id
bigint branch_id FK
bigint mail_dispatch_id FK
timestamp created_at
    }
    workflow_rules {
bigint id PK
varchar public_id UK
varchar rule_code UK
varchar name
varchar trigger_event
jsonb target_domains
text condition_description
text action_description
varchar owner_domain
boolean is_active
boolean is_system_protected
timestamp created_at
timestamp updated_at
    }
    system_events {
bigint id PK
varchar public_id UK
varchar event_type
varchar idempotency_key UK
varchar domain
varchar aggregate_type
varchar aggregate_id
bigint branch_id FK
bigint actor_user_id FK
jsonb payload
timestamp occurred_at
timestamp created_at
    }
    loyalty_accounts {
bigint id PK
varchar public_id UK
bigint patient_id FK
bigint branch_id FK
varchar referral_code UK
int current_balance
timestamp created_at
timestamp updated_at
    }
    loyalty_ledger {
bigint id PK
varchar public_id UK
bigint loyalty_account_id FK
bigint branch_id FK
int points
varchar entry_type
varchar reason_code
string reverses_entry_id
bigint refund_id FK
bigint invoice_id FK
bigint visit_id FK
bigint referral_id FK
varchar idempotency_key UK
timestamp expires_at
int unrecovered_points
bigint created_by_user_id FK
timestamp created_at
    }
    loyalty_lot_consumptions {
bigint id PK
varchar public_id UK
bigint redeem_entry_id FK
bigint earn_entry_id FK
int points
timestamp created_at
    }
    referrals {
bigint id PK
varchar public_id UK
string referrer_patient_id
bigint referee_patient_id FK
varchar referral_code_used
varchar status
bigint qualifying_invoice_id FK
timestamp qualified_at
timestamp rewarded_at
timestamp created_at
timestamp updated_at
    }
    conversations ||--o{ conversation_participants : "conversation_id"
    conversations ||--o{ conversation_messages : "conversation_id"
    mail_dispatches ||--o{ mail_dispatch_attempts : "mail_dispatch_id"
    inquiries ||--o{ inquiry_history : "inquiry_id"
    workflow_rules ||--o{ automated_actions : "workflow_rule_id"
    system_events ||--o{ automated_actions : "system_event_id"
    mail_dispatches ||--o{ automation_deliveries : "mail_dispatch_id"
    loyalty_accounts ||--o{ loyalty_ledger : "loyalty_account_id"
    referrals ||--o{ loyalty_ledger : "referral_id"
    loyalty_ledger ||--o{ loyalty_lot_consumptions : "redeem_entry_id"
```
