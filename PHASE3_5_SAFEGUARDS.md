# Phase 3.5 safeguards and user-acceptance hardening

## Checkpoint, scope and method

Protected starting HEAD: `cfb59e2` — Complete Phase 3 HMO communications and orchestration. Starting working tree was clean. The actual baseline passed 184/184 tests, all render-smoke scenarios and the production Vite build.

Read the project instructions, Phase 1/2/3 notes, scope/alignment/module/demo documentation and ERD dictionary before implementation. Audited the command runner, persistence, normalization, clock, selectors, role pages, existing tests and smoke setup. Added failing adversarial cases against the checkpoint before the corresponding targeted fixes. The original three test files are unchanged. No business workflow was rebuilt; existing successful paths remain regression tested.

The UI skill was consulted for small validation/recovery changes only. No design overhaul, branding/logo work, backend, integrations, new dependencies, official-document reconciliation, commit or push is part of this phase.

## Finding register

Counts refer to grouped findings, not individual assertions: **15 MUST-HAVE safeguards, 4 RECOMMENDED operational safeguards, 9 unresolved POLICY decisions**. All 19 implementable groups below were implemented. Policy decisions were not activated.

### MUST-HAVE safeguards

| ID / severity | Roles and modules | Risk / previous behavior | Implemented behavior | Regression evidence |
| --- | --- | --- | --- | --- |
| M1 Critical | All; access and commands | An active account plus forged/stale role, Patient, Dentist or branch claims could pass broad scope checks; removed permissions were inconsistently enforced. | Current user/person/profile/role/branch/permission validation; missing profiles and expired supplied sessions fail closed. Route access and sensitive selectors also revalidate. No session timeout value is invented. | Forged Patient/role, inactive/missing identity, removed permission/assignment, expired session and direct-page tests. |
| M2 Critical | Owner/others; M1 | Account creation/status functions relied on the Owner page and stale React closures; toggling is unsafe on retries. | Shared Owner-only creation and explicit desired account status, unique identity checks, supported role/branch checks, repeat-safe updates; current administrator cannot deactivate itself. | Unauthorized account mutation, invalid role/branch, repeat creation/status and self-deactivation tests. |
| M3 High | Owner/Staff; M2/M3 | Branch/personnel changes used raw setters and could persist invalid hours or conflicting identity/assignment. | Shared commands validate configuration and immutable identity IDs; branch assignment updates synchronize the account; branch service changes set a desired state. | Invalid hours/threshold, unauthorized mutation, assignment synchronization and repeated service-state tests. |
| M4 High | Patient/Staff; M6/M7 | Booking replay could return another Patient's record; reschedule could reassign Patient or miss admission evidence if one link was absent. | Validate retry ownership, immutable Patient identity, queue/check-in/treatment evidence, expected revision and existing HMO branch relationship. | Cross-patient replay, reassign, stale revision, admitted/terminal states and HMO-linked branch tests. |
| M5 Critical | Staff/Dentist; M8/M9 | Queue transitions/cancellation could mutate a differently linked appointment; duplicate or terminal relations could be reused. | Encounter invariant checks cover appointment, check-in, queue, treatment and duplicate references before transition. Walk-in retries check exact identity/day/state. | Cancelled/foreign/duplicate queue links, stale admission, missing check-in, terminal protection and walk-in replay tests. |
| M6 Critical | Dentist; M5/M19 | Stale drafts and changed encounter links could authorize inconsistent clinical records. | Completed care remains immutable; draft revision checks; prescription authorization requires exact completed encounter; selectors verify modern authorization relationships. | Stale treatment/Rx drafts, post-completion edits, removed Dentist assignment, broken queue and authorized-record replay tests. |
| M7 Critical | Staff/Patient; M11 | Paid replay incompletely checked payment/branch/receipt evidence; whitespace fees could become zero. | Validate exact completed payment, invoice, Patient, branch, amount, method and receipt state; hide unsupported Patient receipts; reject invalid configured fee values. | Invalid payment evidence, Paid terminal behavior, missing payment receipt, removed billing permission and whitespace fee tests. |
| M8 High | Staff/Patient; M12–M14 | Invalid contact timestamps could permit escalation; malformed modern approval state could be presented as provider evidence; upload result returned internal case data. | Exact cycle/history/timestamp checks, modern external-response evidence, patient-safe command result; malformed tracking renders a review notice. Legacy terminal outcomes are explicitly historical, not newly verified. | Future contact, impossible date, unsupported approval, wrong provider/cancelled case, upload redaction and malformed tracking render. |
| M9 High | Patient/Staff/Dentist; M18 | A recipient-owned notification could still navigate to a draft, stale or no-longer-permitted destination. | Revalidate current target ownership, state, permission and clinic day; unavailable links have no navigation action. | Draft Rx/invoice, missing entity, old queue and scoped read/dedup regressions. |
| M10 High | Patient/Staff/Dentist; M17 | Malformed participant/message collections could crash; Dentist access did not recheck messaging permission. | Malformed threads are withheld, explicit participants remain authoritative, live permission/branch checks precede replies and reads; closed threads reject new replies. | Malformed threads, removed permission, closed-thread unread preservation and existing replay/isolation tests. |
| M11 High | All; input/time | Non-string clocks or clinical payloads could throw or become misleading object strings; Date.parse accepts impossible calendar rollover. | Validate data shapes and clock strings, calendar dates, medication text and configured numeric values; Manila date conversion for timestamp comparisons. | Malformed time/forms/DOB/text/fees, impossible/future timestamp and UTC clinic-day tests. |
| M12 High | All; persistence | Storage exceptions were swallowed; unreadable saved data could be replaced with seeds on the next write. | Preserve unreadable storage, block all collection writes and migration while recovery is required, expose recovery state; report quota/unavailable storage rather than implying saved work. | Invalid JSON/missing IDs and write-failure tests; application warning/blocking path reviewed. |
| M13 High | Owner; exports | User-entered CSV values could be interpreted as spreadsheet formulas. | Escape spreadsheet formula prefixes at export without changing stored clinical/person data. | Formula and quoted-name export tests. |
| M14 High | Staff/Dentist; M4/M5 | Switching Patient could briefly retain the previous Patient's edit form; a malformed treatment pointer could preload unrelated care. | Key Patient summary form by canonical Patient ID; validate clinical preload identity before displaying the draft. | Exact encounter/foreign ID regressions and render review; browser timing remains a later browser QA item. |
| M15 High | Staff; M8 | After one admission, automatic selection could put the next Patient behind the same Confirm arrival control. | Require explicit selection of the intended scheduled arrival; clear selection after success. | Smoke verifies no Confirm arrival control before explicit selection; command duplicate-admission tests remain passing. |

