# Backend Integration (Foundation 1B + Phase 2A)

Scope: authentication, registration, session restoration, logout and RBAC (Foundation 1B), branch/service/
staff/dentist reference data (Phase 2A), M1/M4 identity, M6 appointments (server-authoritative since the M6
React cutover), M8 Patient Check-In with the shared Visit / Clinical Encounter (see "M8 Check-In and Visit") and M9
Patient Queue Management (see "M9 Queue" below), M5 Treatment, the M13 pricing foundation and the minimal M12 HMO
foundation (see "M12 HMO foundation"). Every other business module (billing, prescriptions, messages, loyalty,
marketing) is still frontend-local — see "Frontend-local boundary" below.

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
records / Visits (M8), the queue (M9) and clinical Treatments (M5, below), which are never stored in the browser any
more. The identity bridge
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
  Staff (branch scope) / Owner may do all; the queue's own Dentist may only Call. Served happens only through the M5
  Treatment start `POST /api/visits/{visit}/treatment` (see "M5 Treatment" below), which requires a Called / Treatment
  Ready entry and moves queue entry, Visit, appointment and the new Treatment together (lock order appointment → Visit
  → queue entry → Treatment). Completion leaves the entry Served.
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
- Queue commands and arrival are server-only; since M5 treatment start is also a single server command (no local
  treatment record). Queue screens (Staff/Dentist queue, Patient Live Queue) refresh
  every 30 s only while mounted and visible (no websockets).
- One-time local evidence re-anchor (compatibility, remove with M5/M11 backends): local treatments/invoices that reach
  a server Visit through an exact browser-queue link persist that `visitId` (and the server queue entry id where one
  exists); nothing is matched by Patient, Dentist, branch or date. `dentalops-v4-queue` is no longer live state and is
  not uploaded or cleared.
- Completed-encounter evidence (billing, prescriptions, follow-ups) is the server Visit (`completedEncounter`), not a
  browser queue row. Wait estimates, capacity and workload stay client-side M10 calculations over the projection.

## M13 pricing foundation

The smallest authoritative pricing M11 needs; not the full M13 module.

- **Schema** (`2026_10_03_000100_create_service_prices_table`): `service_prices` — ULID `public_id`, `service_id`,
  nullable `branch_id` (null = base clinic price), `kind` priced / ended, `amount numeric(12,2)` (present exactly when
  priced, > 0), `effective_from` (Asia/Manila date), server-assigned `source = owner_confirmed`, `created_by_user_id`,
  `created_at`, and `retracted_at` / `retracted_by_user_id`. PostgreSQL enforces one non-retracted version per service +
  level + date (`NULLS NOT DISTINCT`) and an append-only trigger: no DELETE, and the only UPDATE is a one-time retraction.
  The migration creates **no** prices.
- **Resolution** (`App\Services\Pricing\PriceResolver`, internal): the latest non-retracted branch version on or before
  the date (priced → it; ended → fall back), else the latest base version (priced → it; ended → unavailable), else
  **PriceUnavailable**. It never reads `reference_fee_php`, browser data, another branch or a previous invoice. A result
  carries `price_public_id`, `level`, `service {id, code, name}`, `branch`, `date`, `effective_from`, `amount` (decimal
  string, e.g. `"1500.00"`) and `source` — what M11 snapshots on an invoice line. M11 will resolve with the Treatment's
  Visit `clinic_date`.
- **API**: Owner — `GET /api/service-prices` (all versions), `GET /api/services/{service}/prices`,
  `POST /api/services/{service}/prices` `{branch_ref?, kind, amount?, effective_from}` (amount as decimal text; today or
  later; a branch price needs the branch to offer the service; `source`/actor fields refused),
  `POST /api/service-prices/{price}/retract` (only before it takes effect), and `GET /api/prices/resolve?service_ref=&
  branch_ref=&date=`. Staff — the resolve endpoint for **today only** and only for branches in scope. Dentists, Patients:
  403; guests: 401. Create/retract require an Idempotency-Key (replay / `idempotency_key_reused`); a same-level same-date
  race yields `409 price_version_exists`.
- **Reference fee**: `services.reference_fee_php` is unchanged and stays reference/demo/unconfirmed. The Owner UI shows it
  only as "Reference fee (unconfirmed)", and the confirmed-price field always starts blank. Deprecation waits for M11.
- **Demo environments**: no seeder creates prices; the Owner enters confirmed prices on the Services & Pricing page.
- **M11 dependency**: the current browser billing prototype is unchanged and still prices local Draft invoices from the
  reference fee (not authoritative). The M11 cutover replaces it with `PriceResolver`; a Treatment whose performed
  services have no confirmed price then shows as "pricing needed" without affecting the completed Treatment.

