# M23 — Workflow Automation: truthfulness corrections

Branch `feature/m23-automation-truthfulness-corrections`, created from `6563e4c` (the M21 checkpoint). Uncommitted. This is a **narrow technical-correctness pass, not M23 hardening**: no automation was made to execute anything, no clinic policy or threshold was invented or changed, no migration was added, and M23's canonical completion status is unchanged.

## 1. Execution reality (verified before any change)

```
domain code ──► WorkflowAutomationService::recordEvent ──► system_events (append-only)
                         │
                         └─► evaluateRulesForEvent ──► resolveRuleOutcome (pure: reads the payload, returns status + text)
                                     │
                                     └─► automated_actions (append-only) + one M22 `automation.rule.<code>` event
snapshot / rules / actions / export-csv  ◄── read the two tables (Owner only)
POST /automation/dispatch ──► triggerManualEvaluation ──► the same path with an Owner-typed payload
```

- The only code that calls `recordEvent` outside the service is `BillingService` (`billing.payment_received`), and that event type matches **no rule**. Nothing emits the six rules' trigger events. So every `automated_actions` row in the database was produced either by an Owner manual dispatch or by a test.
- `resolveRuleOutcome` has **no side effects**: it creates no invoice, task, notification, route, conversation, follow-up, profile or message, and calls no other module. M23 today is an **evaluation recorder**, not an executor. There is no queue worker (TD-24).
- Therefore **no row ever written by M23 represents an executed business action.**

## 2. Rule inventory and provenance

| Rule | Trigger | Event can occur today? | Provenance of its number | Evaluates | Executes |
| --- | --- | --- | --- | --- | --- |
| R1 `R1_APPT_LIFECYCLE` | `appointment.lifecycle.changed` | No emitter (manual only) | none | The event was received | Nothing (slot logic is M6) |
| R2 `R2_HMO_FOLLOWUP_REMINDER` | `hmo.pending.timer.updated` | No emitter | 12 hours: project value, unconfirmed (`HmoCase::FOLLOW_UP_HOURS`) | `pending_hours >= 12` | Nothing |
| R3 `R3_CAPACITY_ALERT` | `patientflow.capacity.updated` | No emitter | 35 minutes: project value, unconfirmed | `estimated_wait_minutes > 35` (branch load is **not** evaluated) | Nothing |
| R4 `R4_TREATMENT_DOWNSTREAM` | `clinical.treatment.completed` | No emitter | none | The event was received; reports caller-supplied flags | Nothing |
| R5 `R5_MESSAGE_ROUTING` | `communication.message.received` | No emitter | none | The event was received | Nothing (M17 has no routing or creation command) |
| R6 `R6_USER_PROFILE_SYNC` | `access.user.changed` | No emitter | none | The event was received | Nothing (privileged provisioning is not implemented) |

The 12-hour, 35-minute, 80/80/75, 15-minute-per-position, 24-hour and demo follow-up values remain unconfirmed demonstration values (`FOLLOW_UP_INTERVIEW_AND_POLICY_DEPENDENCY_MAP.md` §7). None was changed, none was replaced and none was activated in a production execution path: they are reached only by an Owner manual evaluation, and every summary that uses one now says it is a demonstration threshold, not clinic policy. The 12-hour literal in the service now reads the existing constant instead of a second copy.

## 3. E-4 — results now say what happened

