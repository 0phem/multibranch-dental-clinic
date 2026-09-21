# Phase 4B.1 — Patient core experience

Built on `fa96cdd` (Add Claude Code project instructions) with a clean tree: 305 tests, 11 render-smoke scenarios and a passing build. This is checkpoint 1 of Phase 4B. Checkpoint 2 (4B.2, Referral & Loyalty / M24) is not started. This phase is presentation, read selectors and Patient UX only: **no workflow, business rule, command, permission, persistence key, ERD, M1–M25 mapping or dependency changed**, and no backend work occurred.

## Deliberately not in this checkpoint

- **M24 / M25.** The existing Rewards page (raw `state.loyalty` setter, `ROLE_INFO` identity, "Proposed Enhancement" notice), the `Rewards • PE` navigation label and tag, the Owner/Staff Engagement page and every M24/M25 statement in `AGENTS.md`, `CLAUDE.md`, `README.md`, `MODULE_COVERAGE.md`, `FRONTEND_SCOPE.md`, `ERD_ALIGNMENT.md`, `PROFESSOR_DEMO_GUIDE.md` and the UI skill are untouched. The classification change and the M24 command cleanup happen atomically in 4B.2. `Admin.jsx` is unchanged.
- Patient-started conversations, "Any available Dentist", seed enrichment, Staff/Dentist/Owner redesign, Phase 4C.

## What changed

| Surface | Result |
| --- | --- |
| **Home (Journey Hub)** | Always available. Priority: live queue → today's visit → next appointment → "Needs your attention" → recent care → quick access. Attention items exist only for real state: Missing/Returned HMO documents, a Dentist-requested follow-up awaiting scheduling, an issued Patient-visible invoice, a prescription with an unread valid notification, an unread conversation, unread notifications. The greeting comes from the session Patient and the Manila clock. "Message the clinic" appears only when an accessible conversation exists. |
| **Booking** | Branch → Service → Dentist preference → Date & time → Review → Book, through the same validator and `saveAppointment`. Ordered stepper with `aria-current="step"`, native radio groups in `fieldset`/`legend`, focus moves to the step heading, Continue disabled with a stated reason, persistent "Your visit so far" summary from 768px. The 850 ms "Finding…" delay is gone; "Suggested times" are computed synchronously, chronologically, and checked by the same availability rules (nothing is called "best"). No service is silently preselected. |
| **Appointments** | Shared `Tabs` (Upcoming/Past/Cancelled), record cards across all branches, "Visit details" limited to the previously approved subset (date, procedure text, performed service names, Dentist), links to related visible records, an explanation when a visit is admitted. Cancel uses a shared accessible `ConfirmDialog` (safe action focused, Escape restores focus). Reschedule uses the shared command with `appointmentId`, `expectedRevision` and a command ID. "Rescheduled" is never shown (see below). |
| **Live queue** | Own place and an aggregate estimate only; explicit states for not checked in, waiting, called, ready, away, in treatment, completed, no-show; a polite live region carries only the status/position sentence. No "updates automatically" claim, no meaningless "0 min", no self-check-in, no arrival rule. |
| **Prescriptions** | Authorized only; wrapping cards with dosage, instructions and duration. No renew/edit/reissue/authorize control. |
| **Follow-up** | Uses `followupDisplayState` everywhere (including the cancelled-link recovery), separates "your Dentist recommended it" from "it is scheduled", schedules through the shared command. |
| **HMO** | Plain-language stage per status that keeps local preparation, submission, provider outcome and clinic follow-up distinct; Returned documents highlighted; "Provider Approved/Rejected" only with the existing valid projection; no contact logs, internal notes or membership. |
| **Receipts & payments** | Existing Patient-visible invoice projection only: itemized lines, total, status, receipt number, method (simulated payments labelled), paid date. No Pay control, no raw payment ID line. |
| **Messages** | Phone: list → thread → Back with focus management; wide screens side by side. Readable participant and context names (never raw record IDs), opening marks read through the existing command, closed threads read-only, no start/reopen control. |
| **Notifications** | Recipient ownership and `notificationDestination` unchanged. Deep links focus the exact Patient-visible record on Appointments, Prescriptions, Receipts, Follow-up, HMO and Messages; unread rows are announced in text. |
| **Shell** | Patient navigation regrouped (Overview, Visits, Care & coverage, Communication, More), Messages unread badge, bottom navigation now present through tablet widths (previously 769–1024px was hamburger-only), scroll/focus reset on Patient page changes. The Clinic Assistant trigger is docked in the Patient top bar (see the acceptance pass below); Staff, Dentist and Owner keep the floating button. |

