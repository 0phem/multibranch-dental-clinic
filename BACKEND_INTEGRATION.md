# Backend Integration (Foundation 1B + Phase 2A)

Scope: authentication, registration, session restoration, logout and RBAC (Foundation 1B), branch/service/
staff/dentist reference data (Phase 2A), M1/M4 identity, M6 appointments (server-authoritative since the M6
React cutover), M8 Patient Check-In with the shared Visit / Clinical Encounter (see "M8 Check-In and Visit") and M9
Patient Queue Management (see "M9 Queue" below). Every other business module (treatments, HMO, billing, prescriptions,
messages, loyalty, marketing) is still frontend-local — see "Frontend-local boundary" below.

## Running it locally

Two servers, in separate terminals:

```
cd backend && php artisan serve --port=8000   # Laravel API — see backend/README.md for first-time setup
npm run dev                                    # Vite frontend, http://localhost:5173
```

Visit `http://localhost:5173` — **use `localhost`, not `127.0.0.1`**. The backend's session/CSRF cookies are
scoped to `domain=localhost` (`backend/.env`'s `SESSION_DOMAIN`); a browser (or `curl`) that connects via
`127.0.0.1` will never receive them back, and login will silently fail to persist.

## `VITE_API_BASE_URL`

The frontend's only new configuration. Defaults to `http://localhost:8000` (`src/api-client.js`) if unset — no
`.env` file is required for the default local setup. To override, copy `.env.example` to `.env` (gitignored).

## Demo accounts

Seeded by `backend`'s `DemoAccountsSeeder` (`php artisan db:seed`; see `backend/README.md`). Password for all:
`DEMO_ACCOUNT_PASSWORD` env var, or the fallback `DemoPass123`.

| Email | Role | Frontend identity you land on |
| --- | --- | --- |
| `patient@example.test` | Patient | **Maria Santos** (existing, already-populated local Patient — see "Identity bridge" below) |
| `staff.reception@example.test` | Staff | Alyssa Cruz (Receptionist) |
| `staff.assistant@example.test` | Staff | **None — fails closed** (see below) |
| `dentist@example.test` | Dentist | Dr. Miguel Reyes |
| `owner@example.test` | Owner | Dr. Dana Roxas |

## Real login/register flow

- **Login** (`Login` in `src/layout.jsx`): one real email+password form for every role — there is no client
  role picker. `POST /api/login` via `src/api-client.js`, Sanctum SPA session cookies only (`credentials:
  'include'`), never a bearer token in `localStorage`. Errors are generic for unknown-email/wrong-password,
  distinct for an inactive account, and never expose Laravel/Sanctum/HTTP-status vocabulary.
- **Registration** (`PatientRegister` in `src/pages/PatientRegister.jsx`): Patient-only, `POST /api/register`.
  Creates a real `Person`+`Patient`+`User` in PostgreSQL inside one transaction and auto-authenticates — no
  separate "now sign in" step. No "Preferred branch" field: the current backend registration contract collects
  no branch preference (see `backend/README.md`); the identity bridge defaults it locally.
- **Session restoration** (`App.jsx`): on every load, `GET /api/me` is the *only* source of truth for whether
  someone is signed in and what role they have. `localStorage` is never treated as proof of authentication or
  role.
- **Logout**: `POST /api/logout`. The local compatibility session always clears (never a stuck authenticated
  shell), but the message told to the user is honest about whether the backend actually confirmed the session
  was invalidated — see "Honest logout" below.

## Identity bridge (`src/identity-bridge.js`) — TEMPORARY, remove as modules migrate

Most business modules (appointments, queue, treatments, billing, HMO, …) are still frontend-local collections
in `localStorage`. The backend is authoritative for identity/role; this module's only job is translating a
real, backend-authenticated identity into the local `Person`/`Patient`/`User` shape those still-local pages
already expect, so nothing else in the app had to change.

**Staff/Dentist/Owner** map through one explicit, literal table keyed by the exact Backend 1A seed email, each
entry also re-checking that the backend's own role matches — email alone is never sufficient authority:

- `owner@example.test` → Dana Roxas
- `staff.reception@example.test` → Alyssa Cruz
- `dentist@example.test` → Dr. Miguel Reyes
- **`staff.assistant@example.test` has no entry.** `ROLE_INFO` defines exactly one local Staff operational
  identity, already claimed by `staff.reception@example.test`; mapping a second, distinct backend person to
  that same local identity would mean two different backend people sharing one local Staff account, which must
  never happen. This account authenticates fine at the backend but fails closed in the frontend with a clear
  "no workspace configured yet" message. **Known limitation** — a second local Staff identity would need to
  exist before this account can be mapped.

**Patient** works two ways:
- The one aligned demo account (`patient@example.test`) explicitly maps to the existing, already-populated
  local Patient (Maria Santos) — so logging in through the real backend still demonstrates her existing
  appointments/care history for a demo, instead of a second, empty duplicate Patient.
- Any other backend Patient (i.e. a real registration) gets a general-purpose upsert: a minimal local
  Person/Patient/User row is created on first login (keyed by the backend user's `public_id` and the
  server-resolved `me.patient.id`, so a second login reuses it — never a duplicate), with genuinely empty history —
  no appointment, treatment, invoice or HMO case is fabricated. A Patient account for which the server returns no
  Patient record fails closed. A projection saved by an older build under the numeric backend user id is re-keyed
  once to the public ids when exactly one local Patient projection has that login email; more than one fails
  closed. This re-key is a temporary compatibility migration of browser data only (the server-returned Patient
  public_id stays the authority); remove it once the remaining browser-local Patient-dependent collections have
  moved to backend authority.

## Honest logout

`src/api-client.js`'s `logout()` only reports `backendConfirmed: true` when `POST /api/logout` itself actually
succeeded. On a network/server failure, the local session still clears (so the UI never gets stuck), but the
message shown is a distinct warning that the server session close couldn't be confirmed — never "You're signed
out" when that wasn't actually confirmed.

## CSRF

Sanctum's standard SPA flow: `GET /sanctum/csrf-cookie` before any state-changing request. A `419` (stale
token) triggers exactly one automatic refetch-and-retry — never a loop.

