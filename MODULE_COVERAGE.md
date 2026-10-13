# Module Coverage

Updated October 12, 2026. Version 5.0. Finalized planning scope.

The agreed planning catalog contains 25 numbered modules, with five primary assignments per member. Scope and assignments are finalized for documentation. Implementation evidence and clinic-specific policy remain separate; this revision does not certify a working production system.

Roles are exactly Patient, Staff, Dentist and Owner. The stack remains React/Vite, Laravel 13, PostgreSQL and Sanctum. New development excludes HMO, inventory, a generic workflow-automation engine, rewards and marketing campaigns. PayMongo belongs to M23 Payment Management; email delivery to M18; informational AI to M7.

## Final catalog

| Module | Primary owner | Owned responsibility | Implementation evidence |
| --- | --- | --- | --- |
| M1 User Management | Licanda, Celin | Person, employee profile, User, invitation and access history | Reported backend account/security foundation. Complete employee invitation and activation remain unfinished. |
| M2 Branch Management | Licanda, Celin | Branch profile and operating calendar | Reported branch backend foundation. Complete hours/closure workflow is not established. |
| M3 Work Schedules | Licanda, Celin | Dated Staff/Dentist roster, branch assignment, availability exception and schedule revision | Reported personnel/availability foundation exists under historical M3. Complete dated Staff/Dentist roster and automated leave integration require implementation. |
| M4 Patient Records | Ecal, Richmon | Person/Patient identity, health history and correction history | Reported identity/profile foundation. Full history, merge and restoration workflows remain incomplete. |
| M5 Treatment Management | Ecal, Richmon | Visit-linked Treatment and immutable completed revisions | Reported server-authoritative Treatment foundation with responsible-Dentist authorization and immutable completion. |
| M6 Appointment Management | Alejo, Hart Jaztin A. | Appointment, revision and attendance-response history | Reported booking/conflict foundation. Calendar integration and attendance-response workflow require a scoped return pass. |
| M7 AI Chatbot | Delos Santos, Joevan | Approved knowledge version and scoped assistance request | Reported constrained Patient-only server adapter and curated knowledge foundation; live provider use is unverified. |
| M8 Patient Visits | Alejo, Hart Jaztin A. | Arrival evidence, authoritative Visit, assignment and encounter-state history | Reported scheduled/walk-in Visit foundation. Assignment completeness and live integration require verification. |
| M9 Patient Queue | Alejo, Hart Jaztin A. | QueueEntry, numbering and transition history | Reported server queue foundation. Live UI completeness and refresh behavior remain integration work. |
| M10 Dental Charts | Ecal, Richmon | Patient tooth/surface finding and chart revision | Proposed new domain. The former M10 flow/capacity prototype is not a dental-chart implementation. |
| M11 Billing Management | Delos Santos, Joevan | Invoice, immutable charge evidence, balance and authorized correction history | Reported historical M11 billing/payment foundation, immutable charges and financial safeguards. The proposed separate billing/payment ownership requires source reconciliation. |
| M12 Treatment Plans | Alejo, Hart Jaztin A. | Versioned proposed plan, phases, estimates and Patient decision | Proposed new domain. Legacy HMO M12 records and the superseded attendance proposal are not treatment-plan records. |
| M13 Services and Pricing | Licanda, Celin | Service/procedure definition, branch offering and effective price version | Reported catalog and effective-price backend foundation; clinic-approved values still require source verification. |
| M14 Document Management | Millar, John Yzhekiel | Private original file, metadata and extraction draft | Reported private-storage and extraction foundation. New separation from consent needs compatibility review. |
| M15 Leave Management | Licanda, Celin | LeaveRequest, shift-specific CoverageOffer, explicit acceptance and decision history | New module scope. Earlier handoff recorded the optional coverage-first concept; no complete leave engine is proven by the historical M23 evaluation recorder. |
| M16 Patient Inquiries | Millar, John Yzhekiel | Attributed external inquiry, assignment and outcome history | Reported manual external-inquiry backend foundation; no real social-platform transport demonstrated. |
| M17 Patient Messaging | Millar, John Yzhekiel | Participant-scoped conversation, immutable messages and read state | Reported server messaging foundation. Production creation/routing and external-channel integration are not established. |
| M18 Notifications | Millar, John Yzhekiel | Notification intent, dispatch job, attempt and delivery evidence | Browser-local in-app notifications only (a persisted browser collection and foreground reminders, not authoritative). No backend notification intent, dispatch job, attempt or delivery-evidence record exists. Appointment booked/rescheduled/cancelled and payment-receipt emails are durable intents written in the domain transaction and sent by a queue worker with atomic claims, recorded attempts and bounded retries; verification-code, invitation and diagnostic emails are sent once immediately and recorded. Outcomes stay distinct (logged locally, accepted by transport, failed); the default mailer is log and no recipient-delivery evidence exists. Actual recipient email delivery has not been demonstrated. |
| M19 Prescriptions | Ecal, Richmon | Dentist draft and immutable authorized prescription version | Browser-local only: prescription drafts and Dentist authorization are kept in a browser-persisted collection. The server stores only the Dentist prescription_required flag on the Treatment; there is no backend prescription record, immutable authorized version, route or printable output. Authorized production behavior and printing are not implemented. |
| M20 Patient Follow-Up | Alejo, Hart Jaztin A. | Dentist-originated follow-up obligation and outcome history | Browser-local obligations: follow-up tasks are created in the browser from the Dentist-documented follow-up fields recorded on the server Treatment and are scheduled through ordinary M6 booking commands. There is no backend follow-up obligation, outcome history or reminder record. |
| M21 Reports and Analytics | Delos Santos, Joevan | Authorized report definition and source-traceable result/export | Reported M21 technical corrections at 6563e4c; complete executive reporting and production readiness are unverified. |
| M22 Audit Logs | Delos Santos, Joevan | Append-only audit event and scoped investigation/export | Reported server append-only audit foundation with Owner read/CSV and cursor pagination; advanced usability remains incomplete. |
| M23 Payment Management | Delos Santos, Joevan | CheckoutAttempt, verified Payment, receipt and reconciliation exception | Reported payment/PayMongo foundation currently belongs to historical M11. Separate M23 ownership is planned; sandbox E2E and recipient email receipt have not been verified. |
| M24 Lab Cases | Millar, John Yzhekiel | Patient-linked LabCase, dispatch/return events and Dentist review history | New module; user confirmed October 12 that external laboratory work is tracked manually. Existing rewards M24 records are not LabCase records. |
| M25 Patient Handovers | Ecal, Richmon | PatientHandover, purpose-scoped care packet, acknowledgment and outcome history | New module; user confirmed October 12 that inter-Dentist/branch handovers are coordinated informally by calls/messages. Existing campaign M25 records are not PatientHandover records. |

