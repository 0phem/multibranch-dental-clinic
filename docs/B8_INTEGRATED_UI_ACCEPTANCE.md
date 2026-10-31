# B8 integrated frontend regression acceptance

2026-10-31, Asia/Manila. Developer B. **Frontend acceptance passed within the matrix below; independent review required.**

Base: `session/developer-b-ui-20261031` at `85a9552bf5544c73db6bde9f7b01792a5cf9cb0a`, matching the local canonical integration and cached remote integration refs. No fetch, branch change, commit, staging, publication or merge. No module status is promoted.

## Scope and prior coverage

Reviewed B2/B4 Node tests and queue fixture, B3 leave tests/fixture and QA evidence, B5 duty tests/report, B6 walk-in fixture/report, B7 work-hours tests/fixture/report, and A8's existing rendered Staff workflow suite. Production components, contracts, API adapters, CSS and package manifests were inspected read-only. The coordination workflow skill was applied.

Existing coverage already exercises closure filtering, conversation identity/pagination, queue actions, appointment-form validation, calendar date/loading helpers, partial-day payload rules and duty helper true/false/missing/stale inputs. Those cases were not copied into new source-string tests. Prior B3/B6 rendered evidence and Laravel results remain historical reports, not fresh server evidence.

The new suite closes interaction gaps between these surfaces, using the second of two fictional Patients to catch first-record fallback. It mounts real production components together with a small fixture navigator, not the complete App shell/router/store.

## Reproducible evidence matrix

Each row passed at **1440 × 1000** and **390 × 1000** in the existing Playwright browser tool: **14 scenario runs**, comprising seven scenarios at each width. Assertions use rendered controls, navigation events and captured mocked HTTP requests; no production source-string assertions are added.

| Scenario | Existing gap addressed | Observed acceptance |
| --- | --- | --- |
| B4 queue → Patient record → booking | Previous queue navigation and A8 booking checks were separate | Keyboard Enter on Beta's queue row carries exact queue/Visit/Appointment/Patient/Dentist/branch/service/treatment context. The real record and booking form show Beta, not the first Patient; confirmation stays disabled until required inputs exist. |
| B2 filtered Staff appointment → record → booking | Filtering and shortcut context were separately covered | Searching Beta leaves one record shortcut; opening it reaches Beta's record and locked booking Patient. |
| B2/B6 stale walk-in selection | Existing source checks and separate selection/admission fixtures | Editing the selected Patient query disables admission; registration-mode round trip does not restore identity; removing the selected Patient from the current directory disables admission. No mocked walk-in command executes. |
| B3 Owner leave permissions/confirmation | Source checks and earlier happy-path evidence | Owner has no requester form. `can_decide: false` hides the decision action; true shows it. Opening and cancelling the confirmation sends no POST. |
| B3 Dentist partial leave | Source assertion that requester does not self-approve | Real leave form/API adapter sends exactly one mocked POST to `/api/leave`, with matching start/end date and 10:00–11:00 hours. Success feedback appears; no decision POST or approver control appears. |
| B5/B7 stale/missing duty across views | Helper coverage did not prove both displays together | Stale and missing projections produce unavailable duty in Work Hours and an unverified warning in Operations; neither shows On duty today. Roster has Monday–Sunday order, estimated profile-hours labels, no Dentist Change controls and no document overflow. |
| B5 refresh after prior success | Earlier fixture evidence did not automate this recovery sequence | On duty today / Not working now initially appears. A mocked 403 or 500 removes previous success and displays the appropriate warning; subsequent valid refresh restores duty. |

Every scenario checks no unexpected fixture endpoints, no page/console errors and no HTTP requests escaping the fixture network boundary. All `fetch` calls terminate in a local adapter with explicit known responses; unknown endpoints fail closed and are recorded. The browser additionally aborts any API/Sanctum request that escapes interception, and any request outside the local Vite origin. No real Patient/employee seed records are imported. The only new overflow assertion concerns the roster, not every page or an accessibility certification.

## Files

- `tests/b8-integrated-ui-harness.html`: local fictional entry point.
- `tests/b8-integrated-ui-harness.jsx`: fictional state, fail-closed fetch adapter, captured commands and real component mounts.
- `tests/b8-integrated-ui.test.js`: portable Playwright interaction runner and optional Node test launcher.
- `docs/B8_INTEGRATED_UI_ACCEPTANCE.md`: this report.

