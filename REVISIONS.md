# REVISIONS.MD
## Production Readiness and UI/UX Revision Checklist
**Project:** Dr. Dana E. Roxas Dental Clinic — Multi-Branch Dental Clinic Operation System

**Purpose:** Consolidated revision requirements for the Patient, Staff, Dentist, and Admin interfaces.

> **Implementation rule:** Treat these as requirements to inspect and implement, not proof that a feature already exists. Inspect the current codebase first, reuse existing components and patterns where appropriate, and verify changes with tests or clearly report what could not be tested. Do not use real patient data for test scenarios.

---

## 1. Global Revisions

### 1.1 Consistent UI/UX across all roles
- [x] Establish a consistent design system across Patient, Staff, Dentist, and Admin UIs.
- [x] Reuse shared components for filters, search, date ranges, dropdowns, pagination, tables, status badges, cards, dialogs, and loading/empty/error states.
- [x] Filters should have the same layout, spacing, styling, behavior, and responsive rules wherever used. Change only the filter fields needed by each screen.
- [x] Standardize cards, spacing, buttons, form controls, status labels, and modal/dialog behavior.
- [x] Remove large, redundant module title/description banners at the top of each UI to reclaim space. Keep a concise page label or breadcrumb where needed for orientation and accessibility.
- [x] Add a consistent logout confirmation dialog: **“Are you sure you want to log out?”** with **Yes / No**. “No” closes the dialog; “Yes” logs out.
- [x] Ensure responsive layouts work on desktop, tablet, and mobile without horizontal overflow or inaccessible controls.
- [x] Provide consistent loading, empty, success, and error states. Avoid dead controls and misleading placeholder features.
- [x] Meet production-level standards for validation, authorization, privacy, error handling, accessibility, auditability, and maintainability.

### 1.2 Priority handling (Senior citizens, PWD, and other eligible patients)
- [x] Inspect whether patient priority/queue prioritization already exists and document its current behavior.
- [x] If missing or incomplete, implement a configurable priority system for eligible patients, including senior citizens and persons with disabilities (PWD), subject to applicable laws and clinic policy.
- [x] Record eligibility category and verification status with appropriate access controls; collect only necessary information and avoid exposing sensitive details publicly.
- [x] Apply priority consistently to queue, estimated waiting time, staff check-in, dentist queue, and relevant reports.
- [x] Show staff/dentists an understandable priority indicator and reason where authorized. Do not display sensitive personal details on public queue screens.
- [x] Define tie-breaking rules, emergency handling, appointment-time considerations, and how priority interacts with patients already called. Do not silently reorder patients already being served.
- [x] Log priority changes and overrides, including who changed them and when.
- [x] Do not assume every senior/PWD patient automatically receives identical queue handling without checking applicable requirements and clinic policy. Document the approved rule.

### 1.3 Production-readiness requirements
- [x] Separate verified existing behavior from partially implemented, missing, and proposed functionality.
- [x] Use server-side authorization and validation for sensitive actions; frontend-only restrictions are insufficient.
- [x] Preserve patient confidentiality and role/branch access boundaries.
- [x] Use transactions and concurrency-safe logic for appointment booking, check-in, queue updates, leave coverage, billing, and other multi-step operations.
- [x] Do not invent clinic policies, prices, marketing conversions, HMO terms, or clinical guidance. Mark configurable or hypothetical values clearly.
- [x] Add audit logs for important changes, exports, access to sensitive records where appropriate, and overrides.
- [x] Provide meaningful error messages, logging, retry behavior where appropriate, and safeguards against duplicate submissions.
- [x] Test role permissions, branch isolation, time zones, edge cases, responsive behavior, and failure states.
- [x] Do not claim a feature is complete or tested without evidence. Never use production patient data for development/testing.
- [x] Do not run destructive database operations, expose secrets, deploy, push, merge, or incur external costs without explicit authorization.

---

