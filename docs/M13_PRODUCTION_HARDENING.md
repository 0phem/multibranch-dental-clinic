# M13 — Service, Procedure & Pricing: production hardening

Branch `feature/m13-pricing-production-hardening`, created from `a7bdb39` (M5 checkpoint). Uncommitted. **Verdict B.**

## 1. Starting git state
Clean, synchronized tree on `feature/m5-treatment-production-hardening` at `a7bdb39`; new branch created from it. No merge to main.

## 2. Architecture discovered (read-only audit)
- `services` (Phase 2A reference table): `legacy_ref` (transitional string id, frozen by CONTRACTS.md §1 for services/branches/profiles), unique `code`, name, `duration_minutes`, `reference_fee_php` (reference/demo, explicitly never a price), category, `status`. **Read-only API** (`GET /services`, `GET /branch-services`); the only service-related write is the Owner `POST /branch-services` availability toggle. There is no endpoint to create, edit or deactivate a Service definition.
- `service_prices` (M13 foundation): append-only, Owner-confirmed, effective-dated versions; `numeric(12,2)`; `kind` priced|ended; nullable `branch_id` = base level; `public_id` ULID; partial unique index "one non-retracted version per service+level+date" (NULLS NOT DISTINCT); CHECKs (priced ⇔ amount > 0, source owner_confirmed, retraction pair); trigger forbids DELETE and every UPDATE except a one-time retraction.
- `PriceResolver`: latest non-retracted branch version ≤ date (priced → it; ended → base) → latest base ≤ date → unavailable. Never reads `reference_fee_php`, never another branch, never a guess. `PricingService`: `create` (today-or-future Manila date, branch must offer the service, idempotent) and `retract` (only a not-yet-effective version, under row lock). M11 consumes the resolver using the Treatment's Visit `clinic_date`.
- Frontend: Owner "Services & Pricing" page (`pricing-api.js`) uses decimal strings only, no arithmetic, loading/error/Retry, versions labelled In effect / Scheduled / Superseded / Retracted, amount field never pre-filled from the reference fee.

## 3–5. Service authority, lifecycle, identity
Authority: one server catalog. Lifecycle: `status` (Active/…); no deactivate endpoint exists, nothing is hard-deleted (price and Treatment FKs are `restrictOnDelete`), historical Treatment lines snapshot code/name. **Identity finding (not changed):** Service has no `public_id`; it is exposed by the frozen transitional `legacy_ref`. Adding a Service ULID is a shared-contract change (CONTRACTS.md §1) that touches every module and the frontend and needs team review — recorded as a blocker, not done here. Internal bigint ids are never exposed.

## 6–8. Pricing authority, decimals, versioning
Pricing authority is solely `service_prices`; the model, resource and resolver return decimal strings; PostgreSQL does arithmetic (`19.99 × 2 = 39.98`, `0.29`, `999.95` tested end to end); JSON numbers, exponents, >2 decimals, negatives, zero and malformed text are 422. A change is always a NEW version; existing rows are immutable (DB trigger, tested); only a future version can be retracted once.

## 9. Effective-date semantics
Business dates are Asia/Manila. New test freezes the clock at 16:30 UTC (= 00:30 next day in Manila): "today", the default resolve date, the not-in-the-past rule, the immediate-effect/no-retract rule and Staff's today-only view all follow Manila; exactly-on-date applies, the day before is unavailable.

## 10. Overlap and concurrency
The per-level/date unique index makes ambiguous overlap impossible; "latest effective_from ≤ date" resolution is deterministic. Real-process races: two creates same level/date → 201 + 409 (existing); **new:** retraction of a future version racing creates of a later version and a same-date version → outcomes are always consistent (never two live versions on one level and date). **Hardening:** the branch-offering check in `create` now locks the `branch_services` row, closing the check-then-insert window against an availability change.

## 11–12. Branch/base resolution and historical integrity
Confirmed deterministic and fallback-free (existing resolution test extended by the M11 parity test: M11 invoice lines equal the resolver for branch-override and base prices, `19.99×2`, `125.55×2`; a date before the first version gives an explicit 422 and no invoice). A later version never changes an existing invoice (existing M11 test) and old dates still resolve old versions (new test).

## 13. Authorization matrix (unchanged, verified)
| Action | Guest | Patient | Dentist | Staff | Owner |
|---|---|---|---|---|---|
| list services / branch offerings | 401 | read | read | read | read |
| create/edit/deactivate service | no endpoint | – | – | – | – |
| toggle branch offering | 401 | 403 | 403 | 403 | write |
| resolve current price | 401 | 403 | 403 | own-branch, today only | any branch/date |
| price history / list versions | 401 | 403 | 403 | 403 | read |
| create / schedule price version | 401 | 403 | 403 | 403 | write |
| end price (kind=ended) / retract future version | 401 | 403 | 403 | 403 | write |
Who approves price changes, and whether Staff may change prices, are policy questions (§36); the safest existing authorization (Owner only) is kept.

