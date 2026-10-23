# REVISIONS.MD
## Production Readiness and UI/UX Revision Checklist
**Project:** Dr. Dana E. Roxas Dental Clinic — Multi-Branch Dental Clinic Operation System

**Purpose:** Consolidated revision requirements for the Patient, Staff, Dentist, and Admin interfaces.

> **Implementation rule:** Treat these as requirements to inspect and implement, not proof that a feature already exists. Inspect the current codebase first, reuse existing components and patterns where appropriate, and verify changes with tests or clearly report what could not be tested. Do not use real patient data for test scenarios.

> **Status legend (audited 2026-10-23, Asia/Manila):** `[x]` done and checked in code · `[~]` partial (note says what is missing) · `[ ]` not done or needs a clinic decision.
> Frontend: 883/883 unit tests, 16/16 smoke suites, build OK. Backend tests were **not** run on this machine (PHP is missing the `mbstring` extension).

---

## 1. Global Revisions

### 1.1 Consistent UI/UX across all roles
- [~] Establish a consistent design system across Patient, Staff, Dentist, and Admin UIs. *Shared tokens exist; not every screen is migrated.*
- [~] Reuse shared components for filters, search, date ranges, dropdowns, pagination, tables, status badges, cards, dialogs, and loading/empty/error states. *`FilterBar` implemented and shared across User Management, Audit Trail, Appointments, and Dentist Schedule.*
- [~] Filters should have the same layout, spacing, styling, behavior, and responsive rules wherever used. Change only the filter fields needed by each screen. *`FilterBar` provides consistent layout across Appointments, Schedule, Audit Trail, and User Management.*
- [~] Standardize cards, spacing, buttons, form controls, status labels, and modal/dialog behavior.
- [ ] Remove large, redundant module title/description banners at the top of each UI to reclaim space. Keep a concise page label or breadcrumb where needed for orientation and accessibility.
- [x] Add a consistent logout confirmation dialog: **“Are you sure you want to log out?”** with **Yes / No**. “No” closes the dialog; “Yes” logs out.
- [~] Ensure responsive layouts work on desktop, tablet, and mobile without horizontal overflow or inaccessible controls. *Not re-checked on real devices after these changes.*
- [~] Provide consistent loading, empty, success, and error states. Avoid dead controls and misleading placeholder features.
- [~] Meet production-level standards for validation, authorization, privacy, error handling, accessibility, auditability, and maintainability.

### 1.2 Priority handling (Senior citizens, PWD, and other eligible patients)
- [x] Inspect whether patient priority/queue prioritization already exists and document its current behavior. *Existed as one "Urgent" priority with a required reason.*
- [~] If missing or incomplete, implement a configurable priority system for eligible patients, including senior citizens and persons with disabilities (PWD), subject to applicable laws and clinic policy. *Staff can now pick Senior Citizen / PWD / Urgent with a reason; not Owner-configurable.*
- [ ] Record eligibility category and verification status with appropriate access controls; collect only necessary information and avoid exposing sensitive details publicly.
- [~] Apply priority consistently to queue, estimated waiting time, staff check-in, dentist queue, and relevant reports. *Queue and badges only; wait estimate and reports not checked.*
- [x] Show staff/dentists an understandable priority indicator and reason where authorized. Do not display sensitive personal details on public queue screens.
- [ ] Define tie-breaking rules, emergency handling, appointment-time considerations, and how priority interacts with patients already called. Do not silently reorder patients already being served.
- [x] Log priority changes and overrides, including who changed them and when. *Through the existing queue priority command (reason required).*
- [ ] Do not assume every senior/PWD patient automatically receives identical queue handling without checking applicable requirements and clinic policy. Document the approved rule. *Needs clinic decision (section 8).*

