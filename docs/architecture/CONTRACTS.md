# Shared Production Contracts

Frozen at `1fa49d1` (canonical 25-module structure) before parallel Wave 1 development. This is the shared
cross-module reference for all five developers. It does not repeat what other documents already own:

- Module names, numbers, owners and current coverage: [MODULE_COVERAGE.md](../../MODULE_COVERAGE.md)
- Logical data model and integrity rules: [ERD_v2_Data_Dictionary.md](ERD_v2_Data_Dictionary.md) and [ERD_ALIGNMENT.md](../../ERD_ALIGNMENT.md)
- Current frontend behavior and safeguards: [FRONTEND_SCOPE.md](../../FRONTEND_SCOPE.md), [PHASE3_5_SAFEGUARDS.md](../../PHASE3_5_SAFEGUARDS.md)
- Unresolved clinic policies (P1–P9) and retained conflicts (C1, C2): [DOCUMENTATION_RECONCILIATION.md](../../DOCUMENTATION_RECONCILIATION.md)
- Running backend API: [BACKEND_INTEGRATION.md](../../BACKEND_INTEGRATION.md)
- Evidence labels and clinic-interview boundaries: [CLAUDE_OPERATING_MODE.md](../../CLAUDE_OPERATING_MODE.md)

**How to read this document.** Each contract states the frozen target for production (Laravel + PostgreSQL)
work. Where the current frontend prototype differs, a **Current** note says so: the prototype is not changed by
this document, and the difference is resolved when the owning module is implemented. Anything not yet approved is
marked **TBD BEFORE MODULE IMPLEMENTATION** — decide it with the team before building that module; never guess it
in code.

## Change control

This document is shared architecture. Module owners implement internals freely, but may **not** independently
change a shared contract involving IDs, Patient, Branch, Service, Dentist, Appointment, Visit, Treatment, HMO,
Invoice, Prescription, Document, Notification or Audit/Event identity. A shared-contract change needs explicit team
review and an update to this file in the same change.

---

## 1. Identity and access (M1, M3, M4)

- System roles are exactly **Patient, Staff, Dentist, Owner** (`App\Enums\Role`). Receptionist, Dental Assistant,
  Cashier, HMO Coordinator and similar are **Staff titles/metadata**, never authentication roles; a title never
  grants a permission.
- Authorization is enforced by Laravel (role middleware, policies and domain rules). UI hiding or disabled controls
  are explanation only, never enforcement.
- **Operational branch assignment** (where a Staff/Dentist works; `staff_profiles.branch_id`, `dentist_branches`) and
  **authorization branch scope** (which branch data an account may act on) are distinct concepts and are stored
  separately. Operational assignment never implies authorization scope by itself.
- The frontend session comes from the authenticated backend user (`/api/me`), not from client-supplied role or
  Patient IDs.
- **Identifiers (frozen):** bigint primary keys stay internal and are never exposed. Externally exposed operational
  resources carry a public ULID `public_id`; Laravel routes bind on it and API resources return it as `id`.
  `legacy_ref` remains only on the existing Phase 2A reference tables (branches, services, staff/dentist profiles)
  as a transitional bridge until the frontend collections that use old string IDs are migrated.
  **Current:** users and patients carry `public_id` (Wave 1 identity work); `/api/me` and `/api/users` return and
  bind only public ids.

## 2. Platform: time, money, API

**Time**
- Database timestamps are stored consistently as `timestamptz` (UTC).
- Clinic business dates ("today", a booking date, a queue day) are interpreted in **Asia/Manila** through one
  server-side clinic clock that mirrors `src/clock.js`.
- API timestamps are ISO-8601 with an explicit offset.

**Money**
- Database money uses fixed decimal precision (`numeric(12,2)`); financial arithmetic never uses floating point.
- API monetary values use a decimal-safe representation (a decimal string such as `"1500.00"`).
- **Current:** the frontend prototype uses JavaScript numbers rounded to centavos, and the Phase 2A service API
  returns `reference_fee_php` as a JSON number. Both are replaced by the decimal-safe contract when M11/M13 are
  implemented.