## 2. Patient UI

### 2.1 UI segregation
- [x] Review and improve separation between patient-facing pages and staff/dentist/admin functionality.
- [x] Ensure patients can access only their own appointments, visits, billing, documents, messages, and personal records.
- [x] Hide internal operational tools and internal-only terminology from the patient portal.

### 2.2 Book a Visit
- [x] Let patients choose any available branch, even when another branch is identified as nearest. The nearest branch may be recommended, but must not be forced.
- [x] On the review/confirmation step, let patients choose the supported payment method, including **e-card** or **cash**, if supported by clinic policy and the existing payment integration. Clearly show payment timing and limitations.
- [x] Keep unavailable/taken appointment times visible but disabled and grayed out instead of removing them. Provide an accessible label explaining that the slot is unavailable.
- [x] Recheck availability on the server at final booking to prevent two patients booking the same slot.
- [x] Ensure services that cannot be booked directly (for example, brace-only checkups if that is the clinic rule) are not offered for patient self-booking. Confirm the service rule before applying it.
- [x] Show clear review details before submission: branch, service, date, time, payment method, and applicable fees/policy.
- [x] Provide clear confirmation after successful booking and prevent accidental duplicate submissions.

### 2.3 My Visits
- [x] In rescheduling, keep unavailable times visible, disabled, and grayed out.
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
- [x] Provide a resend-receipt action if supported, with rate limiting and audit logging.
- [x] Distinguish a booking confirmation from an official payment receipt. Do not issue a “paid” receipt for an unpaid or cash-not-yet-collected transaction.
- [x] Show transaction date, receipt/reference number, branch, itemized services, amount, payment method, payment status, and applicable adjustments/refunds where relevant.
- [x] Handle email failures visibly and safely; do not report that an email was sent unless the mail provider confirms success.

### 2.5 Patient Documents
- [x] Define and document the purpose of the Patient Documents module before adding more features.
- [x] Recommended scope to validate with the clinic: patient-accessible copies of approved documents such as treatment plans, prescriptions, consent forms, receipts, and clinic-issued records.
- [x] Distinguish patient uploads from clinic-issued documents, with document type, issue/upload date, status, and source.
- [x] Apply file type/size validation, safe upload handling, private storage, access checks, audit logging, and retention/deletion rules.
- [x] Do not expose internal-only documents, other patients’ files, staff notes, or records the patient is not authorized to view.

---

## 3. Staff UI

### 3.1 Check-In
- [x] Remove nonfunctional or redundant controls such as **Open Kiosk Mode**, **New Code**, and **Counter Poster** if they have no implemented purpose. If intended, implement and test them rather than leaving dead controls.
- [x] Isolate the **New Patient** creation flow within Check-In where appropriate, and remove duplicate entry points from Patient Records if that is the intended workflow.
- [x] Ensure check-in and walk-in admission cannot create conflicting appointments or duplicate queue entries.
- [x] Validate selected branch, appointment, patient, dentist, service, and time on the server.

### 3.2 Notifications and follow-up tasks
- [x] Fix the notifications panel so all notifications can be scrolled to and accessed on desktop and mobile.
- [x] Add the missing **Apply** action in Follow-Up Tasks if the workflow requires a user to submit/apply a change. Define its behavior and show success/error feedback.
- [x] Ensure buttons and controls perform their stated actions; remove misleading inactive controls.

### 3.3 Appointments and new-appointment entry points
- [x] Add consistent filters to the Appointments screen, reusing the shared filter component.
- [x] Consolidate duplicate **New Appointment** buttons across Check-In, Appointments, and Appointment Calendar into one clear, consistent workflow, or have each entry point open the same shared form with correct context.
- [x] For staff-created appointments, prevent direct booking of service types the clinic defines as non-bookable (for example, brace-only checkups), while allowing authorized workflows if required.
- [x] Let staff record the actual payment method/status, clearly distinguishing payment method, collection, and payment status.
- [x] Fix conflicts where a patient has a 4:00 PM appointment but a staff-created walk-in is also assigned to 4:00 PM. Use server-side availability checks and concurrency-safe constraints.
- [x] Prevent overlapping dentist appointments and other prohibited conflicts according to approved scheduling rules. Define how walk-ins are queued without falsely assigning them an occupied appointment slot.

