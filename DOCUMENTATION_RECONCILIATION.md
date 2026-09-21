# Documentation Reconciliation — Through Phase 3.5

## Checkpoint and purpose

Protected implementation: **`dac864e` — Complete Phase 3.5 safeguards and user acceptance hardening**. Starting working tree was clean. Baseline verification passed: **260 tests, 260 passing, 0 failing**, `npm run test:smoke`, and `npm run build`. The existing nonfatal >500 kB JavaScript chunk warning remains. This reconciliation changes documentation only; application behavior, tests, dependencies, ERD artifacts, official logo and production UI skill are unchanged.

## Source-of-truth relationships

Apply this order: approved business requirements/client facts → approved 25-module meanings → approved ERD concepts/Data Dictionary → explicit Phase decisions → verified implementation → historical/prototype descriptions. Tests demonstrate actual behavior, not permission to redefine a requirement. The supplied reconciliation request provides current approved module meanings/client facts; older notes reference Module Documentation v1.1. Do not infer a new clinic policy from demo seeds or from a test fixture.

Current entry points are README (overview), FRONTEND_SCOPE (implemented/future boundaries), MODULE_COVERAGE (all 25 modules), ERD_ALIGNMENT (concept mappings), PROFESSOR_DEMO_GUIDE (current journey), and this discrepancy/policy register. Phase notes retain their historical meaning. When source documents disagree, record the discrepancy before editing requirements or implementation.

## Materials reviewed

- `AGENTS.md`, `README.md`, `FRONTEND_SCOPE.md`, `MODULE_COVERAGE.md`, `ERD_ALIGNMENT.md`, `PROFESSOR_DEMO_GUIDE.md`.
- `FINAL_UI_AUDIT.md` (found during the final stale-wording audit), `P0_IMPLEMENTATION_NOTES.md`, `P1_PRODUCTION_UI_REFRESH.md`, `PHASE1_IMPLEMENTATION_NOTES.md`, `PHASE2_IMPLEMENTATION_NOTES.md`, `PHASE3_IMPLEMENTATION_NOTES.md`, `PHASE3_5_SAFEGUARDS.md`.
- `docs/architecture/ERD_v2_Data_Dictionary.md`, `Multi-Branch_Dental_Clinic_Operation_System_ERD.png` and `.svg` in that directory; diagram relationship/nullability annotations checked against the frontend.
- Implementation evidence: `store.jsx`, `workflow.js`, `contracts.js`, `safeguards.js`, `administration.js`, `persistence.js`, `phase2.js`, `phase3-contracts.js`, `hmo.js`, `communication.js`, `orchestration.js`, `clock.js`, `logic.js`, `data.js`, `App.jsx`, `layout.jsx`, Scheduling, PatientFlow, Clinical, FinanceCommunication, Dashboards and Admin pages, `package.json`.
- Regression evidence: `tests/workflow.test.js`, `tests/phase2.test.js`, `tests/phase3.test.js`, `tests/safeguards.test.js`, `scripts/render-smoke.mjs` and actual verification output. Domain tests total 37 + 63 + 84 + 76 = 260; smoke is separate.

## Documents modified

| Document | Reconciliation |
| --- | --- |
| README | Current phases/workflow, run commands, test evidence, local limits and document index; removes “final interface” implications |
| FRONTEND_SCOPE | Replaces obsolete P0/P1/P2 roadmap with current capabilities, safeguards, partial areas and future infrastructure |
| MODULE_COVERAGE | Purpose/status/capability/boundary for each M1–M25; separates shared-screen modules and labels partial/PE scope |
| ERD_ALIGNMENT | Current named/embedded structures, IDs/evidence, normalized-model differences and walk-in ambiguity |
| PROFESSOR_DEMO_GUIDE | Real current role journey, exact encounter, explicit clinical decisions, invoice Review, honest HMO timing and defense statements |
| AGENTS | Current context list, shared safeguards/clock and verification guidance, explicit administrative exception reference |
| Six historical phase records plus FINAL_UI_AUDIT | Short historical/current-status notes only; original narrative/results remain intact |
| DOCUMENTATION_RECONCILIATION | This central record, conflict classifications, policy register and future inputs |

The Data Dictionary and diagrams are intentionally preserved. Historical phase prose is not rewritten to imply later safeguards existed earlier.