**API**
- Success responses use the `{ "data": ... }` envelope already used by the backend.
- Validation failures remain **422** with `{ message, errors }`, plus a stable machine-readable `code` where the
  client must distinguish cases (as login already does).
- Stale revision / concurrency conflicts return **409**.
- Unauthenticated is 401; forbidden is 403.
- Important state transitions use **named commands** (for example `POST /appointments/{id}/cancel`), never a generic
  status PATCH.
- Mutation endpoints accept an idempotency key (`Idempotency-Key` header or command ID) wherever duplicate submission
  is realistically possible; a replay returns the original result instead of acting twice.

## 3. Visit / Clinical Encounter

One first-class **Visit** is the operational bridge between arrival and clinical/financial work.

- Sources: **Appointment → Check-In → Visit**, or **Walk-In → Check-In/Registration → Visit**.
- **Required:** Patient and branch. **Optional:** Appointment (walk-ins exist). **Responsible Dentist** may be null
  while the workflow legitimately assigns one later, but must be resolved before any Dentist-authorized clinical
  action.
- A Visit may link to its queue entry, consultation/treatment, prescription, follow-up, invoice and — where
  applicable — HMO case.
- Relationships are stored as IDs; never infer a Visit from display text or from Patient + Dentist + day.
- This resolves the direction of retained conflict **C2** (optional appointment, required encounter evidence). The
  ERD diagram and data dictionary are updated only with explicit approval when M8/M5 are implemented.
- **Current:** implemented (M8). `visits` (PostgreSQL) is the arrival record and encounter anchor; scheduled Check-In
  moves the appointment to Checked In and opens the Visit in one transaction; walk-ins open a Visit with no appointment.
  C2 is resolved in this direction (approved D10; data dictionary updated). Since M9 the queue is server-authoritative
  too: a Visit with a responsible Dentist is queued in the same arrival transaction (`queue_entries.visit_id`, unique).
  Since M5 the clinical Treatment is server-authoritative too: `treatments.visit_id` is required and unique
  (Visit → zero or one Treatment → procedure lines), and the Visit's clinical progression happens only through the M5
  Treatment start/complete commands.

## 4. Dentist professional data (M3 → M19)

- M3 owns Dentist professional identity and credential data; M19 and other modules consume it.
- The Dentist profile is planned to support: professional/display name, PRC registration/license information, PTR
  information where applicable, specialization, branch relationships, and prescription authorization/signature
  configuration where approved.
- Credential values are never hard-coded in M19 templates or elsewhere.
- Having these fields does not make any output legally compliant; exact prescription output requirements need clinic
  and regulatory sign-off.
- **Current:** `dentist_profiles` holds `license_no` (demo-format placeholder values) and `specialty`; PTR and
  signature configuration are not modeled.

## 5. Patient record and the clinical write boundary (M4)

- M4 owns Patient identity, profile and the history projection that links to other modules' records.
- Staff may update only fields explicitly authorized for Staff workflows (approved demographic and contact fields).
- Clinical history is never a generic Staff edit; clinical changes happen only through authorized Dentist clinical
  workflows (M5, M19, M20).
- Read-only UI messages explain; Laravel authorization and domain rules enforce.
- The HMO case workflow belongs to M12; uploaded documents belong to M14. M4 references them rather than owning them.

## 6. Appointments (M6)

- The deterministic scheduling rules are preserved: one shared validator (branch/service/Dentist/shift/hours/overlap),
  deterministic Dentist assignment (fewest booked minutes, then Dentist ID), and no AI in conflict validation.
- **Patient online scheduling (frozen target):**
  - earliest date: tomorrow; latest date: one calendar month after tomorrow; both inclusive (Asia/Manila);
  - Patient-facing start times on hourly boundaries; appointment duration stays service-specific;
  - the Patient does not choose a Dentist; an eligible Dentist is assigned deterministically.
- Staff may keep broader/finer scheduling capability where currently approved (same-day and non-hourly bookings,
  walk-ins); Staff are still bound by past-time, branch, Dentist and conflict validation.