## Architecture

- `src/patient-view.js` — pure, session-scoped read selectors and view models. Every selector revalidates the session, fails closed, composes the established `visible*`/`inScope` selectors, mutates nothing and creates no workflow events. It never reads `ROLE_INFO`.
- `src/patient-ui.jsx` — `RecordCard`, `DefinitionList`, `ChoiceGroup`, `Stepper` (rendered view models only).
- `src/pages/PatientHome.jsx`, `PatientVisits.jsx` (scheduler, booking, appointments, queue, follow-up), `PatientCare.jsx` (prescriptions, receipts, HMO), `PatientMessages.jsx`.
- `src/patient.css` — scoped under `.role-patient`, built only on Phase 4A tokens.
- Shared additions (backward compatible): `ConfirmDialog` and `ShellActionsContext` in `components.jsx`. The shared Staff/Dentist/Owner page files only delegate when `role==='patient'`; the old Patient branches and the old wizard were removed.
- One `PatientScheduler` serves booking, reschedule and follow-up scheduling; `AppointmentForm` (Staff) is unchanged.
- 208 superseded legacy Patient rules were removed from `styles.css`. Only selectors whose classes no source file references were removed (verified by script); classes still used by other roles were kept.

## Safeguards and privacy

Preserved unchanged: Patient ownership and branch scope, encounter integrity, Draft Prescription privacy, payment/receipt evidence, HMO projection privacy, Message participant scope, Notification recipient scope and destination revalidation, persistence recovery, shared commands, command IDs, expected revisions and replay protection. Patient code performs no raw collection mutation (`setters`), and is source-scanned for it. Frontend checks are not backend security.

## Deviations from the approved plan (all presentation-level)

- "Book appointment" on Appointments navigates to the Book page instead of opening a modal.
- Suggested times are chronological and neutral; the old "nearest 11:00 = best" ordering was heuristic.
- The dentist list also excludes a Dentist whose account is inactive or whose assignment is revoked, matching what the validator already rejects.
- In a reschedule where the appointment has an HMO case, the branch is locked (the command already rejects a branch change there).
- "Newly authorized prescription" means a visible authorized prescription with an unread, valid notification, because no per-Patient "seen" state exists and no time threshold may be invented.
- One existing render-smoke assertion asserted the retired empty-queue wording ("No active queue entry"). Its intent (an explicit empty state, no queue data) is kept with the new wording.

## Verification

