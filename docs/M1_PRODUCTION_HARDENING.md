# M1 production-readiness audit and hardening

Date: 2026-10-03. Branch: `feature/m1-auth-premium-registration-ux`. Starting HEAD: `04858495873b5041ea3a5b91e6681ff753d3ad53`. Initial working tree was clean; resumed work preserved the changes made before interruption. The initial hardening pass made no commit or push; the subsequent checkpoint is authorized separately. Public website, auth presentation and locations map were not redesigned.

Evidence terminology: the canonical four-role and ownership boundaries are project contracts. Rate limits, session revision checks, transaction locks and redaction are technical choices. None is represented as an interview-derived clinic policy.

## 1–3. Architecture, server authority and remaining prototype state

Laravel/Sanctum first-party SPA cookie authentication uses the `web` guard. The browser obtains CSRF state through `/sanctum/csrf-cookie`; credentialed requests go to `/api`. `/api/me` restores identity. Passwords are hashed through Laravel, OTP digests are hashed, and PostgreSQL owns account records and branch authorization scopes.

`User` and `Patient` are siblings linked to `Person` through separate unique foreign keys. Staff/Dentist profiles likewise link through Person; M1 does not author professional credentials. User/Patient APIs use public ULIDs, while existing reference entities retain contractual `legacy_ref` identifiers. Role is the four-case backend enum: Patient, Staff, Dentist, Owner. Staff titles do not grant server roles. Historical `Owner / Admin` and Staff title labels remain in prototype display data; they are not additional backend roles.

The live login/bootstrap path never accepts localStorage/sessionStorage as authentication. No bearer token is persisted in browser storage. Server User/Patient IDs and Staff authorization branches travel with the in-memory session. Account creation and status changes through the obsolete local administration commands now fail for server-authenticated sessions. Tampering with a persisted Patient projection's role or server Patient link fails closed at the identity bridge.

**Remaining boundary:** `src/identity-bridge.js` still has an explicit demo-email-to-operational-profile table for seeded Owner/Staff/Dentist accounts (and the seeded Patient). General Patients use server public IDs; unrecognized privileged accounts fail closed. Old local collections, role/title permission tables, `sessionForRole`, `resolvePatientLogin`, and workflow fixtures remain for unmigrated module compatibility. They are not used to authenticate the current login UI and cannot elevate backend API access. However, this is not a general production identity/profile projection. Removing/replacing it requires the deferred M2/M3 profile foundation and a migration of the dependent local projections; this report does **not** claim the whole application is free of prototype authority.

## 4. Actual M1 route authorization matrix

All authenticated routes first pass Sanctum and the new account/session-revision check. Non-Active accounts and unverified Patients cannot use protected routes. `/me` returns 401 on revocation; other already-authenticated revoked routes retain 403 with `session_revoked`. Anonymous requests return 401. Normal role refusals are 403; missing/non-public identifiers can resolve to 404 under existing route-binding conventions.

| Route | Guest | Patient | Staff | Dentist | Owner |
| --- | --- | --- | --- | --- | --- |
| POST `/register` | Patient-only registration | Public Patient-only contract | Same | Same | Same |
| POST `/register/verify`, `/register/resend` | Eligible Patient/email/code only | Same public verification contract | No privileged-account verification | No privileged-account verification | No privileged-account verification |
| POST `/login` | Credentials + account eligibility | Same | Same | Same | Same |
| GET `/me`, POST `/logout` | 401 | Own session | Own session | Own session | Own session |
| GET/POST `/users` | 401 | 403 | 403 | 403 | List / create **Patient only** |
| PATCH/DELETE `/users/{public_id}` | 401 | 403 | 403 | 403 | Safe identity edits / soft disable, with self/last-Owner safeguards |
| GET/PUT `/users/{public_id}/branch-scopes` | 401 | 403 | 403 | 403 | Read / replace Staff scope only |
| POST `/users/{public_id}/suspend`, `/restore` | 401 | 403 | 403 | 403 | Named, idempotent access commands |
| GET `/rbac-demo/{role}-only` | 401 | Own role only | Own role only | Own role only | Own role only |

No public/Owner HTTP path provisions Staff, Dentist or Owner, links an arbitrary Person/profile, or changes a canonical role. The existing Owner provisioning request accepts only `role=patient`. JSON modifications cannot override controller-assigned Patient/Active state or identity keys. M1 role changes remain unsupported rather than being introduced silently.

## 5. Branch-scope matrix

