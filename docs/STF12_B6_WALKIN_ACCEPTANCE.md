# STF-12 B6 walk-in acceptance

STF-12's searchable Patient combobox was already implemented. This batch adds focused admission evidence; it changes no production behavior or QA ownership.

## Fictional scenario and prerequisites

`Stf12WalkInAcceptanceTest` uses the existing `SchedulingFixture` under `RefreshDatabase`. The clinic clock is frozen at 2026-09-28 10:00 Asia/Manila. Fictional Branch B1 is open 09:00–18:00; Service SVC1 is active and offered there; Dentist D1 is assigned to B1 and SVC1, available and on shift; Staff B1 is scoped to that branch; Patient A exists with a public ID. No approved leave conflicts are created. The test application calls `ScratchDatabaseGuard::assertSafe()` before any database work and verifies the actual PostgreSQL connection is local `dental_clinic_scratch`.

## API admission and persisted state

Authenticated Staff POSTs to `/api/visits/walk-in` with Patient A's public ID, `b1`, `svc1`, `d1`, and an Idempotency-Key. The real Laravel route returns HTTP 201. The response reports `walk_in`, Patient A's public ID, branch `b1`, service `svc1`, Dentist `d1`, clinic date `2026-09-28`, arrival `2026-09-28T10:00:00+08:00`, and a Waiting queue entry numbered 1. Database assertions independently confirm exactly one Visit, one Queue entry linked to it, the same Patient/Branch/Dentist/Service foreign keys, and no Appointment.

Repeating the same POST with the same key returns HTTP 201 with `Idempotent-Replayed: true` and the same Visit and Queue public IDs. A new key for the same active Patient returns HTTP 409 `active_visit_exists`; counts remain one each.

At the same clinic time, an off-shift Dentist returns HTTP 422 `dentist-shift`, an unavailable Dentist returns HTTP 422 `dentist-eligible`, and Staff B1 requesting Branch B2 returns HTTP 403. No Visit or Queue entry is written for these denials.

## Rendered Staff workflow

The repeatable fictional fixture at `tests/stf12-walkin-harness.html` mounts the production `CheckInPage` with a controlled directory and API-result adapter. Playwright exercised the real Patient combobox, searching by code at 1440px, by name at 390px, and by phone at 1440px; selected the one Patient; selected the branch, service and eligible Dentist; and clicked Admit. At 390px, `documentElement.scrollWidth` was 375px for a 390px viewport. At 1440px, it was 1440px. A simulated denial produced only a warning; a subsequent simulated success produced the queue-number success message. The selected public Patient ID and other form identifiers reached `appointmentFlow.walkIn`; after success the Admit button disabled. Screenshots are in the local, untracked `.playwright-mcp/stf12-b6-mobile.png` and `.playwright-mcp/stf12-b6-desktop.png` and are intentionally not committed.

The browser fixture uses controlled API responses, while the Laravel feature test executes the real API and checks persisted state. An end-to-end browser session writing to the scratch Laravel server was **not** run; this remains the acceptance limit. The fixture must never be pointed at patient-bearing data.

## Commands and results

- `php artisan test --filter=Stf12WalkInAcceptanceTest` — 2 passed, 33 assertions, guarded scratch connection.
- Focused frontend tests and `git diff --check` — see B6 commit report.

STF-11 and queue priority/cancellation policy are outside this batch.
