# ERD v2 and Current Frontend Alignment

Reviewed against protected checkpoint `dac864e`, the [Data Dictionary](docs/architecture/ERD_v2_Data_Dictionary.md), and the approved [PNG](docs/architecture/Multi-Branch_Dental_Clinic_Operation_System_ERD.png) / [SVG](docs/architecture/Multi-Branch_Dental_Clinic_Operation_System_ERD.svg). The ERD artifacts are unchanged. This mapping explains frontend representations; it does not replace normalized backend requirements. Module numbers below follow the canonical 25-module structure in [Module Coverage](MODULE_COVERAGE.md); that restructure renamed and regrouped modules only — the ERD structure is unchanged by it.

## Foundation and patient flow

| Approved concept | Current frontend mapping | Simplification / integrity boundary |
| --- | --- | --- |
| PERSONS | `persons`; identity/contact projections | One person identity, display names derived; compatibility projections are not independent keys |
| USERS | `users` linked by `personId` | Demo account status/permissions; no password authentication server |
| ROLES / USER_ROLE_ASSIGNMENTS | Role catalog and user permissions/branch; live session checks | Flattened assignment model, not normalized multi-role rows; Owner exceptions documented in reconciliation |
| STAFF_PROFILES | `staff`, `dentists`, with `personId`/`userId`. **Backend Phase 2A**: `staff_profiles`/`dentist_profiles` (PostgreSQL) are now the authoritative source for these two collections, bridged to the same legacy shape (see [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md)) | M1 creation synchronizes M3; Active account and operational Available remain separate — Active specifically remains a transitional frontend-local input this phase, not yet backend-authoritative (see the Backend Phase 2A audit). New Dentist/Staff account creation is temporarily unavailable pending a later phase, since PERSONS/USERS creation itself stays frontend-local |
| PATIENTS | `patients` with `personId`, optional `userId` | Patient may exist without portal login; `patients.userId` is a frontend compatibility denormalization (cross-checked against `personId` on every read), not a `PATIENTS.user_id` ERD column; centralized chart, scoped operational access |
| BRANCHES / BRANCH_OPERATING_HOURS | `branches`, inline `open`/`close`. **Backend Phase 2A**: the `branches` table (PostgreSQL) is now authoritative | Canonical branch IDs; full per-weekday hours/holiday exceptions not represented. `latitude`/`longitude` columns exist but stay `NULL` — never populated with invented values |
| SERVICES / BRANCH_SERVICES | `services`, `branchServices`. **Backend Phase 2A**: `services`/`branch_services` tables (PostgreSQL) are now authoritative | Canonical duration/fee/status and branch availability/optional overrides. `services.reference_fee_php` is project/demo/reference configuration, never clinic-confirmed pricing, regardless of whether a value happens to fall inside an interview-quoted range |
| SERVICE_PRICES | **M13 pricing foundation (backend)**: `service_prices` (PostgreSQL); the Owner "Services & Pricing" page reads and writes it through the API; nothing is stored in the browser | Owner-confirmed, effective-dated, append-only price versions (base or branch level, priced or ended) and the only authoritative price source. `reference_fee_php` is never used for resolution. The current browser billing prototype still prices from the reference fee until the M11 cutover |
| STAFF_SCHEDULES | Inline profile shifts and availability. **Backend Phase 2A**: the same flat `shift_start`/`shift_end`/`available` fields now live on `staff_profiles`/`dentist_profiles` (PostgreSQL) | No complete date-specific schedule/exception collection — this remains a frontend/backend gap alike, not newly introduced or newly closed by Phase 2A |
| DENTIST_SERVICE_ASSIGNMENTS | `dentistServiceAssignments`. **Backend Phase 2A**: derived from the `dentist_service_assignments` table (PostgreSQL) via the Dentist read endpoint, not its own fetch | Shared scheduler and performed-procedure authorization |
| APPOINTMENTS | `appointments` | Patient, branch, Dentist, service IDs; current validator; revision/retry context; immutable Patient on reschedule |
| CHECK_IN_RECORDS → VISITS | **M8 (backend)**: the `visits` table (PostgreSQL) is the arrival record and the Visit / Clinical Encounter; the browser holds an in-memory projection only (`state.visits`). The former `checkIns` collection is no longer read | One Visit per scheduled appointment; walk-ins have no appointment; at most one active Visit per Patient; server arrival time and Asia/Manila clinic date |
| DENTIST_QUEUES / QUEUE_ENTRIES | **M9 (backend)**: `dentist_queues` (per branch + Dentist + clinic day container and number counter) and `queue_entries` (PostgreSQL); the browser holds an in-memory projection only (`state.queue`, `state.myQueue`) | Each entry requires exactly one Visit (unique) and derives Patient, branch, arrival, service and appointment from it; server-issued numbers from 1; states Waiting / Called / Treatment Ready / Temporarily Away / Served; no In Treatment / Completed / No-show queue state |
| CAPACITY_EVENTS | Derived queue/capacity views and workflow events | No independent persisted aggregate snapshot table; estimates do not replace queue entries |
| AUDIT_LOGS | `audit` alongside `workflowLog` | Local audit projection (recent audit list capped); not immutable server security evidence. The tamper-resistant audit trail belongs to the planned M22 |