| Rule | Before (stored text) | After |
| --- | --- | --- |
| R1 | "Appointment X verified; calendar reservation and notification dispatch staged." | "Appointment X event evaluated. Evaluation only: no slot, calendar entry or notification was created by this rule." |
| R2 | "Follow-up task staged for coordinator" / "pending duration within standard operating window" (a missing value was assumed to be 0) | "HMO pending time Nh meets / is below the 12-hour demonstration threshold (an unconfirmed project value, not clinic policy). Evaluation only: no follow-up task or notification was created." A missing value is **Failed**, not 0. |
| R3 | "Branch capacity alert…" / "Branch patient flow and chair capacity validated within normal operating limits" (a missing value was assumed to be 0; "branch load" was in the written condition but never evaluated) | "Estimated wait Nm exceeds / does not exceed the 35-minute demonstration threshold … Branch load is not evaluated by this rule. Evaluation only: no alert was sent." A missing value is **Failed**. |
| R4 | "Treatment completed: **Draft invoice created**; … obligation staged" (always claimed an invoice) | "Treatment completed event evaluated. [Caller-supplied … flag present; its origin is not verified by M23 and it is not a Dentist-authorized decision.] Evaluation only: no invoice, prescription task, follow-up or recall was created." |
| R5 | "Patient communication routed to responsible branch staff inbox." | "Message received event evaluated. Evaluation only: nothing was routed, assigned or created; messaging has no routing or creation command." |
| R6 | "User account synchronised with … personnel profile." | "User change event evaluated. Evaluation only: no personnel profile was created or synchronised; privileged provisioning is not implemented." |

Statuses keep their existing meaning (Success = evaluated without a flagged condition, Warning = a demonstration condition matched, Failed = could not be evaluated). No new lifecycle state was introduced. Every action row carries `details.execution = "evaluation_only"`.

**Historical rows are not rewritten** (`automated_actions` is append-only and its text stays as stored). Because no executor has ever existed, the API now returns `execution: "evaluation_only"` for **every** row, including older ones, and the Monitor shows "Evaluation only — no business action was performed. Older wording that describes an action was a proposed action, not a completed one." The CSV gains an `Execution` column. The snapshot gains `execution_model: "evaluation_only"`. Existing fields are unchanged (backward-compatible).

## 4. E-5 (M23 side) — no data is not 100%

- `getAutomationSnapshot`: `health_rate` is now `null` when there are no recorded evaluations; a genuine 0% and 100% are unchanged (tests: empty → null; Success → 100; Success+Warning → 50; one Failed of three successes → 33; only Failed → 0).
- Meaning (now stated on the page): the share of recorded rule **evaluations** that finished without a warning or failure — a successful evaluation is **not** counted as a successful business action. The card is "Evaluation health", other cards "Rules in the registry", "Failed evaluations", "Recorded evaluations".
- The Monitor shows "No data" for a null rate. The offline demo no longer defaults to 100 either.
- M21's page note ("N actions executed") now reads "N rule evaluations recorded … nothing is executed by this module". M21 JSON is unchanged; `automation.health_rate_pct` was already `null` without data.
- A failed snapshot request in a clinic-server session shows "The automation record is unavailable right now" with **Try again**, "—" for counts, "Exceptions unavailable" (not "no exceptions"), and no local demo rows. Previously a failure silently fell back to the browser's demo log, and an **empty server exception list also fell back to local demo exceptions**; both are fixed. The offline demo (no server session) keeps its local records under the label "Offline demo preview — local example records, not clinic data".
- Incidental dead control: `AutomationPage` passed `action=` to `PageHeader`, which only renders `aside`, so Refresh and Export CSV never appeared. They now render (the export endpoint was already tested and Owner-only).

## 5. Manual dispatch (`POST /api/automation/dispatch`)

- **Authorization:** unchanged and re-verified — route `role:owner` plus controller check; guests 401; Staff, Dentist, Patient 403, **before** validation runs. No branch authorization applies to a manual evaluation (it carries no branch).
- **Validation (new, `DispatchAutomationRequest`):** `rule_code` must exist; `payload` must be an array; each rule accepts only its own observation: R1 `action_type` ∈ `created, moved, cancelled`; R2 `pending_hours` integer 0–8760 (required); R3 `estimated_wait_minutes` integer 0–1440 (required); R4, R5, R6 none; `diagnostic_check` (boolean) is always allowed. Any other field is 422 — including `patient_id`, `actor_user_id`, `dentist_id`, `provider_response`, `hmo_outcome`, `payment_reference`, `branch_id`, `invoice_id`.
- **Clinical flags:** `followup_required` and `prescription_required` are refused with a message that they exist only on a Dentist-documented Treatment.
- **Actor:** the event's actor is the authenticated Owner (`system_events.actor_user_id`); no payload field can set it. The stored payload no longer contains the Owner's email (`actor_email` removed). No event-body transcript reaches M22 (the audit payload carries rule code, summary, event type, status and the action id only; tested).
- **Rate limit:** `throttle:20,1` added (a technical bound, not clinic policy; uses the shared cache, TD-03). The route remains evaluation-only and cannot mutate clinical or financial records.
- **Duplicates:** manual evaluations use a unique key each time (intended); the service-level idempotency key still returns the existing event and creates no second action.
- **Snapshot branch:** `GET /automation/snapshot?branch_id=` had the same `(int)` cast defect as M21 E-1 (`"b1"` → 0 → silently all branches). It now resolves a public ULID or legacy reference (`Branch::fromPublicReference`), accepts `all`, and returns 422 for anything else. The page does not currently send it.
- **Response message:** "Rule … was evaluated and the evaluation was recorded with status …. No business action was performed." (previously "executed with status").

