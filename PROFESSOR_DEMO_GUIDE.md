# Professor Demo Guide — Current Connected Workflow

For the Phase 4B checkpoint (domain baseline `dac864e`, through Phase 3.5; the Patient experience and M24 were added in Phase 4B). Use [Module Coverage](MODULE_COVERAGE.md) for all 25 approved modules and [Documentation Reconciliation](DOCUMENTATION_RECONCILIATION.md) for policies/conflicts. This is a frontend with local persistence and shared validation, not a live provider/payment system.

## Prepare the demonstration

1. Run `npm test`, `npm run test:smoke` and `npm run build`; start `npm run dev`.
2. Use illustrative data only. Reset demo data only if discarding existing local demo work is intended. Reset rebases pristine examples; refresh does not move saved history to today.
3. Note the Manila clinic date/time, open branch, assigned Staff and logged-in Dentist. The Staff/Dentist/Owner role-entry buttons use fixed demo identities, not a general password-login service; the Patient tab additionally offers self-registration and email sign-in (a frontend demo account flow — no real password or verification). Select a branch/Dentist reachable by those identities for the connected journey.
4. For live admission/treatment, use today's valid appointment and available assigned Dentist. If there is no valid remaining slot or the clinic is closed, show a future booking and explain admission is a separate current-day event. Use the deterministic smoke scenarios as evidence for the full chain; do not bypass time validation or pretend a historical encounter is current.
5. Follow one Patient and exact appointment/queue/treatment/invoice IDs throughout. A fresh completed treatment supplies a usable invoice; historical seed charges may correctly require clinic review.

## 1. Patient: register, sign in and book without payment

To show the identity relationship live: on the Patient tab choose **Create an account**, fill first/last name,
email, contact number, an optional date of birth and a preferred branch, then **Create account**. This atomically
creates a `PERSON` + `PATIENT` + `USER` sharing the same person relationship. On the success panel, choose **Sign
in** with that same email — sign-in resolves strictly from that `PERSON`/`PATIENT`/`USER` relationship, never from a
typed Patient ID. A brand-new Patient (no appointment, care, prescription, invoice, follow-up or HMO case yet) lands
on a simpler **first-use Home**: a greeting and a single "Need a visit?" card leading to **Start booking**, with no
booking form embedded on Home. Once real history exists, the same Patient sees the full Journey Hub below on their
next visit to Home — that is derived from real state each time, not a stored "onboarding" flag.

Distinguish plainly what this demonstrates:
- **Current frontend:** the created records live in this browser's persisted local application state. This
  demonstrates the ERD-aligned relationship (shared `person_id`), not a finished authentication system.
- **Future backend:** a real database transaction, real credentials, email verification, server-side authorization
  and database uniqueness constraints. None of that exists yet. Do not call the current local storage a database.

For the rest of this demo, either continue as the account just created, or log out and choose **Continue as
Patient** for the seeded demo persona (Maria Santos) — her one-click sign-in is unchanged.

Log in as the Patient. **Home** (Phase 4B.3C-1) is active-care-first: an active visit or queue place first, then
today's visit or the next appointment, a primary "Book a visit" action when neither applies, compact quick actions
(Payments, Prescriptions, HMO, and Messages/Referral & Loyalty when they apply), and only genuinely blocking state
under "Action required" — a Returned/Missing HMO item, an Open Dentist-requested follow-up, or an issued unpaid
invoice. Ordinary notification-channel events (unread messages, a newly authorized prescription, the unread count)
live in the Notification bell, not a giant Home card. Mobile navigation is exactly **Home, Book, Visits, Menu**
(Pass 1 remediation: Patient has exactly one menu entry point — the top-left workspace hamburger no longer
renders for Patient; other roles keep it unchanged). The Menu sheet is grouped — **Bookings** (Book Appointment,
Visits), **Communications** (Messages), **Account** (Receipts & Payments, My Profile) — with Logout visually
separated at the bottom and requiring confirmation before it fires. HMO, Prescriptions, Follow-ups and Referral &
Loyalty are intentionally not repeated in the Menu; they remain reachable via My Profile → More. The Clinic
Assistant floating logo FAB is Patient-only — Staff/Dentist/Owner do not render it.

