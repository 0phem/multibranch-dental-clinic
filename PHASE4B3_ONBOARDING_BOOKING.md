# Phase 4B.3 — Patient onboarding & booking architecture

Built on `d1d2f85` (Finalize Phase 4B audit documentation) with a clean tree. This is the implementation record for
the onboarding/booking architecture line of work; the planning pass that preceded it produced no file changes.

## Checkpoint 4B.3A — Patient identity, registration & first-use Home

Scope of this checkpoint only: ERD-aligned Patient self-registration, user-derived Patient sign-in, and a first-use
Home for a Patient with no care history. **Automatic Dentist assignment, Booking Drafts, payment preference and any
booking-wizard redesign are explicitly deferred to a later 4B.3 checkpoint and are not implemented here.**

### Identity model

The ERD does not model `USER` and `PATIENT` as a foreign-key chain running through each other (not `USER → PATIENT`, nor `PATIENT → USER`). `PERSONS` is the single shared identity hub;
`USERS` and `PATIENTS` are two independent attachments to it, each carrying its own `person_id` foreign key
(`USERS.person_id FK/UK`, `PATIENTS.person_id FK/UK`). A Patient may exist with no login at all (`PATIENTS.userId`
is `null` for most seeded Patients); a registered login shares the same `PERSON` identity as its Patient record, not
a direct relationship between `USERS` and `PATIENTS`.

The frontend keeps `patients.userId` as a compatibility denormalization — existing safeguards
(`validSession`, `sessionForUser`) cross-check it against `personId` on every read, so it can never silently diverge
from the canonical `person_id` relationship, but it is not proposed as a new ERD column (`PATIENTS.user_id` was not
added; see `ERD_ALIGNMENT.md`).

### Registration (`src/registration.js`)

Patient self-registration is a **frontend demo account flow**: the created records live in this browser's local
persisted state, not a server database. It is a public boundary, distinct from the authenticated command runner
(`createWorkflowActions`'s `run`, which requires `validSession`) — there is no session yet when someone registers,
so it cannot go through that path, and it never bypasses that runner's checks for an authenticated action. It is
the one narrow thing a stranger may do: create their own identity, atomically, and nothing else. `PROFESSOR_DEMO_GUIDE.md`
walks the same story for a live demonstration (register → sign in by email → first-use Home → Start booking) and
states the same current-frontend/future-backend distinction.

`createRegistrationAction({getState, commit, clock})` returns `(form, commandId) => result`:

- Collected fields: first name, middle name (optional), last name, phone (required, matching the existing
  Staff-facing `createPatientRecord` behavior), a normalized email (required — the sign-in identifier), date of
  birth (optional, ERD-legitimate `NULL`), and a preferred/home branch (required; `PATIENTS` already has a
  legitimate field for it). **Not collected:** password, medical history, HMO data, payment data, loyalty data, or
  any legal consent field (deferred; see Known limitations).
- The payload is checked against an explicit allowlist of exactly these fields before anything else runs. A payload
  containing any other key — `role`, `roleName`, `permissions`, `accountStatus`, `branchId`, `username`, `login`, or
  a browser-supplied `id`/`personId`/`patientId`/`userId` — **fails the whole request closed** with the same
  neutral "Enter valid registration details." message used for any other malformed payload; it is not silently
  stripped and processed. Role, account status, permissions and every ID are otherwise fixed by the command itself.
- Email uniqueness is enforced against every current `PERSONS.email` and `USERS.username`.
- Duplicate-Patient protection reuses the same signal the existing Staff `createPatientRecord` command already
  uses: a matching phone, or a matching first/last name plus date of birth. A match fails with a neutral message
  ("An existing patient record may already match these details. Please contact the clinic for account assistance.")
  that never discloses the existing record. Typed identity is never auto-linked to an existing Patient.
- Idempotent by command ID: a non-empty `commandId` is required, and replaying the same one returns the original
  `{personId, patientId, userId}` unchanged rather than creating a second account.
- One atomic `commit`: `PERSON` + `PATIENT` + `USER` + one workflow/audit entry, or nothing at all if any check
  fails. No appointment, loyalty account, HMO case, clinical or financial record is created by registration.
- IDs are minted with the repository's existing `uid()` helper (the same one `createPatientRecord`, `saveAppointment`
  and every other command already use), never a browser-supplied ID.