No existing tests, production files, CSS, backend, dependencies, lockfiles, QA trackers or Developer A documents were edited. Pre-existing Motion/configuration/backup files remain untouched and unstaged. The Playwright tool automatically emitted `.playwright-mcp/console-2026-10-31T10-23-49-606Z.log`; it is an additional untracked tool artifact, not a B8 deliverable, and was preserved rather than deleted.

## Actual commands and results

Local fixture server (direct Vite invocation avoids npm's asset-copy predev hook):

```powershell
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5178 --strictPort
```

Initial sandbox attempt failed because esbuild could not traverse a parent directory. Approved rerun outside the sandbox started existing Vite 7.3.6. No packages were installed. The server is stopped after verification.

Focused existing frontend tests:

```powershell
node --test tests/b2-staff-ui.test.js tests/b4-queue-navigation.test.js tests/den12-work-hours.test.js tests/staffing.test.js tests/m6-staff-day-calendar.test.js tests/stf07-duty.test.js
```

Initial sandbox result: 33 passed / 2 failed test entries, with esbuild access-denied errors. Approved rerun outside the sandbox: **51 passed, 0 failed, 0 skipped**. These existing tests include helper/source/server-render checks; they are not 51 browser E2E cases.

The actual browser runner invocation through `browser_run_code_unsafe` was the function below, once with width `1440` and once with `390`. Raw serving avoids Vite transforming the optional Node launcher. The evaluated source is this repository's B8 test file.

```js
async (page) => {
  const raw = await (await page.request.get(
    'http://127.0.0.1:5178/tests/b8-integrated-ui.test.js?raw'
  )).text()
  const source = new Function(raw.replace('export default', 'return'))()
  const run = new Function(
    source.split('// NODE_ENTRY:')[0]
      .replace('export async function', 'async function') + '; return runB8'
  )()
  page.setDefaultTimeout(6000)
  return await run(page, 'http://127.0.0.1:5178', 1440) // Repeat with 390.
}
```

Both final browser runs returned seven PASS scenario labels. Initial development runs exposed fixture endpoint/name assumptions, corrected only within B8 files. No production defect was established by those fixture failures.

Optional alternative for a reviewer with an **already installed** Playwright module:

```powershell
$env:B8_PLAYWRIGHT_MODULE = 'C:/path/to/existing/playwright/index.mjs'
node --test tests/b8-integrated-ui.test.js
```

That alternative was **not** executed with a module path in this session. Without the variable, the actual Node invocation reported **0 passed / 0 failed / 2 explicitly skipped**. Those skips are not counted as browser acceptance; the browser-tool executions above supply that evidence. Do not install a package to satisfy this optional launcher. `B8_BASE_URL` optionally selects another local fixture server port.

`node --check tests/b8-integrated-ui.test.js` passed. `git diff --check`, new-file whitespace checks and a targeted secret-pattern scan passed. No full suite, smoke, build, predefense script, Laravel command, migration or database test was run under this frontend-only allocation. The build's prebuild hook copies assets, so it was not invoked.

## Limits and next recommendations

- **Proved:** rendered frontend behavior for the seven scenarios at this integrated source baseline, with fictional responses and commands.
- **Not proved:** Laravel permissions, persistence, real appointments/admission, provider delivery, production data or deployment acceptance. Harness navigation does not exercise App routing, authentication or the complete production store.
- B6 browser-to-real-Laravel admission remains unverified. Historical full QueueTest failures remain unresolved by B8. Allocate coordinated backend/integration verification separately, on an explicitly authorized safe target.
- New browser scenarios do not repeat the entire StaffDayCalendar, queue Call/Message or successful walk-in acceptance. Relevant existing frontend tests passed; older rendered/API evidence retains its stated limits. Patient photo support remains an API/GEN-14 dependency.
- No archive permissions, handover policy, check-in automation, module classification or premium redesign was changed. Stale/missing duty checks do not establish every malformed payload or a full day-rollover lifecycle.
- Independently review these four B8 files and reproduce the browser matrix before any Git publication. Allocate production fixes separately if review uncovers them; B8 does not authorize expanding file ownership.