## Discrepancy classifications and corrections

| Category | Finding | Documentation action |
| --- | --- | --- |
| A — Documentation stale | P0-era scope calls Notification Center and Automation Monitor future targets; single-service billing and incomplete downstream descriptions | Current docs describe implemented global notifications, read-only monitor, multiple procedures and clinical/financial lifecycle |
| A — Documentation stale | Demo implies Staff can complete queue treatment; Messages includes failed-notification retry | Dentist completion owns clinical closure; Messages and Notifications remain separate. No claim of external delivery/retry infrastructure |
| A — Documentation stale | “Final” frontend / before persistence wording overstates UI completeness and understates local persistence | State tested frontend with local storage, incomplete production UI and no backend |
| A — Documentation stale | Coverage implies Owner module-coverage navigation and uniform Staff access | Coverage stays a defense document; current subroles/permissions and Owner oversight are explicit |
| B — Implementation defect | Reporting filter promises are not implemented consistently | Retain conflict C1 below; mark Analytics partial, do not change code or requirements |
| C — Implementation clarification | Canonical relationships, exact encounter evidence, payment/receipt and Prescription authorization evidence | Explain contracts in scope/alignment; retain historical exceptions without inventing evidence |
| C — Implementation clarification | Current actor/branch checks, stale forms, ownership of retries, notification destinations, participant unread state | Explain shared command/selector/page safeguards, not UI-only enforcement or backend security |
| C — Implementation clarification | HMO current-cycle outcomes, timestamps, requirements and contact records | Distinguish external-response tracking from local completeness and unresolved escalation |
| C — Implementation clarification | Storage recovery, date normalization, foreground timers, CSV safety | Document preservation/warnings and limits without claiming atomic recovery/background transport |
| D — Intentional implementation decision | Embedded child records, derived Prescription tasks, fixed HMO checklist, local payment simulation | Map to logical ERD; retain broader backend concepts as future responsibilities |
| D — Intentional implementation decision | Phase 1 admitted pre-clinical cancellation, Owner administrative exceptions, Phase 2 Patient Follow-Up self-scheduling | Describe existing behavior precisely; do not silently narrow/expand roles |
| D — Intentional decision with unresolved ERD difference | Walk-in Treatment has no scheduled appointment | Preserve exact Check-In/Queue context; retain conflict C2 for schema approval |
| E — Policy decision required | Nine undisclosed timing/override/amendment/reopen/settlement choices | Central register below; no values or policies activated |
| F — Historical document | Earlier counts/deferred features/build limitation and then-uncommitted statements | Add short status notes, retain historical prose and verification results |

## Conflicts retained for review

### C1 — Analytics filtering promise versus current implementation

**Requirement/claim:** M21 reports should analyze the selected reporting scope; the existing coverage and Analytics UI explicitly promise branch and period filtering. This remains an expected reporting capability, not a requirement removed by reconciliation.

**Implementation:** `AnalyticsPage` in `src/pages/Admin.jsx` stores `period` only for the selector; none of its calculation/export filters uses it. Appointment/queue/HMO/Paid subsets filter branch, but the communication metric uses all inquiries/conversations and Branch Capacity CSV maps all branches even with a branch selected. Thus scope differs across the displayed report and export. Paid summary aggregation also uses historical Paid labels, not a financial evidence-reconciliation report; document this limitation without asserting audited revenue.

**Severity:** Medium — misleading management reporting and demo claims; not evidence that core clinical transactions failed.

**Recommended resolution:** separately authorized targeted reporting work should define date semantics for each metric, apply period/branch predicates consistently, label intentionally global exports, and add calculation/export regression tests. Do not build duplicate analytics transaction tables. No implementation fix or analytics redesign is included here. The demo explicitly discloses the limitation.

### C2 — Required appointment in the diagram versus approved walk-in care

**Requirement:** approved M8 supports walk-ins, and the Data Dictionary permits scheduled or walk-in arrival. The diagram marks `TREATMENT_PLANS.appointment_id` FK without NULL, suggesting every treatment requires an appointment.

**Implementation:** walk-ins have `appointmentId: null` and a direct Check-In/Queue encounter; Treatment retains exact Patient/Dentist/branch/queue links. Phase 1 explicitly documents this decision; subsequent phases preserve it.

