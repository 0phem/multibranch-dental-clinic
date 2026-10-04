# M2 production-readiness audit and hardening

Audit date: 2026-10-04, Asia/Manila. Base: `ba573e4790cea53635981b2ad84f10066692fda5`. Started on clean, synchronized `feature/m1-auth-premium-registration-ux`; created `feature/m2-multibranch-production-hardening`. No commit, push, merge, or M3 work.

## Evidence and decisions

**Interview facts:** Q2 supports three branches (two Bocaue, one Guiguinto); Q18 supports centralized multi-branch software; Q3 supports the Owner's management responsibilities. Names, addresses and coordinates below were separately supplied by the user and verified during the public-site pass. They are not inferred from interview answers.

**Explicit decision during this audit:** the mapping from operational b1/Branch A, b2/Branch B and b3/Branch C to the three public locations is **unconfirmed; defer reconciliation**. No ordering, geographic proximity or placeholder address has been treated as proof of that relationship. No operational branch row, reference, personnel assignment or history was relabeled or moved.

**Project rules, not interview policy:** existing Owner-only branch updates; the Open/Temporarily Closed/Inactive state vocabulary; same-day opening-before-closing validation; existing M6/M8 operating checks. These are preserved. No new delegation, hours, holiday, capacity or activation rule was invented.

## Architecture and source-of-truth inventory

| Source | Actual role / authority |
| --- | --- |
| PostgreSQL `branches`, `Branch` model | Sole live operational branch catalog; bigint PKs underpin FKs |
| `BranchController`, `BranchResource`, `UpdateBranchRequest` | Authenticated reference projection and existing Owner-only update |
| `src/reference-data-bridge.js`, `src/store.jsx` | In-memory server projection; loading/error gates; no persisted branch-catalog fallback |
| `BranchSeeder` | Development-only illustrative b1/b2/b3; refuses production; not a production bootstrap |
| `src/data.js` `INITIAL_BRANCHES` | Illustrative fixtures and historical compatibility inputs; not live catalog bootstrap |
| `src/contracts.js` `branchIdFor`, normalization | Existing name-to-legacy-ID compatibility for old local records; explicit IDs take priority; missing canonical display resolves to Unknown branch, not the first branch |
| `src/clinic-config.js` | Approved public location presentation facts only; never operational scope or scheduling authority |
| `scripts/*qa*`, tests and render-smoke reference injection | Isolated fixtures; no live clinic records |
| Remaining local historical collections and `ROLE_INFO` | Prototype compatibility for unmigrated modules / explicit M1 demo identity bridge; not backend authorization |

Live selectors consume `state.branches`, populated by the API. `activeBranch` is React presentation state. Staff authorization comes from `user_branch_scopes`; Staff/Dentist operational assignment is separate. The Owner's selected display filter does not remove Owner backend visibility. Existing hardcoded Branch A names remain in demo accounts/profiles, saved-history compatibility, and the older Patient form defaults; these are not safely relabeled while the mapping is unconfirmed. Their migration remains follow-up work.

## Actual operational records before and after this pass

Read-only inspection of local `dental_clinic` found:

| Legacy reference | Technical code | Name | City | Existing address | Existing hours | Existing phone | Existing threshold |
| --- | --- | --- | --- | --- | --- | --- | --- |
| b1 | BRC-A | Branch A | Bocaue | Main clinic • Bocaue, Bulacan | 09:00–18:00 | (02) 8123 1001 | 80 |
| b2 | BRC-B | Branch B | Bocaue | North clinic • Bocaue, Bulacan | 09:00–18:00 | (02) 8123 1002 | 80 |
| b3 | BRC-C | Branch C | Guiguinto | South clinic • Guiguinto, Bulacan | 10:00–19:00 | (02) 8123 1003 | 75 |

All three had Open status and null coordinates. These are **prototype configuration**, not approved location identities, phone numbers, clinic hours or capacity policy. The local non-test database was not migrated or seeded during this pass. The new schema migration was exercised only on `dental_clinic_test`.

## Approved public location records (unchanged)