### RECOMMENDED operational safeguards

| ID / severity | Roles/modules | Previous behavior → implemented behavior | Coverage |
| --- | --- | --- | --- |
| R1 Medium | Staff/Patient; M20 | A valid persisted Scheduled obligation linked to a Cancelled/No-show appointment was stranded → display Awaiting Scheduling and permit replacement booking through the existing complete validator. Failure preserves the original relationship. | Recovery/rebooking, failed rebooking and render tests. |
| R2 Medium | Dentist/Staff; failures | Generic feedback or a success toast could hide a completed treatment's HMO handoff warning → concise reopen/review instructions and visible handoff warning. | Failed command/monitor tests, code review and recovery renders. |
| R3 Low | Staff/Dentist; M4 | Patient search field was decorative → name/code filtering within authorized patients. | Source review and patient-page renders; full interactive search testing remains browser QA. |
| R4 Medium | Staff; M4 | Empty/unavailable selection returned before registration controls → explicit available-Patient or New Patient recovery path. | Empty registry smoke assertion. |

## Invariants and transition map

Normal path remains Appointment → Check-In → Queue → Treatment → actual procedures → Draft invoice → Review → Issued → recorded full payment/receipt. Dentist-requested prescription and follow-up obligations remain optional branches. HMO and communication remain administrative handoffs, never clinical decisions.