## Assignments

- Licanda, Celin: M1, M2, M3, M13, M15 (five modules).
- Alejo, Hart Jaztin A.: M6, M8, M9, M12, M20 (five modules).
- Ecal, Richmon: M4, M5, M10, M19, M25 (five modules).
- Delos Santos, Joevan: M7, M11, M21, M22, M23 (five modules).
- Millar, John Yzhekiel: M14, M16, M17, M18, M24 (five modules).

## Module specifications

Every module has owned records, authority, inputs, eight process activities, outputs, dependencies, automation, open configuration and acceptance scenarios in [Module IPO Blueprint](docs/MODULE_IPO_BLUEPRINT.md). The academic document is [Module Documentation](docs/planning/BPA_MODULES_UPDATED_OCT_12_2026.docx).

Leave Management shows eligible coverage, sends an invitation, records explicit acceptance of the exact shifts/overtime, rechecks eligibility/conflicts and approves automatically only when all required coverage and configured rules pass. Partial or unconfirmed coverage remains pending. Scheduling owns the resulting roster; invitations do not force overtime or silently reassign patients.

Lab Cases and Patient Handovers are supported by the user's October 12 confirmations of manual external-lab tracking and informal inter-Dentist/branch care coordination. Detailed fields, permissions and exception rules remain to be completed in their specifications.

Attendance responses are M6 features; actual arrival remains M8. Images and OCR are M14 capabilities; clinical consent, archive/restore and name history stay with their owning records. Private Patient feedback keeps existing restrictions. Intake, expense tracking, standalone security and system monitoring are not extra numbered modules.

## Implementation coverage

Reported engineering checkpoints are inherited evidence, not tests rerun for this revision. Finalized module scope does not imply completed implementation, configured clinic policy or production readiness. Complete workflows require source inspection, agreed fields/permissions and integration verification. See [Development Readiness](docs/MODULE_DEVELOPMENT_READINESS.md).

## Retained runtime enhancements (historical M24/M25 identities)

The finalized catalog reuses the numbers M24 and M25 for Lab Cases and Patient Handovers. The earlier runtime features keep their own identities and are Proposed Enhancements (PE), not part of the 25-module scope, and may not block core care operations. **Referral & Loyalty (runtime M24)** is an implemented browser-local prototype. Its program rules — the 50-point redemption threshold, one Pending request at a time, each request processed once and the same-day duplicate-reward check — and its whole positive points validation rule are a team-designed prototype for demonstration, not historical clinic policy and not an established clinic program. **Marketing & Reactivation (runtime M25)** has a limited frontend campaign-draft preview whose drafts send no real campaigns and which still writes through the earlier raw campaign setter, which is known technical debt. M25 management behavior, marketing consent, targeting, delivery and analytics are deferred to a later role phase. Neither feature is a Lab Case or a Patient Handover record. See [Module Identity Transition Map](docs/MODULE_IDENTITY_TRANSITION_MAP.md).

## Runtime identity compatibility

The display catalog does not rename existing domain keys, registry entries, routes, tables or historical records. Preserve existing financial holds, immutable completed records and access restrictions until a reviewed transition. See [Identity Transition Map](docs/MODULE_IDENTITY_TRANSITION_MAP.md). Historical PI/DQ/TD references retain their original module meanings; no decision IDs are created or resolved by renumbering.