## 14–15. Branch scope, IDOR, mass assignment
Staff resolve is limited to their branch scope. Numeric/malformed ids (service route binds `legacy_ref`, price route binds ULID) return 404; numeric `branch_ref` is 422. **Fixed:** the create request now refuses (422, not silently ignores) `id`, `public_id`, `service_id`, `branch_id`, `created_at`, `created_by_user_id`, `retracted_*`, `source`, `status`, `is_current`, `ended_at`.

## 16–17. Concurrency and idempotency
Both commands require an Idempotency-Key through the shared mechanism; replays return the stored result and (new) write one audit event.

## 18–21. Integrations and boundaries
M5: lines reference Services by id and snapshot code/name; M5 holds no price (Treatments 29 pass). M6: M13 owns identity/availability only, not duration policy (not touched). M11: see §11–12 (Billing 34 pass). M3: Dentist–service eligibility (`dentist_service_assignments`) is consumed by M5 unchanged and not hardened here.

## 22. M22
**Added** minimal events in the command transaction (a failed audit write rolls the change back, tested): `pricing.price_version_created` (financial: service/branch refs, level, kind, exact decimal amount, effective date), `pricing.price_version_retracted`, and `service.branch_availability_changed` (administrative: refs and from/to flag; written only when the flag actually changes). No price history is written to M22.

## 23. Frontend/demo findings
**Fixed (confirmed defect):** for every completed server Treatment, the browser's `reconcileTreatmentHandoffs` built and persisted a local Draft invoice priced from the demo/reference fee (`baseFee`, i.e. `services.reference_fee_php`) — a second, non-authoritative price source. Under a real clinic-server session (`session.serverUserId`) it no longer runs; Laravel creates and prices invoices from M13 versions (test added). The pre-cutover local prototype (no server session) is deliberately retained because ~40 prototype tests depend on it; retiring it is a separate frontend cleanup. The Owner page, price form and formatting were audited: decimal strings only, no `parseFloat`/float arithmetic, honest "No confirmed price", loading/error/Retry, reference fee labelled unconfirmed and never copied.

## 24. Schema
**No migration.** Nothing applied to `dental_clinic`.

## 25–26. Files and tests
Backend: `PricingService`, `CreateServicePriceRequest`, `BranchServiceController`; tests `PricingTest` (+6), `ConcurrentPriceVersionTest` (+1), `BillingHardeningTest` (+1). Frontend: `src/workflow.js`, `tests/m5-treatment-cutover.test.js` (+1). Tooling: `scripts/m13-pricing-browser-qa.mjs`.

## 27–35. Results
Targeted Pricing+Reference 52 → Pricing 17 (249 assertions); cross-module: Treatments 29, Billing 34, Appointments 75, Visits 25, Audit 40 — all pass. **Full backend 521 passed / 4,996 assertions.** Frontend 721 passed. Smoke 16 groups. Build passes (known bundle-size warning). Browser QA 105 checks, 0 failures, 0 errors, 0 px overflow (Owner/Staff/Dentist/Patient × 375/430/768/1024/1440): failed load shows no prices and Retry recovers, current exact decimals shown, scheduled future price not shown as current, "No confirmed price" shown honestly, amount never pre-filled, amount posted as a decimal string with no server-assigned field, no pricing entry for other roles. `git diff --check` clean.

## 36. Unresolved clinic questions (not answered)
1. Who may create/edit Service definitions? 2. Who approves price changes? 3. May Staff change prices? 4. Do prices differ by branch (the mechanism exists)? 5. By Dentist? 6. Are future prices scheduled in advance (supported)? 7. Are old prices ever corrected retroactively (currently impossible)? 8. Are discounts/promotions M13 or billing policy? 9. Are taxes/VAT included in listed prices? 10. Should Patients see exact prices, ranges or "starting from" (no Patient price API exists)? 11. Are procedure durations stored with Services (`duration_minutes` is project configuration)? 12. Are packages/bundles offered?

## 37. Remaining blockers
- **Contract review:** Service has no ULID `public_id` (frozen `legacy_ref` bridge).
- ~~`GET /services` returned `reference_fee_php`~~ — **resolved in the pre-checkpoint gate** (see §39).
- No Service create/edit/deactivate capability (policy-dependent).
- Approval/mutation policy, public price display, discount/tax/package policy, M3 service-eligibility governance.
- Local pre-cutover billing prototype still exists for non-server sessions.
- ~~`GET /service-prices` unpaginated~~ — **resolved in the pre-checkpoint gate** (see §39).
- No upper bound on how far in the future a version may start (policy).