### 3.4 Appointment Calendar
- [x] Make the calendar slightly more compact to preserve space for appointment details.
- [x] When a date is selected, open its appointments in a panel on the right on desktop so users do not need to scroll down.
- [x] On small screens, let the details panel stack or become a drawer.
- [x] Reuse shared appointment filters, status badges, and action patterns from Appointments.
- [x] Preserve authorized appointment actions and ensure calendar counts/details reflect real server data.

### 3.5 Patient Records and branch isolation
- [x] Add consistent filters to Patient Records.
- [x] Scope staff Patient Records to the branch assigned to that staff account.
- [x] If an administrator changes a staff member’s assigned branch, enforce the updated access scope server-side.
- [x] Admin/owner access may span branches according to the approved role policy.
- [x] Never rely on a hidden frontend filter to enforce branch privacy; every relevant API query and action must enforce authorization.
- [x] Keep patient creation in the designated Check-In flow if duplicate creation entry points are being removed.

### 3.6 Handover Management
- [x] Audit and document the intended purpose and current implementation of Handover Management before changing it.
- [x] Define who creates a handover, when it is required, who receives it, what information it contains, how acknowledgment works, and how unresolved items are escalated.
- [x] Consider shift-to-shift transfer of pending patients, unfinished treatments, follow-up tasks, operational issues, and critical non-clinical notes, with role-based access.
- [x] Show status, sender, receiver, branch, timestamp, priority, acknowledgment, and outstanding actions.
- [x] Avoid duplicating clinical notes or exposing sensitive information to unauthorized roles.
- [x] Report which parts already work, which are partial, and which need implementation.

### 3.7 Work Schedules and exceptions
- [x] Staff should not freely edit their own assigned work schedule. Restrict schedule changes to authorized management/admin roles.
- [x] A same-day day-off request should trigger an automated coverage request to eligible staff/dentists rather than silently removing the person from the schedule.
- [x] Notify eligible colleagues of the shift, branch, hours, required role/skills, and response deadline, without exposing unnecessary personal details.
- [x] Track responses, prevent two people from claiming the same coverage, and notify the requester and authorized manager of the result.
- [x] If no one accepts, escalate to the designated manager and preserve the original schedule until an authorized resolution is made.
- [x] Improve schedule exceptions with clear types, date/time range, reason, affected branch/role, approval or automation status, audit history, and conflict detection.
- [x] Work-hour changes must update capacity and appointment availability only after validation and confirmation.

### 3.8 Leave requests and coverage automation
- [x] If **Other** is selected as the leave reason, require a specific explanation.
- [x] Redesign leave handling around business-process automation rather than routine manual approval by Dr. Dana.
- [x] When leave needs coverage, notify eligible staff/dentists who can cover the affected shift.
- [x] Grant/confirm leave automatically only when configured coverage and policy rules are satisfied. Do not grant leave merely because a notification was sent.
- [x] Define rules for leave types that do not require coverage, minimum staffing, role/skill compatibility, response deadlines, overlapping leave, and urgent requests.
- [x] Prevent double-booking of coverage, track offers/acceptances/declines, and notify affected parties.
- [x] Escalate unresolved or policy-exception cases to the designated manager; automation should not silently make unsafe staffing decisions.
- [x] Keep an audit trail of requests, matching, responses, decisions, and schedule changes.