## M5 Treatment

Laravel/PostgreSQL is the only authority for the clinical Treatment record. A Treatment is anchored to exactly one
Visit (Visit → zero or one Treatment → procedure lines); Patient, branch, appointment and clinic date are read from the
Visit, never copied.

- **Schema** (`2026_10_02_000100_create_treatment_tables`): `treatments` (ULID `public_id`, UNIQUE `visit_id`,
  authoring `dentist_profile_id`, status In Treatment / Completed, chief complaint, treatment plan, procedure summary,
  clinical notes, nullable assistant snapshot, the Dentist's `prescription_required` / `followup_required` decisions
  with the follow-up recommendation, `started_at`, `completed_at`, `revision`, actors), `treatment_procedures`
  (ULID `public_id`, `line_no`, canonical `service_id`, `quantity` ≥ 1, notes, immutable `service_code` /
  `service_name` snapshot — **no fee, amount or subtotal**) and append-only `treatment_history` (every committed
  revision with a jsonb snapshot of the documentation and procedure lines; M5 clinical history, not the M22 audit
  trail). PostgreSQL enforces: one Treatment per Visit; at most one In Treatment Treatment per Dentist at a time
  (partial unique index — not a per-day rule); `completed_at` exactly when Completed; follow-up fields only with a
  follow-up decision; a Completed Treatment and its lines are read-only; a line keeps its id, service and snapshot;
  and, at commit (deferred constraint triggers), a Visit In Treatment has its In Treatment Treatment, a Visit is never
  Completed while its Treatment is active, and a Treatment's status follows its Visit.