**Severity:** Medium for backend schema readiness — unresolved model/requirement tension, not a demonstrated broken walk-in command.

**Recommended resolution:** obtain approval for optional appointment linkage plus required encounter evidence (or an explicitly approved encounter abstraction) before database constraints. Preserve walk-in behavior; do not fabricate a booked appointment. Neither diagram nor dictionary is changed in this phase.

No other approved-requirement violations were established by this reconciliation review. Partial features and frontend-only integration boundaries below are not silently represented as complete ERD implementations. Passing tests do not imply an exhaustive defect/security audit.

## Role and permission clarifications

Current checks read canonical users/persons/profiles, current permissions and branch assignment. A claimed role/Patient/Dentist ID or direct page context grants no authority. Inactive/missing identities and expired supplied session timestamps are rejected; no arbitrary session-timeout policy is introduced. Operationally unavailable Dentist is not automatically an inactive account.

| Role/subrole | Current command capability reference |
| --- | --- |
| Patient | Own supported portal booking/cancellation, care, authorized Prescription, Follow-Up self-scheduling, issued invoices/valid receipts, safe HMO metadata and participant communications; no clinical/payment/HMO processing |
| Receptionist | Appointments, Check-In, queue, Patient demographics, billing, HMO, Messages and Follow-Ups within branch. Legacy inquiry capability retained via Receptionist messaging permission |
| Dental Assistant | Queue and clinical-records permissions in catalog; route/command role checks still apply. Not a treating Dentist or prescription author |
| HMO Coordinator | HMO, Patient demographics and Messages within branch |
| Cashier | Billing and Patient demographics within branch |
| Patient Engagement Staff | Inquiries, Messages and Engagement; M24/M25 remain PE |
| Dentist | Schedule, own queue, scoped clinical records, exact Treatment/Prescription decisions, Follow-Ups and explicit-participant Messages. No Staff payment/HMO processing |
| Owner/Admin | Account/configuration administration and oversight; `all` permission does not bypass domain role restrictions |

The catalog in `administration.js` defines newly created account permissions; commands validate current stored permissions rather than assuming every Staff account has the full catalog. Account status changes synchronize operational availability; availability can separately be changed for scheduling.

**Existing explicit Owner exceptions:** Phase 1 shared commands permit administrative appointment booking/cancellation, Check-In/walk-in, operational queue controls and Patient registration within Owner scope. Owner navigation does not expose those normal worklists. These inherited exceptions are documented decisions, not a new right created here. Clinical Treatment/Prescription, invoice financial transitions and HMO processing remain restricted to their operational roles; Owner is not a Message participant. Confirm the intended production administrative delegation with the client before altering this existing contract.

Patient records are centralized: an authorized chart can show longitudinal clinical history. Operational Patient eligibility/worklists and visit rows use role/branch/encounter scope. This is not unrestricted access to every Patient in every branch.

## Hardened implementation contracts now documented

