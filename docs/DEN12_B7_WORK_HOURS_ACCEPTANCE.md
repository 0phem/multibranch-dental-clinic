# DEN-12 B7 Work Hours acceptance

Original QA owner and implementer: **Yzhekiel**. `QA-YZHEKIEL.md` was TODO while `FINALS-QA-REVISIONS.md` was DONE. This batch reconciles the member tracker using rendered evidence; it does not edit the master tracker.

## Original issue and changes

The existing `WorkSchedulesPage` already had the weekly roster, Owner editing, Dentist read-only view, break inputs, and backend error handling. B7 retained those APIs and scheduling rules.

The roster had ambiguous visual grouping on a phone: branch names and shift times ran together. B7 adds scoped layout for separate branch/time lines, readable time inputs and touch-sized actions. It sorts weekdays numerically Monday through Sunday, labels fallback hours as **Estimated profile hours**, and gives **Branch closed** precedence over a configured weekly row for display. A closed branch's schedule data is not deleted.

The former duty badge used `on_duty_today !== false`, showing missing data as on duty and collapsing multiple branches into one badge. Work Hours now reads the dated, branch-scoped `duty.rows` projection from `/api/work-schedules` and shows each visible branch separately. Staff duty badges are limited to branches included in that server projection. A separate Staff profile label previously said “Available / On-Duty” based on a profile availability flag; it now says “Marked available” or “Marked unavailable.” These are presentation changes only.

## Duty-state meaning

- **On duty today:** the current Manila-date server projection explicitly reports `on_duty_today: true` for this Dentist and branch. This means working minutes exist at that branch today, not that the Dentist is currently treating a Patient.
- **Off duty:** the current projection explicitly reports `false` for this Dentist and branch.
- **Duty status unavailable:** the projection, matching row, or current Manila date is missing. The UI does not infer status from the browser's `available` field or a broad Dentist-level flag.

The server remains authoritative for opening hours, closures, exceptions, breaks, approved leave, branch scope, and booking eligibility. B7 does not change booking decisions or expose leave reasons.

## Rendered verification

`tests/den12-work-hours-harness.html` mounts the production page with synthetic two-branch data and controlled API responses. Playwright checked the Dentist read-only roster, Owner edit controls, and Staff read-only roster. The populated roster displayed Monday through Sunday, branch-specific times, a 12:00–13:00 break, day-off cells, and Sunday branch closures. A profile-hours fixture showed twelve estimated branch/day cells and two closed cells; an empty Dentist list showed the existing empty message.

At **390px**, the document width was 375px; at **1440px**, 1425px. Branch and time are now on distinct lines. Owner opened Change with Enter, cancelled without saving, received a visible 422 validation message, saved successfully, and submitted Make it a day off. Dentist and Staff rendered no weekly edit buttons. Staff's duty group included only the branch returned by the scoped projection. A missing duty projection displayed **Duty status unavailable** for both branches in the Dentist fixture. The fixture's API responses were controlled; the authorization and write contract were not retested against Laravel in this frontend-only batch.

After screenshots (local untracked evidence, intentionally excluded from Git): `.playwright-mcp/den12-b7-dentist-mobile-after.png` and `.playwright-mcp/den12-b7-dentist-desktop-after.png`. A pre-B7 screenshot was not captured before the code change; the before-state is documented in the source diff, and no reconstructed image is presented as a baseline screenshot.

## Tests

- `node --test tests/den12-work-hours.test.js tests/staffing.test.js tests/ui-foundation.test.js` — **23 passed**. The duty helper covers true, false, missing row, missing field, stale date, and absent projection. Two older source assertions were updated to require accurate new labels.
- `npm.cmd run build` — passed; existing large-chunk warning remains.
- `git diff --check` — passed.

No database-writing tests were run because no backend contract changed. Browser fixtures do not prove server-side authorization; the existing backend role rules remain unchanged.