- **Commands** (all require `Idempotency-Key` and `expected_revision`; responsible Dentist only; lock order
  appointment → Visit → queue entry → Treatment):
  - `POST /api/visits/{visit}/treatment` (`expected_revision` = the Visit's) — one transaction: queue entry → Served,
    Visit → In Treatment, scheduled appointment → In Treatment, Treatment created In Treatment. Refusals:
    `dentist_unresolved`, 403 for any other Dentist, `queue_not_ready` / `not_in_queue`, `treatment_exists`,
    `dentist_busy`, `stale_revision`.
  - `POST /api/treatments/{treatment}/document` — the whole editable documentation and procedure-line set. Each line is
    validated (service exists, Active, offered at the Visit's branch, the Dentist authorized; integer quantity 1–99).
    A submitted line id is kept only for the same saved line and service; other lines are new; omitted lines are
    removed from the current record and remain in history. An unchanged save records no new revision.
  - `POST /api/treatments/{treatment}/complete` — requires a procedure summary and at least one still-valid line; one
    transaction: Treatment → Completed, Visit → Completed, scheduled appointment → Completed; the queue stays Served.
    Completion creates no invoice, prescription, follow-up or HMO case.
  - The standalone `POST /api/visits/{visit}/start-treatment` and `/complete` endpoints are retired (404).
  - Post-completion amendment is **POLICY DECISION REQUIRED — P6** and is not implemented.
- **Reads**: `GET /api/treatments?date= | from=&to=` (bounded 184-day window, paginated) and `GET /api/treatments/{id}`
  (with history events). Staff: branch-scoped full clinical record, read-only. Dentist: Treatments they authored, plus
  COMPLETED Treatments of a Patient for whom they are currently the responsible Dentist on an active Visit (read-only,
  continuity of care). Owner: operational summary only (no complaint, plan, procedure summary, notes, follow-up reason
  or line notes). The per-revision documentation snapshot is returned only to the authoring Dentist.
  `GET /api/treatments/mine` (Patient): own COMPLETED Treatments only, identity from the session (a `patient_id`
  parameter is refused) — exactly `{id, date, procedure_summary, services: [{name}], dentist: {name}}`: the Treatment's
  own public id for keying plus the approved subset. No Visit, appointment, branch or service identifier. The Patient's
  Billing / Visit / HMO views link to it only through their own records' exact `treatmentId` (e.g. the M11 invoice that
  names the Treatment and its appointment); with no such record nothing is inferred.
- **Cutover** (no backfill, no fabricated shells): browser Treatment content is never uploaded. The migration refuses to
  run — and `php artisan treatments:cutover-check` exits non-zero, listing the Visits — while any Visit is In Treatment
  without a server Treatment. Deploy outside active clinical treatment; completed historical Visits get no Treatment.

Frontend (`src/treatments-api.js`, `src/appointment-flow.js`, `src/store.jsx`):

- Staff/Dentist/Owner load server Treatments in the same bounded window as appointments; a Patient loads only
  `/api/treatments/mine`. They form the in-memory `state.treatments` projection (`server: true`), never persisted and
  never written by a local patch (`commit()` drops `treatments`). The Treatment form keeps unsaved text in React memory
  only; a stale save refreshes, keeps the text and offers "Load the latest version".
- Browser-local treatments (`dentalops-v4-treatments`) are read-only **pre-server history** (`preServer`): those with
  an exact server Visit link are labelled "Recorded before server treatment records"; the rest are also legacy
  "Historical demo record". They never count as live treatment, never start a new prescription task or HMO case, and
  keep supporting only already-linked local downstream records. The key is neither uploaded nor cleared.
- **Transitional downstream adapters** (`reconcileTreatmentHandoffs`, remove as each module's backend lands): in any
  authorized Staff/Dentist browser, every completed server Treatment in scope gets — once, keyed by its public id — the
  M11 Draft invoice (`inv-<id>`, priced from the local fee configuration; an unconfigured fee is flagged for review
  instead of invented), the M20 follow-up task (`f-<id>`) and the M19 prescription-required task. Idempotent,
  role-appropriate, and it never writes the Treatment. **M18 boundary:** it creates no notification of any kind (no
  in-app record, email, SMS, delivery status, retry or schedule) — only M23 workflow-log events. Since the M12 foundation
  it no longer opens any HMO case: HMO cases are opened only on the server by Staff (see "M12 HMO foundation").
- Completion no longer appends to the Patient's `dentalHistory` text; existing text stays as earlier, read-only notes.
- **Known limitation (pre-existing, not M5):** the frontend identity bridge maps `patient@example.test` onto the seeded
  local Patient `p1`, while Staff/Dentist server workflows key the same Patient by its server public id. A local M11
  invoice reconciled/issued in a Staff browser therefore carries the public id, and the Patient's local billing filter
  (which compares the session's local key) may not show it. The Patient Treatment API is deliberately not widened for
  this; the fix belongs to future identity-bridge / M11 backend work.

## M12 HMO foundation

The smallest server-authoritative M12 that M11 needs; not the full module. Laravel/PostgreSQL is the only authority for
Patient HMO memberships, HMO cases, their lifecycle and the approved amount.

- **Schema** (`2026_10_04_000100_create_hmo_tables`):
  - `patient_hmo_memberships` — ULID `public_id`, `patient_id`, Staff-entered `provider_name` and `member_number`
    (non-empty text; there is no provider directory and nothing is seeded), status active / ended, actors and
    timestamps. At most one active membership per Patient (partial unique index); a change ends the active row and
    creates a new one, so history is kept; the only permitted update is active → ended.
  - `hmo_cases` — ULID `public_id`, **UNIQUE `visit_id`** (zero or one case per Visit), `patient_id` / `branch_id`
    (a trigger requires them to match the Visit), `membership_id` with immutable `provider_name` / `member_number`
    snapshots, status (Missing Requirements, Ready for Submission, Pending, Escalated, Returned, Approved, Rejected,
    Withdrawn), `submission_cycle`, `submitted_at`, `escalated_at`, `approved_amount numeric(12,2)` (present exactly
    when Approved, ≥ 0), `final_at` (exactly when Approved / Rejected / Withdrawn), `revision`, actors. Checks tie the
    cycle to submission (cycle 0 ⇔ never submitted; Withdrawn only at cycle 0). The guard trigger forbids DELETE and
    any change to a final case or to the anchor/snapshot columns.
  - `hmo_case_requirements` — one row per case and project rule (`hmo-card`, `valid-id`, `treatment-request`), state
    Missing / Validated with an optional metadata `document_label` only (no file — documents are M14).
  - `hmo_case_events` — append-only case history (created, requirement, submission, contact, escalation, response,
    withdrawal) with actor, method, note, outcome, provider reference and approved amount; at most one submission and
    one response per cycle (unique indexes). No UPDATE or DELETE.
- **Lifecycle** (`App\Services\Hmo\HmoCaseService`; every command needs an `Idempotency-Key`, case commands also
  `expected_revision` → `409 stale_revision`; a final case → `422 case_final`):
  - Membership: `POST /api/visits/{visit}/hmo-membership` `{provider_name, member_number, expected_active_id}`
    (replaces the active one; a mismatch → `409 stale_membership`) and `POST /api/visits/{visit}/hmo-membership/end`.
    A change needs an operational context: Staff scoped to the **Visit's** branch; the Patient is derived from that
    Visit, and a submitted `patient_id` / `patient_ref` / `branch_id` / `branch_ref` is refused (422). Any branch scope
    alone is not enough. The membership stays global to the Patient (no branch column). Reads are unchanged:
    `GET /api/patients/{patient}/hmo-membership` for Staff/Owner.
  - Open: `POST /api/visits/{visit}/hmo-case` — needs an active membership (`422 membership_required`); a second case
    for the Visit → `409 hmo_case_exists`. New cases start at Missing Requirements; the treatment-request requirement is
    validated automatically when the Visit's Treatment is already Completed ("Completed treatment record").
  - Self-pay: `POST /api/visits/{visit}/hmo/self-pay` `{reason}` — for a Visit whose Patient has a membership but no
    case; creates the case directly as **Withdrawn** (created + withdrawal events).
  - `POST /api/hmo-cases/{case}/requirements/{rule}` validates a requirement (treatment-request needs the completed
    Treatment); all three → Ready for Submission. `…/submit` (all requirements validated) starts cycle n+1 → Pending.
    `…/contact` records a follow-up contact. `…/escalate` is allowed only while Pending, once the follow-up due time has
    passed and after a contact in this cycle. `…/response` records the Staff-confirmed external provider response for
    the **current** cycle (`wrong_cycle` otherwise): Approved (with `approved_amount` as decimal text), Rejected, or
    Returned (listed requirements go back to Missing; resubmission is a new cycle). `…/withdraw` `{reason}` is allowed
    only before any submission (Missing / Ready, cycle 0).
  - Escalated is never an outcome; local completeness is never provider approval; no approval is inferred.
- **Follow-up threshold**: 12 hours after submission is a **project value** (`HmoCase::FOLLOW_UP_HOURS`), exposed only as
  the derived `follow_up_due_at`. No job, scheduler, task row, notification or automatic escalation exists (M18 / M23
  are later).
- **Financial gate** (`App\Services\Hmo\HmoFinancialGate::forTreatment` / `forVisit`; read by Staff/Owner at
  `GET /api/visits/{visit}/hmo-gate`): no membership and no case → nothing held, coverage none; membership but no case →
  `requires_claim_decision`, issue and payment held, coverage pending; Missing / Ready (preparation), Pending / Escalated
  (waiting) and Returned (action required) → issue and payment held, coverage pending; Approved → not held, coverage =
  the approved amount; Rejected → not held, coverage `"0.00"`; Withdrawn → not held, coverage none. Amounts are decimal
  strings. `GET /api/hmo/claim-decisions` lists in-scope Visits (bounded window) whose Patient has a membership but no
  case.
- **Authorization**: Staff — reads and every command, only for branches in their scope (membership changes only
  through a Visit of that Patient in their scope). Owner — read-only (cases,
  memberships, gate, claim decisions). Dentist — case summary (no member number, no history) for Visits where they are
  the responsible Dentist. Patient — `GET /api/hmo-cases/mine` only: own cases, identity from the session (`patient_id`
  refused), a safe subset (status, provider, masked member number, visit date, appointment code, branch name,
  requirement states, submitted/final times, approved amount) with no notes, contacts, actors or history. Guest: 401.
- **M11 dependency**: M11 does not consume the gate yet. When the M11 backend lands, invoice issue and payment must call
  `HmoFinancialGate::forTreatment` and be refused while it holds them; the covered amount it reports is what M11 may
  apply. The browser billing prototype is unchanged and is not held by server HMO state in this phase.
- **Operational cutover** (browser HMO records are never uploaded): 1) finish or note any open browser HMO claims
  outside the system; 2) deploy and migrate (the migration creates no cases or memberships); 3) Staff enter each HMO
  Patient's membership on the HMO page; 4) for each current Visit listed under "Claim decisions needed", open the HMO
  case or record self-pay; 5) continue earlier claims on the server case only by re-checking requirements with the
  Patient — earlier browser progress is not carried over; 6) earlier browser cases stay visible as read-only history.

Frontend (`src/hmo-api.js`, `src/pages/Hmo.jsx`, `src/store.jsx`):

- Staff/Dentist/Owner load server cases in the same bounded window as appointments, Staff/Owner also the claim
  decisions; a Patient loads only `/api/hmo-cases/mine`. They form the in-memory `state.hmo` projection
  (`server: true`), never persisted and never written locally (`commit()` drops `hmo` and `claimDecisions`).
- The browser-local HMO key (`dentalops-v4-hmo`) is read once as read-only history (`legacy`, `preServer`): shown in a
  collapsed "Earlier browser records" section, never counted in worklists or the gate, never uploaded and never cleared.
  The browser HMO timers, the local HMO commands (`src/hmo.js`) and the Treatment-completion HMO handoff are removed.
- The Patient's HMO page is read-only (no upload — M14). The Patient's earlier `hmo` / `hmoMember` profile text is
  shown only as a read-only earlier note and can no longer be edited locally.
