# M21 — Operational Analytics: technical corrections

Branch `feature/m21-analytics-technical-corrections`, created from `180d2da`. Uncommitted. This is a **narrow technical correctness pass, not M21 production hardening**: no business definition, clinic policy, role, ERD table or migration was added or changed, and M21's canonical status is unchanged. Nothing was applied to `dental_clinic`.

## 1. Initial defects

All were first found by reading the code (see `docs/FOLLOW_UP_INTERVIEW_AND_POLICY_DEPENDENCY_MAP.md` §11) and then checked in a separate read-only verification before this pass: `(int)"b1"` is 0 and `(int)"01JABC"` is 1 (verified in PHP); `Carbon::parse` throws for `not-a-date` and `2026-13-45` and rolls `2026-02-30` to March 2.

| ID | Defect (before) |
| --- | --- |
| E-1 | The page sends the branch's legacy reference (`b1`); `AnalyticsController` cast it with `(int)`, giving 0, so `if ($branchId)` skipped the filter and all-branch figures were shown as filtered. A public ULID (starts with `01`) was cast to 1 — a wrong branch. The CSV export did the same. |
| E-2 | Responses carried internal bigint branch ids (`branch_id` in the summary and in every branch row); the page used one as a React key. |
| CR-01 | Raw `date_from`/`date_to` reached `Carbon::parse` (500 on malformed input, silent rollover of impossible dates); a single bound was labelled "Custom Range" but returned all-time data (every filter was guarded by `if ($from && $to)`); reversed ranges returned nothing silently; an unknown `period` silently became "All Time". |
| E-3 | `numeric(12,2)` values were cast to `float`, summed as floats, rounded, and emitted as JSON numbers (and `number_format`ted in the CSV). |
| CR-02 | `active_queue` counted every non-terminal entry of any day and ignored the period while the summary's `current_waiting` filtered by `created_at` in the period: two windows for one concept. `estimated_wait_minutes` was `active_queue × 15`, a formula the clinic never approved. |
| E-5 | `completion_rate_pct` and `health_rate_pct` defaulted to 100 with no observations; the page printed them as `100%`; a failed request silently fell back to local demo metrics in a clinic-server session. |

CodeRabbit's CR-02 suggestion to filter on `closed_at` was not adopted: `closed_at` is set only when an entry is Served (`QueueService.php:93`), which the status filter already excludes. Only the missing clinic-day restriction was a real gap.

## 2. Corrections

- **Branch reference (E-1).** New `App\Http\Requests\Analytics\AnalyticsQueryRequest` resolves `branch_id` through the M2 pattern: a public ULID (any case) or the frozen transitional `legacy_ref`. The internal bigint id is never accepted (`"12"` matches neither column). Absent, empty or `all` mean All Branches deliberately; anything else that does not resolve is a 422 `branch_id`. An invalid value never widens the scope. The service receives a `Branch` model and uses the internal key only inside queries. The same request class is used by the executive summary, the branch breakdown and the CSV export. `branch-performance` now also accepts `branch_id` and narrows to that branch; the export's breakdown follows the selected branch and adds a "Branch Scope" row naming it.
- **Public identity (E-2).** The summary returns `branch: {public_id, name} | null` (replacing `branch_id`); each branch row drops `branch_id` and keeps `public_id`. The page keys rows by `public_id` and sends the branch's `publicId`, falling back to its `id` (legacy ref) only if no public id is loaded. No error message echoes an id. No broader identity migration was done.
- **Dates (CR-01).** The request validates: `period` ∈ `today, this week, week, this month, month, this year, year, all, all time` (case-insensitive; absent = `today`); `date_from`/`date_to` strict `YYYY-MM-DD` real calendar dates (`ClinicClock::validDate`), **both or neither** (`required_with`), `date_from <= date_to`; wrong types are 422. The service re-checks defensively and throws rather than falling back. Custom dates, when present, take precedence over `period` as before. No existing consumer sends custom dates (the page only offers presets), so both-or-neither is not a breaking change.
- **Window.** Every window is half-open in Asia/Manila: `from` = start of the first business day, `until` = start of the day after the last one. Bounds are bound as ISO-8601 strings **with an offset**, so the database session time zone cannot shift a business day (tested under UTC, Asia/Manila and America/New_York). A record at 23:59:59 Manila belongs to that day; at 00:00:00 the next day.
- **Money (E-3).** Totals are computed by PostgreSQL in exact `numeric` (`SUM … FILTER`, cast to `numeric(16,2)::text`), never through PHP floats, and returned as decimal strings (`"1500.00"`). The average ticket is `ROUND(AVG(paid_amount), 2)` — PostgreSQL rounds half away from zero to centavos; documented and tested (`0.01`, `0.02` → `0.02`). The CSV writes the strings as they are. The page converts only for display (`Intl`, whole pesos, as before).
- **Current queue (CR-02).** "Current" queue = entries whose status is a position-holding one (`QueueEntry::POSITIONAL`: Waiting, Called, Treatment Ready) **and** whose `dentist_queues.clinic_date` is today in Manila, optionally for one branch. Temporarily Away and Served are excluded, as in M9 positions. The executive summary's `current_waiting` and the branch report's `active_queue` use the same query and do not follow the selected period; `served_from_queue` and `total_visits` remain historical counts in the period. Old entries are neither closed nor changed; no end-of-day processing exists or was added.
- **Wait estimate.** `estimated_wait_minutes` is now `null` in server analytics. The `×15` per position formula was never approved (M10 wait-time policy is unresolved) and ignored the number of Dentists. The page shows "wait estimate not configured"; the CSV shows "Not configured". The invented `?: 80` capacity-threshold fallback was removed from the API (the stored value or `null`).
- **No data (E-5).** `completion_rate_pct`, `health_rate_pct` and `average_ticket_php` are `null` with no observations; a genuine 0 and a genuine 100 are unchanged. The page and CSV show "No data". A failed request in a clinic-server session shows an explicit unavailable state with **Try again**, clears figures from the previous branch/period, and never falls back to local demo metrics (the offline demo keeps its labelled local fallback).