## 6. R4 — clinical authority

R4 evaluates and records only. Its stored text no longer claims an invoice, task or recall, reports a follow-up/prescription flag only as "caller-supplied … not verified … not a Dentist-authorized decision", and records `details.flag_origin = "caller_supplied_unverified"`. Manual dispatch cannot supply the flags at all. Nothing is created and no recall timing exists. The frontend adapter that creates an Open follow-up from a **Dentist-documented** server Treatment (`src/workflow.js`) is unchanged and is not M23 backend authority.

**Required gate for the M20/M23 integration (not implemented here):** any authoritative follow-up requirement must be created by an M20 command that verifies, on the server, a Dentist-recorded follow-up on the same Treatment (`followup_required` set through the M5 documentation command). A boolean in an event payload, a rule, a manual dispatch or a recall list is never sufficient.

## 7. Boundaries

M11: no invoice or payment is created or changed (the billing event still records and matches no rule). M12: no HMO case, escalation or contact is created. M17: no conversation exists or is routed. M18: nothing is sent. M20: nothing is created. M21: checkpoint `6563e4c` intact (only a note label changed). M22: audit remains append-only; no sensitive payload added.

## 8. Tests

- `AutomationTruthfulnessTest` (new, 21 tests): every rule states evaluation only with none of the former false phrases; evaluating creates no invoice, conversation, inquiry, profile or treatment; historical text is unchanged but returned as evaluation-only; demonstration-threshold boundaries (11/12 h, 35/36 min); a missing or malformed observation is Failed, never 0; R4 flag reporting and the refusal of clinical and foreign fields (patient, actor, dentist, provider, HMO, payment, branch, invoice) on manual dispatch; per-rule observation validation including out-of-range and wrong types; the manual message and event (no email, actor = Owner); Owner-only with authorization before validation; the rate limit; health null / 100 / 50 / 33 / genuine 0; snapshot branch (legacy ref, ULID, `all`, 422 for numeric, unknown, other-ULID); duplicate event key and append-only; audit carries no event body; CSV `Execution` column; the billing event matches no rule.
- `BranchReferenceResolverTest` (new, 5 tests): the shared `Branch::fromPublicReference` resolver, refusals, uniqueness and unchanged branch binding/write authority.
- Existing `AutomationControlTest` (8) passes unchanged.
- `tests/m23-automation.test.js`: source assertions for "No data", no executed-action wording, unavailable state, no clinical flags sent, exceptions from the server only, header actions rendered.
- `scripts/m23-automation-browser-qa.mjs`: HTTP fixtures (not a live backend); Owner, Staff, Dentist, Patient at 375–1440.

## 9. Final-gate decisions

### 9.1 Registry (`src/data.js`, `MODULE_COVERAGE.md`)

The registry comment defines `coverage` as "what the frontend actually represents today" (`represented`, `partial`, `preview`, `planned`), and the M26 report records the working meaning of `implemented: true`: only where the canonical module is complete (M12, M13 and M19 have real server code yet are `partial` without it). M23 therefore moved from `coverage: 'implemented'`, `implemented: true` to **`coverage: 'partial'`, `implemented: false`**, with a note that rules are evaluated and recorded only, nothing feeds them, and thresholds are unconfirmed demonstration values. Number 23, name, owner (`Delos Santos, Joevan`), area and roles (`['owner']`) are unchanged; no new metadata value was invented. The `MODULE_COVERAGE.md` row now reads "Core / Partial (evaluation recorder)". M21 and M22 were not touched. The `.docx` process document was not opened; its M23 Implementation Status line should read: "Backend rule registry, immutable system events, recorded rule evaluations and Owner monitoring are in place. Rules are evaluated and recorded only; no business action is executed and no domain event feeds them yet. Execution of approved handoffs awaits clinic policy and domain commands."