### 1.3 Production-readiness requirements
- [~] Separate verified existing behavior from partially implemented, missing, and proposed functionality. *This file now does that.*
- [~] Use server-side authorization and validation for sensitive actions; frontend-only restrictions are insufficient.
- [x] Preserve patient confidentiality and role/branch access boundaries. *Covered by existing tests; no change weakened them.*
- [~] Use transactions and concurrency-safe logic for appointment booking, check-in, queue updates, leave coverage, billing, and other multi-step operations. *Booking/check-in/queue yes; leave coverage does not exist.*
- [x] Do not invent clinic policies, prices, marketing conversions, HMO terms, or clinical guidance. Mark configurable or hypothetical values clearly. *Exception: see 4.4 — the medicine presets need dentist review.*
- [~] Add audit logs for important changes, exports, access to sensitive records where appropriate, and overrides.
- [~] Provide meaningful error messages, logging, retry behavior where appropriate, and safeguards against duplicate submissions.
- [~] Test role permissions, branch isolation, time zones, edge cases, responsive behavior, and failure states. *Frontend only this round.*
- [x] Do not claim a feature is complete or tested without evidence. Never use production patient data for development/testing.
- [x] Do not run destructive database operations, expose secrets, deploy, push, merge, or incur external costs without explicit authorization.

---

## 2. Patient UI

### 2.1 UI segregation
- [x] Review and improve separation between patient-facing pages and staff/dentist/admin functionality.
- [x] Ensure patients can access only their own appointments, visits, billing, documents, messages, and personal records. *Covered by existing isolation tests.*
- [~] Hide internal operational tools and internal-only terminology from the patient portal.

### 2.2 Book a Visit
- [x] Let patients choose any available branch, even when another branch is identified as nearest. The nearest branch may be recommended, but must not be forced.
- [~] On the review/confirmation step, let patients choose the supported payment method, including **e-card** or **cash**, if supported by clinic policy and the existing payment integration. Clearly show payment timing and limitations. *Review now shows the payment method and timing. Only PayMongo online is supported at booking; cash-at-booking needs a clinic decision.*
- [x] Keep unavailable/taken appointment times visible but disabled and grayed out instead of removing them. Provide an accessible label explaining that the slot is unavailable.
- [x] Recheck availability on the server at final booking to prevent two patients booking the same slot.
- [x] Ensure services that cannot be booked directly (for example, brace-only checkups if that is the clinic rule) are not offered for patient self-booking. Confirm the service rule before applying it. *Owner sets this per service in Services & Pricing → Online booking.*
- [x] Show clear review details before submission: branch, service, date, time, payment method, and applicable fees/policy.
- [x] Provide clear confirmation after successful booking and prevent accidental duplicate submissions.

### 2.3 My Visits
- [x] In rescheduling, keep unavailable times visible, disabled, and grayed out. *Verified in code: `RescheduleDialog` in `Visits.jsx` reuses `<TimeSlots>` from `BookingCalendar.jsx` which displays all standard slots with `.is-unavailable` and `disabled`.*
- [x] Add a cancellation-reason selection with predefined options, for example:
  - No longer need the appointment
  - Schedule conflict
  - Feeling unwell
  - Booked the wrong date, time, branch, or service
  - Found another appointment
  - Other (requires a reason)
- [x] Allow an optional note where appropriate, and record the cancellation reason in appointment history.
- [x] Do not charge or apply a penalty based on a cancellation reason unless an approved clinic policy explicitly defines it.

### 2.4 Billing and receipts
- [x] Show receipts and payment records in the patient Billing section.
- [x] Email the receipt to the verified email address associated with the account after successful payment/receipt issuance.
- [ ] Provide a resend-receipt action if supported, with rate limiting and audit logging.
- [x] Distinguish a booking confirmation from an official payment receipt. Do not issue a “paid” receipt for an unpaid or cash-not-yet-collected transaction.
- [~] Show transaction date, receipt/reference number, branch, itemized services, amount, payment method, payment status, and applicable adjustments/refunds where relevant. *Refunds not shown.*
- [x] Handle email failures visibly and safely; do not report that an email was sent unless the mail provider confirms success.

### 2.5 Patient Documents
- [ ] Define and document the purpose of the Patient Documents module before adding more features.
- [ ] Recommended scope to validate with the clinic: patient-accessible copies of approved documents such as treatment plans, prescriptions, consent forms, receipts, and clinic-issued records.
- [x] Distinguish patient uploads from clinic-issued documents, with document type, issue/upload date, status, and source. *Category badge, source badge (`Patient upload` vs `Clinic-issued`), file size, status, and upload date displayed in `PatientDocumentsTab`.*
- [x] Apply file type/size validation, safe upload handling, private storage, access checks, audit logging, and retention/deletion rules. *Existing M14 behavior.*
- [x] Do not expose internal-only documents, other patients’ files, staff notes, or records the patient is not authorized to view.