| Public presentation ID | Name | Exact supplied address | Latitude | Longitude |
| --- | --- | --- | --- | --- |
| bocaue-37 | Dr. Dana Roxas Dental Clinic | #37, MacArthur Hwy, Bocaue, 3018 Bulacan | 14.800254 | 120.9233274 |
| bocaue-cardinal | Roxas - Cardinal Dental Center | 67 MacArthur Hwy, Wakas, Bocaue, 3018 Bulacan | 14.7996762 | 120.9234564 |
| guiguinto-gd-plaza | Roxas Dental Clinic Guiguinto | Unit 20 GD Plaza, Guiguinto, Bulacan | 14.8284409 | 120.8745988 |

Source records and map cross-check evidence: `docs/PUBLIC_AUTH_LOCATIONS_REFINEMENT.md`. No new coordinate claim or runtime geocoding was introduced.

A public M2 endpoint is deliberately **not** exposed: unresolved operational identity mapping makes publishing those rows misleading. The static public projection remains independent of API outages, contains no rosters/scopes/capacity/internal IDs, and retains semantic address cards when tiles fail. It is explicitly not a second operational authority. Reconciliation later requires an approved row-to-location mapping, then an idempotent update of existing rows without changing PKs/FKs. Do not insert three additional rows alongside referenced legacy rows.

## API and access matrix

| Endpoint | Guest | Patient | Staff | Dentist | Owner |
| --- | --- | --- | --- | --- | --- |
| GET `/api/branches` | 401 | Catalog | Catalog | Catalog | Catalog |
| GET `/api/branches/{reference}/services` | 401 | Catalog | Catalog | Catalog | Catalog |
| PATCH `/api/branches/{reference}` | 401 | 403 | 403 | 403 | Existing update permission |
| Create/delete branch | No endpoint | No endpoint | No endpoint | No endpoint | No endpoint |
| Public M2 branch endpoint | Not implemented | — | — | — | — |

M1 Active-account/session checks continue before these routes. Existing reference `id` remains the nonnumeric `legacy_ref` for compatibility under CONTRACTS §1. An additive `public_id` ULID is now projected. Branch route binding accepts the public ULID or the established legacy key; numeric PKs and unknown references return 404. This is **not** a full downstream ULID cutover. No shared contract file was rewritten.

Responses retain `{data: ...}`. Validation returns 422; Owner scope is enforced by middleware. No optimistic revision contract existed, so no new 409/stale-editor policy was fabricated. Writes lock the current row to validate effective hours and atomically save/audit; multiple valid concurrent edits still use existing last-writer semantics.

## Findings and implemented fixes

1. Branches had no stable public ULID. The forward-only migration adds a unique non-null `public_id`, backfills existing rows without renumbering, and new model-created rows receive a ULID. The legacy bridge stays intact.
2. `branch_code`, `legacy_ref` and the new `public_id` remain unique. The pre-existing name constraint is retained temporarily because some downstream selectors and historical normalization still use names. Final review rejected removing it before those consumers migrate: duplicate names could make selection ambiguous. This is a compatibility constraint, not a new clinic naming rule; it should be removed only with an ID-based consumer cutover. No branch creation endpoint is added, and identifier uniqueness is not a claim that arbitrary direct SQL cannot duplicate a physical location.
3. A PATCH changing only opening time could leave opening after closing; changing closing alone did not validate against stored opening. The controller now locks the row and compares the effective pair before any write. Existing same-day policy is unchanged.
4. Branch changes were not emitted to M22. Actual changes now produce `branch.updated`, with public target, branch context and changed field names only, inside the update transaction. Audit failure rolls back the edit; a repeated identical status update emits no second event. No fabricated creation/closure events.
5. Successful but malformed reference responses could throw during mapping and leave bootstrap stuck. Shape/duplicate-identity checks return an unavailable result; unexpected bootstrap exceptions reach the error screen. No demo data is substituted. Existing retry recovers.
6. The obsolete local `saveBranch` command now refuses server-authenticated sessions. The live Owner form already calls the server and adopts only its confirmed result.
7. The Owner form no longer invents 09:00/18:00/80 defaults for missing values, refreshes its draft when the selected canonical record changes, and clearly discloses unconfirmed hours/phones/capacity. Patient branch choices no longer advertise prototype opening times as clinic facts. No layout redesign or map change.
8. The authenticated branch resource labels operating data `unconfirmed`. This is conservative provenance, not a confirmation/approval workflow; editing configuration does not turn it into verified clinic policy. Public IDs/provenance/coordinates remain protected from client injection.

