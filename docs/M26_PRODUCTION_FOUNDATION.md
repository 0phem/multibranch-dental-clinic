# M26 — Patient Feedback & Service Quality: production foundation

Branch `feature/m26-feedback-production-foundation`, from `12f6824` (M17 checkpoint). Uncommitted. **Verdict B.** This is a deliberately **narrow, Patient-only technical foundation**, not a mature module. M26 stays a Group 3 shared enhancement (never a PE) with `implemented: false`; its `coverage` moved `planned` → `partial` and `roles` `[]` → `['patient']` because code now exists (see §46).

## 1. Starting git state
Clean, synchronized tree on `feature/m17-patient-messaging-production-hardening` at `12f6824`; new branch created from it. No merge to main.

## 2. Repository evidence found (read-only audit)
No M26 implementation existed under any name: no table, route, UI, localStorage collection, demo feedback, rating, survey, testimonial or satisfaction metric (searched feedback/review/rating/satisfaction/complaint/survey/testimonial/service quality across code, tests, scripts and docs). The only M26 evidence is documentation and registry metadata:
- `MODULE_COVERAGE.md` M26 row and `CLAUDE.md`/`AGENTS.md`/`CLAUDE_OPERATING_MODE.md`: M26 is an approved (October 4, 2026) Group 3 shared enhancement, "Owns authoritative Patient feedback/service-quality records tied to legitimate completed Visits", "Not a conversation (M17), not a transactional notification (M18) and not analytics (M21 only consumes aggregates)"; and an **"Intended lifecycle: completed Visit → eligible Patient feedback → rating/category/comment → New → Owner review → Reviewed or Action Required → resolution where appropriate → Resolved → aggregate service-quality data consumed by M21."**
- `src/data.js` / `module-map.js`: registry entry and domain key `feedback` (metadata only).
- `ERD_v2_Data_Dictionary.md`: an older `PATIENT_FEEDBACK | PE feedback record | Optional; not a core clinical requirement` row (pre-M26, PE wording).
- Clinic interview Q21 (most common complaint: long waiting time) is evidence that complaints exist, not of any feedback process.

## 3. A/B/C/D evidence classification
| Rule | Class | Basis |
|---|---|---|
| M26 exists as Group 3 shared enhancement; name, key, area Quality, planned/not implemented | **A** | registry + canonical docs |
| M26 owns authoritative Patient feedback records "tied to legitimate completed Visits" | **A (ownership text) — "legitimate" undefined** | MODULE_COVERAGE.md M26 row |
| Eligibility = the Patient's own completed Visit | **C** (derived from the ownership text, not a frozen rule) → **POLICY / PRODUCT DECISION REQUIRED** | implemented as the narrowest technical eligibility |
| One feedback per Visit | **D** | nowhere stated |
| Rating / scale | **C** ("rating/category/comment" in the intended lifecycle, no scale) | omitted |
| Categories | **C** (word only, no list) | omitted |
| Free-text comment | **C/A-adjacent** ("comment" in the lifecycle) | implemented (the one content field) |
| Anonymity | **D** | not offered; ownership is authenticated |
| Workflow states New/Reviewed/Action Required/Resolved | **C** ("Intended lifecycle") | not implemented |
| Owner review | **C — intended-lifecycle text only** ("Intended lifecycle: … → Owner review → …"); no current canonical contract grants Owner access | **NOT implemented — Owner fails closed (pre-checkpoint gate)** |
| Staff / Dentist visibility | **D** | fail closed |
| Reply / resolution / service recovery | **D** | none |
| Aggregation for M21 | **C** | no analytics built |
| Publication / testimonial / marketing use | **D** | none; never exposed |
| Prior prototype/demo behaviour | **B: none exists** | – |

## 4. Architecture implemented
`patient_feedback` (public ULID, Patient, Visit, free text ≤ 2000 chars via API / 4000 DB, server timestamp) with an **immutability trigger**; `POST /feedback`, `GET /feedback/mine`, `GET /feedback/eligible-visits` (Patient); `GET /feedback` (alias of `/mine`). **No reviewer endpoint, resource or page exists.** Patient screen "Share feedback" (clinic-server sessions only).

## 5. Authority before/after
Before: nothing. After: Laravel/PostgreSQL is the only authority; the browser stores nothing and no demo or local feedback exists to isolate.

## 6. Patient ownership
The Patient is the authenticated account (`$user->patient`); `patient_id`, `user_id`, `author` and every similar field are refused (422). A Patient reads only their own submissions.