| Actor | Effective authority | Not authority |
| --- | --- | --- |
| Patient | Their server-resolved Patient ownership | Supplied Patient ID, browser identity, Staff branch rules |
| Staff | Explicit `user_branch_scopes`; zero scopes means no operational branch access | `staff_profiles.branch_id`, title, URL/query/body manipulation |
| Dentist | Existing responsible/assigned Dentist relationship through Person, as each domain policy defines | Arbitrary Staff branch scopes or an unrelated Dentist ID |
| Owner | Existing global administrative/oversight policy; existing documented operational exceptions preserved | Automatically granting every clinical/payment permission |

Existing operational authorization tests exercise wrong/no/multiple Staff scopes, branch URL/body manipulation, Patient ownership/IDOR, assigned Dentist access and Owner access. Reference branch/service catalogs remain global authenticated reference data under existing contracts; this is different from operational branch records. No M2 policy or operational assignment was changed.

## 6–8. Registration, OTP and login/session findings

**Fixed:** public routes lacked general throttling. Login now has 5 requests/minute per normalized email+IP and 30/minute per IP; registration has 30/minute per IP; verification/resend share 30/minute per IP. Existing resend 5/hour per email+IP and per-account 60-second cooldown remain. These limits use Laravel's configured cache; production must use a shared server-side cache across workers.

**Fixed:** array-valued emails could reach string conversion. Email normalization now runs only on strings, and malformed values receive 422. Password input has a 72-byte bcrypt bound (not merely character count), rejects NUL, and preserves the existing letter/number/minimum/confirmation rules. Reserved public ID, verification and branch fields are explicitly prohibited; additional unrecognized fields are not written by the controller's explicit allowlist. DOB is required, date-only and bounded by the Manila clinic date. International libphonenumber validation, E.164, +63 browser default, exact email recipient and contact-only phone semantics remain.

**Fixed:** Patient code allocation was uncoordinated with other registration paths. M1 now takes the same PostgreSQL Patient-table allocation lock already used by walk-in registration, then rechecks duplicates. Person/Patient/User/initial OTP/audit creation is transactional. Unique database email constraints remain the final authority; racing M1 unique conflicts return a safe validation response. Existing likely-duplicate-person rules are preserved, not expanded into new clinic policy.

**Fixed:** initial OTP issuance was a separate committed step, allowing a resend to race ahead of initial issuance. The first hashed code is now created in the registration transaction. Resend and verification serialize on the User row. Existing expiry, atomic five-attempt limit, previous-code invalidation and one-time consumption remain. A two-process PostgreSQL test proves simultaneous correct verification produces one 200 and one 422, one consumed code and one verification event.

**Fixed:** suspended accounts could verify into a session, and `/me`/reference routes lacked an Active-account check. The common authenticated boundary re-reads User, rejects non-Active/unverified/deleted/missing-Person state, and invalidates the session. Suspended Patients cannot verify or receive resends.

**Fixed:** email changes kept prior verification. M1 email edits clear verification, consume outstanding OTPs and revoke sessions/tokens. An old code cannot verify the new address.

**Fixed:** deleting session rows alone was insufficient against late in-flight session writes. `users.auth_version` increments on M1 changes to status, email, role or password. Login/verification record the revision in the regenerated session. Every session-authenticated API request compares it with the fresh User. Suspension followed by restoration cannot resurrect an old revision. Model changes also delete persisted sessions/tokens. Direct bulk SQL bypasses model hooks and is not an authorized account-management workflow.

Login retains generic unknown-email/wrong-password responses (with a dummy bcrypt check for unknown accounts); inactive/unverified responses require a correct password. Successful login and verification regenerate the session. Logout invalidates it and regenerates CSRF. A non-test-mode stateful request without CSRF receives 419. Frontend API handling recognizes revocation and follows the existing signed-out/revalidation path without retrying mutations.

## 9–10. Provisioning and account status

**Privileged provisioning is deliberately deferred, per explicit user decision.** No invitations, activation tokens, password emails, temporary/default passwords, privileged-account linking or duplicate professional identities were added. Existing Staff/Dentist profiles were preserved. The existing local demo-account seeder refuses to run in production; its development-only credential mechanism was not changed or used as a provisioning flow. The Owner screen continues to describe the deferral and offers only Patient creation. Owner-created Patients remain unverified until the existing email verification flow; its existing optional phone/Philippines control and profile fields were not redesigned.

New Owner-only `/suspend` and `/restore` commands persist Suspended/Active, preserve Person/profile/clinical records, are repeat-safe and audit changes. Suspending the actor or last active Owner is rejected. Commands serialize Owner/target rows and revoke sessions on both transitions. The older Inactive value is still denied and can be restored. Soft-delete remains the existing disable operation, preserving identity/history and reserving its email; no undelete or permanent deletion feature was introduced. There was no suspension/restoration UI, and this pass adds the secured API commands rather than a new administrative UI.

## 11–15. IDOR, assignment, privacy, audit and database invariants