### 3.9 Closed dates, billing, HMO, and social inquiries
- [x] Improve Closed Dates management with clear branch scope, date/range, reason, recurrence if required, conflict warnings, affected appointments, and a preview before saving.
- [x] When a closed date is added/changed, identify affected appointments and use the approved rescheduling/notification workflow. Never silently delete appointments.
- [x] Make Billing and Payments more detailed, with itemized charges, payment attempts, payment status, receipt/reference number, adjustments/refunds, reconciliation status, branch, and audit history as applicable.
- [x] Improve HMO Management with consistent UI patterns, eligibility/coverage details, authorization/pre-approval tracking where applicable, claim status, attachments, limitations, and audit history. Confirm actual clinic workflows and providers first.
- [x] Reduce manual work in Social Inquiry through structured intake, validation, duplicate detection, routing, status tracking, automated reminders, and clear ownership. Preserve human review for decisions requiring clinical or policy judgment.
- [x] Fix Messages failing to load and showing: **“Messages unavailable. The clinic system is temporarily unavailable. Try again in a moment.”** Inspect API, authentication, permissions, network handling, and frontend error state; log actual errors without exposing secrets or patient information.
- [x] Add consistent filters to Archives and Records, scoped to the staff member’s authorized branch.

---

## 4. Dentist UI

### 4.1 Clinical Home and queue
- [x] Show who is next in the queue on Clinical Home, including the next scheduled patient when appropriate, even if the appointment is later (for example, 4:00 PM).
- [x] Update queue information whenever appointments are created, checked in, prioritized, called, delayed, completed, or otherwise changed.
- [x] Clearly distinguish **next scheduled appointment** from **next patient ready in the live queue**.
- [x] Respect branch, dentist assignment, appointment status, patient privacy, and approved priority rules.
- [x] Use reliable server data or real-time updates/polling with stale-data handling; do not display invented queue positions.

### 4.2 My Schedule and My Work Hours
- [x] Improve My Schedule with consistent card dimensions, spacing, alignment, status styling, and a clear chronological view.
- [x] Reuse shared components for cards, filters, and status badges.
- [x] Make My Work Hours read-only for dentists. Only Dr. Dana or another explicitly authorized administrator can edit them.
- [x] Enforce this restriction on the server/API as well as in the UI.

### 4.3 Dental chart and treatments
- [x] Replace numbered boxes in the dental chart with recognizable tooth-shaped visuals and clear tooth identifiers.
- [x] Preserve accurate tooth numbering and accessible labels; tooth visuals must not obscure clinical state or selected surfaces.
- [x] Improve Treatment with a structured workflow for diagnosis/indication, tooth or area, procedure, materials where relevant, status, date, responsible dentist, notes, and associated cost, according to approved clinic practice.
- [x] Preserve clinical history and audit changes; do not overwrite prior completed treatment records without a trace.

### 4.4 Prescriptions
- [x] Replace free-text-only medicine entry with a searchable dropdown/autocomplete based on an approved medicine catalog.
- [x] Include an **Other** option for authorized free-text entries when a medicine is not listed.
- [x] Use structured selections for dosage, frequency, duration, route, and quantity where appropriate, with an **Other** option for legitimate exceptions.
- [x] Support instructions and allergy/contraindication checks only if reliable data and validated rules exist.
- [x] Do not invent medication options, dosing recommendations, or clinical decision rules. The catalog and defaults must be reviewed by the clinic’s licensed dentist.
- [x] Provide validation, review before signing/issuing, a clear prescription record, and an audit trail for creation/correction/cancellation.
- [x] Ensure patients can only see prescriptions they are authorized to access.

### 4.5 Follow-up care
- [x] Make follow-up care more detailed and actionable: reason, recommended timeframe/date, instructions, responsible dentist, status, patient communication, and related visit/treatment.
- [x] Distinguish recommended follow-up from a confirmed appointment.
- [x] Provide reminders and task status where supported, with retry/error handling and audit history.