## Database and cross-module integrity

Read-only FK inspection confirmed RESTRICT references from branch-services, Staff assignments, Dentist assignments, M1 authorization scopes, appointments/history, Visits, Dentist queues, service prices, invoices and HMO cases. Documents, audit logs and system events currently use SET NULL. No branch delete API exists. Their retention policy was not changed.

M6 resolves legacy branch references to canonical rows, checks status/services/hours/Dentist eligibility, and applies Staff scope/Patient ownership server-side. M8 walk-in admission uses actual branch rows and status/hours; scheduled Visit creation derives branch from its Appointment. The existing scheduled Check-In command checks appointment state/revision, clinic date and active-Visit uniqueness, but does not re-check branch Open status. The clinic must define how branch unavailability affects already-booked arrivals; this pass does not silently introduce that lifecycle policy. M9 allocates queue containers from Visit branch/Dentist/date and keeps one queue entry per Visit. Treatment follows Visit context. Billing/HMO/pricing reference actual branch rows. Tests exercise branch isolation and cross-branch manipulation. Historical reads are not removed merely because a branch becomes inactive.

No closure/holiday infrastructure exists in these M2/M6 checks; no Philippine holiday calendar or implicit closure was added. M6/M8 still depend on unconfirmed operating data: this is a production blocker, not a claim that passing regression tests proves approved clinic schedules.

**Downstream issue documented, not silently fixed:** M21's AnalyticsController casts `branch_id` to bigint, while the frontend sends legacy branch IDs; the analytics service also emits internal numeric branch IDs. That is a remaining branch-reference compatibility defect. Its aggregates and prototype capacity assumptions require the responsible module's follow-up; this M2 pass does not rewrite analytics. Other remaining legacy/local projections need deliberate compatibility migration alongside identity reconciliation. Do not treat selected browser branch state as authorization.

## Verification

- M2/reference API suite: **43 passed / 194 assertions**.
- M6/M8/M9 regression and branch authorization: **119 passed / 910 assertions**.
- Targeted frontend reference/public-location suite: **29 passed**.
- Full backend: **363 passed / 3,061 assertions**.
- Full frontend: **686 passed**, zero failures/skips.
- Smoke: **16 passing groups**.
- Production build: **PASS**, initial JS 454.74 kB / 138.78 kB gzip; map remains deferred. No dependency changes.
- Browser: **151 checks passed**, zero unexpected runtime/console errors; overflow **0px** at 375, 430, 768, 1024 and 1440 for public/Patient/Staff/Dentist/Owner views. A separate public-console check at the same widths recorded zero unexpected errors; expected signed-out 401 and deliberately blocked tile requests were excluded.
- `git diff --check`: **PASS**.

Backend TestCase checks configured and connected database name before RefreshDatabase; concurrency children similarly restrict execution to `dental_clinic_test`. No destructive operation was performed against `dental_clinic`. New tests cover stable ULIDs/route binding/numeric refusal, effective partial hours, audit atomicity/idempotent status changes, protected coordinates, provenance, public-identity uniqueness and legacy name compatibility, malformed catalogs and obsolete local writes. Existing tests remain.

Resume audit confirmed the complete backend/frontend/smoke/build logs postdate the relevant changes. Completed frontend/smoke/build results were reused. Final review retained legacy name uniqueness and reran the affected/full backend suites. Interrupted browser verification was rerun against the production preview at `http://127.0.0.1:5185/`.