**Identity model clarification (Phase 4B.3A):** `PERSONS` is the single shared identity hub. `USERS` and
`PATIENTS` are two independent attachments to it, each carrying its own `person_id` foreign key — the ERD does not
model `USERS` and `PATIENTS` as directly chained through each other. A Patient may exist with no `USER`/login at
all. Patient self-registration (`src/registration.js`) atomically creates a `PERSON` + `PATIENT` + `USER` sharing
that same `person_id`; the order PERSON → PATIENT → USER is the frontend's transaction order, not an approved
`PERSON → USER → PATIENT` ERD foreign-key chain. The frontend's `patients.userId` field remains a compatibility
denormalization (see the PATIENTS row above), never proposed as a `PATIENTS.user_id` ERD column. No ERD
relationship, table or diagram/dictionary change is authorized by this clarification.

**Booking Drafts (Phase 4B.3C-1):** the frontend now persists a `bookingDrafts` collection (`src/booking-drafts.js`)
of in-progress Patient booking-wizard choices (`mode`, `branchId`, `serviceId`, `date`, `start` only — never a
committed Dentist selection, payment preference or referral code). BOOKING DRAFT != APPOINTMENT: a draft reserves
no slot, consumes no Dentist capacity, and creates no `APPOINTMENTS`/`DENTIST_QUEUES` row. This is a future
ERD-vNext candidate, conceptually a `BOOKING_DRAFTS` table (`patient_id` FK, the same optional fields, an
updated-at timestamp), additive and Patient-scoped only. **No ERD SVG or data dictionary change is made in this
pass** — this paragraph records the future mapping only.

**Scheduling assignment method (Phase 4B.3B):** the frontend now persists `assignmentMethod` (`'auto'` or
`'selected'`) on a newly created `appointments` row (`src/scheduling.js`, `src/workflow.js`); the architecture
review has approved an eventual ERD-vNext field this anticipates, conceptually `APPOINTMENTS.dentist_assignment_method`.
Legacy rows created before this checkpoint carry no `assignmentMethod` at all and remain fully valid and readable in
the current frontend without it. This is an approved future additive ERD alignment item; it does not modify the
approved SVG ERD or data dictionary structure, and it is independent of the already-documented `booking_method`
field, which this checkpoint does not redefine.

## Clinical and financial