- Actor identity and authority come from current canonical records; a stale session flag or hidden button is insufficient.
- An appointment's Patient cannot be reassigned through rescheduling. Reschedule requires an unadmitted Pending/Confirmed record and normal availability/overlap validation.
- Preserve the approved Phase 1 behavior: cancellation before clinical documentation may close an admitted queue/check-in and reopen follow-up. No new cancellation cutoff is imposed.
- Queue, check-in, appointment and treatment agree on Patient, Dentist, branch and encounter IDs. Contradictory or duplicate links block mutation rather than selecting an arbitrary record to repair.
- Today's operational actions do not reopen old-day encounters. Stored historical dates never rebase on refresh. UTC timestamps are interpreted on the Manila calendar day.
- Completed treatment cannot revert to draft. Authorized prescriptions cannot silently become drafts or change contents. Draft revisions protect stale same-state forms where supplied by the UI.
- Normal invoice processing requires completed treatment/procedure/queue/appointment integrity. Paid requires a completed exact full payment and matching receipt; no partial payment, overpayment or refund system is added.
- Modern prescriptions require exact completed encounter context. Historical legacy displays are not converted into fabricated modern audit records.
- Follow-up clinical need originates with the Dentist; booking still uses the Phase 1 validator. Cancelled/no-show replacement recovery requires matching canonical links.
- HMO local completeness never establishes provider approval. Modern terminal outcomes require external-response evidence. Escalated stays unresolved/actionable. Contacts cannot precede their submission or occur in the future.
- Notification ownership, destination access and message participation are separate validations. Messages and Notifications retain separate records and unread state.
- Failed business commands preserve prior business state. Phase 3's deduplicated failure events remain action-driven; no render creates workflow records.
- Configuration actions do not invent a new role/profile identity. Account Active/Inactive remains distinct from operational Available/Unavailable; scheduling availability alone does not revoke historical account access.

## Policy decision register — no values activated

| ID | Question / why it matters | Recommended options | Safest enforcement pattern once approved |
| --- | --- | --- | --- |
| P1 | Patient cancellation cutoff: when should self-cancellation close? | Until admission; a clinic-defined pre-start interval; or Staff-assisted exceptions. | Shared cancellation validator using clinic clock, actor and encounter state; display the same reason in UI. Preserve current behavior pending decision. |
| P2 | Patient rescheduling cutoff: when may an unadmitted appointment move? | Until admission; clinic-defined lead time; Staff-assisted late changes. | Shared appointment command with configurable cutoff and revision checks; never a UI-only rule. |
| P3 | Earliest arrival/check-in: how early should today's appointment be admitted? | Any time during today's operating hours; approved early window; Staff discretion. | Keep check-in distinct; inject approved window into the shared command using clinic time. No number chosen here. |
| P4 | Late arrival/no-show: when should Staff mark it? | Manual reviewed decision; defined grace period with warning; timed suggestion requiring Staff confirmation. | Staff-owned transition with reason/audit if required; never automatically infer clinical cancellation. |
| P5 | Override authority and evidence: who may bypass future timing restrictions? | No override; designated Staff permission; supervisor approval. | Explicit permission, reason and audit. Never override Patient identity, payment evidence or clinical ownership invariants. |
| P6 | Completed clinical amendments: how are corrections made? | Append signed addendum; versioned amendment with original retained. | Immutable original, treating/authorized clinician, reason and audit. Current completion stays read-only. |
| P7 | Authorized prescription correction/reissue: amend or replace? | Reissue with supersession; controlled versioned amendment. | Explicit Dentist authorization and retained original/audit; never edit as a draft. |
| P8 | Conversation reopening: who can reopen a closed thread? | New conversation; assigned operator reopens with reason. | Explicit participant/assignment checks and event, preserving history/read state. No reopening command invented. |
| P9 | Zero-fee invoice settlement: how is a valid zero-total bill closed? | No-payment settlement status; documented waiver/adjustment workflow. | Explicit audited financial transition; do not fabricate a zero/positive payment to produce Paid. Current system blocks payment and requires clinic review. |