## Frontend-local boundary

Everything below `App.jsx`'s auth gate — Dashboards, Scheduling, PatientFlow, Clinical, FinanceCommunication,
Admin, HMO, Messages, Loyalty, etc. — is unchanged and still reads/writes the same `localStorage` collections
it always has, **except** the six reference-data collections Phase 2A covers (below), appointments (M6) and arrival
records / Visits (M8) and the queue (M9, below), which are never stored in the browser any more. The identity bridge
exists only so those still-local pages can keep working before their own data moves to PostgreSQL in a later
checkpoint.

## Backend Phase 2A — branch/service/staff/dentist reference data

Branches, Services, Branch-Services, Staff profiles, Dentist profiles and Dentist-Service eligibility are now
PostgreSQL-authoritative. `src/reference-data-bridge.js` is the read/write translation layer — the direct
continuation of the same `identity-bridge.js` pattern above, not a new architectural idea.

**Read endpoints** (`auth:sanctum`, `GET`): `/api/branches`, `/api/services`, `/api/branch-services` (flat,
complete — the bootstrap actually fetches this one, not the scoped `/api/branches/{branch}/services`
convenience endpoint below), `/api/dentists`. `/api/staff` is role-gated `staff,dentist,owner` — Patient is
denied server-side, and the frontend bootstrap never calls it for a Patient session either (least privilege
at both layers). `/api/branches/{branch}/services` exists as a scoped convenience, currently unused by the
bridge. Every route parameter (`{branch}`, `{staffProfile}`, `{dentistProfile}`) binds by a stable
`legacy_ref` string (e.g. `b1`, `d1`), never the internal bigint primary key — the frontend never sees or
sends a bigint ID for these resources.

**Mutation endpoints** (`role:owner` only): `PATCH /api/branches/{branch}`, `POST /api/branch-services` (body
`branch_ref`/`service_ref`/`active`), `PATCH /api/staff/{staffProfile}`, `PATCH /api/dentists/{dentistProfile}`
(accepts an optional `branch_ids[]` replace-set). These wire the *existing* Owner Admin UI (`BranchesPage`,
`TeamPage` in `src/pages/Admin.jsx`) — the API call happens first, and only the server-confirmed response is
adopted into local state (`adoptBranchFromServer`/`adoptBranchServiceFromServer`/`adoptPersonnelFromServer`
in `src/administration.js`, additive alongside the pre-existing `saveBranch`/`setBranchService`/
`savePersonnel` — never re-validated locally against an already-server-confirmed payload). No create/delete
endpoint exists for any of these — only what the current UI already does.