## 7. Eligibility rule and provenance (gate-verified)
Exact current wording (`MODULE_COVERAGE.md`, M26 row): the **"Important boundary"** column states "Owns authoritative Patient feedback/service-quality records **tied to legitimate completed Visits**" — a current canonical architecture statement of what M26 owns (class A). The same row's "Current capability" column holds the "**Intended lifecycle**: completed Visit → eligible Patient feedback → …", which is intended/proposed text (class B). Nothing historical contradicts it. **Preserved:** the feedback is tied to a Visit that belongs to the authenticated Patient and is **Completed** (the Visit is read-only to M26). **CANONICAL TECHNICAL ELIGIBILITY = completed Patient-owned Visit.** What "legitimate" means is implemented only as *authoritative ownership + completion*; every other meaning is **unresolved policy, not clinic policy**: one feedback per Visit vs several, a time window after completion, whether every completed Visit is eligible, and any exclusion rules. A foreign, unknown, malformed or unfinished Visit gives one identical refusal (`visit_not_eligible`/422), so nothing about another Patient's care leaks.

## 8. Visit relationship
Read-only. The command locks and reads the Visit; it never changes any Visit, Treatment, Appointment, Dentist or branch (tested: the Visit's status/revision and Treatment are unchanged). The Patient picks a Visit from `GET /feedback/eligible-visits`, which shows only the Visit's public id, clinic date and the performed service names (the same safe subset already visible in their treatment history) — no Dentist, branch, appointment or clinical text.

## 9. Duplicate-feedback behaviour
No one-per-Visit rule is established, so **none was invented** (no uniqueness on `visit_id`; tested). Network retries are protected by the shared `Idempotency-Key`: same key + same body replays the stored record, same key + different body → 422, a new key (even with identical text) is a separate submission. A double-submit race with one key stores one record; three racing submissions with different keys are all kept (real-process tests, repeated 3×, stable). The UI keeps the text and the same key after a failure, so **Try again cannot store it twice**.

## 10. Content model
Plain text only: required, 1–2000 characters, control characters refused, no HTML, no attachments, no link previews or fetches. Stored and returned verbatim as data and rendered as React text (browser-verified inert). It is user-supplied text, never a clinical record: nothing is copied into M4/M5. The Owner **list** shows a 140-character excerpt; the full text is the detail view.

## 11–13. Rating / category / anonymity status
**No rating, score, NPS or stars; no categories; no anonymity** — none is established. The Patient screen says: "Your feedback is saved with your account — it is not anonymous." The tables have no such columns (tested).

## 14. Immutability / edit / delete
Submitted feedback is immutable: no edit/delete route (405), and a database trigger refuses model, builder and raw-SQL updates and deletes; every foreign key is `RESTRICT`, so deleting the Visit or Patient is refused. Whether a Patient may correct or withdraw feedback is a policy question (none invented).

## 15. Role/access matrix (final)
| | Guest | Patient | Staff | Dentist | Owner |
|---|---|---|---|---|---|
| submit / own list (`GET /feedback`, `/mine`) / eligible visits | 401 | allowed (own only) | 403 | 403 | 403 |
| any feedback text of another person | – | no | no | no | no |
| edit / delete / reply / status / publish / review | no endpoint | – | – | – | – |

## 16. Management-review behaviour (final)
**Owner authority evidence audit.** Searched `MODULE_COVERAGE.md`, `CONTRACTS.md`, the registry (`data.js`/`module-map.js`), `AGENTS.md`/`CLAUDE.md`/`CLAUDE_OPERATING_MODE.md`, the ERD data dictionary and `ERD_ALIGNMENT.md` for any Owner (or other) access to feedback. The **only** occurrence is "Owner review" inside the *Intended lifecycle* chain (class B/C: proposed design, explicitly labelled "Intended", in a module marked "Planned; not implemented"). No current canonical contract, role table or boundary statement grants it. **Decision: Owner access was removed** — the Owner list/detail endpoints, resource, navigation entry and page no longer exist, and the Owner dashboard never carried a feedback surface. Owner, Staff, Dentist and guests all fail closed (403/401); no substitute reviewer was invented. Reason: feedback can contain complaints, health information and staff references, so reviewer visibility is an authorization decision that an unapproved design note cannot make. A reviewer will be added when the clinic approves who reviews.

## 17. Workflow-state behaviour / provenance
None. New/Reviewed/Action Required/Resolved appear only as an "Intended lifecycle" (class C), so a submission stays a factual record until policy is approved. No state machine, no review command.

## 18–21. Module boundaries
M17: no reply and no conversation is created; the Patient screen tells the Patient that this form does not start a conversation and to use Messages (tested: conversation/inquiry rows unchanged). M21: no analytics, score or trend (nothing is aggregated); the record is simply factual data a future aggregate can read. M22: no events, deliberately — the immutable record is the domain fact and M22 must not become a feedback-text archive (tested: no audit rows). M25/marketing: no consent, publication, testimonial or public-use field exists and the feedback is never exposed publicly (tested absent).

## 22. Privacy / logging
The Patient's own projections carry only the Visit's public id, date and service names, the text and the timestamp; no internal ids, no Dentist, no branch, no clinical text (tested: a Treatment's clinical summary never appears). No other person can read feedback text. Feedback text is never logged (tested). A Patient sees only their own rows.

## 23. Pagination
Keyset, newest first by serial id, `per_page` 1–100 (default 25; eligible visits 1–50), public-id cursor looked up inside the Patient's own set (a foreign or unknown cursor returns an empty page and reveals nothing), malformed input → 422. The screen offers "Load older …" with a recoverable "unavailable — Retry" and states "That is all of them" only at the end. No filters exist (no rating/category/status to filter by).

## 24–26. Idempotency, concurrency, IDOR / mass assignment
See §9. Tests cover numeric/malformed/unknown ids (404), Patient A against Patient B's Visit, a foreign cursor, every non-Patient/non-Owner role, and refusal (422) of `id`, `public_id`, `patient_id`, `user_id`, `author`, `reviewer`, `review_status`, `status`, `branch_id`, `dentist_id`, `rating`, `stars`, `nps`, `category`, `anonymous`, `publish`, `public`, `testimonial`, `testimonial_consent`, `marketing_consent`, `resolved_at`, `created_at`, attachments and HTML. A Completed Visit cannot change state, so there is no eligibility race to test. Submission is rate-limited per **account** at 5/minute and 30/hour (`config/feedback.php`) — a **technical abuse safeguard, not a clinic feedback-frequency policy**; a multi-instance deployment needs a shared cache store (the default `database` store is shared).

## 27. Dashboard / demo findings
No dashboard, analytics or home screen mentioned satisfaction, feedback, complaints or ratings, and none was added (tested). There is no demo feedback to isolate. The M26 registry note was corrected from "no tables, routes or UI exist" to a truthful "foundation only … NOT a mature module".

## 28. Schema
New forward-only migration `2026_10_17_000100_create_patient_feedback_table.php` (not applied to `dental_clinic`; tests on `dental_clinic_test`).

## 29–30. Files and tests
Backend: migration, `PatientFeedback`, `FeedbackService`, `FeedbackController`, `PatientFeedbackResource`, `FeedbackVisit`, `SubmitFeedbackRequest`, `config/feedback.php`, `routes/api.php`, `AppServiceProvider` (limiter), tests `FeedbackTest` (10) and `ConcurrentFeedbackTest` (2). Frontend: `api-client.js`, `feedback-api.js`, `pages/Feedback.jsx`, `App.jsx`, `layout.jsx`, `safeguards.js`, `data.js`, `MODULE_COVERAGE.md`, `tests/m26-feedback.test.js` (8), `tests/public-auth-site.test.js` (lazy-page count 26 → 27), `tests/module-map.test.js`, `ERD_ALIGNMENT.md`, `scripts/m26-feedback-browser-qa.mjs`.

## 31–39. Results
Superseded by the final gate run in §45 (earlier run, with an Owner read-only list that has since been removed: 661 backend / 755 frontend / 120 browser checks); browser QA, 0 failures, 0 errors, 0 px overflow (Patient/Owner/Staff/Dentist × 375/430/768/1024/1440: own history only, inert malicious text, older-page failure + Retry, duplicate-safe retry with the same Idempotency-Key, rate-limit state, no response-time/anonymity/rating/category/publication claim, Owner read-only with no review actions, Staff/Dentist have no entry, no fabricated dashboard metric); `git diff --check` clean.

## 40. Unresolved clinic questions (not answered)
1. Must feedback be tied to a completed Visit (implemented only as a narrow technical reading)? 2. One feedback per Visit or several? 3. Should feedback include a rating, and on what scale? 4. Should categories exist? 5. Who reviews feedback (the Owner is NOT assumed)? 6. May Staff see it? 7. May Dentists see feedback about themselves or their Patients? 8. May the Owner respond? 9. Should Patients see review/resolution status? 10. Which statuses should exist? 11. What makes feedback "Action Required"? 12. Is there an SLA or escalation rule? 13. May feedback start an M17 conversation? 14. May submitted feedback be edited or deleted? 15. Retention period? 16. May any feedback become a public testimonial, and with what consent? 17. Which metrics should M21 aggregate? 18. Should branch/Dentist/service attribution appear in quality reporting?

## 41. Remaining blockers
Eligibility and multiplicity policy; rating/category/status/review workflow and Action Required rules; reviewer role and access for Owner, Staff and Dentist (all undefined, so none exist); response/service-recovery and any M17 handoff; correction/withdrawal; retention; publication/consent; M21 metric definitions; the Patient has no way to see a review status (none exists).

## 45. Registry, coverage document and legacy-PE reconciliation (pre-checkpoint gate)

**Registry field semantics (derived from the other entries and their consumers, not guessed).** `coverage` takes the existing values `planned` ("defined but not yet built" — MODULE_COVERAGE.md legend), `partial` ("materially narrower representation than the canonical scope") and `implemented`; M12, M13 and M19 are `partial` although they have real server code. `implemented: true` appears only where the canonical module is complete (M21, M22, M23, and M24's prototype); partial modules carry no `implemented: true`. `roles` lists the roles that use the module under its authorized boundary (M13 `['owner']`, M12 `['patient','staff','owner']`).
**Result for M26:** `coverage: planned` was stale ("not yet built") — now `partial`, an existing value, matching the M12/M13/M19 precedent; `implemented` **retained `false`** because the canonical module (review workflow, rating/category, resolution, aggregates) is nowhere near complete; `roles` `[]` → `['patient']`, the final authorized boundary (Owner is **not** listed because Owner authority did not survive the gate); `area`, `owner` and the not-a-PE facts are unchanged, no new enum value was invented, and the `coverageNote` says exactly what exists. The module-map tests were updated deliberately.
**MODULE_COVERAGE.md:** the stale "Not built: no tables, routes or UI exist" claim is replaced by an "Implemented foundation / Not implemented and not approved" split, and the lifecycle is labelled "unresolved design, NOT built". The intended lifecycle was not rewritten as completed.
**Legacy "PE feedback record":** the only occurrence is the row `PATIENT_FEEDBACK | PE feedback record | Optional` in `docs/architecture/ERD_v2_Data_Dictionary.md`, a protected ERD artifact (CLAUDE.md: "Do not alter the ERD without explicit approval"; ERD_ALIGNMENT.md: "The ERD artifacts are unchanged") written before the October 4, 2026 canonical structure. It was **not rewritten**; instead `ERD_ALIGNMENT.md` (the current alignment document) now records the conflict as reported-not-silently-resolved: that wording is historical, the canonical architecture defines M26 as a shared enhancement and **not** a PE, and this note supersedes it for current work. No registry, UI or runtime logic marks M26 as PE (tested).

**Unchanged and re-confirmed:** no one-per-Visit uniqueness (none canonical); idempotent submission (same key + same body replays, same key + different body 422, a new key is a new submission); immutable submissions (no PATCH/DELETE, database trigger, RESTRICT keys) — CORRECTION / WITHDRAWAL POLICY REQUIRED; no M25 coupling, no public endpoint, no M17 conversation, no M21 metric, no M22 event. **Rate-limit deployment requirement:** the 5/minute and 30/hour per-account limiter (values unchanged, a technical abuse safeguard, not a feedback-frequency policy) uses Laravel's cache; as for M7 and M17, a multi-instance production deployment must run every instance against one shared cache store (the default `database` store is shared), otherwise each instance counts separately.

**Final verification (gate, final tree):** Feedback 12 tests / 202 assertions (concurrency tests re-run, stable); cross-module Visits 25, Patients 31, Messaging 22, Audit 40 pass; **full backend 661 passed / 6,799 assertions**; frontend **755 passed** (m26 file 8); smoke 16 groups; build passes; browser QA **100 checks**, 0 failures, 0 errors, 0 px overflow, verifying the FINAL matrix (Patient flow works: own history only, inert text, older-page failure + Retry, duplicate-safe retry, rate-limit state; Owner, Staff and Dentist have no feedback navigation and never load feedback; no Owner feedback counter or metric); `git diff --check` clean.

## 42. Verdict
**B.** All technical criteria for the narrow foundation are met, and no clinic policy was invented; the core M26 workflow remains unapproved.