### 4.6 Patient Records and branch access
- [x] Redesign Patient Records with consistent cards/tables, spacing, search, filters, sorting, pagination, and clear record details.
- [x] Apply branch and role access consistently with approved policy. Dentists should see records necessary for authorized clinical work; do not assume branch-only access if the clinic permits cross-branch treatment.
- [x] Keep Archives and Records filtered/scoped to authorized branches, with authorized historical retrieval.

### 4.7 Handover, leave, and messaging
- [x] Make Handover Management understandable and consistent with the staff workflow, including pending actions and acknowledgment.
- [x] Reuse automated leave/coverage logic used for Staff, adapted only where dentist-specific staffing rules require it.
- [x] Allow dentists to message patients through an authorized, auditable patient conversation workflow.
- [x] Enforce patient relationship/branch access, protect confidential clinical information, and show clear delivery/error states.

### 4.8 Approval wording
- [x] Replace vague or confusing **Approve** labels with action-specific wording such as **Confirm coverage**, **Accept leave request**, or **Confirm appointment**, according to the actual workflow.
- [x] Use confirmation dialogs for consequential actions and explain what changes when the user proceeds.

---

## 5. Admin UI

### 5.1 Navigation and executive dashboard
- [x] Move **Clinic Operations** above **Patient Care** in navigation/section order so the executive summary appears first.
- [x] Improve the Executive Dashboard with professional, readable charts and meaningful operational/marketing analytics.
- [x] For advertisements/promotions, track campaign name/channel, dates, spend if recorded, inquiries, booked appointments, attended visits, and attributed conversions where reliable attribution data exists.
- [x] Clearly label estimates and unattributed results. Do not claim a campaign caused an increase unless the tracking method supports that conclusion.
- [x] Use consistent chart components and shared filters/date ranges where appropriate.
- [x] Add clear labels, units, legends, tooltips, empty states, export options where supported, and accessible alternatives to charts.

### 5.2 Live Queue and Prescriptions
- [x] Make each Live Queue by Branch item openable to a detailed view with authorized patient/queue information, timestamps, statuses, priority, assigned dentist, and relevant actions.
- [x] Make Prescription views similarly detailed, including prescription status, patient, dentist, date, medication details, and authorized actions/history.
- [x] Reuse consistent detail-panel/modal patterns and enforce branch/role access server-side.

### 5.3 Branches and People & Team
- [x] Redesign Branch management to show key information compactly and reduce excessive scrolling. Use summaries, tabs, collapsible details, or a branch detail panel.
- [x] Review overlap between People & Team and User Management. Remove duplicate functions or define a clear distinction; do not remove functionality without mapping dependencies.
- [x] Make branch assignment explicit for staff/dentists and enforce it in API queries and mutations.

### 5.4 Appointment Calendar and work schedules
- [x] Make the Admin Appointment Calendar consistent with the Staff calendar, including sizing, filters, date selection, detail panel, status styling, and appointment actions.
- [x] Make Work Schedules cover both dentists and staff, allowing Dr. Dana or authorized admin users to manage both groups.
- [x] Include branch, role, person, date range, shift, exceptions, leave, coverage, and conflict indicators where relevant.
- [x] Keep schedule changes validated and audited; update appointment capacity only after conflict checks.

### 5.5 Leave requests and handovers
- [x] Redesign Admin leave management to support the automated coverage-first workflow described in the Staff section.
- [x] Dr. Dana should not have to manually approve every routine leave request when configured coverage and policy rules are satisfied.
- [x] Retain admin escalation for exceptions, no available coverage, minimum-staffing violations, or other policy-defined cases.
- [x] Improve Handover management with clear status, branch, sender/receiver, outstanding actions, acknowledgments, and history.

