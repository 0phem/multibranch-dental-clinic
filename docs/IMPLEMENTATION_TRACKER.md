# Implementation Tracker — 25 planning modules

Started 2026-10-13. Keep current as slices land. Planning numbers follow `MODULE_COVERAGE.md`; runtime identities (`src/module-map.js`, `LEGACY_MODULE_DOMAIN`) are unchanged — see `docs/MODULE_IDENTITY_TRANSITION_MAP.md`. Owned records and the input → process → output workflow for each module are in `docs/MODULE_IPO_BLUEPRINT.md`; only the summary is repeated here.

**How to read it.**
- **Status**: `Done` (meets every completion criterion below and was verified), `Partial` (server-backed parts exist, gaps listed), `Browser-local` (only browser state; not a completed workflow), `Not started`.
- **Blocker type**: *Implementation* (work we can do) vs *Policy* (a clinic decision is missing — the exact question is named; nothing is invented).
- **Evidence** is what was actually run, with the date. "Reported" means an earlier checkpoint's claim that was not re-run in this tracker.

**Completion criteria** (all required for `Done`): validated inputs and authoritative server persistence; explicit transitions and actors; enforced role and branch permissions; loading/empty/failure/retry/success states; source-linked history and audit evidence; tests for access, transitions and failures; browser verification of the real workflow.

**Environment fact (updated 2026-10-13).** The local clinic database `dental_clinic` is migrated through `2026_10_20_000100_m17_routing_and_encryption` (each step after a restore-checked backup, approved by the team: see `docs/CLINIC_DB_PENDING_MIGRATIONS.md`). Automated backend tests use `dental_clinic_test`.

**Open policy items for the clinic (recorded, nothing built).**
- **Staff-initiated conversations.** Today only a Patient can start one.
- **Staff email alerts** for new Patient messages. Today only offline Patients get a content-free alert.
- **Reopening a closed conversation** (unresolved policy 8).
- **Message retention period** under RA 10173 (Data Privacy Act). No automatic deletion exists.
- **The duplicate-phone message at registration.** It still says a matching record may exist, which reveals that a phone number is on file.

**Known build-time items.**
- `npm audit` reports one high-severity advisory in `source-map-js` (GHSA-68fv-2mgg-jv7q, event-loop denial of service via crafted source maps).
  - It is a build-time dependency of the Vite toolchain, already in the lock file before Phase 2, and not shipped to browsers.
  - Left unchanged by decision (2026-10-13).
  - Revisit with the next toolchain update.

## Summary

| No. | Module | Status | Next slice | Main blocker |
| --- | --- | --- | --- | --- |
| M1 | User Management | Partial (isolated end-to-end verified) | Live invite/accept on the clinic database after its migrations | Implementation; PI-01 (additional Owners), PI-02 rest, PI-03/04 |
| M2 | Branch Management | Partial | Dated operating calendar and closures | Policy: actual days/hours, closure effects on bookings |
| M3 | Work Schedules | Not started (flat shift fields only) | Dated roster model | Policy: actual shifts, PI-05/06 scope of change |
| M4 | Patient Records | Partial | Re-verify server record fields live after migrations | Live DB migrations pending |
| M5 | Treatment Management | Partial | — (reported complete server workflow; re-verify) | Policy: completed-Treatment amendments |
| M6 | Appointment Management | Partial | Attendance responses (confirm/decline) | Policy: cancellation/reschedule cutoffs |
| M7 | AI Chatbot | Partial | Approved knowledge content review | Policy: curated answers approval |
| M8 | Patient Visits | Partial | Patient Visit API (D9) | Policy: earliest check-in, late arrival |
| M9 | Patient Queue | Partial (counts truthful; completeness reported by server) | Live check with real queue entries (needs a real arrival) | Data: no live queue entries |
| M10 | Dental Charts | Not started | — | Policy: chart fields and authority |
| M11 | Billing Management | Partial | Billing/payment ownership split review | Policy: adjustments, discounts, tax |
| M12 | Treatment Plans | Not started | — | Policy: plan states, estimates |
| M13 | Services and Pricing | Partial | — | Policy: approved prices and durations |
| M14 | Document Management | Partial | — | Policy: retention, limits |
| M15 | Leave Management | Not started | — | Policy: leave types, coverage rules |
| M16 | Patient Inquiries | Partial | — | Policy: routing, Owner access |
| M17 | Patient Messaging | Partial | — | Policy: conversation creation/routing |
| M18 | Notifications | Partial (durable email intents, worker, bounded retry) | Real transport + delivery evidence; reminders after PI-31 timing | Policy: reminder timing/sender (PI-31), channels, templates |
| M19 | Prescriptions | Browser-local | Server prescription record | Policy: print fields, corrections |
| M20 | Patient Follow-Up | Browser-local | Server follow-up obligation | Policy: intervals, DQ-72 |
| M21 | Reports and Analytics | Partial | — | Policy: DQ-113 revenue basis |
| M22 | Audit Logs | Partial | — | Policy: retention/export |
| M23 | Payment Management | Partial (inside runtime billing) | PayMongo sandbox end-to-end | Credentials/callback reachability |
| M24 | Lab Cases | Not started | — | Policy: case states, review authority |
| M25 | Patient Handovers | Not started | — | Policy: initiator/recipient rights |

