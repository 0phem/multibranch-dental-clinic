# OWN-01 A5 acceptance — Owner Analytics presentation and comparisons

Implementer: Joevan / Developer A. Date: 2026-10-29. Branch: `feature/joevan-owner-analytics-a5-visuals-20261029`, based on integrated A4 `02a957d5db4af1687f8dc8aca045da3c2ab4a242`.

## Implemented scope

Fixed Last 30 Days KPI overview uses current/prior daily-revenue totals and executive summaries with identical branch scope. Gross collections use payment dates; Patient Visits use `patient_flow.total_visits` (arrivals, not unique patients/completed care). Outstanding uses remaining balances on qualifying issued invoices created within the current window; no comparison or historical-snapshot claim. The overview is explicitly independent of the daily-report period selector, including All Time.

Exact BigInt centavos and integer percentage rounding cover increase, decrease, neutral, tiny changes, large amounts and zero denominators. Current [today−29,today] and previous [today−59,today−30] windows are inclusive Manila calendar dates. Weekly gross bars and net line/markers share six dates and one signed peso axis, with exact refund/net tooltips and tables. Daily charts, Saturday preview/finalization and API failure behavior remain functional. No backend aggregation, policy or endpoint changed.

## Actual verification

```text
node --test tests/owner-analytics-a5.test.js tests/owner-revenue-analytics.test.js tests/m21-analytics.test.js tests/own01-dashboard-charts.test.js
30 tests passed, 0 failed

php vendor/phpunit/phpunit/phpunit tests/Feature/Analytics/AnalyticsComparisonTest.php tests/Feature/Analytics/AnalyticsTest.php --filter 'custom_current|revenue|histogram'
6 tests passed, 96 assertions

npm.cmd run build
passed; existing bundle-size warning
```

Playwright MCP ran exported `runA5Acceptance(page, {base})` against Vite localhost:5177 and the actual AnalyticsPage synthetic fixture. Both **1440px and 390px passed**: exact current/prior queries and scope, gross decline/visit increase, outstanding without badge, signed net markers, keyboard/hover/click tooltips, exact table, no horizontal document overflow, fixed overview with All Time detailed period, cleared/loading figures on branch change and late-response rejection. Additional cases passed: prior-zero baseline, all-zero chart, failed prior fetch and retry. `runOwnerAnalyticsAcceptance(page, base)` also passed both widths, historical-week mapping, Saturday status, pre-Saturday preview, empty/error/retry and unresolved-branch rejection. This is mocked-API frontend acceptance plus separate PostgreSQL reconciliation, not deployed financial E2E.

Screenshots: [professor showcase](defense/OWNER_ANALYTICS_FEATURE_SHOWCASE.md). All figures are labelled Illustrative test data. Browser acceptance uses synthetic today 2026-10-31 to exercise Saturday; it does not alter the actual clock or database dates.

## Financial reconciliation

The new PostgreSQL comparison case checks branch 1 current 2026-09-30–2026-10-29 gross **1500.00** against preceding 2026-08-31–2026-09-29 **2000.00**, with **3 versus 2 visits** and scoped outstanding **400.25 versus 900.00**. Other-branch, earlier and future payments are excluded. Existing refund tests separately verify multiple partial refunds without duplicate gross payments, Wednesday **−750.25** net, and weekly **6000.00 gross / 1250.25 refunds / 4749.75 net**. Owner access and anonymous/other-role denial remain covered by selected existing revenue tests.

Synthetic browser example: current gross **45000.00**, previous **60000.00**, decrease **25.0%**; visits **120 versus 80**, increase **50.0%**. Weekly **11700.00 gross / 1600.25 refunds / 10099.75 net**. Refund-only Wednesday plots below zero. These are test fixtures, not clinic figures.

## Database safety

Created disposable PostgreSQL 16 Docker container `joevan-a5-analytics-20261029`, ID `c074bbd02cf50d2159849a98e64d3f99ac557b4a541490e395d5c07f797395f7`. Independently inspected identity, localhost-only 127.0.0.1:5432 binding, tmpfs data and no existing data mounts. Before writes, scratch guard plus read-only effective-connection query verified exact `dental_clinic_scratch`, server **172.17.0.2:5432** and **zero public tables**. Connection and `TEST_SCRATCH_SERVER_ADDRESS` overrides were process-local. No environment files, protected databases, existing containers or real patient/financial records were modified. Disposable instance removal is recorded with final publication verification.

## Boundaries

Final checks: PHP syntax and `git diff --check` passed. The exact disposable container was stopped and automatically removed after testing; `docker ps` with its ID returned no running container. No protected database was used.

No Developer B queue, leave, messaging, calendar, tracker or running-branch edits. No global CSS/shared components/layout/routing edits. No new dependencies or live provider calls. Full suites are deferred to integration, as requested. Production financial acceptance, immutable accounting closes, automatic scheduled Saturday artifacts, deployment and broader accessibility certification remain outside demonstrated acceptance. Existing A4 and prior governance limitations are preserved. Review A5 separately; do not auto-merge.