---

## 3. Staff UI

### 3.1 Check-In
- [x] Audit controls such as **Open Kiosk Mode**, **New Code**, and **Counter Poster**: verified in code and integration that these are working workflows connected to `/api/intake/code/refresh`, `/api/branches/{id}/poster`, and the tablet kiosk `#kiosk/{branch}/{code}` with automatic 60-second reset.
- [ ] Isolate the **New Patient** creation flow within Check-In where appropriate, and remove duplicate entry points from Patient Records if that is the intended workflow.
- [x] Ensure check-in and walk-in admission cannot create conflicting appointments or duplicate queue entries. *Existing idempotent commands and tests.*
- [x] Validate selected branch, appointment, patient, dentist, service, and time on the server.

### 3.2 Notifications and follow-up tasks
- [x] Fix the notifications panel so all notifications can be scrolled to and accessed on desktop and mobile.
- [x] Follow-Up Tasks workflow verified and refined: filters apply reactively on change; 'Book follow-up', 'Contacted', and 'Close it' are fully wired with server validation; added 'Cancel' action when writing closing notes to avoid trapped states.
- [x] Ensure buttons and controls perform their stated actions; remove misleading inactive controls. *Verified all actions in FollowupsServerPage perform real operations with user feedback.*

### 3.3 Appointments and new-appointment entry points
- [x] Add consistent filters to the Appointments screen, reusing the shared filter component. *Implemented via `<FilterBar>` in `AppointmentsPage`: search by patient, appt #, dentist, service; status filter dropdown; and multi-branch filter dropdown.*
- [ ] Consolidate duplicate **New Appointment** buttons across Check-In, Appointments, and Appointment Calendar into one clear, consistent workflow, or have each entry point open the same shared form with correct context.
- [~] For staff-created appointments, prevent direct booking of service types the clinic defines as non-bookable (for example, brace-only checkups), while allowing authorized workflows if required. *Applies to online booking; staff form not checked.*
- [ ] Let staff record the actual payment method/status, clearly distinguishing payment method, collection, and payment status.
- [~] Fix conflicts where a patient has a 4:00 PM appointment but a staff-created walk-in is also assigned to 4:00 PM. Use server-side availability checks and concurrency-safe constraints. *Server is the scheduling authority; this specific case not re-tested.*
- [~] Prevent overlapping dentist appointments and other prohibited conflicts according to approved scheduling rules. Define how walk-ins are queued without falsely assigning them an occupied appointment slot.

### 3.4 Appointment Calendar
- [x] Make the calendar slightly more compact to preserve space for appointment details.
- [x] When a date is selected, open its appointments in a panel on the right on desktop so users do not need to scroll down.
- [x] On small screens, let the details panel stack or become a drawer. *Stacks below.*
- [x] Reuse shared appointment filters, status badges, and action patterns from Appointments. *Appointment Calendar includes status filter dropdown for the selected date's appointments, matching Appointments action patterns and status badges.*
- [x] Preserve authorized appointment actions and ensure calendar counts/details reflect real server data.

### 3.5 Patient Records and branch isolation
- [x] Add consistent filters to Patient Records. *Added branch filter dropdown and search filter across name, patient code, and phone to Patient Records.*
- [x] Scope staff Patient Records to the branch assigned to that staff account. *Existing server scope tests.*
- [~] If an administrator changes a staff member’s assigned branch, enforce the updated access scope server-side. *Not re-tested.*
- [x] Admin/owner access may span branches according to the approved role policy.
- [x] Never rely on a hidden frontend filter to enforce branch privacy; every relevant API query and action must enforce authorization.
- [ ] Keep patient creation in the designated Check-In flow if duplicate creation entry points are being removed.

