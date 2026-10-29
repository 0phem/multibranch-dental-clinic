# OWN-01 Owner Analytics — A4 acceptance, 2026-10-29 (Asia/Manila)

> A5 appendix (2026-10-29): the later visual enhancement adds fixed 30-day collections/visit comparisons and a weekly gross-bar/net-line chart. See [A5 acceptance](OWN01_A5_ACCEPTANCE.md) and the [professor showcase with synthetic screenshots](defense/OWNER_ANALYTICS_FEATURE_SHOWCASE.md). The original A4 evidence below is preserved; Saturday calendar status, payment/refund authority and production-acceptance limits remain unchanged.

## Separate Git stages

Stage 1 verified clean tracked files, fetched both remote heads and confirmed accepted A3 `08ec129668cef58c32ce82ae8dfc98e254f40eda` was a fast-forward successor of development integration `2fa7333b94f444e032df4e67f8f25336fd2bda2a`. Per explicit approval, fast-forwarded local and remote `integration/developer-a-b` normally, then verified the remote equals A3's exact SHA. No force, reset, rebase, production/main update, PR #7 change or Developer B branch operation occurred. No A3 tests were repeated for that unchanged integration.

Stage 2 created independent `feature/joevan-own01-analytics-rapid-20261029` from that updated integration. Only OWN-01 is revised in `QA-RICHMON.md`. Original untracked `.agents/teamwork/` and `.playwright-mcp/` artifacts remain preserved.

## Implementation and reused contracts

The Owner dashboard charts already existed, but Owner `AnalyticsPage` lacked these charts and had a different period-selection interface. That dashboard implementation is unchanged. The Analytics screen now uses narrowly scoped native SVG views, following the existing chart pattern, with the existing `fetchDailyRevenue` / `fetchWeeklyRevenueHistogram` wrappers and GET `/api/analytics/daily-revenue` / `/api/analytics/weekly-histogram` endpoints. No chart dependency, backend aggregation, schema, financial state or authorization rule changed.

Daily reporting uses the screen's current period and selected branch's public reference. Weekly reporting has its own labelled date input, uses the same branch filter and always covers Monday through Saturday, excluding Sunday. Sunday activity can therefore make a daily period total differ from the six-day histogram. Payment/refund charts are also explicitly distinguished from the older paid-invoice KPI, which uses invoice creation dates.

The chart plots **gross collections**, not profit. Totals and exact date tooltips expose **gross collections, refunds and net cash flow** separately; keyboard focus/tap and an expandable exact-value table provide alternatives to hover. Decimal strings are parsed to BigInt centavos for validation and currency display, including negative net days and large amounts beyond Number's centavo precision. Number conversion is used only for SVG pixel geometry. Bucket sums/counts must match server totals; malformed or inconsistent responses become unavailable rather than zero. No frontend invoice or demo collection supplies these charts.

Each resource is keyed by all its request filters and drops late responses after unmount. A branch/period/date switch immediately removes the prior chart projection. An unresolved branch fails closed instead of widening to all branches. Executive-summary loading also now rejects outdated request results. Existing API failures have explicit no-figures/retry states; zero transaction counts have an honest empty notice. Loading and layout use scoped styles only.

An existing hardcoded marketing card claimed campaign ROI and attributed revenue on the Analytics screen. It is now confined to an explicitly labelled offline example and does not appear in authenticated reporting. No marketing transactions or replacement revenue figures were invented.

## Saturday semantics and acceptance boundary

For the current week before Saturday, the histogram is hidden by default and a clearly labelled **Preview in-progress week** button permits intentional preview. On Saturday, the histogram is visible but remains **in progress** while the endpoint returns `is_finalized=false`. Historical weeks display the endpoint's finalized flag only after Saturday has passed. No backend rule was changed to make the chart appear earlier.

The QA term “generated on Saturday” is implemented as an available read-only/on-demand Saturday summary using the already-approved endpoint. This does not claim a background scheduler, stored weekly artifact, immutable snapshot or audited financial closing process; those would require a separate explicit contract. Finalization here is the endpoint's reporting-calendar flag, not a claim that no later records can ever affect historical reporting.

## Focused evidence

- `node --test tests/owner-revenue-analytics.test.js tests/m21-analytics.test.js tests/own01-dashboard-charts.test.js`: **25/25 passed**. Covers API parameter/decimal-payload mapping, existing dashboard regression, exact BigInt arithmetic/display, large amounts, malformed totals and Saturday/preview behavior.
- `php vendor/phpunit/phpunit/phpunit tests/Feature/Analytics/AnalyticsTest.php --filter 'revenue|histogram'`: **5 tests, 84 assertions passed**. Reuses existing synthetic financial fixtures to verify Owner-only access (anonymous 401, other roles 403), public branch filtering/invalid-branch rejection, Asia/Manila payment-day bucketing and continuous zero days, multiple partial refunds on different days, six Mon–Sat buckets, Sunday exclusion and pre-/on-/post-Saturday finalization.
- Reconciliation sample from those backend records: branch 1 has two Monday payments totaling **6000.00**, a Monday refund **500.00** and a Wednesday refund **750.25**. Weekly totals are **6000.00 gross / 1250.25 refunded / 4749.75 net**, with Wednesday net **-750.25**. All-branches daily totals additionally include branch 2's **2000.00**, yielding **8000.00 / 1250.25 / 6749.75**. The frontend test validates/displays the same two-partial-refund amount vector without duplicating the original payment. These are synthetic test amounts, not clinic results.
- Playwright MCP executed `tests/owner-analytics-rendered.mjs` against the actual `AnalyticsPage` in `tests/fixtures/owner-analytics.html`, with fixture API projections: **1440px and 390px cases passed**, plus pre-Saturday, empty, failure and retry scenarios. Verified exact focus/hover dates/amounts and refunds/net, accessible table, current period/branch and historical week request mapping, Saturday in-progress vs historical finalized status, delayed old-branch response rejection, unresolved-branch no-request behavior, exclusion of fake campaign figures and no page horizontal overflow. This is rendered frontend acceptance plus separate real PostgreSQL API acceptance, not deployed live-data E2E acceptance.
- Production build passed (existing bundle-size warning). Syntax and `git diff --check` passed. Full frontend/backend suites were deliberately not run; broad regression remains for the integration checkpoint.

## Database safety and ownership

Created only new disposable PostgreSQL 16 container `joevan-own01-a4-acceptance-20261029`, ID `1590109b997d4cbaf3bf0a4f8c14adc75ff3e01be0f2ad0be0c69a117e6daaeb`. Independently inspected its ID, no existing mounts, tmpfs at `/var/lib/postgresql/data`, localhost-only `127.0.0.1:5432` port binding and current internal address `172.17.0.2`. Before any writes, Laravel's existing scratch guard plus a read-only query confirmed exact `dental_clinic_scratch`, actual server `172.17.0.2:5432` and **zero public tables**. Only process-local test overrides were used; no environment files, credentials, real financial data, protected databases or existing containers were changed. The disposable instance is removed after verification.

No edits to Developer B's `PatientFlow.jsx`, `StaffDayCalendar.jsx`, `ServerMessages.jsx`, `messaging-api.js`, `Staffing.jsx`, `LeaveController.php`, `QA-CELIN.md`, `QA-JAZTIN.md`, queue/leave tests or running branches. Shared components/global CSS/layout/App routing and A3 branch-map behavior are unchanged. Stage 2 is a separate feature branch for review; no automatic A4 merge or production release. Existing Wave 1/A3 governance and acceptance limitations remain unchanged.