- Account administration remains Owner-only. Manipulated numeric IDs do not bind; other roles cannot PATCH/DELETE accounts or replace scopes. Profile linking, arbitrary roles and privileged creation remain unavailable. Public fields are explicitly constructed from validated data; model fillability is not treated as request authorization.
- `/me` returns the current account's legitimate name/contact/DOB, public account/Patient IDs and applicable scopes. No password, digest, session revision, internal foreign key or verification timestamp is added. Owner account lists retain their existing limited projection. M1 failures now suppress SQL/debug/transport details even if APP_DEBUG is accidentally enabled. No clinical/M3 API projections were broadened.
- M22 receives login success/credential failure, logout, registration, email verification, Patient provision, sensitive account update, soft disable, branch-scope changes, suspension/restoration and denied M1 privileged access. Failed anonymous login events carry no submitted password/email payload. Events carry public targets and explicit safe metadata. Shared redaction additionally scrubs cookie/session keys. Credentials, OTP values and tokens are never passed as audit payloads.
- Mail exceptions are reduced to a fixed warning instead of reporting transport exception details that can contain message contents/credentials. Production OTP delivery rejects log/array/unknown transports, including unsafe failover children. Failure returns 503 and leaves the account unverified; the existing resend/recovery route can recover it. No live delivery was claimed or performed by browser fixtures.
- The existing unique User/Patient-to-Person FKs and unique User/Person emails/public IDs remain. Operational profile linkage stays in M3. A Patient without a server Patient link is not guessed by the frontend and cannot own another Patient's records; repairing legacy missing profiles is not automated. Role/status columns are still database strings backed by application enum/command allowlists, not new cross-module SQL CHECK constraints. No broad schema rewrite was made.
- Audit failure rolls back Patient provisioning instead of leaving half-created identities. Initial registration/verification writes are transactional. The test harness now verifies **both** configured and actually connected database name before RefreshDatabase can run; only `dental_clinic_test` is accepted.

## 16–17. Changes and intentional non-changes

Implemented the security fixes above, targeted adversarial coverage, a repeatable browser harness and one additive session-revision migration. Kept existing auth design, public pages/map, logo assets, module business policies, canonical roles, phone/email/DOB requirements, OTP rules and existing tests. No M2–M25 business changes; the only shared M22 edit expands credential redaction. No shared contract or process `.docx` was edited.

## 18–25. Verification

| Check | Result |
| --- | --- |
| Targeted M1 + RBAC + branch/reference authorization (fresh checkpoint rerun) | 113 passed / 627 assertions |
| Full backend suite (prior implementation verification, reused) | 356 passed / 3,016 assertions |
| Targeted frontend auth/API/identity/public-auth | 54 passed |
| Full frontend | 683 passed; zero failures/skips |
| Render smoke | 16 passing scenario groups, including role/page renders and unchanged branding hashes |
| Production build | PASS; initial JS 454.22 kB / 138.61 kB gzip; map remains deferred |
| Browser M1 regression | 107 checks passed |
| Unexpected browser runtime/console errors | 0 across Patient lifecycle and Owner management |
| `git diff --check` | PASS |

The first checkpoint rerun exposed a timezone-sensitive test fixture: UTC “tomorrow” can already be today in Manila. Only `RegistrationTest` was changed for this correction; production validation remains on the canonical `ClinicClock`. The test freezes `2026-10-03 18:00:00 UTC`, asserts Manila today is October 4, rejects October 5, accepts October 4, and checks the date-only value in the response and database. Missing and invalid DOB checks remain. Nearby M1 clock usages concern OTP elapsed-time semantics and required no changes.

The fresh affected RegistrationTest passed 23 tests / 115 assertions; the fresh targeted frontend suite passed 54 tests. Prior full backend/frontend, smoke, browser and build results are retained as implementation verification: this checkpoint correction changes only the test and this report. They were not rerun for the test-only correction.

Existing mail/payment test fixtures now stamp the session revision through the shared `actingAs()` helper, matching a real login. This preserves their original assertions and does not bypass the production check.

Browser checks cover registration state, malformed phone, missing/future DOB, masked verification, invalid/expired/reused OTP messages, cooldown, successful verification, login, refresh, actual desktop/mobile logout controls, subsequent login and revoked-session exit. Owner management was inspected at 375/1440px: Patient-only creation and explicit privileged deferral. The backend suite exercises the actual security rules; browser mutation responses are fixtures to avoid sending real mail or creating operational accounts.

| Width | Login/Register/Verification/Patient lifecycle overflow |
| --- | --- |
| 375 | 0px |
| 430 | 0px |
| 768 | 0px |
| 1024 | 0px |
| 1440 | 0px |