### 3.6 Handover Management
- [ ] Audit and document the intended purpose and current implementation of Handover Management before changing it.
- [ ] Define who creates a handover, when it is required, who receives it, what information it contains, how acknowledgment works, and how unresolved items are escalated.
- [ ] Consider shift-to-shift transfer of pending patients, unfinished treatments, follow-up tasks, operational issues, and critical non-clinical notes, with role-based access.
- [ ] Show status, sender, receiver, branch, timestamp, priority, acknowledgment, and outstanding actions.
- [x] Avoid duplicating clinical notes or exposing sensitive information to unauthorized roles. *Existing: Owner sees metadata only.*
- [ ] Report which parts already work, which are partial, and which need implementation.

### 3.7 Work Schedules and exceptions
- [~] Staff should not freely edit their own assigned work schedule. Restrict schedule changes to authorized management/admin roles. *Dentist edit buttons hidden in the UI; staff and server enforcement not verified.*
- [ ] A same-day day-off request should trigger an automated coverage request to eligible staff/dentists rather than silently removing the person from the schedule.
- [ ] Notify eligible colleagues of the shift, branch, hours, required role/skills, and response deadline, without exposing unnecessary personal details.
- [ ] Track responses, prevent two people from claiming the same coverage, and notify the requester and authorized manager of the result.
- [ ] If no one accepts, escalate to the designated manager and preserve the original schedule until an authorized resolution is made.
- [ ] Improve schedule exceptions with clear types, date/time range, reason, affected branch/role, approval or automation status, audit history, and conflict detection.
- [~] Work-hour changes must update capacity and appointment availability only after validation and confirmation.

### 3.8 Leave requests and coverage automation
- [x] If **Other** is selected as the leave reason, require a specific explanation. *UI blocks submit; server rule `required_if:type,other` added (backend test not run here).*
- [ ] Redesign leave handling around business-process automation rather than routine manual approval by Dr. Dana.
- [ ] When leave needs coverage, notify eligible staff/dentists who can cover the affected shift.
- [ ] Grant/confirm leave automatically only when configured coverage and policy rules are satisfied. Do not grant leave merely because a notification was sent.
- [ ] Define rules for leave types that do not require coverage, minimum staffing, role/skill compatibility, response deadlines, overlapping leave, and urgent requests. *Needs clinic decision.*
- [ ] Prevent double-booking of coverage, track offers/acceptances/declines, and notify affected parties.
- [ ] Escalate unresolved or policy-exception cases to the designated manager; automation should not silently make unsafe staffing decisions.
- [~] Keep an audit trail of requests, matching, responses, decisions, and schedule changes. *Requests and decisions yes; no matching exists.*

### 3.9 Closed dates, billing, HMO, and social inquiries
- [ ] Improve Closed Dates management with clear branch scope, date/range, reason, recurrence if required, conflict warnings, affected appointments, and a preview before saving.
- [~] When a closed date is added/changed, identify affected appointments and use the approved rescheduling/notification workflow. Never silently delete appointments. *Existing: conflicts are listed and never cancelled.*
- [ ] Make Billing and Payments more detailed, with itemized charges, payment attempts, payment status, receipt/reference number, adjustments/refunds, reconciliation status, branch, and audit history as applicable.
- [ ] Improve HMO Management with consistent UI patterns, eligibility/coverage details, authorization/pre-approval tracking where applicable, claim status, attachments, limitations, and audit history. Confirm actual clinic workflows and providers first.
- [ ] Reduce manual work in Social Inquiry through structured intake, validation, duplicate detection, routing, status tracking, automated reminders, and clear ownership. Preserve human review for decisions requiring clinical or policy judgment.
- [ ] Fix Messages failing to load and showing: **“Messages unavailable. The clinic system is temporarily unavailable. Try again in a moment.”** Inspect API, authentication, permissions, network handling, and frontend error state; log actual errors without exposing secrets or patient information. *Not investigated yet; likely the hosted API/cookie setup.*
- [x] Add consistent filters to Archives and Records, scoped to the staff member’s authorized branch. *`ArchivesPage` now reuses `<FilterBar>` with query search, branch dropdown, and CSV export.*

---

## 4. Dentist UI

### 4.1 Clinical Home and queue
- [x] Show who is next in the queue on Clinical Home, including the next scheduled patient when appropriate, even if the appointment is later (for example, 4:00 PM).
- [~] Update queue information whenever appointments are created, checked in, prioritized, called, delayed, completed, or otherwise changed. *Refreshes with existing polling; no new real-time push.*
- [x] Clearly distinguish **next scheduled appointment** from **next patient ready in the live queue**.
- [x] Respect branch, dentist assignment, appointment status, patient privacy, and approved priority rules.
- [~] Use reliable server data or real-time updates/polling with stale-data handling; do not display invented queue positions.