## Modules

### M1 User Management — Partial
- **IPO**: Owner-approved employee accounts, Patient self-registration, sign-in/verification, suspension/restoration, branch scopes, personnel reference data.
- **Backend**: Sanctum sessions, OTP email verification for Patients, Owner Patient-account CRUD, suspend/restore, branch scopes. **New 2026-10-13:** Owner email invitations for Staff/Dentist (`/api/employee-invitations`, public `/api/invitations/accept`): Invited → Active by setting a password through a single-use link; resend replaces the link; cancel → Revoked; resend reopens. Profiles start unavailable with no services; branch scope stays a separate step. Restore/suspend refuse invitations.
- **Frontend**: Owner User Management (Patient create; **new** invite form, open-invitations list with resend/cancel and truthful send outcome); public **Set your password** page.
- **Server-driven employee workspace (2026-10-13)**: `/api/me` now returns the signed-in Staff/Dentist's own `employee` profile reference and branch; `src/identity-bridge.js` opens that person's own workspace (keyed by the server user id, validated against the server profile's `userId`, branch and role), re-validated when reference data loads, never swapped for the demo identity. Page permissions mirror the server's role-based authorization.
- **Staff branch access (2026-10-13)**: Owner "Branch access" dialog on Staff rows of User Management, using the existing Owner-only `GET/PUT /api/users/{user}/branch-scopes` (audited `account.branch_scopes_changed`). A new Staff member has no scope until granted, so server lists stay empty (fail closed).
- **Account recovery and email security (Priority 1, 2026-10-13, uncommitted for review)**: see `docs/M1_ACCOUNT_SECURITY.md`. Registration no longer reveals existing emails (identical "check your email" answer; the address owner gets a notice instead). Password reset by emailed code for every Active role (`/api/password/forgot`, `/api/password/reset`); signed-in email change by current password plus a code to the new address (`/api/account/email`, `/api/account/email/confirm`). Caps: 5 sends per email+IP per hour and 10 per email per day, counted before any lookup. Codes and notices are queued once after commit (`SendOnceMail`, encrypted payload, one try, no `failed_jobs` copy). Redesigned emails on one 600px base layout with plain-text parts; dev-only preview at `/dev/mail` (`APP_ENV=local`). Migration `2026_10_19_000100_add_purpose_to_email_verification_otps` (additive).
- **Gaps (implementation)**: email change UI only on the Patient profile (the endpoint serves every role; Staff/Dentist/Owner screens to follow); employee profile edits after invitation use the existing Owner profile update only; the duplicate-person phone check at registration still answers differently (see the security doc).
- **Open decisions (policy)**: PI-01 additional Owner accounts; PI-02 invitation expiry/resend/recovery/identity confirmation (engineering default 72 h, configurable `EMPLOYEE_INVITATION_EXPIRE_HOURS`); PI-03 who suspends/restores; PI-04 day-to-day account help.
- **Evidence (2026-10-13)**: full backend suite 724/724 on `dental_clinic_test` (includes `EmployeeInvitationTest` 13 tests), then Queue/Visits/Analytics/Identity/Mail 105/105 after the last backend edits; frontend `tests/m1-employee-invitations.test.js` (8) and `tests/m1-employee-identity.test.js` (5); fixture browser QA `scripts/m1-invitations-browser-qa.mjs` 113 checks (invite, resend, cancel, branch access at five widths; accept page at five widths; new Staff/Dentist workspace at 375/1440). Live read-only: Owner invitation list 200 (empty), Staff 403; `/api/me` returns the right `employee` block for the seeded Staff and Dentist and none for the Owner.
- **Isolated integration (2026-10-13)**: on a separate, freshly migrated and seeded database with a real API and browser, the Owner invited a Staff member, the link was read from the local mail log, the person set a password (second use refused), signed in to their own Branch A workspace, had no branch access until the Owner granted it, then saw it take effect (`scripts/m1-m18-isolated-integration.mjs`, 16 checks).
- **Limitations**: live invite/accept on the clinic database not run — it would write clinic records and needs the pending migrations (`docs/CLINIC_DB_PENDING_MIGRATIONS.md`).
- **Acceptance for next slice**: with the clinic database migrated (team decision), invite a Staff member, read the link from the local mail log, accept it, sign in, grant branch access, and see that branch's records — all in the live app.

### M2 Branch Management — Partial
- **Backend**: branches with open/close time and status; public ids (migration not applied to the clinic database). **Frontend**: branch pages and selectors.
- **Gaps**: no dated operating calendar, closures or holiday handling. **Policy**: actual days/hours; how closures affect existing bookings.

### M3 Work Schedules — Not started
- Today: flat `shift_start/shift_end/available` on staff and dentist profiles. **Next**: dated roster records feeding M6 availability. **Policy**: actual shifts; PI-05 assignment changes (who edits, dating); PI-06 confirmed Owner sets Dentist schedules.

### M4 Patient Records — Partial
- **Backend**: patients on persons; record fields and directory (fields migration not applied to the clinic database). **Next**: live re-verification after migrations. **Policy**: archive/restore, retention.

### M5 Treatment Management — Partial
- **Backend**: treatments, procedure lines, append-only history, encounter validation (reported). **Policy**: completed-Treatment amendments (unresolved policy 6).

### M6 Appointment Management — Partial
- **Backend**: booking, reschedule, cancel, pre-arrival no-show, deterministic scheduling, paginated list with day/range filters. **Frontend**: booking, Appointments page, **read-only Staff Appointment Calendar (Day/Week/Month, 2026-10-13)**.
- **Evidence**: 25 unit tests, fixture QA 411 checks, live read-only 54 checks (2026-10-13). **Next**: attendance responses (confirm/decline) — a Patient-facing write. **Policy**: cancellation and reschedule cutoffs.

### M7 AI Chatbot — Partial
- Server adapter, Patient-only, informational, fallback. **Policy**: approved knowledge content; never diagnoses, prescribes, books or pays.

### M8 Patient Visits — Partial
- Server Visits, check-in, walk-in (reported). **Gap**: Patient Visit API (D9). **Policy**: earliest check-in; late arrival/no-show threshold (PI-21: case by case, who decides unanswered).

### M9 Patient Queue — Partial
- Server queue entries and named commands. **2026-10-13**: truthful counts only after a complete response; overlap/midnight protection; no unapproved estimates. The list endpoint now states `meta.limit/returned/truncated` (it reads one extra row to know), and the client uses the server's flag (falling back to the row cap for an older server). **Remaining**: true paging beyond 500 entries per day (not needed at current clinic size; truncation is shown, never hidden).

### M10 Dental Charts — Not started
- No runtime domain. **Policy**: chart fields, notation, authority.

### M11 Billing Management — Partial
- Server invoices, immutable lines, review/issue, payment and receipts in one runtime authority (reported). **Policy**: adjustments, discounts, tax, partial payments/refunds.

### M12 Treatment Plans — Not started
- Runtime M12 is the legacy HMO domain (excluded). **Policy**: plan states, estimate validity, multi-visit workflow.

### M13 Services and Pricing — Partial
- Services, branch offerings, effective-dated prices (reported). **Policy**: approved prices and durations.

### M14 Document Management — Partial
- Private storage, extraction drafts, consents (integrity migration not applied to the clinic database). **Policy**: limits, retention, extraction providers.

### M15 Leave Management — Not started
- **Policy (blocking)**: leave types, coverage deadlines, partial coverage, withdrawal, privacy, affected bookings. Implement only with confirmed rules and explicit substitute acceptance.

### M16 Patient Inquiries — Partial
- Manual external inquiries (migration not applied to the clinic database). **Policy**: routing, Owner access, official platform access.

### M17 Patient Messaging — Partial
- Participant-scoped conversations. **Policy**: reopening (unresolved policy 8).
- **Priority 2 (2026-10-13, uncommitted for review)** — see `docs/M17_REALTIME_MESSAGING.md`:
  - Front-desk routing (decision 3): Patient-started conversations, default branch from the latest visit or appointment, every in-scope Staff member sees and replies, first Staff reply is the participant of record, Dentists only when Staff add them. Owner refused (decision 4).
  - Reverb private channels with signal-only events and a polling fallback.
  - Message text encrypted at rest (decision 5) with a resumable conversion command, key rotation and a rehearsed rollback.
  - Content-free offline email alert (one per conversation per 15 min).
  - Rebuilt chat screens with per-conversation drafts.
  - Migration `2026_10_20_000100_m17_routing_and_encryption` is **pending for `dental_clinic` (awaiting approval)**.
  - **Open:** Staff-initiated conversations (no rule), Staff email alerts, conversation reopening (policy 8), message retention (RA 10173).

### M18 Notifications — Partial
- **New 2026-10-13**: `App\Services\Mail\MailDispatcher` — every email (Patient verification code, appointment confirmation, payment receipt, Owner diagnostic, employee invitation) goes through one dispatcher that reports `logged_only` / `transport_accepted` / `failed` truthfully and records `mail.dispatched` audit evidence (purpose, outcome, mailer; never the address or content). The Owner diagnostic no longer claims success or "Operational (Verified)" (TD-25 wording).
- **Appointment change emails (2026-10-13, PI-29 "booked or changed")**: booking, reschedule and cancel now email the Patient after the command commits (a refused or rolled-back command sends nothing; an idempotent replay sends nothing twice; a mail failure never fails the command). Fixed: the booking confirmation showed the time the email was rendered instead of the appointment time, and carried an unapproved "arrive 10–15 minutes early" instruction (earliest Check-In is an unresolved policy) — removed.
- **Durable dispatch and controlled retry (2026-10-13)**: `mail_dispatches` (intent) and append-only `mail_dispatch_attempts`; appointment and receipt emails are intents written in the domain transaction, sent by `SendMailDispatch` on the `mail` queue with atomic claims, bounded retries (4 attempts: 60 s / 5 min / 15 min), stale-claim recovery and `mail:process-due` (scheduled every minute). Secret-bearing mail (verification code, invitation link) is sent once and recorded, never stored or retried. Runbook: `docs/M18_EMAIL_DISPATCH.md`. TD-24 (worker) is addressed in code; a worker must be run in each environment.
- **Evidence (2026-10-13)**: full backend suite 734/734 on `dental_clinic_test` (`MailOutboxTest` 10 tests incl. a real `queue:work` run); isolated integration `scripts/m1-m18-isolated-integration.mjs` 16/16 on `dental_clinic_isolated` (real API, browser and worker).
- **Still browser-local**: in-app notifications. **Gaps**: no provider delivery receipts (`delivery_confirmed_at` never set); real inbox delivery unverified (mailer is `log`); migration not applied to the clinic database.

### M19 Prescriptions — Browser-local
- Server stores only `prescription_required`. **Next**: server prescription draft/authorization record. **Policy**: print fields, corrections/reissue (unresolved policy 7).

### M20 Patient Follow-Up — Browser-local
- Server stores Dentist follow-up fields on the Treatment. **Next**: server obligation with booking link. **Policy**: intervals, DQ-72 scheduling authority, missed/cancelled reopening.

### M21 Reports and Analytics — Partial
- Read layer with corrected identities and money (6563e4c, reported). **Policy**: DQ-113 revenue date basis; no invented wait/capacity metrics.

### M22 Audit Logs — Partial
- Append-only audit with Owner read/CSV (append-only migration not applied to the clinic database). **Policy**: retention, export, severity rules.

### M23 Payment Management — Partial (inside runtime billing)
- PayMongo checkout/webhook foundation under runtime M11 (reported). **Next**: sandbox end-to-end with authenticated callback and duplicate protection evidence. **Blocker**: credentials and callback reachability.

### M24 Lab Cases — Not started
- User confirmation 2026-10-12: tracked manually today. **Policy**: case types, instruction fields, review authority, overdue rules.

### M25 Patient Handovers — Not started
- User confirmation 2026-10-12: coordinated by calls/messages today. **Policy**: initiator/recipient rights, care packet, acceptance, closure.