| Approved concept | Current frontend mapping | Simplification / integrity boundary |
| --- | --- | --- |
| PATIENT_DOCUMENTS | HMO requirement document metadata; general chart document cards are illustrative | No file bytes, controlled upload service or general document repository |
| CLINICAL_TEMPLATES | No persisted template catalog | Documentation aid remains an approved concept; no automated diagnosis or clinical choice |
| TREATMENT_PLANS | **M5 (backend)**: `treatments` (PostgreSQL); the browser holds an in-memory projection only (`state.treatments`, `server: true`) plus read-only pre-server history from `dentalops-v4-treatments` | Required, unique `visit_id` (the Visit is the encounter; the appointment is optional); authoring Dentist; server revisions with immutable history snapshots; Completed is read-only (P6 unresolved) |
| TREATMENT_PROCEDURES | **M5 (backend)**: `treatment_procedures` | Line `public_id`, `line_no`, canonical `service_id`, quantity, notes, service code/name snapshot; no fee or amount (the transitional M11 invoice adapter snapshots fees on invoice items) |
| PRESCRIPTIONS / PRESCRIPTION_ITEMS | `prescriptions` / `prescription.items[]` | Exact treatment/Patient/Dentist, private draft, explicit authorization identity/time/version; requested tasks are derived before a record exists |
| TREATMENT_FOLLOW_UPS | `followups` | Explicit clinical decision, source treatment and linked return `appointmentId`; Open/Awaiting Scheduling → Scheduled → Completed |
| INVOICES / INVOICE_ITEMS | `invoices` / `invoice.items[]` | One normal invoice per completed treatment; each charge links procedure/service; Draft → Review → Issued → Paid |
| PAYMENTS | `invoice.payment` and linked receipt reference | One completed full payment; exact invoice/Patient/branch/amount, recorder/time and simulation flag; no partial-payment or refund ledger |

Fees are snapshots of configured fees for the performed work, not a competing editable catalog. A later catalog change does not rewrite completed charges. Review/issuance validates child links/arithmetic and completed encounter evidence. Patient receipt visibility requires supported payment evidence; malformed/historical financial records are retained for scoped review rather than supplied with invented evidence.