The Phase 3 12-hour HMO threshold is already documented and is retained. This phase does not claim it was confirmed as a real insurer SLA or introduce a replacement. Penalties, refunds, new fees, automatic no-show behavior and exact text-length limits were not invented.

## Architecture and files

- `safeguards.js`: bounded live-session/permission, encounter, payment, timestamp and page-access checks.
- `administration.js`: existing account, Patient update, branch/service and personnel operations moved to the shared command runner; desired-state updates replace unsafe toggles.
- `persistence.js`: structured read/write outcomes, unreadable-data preservation and visible save failures.
- `workflow.js`, `phase2.js`, `hmo.js`, `communication.js`: targeted command revalidation and finalization/replay guards.
- `contracts.js`, `phase3-contracts.js`, `clock.js`, `logic.js`: scoped selectors, safe normalization, timestamp parsing/Manila day and CSV output safety.
- `store.jsx`, `App.jsx`: synchronous shared actions, live route access and persistence feedback.
- Existing pages receive only functional controls, validation/recovery copy and safe selection changes. No CSS/logo/design overhaul.
- `tests/safeguards.test.js` and additions to `scripts/render-smoke.mjs`: adversarial regression and recovery rendering coverage.

No generic rule engine, policy framework, server transport or database is introduced. Canonical IDs and existing embedded procedure/payment/requirement structures remain authoritative.

## Verification

Original tests preserved: 184. Added domain regression cases: 76, for 260 total at the completion audit. Smoke additionally covers 39 role/page renders, existing full journeys, cancelled follow-up recovery, paid receipts, closed conversations, invalid encounter context, stale notification target, empty queue/registry, inactive account, explicit arrival selection and malformed HMO tracking. Original smoke assertions remain intact.

Required final gates are `git diff --check`, `npm test`, `npm run test:smoke`, `npm run build`, and `git status`. Final command results are reported in the completion response. The Vite build now emits a nonfatal >500 kB JavaScript chunk warning; code splitting is a later performance task, not a reason to hide the warning or increase its threshold.

## Remaining limits and reconciliation input

This is frontend behavior, not production security. A backend must authoritatively enforce identity, role/branch scope, immutable audit, record versions, idempotency keys, financial uniqueness and relational/database constraints. A user controlling JavaScript/localStorage can bypass a client-only application. No cross-tab/cross-device locking, server transport or transaction durability is claimed. A storage write failure can affect only some collections; the warning does not promise atomic persistence or recovery. Browser storage is still unsuitable for production patient data.

SSR render-smoke does not exercise real browser clicks, focus, localStorage effects, devices or assistive technology. Full browser UAT remains recommended. Ambiguous/corrupt historical records are retained or withheld for review; no general legacy repair/amendment tool is invented. Historical Paid demo invoices without payment evidence are retained for Staff oversight but are no longer presented as valid Patient receipts. Historical HMO outcomes remain explicitly historical, not fabricated externally verified responses.

Next documentation reconciliation should resolve: current role/subrole permission enforcement; protected completion vs old Staff-completion walkthrough; admitted pre-clinical cancellation behavior; immutable Patient identity on reschedule; exact encounter and payment evidence requirements; stale draft/retry semantics; historical receipt/HMO treatment; foreground-only reminders; fixed checklist vs logical provider/policy/claim ERD scope; storage and multi-client limitations; the nine policy decisions above. Phase 3 notes still describe that phase's then-uncommitted state; Git now records its protected committed checkpoint. No older official documentation or UI skill was rewritten in this phase.


## Continuation audit

Rechecked the current WIP against all original sections, including 1–15. Found and fixed the incomplete HMO render gate: it used an old display clock instead of the current centralized clock, hiding valid Escalated-case response controls. Existing Phase 3 smoke assertions exposed the regression and remain intact. Also rejected malformed submission-cycle types, non-text emergency reasons and follow-up scheduling after its permission is removed. The added arrival smoke assertion was corrected to inspect the action button and selection notice rather than matching explanatory header text. No legitimate assertion was weakened.
