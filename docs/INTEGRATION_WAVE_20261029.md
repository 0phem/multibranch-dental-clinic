# Revision integration wave 1 — 2026-10-29 (Asia/Manila)

Candidate: `integration/revision-wave-20261029`, based on remotely verified `integration/developer-a-b` at `73ed1ca40a36682fda71dc87e166c4d802048626`. The existing checkout was reused for its installed dependencies; untracked `.agents/teamwork/` and `.playwright-mcp/` were preserved. No reset, cleanup, squash or shared-branch merge was performed.

## Incorporated source history (in order)

1. A1 `feature/joevan-gemini-api-hardening-20261029` — `40d7a8c7b061aa5a1be55e8c88682daf45a61f7f`.
2. B1 `feature/developer-b-gen07-gen09-acceptance-20261029` — `5dbb45bf177ec7503fea94139cac98bcf0e15dbf`.
3. B2 `feature/developer-b-cel2-staff-ui-rapid-20261029` — `90b5c712d4788b49ffbf4e1ba056e0ae9e056ed8`.
4. A2 `feature/joevan-ric2-messaging-rapid-20261029` — `fb30e907ff501d87cf39a08e8a258d1760c1eb04`.

Each was merged with `--no-ff`, preserving original commits. All four verified heads were checked with `git merge-base --is-ancestor` (exit 0).

## Conflict and integration-only changes

The only merge conflict was the independent additions at the top of `QA-JOEVAN.md`. Both A1 (including persisted acceptance) and A2 evidence sections were retained. No ours/theirs replacement was used. The final A1/A2 `ScratchDatabaseGuard.php` contents were identical and required no manual conflict resolution.

The initial frontend run and smoke exposed A2's component CSS import in JavaScript-only esbuild render harnesses. Added `loader: { '.css': 'empty' }` to `scripts/render-smoke.mjs` and `tests/live-ui-render.test.js`, matching the existing SSR-only harness convention elsewhere. The actual production CSS import and application behavior remain unchanged; the production build succeeded with the messaging stylesheet included.

The initial frontend run also exposed a stale source assertion in `tests/m8-visit-cutover.test.js`. It expected only a nonempty Patient ID, whereas B2 deliberately requires `!registering` and an actual matching directory Patient. Updated the assertion to require the stronger B2 guard and its canonical directory lookup, preserving the branch/service/Dentist requirements. No walk-in guard was relaxed.

These three harness/test files plus this evidence document are the only additions outside the original source-branch diffs. No application feature was added during integration.

## Verification

- Full frontend gate: final **958 tests passed, 0 failed**, `npm.cmd test`. The initial run failed on the two integration issues above; after the fixes, the 25 directly affected tests passed and the failed full frontend gate was retried once. This was a failure-driven retry, not repeated successful broad verification.
- Production build: `npm.cmd run build` **passed**, run once. A2 imports and messaging CSS were included. Existing bundle-size warning remains. No production source changed after that successful build.
- Smoke: `npm.cmd run test:smoke` **passed** after its CSS-loader correction, including 65 initial role/page renders and all workflow checks. Initial smoke failed at bundling; only that failed gate was retried. Existing React key warnings remain.
- Focused backend: **91 tests, 1,414 assertions passed**, using `php vendor/phpunit/phpunit/phpunit` with:
  - `tests/Feature/Assistant/GeminiAuthorizationTest.php`
  - `tests/Feature/Assistant/GeminiChatTest.php`
  - `tests/Unit/GeminiScratchGuardTest.php`
  - `tests/Feature/Messaging/MessageSearchTest.php`
  - `tests/Feature/Messaging/MessagingTest.php`
  - `tests/Feature/Messaging/MessagingRealtimeTest.php`
  - `tests/Feature/Intake/IntakeTest.php`
  - `tests/Feature/Prescriptions/PrescriptionTest.php`
- The backend run covers real persisted authentication, denied roles and branch/participant isolation, encrypted old-history search and cursor contracts, supported intake/Other details, prescription custom-value persistence and the scratch guard. Gemini HTTP responses are faked; no live provider calls were made. This is not a full backend-suite result.
- `git diff --check` passed; changed-file inventory and source ancestry reviewed. Diff against the starting baseline is empty for `src/pages/Staffing.jsx`, `backend/app/Http/Controllers/LeaveController.php`, `backend/tests/Feature/Staffing/` and `QA-JAZTIN.md`.

## Database safety

Created only a new disposable `postgres:16-alpine` container, `joevan-wave1-acceptance-20261029`, ID `3bac075e341d9a6f8aad8fa9595801ac5a181763a751817e36168ada475cc172`. Independently inspected the new ID, no existing mounts, tmpfs `/var/lib/postgresql/data`, localhost-only `127.0.0.1:5432` binding and current internal address `172.17.0.2`.

Before writes, Laravel's scratch guard and a read-only query confirmed `dental_clinic_scratch`, actual server `172.17.0.2:5432` and **zero public tables**. Only then ran the database-writing tests. Process-only overrides selected that exact local scratch target and the independently verified server address; no environment files or credentials were printed/changed. Existing stopped containers, protected `dental_clinic`/`Microfinance` databases and Developer B's machine were untouched. Stopped the exact new container by ID after tests; its `--rm` tmpfs data was discarded.

## Preserved acceptance boundaries

- Gemini backend authorization accepted; production provider governance remains pending.
- GEN-07 completed for supported intake.
- Prescription custom values accepted; master GEN-09 click-reduction remains open.
- STF-02/09/10 completed.
- STF-12 combobox complete; successful walk-in admission not demonstrated by B2's rendered acceptance. Backend intake tests do not promote that rendered UI acceptance.
- STF-21 partial: active-Dentist assignment/history contract unresolved.
- STF-22/23/24 and DEN-14 accepted.
- Encrypted-history search production-scale performance remains unbenchmarked.
- No leave-related work was undertaken. Existing PRs #5/#6 were not closed or merged.

GitHub CLI is unavailable. Publish only the candidate branch and use the comparison against `integration/developer-a-b` for review. Do not auto-merge into integration or main.