Owner management overflow is also 0px at both inspected widths. Screenshots/results are outside Git under `/tmp/m1-browser/`. Browser script: `scripts/m1-security-browser-qa.mjs`, with `PLAYWRIGHT_MODULE` pointing to an installed Playwright and `QA_BASE_URL` to Vite. Tests use installed Chrome; Playwright was not added to application dependencies. The map/public-site redesign QA was not repeated because this pass does not alter it.

## 26–28. Files, migration and Git

The exact changed-file list appears below. One forward-only, additive migration adds `users.auth_version` with default 0. It was exercised only by the dedicated test harness, **not applied to `dental_clinic`**. Deployment must apply this migration before serving the new code; existing pre-revision browser sessions intentionally require a new login. The migration does not remove or reassign identity/history.

Checkpoint base: `04858495873b5041ea3a5b91e6681ff753d3ad53`. The checkpoint includes 33 changed/new files (23 modified, 10 new) on the required feature branch. Commit/push are authorized after the fresh checks pass; no merge is authorized. No environment files, credentials, screenshots or generated build output are intended for version control.

## 29–30. Remaining production gate and verdict

**Verdict B — M1 is hardened but not production-ready as a complete module.**

1. **Explicitly deferred privileged provisioning:** Staff/Dentist/Owner creation/linking needs hardened M2/M3 identity/profile foundations and a separately approved activation/initial-password policy. Required later: unique coherent Person/profile linkage; which existing profiles can receive accounts; Owner authorization and last-Owner protections; activation/credential delivery, expiry/recovery and verification policy; branch-scope assignment; transactional/idempotent provisioning; audit and adversarial/browser coverage. No guessed policy was implemented here.
2. **Related production identity projection boundary:** the demo-bound privileged frontend bridge and local compatibility collections are not a general-purpose production workspace identity system. Replace them with server-issued profile/public-ID projection and a deliberate compatibility-data migration when those foundations are available. Backend role/scope/ownership enforcement is independent and tested, but that does not make the remaining browser prototype production authority acceptable. Unknown privileged identities currently fail closed.

Deployment conditions still need operational verification: HTTPS/secure cookies, exact trusted frontend/Sanctum origins, APP_DEBUG=false, shared throttling/session storage, and a real non-logging mail transport. Chrome/fixture QA is not physical-device, cross-browser, screen-reader or live-mail certification. Account revocation prevents subsequent requests; it does not undo a domain command already authorized and committed before suspension. Administrative writes must use the server commands; direct bulk database changes can bypass model revision/audit hooks.

M1 process-document Implementation Status should read: **“Server-authoritative Patient registration, email verification, authentication/session revocation, four-role access, Staff authorization scopes, Owner account administration and audited suspension/restoration hardened and tested. Privileged provisioning/activation and general production identity/profile projection remain deferred pending M2/M3 foundations and an approved activation policy.”** No other module's business implementation status is changed by this pass.

## Changed-file inventory

- `backend/app/Http/Controllers/AccountStatusController.php`
- `backend/app/Http/Controllers/Auth/AuthenticatedSessionController.php`
- `backend/app/Http/Controllers/Auth/EmailVerificationController.php`
- `backend/app/Http/Controllers/Auth/RegisteredPatientController.php`
- `backend/app/Http/Controllers/UserBranchScopeController.php`
- `backend/app/Http/Controllers/UserManagementController.php`
- `backend/app/Http/Middleware/EnsureAccountAccess.php`
- `backend/app/Http/Middleware/EnsureUserHasRole.php`
- `backend/app/Http/Requests/Auth/LoginRequest.php`
- `backend/app/Http/Requests/Auth/RegisterPatientRequest.php`
- `backend/app/Http/Requests/User/StoreUserRequest.php`
- `backend/app/Http/Requests/User/UpdateUserRequest.php`
- `backend/app/Models/User.php`
- `backend/app/Providers/AppServiceProvider.php`
- `backend/app/Rules/PasswordInput.php`
- `backend/app/Services/Audit/AuditService.php`
- `backend/app/Services/Auth/OtpDelivery.php`
- `backend/bootstrap/app.php`
- `backend/database/migrations/2026_10_09_000100_add_auth_version_to_users.php`
- `backend/routes/api.php`
- `backend/tests/Feature/Auth/ConcurrentVerificationTest.php`
- `backend/tests/Feature/Auth/ProductionHardeningTest.php`
- `backend/tests/Feature/Auth/RegistrationTest.php`
- `backend/tests/Support/concurrent_verification.php`
- `backend/tests/TestCase.php`
- `docs/M1_PRODUCTION_HARDENING.md`
- `scripts/m1-security-browser-qa.mjs`
- `src/administration.js`
- `src/api-client.js`
- `src/identity-bridge.js`
- `tests/api-client.test.js`
- `tests/identity-bridge.test.js`
- `tests/safeguards.test.js`