- Manual/Find Best/Follow-Up scheduling share one validator. Rescheduling cannot change Patient, cannot move an admitted/clinical encounter, and uses current configuration/overlap checks. No booking payment.
- Cancellation before clinical documentation may close an admitted appointment and its exact queue/check-in; linked Follow-Up returns to Open. Cancellation is not a clinical completion or undocumented timing override.
- Check-In is a distinct Staff admission. Explicit Patient selection reduces accidental next-Patient admission. Duplicate/cross-linked/historical encounters block mutation; Away/Return preserves arrival.
- Dentist completion closes only linked clinical records. Actual multiple procedure lines create invoice items from configured fee snapshots; booked service is not automatic proof of performed work.
- Prescription need and Follow-Up need originate from explicit Dentist choices. Prescription task is derived until documented; authorization requires entered medication, exact completed encounter and Dentist evidence. Completed/authorized records do not revert to drafts; no amendment process is invented.
- Invoice Review precedes Issue. Full positive payment evidence must match invoice/Patient/branch/amount/receipt; partial/overpayment is unsupported. Zero-fee closure is unresolved. Historical Paid records lacking payment evidence are withheld as Patient receipts, retained for Staff review.
- Follow-Up keeps source treatment and explicit appointment. Normal cancellation/no-show clears/reopens its scheduling relationship. Persisted cancelled/no-show link recovery can display Awaiting Scheduling and rebook through the same validator; malformed links require review.
- Retries validate ownership before returning a record. Commands read the latest in-process snapshot; forms pass draft revisions where implemented. No guarantee of multi-tab/cross-device compare-and-swap or complete revision checks on every configuration edit.
- HMO uses case/cycle links, local requirements and timestamp-derived pending duration. Returned correction/resubmission retains case ID. Escalated remains unresolved. Modern Approved/Rejected outcomes require recorded external-response evidence; historical outcomes stay historical.
- Notifications have recipient IDs; mark-read/all affects only that user. Destinations are rebuilt/validated against current entity scope/state. Messages have explicit participants and separate unread state; ambiguous legacy assignments do not confer access. Closing is allowed for authorized Staff/Dentist participants, not Patient/Owner; no reopening command exists.
- M23 logs real actions, selected attempted failures and handoff warnings, not render effects. A failed HMO handoff after valid Treatment completion preserves clinical/financial work and surfaces a warning. The monitor is descriptive/read-only.
- Local normalization preserves authoritative IDs; stored historical dates never shift on reload. Unreadable stored collections block saving/migration rather than overwrite themselves with seeds. Save failures expose unsaved-work warnings; partial writes are still possible.
- CSV formula prefixes are escaped on export, including leading whitespace cases, without rewriting source Patient/clinical text.

## ERD/frontend simplifications

See [ERD Alignment](ERD_ALIGNMENT.md) for every mapping. The frontend splits STAFF_PROFILES into staff/dentists; flattens roles/branch assignments and hours/shifts; embeds performed procedures, invoice items/payment, prescription items, HMO requirements/tasks/history and conversation messages. Queue containers are represented by per-Dentist/branch/day IDs; capacity snapshots are not a separate persisted table. Clinical templates/general protected documents and full HMO policies/claims/provider-specific rules are not implemented subsystems.

PATIENT_NOTIFICATIONS is generalized for individual operational Staff/Dentist recipients, with privacy still enforced. Workflow events/action results share a local ledger and descriptive rule catalog. M21/M22 remain read layers. Real payment verification, HMO integration and immutable server evidence remain backend responsibilities, not fabricated frontend success. The approved logical model remains intact, with C2 explicitly unresolved.

## Policy decision register

No policy below was chosen or activated. Current structural checks remain. Once approved, enforce policy in shared commands with the same UI feedback and future backend validation; a disabled button alone is insufficient. Configurability here describes the implementation approach, not an existing policy editor.

| ID / question | Why it matters | Reasonable options | Safest implementation pattern |
| --- | --- | --- | --- |
| P1 — Patient cancellation cutoff? | Late cancellation affects operations | Until admission; clinic-defined pre-start interval; Staff-assisted late request | Central clock + actor/encounter check in cancellation; preserve linked-state reconciliation |
| P2 — Patient reschedule cutoff? | Late changes affect slot use | Until admission; chosen lead time; Staff-assisted exception | Shared appointment validator/revision; never reassign Patient or move admitted encounter |
| P3 — Earliest Patient arrival/check-in? | Queue may form before planned time | Same-day arrival; approved early window; Staff discretion | Current Staff admission remains distinct; add approved window centrally, no assumed Patient self-Check-In feature |
| P4 — Late-arrival/No-show threshold? | Avoid premature closure or stranded slots | Manual reviewed action; defined grace period; timed suggestion with Staff confirmation | Staff-owned transition using clinic time; no autonomous invented no-show deadline |
| P5 — Staff override authority/reason? | Exceptions need accountable scope | No overrides; designated permission; supervisor approval | Explicit authority, reason and audit; never override identity, clinical ownership or payment integrity |
| P6 — Completed-treatment amendments? | Clinical corrections must retain history | Signed addendum; versioned amendment | Preserve original, authorized clinician, reason/time/audit; current completion remains read-only |
| P7 — Authorized Prescription correction/reissue? | Patients need clear valid instructions/version | Reissue with supersession; controlled amendment | Explicit Dentist authorization, original retained; never silently restore Draft |
| P8 — Closed conversation reopening? | Recovery versus finality/ownership | New thread; assigned operator reopens with reason | Participant/scope validation, retained messages/read state and explicit event |
| P9 — Zero-fee invoice settlement? | Valid zero-total invoice cannot receive positive full payment | No-payment settlement status; documented waiver/adjustment path | Explicit audited financial transition; never fabricate payment to mark Paid |