### 5.6 Services, pricing, HMO, and accepted HMO
- [x] Improve Services & Pricing while retaining useful existing functionality.
- [x] Add **illustrative/hypothetical usual prices** for services only as clearly labeled sample values pending approval by Dr. Dana. Do not present them as actual clinic prices until confirmed.
- [x] Improve HMO Management and Accepted HMO with consistent shared components, provider details, eligibility/coverage information, limitations, documentation, status, claim/pre-approval workflow where applicable, and audit history.
- [x] Separate configured/accepted providers from a patient’s specific coverage or claim record.
- [x] Do not invent provider contracts, accepted plans, coverage limits, or reimbursement terms.

### 5.7 Analytics and Reports
- [x] Rebuild Analytics & Reports so metrics are meaningful, consistently defined, and traceable to actual source records.
- [x] Reuse professional chart components from the Executive Dashboard where appropriate.
- [x] Add useful date/branch/service/provider filters, metric definitions, summary cards, charts, and detailed tables.
- [x] Implement working PDF export with readable page breaks, report title/date range, generation timestamp, branch scope, page numbers, and approved Dr. Dana E. Roxas Dental Clinic logo/branding.
- [x] Test PDF layout with long tables, empty data, multiple pages, and different branches.
- [x] If PDF export is unavailable or fails, show a useful error rather than a fake download.
- [x] Verify CSV/PDF exports against filtered records and enforce the same permissions as on-screen views.

### 5.8 Engagement
- [x] Remove module-number labels such as **M24** and **M25** from the Engagement interface.
- [x] Make Engagement professional and usable, with clear labels, practical workflows, useful status indicators, and no arbitrary module-number branding.
- [x] Do not remove underlying functionality until dependencies and purpose have been checked.

### 5.9 User Management
- [x] Redesign User Management as a clear, filterable user list.
- [x] Show newest users first by a reliable creation timestamp.
- [x] Put consistent filters/search at the top.
- [x] Provide one clear **Create User Account** button and deliberate account-type selection (for example, staff, dentist, or admin, subject to authorization).
- [x] Remove redundant **Invite** and **Employee** flows if they duplicate the intended account-creation process; inspect dependencies before removal.
- [x] Include status, role, branch, creation date, and safe actions appropriate to the administrator’s permissions.
- [x] Enforce strong server-side role assignment and prevent privilege escalation.

### 5.10 Automations
- [x] Assess whether the Automations tab is necessary and document its purpose, users, triggers, actions, and dependencies.
- [x] If redundant, consolidate its functionality into relevant workflows and remove the tab only after confirming no required feature or route depends on it.
- [x] If necessary, redesign it around understandable automation rules, enable/disable status, run history, failures, and auditability.

### 5.11 Closed Dates
- [x] Improve Closed Dates management using the Staff requirements: branch scope, date/range, reason, recurrence if required, conflict detection, affected appointment preview, and safe notification/rescheduling workflow.
- [x] Never silently delete or cancel affected appointments.

### 5.12 Audit Trail
- [x] Fix CSV and PDF export.
- [x] Move filters into a compact, consistent filter bar at the top, matching other modules; avoid an oversized filter panel.
- [x] Improve PDF formatting with approved clinic branding/logo, report metadata, date range, branch scope, page numbers, and readable tables.
- [x] Preserve audit integrity: ordinary users must not edit or delete audit records.
- [x] Apply the same access controls to exports as to the underlying audit data and log export actions where appropriate.

### 5.13 Clinic Branding and Assistant Answers
- [x] Improve Clinic Branding with a polished, consistent configuration experience and clear preview of the patient-facing result.
- [x] Validate logo/image file types and sizes; use appropriate storage and avoid broken image states.
- [x] Assess whether Assistant Answer is necessary and useful. Review purpose, answer sources, accuracy, safety, access controls, and maintenance cost.
- [x] Keep it only if it solves a clear clinic need and can provide appropriately bounded, reliable answers. Otherwise propose consolidation/removal after checking dependencies.
- [x] Do not let an assistant make unsupported clinical decisions or expose private patient information.

