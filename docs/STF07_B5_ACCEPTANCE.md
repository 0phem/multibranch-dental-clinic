# STF-07 — Dentist duty in Staff Operations

**Implementer:** Developer B (Yzhekiel). **Scope:** read-only Staff Operations status.

## Meaning and source

“On duty today” means the Dentist has at least one available working minute at that branch on the current **Asia/Manila clinic date**. “Working now” means the current Manila minute falls inside one of those windows. A Dentist may therefore be on duty today while outside their shift, on a break, or on partial-day leave right now. An unavailable Dentist profile or a closed branch is off duty.

`GET /api/work-schedules` now includes `data.duty: { date, as_of, rows }`. Each row has Dentist and branch IDs/names, `on_duty_today`, `working_now`, `working_minutes`, and `estimated`. This is a read-only projection. `WorkSchedules::minutes()` and `workingNow()` provide the facts from branch opening hours and closures, weekly schedules or dated exceptions, breaks, and approved leave. When a Dentist has no weekly rows, the existing profile-hours fallback applies and `estimated` is true. No leave reason or clinical details are exposed. The existing top-level `dentists[].on_duty_today` is now derived from these branch results.

The endpoint keeps its existing Owner, Staff and Dentist role middleware. The new duty rows include only branches in the Staff member’s server-side `UserBranchScope`; Owner sees assigned branches across the clinic, and Dentist sees only their own assigned branches. Patient access is forbidden. The Staff dashboard’s branch picker can narrow those authorized rows and cannot grant access. The badge never changes booking eligibility.

Staff Operations fetches on entry, refreshes while visible, offers a manual refresh, and checks the clinic date every 15 seconds so a Manila date rollover triggers a new fetch without a page reload. It shows loading, empty, forbidden, and request-failure states; it never substitutes the browser demo’s `available` flag for server evidence.

## Evidence

- `OnDutyStatusTest.php`: 4 scratch-guarded tests, 79 assertions. Synthetic scenarios cover profile fallback, weekly windows, breaks, day off, custom hours, full and partial branch closure, full and partial approved leave, availability override, cross-branch differences, Staff/Owner/Dentist/Patient access, and Manila midnight.
- Existing `WorkSchedulesTest.php`: 7 tests, 77 assertions passed.
- `stf07-duty.test.js`: 3 frontend tests passed for honest unsigned/loading states and the read-only API client contract.
- Playwright rendered fictional fixture: 1440px and 390px had two readable Dentist/branch rows and no horizontal overflow; branch selection, refresh, empty, forbidden and server-error recovery passed. Advancing the fake Manila clock across midnight triggered a new request and changed the displayed clinic date without reload.
- Vite production build and `git diff --check` passed. The existing large-chunk warning remains.

Screenshots (fictional data): [desktop](ui-review/stf07-duty-1440.png) and [mobile](ui-review/stf07-duty-390.png).

## Limits

Rendered checks used a fictional response fixture, while backend facts and authorization were tested against the guarded scratch PostgreSQL database. No production roster or live clinic data was used. The existing profile-hours fallback is an estimate until the clinic enters real weekly schedules. The Dentist dashboard’s separate profile-derived badge is outside this Staff Operations revision and is not claimed as verified here.