- Smart Scheduling, nearest eligible branch, conflict prevention, alternative generation and Dentist assignment are
  M6 features.
- Final booking validation is server-authoritative; the frontend scheduler remains a UX pre-check.
- Concurrent conflicting bookings must not both succeed (a database-level guarantee, not only an application check).
- **Current:** implemented server-side (M6 API) and used by the React app since the M6 cutover (see
  `MODULE_COVERAGE.md` M6 and `BACKEND_INTEGRATION.md`).

## 7. Financial authority (M11)

M11 owns **one** authoritative financial calculation model:

```
Gross Treatment Amount − Approved HMO Coverage = Patient Responsibility
Patient Responsibility − Valid Patient Payments = Remaining Patient Balance
```

- Pending, Returned and Rejected HMO coverage never reduce Patient responsibility; only confirmed **Approved**
  coverage may.
- HMO coverage is not Patient cash or a Patient payment.
- Full HMO coverage must never create a fake ₱0 Patient payment.
- Approved coverage never makes Patient responsibility negative (it is capped at the gross amount).
- The invoice's gross treatment snapshot is immutable once finalized; values applied at settlement are snapshotted so
  history does not drift if an HMO case changes later.
- The same calculation feeds the Cashier/Staff invoice view, the HMO financial projection, the Patient billing view,
  receipts/settlement and analytics. No UI implements competing arithmetic.
- **HMO financial hold (approved with M12):** creating and reviewing a Draft invoice is never held by M12. Invoice
  **issue** and Patient **payment** are held while an applicable HMO claim is unresolved — the Visit's case is Missing
  Requirements, Ready for Submission, Pending, Escalated or Returned, or the Patient has an active HMO membership and the
  Visit has neither a case nor a recorded self-pay decision.
- Approved and Rejected are final insurer outcomes; **Withdrawn** is the terminal pre-submission no-claim / self-pay
  disposition. Approved supplies the provider's approved amount; Rejected and Withdrawn supply zero usable HMO coverage.
- **TBD BEFORE MODULE IMPLEMENTATION (M11):**
  - the exact settlement state and transition for a zero Patient balance (unresolved policy P9 — never a fabricated
    payment);
  - any Staff override (unresolved policy P5).
- **Current:** invoices, payments and receipts are frontend-local prototype records; there is no server-backed M11
  workflow, no backend financial calculation, and approved HMO coverage is not yet applied to bills.

## 8. HMO case lifecycle (M12)

```
verification → requirement completion → external submission → pending → provider response
→ Approved / Rejected / Returned → correction and resubmission where required → follow-up / escalation
```

- Provider responses are obtained outside the application and confirmed by Staff; no provider API is implied.
- Each recorded response captures: submission cycle, outcome, provider reference, source/channel, reason category,
  provider details/reason, requested correction or missing requirement, approved amount (when Approved),
  provider-stated response time where known, server-recorded time, and the confirming Staff member.
- Response history is **append-only**; Returned/resubmitted cycles never overwrite earlier cycles.
- Local verification is not provider approval. **Escalated** is an operational attention state, never an insurer
  decision.
- The Staff worklist shows current status, blocking reason, missing requirements and next action.
- The Patient projection shows only Patient-safe information (no internal notes, contacts or recorders).
- Coverage shown to Staff or Patients ultimately comes from the M11 calculation.
- Documents extracted by M14 only produce drafts (see §9); only a Staff confirmation transitions a case.
- **Anchor (approved with M12):** an authoritative HMO case is anchored to a **Visit** — at most one case per Visit;
  Patient and branch derive from the Visit.
- **Membership (approved with M12):** Patient HMO membership is server-authoritative; at most one active membership per
  Patient in the current model; a change ends the active membership and starts a new one, so history is kept.
- New cases begin at Missing Requirements; **Draft** remains legacy-only.
- **Withdrawn (approved with M12):** allowed only before the first submission and requires an in-scope Staff actor and a
  reason. Approved, Rejected and Withdrawn are terminal.