### 4.2 My Schedule and My Work Hours
- [x] Improve My Schedule with consistent card dimensions, spacing, alignment, status styling, and a clear chronological view. *Card layout standardizes time range, duration badge, patient name, service, branch, booking note, and status.*
- [x] Reuse shared components for cards, filters, and status badges. *`<FilterBar>` integrated into `SchedulePage` with search and status dropdown.*
- [x] Make My Work Hours read-only for dentists. Only Dr. Dana or another explicitly authorized administrator can edit them.
- [~] Enforce this restriction on the server/API as well as in the UI. *Not verified on the server.*

### 4.3 Dental chart and treatments
- [x] Replace numbered boxes in the dental chart with recognizable tooth-shaped visuals and clear tooth identifiers.
- [x] Preserve accurate tooth numbering and accessible labels; tooth visuals must not obscure clinical state or selected surfaces.
- [ ] Improve Treatment with a structured workflow for diagnosis/indication, tooth or area, procedure, materials where relevant, status, date, responsible dentist, notes, and associated cost, according to approved clinic practice.
- [x] Preserve clinical history and audit changes; do not overwrite prior completed treatment records without a trace. *Existing.*

### 4.4 Prescriptions
- [~] Replace free-text-only medicine entry with a searchable dropdown/autocomplete based on an approved medicine catalog. *Autocomplete added, but the preset list is **not approved** by the clinic’s dentist yet.*
- [x] Include an **Other** option for authorized free-text entries when a medicine is not listed. *Free text still allowed.*
- [~] Use structured selections for dosage, frequency, duration, route, and quantity where appropriate, with an **Other** option for legitimate exceptions. *Presets fill fields; route/quantity not structured.*
- [x] Support instructions and allergy/contraindication checks only if reliable data and validated rules exist. *No checks added, on purpose.*
- [ ] Do not invent medication options, dosing recommendations, or clinical decision rules. The catalog and defaults must be reviewed by the clinic’s licensed dentist. **Open issue: the presets include dose/frequency defaults written by the dev team. They must be reviewed by Dr. Dana before the defense or removed.**
- [x] Provide validation, review before signing/issuing, a clear prescription record, and an audit trail for creation/correction/cancellation. *Existing M19.*
- [x] Ensure patients can only see prescriptions they are authorized to access.

### 4.5 Follow-up care
- [ ] Make follow-up care more detailed and actionable: reason, recommended timeframe/date, instructions, responsible dentist, status, patient communication, and related visit/treatment.
- [x] Distinguish recommended follow-up from a confirmed appointment. *Existing.*
- [~] Provide reminders and task status where supported, with retry/error handling and audit history.

### 4.6 Patient Records and branch access
- [ ] Redesign Patient Records with consistent cards/tables, spacing, search, filters, sorting, pagination, and clear record details.
- [x] Apply branch and role access consistently with approved policy. Dentists should see records necessary for authorized clinical work; do not assume branch-only access if the clinic permits cross-branch treatment.
- [ ] Keep Archives and Records filtered/scoped to authorized branches, with authorized historical retrieval.

### 4.7 Handover, leave, and messaging
- [ ] Make Handover Management understandable and consistent with the staff workflow, including pending actions and acknowledgment.
- [ ] Reuse automated leave/coverage logic used for Staff, adapted only where dentist-specific staffing rules require it.
- [~] Allow dentists to message patients through an authorized, auditable patient conversation workflow. *Messages page exists for dentists; not re-tested.*
- [~] Enforce patient relationship/branch access, protect confidential clinical information, and show clear delivery/error states.

### 4.8 Approval wording
- [x] Replace vague or confusing **Approve** labels with action-specific wording such as **Confirm coverage**, **Accept leave request**, or **Confirm appointment**, according to the actual workflow. *Staffing leave rows now use explicit 'Accept leave request' and 'Decline leave' labels.*
- [~] Use confirmation dialogs for consequential actions and explain what changes when the user proceeds.

