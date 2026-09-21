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