- **Current:** a minimal server-authoritative M12 exists — memberships, Visit-anchored cases, the lifecycle with
  per-cycle append-only history (outcome, channel, note, provider reference, approved amount, recorder, time) and the
  server financial gate that M11 will consult. Reason category, provider-stated response time and document-based drafts
  are not captured yet; M11 does not consume the gate yet.

## 9. Documents and extraction (M14)

- M14 owns the shared secure document infrastructure: private storage, access control, file-content validation,
  metadata, immutable originals, document linking, native text extraction, the OCR adapter, and extraction history.
- Extraction order: machine-readable text → native extraction first; scanned/image content → OCR only when needed.
- Extraction produces data and drafts only. It has **no authority** to transition HMO cases, prescriptions,
  treatment or billing; only an explicit human confirmation in the owning module can.
- A manually pasted text (such as an HMO email body) is kept as source text in the owning module's draft/response
  record; it is not fabricated into an uploaded file.
- No cloud OCR/document provider is approved by this contract; provider and privacy review happens before any
  integration.
- **Current:** only HMO requirement document metadata is recorded; no file storage, extraction or OCR exists.

## 10. Prescriptions (M19 — Digital Prescription & OCR-Assisted Management)

**Core invariant:** an authorized prescription requires a Patient, a valid Visit/Clinical Encounter and an
authorizing Dentist. It does not require a completed treatment — a legitimate consultation or walk-in encounter may
result in a prescription — but there is never a free-floating prescription outside an encounter.

**Creation paths**
- **A — Direct digital:** Visit → Dentist opens a prescription → structured draft → Dentist review → Dentist
  authorization → immutable issued prescription.
- **B — Dentist-selected template:** the Dentist explicitly chooses a template → an editable draft is populated →
  the Dentist reviews/modifies → the Dentist authorizes. The system never chooses a medication automatically because
  a procedure was selected.
- **C — Existing paper/scanned prescription:** source document → M14 upload/extraction/OCR → M19 structured draft →
  uncertainty and provenance shown → Dentist reviews/corrects → Dentist authorizes, only where the prescription is
  eligible for clinic authorization. OCR only transcribes: it never diagnoses, chooses medication or dosage,
  prescribes or authorizes.

**Structured item (planned fields):** `generic_name`, optional `brand_name`, `strength`, `dosage_form`, `quantity`,
`quantity_unit`, directions/sig, `frequency`, `duration`, additional instructions. Clinical content is always
Dentist-entered or Dentist-reviewed.

**Authorization** snapshots the contents, Patient, Visit, Dentist, the Dentist's relevant professional identity,
branch and authorization timestamp. Authorized versions are immutable.

**Outputs:** printable prescription (a first-class feature), Patient read-only digital copy, source-document
reference where applicable, authorization/version history, audit event, and a future digital-delivery request
through M18. A digital copy is not claimed to replace the printed prescription for pharmacy use unless separately
verified. The printable layout plans for a clinic/branch header, Patient details, date, generic-first medication
information, quantity/directions, Dentist identity, approved credential fields and an authorization/signature
representation; it is never labelled "legally compliant" until the clinic and regulatory requirements are verified.

**Current:** the prototype links a prescription to a completed treatment where the Dentist marked a prescription as
required, stores medication/dosage/instructions/duration, and has no templates, OCR or printable output. The
relationship change (Visit-anchored, treatment optional) is applied when M19 is implemented, together with the
matching ERD and `CLAUDE.md` relationship wording.

## 11. Delivery (M18)

- M18 owns outbound transactional delivery infrastructure. Other modules request a delivery (for example M19
  "send authorized prescription copy", M20 reminders); they never implement their own SMS/email provider.
- In-app notifications may be implemented independently of external providers.
- Until a real provider exists, the application never claims a message was delivered externally.

## 12. Audit (M22)

- M22 owns business-facing audit and activity monitoring; audit recording is shared infrastructure every module uses.
- Meaningful events are recorded: authentication/access, sensitive Patient-record changes, clinical authorization,
  prescription authorization, financial actions, HMO confirmation, configuration changes and automation runs.
- Audit records are append-oriented (never edited or deleted by application code).
- Module numbers are presentation metadata; stable domain/event names are the durable identity (see §13).

