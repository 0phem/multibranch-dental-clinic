# M5 — Treatment & Clinical Workflow: production hardening

Branch `feature/m5-treatment-production-hardening`, created from `e24d4fc` (M11 checkpoint). Uncommitted. **Verdict B.**

## 1. Starting git state
Clean tree on `feature/m11-billing-production-hardening` at `e24d4fc`, synchronized with origin; new branch created from it. No merge to main.

## 2. Architecture discovered (read-only audit, before any change)
M5 was already server-authoritative from an earlier phase and mostly sound:
- `treatments` (one per Visit, `UNIQUE visit_id`), `treatment_procedures` (lines), `treatment_history` (append-only, DB trigger). Bigint ids internal; routes bind ULID `public_id`.
- `TreatmentService`: three named commands only — `start`, `document`, `complete` — each one transaction through `IdempotentCommand` (Idempotency-Key required), lock order appointment → Visit → queue entry → Treatment. No generic PATCH/PUT/DELETE (405).
- `TreatmentPolicy`: Dentist-only commands (responsible Dentist + author, re-checked under lock); Staff branch-scoped READ; Owner read as a summary projection (no clinical text); Patient own completed safe subset via `/treatments/mine`.
- DB invariants: one In-Treatment Treatment per Dentist (partial unique index); `completed_at` iff Completed; follow-up fields only when follow-up required; Completed treatment and its lines read-only (trigger); line service/snapshot immutable; deferred Visit/Treatment consistency triggers.
- Frontend: Laravel is the only authority; `state.treatments` server rows are in-memory only; browser treatments are flagged read-only pre-server history; Dentist workspace (`TreatmentPage`) opens only from a server encounter.

## 3. Authority before/after
Unchanged: server is the sole clinical authority. No browser-local authority remains (existing test `no browser Treatment authority remains`).

## 4. Treatment/Visit relationship
One Treatment per Visit; patient, branch, appointment and clinic date are read from the Visit and never copied.

## 5. One-Treatment-per-Visit
Enforced by `UNIQUE (visit_id)`, the Visit row lock and a pre-check; the database error is mapped to `409 treatment_exists`. Verified under real concurrency (two processes → 201 + 409, one row).

## 6. State machine
`In Treatment → Completed` only (terminal). Start creates `In Treatment`. Stale revision → 409. No Cancelled/Reopened/Corrected state was added (policy).

## 7–10. Authorization boundaries
- Dentist: only the Visit's responsible Dentist starts; only the author (still responsible) documents/completes; another Dentist → 403 (tested, including a real race).
- Staff / Owner / Patient: refused on every command (403 by role middleware/policy); tested for start, document, complete.
- Patient: own completed subset only; Patient B cannot reach Patient A's rows or learn anything from a foreign cursor.

## 11–13. Procedure lines, M13, clinical notes
Lines reference `Service` by its (transitional) `legacy_ref`, must be Active, offered at the Visit's branch and authorized for the Dentist, re-validated at completion. Line carries only quantity, notes and an immutable code/name snapshot; **no price column exists** (M13/M11 own pricing). Clinical text (complaint, plan, summary, notes) is returned to Dentist/Staff-in-scope only; Owner and Patient projections omit it; history snapshots only to the authoring Dentist.

## 14–16. Transactions and immutability
Start (queue Served + Visit/appointment In Treatment + Treatment + history + audit) and completion (Treatment, Visit, appointment, history, audit) are single transactions; rollback tests exist for both (completion rollback added). Completed treatment, lines and history are closed to every command and to direct SQL (trigger-checked in a new test). M5 creates no invoice, prescription, follow-up or HMO case. **POLICY DECISION REQUIRED — CLINICAL CORRECTION/AMENDMENT**: completed records stay immutable.

## 18–19. Concurrency and idempotency
Real-process races (new): two completes → one completion, one history row, one audit event; document-vs-complete → exactly one consistent winner (completion first → save refused 409 stale, record untouched; save first → completion refused 409, record open); another Dentist racing the author → 200 + 403. Existing: two starts, one-Dentist-one-active. Command replay with the same key returns the stored result without repeating transitions or audit.