### 9.2 Historical descriptions (API, Monitor, CSV)

Rows written before the correction have no `details.execution` marker and carry wording such as "Draft invoice created". Stored text is never rewritten (append-only). Projection: every action row has `execution: "evaluation_only"`, and each now has `summary_kind` — `legacy_proposed_description` for rows without the marker, `evaluation_result` for rows written by the corrected evaluator. In the Monitor a legacy row appears as "Legacy description of a proposed action (nothing was executed): “…”" with the note "this older wording is a proposed action, not evidence that anything was done", in both the activity table and the exceptions card. In the **CSV the qualification is inside the cell** — "[Legacy description of a proposed action; nothing was executed] <text>" — plus the `Execution` column. There is no detail endpoint. This is a labelling control, not tamper-proofing: a database administrator can still alter rows.

### 9.3 Shared Branch model

The only change to `app/Models/Branch.php` is the read-only static `fromPublicReference()`: a public ULID (case-insensitive) or the frozen `legacy_ref`; everything else — the internal numeric id, a wrong-case legacy ref, trailing spaces, a code or a name — returns `null`. It adds no write path and touches no existing binding; `legacy_ref` is unique in the database, so a lookup returns at most one row. `BranchReferenceResolverTest` (5 tests) covers resolution, refusal, ambiguity (a duplicate `legacy_ref` is rejected by the database), and confirms branch route binding and Owner-only branch writes are unchanged (numeric id still 404, Staff still 403). M21 keeps its own equivalent in `AnalyticsQueryRequest`; consolidating the two is a possible later cleanup, deliberately not done here.

### 9.4 Evaluation health

`health_rate` = recorded evaluations with status Success ÷ all recorded evaluations (Warning and Failed are in the denominator); `null` when there are none; a genuine 0 and 100 are preserved. It does not measure business-action execution or delivery. The API, the Monitor ("Evaluation health … nothing is executed") and the M21 note use the same wording; the CSV exports rows, not a rate. A failed request in a clinic-server session shows "unavailable" and "No data", with no demo fallback.

### 9.5 Duplicate manual dispatch

The endpoint has no idempotency contract: every request creates a new event (unique key) and a new evaluation, with or without an `Idempotency-Key` header (tested: four requests, four events). The UI posts once per click and disables the button while running; the only automatic client retry is the CSRF 419 retry, which happens before the handler runs and cannot create a row. The page says "Each run records a separate evaluation; a repeated run is not de-duplicated." That is truthful for independent diagnostic evaluations; a de-duplicating idempotent dispatch would be a future technical item, not added here.

### 9.6 R4 authority and manual-input strictness

Manual dispatch refuses `followup_required`, `prescription_required`, `dentist_id`, `treatment_id`, `treatment_status` and every other foreign field, **at the top level of the request as well as inside `payload`** (tested); the internal evaluator reports a caller-supplied flag only as unverified and non-executing and creates nothing. Observations are whole numbers only: the evaluator no longer truncates `1.5` or `1e3` (a non-integer observation is a Failed evaluation), and the form requires a value within the server's limits before the button enables. **Future gate (M20/M23):** authoritative clinical follow-up automation must resolve an actual Dentist-documented Treatment decision on the server; a payload value, rule or manual dispatch is never sufficient. Not implemented now.

### 9.7 M18 mail diagnostic (ownership and wording)