## 13. Event and module identity

The architecture introduced in `1fa49d1` is preserved and extended to backend domain events:

- durable domain keys (`src/module-map.js`: for example `appointment`, `hmo`, `treatment→billing`) and stable event
  names (for example `appointment.created`, `hmo.submission.recorded`);
- module numbers derived for presentation only;
- records saved under the pre-restructure numbering are read through the fixed legacy table and never reinterpreted
  (an old M13/M14/M15/M22 record keeps its original meaning).

---

## State machines

Allowed states and transitions at a high level. Current rows describe the implemented prototype; production keeps
them unless a row says otherwise. Anything unapproved is marked TBD.

### Appointment (M6)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Confirmed | Validated booking (Patient, Staff, Owner) |
| Pending / Confirmed | Confirmed (rescheduled) | Unadmitted; Patient changes date/time only |
| Pending / Confirmed | Checked In | Only through the M8 Visit Check-In command, atomically with opening the Visit (today, Asia/Manila) |
| Pending / Confirmed | Cancelled | Before arrival. Once a Visit exists, cancellation is refused until a Visit/Queue clinic policy exists |
| Pending / Confirmed | No-show | Staff/Owner, same clinic day, the Patient did not arrive (no Visit). Manual; no lateness threshold (P4) |
| Checked In | In Treatment | Only through the M5 Treatment start on the linked Visit (same transaction) |
| In Treatment | Completed | Only through the M5 Treatment completion on the linked Visit (same transaction) |
| Completed / Cancelled / No-show | — | Terminal |

Patient cancellation/reschedule cutoffs remain unresolved policies P1/P2.

### Visit / Clinical Encounter (M8; shared infrastructure)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Checked In | M8: scheduled Check-In (Staff in scope / Owner; today; opens with the appointment's Checked In) or Walk-In (no appointment) |
| Checked In | In Treatment | Only through the M5 Treatment start (responsible Dentist, must be set); cascades to a linked appointment |
| In Treatment | Completed | Only through the M5 Treatment completion; cascades to a linked appointment; sets `closed_at` |
| Completed | — | Terminal |

A Visit has no No-show state (No-show means the Patient never arrived — an appointment decision before Check-In).
Leaving early, abandonment and cancellation after Check-In are **TBD BEFORE IMPLEMENTATION** (a future M9/clinic-policy
decision); earliest check-in and late-arrival rules remain unresolved policies P3/P4 (the current rule is "today").

