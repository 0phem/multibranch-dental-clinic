# Backend Integration (Foundation 1B + Phase 2A)

Scope: authentication, registration, session restoration, logout and RBAC (Foundation 1B), plus branch/
service/staff/dentist reference data (Phase 2A — see its own section below). Every other business module
(appointments, scheduling execution, queue, treatments, HMO, billing, prescriptions, messages, loyalty,
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
  Person/Patient/User row is created on first login (keyed by the backend's own user id, so a second login
  reuses it — never a duplicate), with genuinely empty history — no appointment, treatment, invoice or HMO case
  is fabricated.

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
it always has, **except** the six reference-data collections Phase 2A covers (below). The identity bridge
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
backend-authoritative this phase (see `MODULE_COVERAGE.md`'s M7 row).

**M1 User Management** is a separate backend-authoritative account collection at `GET/POST /api/users`,
`PATCH /api/users/{user}`, and `DELETE /api/users/{user}`. The Owner screen fetches it on demand through
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