The "Clinic SMTP Mailer Diagnostics" card is rendered on the Automation Monitor page but is M18 mail transport (`MailDiagnosticController.php`). A returned `Mail::to()->send()` proves only that the configured transport accepted the message; with the `log` or `array` driver nothing leaves the server, and nothing proves provider acceptance, queuing or recipient delivery. The card says "Diagnostic Email Dispatched", "Test email sent to …" and "dispatched successfully" (`MailDiagnosticController.php:28,31–32`; `src/pages/Admin.jsx:432–433`). Not changed here (cross-module). Recorded as **TD-25** (ENGINEERING, M18) in the follow-up map. M18 is not declared complete.

### 9.8 Remaining technical and policy items

No event feeds the rules and nothing is executed; real execution needs approved policy (PI-24, PI-25, PI-28, PI-32 to PI-37, DQ-86), background infrastructure (TD-24) and domain commands in M11/M12/M17/M18/M20 that do not yet exist. The 12 h, 35 min, 80/80/75, 24 h and demo follow-up values remain unconfirmed demonstration values. The seeded `condition_description`/`action_description` text still reads as present-tense actions (the page labels it "Proposed action (not performed by this module)"; rewriting the seed needs a migration). The M10-era client estimators were not touched.

## 10. CodeRabbit

Three single (non-concurrent) reviews, all `coderabbit review --agent --uncommitted --include-untracked`, no autofix.

1. **First pass (12 files)** — 2 minor findings, both confirmed and fixed: a stale "still open" sentence in the follow-up map; the rule selector did not clear the observation input.
2. **Final-gate pass (15 files)** — 5 minor findings: (a) the section numbering/TD-25 citation pointed at a §9 that did not exist — **confirmed**: the final-gate section had been dropped; §9.1–9.8 now exist and TD-25 cites §9 (the companion suggestion to *also* renumber was contradictory and not applied); (b) the evaluator truncated `1.5`/`1e3` with `is_numeric` + `(int)` — **confirmed, fixed** (whole numbers only, otherwise a Failed evaluation); (c) manual dispatch ignored unexpected top-level fields — **confirmed, fixed** (422); (d) the form could submit a blank/out-of-range observation — **confirmed, fixed** (button disabled until valid; server remains authoritative); (e) the M18 mail diagnostic needed its own section — **confirmed, addressed** (§9.7).
3. **Last pass (15 files: `MODULE_COVERAGE.md`, `AutomationController.php`, `Branch.php`, `WorkflowAutomationService.php`, `routes/api.php`, the two Automation request classes, `AutomationTruthfulnessTest.php`, `BranchReferenceResolverTest.php`, `src/data.js`, `Admin.jsx`, `tests/m23-automation.test.js`, `scripts/m23-automation-browser-qa.mjs`, the follow-up map and this document)** — **0 findings.**

Not covered by any review: `tests/m21-analytics.test.js`/M21 files (unchanged by this pass), the rest of the repository, and the edits made to §10–12 of this document after the last review. A review reads a diff; it cannot see runtime behaviour. No finding is not proof of no defect.

## 11. Final verification

| Check | Result |
| --- | --- |
| Targeted M23 backend (`AutomationTruthfulnessTest` 21 + `AutomationControlTest` 8 + `BranchReferenceResolverTest` 5) | 34 passed |
| Full backend (`dental_clinic_test` only; includes M2, M11, M12, M20-related, M21, M22 suites) | 707 passed, 7,343 assertions (previous checkpoint: 681) |
| Targeted frontend (`tests/m23-automation.test.js`) | 11 passed |
| Full frontend | 767 passed |
| Render smoke | 16 groups, exit 0 |
| Production build | Passed |
| Browser QA | M23: 156 checks; M21 re-run: 161 checks — Owner/Staff/Dentist/Patient at 375, 430, 768, 1024, 1440, 0 px overflow, only the injected 500 console errors. **HTTP fixtures, not a live backend.** |
| `git diff --check` | Clean |
| Migrations | None added; none applied to `dental_clinic` |

## 12. Verdict

**M23 Truthfulness — B.** Results state what was evaluated and that nothing was executed; legacy descriptions are qualified in the API, the Monitor and the CSV cell; an empty history is "No data"; the registry reads partial / not implemented; manual dispatch is validated, Owner-only, rate-limited and cannot carry clinical or foreign fields. M23 itself is not hardened: it executes nothing, no event feeds its rules, and the thresholds are unapproved demonstration values.