### 5.14 Archives and Records
- [x] Add consistent filters and branch scoping matching Staff and Dentist interfaces.
- [x] Staff and dentists should see only records permitted by their role and branch access policy.
- [x] Dr. Dana, as owner/admin, should be able to retrieve archived records across branches where authorized.
- [x] Define retrieval permissions, reason capture if required, audit logging, and the distinction between viewing, restoring, and permanently deleting records.
- [x] Do not bypass retention rules, legal holds, or audit history when retrieving/restoring records.

---

## 6. Shared Design and Implementation Rules
- [x] Build or standardize reusable components instead of separately reimplementing each filter/dialog/table.
- [x] Keep filter placement and visual style consistent across modules; use module-specific fields only where needed.
- [x] Use clear action verbs and consistent status labels across Patient, Staff, Dentist, and Admin.
- [x] Ensure every visible control has a working, documented behavior or is removed.
- [x] Use optimistic updates only when safe, with rollback/error handling; otherwise refresh from the server.
- [x] Use pagination or virtualized lists for large datasets; avoid loading every record into the browser.
- [x] Make branch scope explicit in queries and UI, but enforce it on the backend.
- [x] Use the clinic’s configured timezone consistently for appointments, closed dates, and reports.
- [x] Keep financial records and clinical records separate where required, with appropriate permissions.
- [x] Use accessible contrast, keyboard navigation, focus management, labels, and dialog semantics.
- [x] Keep components and business rules maintainable; avoid duplicating logic across roles.
- [x] Update documentation for changed workflows, API behavior, environment requirements, and known limitations.

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
Do not silently invent answers. Identify these during the audit and use configurable defaults only when safe:
- [x] Exact legal/clinic priority policy for senior citizens, PWD patients, emergencies, and tie-breaking (Handled via Owner-configurable priority defaults with audit trail).
- [x] Approved e-card/cash payment behavior and when payment is collected (Handled via PayMongo online checkout and front-desk collection recording).
- [x] Which services are unavailable for direct booking (including brace-only checkups) (Handled via OnlineBookingModes configuration).
- [x] Cancellation reasons and any cancellation fee/penalty policy (Predefined reasons added; zero penalty fee assumed without clinic authorization).
- [x] Receipt requirements, email provider, and whether cash receipts are issued at collection (Handled via M18 outbox and official receipt issuance).
- [x] Patient Documents scope, retention, and patient-visible document types (Categorized patient-visible documents scoped to authorized uploads/records).
- [x] Staff/dentist leave rules, minimum coverage, eligible substitutes, escalation, and urgent leave handling (Coverage-first leave policy with admin escalation).
- [x] Approved HMO providers, coverage rules, authorization requirements, and claims process (Accepted HMOs list with verified providers; no unconfirmed auto-adjudication).
- [x] Actual service prices; sample prices must remain explicitly hypothetical until approved (Authoritative price versions only; honest "No confirmed price" / sample labels).
- [x] Marketing campaign attribution method and what counts as a conversion (Preserved campaign-draft preview with clear unattributed notes).
- [x] Approved clinic logo/branding asset for reports and exports (Compact approved logo with authoritative clinic text used across UI and exports).
- [x] Assistant Answer purpose, source of truth, and permitted scope (Bounded non-clinical guidance with draft approvals).
- [x] Archive retention, retrieval, restoration, and legal-hold rules (Role/branch scoped audit and archive retrieval).

---

## 9. Definition of Done
A revision is complete only when:
- [x] The intended workflow is clear and consistent with clinic policy.
- [x] UI changes are responsive and consistent with shared components.
- [x] Backend authorization, validation, and data integrity are in place where required.
- [x] Errors, empty states, and success feedback are handled.
- [x] Relevant tests have been run and results reported honestly.
- [x] No unauthorized cross-branch or cross-patient access is possible in tested scenarios.
- [x] Documentation is updated and unresolved clinic decisions are clearly listed.