Open **Book**: it opens with an explicit choice, **Smart Find** or **Manual booking** — never a numbered step.
Smart Find asks branch (optionally via "Use my location," which honestly falls back to a plain branch picker since
no branch has coordinates configured yet), then service, then shows several deterministic recommended options
(date/time/branch/Dentist) at once — describe it plainly as deterministic scheduling, not AI. Manual booking is
Branch → Service → Date → Time; **there is no Dentist-choice step in either mode** — the Dentist is assigned
automatically by the same Phase 4B.3B deterministic domain, shown at Review as "Assigned based on service
availability." Leaving the flow partway through saves a **Booking Draft** (a distinct, non-reserving record —
BOOKING DRAFT != APPOINTMENT); reopening Book offers to resume it, revalidating the saved branch/service/time
against current state rather than trusting it silently.

Confirm a valid future start. Explain that the booked service provides context; the Dentist later chooses actual
Performed Procedures. Nothing is charged during booking — there is no payment step, deliberately, since the final
treatment total is not known at booking time. In Visits, optionally reschedule before admission, retaining Patient
identity. Cancellation/rebooking can be shown before care; do not claim an unsupported minute-based cutoff.

Show the confirmation Notification. Patient does not perform Check-In in the current app. Switch to Staff for arrival.

## 2. Staff: fast Check-In and queue operations

Select the intended scheduled arrival explicitly in Check-In, verify Patient/branch/Dentist, then Confirm arrival. Known Patient data is reused. A repeated admission reuses the existing encounter instead of adding another queue row. Walk-in admission is a separate validated path and does not invent a reserved appointment.

Open Patient Queue. Demonstrate Call/Ready as appropriate, Temporarily Away and Return; arrival time is preserved. Emergency priority requires a reason and creates audit context. No-show remains an operational Staff action; no grace period is invented. Avoid marking the main demo encounter No-show if it will continue to Treatment.

Explain that an admitted appointment cannot be rescheduled. Cancellation before clinical documentation can close its linked queue/check-in; after clinical work starts, it is protected. Staff never independently completes clinical treatment or the clinical queue step.

As Patient, show only the Patient's own position/status. As Dentist, show only that Dentist's queue. Compare Queue with Capacity & Workload: order and state are different from aggregate wait/load estimates. Durations are case-by-case, so estimates are not guarantees.

## 3. Dentist: exact encounter and explicit clinical choices

From My Queue, call the Patient if needed and open the exact Treatment context. Check Patient, branch, Dentist and linked visit; no global Patient replacement is permitted inside this encounter.

Document progress with **Save Treatment Progress**. Add actual procedure lines from authorized services, quantities and notes. If appropriate to the illustrative case, demonstrate two authorized procedures despite only one booked service. Enter the required performed-procedure description. Draft saving keeps care active and creates no final invoice or unnecessary downstream tasks.

Explicitly choose whether Prescription and Follow-Up are required. For a requested Follow-Up, enter the recommended date/interval and reason. These are Dentist decisions, not automation suggestions.

Choose **Complete Treatment**. Show the exact queue/appointment closed, one Draft invoice from performed procedures, and only the requested obligations. Completed treatment is read-only. Repeating completion must not duplicate the chain.

If Prescription was requested, open its task, enter illustrative medication/dose/instructions yourself, optionally save Draft, then explicitly authorize. Do not use the app to select medication. Patient cannot see the draft; authorization makes their own prescription available. Correction/reissue is an unresolved workflow, not a draft-edit action.

## 4. Staff: review, issue, record payment and schedule return

Open the newly generated invoice in Billing. Select **Review Invoice** and inspect Patient, treatment, each performed procedure/quantity/fee and total. Review is a meaningful state before **Issue Invoice**. Draft/Review is private from Patient.