**`legacy_ref` / `legacy_user_ref`** are purely transitional bridge keys (not business identifiers), letting
still-local collections (`appointments`, `queue`, `treatments`, etc.) keep resolving today's string IDs
unchanged. `legacy_user_ref` specifically lets a bridged Dentist/Staff record's `userId` field resolve
against the still-local, unchanged `state.users` collection — account activity/status is **not**
backend-authoritative this phase (see `MODULE_COVERAGE.md`'s M6 row, which now includes Smart Scheduling).

**M1 User & Access Management** (the User Management screen) is a separate backend-authoritative account collection at `GET/POST /api/users`,
`PATCH /api/users/{user}`, and `DELETE /api/users/{user}`, where `{user}` and every returned `id` are the user's
ULID `public_id` (the bigint stays internal). Owner-only `GET /api/users/{user}/branch-scopes` and
`PUT /api/users/{user}/branch-scopes` (`{"branch_refs": ["b1", ...]}`, replaces the whole set; `[]` removes all
access; repeated branches are rejected) manage a Staff account's authorization branch scopes in
`user_branch_scopes` — zero, one or many branches, Staff accounts only, never derived from operational work
assignment. A Staff account cannot change its own scopes. Scope changes are not audited yet: future M22 integration
should audit branch-scope assignment and removal as security-sensitive events. The Owner screen fetches it on demand through
`src/user-management-bridge.js`; it never replaces transitional `state.users`. It can create only Patient
accounts (atomic PERSON + PATIENT + USER creation), edit first/last/email/phone, display role read-only, and
soft-delete login access while preserving the Person and linked records. Passwords are validated and hashed
server-side and never returned or stored in frontend state. The API is Owner-only; Staff/Dentist/Owner creation,
role reassignment, title/personnel editing, password editing, invites, reset and restore workflows are not
available. Staff/Dentist creation remains disabled in the UI pending profile provisioning, and soft-deleted
emails remain reserved by the existing unique constraints.

**Demo/reference data seeding** (`BranchSeeder`, `ServiceSeeder`, `BranchServiceSeeder`, `StaffProfileSeeder`,
`DentistProfileSeeder`, `DentistBranchSeeder`, `DentistServiceAssignmentSeeder`) follows the exact same
`app()->isProduction()` refusal gate as `DemoAccountsSeeder` above — schema migrations themselves carry no
such gate (structure must be identical in every environment; only demo/reference *data* is production-gated).
`StaffProfileSeeder`/`DentistProfileSeeder` attach `s1`/`d1` to the *existing* real Person behind
`staff.reception@example.test`/`dentist@example.test` (no new Person/User/credential); the other 8 roster
members get a real `persons` row (name/contact only) with no linked `users` row at all — nothing to log in
with.

## Backend Wave 1 — M6 Appointment Booking & Smart Scheduling

Laravel/PostgreSQL is the only appointment authority (see "M6 React cutover" below for how the React app uses it).

Tables: `appointments` (ULID `public_id`, FKs to `patients`/`branches`/`services`/`dentist_profiles`, `starts_at`/
`ends_at` timestamptz, duration snapshot, status, source, assignment method, `revision`), append-only
`appointment_history` (a trigger rejects UPDATE/DELETE) and `appointment_command_keys` (Idempotency-Key records).
Shared prerequisites added for M6: `user_branch_scopes` (authorization branch scope: zero, one or many branches per
account, unique per user/branch, separate from operational assignment; M6 only reads it and M1 will own its
administration) and `patients.public_id` (ULID API identity, backfilled for existing rows; `patient_code` stays the
clinic-facing code and the bigint id stays internal). PostgreSQL exclusion constraints (`btree_gist`, see
`backend/README.md`) prevent concurrent Dentist or Patient overlaps.

All routes require `auth:sanctum` and an Active account; `{appointment}` is the ULID public id and responses carry
`patient.id` as the Patient public id — no internal bigint is accepted or returned. A Patient's own bookings are
always derived from the authenticated account (any Patient identifier they send is refused); Staff/Owner name the
Patient by `patient_id` (public id). Branch, service and Dentist are referenced by their transitional `legacy_ref`
(`b1`, `svc1`, `d1`).

| Method | Path | Roles | Notes |
| --- | --- | --- | --- |
| GET | `/api/appointments` | Patient (own), Staff (scope branch), Dentist (own assigned), Owner (all) | `?date=YYYY-MM-DD&status=`; paginated `{data, links, meta}` |
| GET | `/api/appointments/{id}` | same scope as above | includes `history` |
| GET | `/api/appointments/availability` | Patient, Staff (scope branch), Owner | `branch_ref, service_ref, date`, optional `patient_id` (Staff), `appointment_id` (reschedule) |
| GET | `/api/appointments/recommendation` | Patient | Smart Scheduling: `service_ref`, optional `branch_ref` or `latitude`/`longitude`; reserves nothing |
| POST | `/api/appointments` | Patient (self, auto-assigned Dentist), Staff (scope branch), Owner | optional `Idempotency-Key` header |
| POST | `/api/appointments/{id}/reschedule` | Patient (own; date/time only), Staff (scope), Owner | requires `expected_revision`; stale → 409 `stale_revision` |
| POST | `/api/appointments/{id}/cancel` | Patient (own; before start), Staff (scope), Owner | requires `expected_revision` |

Errors: 422 `{message, errors, code}` (`schedule_invalid` also returns `failed_checks` and up to five
`alternatives`; `idempotency_key_reused`, `appointment_not_reschedulable`, `appointment_not_cancellable`,
`appointment_started`), 409 `stale_revision` / `schedule_conflict` (lost a concurrent race), 401/403.

Rules applied server-side: Patient dates tomorrow through one calendar month after tomorrow (inclusive, Asia/Manila)
on hourly start times; Staff/Owner not before now, on 30-minute start times; service-specific duration (branch
override first); branch status/hours, branch service, Dentist branch/service/shift/availability, Dentist and Patient
overlap; deterministic Dentist assignment (fewest booked minutes that day, then lowest Dentist profile id).
Schedulability comes from M3 Dentist data only: a Dentist with no login (or an inactive one) is still bookable, while
the Dentist's own portal access still requires an active login. (The browser prototype's `dentistsFor` still also
requires an active account; that transitional difference goes away at cutover.) Not yet available: branch closures/holidays (no closure data exists — none is invented), branch
coordinates (all NULL, so location ranking reports `location_ranking: "unavailable"`), payment-based cancellation
rules (no backend payment data yet), follow-up-linked bookings, and a management endpoint for Staff scope (demo
Staff logins are scoped to `b1` by `DemoStaffScopeSeeder`).

