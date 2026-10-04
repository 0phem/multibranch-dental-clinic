# M22 production-readiness audit and hardening — Audit Trail & Activity Monitoring Management

Audit date: 2026-10-04 (Asia/Manila). No commit, push, merge, or other-module business work. No retention policy, alerting, SIEM, external logging or compliance claim was invented.

## 1. Starting git state

Branch `feature/m22-audit-trail-production-hardening`, created from `b006ac9` ("feat(m14): harden document storage access and consent boundaries") on a clean tree synchronized with origin.

## 2. Audit architecture discovered

One table, `audit_logs` (bigint id, ULID `public_id`, nullable `actor_user_id` and `branch_id` FKs with `ON DELETE SET NULL`, copied `actor_role` and `actor_name`, `action`, `category`, `severity`, `auditable_type` + `auditable_public_id`, `ip_address`, `user_agent`, jsonb `payload`, `created_at timestamptz`). One writer, `AuditService` (`record()` plus `recordAuth/Clinical/Financial/Administrative/Security/Automation` helpers). One read API (`AuditController`: list, show, CSV export), Owner only, and one Owner screen (`AuditTrail.jsx`). No queue, no external logging, no alerting, no retention or pruning job.

## 3. Audit authority before / after

Before: the server table was authoritative, but "append-only" was an application convention only, the writer accepted anything, and the screen/endpoint had correctness and scale defects (sections 5–12, 20). After: the same single authority, append-only enforced **by the database**, one validating writer, a bounded validated read API, and a screen that fails visibly. The browser keeps a separate local workflow-bookkeeping list (`state.audit`) used by unfinished prototype modules; it is not an audit record, is never shown on the Audit Trail screen, and is not authority.

## 4. Event schema

`action` is a stable dotted key: a lowercase domain, then identifier segments (`patient.profile.updated`, `document.uploaded`, `billing.payment_recorded`, historical `automation.rule.R1_APPT_LIFECYCLE`). The writer now **refuses** a key that is empty, has no dot, starts with a capital, contains spaces/punctuation or exceeds 100 characters. `category` ∈ security, clinical, financial, administrative, automation, general; `severity` ∈ info, warning, critical — both enforced at write. `payload` must be an array of safe fields. Existing rows were not rewritten.

## 5. Actor model (findings and fixes)

- The actor is the authenticated user from server context, or an explicit system actor; callers cannot supply a user id from a client.
- **Fixed:** an event with no actor (a failed public login) was labelled `system`, which collided with automation. It is now `anonymous`.
- **Fixed:** an automation rule fired inside a human's request recorded that human's `actor_user_id` next to a "system" name. Automation events now always have no user actor.
- **Fixed:** the writer guessed the event's **branch** from where the actor works (`staffProfile->primary_branch_id`, which does not exist, or the Dentist's first branch). Operational assignment is not event context; the branch is now only what the emitter passes.
- The internal `actor_user_id` is never exposed; the API shows the actor's public ULID, name and role.

## 6. Resource model

Targets are `auditable_type` + the target's **public id**. **Fixed:** a target without a `public_id` was recorded by its internal bigint key (and returned by the API as `auditable_id`); it is now recorded by type alone. No internal numeric id appears in any projection or in the CSV.

## 7. Append-only guarantees