**Walk-in difference — resolved (C2, M8, approved decision D10):** the model is Visit-anchored. `VISITS` is added to the data dictionary: Treatment → required Visit; Visit → optional Appointment. Scheduled care is Appointment → Visit → Treatment; walk-in care is Visit → Treatment, with no fabricated appointment. `TREATMENT_PLANS.appointment_id` is therefore optional and the required encounter link is `visit_id` (enforced by the M5 backend: `treatments.visit_id` is required and unique). The generated ERD diagram images (PNG/SVG) predate this decision and have not been regenerated (no diagram source is in the repository); the data dictionary is the current text of record until they are. See [conflict C2](DOCUMENTATION_RECONCILIATION.md#c2--required-appointment-in-the-diagram-versus-approved-walk-in-care).

## HMO

| Approved concept | Current frontend mapping | Simplification / integrity boundary |
| --- | --- | --- |
| HMO_PROVIDERS | Canonical frontend provider catalog | Illustrative configured providers; no API adapter |
| PATIENT_HMO_POLICIES | Patient provider/member fields; case membership snapshot | No complete dated policy/eligibility subsystem; membership does not prove coverage |
| HMO_REQUIREMENT_RULES | Three fixed frontend rules: HMO Card, Valid ID, Dentist treatment request | Broader provider/service-specific ERD rules remain future scope |
| HMO_CASES / HMO_CASE_REQUIREMENTS | `hmo`, embedded `requirements[]` | Patient/branch/provider and exact appointment/treatment; Missing/Provided/Validated locally; metadata only |
| HMO_CLAIMS | No separate claims collection | Case submissions/responses are tracking, not adjudicated invoice claims or reimbursement |
| HMO_FOLLOW_UP_TASKS | Embedded `followUpTasks[]` | Unique case/submission-cycle tasks; contacts, submission history and external response evidence embedded in case |

Returned → corrected/local validation → Ready → resubmission retains case identity and advances the cycle. Pending/Escalated accepts current-cycle recorded responses; escalation is not a terminal coverage decision. Timestamps drive the documented 12-hour follow-up threshold. Staff records externally handled actions; local completeness never creates provider approval. Modern outcome evidence is checked; legacy historical outcomes are not fabricated into modern response histories.

## Communication, automation and reporting

| Approved concept | Current frontend mapping | Simplification / integrity boundary |
| --- | --- | --- |
| SOCIAL_INQUIRIES | `inquiries` | Assigned identity/branch; conversation and booked-appointment links; no external channel transport |
| CONVERSATIONS / CONVERSATION_MESSAGES | `conversations` with `messages[]` | Explicit `participantUserIds`, assigned identity, sender IDs and participant-specific unread/read state; no broad-role ownership |
| PATIENT_NOTIFICATIONS | `notifications` | Generalized to identity-targeted Patient, Dentist and Staff operational notifications; event/entity IDs, independent read state and validated action context |
| SYSTEM_EVENTS / AUTOMATED_ACTIONS | Contextual `workflowLog` events/results; `audit` projection | Combined local ledger, not separate transaction tables or durable event queue; deduplicated command/event keys |
| WORKFLOW_RULES | Descriptive `automations` catalog plus protected domain commands | Read-only Automation Monitor; no arbitrary critical-rule toggles |
| M21 (analytics and executive dashboard, formerly M21/M22) | Read projections of operational collections | No duplicate operational data stores; current reporting limitations remain explicit |
| M24 / M25 logical entities | `loyalty` (account with embedded ledger; M24 implemented prototype) / `campaigns` (draft preview only) | Proposed Enhancements (PE), not complete normalized referral/ledger/recipient systems |

**Authorization status update (Phase 4B.2, historical):** the authorization status of M24 and M25 changed at that time from Proposed to Approved Frontend Enhancement; the canonical restructure has since designated them Proposed Enhancements (PE) again. The ERD structure remains unchanged: no relationship, table or diagram/dictionary change is authorized, and the existing diagrams keep their historical labels. A normalized referral lifecycle (referrer → referred Patient → qualifying appointment) is a later M24 extension and would need its own approved model.

M23 coordinates administrative handoffs after explicit actions. A completed server Treatment (M5) closes its Visit and appointment in the same server transaction; the browser-local adapters then prepare actual-procedure billing and only the requested Prescription/Follow-Up obligations, then applicable HMO and notifications, reconciled once per Treatment public id in any authorized Staff/Dentist browser. A failed HMO handoff leaves valid completed care intact and exposes a warning. Selected failed commands log deduplicated failure results; not every validation rejection creates a monitor record. Rendering/normalization creates no events.

## Legacy and backend boundary

Canonical IDs win over display strings. Compatibility normalization can recover known direct links/unambiguous identities and explicit legacy check-in references, but does not guess encounters from Patient + Dentist + day or manufacture modern clinical/payment/provider evidence. Ambiguous recipients and participants confer no access. Saved historical dates never rebase on reload.

These embedded structures preserve conceptual relationships without claiming every normalized ERD table exists in browser state. The backend must enforce foreign keys, branch/role scope, uniqueness, idempotency, versions and atomic updates independently. Real electronic payments require server/provider verification; current explicitly simulated Card/Electronic records do not satisfy that future integration requirement. Policy gaps and remaining differences are centrally recorded in [Documentation Reconciliation](DOCUMENTATION_RECONCILIATION.md).

**Backend Phase 2A (core reference data):** `BRANCHES`, `SERVICES`, `BRANCH_SERVICES`, `STAFF_PROFILES` and
`DENTIST_SERVICE_ASSIGNMENTS` (plus a `dentist_branches` join the ERD dictionary doesn't separately name)
are the first ERD entities beyond identity (`PERSONS`/`USERS`/`PATIENTS`) to graduate from frontend-local
state to real PostgreSQL tables, following the same identity-hub pattern already established there. A
`legacy_ref` string column on each of these tables is a purely transitional bridge key, letting still-local
collections (`appointments`, `queue`, `treatments`, etc.) keep resolving today's string IDs unchanged; it
carries no business meaning and is retired once those collections migrate to real backend foreign keys in a
later phase. `findOpenTimes`/`assignDentist` (M6 Smart Scheduling, formerly numbered M7) are unchanged — only their inputs are now
backend-authoritative, not their execution. Linked account Active/Inactive status is explicitly *not*
backend-authoritative yet (a transitional frontend-local input); closing that gap is a later identity
migration, not part of this phase. See [BACKEND_INTEGRATION.md](BACKEND_INTEGRATION.md) for the running
API surface.