## M6 React cutover

React reads and writes appointments only through the M6 API:

- `src/appointments-api.js` — the single client: bounded list loading (`from`/`to`, paged), availability,
  recommendation, create/reschedule/cancel and lifecycle commands, one `Idempotency-Key` per confirm attempt, and
  normalized failures (`409 schedule_conflict` → "That time was just taken"; `409 stale_revision` → refresh and
  review; `422 schedule_invalid` → checks not met plus alternative start times).
- `src/appointment-flow.js` — server-first command flows used by the store. Check-In, No-show and treatment
  start/completion (still browser-local M8/M9/M5 prototypes) run a no-commit dry run of the local step, then the
  server transition, then the local record; if only the local step fails the page says so and offers a retry (the
  Check-In page lists server-Checked-In appointments without a local arrival record). Remove each adapter when its
  module becomes backend-authoritative.
- `src/appointment-projection.js` — the in-memory read model (`state.appointments`, never persisted) plus read-model
  Patients for server Patients with no local projection, keyed by the server Patient `public_id` (the signed-in
  Patient's own appointments map to their session). Legacy classification (D5): queue/check-in/treatment/invoice/
  prescription/follow-up/HMO/conversation records that reference pre-cutover browser appointments (directly or through
  a legacy treatment/queue entry) are read-only history, excluded from live worklists and KPIs.
- Staff branch reach in the UI follows `/api/me` `branch_scopes`; Staff pick Patients from `GET /api/patients`.
- Appointment additions for the cutover: bounded `from`/`to` list range (max 184 days), server-generated immutable
  `appointment_code` (APT-YYYY-NNNNNN), `dentist_ref` on availability (Staff/Owner only; a Patient reschedule search is
  limited to the current Dentist), and named lifecycle commands (since M8: only the pre-arrival `no-show` remains an
  appointment command — see "M8 Check-In and Visit").
- Follow-ups (approved transitional rule until M20 is backend-authoritative): the Dentist records/recommends the
  follow-up; clinic Staff (or the Owner) book it as a normal server appointment and the local follow-up stores only the
  returned public id (`linkFollowupAppointment`). Dentists and Patients have no booking path through this bridge.
- Expired server session: any M6 call answered with 401 reports `api.onSessionInvalidated` (`src/api-client.js`); the
  app shell revalidates with `/api/me` and, unless the same account is confirmed, returns to the normal signed-out Login
  state ("Your session has ended. Sign in again."). The failed command is never retried; Booking Drafts are kept.
- The appointment list is a bounded working window (`appointmentWindow`), never all-time history; Analytics labels the
  Scheduling metric with that window.
- Old `dentalops-v4-appointments` browser data is not read, uploaded or cleared. `INITIAL_APPOINTMENTS` is gone.
- Treatment records are still per-browser prototypes (M5 backend work removes this). The queue became
  server-authoritative in M9 (below).

## M8 Check-In and Visit

Laravel/PostgreSQL is the only authority for Patient arrival and for the Visit / Clinical Encounter (CONTRACTS.md §3).
A Visit is shared infrastructure, not a numbered module.

- **Schema** (`2026_09_30_000100_create_visits_table`): `visits` (ULID `public_id`; Patient and branch required;
  optional appointment; `source` `appointment`|`walk_in`; `status` Checked In → In Treatment → Completed; nullable
  responsible Dentist; optional requested service; server `arrived_at` and Asia/Manila `clinic_date`; `revision`;
  actors; `closed_at`), append-only `visit_history` (trigger) and `command_keys` (idempotency for the M8 commands).
  PostgreSQL enforces: source ⇔ appointment presence (no fake appointments), one Visit per appointment, at most one
  active Visit per Patient (any branch/day), `closed_at` exactly when Completed.
- **Commands** (`VisitService`, all in one transaction, idempotent, with Visit history):
  - `POST /api/visits/check-in` `{appointment_id, expected_revision}` + `Idempotency-Key` (required): locks the
    appointment, checks revision/state/today/no Visit/no other active Visit, moves the appointment to Checked In (with
    appointment history) and opens the Visit — both or neither.
  - `POST /api/visits/walk-in` `{patient_id, branch_ref, service_ref?, dentist_ref?}` + `Idempotency-Key` (required):
    branch Open and within hours, service Active and offered, and — when a Dentist is given — Dentist eligible,
    available and within shift. No appointment is created and no Dentist time is reserved.
  - `POST /api/visits/{visit}/start-treatment|complete` `{expected_revision}`: only the responsible Dentist; a Visit
    without one is refused (`dentist_unresolved`); a scheduled Visit moves its appointment in the same transaction.
  - `POST /api/patients` (Staff with a branch scope, or Owner) + `Idempotency-Key`: minimal front-desk registration —
    Person + Patient, no User/login; an existing email is refused (`patient_email_exists`); no fuzzy matching/merging.
- **Reads**: `GET /api/visits` (bounded `date`/`from`/`to`, default today, paginated; Staff by branch scope, Dentist
  own responsible Visits, Owner all; Patients have no Visit API yet) and `GET /api/visits/{visit}` (with history).
- **Retired M6 commands**: `POST /api/appointments/{id}/check-in|start-treatment|complete` no longer exist (404).
  `no-show` remains an appointment command for a Pending/Confirmed appointment today (the Patient did not arrive; no
  Visit). No-show and cancellation are refused once a Visit exists — closing an admitted visit needs a future
  Visit/Queue clinic policy.
- **Backfill** (`2026_09_30_000200_backfill_visits_from_appointments`, `App\Services\Visits\VisitBackfill`): Visits
  for appointments already checked in through the retired commands, from server data only (exact `appointment.checked_in`
  history time, canonical Patient/branch/Dentist). Missing facts or a second active Visit are reported, never guessed;
  appointments checked in then closed as Cancelled/No-show are reported (no Visit state for them). Reversible.
- **Shared idempotency**: `App\Support\IdempotentCommand` (extracted unchanged from the M6 service; M6 tests prove it).

Frontend (`src/visits-api.js`, `src/appointment-flow.js`, `src/store.jsx`):

- Visits load with appointments for Staff/Dentist/Owner (same bounded window) into an in-memory, never-persisted
  `state.visits`; local patches can never write `visits`. 401s use the shared session-invalidated path.
- Check-In / Walk-In: dry run of the local queue step → server command → refresh → `admitVisit(visitId)` creates the
  local M9 queue entry from the Visit (idempotent; also the retry path — CheckInPage lists Visits without a local queue
  entry). The walk-in form still requires a Dentist because the local queue is Dentist-organized.
- Treatment: Visit command first → refresh → local M5 record (carries `visitId`); a local failure keeps server truth and
  shows a retry state. Invoices also carry `visitId`.
- Legacy: the `dentalops-v4-check-ins` collection is no longer read (not uploaded or cleared). A queue entry is live only
  with a server `visitId`, or when its exact server appointment id matches a backfilled Visit (then re-linked); pre-cutover
  appointment ids and browser-only walk-ins are read-only history, excluded from live views and KPIs.
- Patient read views have no Visit projection yet (D9): they validate encounters from the local links alone
  (`visitsProjected: false`); Staff/Dentist/Owner fail closed when a Visit is missing.

## M9 Queue

Laravel/PostgreSQL is the only queue authority; the queue is anchored to the Visit (never to the appointment).

- **Schema** (`2026_10_01_000100_create_queue_tables`): `dentist_queues` (branch + Dentist + Asia/Manila clinic day
  container and atomic number counter), `queue_entries` (ULID `public_id`, unique `visit_id`, `dentist_queue_id`,
  `queue_number`, status Waiting / Called / Treatment Ready / Temporarily Away / Served, priority Normal / Priority /
  Urgent with reason, `revision`, `closed_at` exactly when Served, actors) and append-only `queue_entry_history`
  (trigger). Constraints: one entry per Visit; UNIQUE (queue, number); numbers ≥ 1; many active entries per queue.
- **Creation**: `QueueService::enqueue` runs inside the M8 arrival transaction (scheduled Check-In or Walk-In) when the
  Visit has a responsible Dentist; any failure rolls back the whole arrival. A Visit without a Dentist is not queued.
  Numbers come from `INSERT … ON CONFLICT … DO UPDATE SET next_number = next_number + 1 RETURNING` (first = 1).
- **Commands** (Idempotency-Key required + `expected_revision`; today's queue only; no generic PATCH):
  `POST /api/queue/{entry}/call|ready|away|return` and `POST /api/queue/{entry}/priority` `{priority, reason}`.
  Staff (branch scope) / Owner may do all; the queue's own Dentist may only Call. Served happens only through
  `POST /api/visits/{visit}/start-treatment`, which requires a Called / Treatment Ready entry and moves queue entry,
  Visit and appointment together (lock order appointment → Visit → queue entry). Completion leaves the entry Served.
- **Reads**: `GET /api/queue?date=&branch_ref=&dentist_ref=` (default today; Staff by scope, Dentist own queues,
  Owner all; server positions: Waiting / Called / Treatment Ready only, Urgent > Priority > Normal, then exact Visit
  arrival, then number) and `GET /api/queue/{entry}` (with history). `GET /api/queue/mine` is the Patient's own current
  queue state only (phase, own number and position, display context) — identity from the session, no list, no other
  Patients, no wait estimate.
- **Backfill** (`2026_10_01_000200_backfill_queue_entries_from_visits`, `App\Services\Queue\QueueBackfill`): server
  Visits only — Checked In + Dentist → Waiting / Normal (numbered by exact arrival, then Visit id); In Treatment →
  Served at the exact `visit.treatment_started` time (missing → reported); Completed or no Dentist → none.
  Idempotent and reversible. **Cut over while the queue is empty / outside clinic activity**: browser-only Called,
  Treatment Ready, Temporarily Away and priority cannot be reconstructed and are never uploaded.

Frontend (`src/queue-api.js`, `src/appointment-flow.js`, `src/store.jsx`):

- Staff/Dentist/Owner load today's server queue with appointments and Visits into an in-memory `state.queue`; a Patient
  loads `state.myQueue` from `/api/queue/mine`. Neither is persisted; local patches can never write them. The projection
  keeps the real queue status and adds a display status (Served + Visit In Treatment → "In Treatment").
- Queue commands and arrival are server-only; treatment start runs the Visit command first, then the local M5 record,
  which stores `visitId` and the server queue entry id. Queue screens (Staff/Dentist queue, Patient Live Queue) refresh
  every 30 s only while mounted and visible (no websockets).
- One-time local evidence re-anchor (compatibility, remove with M5/M11 backends): local treatments/invoices that reach
  a server Visit through an exact browser-queue link persist that `visitId` (and the server queue entry id where one
  exists); nothing is matched by Patient, Dentist, branch or date. `dentalops-v4-queue` is no longer live state and is
  not uploaded or cleared.
- Completed-encounter evidence (billing, prescriptions, follow-ups) is the server Visit (`completedEncounter`), not a
  browser queue row. Wait estimates, capacity and workload stay client-side M10 calculations over the projection.