Previously only the model's `update()`/`delete()` were overridden — bypassed by `save()` on a loaded row, `destroy()`, any query-builder update/delete, raw SQL, or `TRUNCATE`. Now:
- **Database:** migration `2026_10_13_000100_enforce_audit_log_append_only.php` adds PostgreSQL triggers that refuse every UPDATE, DELETE and TRUNCATE of `audit_logs`. The single permitted change is the referential cleanup PostgreSQL performs itself when a referenced user or branch row is **actually deleted** (`ON DELETE SET NULL` of `actor_user_id`/`branch_id`; the row keeps the actor's name and role, so history stays understandable). The trigger tells that path apart from an application UPDATE with two required conditions: it must run **inside** the foreign-key trigger (`pg_trigger_depth() > 1`; a direct statement has depth 1) and the referenced row must no longer exist. Consequently an application cannot null or re-point `actor_user_id` or `branch_id` on an existing audit row while the user/branch still exists (tested for nulling the actor, the branch, both, re-pointing either, and nulling combined with a rename; and re-pointing after the user is gone is still refused). A no-op UPDATE (nothing changes) is harmless and allowed. Verified through the query builder, raw SQL, `DB::table`, model paths and `TRUNCATE`.
- **Model:** nothing is mass-assignable (`$fillable = []`), `save()`/`update()`/`delete()`/`destroy()` throw, rows are written only by `AuditService` using `forceFill`.
- **HTTP:** the audit routes are GET-only; PUT/PATCH/DELETE/POST return 405 (tested).
- No cryptographic ledger was added (not justified). A database superuser or someone dropping the triggers can still alter history: this is append-only against the application, not tamper-proof, and the UI no longer says "tamper-resistant".

## 8. Metadata / privacy findings

Fixed: key redaction matched **substrings**, so a field named `mapping`, `shipping`, `typing` or `footprint` was wrongly redacted (`pin`, `otp`); keys are now matched as whole words (`password`, `token`, `otp`, `pin`, `cookie`, `session`, `authorization`, `signature`, `secret`, `apiKey`, `card_number`, … in snake/camel/kebab case). Strings over 500 characters are truncated and a payload over 8 KB is replaced by a marker listing its top-level keys, so audit rows cannot become a bulk content store. Emitter findings: `account.updated` carried nothing — it now records changed **field names only**; `document.retracted` and `document.uploaded` were already minimized in M14; the online-payment event carries an invoice/receipt number, a decimal-safe amount string and the method, **no provider reference**, card data or secrets. Every current emitter was inspected; none stores clinical notes, history, extracted text, passwords, OTPs or tokens. IP address and User-Agent were already captured (and shown to the Owner and in the CSV); they were kept as they are — their necessity is an open policy question — with the User-Agent bounded to 500 characters.

## 9. Authorization matrix

| Surface | Guest | Patient | Staff | Dentist | Owner |
| --- | --- | --- | --- | --- | --- |
| List, show, export | 401 | 403 | 403 | 403 | allowed |
| Create / change / delete | none exists | none | none | none | none |

Owner-only is the existing contract (route middleware and a controller check both enforce it); it is not widened. Whether the Owner should see Staff/Dentist activity, or whether other roles should see their own, is an open question.

## 10. IDOR / enumeration findings

Events resolve by ULID only (a numeric id, malformed value or unknown ULID is 404). **Fixed:** the branch filter accepted the bigint branch id and **never matched the `legacy_ref` the frontend sends, so filtering by branch always returned nothing**; it now accepts the legacy_ref or ULID and refuses an unknown or numeric reference (422). Searches no longer treat `%` and `_` as wildcards. Injection attempts in filters are refused or inert; unknown query parameters are ignored, never executed; there is no sort or column parameter.

## 11. Filtering and pagination

Validated and allowlisted: `search` (≤ 100), `category`, `severity`, `branch_id`, `action` (exact), `date_from`/`date_to` (`Y-m-d`, Asia/Manila business days; a reversed range is 422), `per_page` (1–100, default 50) and `cursor` (a ULID). **Fixed:** the list was `limit(min(n, 200))` with no way to page (older history was unreachable), a negative limit crashed, and an invalid date string was a 500. Pagination is keyset on the public id of the last row, newest first with the bigint id as tiebreaker (deterministic under identical timestamps and stable under concurrent inserts). The export is bounded at 5,000 rows and reports `X-Audit-Export-Truncated`/`-Limit`; those headers are now listed in the CORS `exposed_headers` (a cross-origin SPA could not read them otherwise).

## 12. Transactional semantics

Established project rule (M1, M2, M4, M14): a synchronous mutation and its audit event commit or roll back together, and an audit failure aborts the mutation. Verified for M4 (a failing audit rolls back the profile edit) and M14 (upload removed, no orphan); M2 and M1 already ran inside their transactions. **Documented exception:** the online payment (M11 via the PayMongo webhook) records its audit event in a savepoint but never undoes a payment the gateway has already captured; a failure is reported to the application log (and the payment stays Paid) instead of being swallowed. Login and failed-login events are outside any domain transaction by nature.

## 12a. Access-denied audit amplification (final gate)

`account.access_denied` is written by `EnsureUserHasRole` when an authenticated account without the Owner role requests an `/api/users` route. The routes in this prefix (account administration, suspend/restore, branch scopes) are behind `role:owner` and **no existing throttle covers them** (the only limiters are the M1 login/registration/OTP ones on public routes), so an authenticated low-privilege account could write unlimited audit rows by repeating forbidden requests. The audit **write** is now bounded per account with the framework `RateLimiter` (the primitive M1 already uses): the first 5 denials per 60 seconds are always recorded; further ones are still refused with 403 (authorization is unchanged and the request is never hidden or allowed) but not written, and the next recorded event carries `suppressed_since_last_event` with the count not written. The first meaningful denial is never suppressed, each account has its own budget, and a client cannot influence whether an event is written (headers and query parameters have no effect; tested). The 5-per-minute figure is a technical bound, not clinic policy. The counters live in the application cache, so production needs the shared cache already required for the M1 throttles.

## 13. Idempotency / duplicate behavior

Idempotent commands re-run their work only once, so one logical change writes one event: a replayed walk-in registration (same Idempotency-Key) writes one `patient.registered`; a repeated suspend/restore writes one event; a replayed online payment writes one `billing.payment_recorded`. Nothing is globally de-duplicated.

## 14. Event coverage inventory

Emitting to M22 today: M1 `auth.login`, `auth.login_failed`, `auth.logout`, `account.registered`, `account.email_verified`, `account.provisioned`, `account.updated`, `account.disabled`, `account.suspended`, `account.restored`, `account.branch_scopes_changed`, `account.access_denied` (only for forbidden `/api/users` access); M2 `branch.updated`; M4 `patient.registered`, `patient.profile.updated`; M11 `billing.payment_recorded` (online payments only; repaired in this pass); M14 `document.uploaded`, `document.retracted`, `consent.granted`, `consent.withdrawn`; M23 `automation.rule.<code>`. **Not emitting to M22** (each keeps a module-local history table instead): M5 treatment (`treatment_histories`), M6 appointments (`appointment_history`), M8 visits (`visit_history`), M9 queue (`queue_entry_history`), M11 Staff invoice review/issue/payment (`invoice_history`), M12 HMO cases (`hmo_case_events`), M13 price versions (append-only `service_prices`). M21 is read-only. This is a **coverage gap, not retrofitted** here: unifying those histories into M22 is module-specific work. `account.access_denied` is now bounded (section 12a); failed logins are bounded by the existing login throttle.

## 15. M1 findings

Events and their atomicity are sound; `account.updated` now names changed fields (no values); failed login records no email or password and an `anonymous` actor; no credential or OTP is ever passed to the writer.

## 16. M2 findings

`branch.updated` is transactional with the edit, carries only changed field names and the event branch; the API now resolves branches for audit filtering by the same legacy_ref/ULID references.

## 17. M4 findings

`patient.registered` and `patient.profile.updated` carry field names and public ids, never values; rollback on audit failure and single-event replay verified. Patient-record **reads** are not audited (open policy question).

## 18. M11 / M12 findings

**Defect found and fixed:** the online-payment code called the audit writer and the M23 automation recorder with a stale positional signature inside a `try { … } catch (\Throwable) {}`. Both calls threw immediately and were swallowed: no payment audit event was ever written, and the `billing.payment_received` automation-ledger event was never recorded. Both calls now use the real signatures, run in their own savepoints, never undo a captured payment and report failures. M12 emits nothing to M22 (its own append-only case-event history exists); no secrets were found in any financial metadata and no arithmetic was changed.

## 19. M14 findings

Document and consent events are minimal (category, MIME, size, checksum, "reason recorded"); audit runs inside the upload transaction. Document reads, downloads and extraction events are not audited (open policy question).

## 20. Frontend authority

The Audit Trail screen is server-backed only (no local/demo activity; verified in the browser). **Fixed:** the Owner navigation never listed the screen — `audit` was in the page list but missing from the rendered navigation groups, so the page was unreachable; a load failure was only a toast and the table said "No audit records match" (an error shown as an empty history); there was no paging (the first 100 rows only); the four counters labelled "Total Events", "Security", … were counts of the loaded page, not of history; the branch filter never matched; a late response for an old filter could overwrite a newer one; the copy claimed "tamper-resistant". Now: loading / error-with-Retry / empty states, cursor "Load older events", honest "loaded" counters, a validated date range, stale-response guard, safe-field rendering of the sanitized payload, no numeric ids, and truthful copy.

## 21. Export findings

An Owner-only CSV export exists (existing capability, kept): same validated filters, now including `action`; formula-injection neutralization retained and tested; bounded at 5,000 rows with an explicit truncation flag the UI discloses; `Cache-Control: no-store`; safe generated filename; timestamps with the +08:00 offset; includes the sanitized payload and IP address. Whether exports should exist at all is an open policy question.

## 22. Retention / deletion findings

No pruning, retention or deletion mechanism exists, and the database now forbids deleting audit rows. **No retention period was invented**; retention is POLICY DECISION REQUIRED. Consequence to plan for: the table grows without bound until a policy and a controlled archival procedure exist (a future archival job would need a deliberate, reviewed trigger change).

## 23. Database / schema changes

One forward-only migration (the append-only triggers); no table or column change, no row touched. Tested only on `dental_clinic_test` and **not applied to `dental_clinic`**; apply it before deploying this code. `created_at` is a PostgreSQL `timestamp with time zone` whose default is `CURRENT_TIMESTAMP` (verified from `information_schema`), and the writer no longer sets it: the database assigns the instant. The previous PHP-formatted wall-clock string was only correct because the session timezone happened to be Asia/Manila (the write dropped the offset). A `timestamptz` stores an absolute instant, so the stored value cannot change with the session timezone; this is tested under four session timezones (UTC, Asia/Manila, America/New_York, Pacific/Auckland): each event's stored instant is within seconds of the database `now()`, rows read back under another timezone give the same epoch, and the API returns the same instant with an explicit `+08:00` offset whichever session timezone is active. Events inside one transaction share `CURRENT_TIMESTAMP`, so ordering uses the bigint id as the deterministic tiebreaker (tested). Existing rows are unchanged.

## 24. Security findings (summary)

Database-level append-only; single validating writer; no mass assignment; actor/branch/target integrity; whole-word redaction and size bounds; Owner-only reads with validated, bounded, cursor-paged queries; wildcard-safe search; exposed CORS headers for the export disclosure; online-payment audit repaired. Remaining limits are in sections 14, 22 and 33.

## 25. Files changed

Backend: `AuditLog.php`, `AuditService.php`, `AuditController.php`, `AuditLogResource.php`, `UserManagementController.php`, `WorkflowAutomationService.php` (failed-rule severity `error` → `critical`; `error` was not a valid severity), `BillingService.php`, `config/cors.php`, migration above. Frontend: `src/audit-api.js`, `src/pages/AuditTrail.jsx`, `src/layout.jsx`. Tests/tooling/docs: `AuditHardeningTest.php`, `AuditQueryTest.php`, `AuditEmittersTest.php` (new), `AuditTrailTest.php`, `PayMongoPaymentTest.php`, `tests/audit-api.test.js` (new), `scripts/m22-audit-browser-qa.mjs` (new), this report.

## 26. Tests added / changed

Backend (+37 tests): database refusal of update/delete/truncate by every path and the FK-null exception; model refusal and no mass assignment; no write routes; invalid event keys/categories/severities/metadata; actor from context / anonymous / system; no branch guessing; public-id-only targets; server-assigned timestamps; whole-word redaction and size bounds; Owner-only matrix and guests; ULID-only resolution and no internal ids; filter validation and injection attempts; exact filters (category, severity, action, branch by legacy_ref and ULID, date); literal wildcards; keyset pagination with a concurrent insert; bounded page size; bounded and honest export; exposed CORS headers; M1 login/account/suspend events; M2 branch event; M4 rollback, replay and field-name-only events; M11 payment audit/ledger, replay, failing-audit and failing-automation behaviour. Gate tests: bounded access-denied writes (first denials recorded, further ones suppressed with a count, per-account budgets, next window reports the count, headers/parameters cannot influence it); arbitrary nulling and re-pointing refused while the referenced row exists, cleanup allowed only when it is really deleted; `created_at` type/default; stored instant under four session timezones; deterministic ordering with identical timestamps. Changed: the CSV-injection test (the hostile text is now carried in a free-text column, since a hostile event key is refused by design).
Frontend (+7): actor mapping, cursor paging parameters, explicit failures, encoded ids, export truncation, screen source assertions, and navigation reachability for the Owner only.

## 27–35. Verification results

- Targeted M22 backend (`tests/Feature/Audit`): **40 passed / 334 assertions**.
- Cross-module regression: M1 (`Auth`), M2 (`Reference`), M4 (`Patients`), M11/M12 (`Billing`, `Payment`, `Hmo`), M14 (`Documents`), M23 (`Automation`) ran within the full suite and passed.
- Full backend: **458 passed / 3,927 assertions** (M14 checkpoint 421 / 3,619; includes the M1 security regression).
- Targeted frontend (`audit-api`, `m22-audit-trail`): **14 passed**. Full frontend: **711 passed**, zero failures/skips (previously 704).
- Render smoke: **16 passing groups**. Production build: **PASS**, initial JS 455.42 kB / 138.93 kB gzip; no dependency changes.
- Browser QA (reused: no frontend file changed in the final gate; `scripts/m22-audit-browser-qa.mjs`, installed Chrome, HTTP fixtures): **126 checks** at 375, 430, 768, 1024 and 1440 for Owner, Staff, Dentist and Patient, **0 px overflow**. Verified: the Owner reaches the screen; server paging and cursor "Load older events"; filters sent as server parameters (branch by reference); an invalid date range is explained and never sent; inspection shows the sanitized payload; a failed load is an explicit error with Retry and never an empty history; no demo/browser audit entries appear; an actor-less event shows as Anonymous; a truncated export is disclosed; other roles have no audit navigation and issue no audit request. The only console errors are the injected 500 responses.
- `git diff --check`: **PASS**. No test artifacts remain in `storage/app/private`.

## 36. Unresolved policy questions (not answered here)

1. Who may review audit history (is Owner-only intended long-term)? Should the Owner see Staff/Dentist activity, and should anyone see their own?
2. Should Patient-record reads, document reads/downloads and extraction actions be audited?
3. How long must audit records be retained, and how are they archived?
4. Should audit exports exist, and who may export?
5. Are IP address and User-Agent required (and for whom to see)?
6. Which events, if any, should raise alerts?

## 37. Remaining blockers

1. No retention/archival policy or procedure; unbounded table growth.
2. Event coverage is incomplete: M5, M6, M8, M9, M12, M13 and Staff-recorded M11 actions keep module-local histories and are not in M22; there is no unified cross-module trail.
3. No read-auditing; no alerting; no integrity chain (a database administrator can alter history).
4. Deployment: the database role the application uses must not own the table or hold superuser rights (otherwise it could drop the triggers), and the shared cache the denial bound relies on must be configured.
5. Access (Owner-only) and IP/User-Agent exposure are unconfirmed policy.
6. The new migration has not been applied to `dental_clinic` (validated only on `dental_clinic_test`); it must be applied deliberately before deploying this code. M22 is append-only against the application — **not tamper-proof and not cryptographically chained**.

## 38. Verdict

**Verdict B — not production-ready as a complete module.** The defects found in the audit store, writer, read API and screen were fixed and tested: database-level append-only, validated single writer, actor/branch/target integrity, minimal safe metadata, Owner-only bounded cursor-paged reads, correct transactional and idempotent behaviour, a repaired payment audit trail and a screen that is reachable and fails visibly. Verdict A is not available because retention, read-audit, export and visibility policies are undecided, and event coverage for the unfinished modules is intentionally incomplete.

**Suggested process-document status for M22:** "Server-authoritative, database-enforced append-only audit trail with a single validating writer, public-id targets, minimal sanitized metadata, Owner-only validated cursor-paged review and bounded CSV export, hardened and tested. Retention, read-auditing, alerting, unified coverage of module-local histories and the visibility policy remain open; Verdict B."