The **12-hour HMO follow-up threshold** is already documented and retained. It is a frontend operational setting, not evidence of an insurer-specific SLA. Existing foreground reminder foundations (appointment within 24 hours, queue-delay update after 35 minutes) do not define cancellation, check-in or no-show policy. Client confirmation of production reminder cadence/provider checklists is still needed; no thresholds changed here.

## Client context

The supplied client facts: operating since 1981; three branches (two Bocaue, one Guiguinto); approximately 12 Dentists and seven assistants/receptionists; at least two Dentists per clinic/day; approximately 10–20 Patients/day and 30–50/week; weekends busier; peak around October–February. These are supplied approximate figures, not calculations from illustrative seed staffing or reconciled demand forecasts.

Centralized digital software already supports booking, billing and records; prescriptions are a paper-based exception. Pain points include queues, scheduling conflicts, waiting time, HMO provider delays and online/social messaging. Clinical decisions and duration are case-by-case. Desired improvements include shorter waits, real-time booking updates and pre-treatment updates. Billing is already digital, and next appointments are often arranged around payment. Desired real-time updates are not a claim that this frontend supplies server transport.

Client confirmation still needed: the nine policies; production Owner delegation/subrole assignments; provider-specific requirements/policies and actual SLA expectations; production reminder cadence; eventual schema resolution for walk-ins. Do not replace these facts with demo branch names, account counts, fees or sample documents.

## Historical records preserved

The earlier FINAL_UI_AUDIT retains its rebuild decisions and then-current roadmap with a historical-status note. P0 notes retain their then-deferred features and failed build due unavailable tooling; P1 UI refresh retains its presentation claims and validation scope. Phase 1 retains its original single-service/deferred downstream account; Phase 2 retains its then-current historical display/HMO limitations; Phase 3 retains its then-uncommitted statement and protected Phase 2 baseline; Phase 3.5 retains its original audit/policy/results and no-commit scope.

Each has only a brief status note pointing readers to current docs. Phase 3 was subsequently committed as `cfb59e2`, followed by Phase 3.5 committed as `dac864e`. Earlier test counts remain historical evidence rather than being changed to 260. This reconciliation does not claim historical defects still control current behavior.

## Frontend limitations and Phase 4 inputs

No backend authorization/security, cross-device transport, database transactions/locking, protected file storage, real HMO API, payment gateway or email delivery exists. Timers/reminders are foreground only. Browser persistence can be edited/lost and is not atomic across collections. Demo role entry is not production login. Ambiguous legacy data needs explicit review; no general legacy-repair tool is claimed. Tests/smoke do not certify browser interactions, accessibility, security or device behavior.

Phase 4 preparation only:

- Apply the production UI skill later, without changing approved workflow/role/ID contracts for visual convenience.
- Reuse official `public/images/logo.png`; do not recreate it.
- Make all roles responsive across mobile/tablet/desktop: Patient mobile-first, Staff fast repetitive work, Dentist exact encounters, Owner oversight.
- Preserve private drafts, receipt evidence, HMO decision boundaries, independent Messages/Notifications, current-state errors and recovery affordances in state-driven presentation.
- Add browser/device, keyboard/focus, accessibility and interaction QA beyond SSR; improve production copy and performance (existing bundle warning).
- Keep M24/M25 PE, module coverage outside production navigation, and Automation Monitor read-oriented. Do not hide C1 reporting limitations through styling; resolve functionality under explicit implementation scope.

No Phase 4 work, skill update, backend integration, policy activation, commit or push is part of this reconciliation. Documentation changes remain for review.

## Final documentation verification

`git diff --check` passed. `npm test`: 260 total, 260 passing, 0 failing. `npm run test:smoke`: passed 39 initial role/page renders plus connected workflows, persistence and recovery scenarios. `npm run build`: passed with the existing nonfatal chunk-size warning. All changed files are Markdown; historical bodies are unchanged apart from status notes, and relative file links resolve. The working tree contains only uncommitted documentation reconciliation changes. No application, test, dependency, ERD diagram/dictionary, skill or logo changes are included.