Browser harness: `scripts/m2-branch-browser-qa.mjs`, using installed Chrome via externally installed Playwright. HTTP fixtures exercise all four role shells, Owner branch selection, Staff/Dentist branch visibility, reference error/retry, and public branch cards/map failure at 375/430/768/1024/1440. The final harness explicitly waits for branch form updates and lazy-loaded route headings before screenshots/assertions; earlier timing-related harness failures were resolved without frontend changes during the resume. Patient branch choices, the Owner form, Staff Check-In and Dentist queue renders were inspected. Tile failure preserves all three named/addressed cards and numbered markers, and the map retains pointer-events:none. It does not create live accounts, change operational records, or claim fixture tests establish server authorization. Backend tests cover authorization. Screenshots/results are outside Git in `/tmp/m2-browser/`.

## Intentional non-changes and production blockers

**Verdict B — not production-ready.**

1. **Operational-to-public identity reconciliation is explicitly deferred.** The three approved location identities cannot safely replace Branch A/B/C until their mapping is confirmed. This blocks a truthful unified operational/public projection and production branch bootstrap.
2. **Hours and closure data/policy are unconfirmed.** Prototype times remain for compatibility, visibly disclosed; M6/M8 consume them. Weekday schedules, holiday/temporary closure decisions and branch-status transition effects require clinic decisions.
3. **Production branch-management/delegation policy is unconfirmed.** Existing repository Owner-only updates are retained; no broader Staff rights or new mutation workflow is granted.
4. **Downstream migration remains:** legacy branch keys and local historical projections, M21 numeric-reference mismatch, and unconfirmed capacity assumptions prevent claiming end-to-end branch authority is complete. No M3 personnel redesign, M10 capacity calculation or M15 configuration subsystem was started.

The two M1 provisioning/activation and privileged identity-projection blockers remain unchanged. No activation/password/invitation flow, canonical role, assignment or authorization scope was changed.

## Minimum follow-up questions

- Which exact existing b1/b2/b3 row and its historical records belongs to each supplied public location?
- What are each branch's normal hours by weekday, and which current operational values should be replaced?
- Who decides and records temporary closures/special opening dates? Are holidays decided individually?
- Who may edit branch identity, operating data and status? Is any Staff delegation intended?
- What should happen to existing future appointments and active Visits when a branch becomes unavailable?
- Can Staff/Dentists work across branches, and how should operational assignments differ from authorization scope? (M1/M3 follow-up; no policy invented here.)
- Are there approved branch-specific capacity/business rules? If absent, retain them as unresolved M10/M15 inputs.

## Implementation-status wording

M2: “Server-authoritative operational branch reference catalog with additive public ULIDs, preserved legacy/FK integrity, Owner-bound validated and audited updates, and fail-visible frontend loading hardened. Approved public locations remain separate pending confirmed historical branch mapping. Operating hours, closures, production management policy and downstream reference migration remain unresolved; Verdict B.”

M6/M8/M9 business behavior is unchanged; M22 receives real branch-update events through its existing service. M1 remains Verdict B. No process `.docx` or shared contract was edited.

## Changed-file inventory and deployment

- `backend/app/Http/Controllers/Reference/BranchController.php`
- `backend/app/Http/Requests/Reference/UpdateBranchRequest.php`
- `backend/app/Http/Resources/Reference/BranchResource.php`
- `backend/app/Models/Branch.php`
- `backend/database/migrations/2026_10_10_000100_add_branch_public_identity.php`
- `backend/tests/Feature/Reference/BranchHardeningTest.php`
- `docs/M2_PRODUCTION_HARDENING.md`
- `scripts/m2-branch-browser-qa.mjs`
- `src/administration.js`
- `src/pages/Admin.jsx`
- `src/pages/PatientBook.jsx`
- `src/reference-data-bridge.js`
- `src/store.jsx`
- `tests/reference-data-bridge.test.js`
- `tests/safeguards.test.js`

15 intended files (11 modified, 4 new), unstaged. No environment files, secrets, screenshots, generated build output or database files are included. The additive public-ID migration must be applied before deploying the changed model/API; it was not applied to the non-test database. Branch reconciliation remains a separate approved data operation, not a side effect of this migration.