## 38. Verdict
**B.** All Verdict-A engineering criteria that do not depend on policy or on a reviewed contract change are met; the items above were not invented or silently changed.

## 39. Final pre-checkpoint gate (price-list paging, reference fee, retries)

**ServicePrice list before.** `GET /service-prices` and `GET /services/{service}/prices` returned every version in one unbounded response. **Now:** both are keyset-paged, newest first by internal id (deterministic, never reused); `per_page` 1–100 (default 50); cursor = the last version's public ULID (`meta.next_cursor`, null on the last page); optional filters `service_ref` and `branch_ref` (must exist, 422 otherwise) can only narrow; authorization (Owner-only route middleware) runs before any filter or cursor; an unknown cursor is an empty page; malformed input is 422; a version created while paging does not shift or repeat read pages (tested). The only frontend consumer is the Owner Services & Pricing page: it follows the cursor automatically (bounded to 20 pages × 100), and when more history remains it shows "Only part of the price history is loaded" with **Load older price versions** (recoverable error + Retry, pages merged without duplicates). While the history is incomplete it does **not** state any price as "in effect today"/"superseded" (it says "Load the full history first"), because that status needs every version. The list is never claimed complete before the server cursor is null.

**`reference_fee_php` consumer inventory.**
- *A — current server-backed consumers:* the `GET /services` projection (all roles); `reference-data-bridge.js` `mapService` (→ `baseFee`); Owner Pricing page (display column + hint, labelled "unconfirmed"); Owner Branches screen (display text on the service list). All display-only; no production workflow needs the value, and no server module (M5/M6/M11/resolver/pricing) reads the column (source-scan test).
- *B — local/pre-cutover prototype:* `src/data.js` `INITIAL_SERVICES.baseFee`, `src/phase2.js` `treatmentInvoiceItems` (local prototype pricing, only reachable without a server session — see §23), `src/logic.js` default.
- *C — tests/historical:* seeder and fixtures (the DB column and demo seed values remain), the Phase 2A contract test, bridge test, QA fixtures, docs (`BACKEND_INTEGRATION.md`, `ERD_ALIGNMENT.md`, `MODULE_COVERAGE.md`, migrations — historical wording left intact).

**Decision: removed from the production projection** (a deliberate, reviewed frozen-contract correction, not drift): `ServiceResource` no longer returns `reference_fee_php` (and so no float money) to any role; `mapService` no longer reads it; the Owner Pricing page and Branches screen no longer print it; the frozen resource-contract test was intentionally changed to assert the exact key set `[id, code, name, duration_minutes, category, status]` for every role, and `docs/architecture/CONTRACTS.md` records the correction. The database column and the demo seed data remain (explicit demo data); nothing reads them for pricing. **Proof it can never be an authoritative fallback:** resolver/pricing/billing/invoice sources contain no reference to it (test); M5 tables have no money-like column (test); with a reference fee present and no M13 price the resolver says unavailable and M11 refuses with 422 and creates no invoice (tests); no role's `GET /services` or `/branch-services` contains a fee (test); the browser's server-session path never prices from `baseFee` (§23 test).

**Price-create retry behaviour (audit finding: already covered by the shared contract; tests added).** `POST /services/{service}/prices` requires an `Idempotency-Key` and runs through the shared `IdempotentCommand`/`command_keys` mechanism. A lost-response retry with the same key and body returns the **stored result** (same version id, 201, one row, one audit event); the same key with a different body is 422 `idempotency_key_reused`; a *new* key for an already-occupied level/date is a stable 409 `price_version_exists` (the unique invariant); a missing key is 422. A real two-process double submit with one key yields one version and one audit event (201+201 same id, or 201+409). No bespoke mechanism was added.

**Preserved blockers/boundaries.** Service has no ULID `public_id` — **SHARED CONTRACT MIGRATION REQUIRED**, not attempted. No Service create/edit/deactivate API (capability/policy blocker). Future-date horizon: none exists; **POLICY DECISION REQUIRED** only if the clinic wants one (nothing invented). Manila semantics, retraction rule, trigger, branch-offering lock, M22 events and money rules are unchanged.

**Gate verification (final tree):** Pricing 21 tests / 355 assertions; Pricing+Reference gate run 62; cross-module Treatments 29, Billing 34, Appointments 75, Visits 25, Audit 40, Reference all pass; **full backend 525 passed / 5,124 assertions**; frontend **722 passed**; smoke 16 groups; build passes; browser QA **125 checks**, 0 failures, 0 errors, 0 px overflow (incl. paging beyond the automatic bound, failed later page + Retry, no reference fee shown, role access unchanged); `git diff --check` clean. **Verdict B.**

