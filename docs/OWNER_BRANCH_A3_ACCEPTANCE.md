# Owner Branch Management — A3 acceptance, 2026-10-29 (Asia/Manila)

Branch `feature/joevan-owner-branches-rapid-20261029`, from remotely verified Wave 1 integration `2fa7333b94f444e032df4e67f8f25336fd2bda2a`. Scope is OWN-02 through OWN-06 only. Existing untracked artifacts preserved. OWN-01, OWN-10, shared components/global styles and Developer B's leave files are unchanged.

## Results

| Revision | Result | Existing behavior retained / actual changes |
| --- | --- | --- |
| OWN-02 | COMPLETE | Existing preset dropdown, disabled duplicate choices, existing-code compatibility, Laravel unique validation and PostgreSQL unique index retained. Verified valid change/readback, same-code save, duplicate rejection and direct database duplicate prevention. Added explicit accessible dropdown name. No new code-list policy or creation API. |
| OWN-03 | COMPLETE | Existing Leaflet picker and server coordinate-pair validation retained. Map now mounts once, keeps the current callback and updates marker coordinates without rebuilding the map/resetting zoom on every pin move. Added its own Leaflet CSS dependency, normal attribution, error visibility and no marker for missing coordinates. Removed double SVG anchoring so the visual pin tip identifies the clicked coordinate. Readout correctly explains Publish persistence instead of claiming an immediate save. Saved location and branch-switch reopening verified. |
| OWN-04 | COMPLETE | Existing overview cards, state labels and action styles retained. Scoped brand-token badge/pin colors, wrapping, phone form sizing, selection/focus state and coordinate readout layout. Computed code/status contrast >= 4.5:1 verified at 1440px/390px, with no page overflow. Existing shared Status label-based palette retained; no shared-component behavior was changed. |
| OWN-05 | COMPLETE | Existing weekday Open/Closed button and last-open-day guard retained; added weekday-specific accessible names. Monday closure preserves Tuesday and the operational branch status. Publish/readback verified; empty week rejected by server. |
| OWN-06 | COMPLETE | Existing two-column services grid retained; actual element positions verify 2x2 for four active services at 1440px and one column at 390px. Existing asynchronous server-confirmed service toggle round-trips; non-Owner writes rejected. |

Coordinates in fixtures/tests are synthetic. The existing starting map viewport is not a clinic-location claim, is not displayed as a saved pin and emits no save/change by itself. No production data, clinic facts or new branch locations were inserted. This is acceptance of the existing update-only branch management scope, not a new branch-creation workflow or module-status promotion.

## Focused verification

- `php vendor/phpunit/phpunit/phpunit tests/Feature/Reference/OwnerBranchAcceptanceTest.php tests/Feature/Reference/BranchHardeningTest.php`: **12 tests, 81 assertions passed** before adding the final service-toggle case.
- Final `php vendor/phpunit/phpunit/phpunit tests/Feature/Reference/OwnerBranchAcceptanceTest.php`: **6 tests, 49 assertions passed**, covering code/API/database uniqueness, coordinate pair round-trip and invalid payload denial, weekday-hours/operational-status separation, Owner-only branch/service mutations, and service-toggle persistence. These runs overlap; counts must not be added as unique tests.
- `node --test tests/ui-foundation.test.js tests/reference-data-bridge.test.js`: **35/35 passed**.
- Playwright MCP ran `tests/owner-branches-rendered.mjs` against `tests/fixtures/owner-branches.html`: **both 1440px and 390px cases passed**. Real Leaflet click/drag, visual pin anchoring, stable map/marker identity, missing-location state, read-only coordinates, explicit Publish payload, saved-location reopening, keyboard branch selection, badge/status contrast, weekday toggles, disabled last day, 2x2/single-column grid geometry and asynchronous service toggle were exercised. Persistence API responses are fixture projections; database behavior is verified separately above. OSM tiles were deliberately blocked; live tile availability is not claimed verified.
- Production frontend build passed (existing bundle-size warning). JS/PHP syntax and `git diff --check` passed. No full frontend/backend suite was run; broad regression remains an integration-checkpoint task.

## Database safety

Created only disposable container `joevan-owner-branches-a3-20261029`, ID `43b1eb4ee5b4b9defd0bed1f42a7d554d3acc2790124dc164774149cc36d8eab`, from the already installed `postgres:16-alpine`. Inspected its new ID, no existing mounts, tmpfs `/var/lib/postgresql/data`, localhost-only `127.0.0.1:5432` binding and current internal server address `172.17.0.2`. Before writes, Laravel's existing scratch guard plus a read-only query verified exact `dental_clinic_scratch`, server `172.17.0.2:5432` and **zero public tables**.

Only process-local testing/DB overrides were used (including the independently reverified `TEST_SCRATCH_SERVER_ADDRESS`); no environment files or credentials were printed or changed. Protected databases, existing stopped containers and Developer B's machine were untouched. No migrations or application changes were needed outside the synthetic scratch tests. The scratch container is removed after testing.

## Boundaries

No edits to `src/pages/Staffing.jsx`, `backend/app/Http/Controllers/LeaveController.php`, leave tests, `QA-JAZTIN.md`, shared components or global styles. Only the five assigned revision entries/checklist lines change in `QA-RICHMON.md`. No changes to analytics or schedules. No production deployment or automatic merge is authorized by this batch. Existing Wave 1 governance/acceptance limitations remain unchanged.