### Queue entry (M9)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Waiting | Created by M8 arrival in the same transaction, for a Visit with a responsible Dentist |
| Waiting | Called, Temporarily Away | Staff / Owner (the queue's own Dentist may Call) |
| Called | Treatment Ready, Temporarily Away | Staff / Owner |
| Treatment Ready | Temporarily Away | Staff / Owner |
| Temporarily Away | Waiting (return, original arrival order kept) | Staff / Owner |
| Called / Treatment Ready | Served | Only by the M5 Treatment start command, in the same transaction |
| Served | — | Terminal: the Patient left the waiting queue because treatment started (not Visit completion) |

**Current (M9, server-authoritative):** the queue has no In Treatment, Completed, Cancelled or No-show state — the Visit
owns the clinical lifecycle and the appointment owns the pre-arrival No-show. Numbers are issued by the server per
branch + Dentist + Asia/Manila clinic day starting at 1 (`dentist_queues`); positions are computed by the server
(Waiting / Called / Treatment Ready only; priority Urgent > Priority > Normal, then exact Visit arrival, then number).
Priority is an operational flag (Staff/Owner, reason required, recorded in history), not clinical triage. Commands need an
Idempotency-Key and the expected revision and apply only to today's queue. Leaving after Check-In and end-of-day
handling remain **TBD BEFORE IMPLEMENTATION** (Visit/Queue clinic policy).

### Treatment (M5)
| From | To | By / condition |
| --- | --- | --- |
| (new) | In Treatment | The Visit's responsible Dentist, from a Called / Treatment Ready queue entry, in ONE transaction with queue → Served, Visit → In Treatment and a scheduled appointment → In Treatment |
| In Treatment | In Treatment (documentation saved) | The Visit's responsible (authoring) Dentist, with revision check |
| In Treatment | Completed | The authoring Dentist; procedure summary and ≥ 1 valid line; in ONE transaction with Visit → Completed and a scheduled appointment → Completed (queue stays Served) |
| Completed | — | Terminal and read-only; amendments are unresolved policy P6 |

**Current (M5, server-authoritative):** a Treatment is anchored to its Visit — exactly one Treatment per Visit. Only the
Visit's responsible Dentist authors it. Procedure lines reference the canonical service and carry no price — M13/M11
own pricing.

### Invoice / Settlement (M11)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Draft | Generated from completed treatment procedures |
| Draft | Review | Staff |
| Review | Issued | Staff |
| Issued | Paid | Staff records the exact Patient-responsibility payment with receipt evidence |
| Paid | — | Terminal |
| Issued | zero-balance settlement | **TBD BEFORE MODULE IMPLEMENTATION** (P9; never a fake ₱0 payment) |

Invoice issue and payment are held while the Visit's HMO claim is unresolved (see §7).

### HMO case / submission cycle (M12)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Missing Requirements | Staff opens the Visit's case from the Patient's active membership |
| (new) | Withdrawn | Staff records the self-pay / no-claim decision for a Visit with an active membership and no case (reason required) |
| Draft / Missing Requirements | Ready for Submission | Every requirement validated locally |
| Ready for Submission | Pending | Staff records an external submission; submission cycle + 1 |
| Pending | Escalated | Overdue past the project follow-up threshold, after a recorded contact |
| Pending / Escalated | Approved, Rejected, Returned | Staff confirms an externally received response for the current cycle |
| Returned | Ready for Submission | Returned requirements corrected and validated |
| Ready for Submission (after Returned) | Pending | Resubmission; new cycle, history kept |
| Missing Requirements / Ready for Submission (no submission yet) | Withdrawn | Staff, with a required reason (no claim; self-pay) |
| Approved / Rejected / Withdrawn | — | Terminal; no reopening is defined |

Local validation is never approval; Escalated is never Approved or Rejected.

### Prescription (M19)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Draft | Dentist; private from the Patient |
| Draft | Draft (edited) | Dentist, with revision check |
| Draft | Authorized | Explicit Dentist authorization; immutable version |
| Authorized | — | Correction/reissue is **TBD BEFORE MODULE IMPLEMENTATION** (unresolved policy P7) |

### Follow-Up (M20)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Open | Dentist decision at treatment completion |
| Open | Scheduled | Staff or the Patient books through the M6 validator |
| Scheduled | Open | Linked appointment cancelled or no-show |
| Scheduled | Completed | Linked appointment completed |

Recall intervals and reminders are **TBD BEFORE MODULE IMPLEMENTATION**.

### Conversation (M17)
| From | To | By / condition |
| --- | --- | --- |
| (new) | Open | Created with explicit participants (today only via inquiry conversion) |
| Open | Closed | Authorized Staff/Dentist participant |
| Closed | — | Reopening is **TBD BEFORE MODULE IMPLEMENTATION** (unresolved policy P8) |

A Patient-initiated conversation command does not exist yet; adding one is a shared-contract change.

---

## Dependency graph

```
Patient
  ↓
Appointment or Walk-In
  ↓
Visit / Encounter
  ├── Queue
  ├── Treatment / Consultation
  │      ├── Prescription
  │      └── Follow-Up
  ├── HMO Case
  └── Invoice
         ↓
     HMO Coverage (Approved only)
         ↓
     Settlement / Payment
```

| From | To | What flows |
| --- | --- | --- |
| M3 | M19 | Dentist professional/credential data |
| M14 | M12 | HMO source documents and extraction drafts |
| M14 | M19 | Prescription source documents and OCR drafts |
| M19 | M18 | Delivery request for an authorized prescription copy |
| M12 | M11 | Approved coverage (via the single financial calculation) |
| Operational modules | M22 | Audit events |
| Operational modules | M21 | Analytics projections (read-only; never a second source of truth) |