### 2a. Final status

| ID | Status |
| --- | --- |
| E-1 branch filtering | Corrected and tested. |
| E-2 internal ids | Corrected and tested (no numeric id key in any M21 response). |
| CR-01 dates | Corrected and tested. |
| E-3 money | Corrected and tested (decimal strings, exact aggregation). |
| CR-02 current queue | Corrected and tested (current Manila clinic day, one shared query). |
| E-5 no data | **Implemented for M21 only** (summary, branch report, page, CSV). **Not globally resolved:** the M23 Automation Monitor's own no-data default is pending (section 6). |
| Workload percentage | Removed from server-backed analytics (below). |

### 2b. Workload percentage decision (final gate)

The "Branch workload report" bar and `NN%` figure were computed in `Admin.jsx` as `min(100, round(active_queue ÷ max(1, capacity_threshold || 80) × 100))`. Its denominator was the branch's stored `capacity_threshold` (the 80 / 80 / 75 demo configuration that M2 labels *unconfirmed*), or an invented 80 when absent; it divided a queue **count** by a **percentage** threshold and showed the result as a percentage. Neither the formula nor the denominator is approved (M10 capacity policy is unresolved), and it was visible to the Owner in every clinic-server session.

Now, in a clinic-server session, no workload percentage is calculated or drawn: each branch shows **"Capacity not configured"**, with its real queue count ("N waiting now", including a genuine 0), appointments and revenue unchanged. No substitute denominator was introduced, the stored threshold is not used for a percentage, and no queue record was touched. The API still returns the stored `capacity_threshold` (and the CSV its column) as configuration data, not as a derived metric; M10 capacity management is not implemented. The offline demo (no server session) keeps its local example calculation and the card is labelled "Offline demo preview — example capacity values, not clinic data".

## 3. API behaviour: before and after

| Item | Before | After |
| --- | --- | --- |
| `branch_id=b1` / ULID | cast to 0 / 1 | resolved to the branch; filter applied |
| `branch_id=12`, unknown, array | 12 → filter by that bigint; others 0 | 422 |
| Summary branch field | `branch_id` (int, echo of the cast) | `branch: {public_id, name}` or `null` |
| Branch row | `branch_id` (bigint) + `public_id` | `public_id` only |
| Malformed / impossible / one-sided / reversed dates, unknown period | 500, rollover, unfiltered "Custom Range", empty, "All Time" | 422 |
| Money fields | JSON numbers | decimal strings |
| `average_ticket_php` with no Paid invoice | `0.0` | `null` |
| `completion_rate_pct`, `health_rate_pct` with no observations | 100 | `null` |
| `active_queue` | any day, no window | current Manila clinic day |
| `current_waiting` | entries created in the period | current Manila clinic day (period-independent) |
| `estimated_wait_minutes` | `active_queue × 15` | `null` |
| CSV | `number_format`ted floats, `%` suffixes | decimal strings, "No data", "Not configured", "Branch Scope" row |

## 4. Unchanged definitions and authorization

- **Financial definitions are unchanged.** "Collected" is still the `paid_amount` of invoices with status Paid whose **`created_at`** falls in the window — an invoice-creation report, not a payment-date report; a full-HMO Paid invoice contributes 0. Gross/HMO use Issued and Paid invoices; outstanding is Issued responsibility minus paid. The page label now says "Paid invoices created in this period" instead of "Real collections". **Open business-definition question, tracked as DQ-113** in `docs/FOLLOW_UP_INTERVIEW_AND_POLICY_DEPENDENCY_MAP.md` (deferred, M21/M11, PRODUCT · UNRESOLVED; no existing decision covered the date basis): should revenue be reported by payment date? M11 payments carry the actual received date. The follow-up map now counts 113 deferred and 173 distinct clinic decisions.
- Owner-only authorization is unchanged: route middleware, controller check; guests 401; Staff, Dentist and Patient 403 — before validation runs (tested with invalid parameters). No new role or access; no Patient-sensitive field is returned; no M22 behaviour changed.

## 5. Tests