- Audit: since there is no prior actor, the workflow/audit entries name the newly created identity itself as the
  actor ("Self-service Patient registration"), not a fabricated Staff/session actor. No email or phone is written
  into the log payload.

### Demo sign-in (`contracts.js`)

- `sessionForUser(state, userId)` resolves a Patient session strictly from a real `USER → PATIENT` relationship
  (matching `userId` and `personId`). It returns `null` — fails closed — for a non-Patient account or an
  ambiguous/duplicate link (more than one Patient row claiming the same User), exactly like `validSession` would
  reject it; it never guesses which of several matching rows was intended.
- `resolvePatientLogin(state, email)` is the Patient demo sign-in entry point (decision D6: normalized email is the
  login identifier). It resolves the canonical `PERSON` by email (never a typed Patient/User ID), then the `USER`
  by that Person's `person_id`, fails closed on zero or more than one match at either step, and rejects a resolved
  account that is not a Patient — so an email cannot cross into a Staff/Dentist/Owner session through this path.
- Maria's existing one-click demo persona (`ROLE_INFO.patient` / `sessionForRole('patient', …)`) is unchanged and
  still works; the new email path is additive. Staff/Dentist/Owner sign-in is unchanged.
- The Login screen (`src/layout.jsx`) gained an email sign-in form and a "Create an account" link, shown only under
  the Patient tab; both new props are optional, so `<Login onLogin={...}/>` with no other props still renders
  exactly as before (verified by the existing brand/SSR smoke assertions, which pass no new props).
- `src/pages/PatientRegister.jsx` is the registration screen. On success it shows the created email and an
  **explicit "Sign in" step** (not a silent auto-login) that calls the same `resolvePatientLogin`-backed handler as
  the Login screen's email form.

### First-use Home (`patientHomeMode`, `patientProfileGaps` in `patient-view.js`)