## 20. Findings fixed in this pass (confirmed defects)
1. **Silent 200-row cap on the Patient treatment history** (`GET /treatments/mine`): older completed treatments were unreachable. Now keyset-paged (newest first by `completed_at`, then id; `per_page` 1–100, default 50; cursor = Treatment `public_id`; `meta.next_cursor`; the cursor lookup is scoped to the Patient's own rows, so a foreign or unknown cursor returns the same empty page). **Client behaviour, final (pre-checkpoint gate):** the client follows `next_cursor` automatically for at most 20 pages × 100 records as a memory/loop safety bound. *Before the gate this bound was a completeness defect:* the cursor was discarded at the bound, only an internal truncation flag was set, and no Patient-facing surface showed it, so a history longer than 2,000 records would have been silently cut with no way to continue. *Now:* the kept `next_cursor` is held in the store; when the bound is reached the Patient's Visits page shows "Only part of your treatment history is shown" with an explicit **Load older treatment records** action that reads the next bounded batch from the server cursor (merged without duplicates), repeats until the cursor is null, and on failure shows the error with **Retry** (same cursor, loaded records kept). The notice disappears only when the server reports no further page, so nothing is silently truncated and the UI never claims the history is complete before then. Server page-size bounds are unchanged and the whole history is never fetched unbounded. Proofs: backend paging test (order, no gaps/repeats, bounds, foreign-cursor indistinguishable), frontend test (records beyond the bound reachable from the kept cursor, failure retryable, UI text present), browser QA (20 automatic requests, notice, failed continuation with Retry, success to cursor null).
2. **Forged fields silently ignored** on start/complete/document (unknown top-level fields were dropped, not refused). Identity, ownership, state, clock, billing/money and audit fields (`patient_id`, `branch_id`, `dentist_id`, `visit_id`, `status`, `started_at`, `completed_at`, `created_by_user_id`, `invoice_id`, `billing_status`, `price`, `amount`, `revision`, `history`, `audit`, …) now return 422; unknown keys inside a procedure line were already refused.
3. **No M22 events for clinical transitions.** Minimal events added: `treatment.started`, `treatment.completed` (category `clinical`, public ids, state change, revision and a line count only — never complaint, plan, notes, summary or line detail), written in the command transaction. Other M5 history stays module-local; broader M22 integration is future module-level work.

## 21–22. Privacy and browser-local findings
Resources already minimal; no change needed. No demo treatment is shown in server sessions; browser QA confirms. Treatment workspace shows "No encounter selected" without a server encounter.

## 23–25. Integration
M8/M9/M6: start/complete drive Visit, queue and appointment atomically (regressions Visits 25, Queue 19, Appointments 75 pass). M11: completion only makes the Treatment billable; M5 holds no money (Billing 33 pass). M12/M13 unaffected (Hmo 13, Pricing 9). M19/M20: the Dentist's prescription/follow-up flags are recorded facts only; no prescription, recall or schedule is created.

## 27. Database/schema
**No migration.** Nothing applied to `dental_clinic`.

## 28–29. Files and tests
Backend: `TreatmentController`, `TreatmentService`, `TreatmentCommandRequest`, `DocumentTreatmentRequest`, tests `TreatmentTest` (+5), `ConcurrentTreatmentStartTest` (+3). Frontend: `api-client.js`, `treatments-api.js`, `store.jsx`, `src/pages/PatientVisits.jsx`, `tests/m5-treatment-cutover.test.js`. Tooling: `scripts/m5-treatment-browser-qa.mjs`. Doc: this file.

## 30–38. Results
Targeted Treatments 29 passed / 605 assertions (stable over repeated runs; one flaky assumption in my first race test was corrected, not the product). Cross-module: Visits 25, Queue 19, Appointments 75, Billing 33, Audit 40, Hmo 13, Pricing 9 — all pass. **Full backend 512 passed / 4,898 assertions** (final test tree). Frontend 720 passed (m5 file 16, final). Smoke 16 groups. Build passes (known bundle-size warning). Browser QA 95 checks (incl. the continuation scenario), 0 failures, 0 errors, 0 px overflow (Patient/Staff/Owner/Dentist × 375/430/768/1024/1440): Patient history follows the cursor and a failed page is an explicit recoverable error; Dentist sees no clinical action without a server encounter; Staff/Owner have no Treatment entry or mutation control. `git diff --check` clean. Not browser-tested end to end: a full Dentist encounter (start → document → complete) against live APIs — that is covered by the backend tests and the existing frontend flow tests, not the fixture-based browser QA.

## 39. Unresolved clinic questions (not answered here)
1. Which clinical fields are mandatory before completion (today: procedure summary and ≥1 valid line only)? 2. Can a completed Treatment be corrected, by whom, preserving history? 3. May another Dentist continue/take over a Treatment? 4. May Owner read full clinical notes? 5. Should Staff see clinical notes or procedure/status only (today Staff in branch scope read the clinical record — existing decision Q-T6)? 6. Tooth numbers/surfaces per service? 7. Treatment plan separate from performed treatment? 8. Signatures/consents before certain procedures? 9. Should completion create follow-up recommendations automatically (today: no)?

## 40. Remaining blockers
Correction/amendment policy; cross-Dentist takeover; clinical-field requirements; Staff/Owner full-note visibility; M19/M20 integrations incomplete; broader M22 coverage of M5 reads/denials; M3 workforce authority deferred.

## 41. Verdict
**B.** Every Verdict-A engineering criterion that does not depend on clinic policy is met; the items above are policy- or module-dependent and were not invented.