After issuance, choose **Record Payment** and the exact full positive total. Use **Record Cash** for a locally recorded cash example or **Simulate Card / Electronic**, explicitly stating no funds transfer occurs. Show Paid, payment ID and linked receipt; a retry must not create a second payment. Invalid/partial/overpayment attempts are rejected. Do not use a zero-fee case to demonstrate settlement: that clinic policy is unresolved.

Open Follow-Ups and schedule the obligation the Dentist already requested. The form preserves the source Patient/Dentist/branch and uses the same appointment validator. Show that a cancelled/no-show return appointment permits rescheduling the obligation; changing a booking does not change the clinical decision. Own Patient self-scheduling is also supported.

## 5. Staff and Patient: HMO M12 → M13 → M14

Use an insured Patient with configured membership and an exact appointment/completed treatment. Staff can prepare the case; qualifying completed care also triggers preparation/linkage once. Missing membership is not invented.

- **M12:** inspect the HMO Card, Valid ID and Dentist treatment request checklist. Patient records metadata for their own missing document; no file is uploaded. Staff validates local requirements. Ready for Submission means local preparation only.
- **M13:** select **Record External Submission**, enter channel and tracking note for the illustrative action handled outside the app. Then **Record Provider Response** records an illustrative externally received Approved, Rejected or Returned outcome. State clearly that the demo does not contact an insurer or verify coverage.
- For **Returned**, select requirements needing correction, correct/validate them, then **Record Resubmission**. Same case ID, new cycle; stale-cycle responses are rejected.
- **M14:** use an already eligible pending case with valid timestamps/current-cycle contact to show follow-up and escalation. The documented threshold is 12 hours; do not claim a newly submitted case instantly qualifies. If no eligible case exists, show the deterministic timer/contact/escalation smoke coverage. Escalated remains actionable for contact and provider response; it does not mean Approved or Rejected.

Patient sees only own status, public outcome and required actions. Internal contact/response notes remain operational. Historical or malformed legacy cases may require review rather than accepting new tracking actions.

## 6. Patient: results, Notifications and Messages

Show the completed visit's details in Visits (Past tab — care history lives there, not on Home), including its real
payment status and, once Paid, actual payment method from the linked Payment. Also show the authorized
Prescription, Follow-Up, issued itemized invoice/payment status/Receipt, and safe HMO information. Use the newly
completed encounter, since unsupported historical Paid records are not valid Patient receipts.

Open the global notification bell: own unread count, recent/full history, individual read and Mark All Read for this recipient only. Follow a relevant action; a stale or inaccessible destination is unavailable instead of exposing another record. Updates occur through shared local state, not cross-device transport.

Open Messages separately. Use an explicit-participant conversation, record a reply and show its independent unread state. A role named Dentist does not grant access to every thread; Owner is not automatically a participant. Closed conversations reject replies. Do not describe failed-email retry as part of Messages.

Open **Referral & Loyalty** (Me). A Patient with no account sees a neutral empty state. To establish one, switch to Owner → Engagement (the demo Staff identity is a Receptionist without the engagement permission) and record a qualified activity: this creates the account and referral code. As the Patient, show the code, ledger-validated points and activity history; the reward request stays disabled below the prototype threshold and says how many points are missing. Request the reward (it becomes Pending), then as Owner choose **Process request**, and the Patient sees it Processed. State plainly that the 50-point threshold and other rules are team-designed prototype rules, no reward benefit is defined, and no referral relationship is tracked.

Optionally show Staff Social Inquiries: record assigned inquiry/status, link the already-booked appointment, then show the traceable conversation. Repeating conversion reuses the links. No Facebook/email provider receives these records.

## 7. Owner/Admin: configuration and oversight

Show account/profile synchronization in People & Access and Team: canonical person identity, role/branch, separate account status and operational availability. Branch hours/services and personnel changes use shared validation.

Show Dashboard, Capacity, HMO oversight and Automation Monitor. The monitor presents event/entity/actor/time, successes, warnings and selected failed actions with read-only rule descriptions. A clinical completion can remain valid while an HMO handoff warning needs attention; do not call that whole handoff successful.