`patientHomeMode(state, session)` returns `'first-use'` or `'returning'`, derived every render from real
session-scoped state — **there is no stored onboarding flag**. It is `'first-use'` only when the Patient has no
appointment (of any status, including Cancelled — a cancelled-only history still means "has been through the flow
before" and stays `'returning'`), no completed care, no Patient-visible prescription, no invoice, no follow-up and
no HMO case.

`src/pages/PatientHome.jsx` renders the existing full Phase 4B.1 Journey Hub unchanged for a returning Patient, or a
new `FirstUseHome` for a first-use one: a greeting from the real Person/Patient record, a "Need a visit?" card whose
only action navigates to `book` (no booking form embedded), a short truthful explanation, `patientProfileGaps`
guidance only for a canonical field that is actually missing (currently: a missing contact number — `Person.phone`
is legitimately nullable in the ERD), and a small quick-access list only for state that genuinely exists (an
existing conversation or loyalty account) — Referral & Loyalty is never shown ahead of the primary booking action.

### Motion

One shared, restrained one-shot entrance (`.motion-in` / `@keyframes fade-in-up` in `foundation.css`, opacity +
`translateY(6px)`, 320 ms, one easing curve) is used on the first-use Home hero and the registration success panel.
It is wrapped in `@media (prefers-reduced-motion: no-preference)`, so with reduced motion requested the class adds
nothing and both screens are identical and fully usable without it. No motion library was added.

### Persistence

No storage key was renamed. Registration writes to the existing `dentalops-v4-persons`, `dentalops-v4-patients` and
`dentalops-v4-users` collections through the same `commit`/`persistableCollection` path every other command already
uses, so newly created identity rows are covered by the existing Saved Workspace Recovery gate: genuinely corrupt
data in any of those collections is preserved and blocks that collection's saves/migration, exactly as before —
nothing was added to weaken that.

### Privacy protections

- Every selector a Patient session reaches (`patientContext`, `patientAppointments`, …) already scoped strictly to
  `session.patientId`; a newly registered Patient is just another row those selectors scope to, with no special
  case. A registered Patient cannot see another Patient's data, and existing Patients cannot see a new
  registrant's data.
- `sessionForUser`/`resolvePatientLogin` fail closed for a forged/ambiguous relationship, an inactive account, a
  non-Patient account, or an unknown email — without disclosing whether an account exists for a given email.
- Registration cannot inject a Staff/Dentist/Owner role, an arbitrary permission set, an arbitrary account status,
  or a browser-supplied Person/Patient/User ID; only the person/contact fields listed above are ever read from the
  form.

### Future backend boundary

**Current frontend:** records are created in one synchronous, atomic in-memory commit and persisted to
browser-local storage. There is no password, no server-side uniqueness constraint, no email verification and no
authoritative session token — this is explicitly a demo account flow, stated on the registration screen itself.

**Future backend (not implemented, not authorized in this pass):** a database transaction creating `PERSONS` +
`PATIENTS` + `USERS` with real unique constraints and foreign keys; hashed password authentication; an email
verification step gating `USERS.account_status` (a `PENDING_VERIFICATION` value fits the existing `varchar` column
without a structural change); server-side authorization on every subsequent request; and durable, race-safe
uniqueness enforcement that this frontend can only approximate.

## Known limitations (4B.3A)

- This is a demo account flow, not production authentication: no password, no session token beyond in-memory
  React state, no server-side enforcement. A user controlling the browser can bypass any of these checks.
- Legal/privacy consent persistence is explicitly deferred (`D5`): no `privacy_consent_at` field or consent
  language was added; the registered Patient's `consent` field starts `false`, matching "not yet collected" rather
  than fabricating an accepted consent.
- No account-recovery or existing-record-linking flow exists; a genuine duplicate match ends in "contact the
  clinic," not a resolution path.
- Multiple browser tabs/devices are not synchronized; the existing single-tab, last-write-wins limitation applies
  to registration exactly as it does to every other command.
- Automatic Dentist assignment, Booking Drafts, a payment preference field and any booking-wizard change are not
  part of this checkpoint; the existing Phase 4B.1 booking wizard, manual Dentist selection and Suggested times are
  unchanged.
- P1–P9 remain `POLICY DECISION REQUIRED` and untouched; the ERD structure is unchanged (no `PATIENTS.user_id`,
  `email_verified_at` or `privacy_consent_at` column was added).

## Checkpoint 4B.3B — Scheduling domain & automatic Dentist assignment

Scope of this checkpoint only: a deterministic scheduling domain (`src/scheduling.js`) underneath the future Patient
booking redesign — automatic Dentist assignment, an open-time search, and the authoritative Patient booking-command
support both need. **This checkpoint does not implement the final booking UI, Booking Drafts, a payment preference
field, or any redesign of the existing Phase 4B.1 booking wizard**, which continues to use its existing manual
Dentist-selection/default path unchanged.

### Deterministic assignment algorithm (`assignDentist`)

Answers "for this Patient, branch, service, date and time, which Dentist may legitimately perform this
appointment?" with no fake AI, no randomness and no invented workload score:

1. **Eligibility source:** the candidate pool is the exact same configured-service + branch-assignment +
   active-account pool the booking wizard already used (`dentistsFor`, relocated unchanged from `patient-view.js` to
   its proper domain home in `scheduling.js` and re-exported for existing callers). Each candidate is then
   revalidated for the *exact* requested slot through the same authoritative `validateAppointment` every manual
   booking already uses — branch/service/hours, Dentist shift, Dentist-conflict overlap, and the Patient's own
   overlap check all apply identically. This composes the existing rules; it never invents a second, incompatible
   eligibility system.
2. **Workload metric:** eligible candidates are ranked by the total minutes of their own legitimately booked
   (non-terminal) appointments on the exact requested date — reusing the same canonical `TERMINAL`
   (`Completed`/`Cancelled`/`No-show`) status list every other command already uses, so a cancelled appointment
   never inflates workload and a different date never contributes. `M15` `branchCapacity` (branch-level operational
   visibility) is never consulted to rank Dentists.
3. **Stable tie-break:** equal booked minutes break by ascending canonical Dentist ID, so identical state and
   identical input always produce the identical Dentist regardless of array/display order.
4. **Zero-eligible-Dentist behavior:** some real configured branch/service combinations (for example Branch C +
   TMD/Orofacial Pain Consultation, or Branch B + Teeth Whitening) currently have zero Dentists authorized for that
   service. `assignDentist` returns an explicit `{ok:false, dentistId:null}` result for that case — never an
   exception, never a silent fallback to an unqualified Dentist, and never a silent fallback to another branch or
   service.

### Open-time search (`findOpenTimes`)

A deterministic scheduling *search*, not AI: for a branch/service (and Patient), it inspects legitimate scheduling
dates in chronological order within a technical window — `FIND_TIME_DEFAULT_WINDOW_DAYS = 14` — reusing the exact
slot-interval rule `availableSlots` already owns rather than inventing a new one. The **14-day** window is a
technical search default, not a clinic booking-limit policy (P1–P9 remain unresolved); a caller may search a
different window later. Only a date/time with at least one legitimately eligible Dentist is returned, each slot
carries the Dentist `assignDentist` would provisionally pick right now, results are capped by an explicit limit, and
an unavailable combination returns an empty list honestly rather than fabricating a slot.

### Provisional vs. authoritative confirmation

A slot returned by `findOpenTimes`, or a Dentist shown by `assignDentist` before the Patient confirms, is only ever
**provisional**. The authoritative Patient booking command (`saveAppointment` in `src/workflow.js`, extended with an
explicit `options.autoAssign` mode) always recomputes eligibility and the deterministic assignment at confirmation
time:

- If the Dentist the Patient reviewed is still the freshly recomputed deterministic assignment, the booking
  proceeds normally and the appointment records `assignmentMethod: 'auto'`.
- If the reviewed Dentist is no longer available but a different Dentist could now be assigned, the command returns
  a neutral "Availability changed. Review the updated appointment before confirming." result. **No silent Dentist
  substitution ever happens**, and no appointment is created from that failed confirmation; a later Patient UI is
  expected to show the newly proposed assignment and ask the Patient to confirm again.
- If zero Dentist is eligible at confirmation time, the command fails the same way, with no appointment created.

`options.autoAssign` only ever applies to a **new**, Patient-initiated booking with no follow-up relationship;
Staff/Owner bookings, existing-appointment rescheduling and follow-up scheduling are completely unaffected and keep
their existing explicit/pinned Dentist behavior (`assignmentMethod: 'selected'` on a newly created record that did
not use automatic assignment). Command replay/idempotency is preserved: the assignment recomputation excludes the
in-flight command's own prior record from both the overlap check and the workload count, so a rapid duplicate
confirmation with the same command ID never creates a second appointment, and a genuinely new review-and-retry
creates exactly one.

### Assignment metadata & auditability

A successfully auto-assigned new appointment persists `assignmentMethod: 'auto'`; an explicitly selected new
appointment persists `assignmentMethod: 'selected'`. Existing appointments created before this checkpoint have no
`assignmentMethod` field at all and remain fully readable — this checkpoint does not rewrite historical rows solely
to add it. The workflow event for an auto-assigned booking additionally records `assignmentRuleVersion`
(`SCHEDULING_RULE_VERSION` in `src/scheduling.js`, currently `'dentist-assignment-v1'`) as a stable technical
identifier, so a later rule change is never silently attributed to an earlier one. No private per-candidate
diagnostic data (the ranked candidate list `assignDentist` returns) is ever written into a workflow or audit event.

### Frontend concurrency limitation & future backend boundary

**Current frontend:** this remains the existing single-tab, last-write-wins browser-local state; `assignDentist`'s
recompute-then-validate-then-commit sequence is not a database transaction and cannot itself prevent a genuine
race between two browser tabs. **Future backend (not implemented, not authorized in this pass):** an authoritative
backend must re-run the same recompute → lock/check scheduling state → validate → insert sequence inside one
database transaction rather than trusting this browser's provisional result; the ERD-vNext field this checkpoint's
`assignmentMethod` anticipates is `APPOINTMENTS.dentist_assignment_method` (see `ERD_ALIGNMENT.md`).

## Known limitations (4B.3B)

- This checkpoint is scheduling-domain-ready, not booking-UI-ready: the shipped Phase 4B.1 booking wizard still uses
  its existing manual Dentist-selection/default path (`scheduleFormDefaults`/`nextScheduleForm` in
  `patient-view.js`, unchanged) and does not yet offer automatic assignment or open-time search to the Patient.
- No Patient Dentist preference or continuity-of-care preference is implemented; the architecture review has not
  approved either.
- `booking_method` on `APPOINTMENTS` is not redefined or overloaded by this checkpoint; a later booking UI phase
  settles its manual-vs-find-time mapping explicitly.
- Frontend concurrency remains single-tab/last-write-wins, as documented above.
- Automatic assignment, Booking Drafts, a payment preference field and any booking-wizard redesign remain separate,
  later checkpoints.

## Verification

`git diff --check` clean. `npm test`, `npm run test:smoke` and `npm run build` results for each checkpoint are
recorded in the implementation report delivered alongside this record.