- `AnalyticsCorrectionsTest` (new, 20 tests): branch by legacy ref and by ULID (any case); a `01…` ULID never selects id 1; invalid branch references 422 on all three endpoints and never leak ids; All Branches by absence/`all`; no numeric id key in any response; CSV scope and branch resolution; every preset; 11 invalid period/date cases on all three endpoints; inclusive Manila boundaries (23:59:59 +08 vs 15:59:59/16:00:00 UTC); time-zone independence; non-owner roles refused before validation; exact decimals (0.10 + 0.20, 19.99 ×2, 0.29 ×2, HMO partial amounts); half-away-from-zero averages; full-HMO invoice; current queue (today's Waiting and Called, yesterday's Waiting, Served, Temporarily Away, two branches, summary/branch agreement, period independence, old row untouched); Manila midnight; unavailable wait estimate; null for no data; genuine 0 / 75 / 100; automation health null → 100 → 50.
- `AnalyticsTest` updated deliberately: it asserted the numeric `branch_id` echo that encoded E-1/E-2.
- `tests/m21-analytics.test.js`: four source assertions for the page (public branch reference, no local fallback in a server session, "No data", honest revenue label).
- `tests/m21-analytics.test.js`: also asserts no workload percentage, no `|| 80` denominator and the offline-preview label.
- `scripts/m21-analytics-browser-qa.mjs`: HTTP fixtures (not a live backend); Owner/Staff/Dentist/Patient at 375, 430, 768, 1024, 1440; includes the known-count, zero-count, branch-switch, failure/retry and no-percentage checks for the branch report.

Final results (gate run): see section 8.

## 6. Limitations and remaining M21 blockers

- This pass fixes correctness only. M21 remains Verdict B territory: period handling beyond the presets, the payment-date question above, metrics for M16/M17/M26 ("Unavailable"), Staff/Dentist analytics (not designed), retention/privacy review, and a full M21 hardening pass (idempotent exports, pagination of exports, M22 events for exports) are not done.
- **Wait estimation is blocked on a clinic policy** (PI-24, PI-25, DQ-74 in the follow-up map). The workload percentage that used an unapproved denominator was removed from server mode (section 2b); capacity management itself is M10 and is not implemented.
- **M23 Automation Monitor (pending, M23-owned).** `AutomationPage` (`Admin.jsx`) reads `/api/automation/snapshot` from `WorkflowAutomationService::getAutomationSnapshot` (`health_rate` defaults to 100 with no actions, line 262) and, offline, computes its own `… : 100`. That endpoint and page are M23, not a consumer of the M21 response changed here, so nothing was changed. Ownership decision: **M23**. E-5 is therefore resolved for M21 only; the M23 no-data correction, and E-4 (M23 result text claiming actions that are not performed), remain open engineering items for the M23 pass.
- Browser QA used HTTP fixtures; it does not prove live-backend rendering. The database tests ran only on `dental_clinic_test`.

## 7. CodeRabbit

Two single (non-concurrent) reviews, no autofix, both `coderabbit review --agent --uncommitted --include-untracked`.

1. **First pass** (8 files): one minor finding — the time-zone test must reset `SET TIME ZONE DEFAULT` in a `finally`. **Confirmed and fixed.**
2. **Final gate** (10 files: `AnalyticsController.php`, `AnalyticsService.php`, `AnalyticsQueryRequest.php`, `AnalyticsTest.php`, `AnalyticsCorrectionsTest.php`, `Admin.jsx`, `tests/m21-analytics.test.js`, `scripts/m21-analytics-browser-qa.mjs`, this document and the follow-up map): **0 findings.**

Limitations: the review reads a diff of the working tree against its base; it cannot see runtime behaviour, other modules, or the deployed database. No finding is not proof of no defect.

## 8. Final verification (final gate run)

| Check | Result |
| --- | --- |
| Targeted analytics backend | 27 passed (20 new corrections tests) |
| Full backend (`dental_clinic_test` only) | 681 passed, 7,106 assertions (baseline before M21 work: 661) — includes the M2, M9, M11, M12, M22 suites |
| Targeted frontend (`tests/m21-analytics.test.js`) | 7 passed |
| Full frontend | 760 passed |
| Render smoke | 16 groups, exit 0 |
| Production build | Passed (existing bundle-size warning unchanged) |
| Browser QA | 161 checks, Owner/Staff/Dentist/Patient at 375, 430, 768, 1024, 1440, 0 px overflow, no unexpected console errors (the only errors are the injected 500s). **HTTP fixtures — not live-backend end-to-end verification.** |
| `git diff --check` | Clean |
| Migrations | None added; none applied to `dental_clinic` |

## 9. Verdict

**M21 Technical Correctness — B.** The identified correctness defects (E-1, E-2, E-3, CR-01, CR-02, E-5 for M21, and the unapproved workload percentage) are fixed. M21 is **not** declared production-hardened: the revenue date basis (DQ-113), wait-time and capacity policy (M10), payment-date reporting, Staff/Dentist analytics, export hardening and retention are open, and the M23 Automation Monitor no-data default and E-4 remain pending in M23.