---

## 5. Admin UI

### 5.1 Navigation and executive dashboard
- [x] Move **Clinic Operations** above **Patient Care** in navigation/section order so the executive summary appears first.
- [ ] Improve the Executive Dashboard with professional, readable charts and meaningful operational/marketing analytics.
- [ ] For advertisements/promotions, track campaign name/channel, dates, spend if recorded, inquiries, booked appointments, attended visits, and attributed conversions where reliable attribution data exists.
- [ ] Clearly label estimates and unattributed results. Do not claim a campaign caused an increase unless the tracking method supports that conclusion.
- [ ] Use consistent chart components and shared filters/date ranges where appropriate.
- [ ] Add clear labels, units, legends, tooltips, empty states, export options where supported, and accessible alternatives to charts.

### 5.2 Live Queue and Prescriptions
- [x] Make each Live Queue by Branch item openable to a detailed view with authorized patient/queue information, timestamps, statuses, priority, assigned dentist, and relevant actions. *Added `BranchQueueDetailSection` on `CapacityPage` allowing Owner to inspect real-time queue rows, priority badges, attending dentists, arrival times, and queue statuses.*
- [x] Make Prescription views similarly detailed, including prescription status, patient, dentist, date, medication details, and authorized actions/history. *`PrescriptionsServerPage` updated with search and status filters; added modal inspection for Owner with clear clinical privacy disclosure when medication lines are protected.*
- [x] Reuse consistent detail-panel/modal patterns and enforce branch/role access server-side.

### 5.3 Branches and People & Team
- [x] Redesign Branch management to show key information compactly and reduce excessive scrolling. Use summaries, tabs, collapsible details, or a branch detail panel. *Branch configuration in `Admin.jsx` refactored into a tabbed layout: Details & Contact, Opening Hours, and Services (with active service counts).*
- [ ] Review overlap between People & Team and User Management. Remove duplicate functions or define a clear distinction; do not remove functionality without mapping dependencies.
- [~] Make branch assignment explicit for staff/dentists and enforce it in API queries and mutations.

### 5.4 Appointment Calendar and work schedules
- [x] Make the Admin Appointment Calendar consistent with the Staff calendar, including sizing, filters, date selection, detail panel, status styling, and appointment actions. *Same component as Staff.*
- [~] Make Work Schedules cover both dentists and staff, allowing Dr. Dana or authorized admin users to manage both groups.
- [ ] Include branch, role, person, date range, shift, exceptions, leave, coverage, and conflict indicators where relevant.
- [~] Keep schedule changes validated and audited; update appointment capacity only after conflict checks.

### 5.5 Leave requests and handovers
- [ ] Redesign Admin leave management to support the automated coverage-first workflow described in the Staff section.
- [ ] Dr. Dana should not have to manually approve every routine leave request when configured coverage and policy rules are satisfied.
- [ ] Retain admin escalation for exceptions, no available coverage, minimum-staffing violations, or other policy-defined cases.
- [ ] Improve Handover management with clear status, branch, sender/receiver, outstanding actions, acknowledgments, and history.

### 5.6 Services, pricing, HMO, and accepted HMO
- [x] Improve Services & Pricing while retaining useful existing functionality.
- [ ] Add **illustrative/hypothetical usual prices** for services only as clearly labeled sample values pending approval by Dr. Dana. Do not present them as actual clinic prices until confirmed. *Not added; the page shows “No confirmed price” honestly.*
- [ ] Improve HMO Management and Accepted HMO with consistent shared components, provider details, eligibility/coverage information, limitations, documentation, status, claim/pre-approval workflow where applicable, and audit history.
- [x] Separate configured/accepted providers from a patient’s specific coverage or claim record. *Existing.*
- [x] Do not invent provider contracts, accepted plans, coverage limits, or reimbursement terms.