Analytics is **partial**. Show existing operational projections and spreadsheet-safe CSV export, but do not claim Today/This Week/This Month filters work. Communication aggregate and capacity export do not consistently honor branch selection. Historical Paid totals are illustrative, not verified revenue reconciliation. These are disclosed in the conflict register, not fixed by this documentation phase.

Owner oversight does not grant Treatment, Prescription, Payment, HMO processing or Message participation. Existing shared administrative booking/admission/queue exceptions are documented; use the Staff surface for the normal demo.

If showing M24/M25, do so last. Call them **Approved Frontend Enhancements**: M24 Referral & Loyalty is an implemented team-designed prototype (the 50-point redemption threshold, one-Pending-request rule and whole-positive-points validation are team-designed prototype rules, not historical clinic policy), and M25 Marketing & Reactivation is approved with only a limited campaign-draft preview today (it sends nothing); full management is deferred to a later role phase. Use the coverage document for defense; it is not a production navigation item.

## Module-defense statements

| Module | Explain its distinct responsibility |
| --- | --- |
| M8 | “Record that the Patient has arrived.” |
| M9 | “Where am I in line?” |
| M10 | “How long will the line take / can the clinic handle it?” |
| M12 | “Verify and prepare HMO requirements.” Local preparation is not coverage approval |
| M13 | “Submit and track the provider's externally received response.” Here the app records external submission/response |
| M14 | “Follow up and escalate overdue HMO cases.” |
| M17 / M18 | Two-way human Messages / one-way operational Notifications |
| M21 | “Analyze what happened.” Current reporting remains partial |
| M22 | Present that information for Owner oversight |
| M23 | “Automate what happens next based on predefined workflow events.” |

> Module 23 connects the modules by listening for workflow events and automatically triggering the next required administrative action based on predefined rules.

In this frontend, shared commands implement that coordination; there is no background event server. M23 never determines diagnosis, procedures, medication, Prescription need or Follow-Up need.

## Honest verification statement

The clinic already has digital booking, billing and records; paper prescriptions are an exception. This prototype demonstrates improved coordination and safeguards. At Phase 4B, 402 automated tests, 13 render-smoke scenarios and the Vite build pass. SSR smoke covers workflow/recovery renders, not real browser clicks, device/accessibility certification or backend security. Patient production UI and scripted headless-Chrome QA were completed in Phase 4B; the Staff, Dentist and Owner passes remain later work, and no screen-reader or physical-device testing has been done. No unknown timing, override or amendment policy is assumed for this demo.

## Patient demo limitations (documented, not hidden)

- Self-registration is a frontend demo account flow: no password, no email verification, no server enforcement — the registration screen states this. A registered account survives reload (it is written to local storage), but the signed-in session itself is not; reopening the app returns to Login and needs signing in again, for every role, not only a newly registered Patient.
- Second-Patient isolation can now be shown live by registering a second account, in addition to the existing automated-test coverage.
- The Patient does not check in: Staff records arrival, so the live queue appears only after Staff admits the Patient. There is no Patient self-check-in, online payment, or Patient-started conversation.
- Seeded operational dates rebase to the current Manila day only for pristine/reset data, so a live-queue demonstration needs today's seeded visit (or a fresh reset).
- The demo Staff identity cannot open Engagement; use the Owner for the Referral & Loyalty administration steps.
- Referral & Loyalty is a prototype: no reward benefit, value, expiry or referred-Patient tracking exists, and M25 campaigns send nothing.
- The unresolved clinic policies (cancellation/reschedule cutoffs, earliest check-in, no-show threshold, override authority, amendments, conversation reopening, zero-fee settlement) are not assumed anywhere in the Patient screens.
- Booking (Phase 4B.3C-1): no payment step exists at booking (no PayMongo, no deposit, no Cash/Card choice) — nothing is charged until a completed visit's invoice; Smart Find's location step always falls back to manual branch selection since no branch has real coordinates configured yet; there is no Patient Dentist preference — a Dentist is always assigned automatically; a Booking Draft is a frontend-local record only, not an ERD table.
- Me is view-only: no profile field can be edited yet, and no OTP (real or fake) exists — editing is deferred to a future backend-verified phase.
