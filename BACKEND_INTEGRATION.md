# Backend Integration (Foundation 1B)

Scope: authentication, registration, session restoration, logout and RBAC only. Every other business module
(appointments, scheduling, queue, treatments, HMO, billing, prescriptions, messages, loyalty, marketing) is
still frontend-local — see "Frontend-local boundary" below.

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
it always has. The identity bridge exists only so those pages can keep working before their own data moves to
PostgreSQL in a later checkpoint.