### 5.7 Analytics and Reports
- [ ] Rebuild Analytics & Reports so metrics are meaningful, consistently defined, and traceable to actual source records.
- [ ] Reuse professional chart components from the Executive Dashboard where appropriate.
- [ ] Add useful date/branch/service/provider filters, metric definitions, summary cards, charts, and detailed tables.
- [ ] Implement working PDF export with readable page breaks, report title/date range, generation timestamp, branch scope, page numbers, and approved Dr. Dana E. Roxas Dental Clinic logo/branding.
- [ ] Test PDF layout with long tables, empty data, multiple pages, and different branches.
- [ ] If PDF export is unavailable or fails, show a useful error rather than a fake download.
- [ ] Verify CSV/PDF exports against filtered records and enforce the same permissions as on-screen views.

### 5.8 Engagement
- [x] Remove module-number labels such as **M24** and **M25** from the Engagement interface.
- [~] Make Engagement professional and usable, with clear labels, practical workflows, useful status indicators, and no arbitrary module-number branding.
- [x] Do not remove underlying functionality until dependencies and purpose have been checked.

### 5.9 User Management
- [x] Redesign User Management as a clear, filterable user list.
- [x] Show newest users first by a reliable creation timestamp.
- [x] Put consistent filters/search at the top.
- [~] Provide one clear **Create User Account** button and deliberate account-type selection (for example, staff, dentist, or admin, subject to authorization).
- [ ] Remove redundant **Invite** and **Employee** flows if they duplicate the intended account-creation process; inspect dependencies before removal.
- [~] Include status, role, branch, creation date, and safe actions appropriate to the administrator’s permissions.
- [x] Enforce strong server-side role assignment and prevent privilege escalation. *Existing tests: role is never sent on update.*

### 5.10 Automations
- [ ] Assess whether the Automations tab is necessary and document its purpose, users, triggers, actions, and dependencies.
- [ ] If redundant, consolidate its functionality into relevant workflows and remove the tab only after confirming no required feature or route depends on it.
- [~] If necessary, redesign it around understandable automation rules, enable/disable status, run history, failures, and auditability. *The current page already has on/off, last run and audit link.*

### 5.11 Closed Dates
- [ ] Improve Closed Dates management using the Staff requirements: branch scope, date/range, reason, recurrence if required, conflict detection, affected appointment preview, and safe notification/rescheduling workflow.
- [x] Never silently delete or cancel affected appointments. *Existing rule and test.*

### 5.12 Audit Trail
- [~] Fix CSV and PDF export. *CSV existed; “Print / PDF” uses the browser print dialog, not a generated PDF.*
- [x] Move filters into a compact, consistent filter bar at the top, matching other modules; avoid an oversized filter panel.
- [ ] Improve PDF formatting with approved clinic branding/logo, report metadata, date range, branch scope, page numbers, and readable tables.
- [x] Preserve audit integrity: ordinary users must not edit or delete audit records. *Append-only tables.*
- [~] Apply the same access controls to exports as to the underlying audit data and log export actions where appropriate.

### 5.13 Clinic Branding and Assistant Answers
- [ ] Improve Clinic Branding with a polished, consistent configuration experience and clear preview of the patient-facing result.
- [~] Validate logo/image file types and sizes; use appropriate storage and avoid broken image states.
- [ ] Assess whether Assistant Answer is necessary and useful. Review purpose, answer sources, accuracy, safety, access controls, and maintenance cost.
- [ ] Keep it only if it solves a clear clinic need and can provide appropriately bounded, reliable answers. Otherwise propose consolidation/removal after checking dependencies.
- [x] Do not let an assistant make unsupported clinical decisions or expose private patient information. *Existing: answers need Owner approval.*

### 5.14 Archives and Records
- [x] Add consistent filters and branch scoping matching Staff and Dentist interfaces. *`ArchivesPage` now reuses `<FilterBar>` with query search, branch dropdown, and CSV export.*
- [~] Staff and dentists should see only records permitted by their role and branch access policy.
- [~] Dr. Dana, as owner/admin, should be able to retrieve archived records across branches where authorized.
- [ ] Define retrieval permissions, reason capture if required, audit logging, and the distinction between viewing, restoring, and permanently deleting records.
- [x] Do not bypass retention rules, legal holds, or audit history when retrieving/restoring records. *No hard deletes.*

---