- `git diff --check` clean. `npm test`: **337 total, 337 passing, 0 failing** (305 original + 32 in `tests/phase4b-patient.test.js`; the original 305 are unmodified). `npm run test:smoke`: **12 scenarios** pass (11 original + 1 Patient). `npm run build`: passes; JavaScript 534.73 kB (155.63 kB gzip, +26 kB), CSS 84.76 kB (15.90 kB gzip, slightly below the 85.57 kB baseline). The existing >500 kB chunk warning remains visible.
- New unit coverage: session-derived identity, second-Patient isolation, forged/stale/inactive sessions, Journey Hub scoping and hero priority, attention derivation, follow-up display-state consistency, care-summary field whitelist, appointment actions, booking options versus the validator, queue privacy and phase progression, Draft Prescription and invoice/payment-evidence withholding, HMO semantic boundaries, Message participants, Notification destination revalidation and deep links, read-only selectors, source guards (no timers, native dialogs, raw setters or `ROLE_INFO`), Saved Workspace Recovery ordering.
- **Browser QA** (headless Chrome, isolated profiles, scripts kept outside the repository). States were built with the real workflow commands (clock pinned to a morning on the current date) and loaded through the app's own persistence keys; role changes (Staff Call / Temporarily Away / Return) were driven through the real UI.
  - **93 journey checks passed, 0 console errors:** login → Journey Hub; manual booking Review → Book (and persistence across reload); suggested times; reschedule; cancel through the accessible dialog (Escape, focus restoration, no native confirm); Staff-created check-in → Patient queue and status progression; Draft and authorized prescriptions; Draft/issued/paid invoices and evidence-backed receipt; follow-up scheduling; HMO Missing, Ready, Pending, Escalated, Returned and Approved; notification deep links to the exact record; Messages unread/open/reply/back/closed; empty Patient states; two reloads without false recovery; corrupt data still triggering Saved Workspace Recovery with the data untouched.
  - **Responsive matrix:** 135 page views (375, 430, 768, 1024, 1440px × fresh/empty/care states × 9 pages): no page-level overflow, one `h1` per page, no interactive target under 40px, no text under 12px, no unnamed control, and visible bottom navigation through 1024px.
  - **Other roles:** all 28 Staff, Dentist and Owner pages were pixel-identical to the pristine `fa96cdd` build at both 1440px and 375px.
  - Two visual defects found by inspection were fixed (stepper labels breaking on 375px; the floating assistant covering the sticky Continue action — superseded by the docked assistant below).

## Known limitations and unresolved decisions

- Headless Chrome only. No physical devices, other browsers, screen readers, zoom or forced-colors testing; the accessibility work is not a certification.
- The demo login reaches only the seeded Patient, so second-Patient isolation is covered by tests, not the browser.
- On very small viewports (a 375px phone at 200% zoom is a 188px-wide layout, below the 320px reflow reference) the native file control on the HMO page truncates its own "No file chosen" text; it is a browser-rendered control and was left as is.
- Timers and reminders remain foreground-only; nothing claims live delivery.
- **POLICY DECISION REQUIRED (unchanged, not invented):** P1/P2 cancellation and reschedule cutoffs, P3 earliest check-in, P4 no-show threshold, P5 override authority, P6 completed-treatment amendments, P7 prescription correction/reissue, P8 conversation reopening, P9 zero-fee settlement. The UI shows current behavior only and states no deadlines, arrival rules or consequences.
- "Pending" appointment status has no Patient-facing explanation and no Patient confirm command exists; the label is shown as-is.
- Patients cannot start a conversation (M16/M17 capability gap, documented, no control offered).
- 4B.2 will handle M24: session-bound identity, shared commands replacing the raw setter, the classification/document migration and the Patient Referral & Loyalty page. The Staff-side `window.confirm`/`window.prompt` are unchanged for the Staff phase.

## Final acceptance / polish pass

Presentation only; no workflow, command, business rule, ERD, dependency or backend change.

