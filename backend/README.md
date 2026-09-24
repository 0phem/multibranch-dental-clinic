# Dr. Dana E. Roxas Dental Clinic — Backend (Foundation 1A)

**Scope of this checkpoint: authentication, registration and RBAC only.** No appointments, treatments, queue,
HMO, billing, or loyalty backend exists yet. See "Known limitations" below.

The existing React/Vite frontend (`../src`) does not talk to this backend yet — that wiring is a separate,
later checkpoint ("Backend Foundation 1B").

## Stack

- Laravel 13 (PHP ^8.3)
- PostgreSQL (real local Postgres — not SQLite)
- Laravel Sanctum, configured for **first-party SPA session-cookie authentication** (not bearer tokens in
  localStorage) — the intended pattern for the future Vite frontend

## Canonical identity model

`PERSONS` is the shared identity hub. `USERS` and `PATIENTS` are independent siblings, each holding its own
`person_id` foreign key back to `PERSONS`. There is no `PATIENTS.user_id` and no `PERSON → USER → PATIENT`
chain — a Person can exist with no User at all. This mirrors the frontend's ERD_ALIGNMENT.md identity model.

- `persons` — first/middle/last name, unique nullable email, phone, date_of_birth, sex, address
- `users` — `person_id` (unique FK), unique `email`, hashed `password`, `role`, `account_status`
  (`Active`/`Inactive`), nullable `title` (display-only Staff duty focus — never used for authorization)
- `patients` — `person_id` (unique FK), unique `patient_code`, `consent`

## RBAC

Four canonical roles only: `patient`, `staff`, `dentist`, `owner` (`App\Enums\Role`). Enforced entirely
server-side via `App\Http\Middleware\EnsureUserHasRole` (route middleware alias `role:<role>`), which reads only
the authenticated user's `role` column — never client-supplied input, and never the display-only `title` field.
An `Inactive` account is rejected even if its role matches.

## API

| Method | Path | Auth | Notes |
| --- | --- | --- | --- |
| POST | `/api/register` | none | Patient self-registration only |
| POST | `/api/login` | none | Session-cookie login |
| POST | `/api/logout` | session | Invalidates the session |
| GET | `/api/me` | session | Current identity |
| GET | `/api/rbac-demo/{patient,staff,dentist,owner}-only` | session + role | Proof-of-concept RBAC endpoints only — not a business API |

### Registration contract

`POST /api/register` accepts `first_name`, `middle_name` (optional), `last_name`, `email`, `phone`,
`date_of_birth` (optional), `password`, `password_confirmation`. Creates a `Person` → `Patient` → `User` (role
`patient`, status `Active`) inside one DB transaction, then logs the new user in.

Reserved fields (`role`, `role_name`/`roleName`, `permissions`, `account_status`/`accountStatus`, `title`,
`person_id`/`personId`, `patient_id`/`patientId`, `user_id`/`userId`, `id`) are rejected outright with a 422
field-level validation error if present in the request body — public registration can never choose a role or
any internal ID. Enforcement is two-layered: the `FormRequest`'s `prohibited` rules reject the request, **and**
the controller only ever writes fields it explicitly reads off `$request->validated()`, so no unlisted field
could reach the database even if a validation rule were ever missed.

A likely-duplicate Patient (matching phone, or matching first+last name and date of birth) is rejected with a
generic message that does not disclose which existing record matched (mirrors the frontend's
`possibleDuplicatePerson` check).

### Login contract

`POST /api/login` accepts `email`, `password`. An unknown email and a wrong password return the **same** 422
message (anti-enumeration). An `Inactive` account gets a distinct message. A successful login regenerates the
session ID (session-fixation protection).

### `/api/me`

Returns the authenticated identity via `App\Http\Resources\UserResource`: `id`, `person_id`, `patient_id`
(when applicable), `name` (derived from the related Person — not a stored column), `email`, `role`, `title`,
`account_status`. Never includes `password` or `remember_token`.

## Sanctum / CORS / CSRF for the future SPA

- `bootstrap/app.php` calls `$middleware->statefulApi()` so `/api/*` requests from a configured frontend origin
  get session-cookie (not bearer-token) authentication.
- `config/cors.php` is scoped to `FRONTEND_URL` (default `http://localhost:5173`) with `supports_credentials`
  true — not a wildcard origin, since wildcard + credentials is disallowed by browsers anyway.
- `SANCTUM_STATEFUL_DOMAINS` must include the frontend's host:port (see `.env.example`).
- Backend 1B will need to `GET /sanctum/csrf-cookie` before any state-changing request, per Sanctum's standard
  SPA flow — no custom CSRF mechanism was invented here.

## Local setup

1. Install PHP 8.3+, Composer, and a local PostgreSQL server.
2. `composer install`
3. `cp .env.example .env` then fill in `DB_USERNAME`/`DB_PASSWORD` for your local Postgres role (do not commit
   real credentials — `.env` is gitignored).
4. `php artisan key:generate`
5. Create the database: `createdb dental_clinic` (name must match `DB_DATABASE` in `.env`)
6. `php artisan migrate`
7. Seed demo accounts: `php artisan db:seed` (see below)
8. `php artisan serve`

### Running tests

Tests run against a **real, separate** PostgreSQL database, not SQLite, so "PostgreSQL was tested" is actually
true here.

1. `createdb dental_clinic_test`
2. `cp .env.testing.example .env.testing`, fill in your local Postgres host/port/username/password
3. `php artisan key:generate --env=testing` (Sanctum's stateful-SPA cookie middleware needs its own app key for
   the test environment)
4. `php artisan test`

`phpunit.xml` fixes `DB_CONNECTION=pgsql` and `DB_DATABASE=dental_clinic_test` directly (both safe, non-secret
values); the machine-specific host/port/credentials come from the gitignored `.env.testing`.

Feature tests that exercise the session-cookie login/logout lifecycle send a `Referer: http://localhost:5173`
header (see `tests/TestCase.php`) so Sanctum's stateful-SPA middleware recognizes them as frontend requests,
exactly as it will for the real Vite app later.

### Demo/dev seed accounts

`php artisan db:seed` runs `DemoAccountsSeeder`, which refuses to run when `APP_ENV=production`. It creates one
account per role:

| Role | Email | Title |
| --- | --- | --- |
| Patient | `patient@example.test` | — |
| Staff | `staff.reception@example.test` | Receptionist |
| Staff | `staff.assistant@example.test` | Dental Assistant |
| Dentist | `dentist@example.test` | — |
| Owner | `owner@example.test` | — |

Password for all demo accounts: the value of `DEMO_ACCOUNT_PASSWORD` in your `.env` if set, otherwise the
local-dev-only fallback `DemoPass123`. This is not a secret worth protecting (it only ever unlocks a throwaway
local database) but is not hardcoded as plaintext in any tracked file beyond this placeholder documentation.

## Known limitations (this checkpoint only)

- No appointments, treatment, queue, HMO, billing, or loyalty tables or endpoints exist yet.
- No password reset / email verification flow.
- No profile-editing endpoints.
- No rate limiting has been added beyond Laravel's defaults.
- Staff `title` is a free-text display field with no catalog/validation of allowed values yet.
- The frontend is not wired to this backend yet (Backend Foundation 1B).