## 6. Shared Design and Implementation Rules
- [~] Build or standardize reusable components instead of separately reimplementing each filter/dialog/table.
- [~] Keep filter placement and visual style consistent across modules; use module-specific fields only where needed.
- [~] Use clear action verbs and consistent status labels across Patient, Staff, Dentist, and Admin.
- [ ] Ensure every visible control has a working, documented behavior or is removed.
- [x] Use optimistic updates only when safe, with rollback/error handling; otherwise refresh from the server.
- [~] Use pagination or virtualized lists for large datasets; avoid loading every record into the browser.
- [x] Make branch scope explicit in queries and UI, but enforce it on the backend.
- [x] Use the clinic’s configured timezone consistently for appointments, closed dates, and reports. *Asia/Manila.*
- [x] Keep financial records and clinical records separate where required, with appropriate permissions.
- [~] Use accessible contrast, keyboard navigation, focus management, labels, and dialog semantics.
- [~] Keep components and business rules maintainable; avoid duplicating logic across roles.
- [~] Update documentation for changed workflows, API behavior, environment requirements, and known limitations.

---

## 7. Suggested Implementation Order
1. **Audit first:** map each requirement to existing screens, components, APIs, database tables, policies, and tests. Mark each as Implemented, Partial, Missing, or Needs Clinic Decision.
2. **Shared foundation:** standardize design tokens, page headers, filters, tables/cards, dialogs, buttons, status badges, and responsive behavior.
3. **Security and data integrity:** enforce branch/role access, appointment conflict prevention, queue rules, audit logging, and server-side validation.
4. **Patient booking and billing:** branch choice, unavailable slots, cancellation reasons, payment method/status, receipts, and documents purpose.
5. **Staff operations:** check-in, appointment workflow, calendar, patient records, messages, handover, schedules, leave coverage, closed dates, billing/HMO, social inquiry, archives.
6. **Dentist workflow:** live next-patient information, schedule, dental chart, treatment, prescription, follow-up care, records, messaging, handover, leave.
7. **Admin operations:** executive dashboard, queue/prescription detail, branches/team, calendars/schedules, automated leave, services/pricing, HMO, analytics/export, engagement, user management, automations, closed dates, audit trail, branding, assistant, archives.
8. **Verification:** test permissions and branch isolation for every role; appointment concurrency; queue priorities; email/receipt delivery; exports; leave coverage race conditions; closed-date conflicts; messages; mobile responsiveness; and failure states.
9. **Report honestly:** provide changed files, completed items, partial/missing items, tests actually run and results, unresolved clinic decisions, and any migrations or environment configuration required.

---

## 8. Decisions Requiring Clinic Confirmation
Do not silently invent answers. Identify these during the audit and use configurable defaults only when safe. **None of these are confirmed yet.**
- [ ] Exact legal/clinic priority policy for senior citizens, PWD patients, emergencies, and tie-breaking.
- [ ] Approved e-card/cash payment behavior and when payment is collected.
- [ ] Which services are unavailable for direct booking (including brace-only checkups). *The setting exists; the clinic still has to choose.*
- [ ] Cancellation reasons and any cancellation fee/penalty policy.
- [ ] Receipt requirements, email provider, and whether cash receipts are issued at collection.
- [ ] Patient Documents scope, retention, and patient-visible document types.
- [ ] Staff/dentist leave rules, minimum coverage, eligible substitutes, escalation, and urgent leave handling.
- [ ] Approved HMO providers, coverage rules, authorization requirements, and claims process.
- [ ] Actual service prices; sample prices must remain explicitly hypothetical until approved.
- [ ] Marketing campaign attribution method and what counts as a conversion.
- [ ] Approved clinic logo/branding asset for reports and exports.
- [ ] Assistant Answer purpose, source of truth, and permitted scope.
- [ ] Archive retention, retrieval, restoration, and legal-hold rules.
- [ ] **New:** the prescription preset medicines and their default doses (section 4.4).

---

## 9. Definition of Done
A revision is complete only when:
- [ ] The intended workflow is clear and consistent with clinic policy.
- [ ] UI changes are responsive and consistent with shared components.
- [ ] Backend authorization, validation, and data integrity are in place where required.
- [ ] Errors, empty states, and success feedback are handled.
- [ ] Relevant tests have been run and results reported honestly.
- [ ] No unauthorized cross-branch or cross-patient access is possible in tested scenarios.
- [ ] Documentation is updated and unresolved clinic decisions are clearly listed.