- **Assistant overlap.** For the Patient role the assistant trigger is a top-bar icon button (`aria-expanded`, `aria-controls`, named) and the panel is a popover under the top bar that ends above the bottom navigation (or the viewport edge on desktop); Escape closes it and returns focus to the trigger. The Patient shell renders no floating button, so nothing sits over page content, the bottom navigation, sticky booking actions, dialogs or Messages controls. Staff, Dentist and Owner keep the unchanged floating button and panel (`ClinicAssistant` without `docked`).
- **Touch targets.** A measured audit of every visible interactive Patient control (pages, booking steps, slots and suggestions, notifications, navigation drawer, assistant popover, reschedule and cancel dialogs, Messages thread) at 375, 430, 768, 1024 and 1440px found none under 44px; no control-size change was needed.
- **Keyboard focus visibility.** Scripted Tab testing showed keyboard focus could land under the sticky booking footer (375px) and, at 200% zoom, under the sticky top bar. Patient focusable controls now carry `scroll-margin` that accounts for the top bar, bottom navigation and sticky booking footer, and on viewports 520px tall or shorter the scheduler footer is no longer sticky.
- **Checked (headless Chrome, scripted; not a WCAG certification):** Tab order and a visible focus indicator on every stop (375 and 1440px); the skip link; native booking radios by arrow keys; Enter on Continue moving focus to the step heading; the cancel dialog starting on the safe action, keeping Tab inside it, and Escape restoring focus to its opener; Messages list → thread → Back with focus restored to the conversation; an accessible name on every measured control (966 across 108 views); status, unread and flag badges always carry text; a selected booking choice shows a check mark; no page-level horizontal overflow; 200% zoom (viewports 720×450, 640×400, 512×384, 384×450 and 188×406) on Journey Hub, booking, appointments, Messages, HMO and billing/receipt with every control reachable and unobscured.
- **Still not covered:** screen readers, physical devices, other browsers, forced-colors.

# Phase 4B.2 — Referral & Loyalty (M24)

Built on `7b27d00` (Complete Phase 4B.1 Patient core experience) with a clean tree: 337 tests, 12 render-smoke scenarios and a passing build. This is checkpoint 2 of Phase 4B. It implements M24 as a protected prototype module and aligns the current classification of M24/M25. Phase 4C is not started, and no M25 behavior was implemented.

## Client authorization and classification

The client authorized the team to propose and demonstrate how referral and loyalty could work, and expressed interest in marketing improvements. Therefore, in the current source-of-truth documents and visible copy:

- **M24 Referral & Loyalty = Approved Frontend Enhancement, implemented prototype.** Its mechanics are team-designed for demonstration. They are **not** an established Dr. Dana clinic program and no years of prior operation are implied. It must not block core care.
- **M25 Marketing & Reactivation = Approved Frontend Enhancement.** A limited frontend preview/demo already exists (the Engagement campaign-draft form and table): it sends no real campaigns and still writes through the earlier raw campaign setter, a known technical-debt item. Full Staff/Owner management behavior, a safe command architecture, marketing consent, targeting, delivery and analytics are deferred to the appropriate later role phase.

`AGENTS.md`, `CLAUDE.md`, `README.md`, `MODULE_COVERAGE.md`, `FRONTEND_SCOPE.md`, `ERD_ALIGNMENT.md`, `DOCUMENTATION_RECONCILIATION.md`, `PROFESSOR_DEMO_GUIDE.md` and the production UI skill now say so (the reconciliation record carries a dated requirement-update note). The Phase 1–3.5, 4A and earlier records are deliberately **not** rewritten. The ERD diagrams and Data Dictionary are untouched: only the authorization status changed, and the ERD structure is unchanged. No M26+ was added.

## Prototype program rule

`LOYALTY_PROGRAM.redemptionThreshold = 50` in `src/loyalty.js` is the single exported prototype constant. 50 points is a **team-designed prototype rule**, carried over from the earlier frontend, as are the other program rules in this module: one Pending request at a time, each request processed once, and the same-day duplicate-reward check; whole positive points is the team-designed prototype validation rule for recorded activity; the `DANA-<FIRST>-NN` referral-code format is a technical convention. None is an established Dr. Dana clinic policy. Owner-editable configuration may be considered in a later Owner phase. No monetary value, discount, free treatment, service reward, tier, expiry or referral-qualification timing is defined; the Patient sees neutral "50-point reward" wording only.

## Existing M24 defects corrected

| Before | Now |
| --- | --- |
| Patient page used the fixed `ROLE_INFO.patient.patientId` and wrote `state.loyalty` through the raw setter | Identity comes only from the validated session; the only write is the shared `requestLoyaltyRedemption` command |
| A Patient could request a reward at any balance (the 50-point check only ran when Staff processed it) | The threshold is enforced when the request is made (see the business-rule note below) |
| Staff/Owner handlers wrote the ledger and audit through raw setters, a module-load `TODAY` constant, `Number()` points (fractions allowed), and a `Date.now()`-derived referral code | Shared commands with session actor, centralized clock, safe-integer points, deterministic unique code (`DANA-<FIRST>-NN`) |
| No replay protection, no entry identity, no ledger validation; a stored balance was trusted | Command IDs, stable entry IDs, ledger-derived balance validation, fail-closed on disagreement |
| History rows had no identity; processing mutated whichever "Pending" entry it found | Exactly one Pending request is allowed and processed once; the request is closed and one `Redemption` entry is added |

## Command architecture

`src/loyalty.js` exports `loyaltyActions(run)` (same pattern as `hmo.js` / `communication.js`), registered in `createWorkflowActions`:

- `requestLoyaltyRedemption(commandId)` — Patient only. Takes no Patient or account argument; resolves exactly one account from the session Patient. Extra arguments fail.
- `recordLoyaltyActivity({patientId,activity,points},commandId)` — Staff with the existing `engagement` permission, or the Owner (`all`). Behavior-preserving equivalent of the old form: Qualified Visit / Qualified Referral, same-day duplicate prevention, creates the account when none exists (existing behavior).
- `processLoyaltyRedemption(accountId,commandId)` — same actors. Requires the single Pending request and enough points; never deducts twice.

Each command revalidates the session and role (`permitted()` alone returns true for any Patient, so roles are checked explicitly), branch scope for branch-bound Staff, exactly one account per Patient, a valid ledger, cross-account command-ID ownership and replay, and emits an M24 workflow event. No Patient notification or automation rule was added. `M24` events use the shared runner's failure logging like the other commands. No `createCampaign` command exists.

Ledger rules (`ledgerIssue`): known types only; earning entries positive, requests zero with `Pending`/`Processed`, redemptions negative and `Processed`; safe integers; at most one Pending; unique entry IDs; **stored balance must equal the sum of the ledger**. A ledger that fails is never repaired: mutation is blocked and the Patient sees "Your loyalty activity needs clinic review." Legacy entries without IDs remain valid and are never rewritten for display.

## Patient experience

`src/pages/PatientLoyalty.jsx` + `patientLoyalty()` in `src/patient-view.js` (pure, session-scoped, read-only): a prototype notice; the ledger-validated balance with a progress meter; a referral code with a Copy control only where the browser supports it (success or an honest failure message); the redemption block (enabled request, or a disabled control with "You need N more points…", or the Pending message); readable activity cards (label, detail, signed points, date, status) with no internal IDs; a neutral empty state when there is no account (nothing is auto-created); a clinic-review state that shows no balance and no redemption. Focus moves to the Pending message after a request. The Patient nav label is "Referral & Loyalty" (page key `loyalty` unchanged) and Journey Hub gets a last-position quick-access tile only when an account exists; it never outranks the visit, queue or attention items.

## Staff/Owner rewiring

The Engagement page keeps its layout. Its M24 handlers call the shared commands (session actor, shared clock), errors surface through toasts, the Patient list and account table are limited to Patients the actor may manage, an inconsistent balance shows "Under review", and Process is offered only for a valid Pending request. Copy is aligned; the "Engagement • PE" navigation label and "Proposed" tag are removed. M25 was not redesigned: its limited campaign-draft preview remains the earlier raw draft (`setters.setCampaigns`) with corrected preview/"sends nothing" copy, documented as later-phase technical debt.

## Referral lifecycle boundary

A referral **code** exists; a normalized referral **relationship** does not. Nothing on the page claims who the Patient referred, whether a referred person registered, whether a referral qualified, conversion or revenue, and no referral collection was added. A true lifecycle (referrer → referred Patient → qualifying appointment/completion, tied to Staff-side Patient creation/intake) is a later M24 extension needing its own approved model.

## Persistence and legacy compatibility

No new persistence namespace: the existing `dentalops-v4-loyalty` collection is used. The seeded legacy account (120 points, two ID-less entries) is a valid ledger and reloads unchanged. A Pending request and a Processed redemption survive repeated save/reload cycles byte-for-byte with no false Saved Workspace Recovery. Non-JSON, non-array, id-less or non-object loyalty data still triggers recovery with the stored data untouched. A structurally readable but inconsistent ledger loads (it is not dropped) and is reported for review.

## Business-rule statement

- **Authorized M24 prototype rule enforcement (changed on purpose):** redemption eligibility is now enforced at *request* time (balance ≥ 50, no second Pending request), where before only Staff processing checked the balance. Points must be whole positive numbers. A Patient with an inconsistent ledger cannot request.
- **Unrelated clinic operational/clinical policy: unchanged.** P1–P9 remain `POLICY DECISION REQUIRED` and untouched.
- ERD, M1–M25 mapping (no M26+), dependencies, persistence keys and backend: unchanged. No M25 behavior was implemented.

## Verification

- `npm test`: **390 total, 390 passing, 0 failing** (337 baseline unmodified + 53 in `tests/phase4b2-loyalty.test.js`). `npm run test:smoke`: **13 scenarios** pass (12 + 1 Phase 4B.2; the Phase 4B.1 scenario keeps its assertions). `npm run build` passes with the existing >500 kB chunk warning still visible.
- New unit coverage: Patient scope (second Patient, forged/stale/deactivated sessions, duplicate/non-array data), request (threshold, Pending block, idempotent replay, cross-Patient command IDs, malformed command IDs, non-Patient callers), Staff/Owner (authorized, unauthorized, forged, demoted, branch scope, input validation, duplicate rule, account creation, processing once, legacy Pending entries), ledger integrity (13 malformed shapes fail closed and are never repaired; inconsistent balance; legacy readability; read-only selectors), persistence (legacy reload, Pending/Processed across reloads, corrupt-data recovery, no new collection) and UI/documentation source guards (no raw setter or `ROLE_INFO` in M24 code, no invented benefit or referral relationship, PE copy removed, M25 behavior unchanged (only its pre-existing limited preview), current docs aligned, historical docs untouched).
- **Browser QA** (headless Chrome, states built with the real commands): the 12 required journeys (36 checks, 0 console errors) — open the page, referral code, history, insufficient state, request, Pending across two reloads, Owner processing through the Engagement UI, Processed for the Patient, rapid double click/process creating one effect, another Patient's account invisible, clinic-review state, no-account state — plus a real clipboard copy verified by reading it back, keyboard operation and focus, and long-content wrapping. Responsive: 35 views (375/430/768/1024/1440 × 7 states) with no overflow, no control under 44px, no text under 12px, no unnamed control and no overlap. Phase 4B.1 regression: 234-view audit, 135-view matrix, 93 journeys, 28 accessibility checks, focus-not-obscured and 200% zoom all pass (the only 200% note remains the browser's native file input at 188px). Cross-role: Staff, Dentist and Owner pages are pixel-identical to `7b27d00` at 1440/1024/768/375 except the intentionally changed Owner Engagement page (and the assistant panel captured over it); HMO pages drifted with wall-clock time between runs and were identical back-to-back.

## Known limitations and later work

- Referral lifecycle, Owner-editable program configuration, reward definition/fulfilment, and any Patient notification for M24 are not built. A reward is a recorded, processed request only.
- The demo Staff login (Receptionist) lacks the `engagement` permission, so the Owner is the live demo path for Engagement; Staff with the permission are covered by tests.
- M25 management, marketing consent and targeting, and the raw campaign setter are later-phase work.
- Frontend checks are not backend security; headless Chrome only, no screen reader or physical device testing; not a WCAG certification.

# Phase 4B.2 — final acceptance / consistency pass

Narrow pass before the 4B.2 commit; M24 was not redesigned.

## Staff/Owner loyalty-account enrollment (audited, not regressed)

- **At `7b27d00`:** the Engagement Patient list was `state.patients` (every Patient, including those with no account). Applying a qualified activity to one with no account created the loyalty account in the same step (`uid('loy')` ID, a `Date.now()`-suffixed referral code, the entered points as the balance, and that one activity as its only history entry). There was no separate zero-balance enrollment action.
- **Now:** the same path, through the shared command. The Patient list is `state.patients` filtered to those the actor may manage; `recordLoyaltyActivity` takes the no-account branch, mints a stable `loy-…` ID and a unique `DANA-<FIRST>-NN` code (existing codes are never reused; no `Date.now()`), sets the balance to the recorded points and writes exactly one history entry. It was verified in the real browser (Owner, Patient with no account, Engagement, apply, Patient login).
- **No regression, so no new command.** Adding an `enroll` command would have added a zero-balance enrollment the earlier frontend never had. The Engagement rules notice now says in words that recording a Patient's first qualified activity creates their account and referral code.
- **Safeguard boundary:** Patient, Dentist, unauthorized Staff and forged roles cannot enroll; Staff need the existing `engagement` permission and scope (branch-bound Staff are limited to their scope; all-branch Engagement Staff and the Owner are not); the target Patient must exist; existing duplicate accounts and unreadable ledgers fail closed; a retry with the same command ID returns `unchanged`; other retries append to the one account (or hit the duplicate-reward check), never create a second account; malformed input creates nothing. The Patient page's no-account state stays read-only and neutral.
- **Tests:** 12 new tests (10 enrollment tests and 2 documentation-precision guards: Owner, Staff with permission, Engagement Staff, Staff without permission, Patient self/other, replay and immediate retry, duplicate accounts, malformed input, unique codes and IDs, two persistence reloads without recovery, and source guards that the Patient list is built from Patients and the Patient page cannot enroll).

## Prototype rules and M25 wording

- Every M24 rule is documented as team-designed prototype behavior, not historical clinic policy: the 50-point redemption threshold, one Pending request at a time, each request processed once, the same-day duplicate-reward check, and whole positive points as the input validation rule. No monetary value, discount, free service, expiry, tier, referral-qualification timing or conversion rule was added.
- M25 is described precisely everywhere current: **approved; a limited frontend preview exists; it sends no real campaigns; full Staff/Owner management, a safe command architecture, consent, targeting, delivery and analytics are deferred to a later role phase; the raw campaign setter is known technical debt.** The module coverage tile, the Engagement notices and `MODULES` data (`preview: true`) match. No M25 behavior changed.

## Verification

- `git diff --check` clean. `npm test`: **402 total, 402 passing, 0 failing** (390 + 12 new). `npm run test:smoke`: **13 scenarios** pass (the 4B.2 scenario gained two enrollment assertions). `npm run build` passes (JavaScript 546.81 kB, CSS 87.15 kB); the existing >500 kB chunk warning remains visible.
- **Browser QA** (headless Chrome, states built with the real commands): enrollment journey at 375, 1024 and 1440px, 34 checks: Patient with no account → Owner opens Engagement → establishes the account (rapid double click) → one account with one referral code and the recorded balance appears once → Patient logs in and Referral & Loyalty shows the new account → two reloads keep exactly one unchanged account with no recovery warning; then request → Pending (rapid double click creates one request; survives two reloads) → Owner Process (rapid double click deducts once) → Processed for the Patient → reload/retry has no duplicate effect and no Process control remains. Re-verified on the final build: the 12 M24 journeys (36/36), the M24 responsive matrix (35 views, no problems), the Engagement/M25 preview checks, the 93 Phase 4B.1 Patient journeys and the 234-view audit, 0 console errors throughout. Cross-role pixel comparison against `7b27d00`: identical except the intentionally changed Owner Engagement page (and the assistant panel captured over it); the time-driven Owner Dashboard/HMO pages matched back-to-back.
- One harness note: the saved QA states are date-pinned, so after the calendar date rolled the 4B.1 journeys failed until the states were rebuilt for the new day (stale test data, not an application change).
