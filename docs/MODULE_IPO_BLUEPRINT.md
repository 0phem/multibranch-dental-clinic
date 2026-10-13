# Dental Clinic Module IPO Blueprint

Updated October 12, 2026. Version 5.0. Finalized planning scope.

The agreed planning catalog contains 25 numbered modules, with five primary assignments per member. Scope and assignments are finalized for documentation. Implementation evidence and clinic-specific policy remain separate; this revision does not certify a working production system.

Roles are exactly Patient, Staff, Dentist and Owner. The stack remains React/Vite, Laravel 13, PostgreSQL and Sanctum. New development excludes HMO, inventory, a generic workflow-automation engine, rewards and marketing campaigns. PayMongo belongs to M23 Payment Management; email delivery to M18; informational AI to M7.

## Final catalog

| Module | Primary owner | Owned responsibility |
| --- | --- | --- |
| M1 User Management | Licanda, Celin | Person, employee profile, User, invitation and access history |
| M2 Branch Management | Licanda, Celin | Branch profile and operating calendar |
| M3 Work Schedules | Licanda, Celin | Dated Staff/Dentist roster, branch assignment, availability exception and schedule revision |
| M4 Patient Records | Ecal, Richmon | Person/Patient identity, health history and correction history |
| M5 Treatment Management | Ecal, Richmon | Visit-linked Treatment and immutable completed revisions |
| M6 Appointment Management | Alejo, Hart Jaztin A. | Appointment, revision and attendance-response history |
| M7 AI Chatbot | Delos Santos, Joevan | Approved knowledge version and scoped assistance request |
| M8 Patient Visits | Alejo, Hart Jaztin A. | Arrival evidence, authoritative Visit, assignment and encounter-state history |
| M9 Patient Queue | Alejo, Hart Jaztin A. | QueueEntry, numbering and transition history |
| M10 Dental Charts | Ecal, Richmon | Patient tooth/surface finding and chart revision |
| M11 Billing Management | Delos Santos, Joevan | Invoice, immutable charge evidence, balance and authorized correction history |
| M12 Treatment Plans | Alejo, Hart Jaztin A. | Versioned proposed plan, phases, estimates and Patient decision |
| M13 Services and Pricing | Licanda, Celin | Service/procedure definition, branch offering and effective price version |
| M14 Document Management | Millar, John Yzhekiel | Private original file, metadata and extraction draft |
| M15 Leave Management | Licanda, Celin | LeaveRequest, shift-specific CoverageOffer, explicit acceptance and decision history |
| M16 Patient Inquiries | Millar, John Yzhekiel | Attributed external inquiry, assignment and outcome history |
| M17 Patient Messaging | Millar, John Yzhekiel | Participant-scoped conversation, immutable messages and read state |
| M18 Notifications | Millar, John Yzhekiel | Notification intent, dispatch job, attempt and delivery evidence |
| M19 Prescriptions | Ecal, Richmon | Dentist draft and immutable authorized prescription version |
| M20 Patient Follow-Up | Alejo, Hart Jaztin A. | Dentist-originated follow-up obligation and outcome history |
| M21 Reports and Analytics | Delos Santos, Joevan | Authorized report definition and source-traceable result/export |
| M22 Audit Logs | Delos Santos, Joevan | Append-only audit event and scoped investigation/export |
| M23 Payment Management | Delos Santos, Joevan | CheckoutAttempt, verified Payment, receipt and reconciliation exception |
| M24 Lab Cases | Millar, John Yzhekiel | Patient-linked LabCase, dispatch/return events and Dentist review history |
| M25 Patient Handovers | Ecal, Richmon | PatientHandover, purpose-scoped care packet, acknowledgment and outcome history |

## M1 User Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Licanda, Celin.

Owned records: Person, employee profile, User, invitation and access history.

Authority: Owner approves employee provisioning; Patient registration and existing account permissions remain governed by current contracts.

Requirement basis: Original Q3/Q4/Q27; follow-up PI-01 Owner approval and PI-02 email invitation. Personnel consolidation is the agreed project scope.

### Inputs

- Identity and contact details
- Requested account role, employee duties and branch eligibility
- Owner approval for an employee
- Invitation, activation or account-access request

### Process

1. Resolve identity and check duplicate account constraints.
2. Validate Owner approval for employee provisioning.
3. Link the Person, employee profile and approved access scope.
4. Issue the configured invitation and verification challenge.
5. Validate activation or authentication proof.
6. Create or revoke authorized sessions.
7. Apply permitted profile, credential and account changes.
8. Preserve account, profile and access history.

### Outputs

- Authorized account and linked personnel profile
- Invitation, verification and access status
- Profile and access-change history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Invitation outcomes: Count issued, activated, expired and failed invitations separately.
- Account integrity: Track duplicate identity refusals and unauthorized access changes.
- Activation time: Measure invitation-to-activation elapsed time from recorded events.

Boundary: M1 owns account and personnel reference data, authentication and security. M3 owns dated work schedules; M15 owns leave decisions. Titles and branch employment never grant permissions automatically.

Dependencies: M18 Notifications; M22 Audit Logs.

Implementation evidence: Reported backend account/security foundation. Complete employee invitation and activation remain unfinished.

Policy and configuration still required: Confirm invitation expiry, identity activation/recovery, credential verification and role-change authority. Preserve Patient-only self-registration; no fifth role.

### Acceptance scenarios

- An employee cannot activate a privileged account without Owner approval; another branch cannot gain access through a profile change..
- Reject unauthorized access and preserve attributed history..

## M2 Branch Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Licanda, Celin.

Owned records: Branch profile and operating calendar.

Authority: Owner manages branch information and closures.

Requirement basis: Original Q2/Q18; PI-14 same hours across branches and PI-15 Owner-controlled closures.

### Inputs

- Branch identity and contact information
- Approved operating days and hours
- Owner closure decision
- Existing bookings affected by a change

### Process

1. Identify the branch and validate Owner authority.
2. Validate contact and operating information.
3. Record approved normal hours.
4. Record dated closures or exceptions.
5. Find existing bookings affected by a change.
6. Require the approved handling decision.
7. Publish the effective operating calendar.
8. Retain change history and notify affected workflows.

### Outputs

- Current branch profile
- Effective branch availability
- Affected-booking worklist and change history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Booking impact: Count bookings affected by closures and unresolved handling decisions.
- Calendar validity: Track rejected invalid hours and conflicting branch exceptions.
- Change history: Measure attributed publication and effective-date completeness.

Boundary: M2 owns branch identity, normal hours and dated closures. M3 owns employee availability; M6 owns changes to bookings. A closure identifies affected bookings without silently cancelling them.

Dependencies: M1 User Management; M6 Appointment Management; M18 Notifications; M22 Audit Logs.

Implementation evidence: Reported branch backend foundation. Complete hours/closure workflow is not established.

Policy and configuration still required: Exact hours and existing-booking consequences remain open. Do not fabricate coordinates or automatic cancellations.

### Acceptance scenarios

- A closure identifies affected appointments and does not silently cancel them..
- Reject unauthorized access and preserve attributed history..

## M3 Work Schedules

Updated: October 12, 2026. Version: 5.0. Primary owner: Licanda, Celin.

Owned records: Dated Staff/Dentist roster, branch assignment, availability exception and schedule revision.

Authority: Owner controls published schedules under approved clinic rules; accepted M15 decisions propose changes through the schedule service.

Requirement basis: PI-05 variable branch assignments, PI-06 Owner-decided Dentist schedules, PI-08 no fixed Dentist minimum; Staff coverage is the user-approved October 12 scope.

### Inputs

- Eligible employee profiles and verified duties from M1
- Branch operating calendar from M2
- Owner-defined dated shifts and availability
- Existing appointments and accepted coverage decisions

### Process

1. Resolve employee eligibility and schedule publication authority.
2. Create the dated branch and duty assignment.
3. Validate branch hours and cross-branch shift overlap.
4. Record approved availability exceptions.
5. Identify affected appointments and coverage requirements.
6. Apply the approved booking-impact handling decision.
7. Publish the effective roster revision.
8. Preserve schedule history and request approved notifications.

### Outputs

- Published Staff and Dentist roster
- Bookable Dentist availability and duty coverage
- Affected-booking worklist and schedule history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Roster conflicts: Count overlapping branch or duty assignments rejected.
- Coverage visibility: Count recorded uncovered duties without inventing staffing thresholds.
- Publication history: Track effective roster revisions and affected-booking handling.

Boundary: M3 owns the effective roster for both Staff and Dentists. M15 owns requests and coverage consent; M6 owns bookings. An assigned shift does not confer clinical or financial access.

Dependencies: M1 User Management; M2 Branch Management; M6 Appointment Management; M15 Leave Management; M18 Notifications; M22 Audit Logs.

Implementation evidence: Reported personnel/availability foundation exists under historical M3. Complete dated Staff/Dentist roster and automated leave integration require implementation.

Policy and configuration still required: Confirm actual shifts, Staff scheduling authority, duty/service eligibility, work-hour constraints and booking-impact rules. No fixed minimum Dentist count is approved.

### Acceptance scenarios

- Concurrent schedule changes cannot publish overlapping branch shifts or silently move a booked patient..
- Changing a Staff title does not grant billing or reception permissions..
- Reject unauthorized access and preserve attributed history..

## M4 Patient Records

Updated: October 12, 2026. Version: 5.0. Primary owner: Ecal, Richmon.

Owned records: Person/Patient identity, health history and correction history.

Authority: Patient and Staff maintain permitted identity fields; Dentist owns clinical review.

Requirement basis: Original Q16/Q17/Q18/Q24; user requirement for archive/restore and preserved name history.

### Inputs

- Patient identity and contact details
- Reported medical history and allergies
- Authorized correction request
- Linked Visit, document and clinical references

### Process

1. Find or register the exact Patient identity.
2. Check duplicate identity signals without automatic merging.
3. Validate permitted demographic changes.
4. Record health-history provenance.
5. Route clinical review to the Dentist.
6. Link clinical and operational records by stable reference.
7. Apply authorized corrections while preserving history.
8. Present the permitted longitudinal record.

### Outputs

- Current Patient profile
- Attributed medical-history record
- Scoped Patient timeline and correction history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Correction history: Track permitted corrections with preserved earlier values.
- Identity exceptions: Count unresolved duplicate signals without automatic merging.
- Record access: Measure authorized retrieval and refused cross-patient access.

Boundary: M4 owns Patient identity, permitted general history and corrections. M10 owns dental findings; M5 performed care; M12 proposed care; M14 files. Archive/restore is entity-specific and name history remains append-oriented.

Dependencies: M1 User Management; M14 Document Management; M22 Audit Logs.

Implementation evidence: Reported identity/profile foundation. Full history, merge and restoration workflows remain incomplete.

Policy and configuration still required: Duplicate merge, corrections, cross-branch access and retention remain entity-specific policy decisions.

### Acceptance scenarios

- A current name correction does not rewrite the name snapshot on an earlier financial record..
- Reject unauthorized access and preserve attributed history..

## M5 Treatment Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Ecal, Richmon.

Owned records: Visit-linked Treatment and immutable completed revisions.

Authority: Responsible Dentist authors and completes treatment.

Requirement basis: Original Q15/Q27/Q29. Existing responsible-Dentist and completion contracts remain authoritative.

### Inputs

- Authoritative Visit and assigned Dentist
- Permitted Patient history and dental chart
- Dentist assessment and performed procedures
- Approved treatment-plan reference when applicable

### Process

1. Resolve the Visit and responsible Dentist.
2. Validate clinical access and current treatment state.
3. Review permitted history and findings.
4. Record assessment and procedures actually performed.
5. Save attributed documentation revisions.
6. Validate completion requirements.
7. Complete Treatment and linked Visit/appointment atomically.
8. Expose safe downstream billing, prescription and follow-up context.

### Outputs

- Completed or active Treatment record
- Performed-procedure evidence
- Authoritative completion and downstream references

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Care evidence: Track documented performed procedures against completed Treatment.
- Completion integrity: Count refused invalid or stale completion attempts.
- Clinical history: Measure responsible-Dentist attribution and protected revisions.

Boundary: M5 owns actual care and authoritative Treatment completion. M12 proposed work is not completed care; M11 charges only authoritative billable evidence. M24 lab acceptance and M25 handover do not independently complete Treatment.

Dependencies: M4 Patient Records; M8 Patient Visits; M10 Dental Charts; M12 Treatment Plans; M24 Lab Cases; M25 Patient Handovers.

Implementation evidence: Reported server-authoritative Treatment foundation with responsible-Dentist authorization and immutable completion.

Policy and configuration still required: Clinical amendments and aborted-treatment handling require approved contracts; a calendar Done action cannot complete care.

### Acceptance scenarios

- A proposed procedure does not become a billable completed procedure until the Dentist records actual treatment..
- Reject unauthorized access and preserve attributed history..

## M6 Appointment Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Alejo, Hart Jaztin A..

Owned records: Appointment, revision and attendance-response history.

Authority: Existing Patient, Staff and Owner booking permissions remain authoritative.

Requirement basis: Original Q20/Q28/Q32; PI-29 booking/change updates; user day/week/month calendar and attendance-response requirements.

### Inputs

- Authorized Patient and requested service
- Branch calendar and employee availability from M2/M3
- Requested time and current appointment revisions
- Attendance response or approved schedule/handover change

### Process

1. Resolve the actor, Patient and booking intent.
2. Find eligible branch and Dentist availability.
3. Validate time rules and all overlap constraints.
4. Create the booking or authorized revision atomically.
5. Project appointments into day/week/month views.
6. Record an attributed attendance response against the current revision.
7. Route change requests through existing booking commands.
8. Record outcomes and request approved notifications.

### Outputs

- Authoritative appointment and calendar view
- Conflict or valid-slot result
- Attendance-response and booking history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Booking conflicts: Count conflict refusals and successful authorized revisions.
- Response visibility: Track current and stale attendance responses separately.
- Calendar completeness: Compare displayed bookings with the full authorized source window.

Boundary: M6 owns booking, calendar and attendance responses. M8 owns arrival; M5/M8 supply authoritative completion; M18 delivery. Leave, lab or handover events identify work for permitted booking commands rather than silently changing appointments.

Dependencies: M1 User Management; M2 Branch Management; M3 Work Schedules; M13 Services and Pricing; M18 Notifications.

Implementation evidence: Reported booking/conflict foundation. Calendar integration and attendance-response workflow require a scoped return pass.

Policy and configuration still required: Response options/deadlines, stale responses, no-show rules and cancellation consequences remain open.

### Acceptance scenarios

- A cannot-attend response is visible to Staff without automatically cancelling the booking or creating arrival..
- Reject unauthorized access and preserve attributed history..

## M7 AI Chatbot

Updated: October 12, 2026. Version: 5.0. Primary owner: Delos Santos, Joevan.

Owned records: Approved knowledge version and scoped assistance request.

Authority: Authenticated Patient only; knowledge publication authority must be approved.

Requirement basis: User-requested informational AI integration; reported existing constrained server adapter. Knowledge/privacy configuration remains a project decision.

### Inputs

- Authenticated Patient question
- Approved clinic knowledge
- Permitted Patient-safe context
- Configured provider and privacy choices

### Process

1. Authenticate and resolve the Patient context.
2. Check clinic scope and sensitive-information boundaries.
3. Retrieve approved knowledge and permitted context.
4. Call the existing server adapter when configured.
5. Check the response against supported knowledge and allowed actions.
6. Return guidance with navigation or an honest fallback.
7. Offer an authorized human-contact path.
8. Record minimal operational evidence without unnecessary clinical content.

### Outputs

- Grounded informational answer or refusal
- Relevant navigation/contact guidance
- Minimal service and knowledge-version evidence

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Supported answers: Track supported knowledge responses and honest fallbacks.
- Knowledge provenance: Measure recorded knowledge/provider version completeness.
- Service performance: Measure response latency and provider failures without fake quality scores.

Boundary: M7 is an informational Patient-only service with approved knowledge, privacy checks and fallback. Human conversations belong to M17. AI cannot diagnose, prescribe, approve leave, book or settle payments.

Dependencies: M1 User Management; M2 Branch Management; M13 Services and Pricing.

Implementation evidence: Reported constrained Patient-only server adapter and curated knowledge foundation; live provider use is unverified.

Policy and configuration still required: Live provider, privacy notice, knowledge publication and provider-data handling need confirmation.

### Acceptance scenarios

- An unsupported price or medical request produces a safe fallback rather than invented advice..
- Reject unauthorized access and preserve attributed history..

## M8 Patient Visits

Updated: October 12, 2026. Version: 5.0. Primary owner: Alejo, Hart Jaztin A..

Owned records: Arrival evidence, authoritative Visit, assignment and encounter-state history.

Authority: Branch-authorized Staff admit Patients and assign within approved permissions.

Requirement basis: Original Q15/Q27; PI-13 available Dentist assignment and PI-21 case-by-case lateness. Visit expansion is the agreed module boundary.

### Inputs

- Exact Patient identity
- Scheduled appointment or walk-in request
- Actual arrival time and branch
- Available eligible Dentist or unassigned Visit

### Process

1. Identify the exact Patient and branch.
2. Validate a scheduled appointment or walk-in context.
3. Record actual physical arrival.
4. Check active-Visit and admission constraints.
5. Create the authoritative Visit.
6. Assign an eligible Dentist through permitted commands or retain an unassigned Visit.
7. Hand off the assigned Visit to M9 and track authorized encounter outcomes.
8. Present scoped Visit status and preserve attributed history.

### Outputs

- Authoritative assigned or unassigned Visit
- Queue and treatment handoff references
- Arrival, assignment and encounter history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Unassigned Visits: Count actual arrivals awaiting permitted Dentist assignment.
- Admission integrity: Track duplicate active-Visit refusals and admission exceptions.
- Assignment time: Measure arrival-to-assignment time from authoritative timestamps.

Boundary: M8 owns admission and the Visit bridge, including scheduled and walk-in context. M9 waiting order and M5 clinical completion remain distinct. An attendance response is not arrival; Patient-only feedback may remain a supporting feature without new reviewer access.

Dependencies: M4 Patient Records; M6 Appointment Management; M3 Work Schedules; M9 Patient Queue; M5 Treatment Management.

Implementation evidence: Reported scheduled/walk-in Visit foundation. Assignment completeness and live integration require verification.

Policy and configuration still required: Confirm late-arrival, reassignment, departure, aborted/end-of-day handling and Patient-visible history. Preserve current responsible-Dentist completion and private feedback restrictions.

### Acceptance scenarios

- An unassigned arriving Patient has a Visit but no fabricated Dentist queue entry..
- Reject unauthorized access and preserve attributed history..

## M9 Patient Queue

Updated: October 12, 2026. Version: 5.0. Primary owner: Alejo, Hart Jaztin A..

Owned records: QueueEntry, numbering and transition history.

Authority: Scoped Staff/Owner operations and responsible-Dentist commands follow current contracts.

Requirement basis: Original Q19/Q21/Q32; PI-24 many waiting and PI-25 front desk visibility; user live-waitlist requirement.

### Inputs

- Assigned authoritative Visit
- Branch, Dentist and clinic day
- Current queue state
- Authorized action or priority reason

### Process

1. Accept an eligible assigned Visit.
2. Allocate its queue number atomically.
3. Compute ordering from authoritative records.
4. Validate actor and allowed transition.
5. Apply call, ready, away, return or serve outcome.
6. Recompute visible positions.
7. Publish scoped live waiting counts and Patient-safe status.
8. Retain transition history and source freshness.

### Outputs

- Current ordered queue and factual waiting counts
- Patient-safe own queue status
- Attributed queue transition history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Live waiting: Show factual current counts and ordered positions.
- Transition integrity: Track refused duplicate numbers or invalid state changes.
- Observed waiting: Measure elapsed waiting only where actual transition timestamps exist.

Boundary: M9 owns live ordered waiting records and factual counts. M21 owns historical trends; M5 owns actual treatment completion. Predicted waits and numeric busy thresholds remain unapproved.

Dependencies: M8 Patient Visits; M3 Work Schedules; M5 Treatment Management; M18 Notifications.

Implementation evidence: Reported server queue foundation. Live UI completeness and refresh behavior remain integration work.

Policy and configuration still required: No guessed wait formula, fixed busy threshold or automatic cross-branch transfer is approved.

### Acceptance scenarios

- Two concurrent operations cannot duplicate queue numbers; a Patient cannot read another Patient queue record..
- Reject unauthorized access and preserve attributed history..

## M10 Dental Charts

Updated: October 12, 2026. Version: 5.0. Primary owner: Ecal, Richmon.

Owned records: Patient tooth/surface finding and chart revision.

Authority: Dentist authors clinical findings; other access is purpose-scoped.

Requirement basis: Project-approved charting scope; Q17 confirms digital history but does not specify notation or chart fields. Obtain the actual chart before new clinical writes.

### Inputs

- Patient and clinical Visit context
- Dentition/tooth identification scheme
- Dentist-recorded findings
- Previous chart and performed-procedure references

### Process

1. Resolve Patient and authorized clinical context.
2. Load the permitted prior chart.
3. Validate the selected tooth, surface or area.
4. Record Dentist findings with date and provenance.
5. Distinguish existing findings, planned care and completed care.
6. Save a versioned chart change.
7. Link related plans, treatment or images without duplicating their authority.
8. Present the chart and chronological change history.

### Outputs

- Current dental chart
- Attributed tooth/surface findings
- Chart revision history and clinical links

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Finding provenance: Measure Dentist, tooth/surface and revision completeness.
- Revision integrity: Track attributed amendments with preserved earlier findings.
- Chart retrieval: Measure permitted chart retrieval and refused cross-patient access.

Boundary: M10 owns structured dental findings and chart revisions. M12 owns proposed procedures, M5 actual procedures and M14 supporting image files. Clinical notation and findings remain Dentist-authored.

Dependencies: M4 Patient Records; M8 Patient Visits; M14 Document Management.

Implementation evidence: Proposed new domain. The former M10 flow/capacity prototype is not a dental-chart implementation.

Policy and configuration still required: New project scope: clinic must confirm notation, fields, charting permissions and correction rules before write commands.

### Acceptance scenarios

- A planned restoration cannot be displayed as a completed procedure; another Patient chart is inaccessible..
- Reject unauthorized access and preserve attributed history..

## M11 Billing Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Delos Santos, Joevan.

Owned records: Invoice, immutable charge evidence, balance and authorized correction history.

Authority: Existing authorized financial actors issue invoices; exact monetary and legacy financial safeguards remain authoritative.

Requirement basis: Original Q15/Q18/Q27; user-requested Billing/Payments separation. Example interview fees are not approved catalog values.

### Inputs

- Authoritative completed billable procedures
- Effective price versions and existing financial holds
- Verified Patient/payer identity
- Verified settlement references from M23 or approved correction commands

### Process

1. Resolve the authorized Patient and billable care context.
2. Validate completed procedures and all existing financial holds.
3. Resolve exact approved price versions.
4. Calculate and preserve charge evidence without float arithmetic.
5. Issue the invoice through the permitted command.
6. Link verified payment evidence from M23 atomically.
7. Derive balance and financial status from authoritative records.
8. Present invoice history and preserve authorized correction evidence.

### Outputs

- Authoritative invoice and charge snapshot
- Balance and financial status
- Source-linked billing and correction history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Charge provenance: Measure completed-procedure and effective-price linkage.
- Financial exceptions: Count blocked issues and unresolved financial holds.
- Balance consistency: Compare balances with verified charge and settlement evidence.

Boundary: M11 owns what is owed. M23 owns collection attempts, verified settlements and payment receipts. The split is planning metadata; current composite billing/payment implementation and legacy HMO gates are not migrated or bypassed.

Dependencies: M5 Treatment Management; M13 Services and Pricing; M23 Payment Management; M22 Audit Logs.

Implementation evidence: Reported historical M11 billing/payment foundation, immutable charges and financial safeguards. The proposed separate billing/payment ownership requires source reconciliation.

Policy and configuration still required: Confirm adjustments, discounts, tax fields, partial-payment/refund policy and billing/payments separation before new financial behavior. Current holds remain enforced.

### Acceptance scenarios

- A price update or proposed procedure cannot rewrite issued charge evidence; a browser payment redirect cannot change invoice settlement..
- Duplicate verified webhooks create one settlement; mismatched capture is preserved for reconciliation, not silently marked Paid..
- Reject unauthorized access and preserve attributed history..

## M12 Treatment Plans

Updated: October 12, 2026. Version: 5.0. Primary owner: Alejo, Hart Jaztin A..

Owned records: Versioned proposed plan, phases, estimates and Patient decision.

Authority: Dentist proposes clinical care; authorized Staff coordinate bookings.

Requirement basis: Agreed project treatment-planning scope; clinic fields, decision states and multi-visit workflow still need the actual plan format.

### Inputs

- Patient, Dentist findings and chart
- Proposed procedures and priority
- M13 prices for clearly labelled estimates
- Patient decision and planned appointment references

### Process

1. Resolve authorized Patient and Dentist context.
2. Create the proposed plan from Dentist-selected procedures.
3. Organize clinically chosen phases or visit sequence.
4. Calculate a labelled estimate from approved price data.
5. Present the plan and record the attributed Patient decision.
6. Link accepted work to permitted M6 appointment commands.
7. Track actual progress from M5 completion evidence.
8. Version revisions and preserve earlier plan decisions.

### Outputs

- Proposed or accepted treatment plan
- Versioned estimate and decision history
- Planned-visit links and actual progress

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Decision history: Count plans with recorded patient decisions and current versions.
- Unscheduled care: Track accepted planned work with no linked permitted booking.
- Actual progress: Derive progress from performed-care evidence, not estimated elapsed time.

Boundary: M12 owns proposed care, phased estimates and attributed Patient decisions; M5 owns performed care and M11 issued charges. Plan acceptance is not clinical consent, completed care or payment. Legacy HMO M12 records retain their old identity.

Dependencies: M4 Patient Records; M10 Dental Charts; M13 Services and Pricing; M6 Appointment Management; M5 Treatment Management.

Implementation evidence: Proposed new domain. Legacy HMO M12 records and the superseded attendance proposal are not treatment-plan records.

Policy and configuration still required: New domain: plan decision states, estimate validity and multi-visit clinic workflow need confirmation.

### Acceptance scenarios

- Accepting a treatment plan creates no completed treatment, invoice payment or clinical consent automatically..
- Reject unauthorized access and preserve attributed history..

## M13 Services and Pricing

Updated: October 12, 2026. Version: 5.0. Primary owner: Licanda, Celin.

Owned records: Service/procedure definition, branch offering and effective price version.

Authority: Owner-authorized catalog and price changes.

Requirement basis: Original Q1/Q12. Actual approved services, durations and prices are still required.

### Inputs

- Service or procedure definition
- Clinic-approved scheduling duration
- Branch offering decision
- Approved price and effective date

### Process

1. Validate catalog change authority.
2. Define bookable service or clinical procedure references.
3. Record approved duration and eligibility dependencies.
4. Assign offerings to branches.
5. Create exact effective-dated price versions.
6. Validate activation, retirement and existing references.
7. Publish current catalog and price resolution.
8. Retain historical prices for earlier financial evidence.

### Outputs

- Authoritative service catalog
- Branch offerings and price resolver
- Versioned price and catalog history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Price validity: Track missing effective fees and rejected invalid price definitions.
- Catalog consistency: Measure branch/service eligibility reference completeness.
- Snapshot protection: Verify issued invoice price snapshots survive later fee changes.

Boundary: M13 owns services, branch offerings and effective fee versions. M3 supplies eligibility/availability; M5 records actual work; M11 preserves invoice price snapshots.

Dependencies: M1 User Management; M2 Branch Management; M11 Billing Management; M6 Appointment Management.

Implementation evidence: Reported catalog and effective-price backend foundation; clinic-approved values still require source verification.

Policy and configuration still required: Duration, free-service, discounts and tax policy require approval. Interview example fees are not authoritative prices.

### Acceptance scenarios

- A later price change does not alter an already issued invoice snapshot..
- Reject unauthorized access and preserve attributed history..

## M14 Document Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Millar, John Yzhekiel.

Owned records: Private original file, metadata and extraction draft.

Authority: Patient/Staff/Dentist access follows entity and purpose authorization.

Requirement basis: Original Q16/Q17 digital forms/records; existing reported private-storage foundation. Full file permissions, retention and extraction policy remain to be finalized.

### Inputs

- Patient/workflow reference and file
- Declared purpose and actual file content
- Actor and access scope
- Optional approved text-extraction request

### Process

1. Validate uploader, Patient and workflow purpose.
2. Inspect actual file type, size and permitted content.
3. Store the original privately with integrity metadata.
4. Link the exact Patient and workflow reference.
5. Enforce scoped retrieval and download.
6. Extract native text or approved OCR as a draft.
7. Record extraction provenance and human review reference.
8. Preserve versions and archive links under approved retention rules.

### Outputs

- Private linked document and integrity metadata
- Authorized file access
- Attributed extraction draft and version history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- File validation: Count rejected content/type/size mismatches without fake scan claims.
- Review backlog: Count extraction drafts awaiting authorized human review.
- File integrity: Track protected original/version links and failed permitted retrieval.

Boundary: M14 owns protected file lifecycle, versions, retrieval and reviewed extraction drafts, including clinical image files. Consent evidence links to the relevant care record; images, upload buttons and OCR are supporting capabilities. OCR never authorizes care or prescriptions.

Dependencies: M4 Patient Records; M5 Treatment Management; M19 Prescriptions; M24 Lab Cases; M25 Patient Handovers; M22 Audit Logs.

Implementation evidence: Reported private-storage and extraction foundation. New separation from consent needs compatibility review.

Policy and configuration still required: File limits, malware handling, retention and permitted extraction providers need configuration; e-signature validity is not claimed.

### Acceptance scenarios

- Renaming an executable as a PDF does not bypass validation; a different Patient cannot download the file..
- Reject unauthorized access and preserve attributed history..

## M15 Leave Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Licanda, Celin.

Owned records: LeaveRequest, shift-specific CoverageOffer, explicit acceptance and decision history.

Authority: Staff/Dentist requests and substitute consent are individual; automated decisions execute clinic-approved standing rules without a separate per-request Owner approval step.

Requirement basis: User scope confirmed October 12: Staff/Dentist requests show eligible overtime coverage, coordination and explicit substitute confirmation before leave proceeds. PI-06/PI-08 remain Owner schedule authority and no fixed Dentist minimum.

### Inputs

- Employee, requested dates/hours and affected duties
- Authoritative Staff/Dentist roster and branch eligibility
- Configured clinic leave, coverage and work-hour rules
- Shift-specific substitute confirmation and affected-booking handling

### Process

1. Validate requester, leave period, roster and configured policy.
2. Identify every affected shift, duty and booking.
3. Show only eligible available replacements and uncovered periods.
4. Record the selected substitute and send a coverage invitation.
5. Record explicit acceptance or decline of the exact shifts/overtime.
6. Recheck all accepted coverage, conflicts and policy versions atomically.
7. Approve automatically only when required coverage and all rules pass, then publish the roster change.
8. Record outcomes, unresolved coverage and notifications with decision evidence.

### Outputs

- Pending, approved or not-approved leave decision with reasons
- Confirmed coverage and published roster reference
- Coverage invitations, acceptance and decision history

### Automation

- Calculate affected shifts and bookings from authoritative schedules
- Filter matching duties, branch/service eligibility and configured work-hour constraints
- Dispatch and track coverage invitations without assuming delivery or consent
- Recheck accepted offers and publish approval/roster changes transactionally
- Send post-commit outcome notifications and retain auditable policy/version evidence

### Performance indicators

- Coverage completeness: Compare required periods with valid accepted coverage.
- Decision exceptions: Count stale, conflicting or incomplete requests kept unapproved.
- Confirmation time: Measure request-to-confirmation/decision time from recorded events.

Boundary: M15 owns requests, invitations, voluntary overtime acceptance and rule-based decisions. M3 owns the roster; M6/M25 own booking and care-responsibility changes. Eligibility is not consent; no silent overtime assignment or new generic automation engine.

Dependencies: M1 User Management; M2 Branch Management; M3 Work Schedules; M6 Appointment Management; M18 Notifications; M22 Audit Logs; M25 Patient Handovers.

Implementation evidence: New module scope. Earlier handoff recorded the optional coverage-first concept; no complete leave engine is proven by the historical M23 evaluation recorder.

Policy and configuration still required: Confirm permitted leave types, exact duties/service eligibility, branch scope, work-hour/rest rules, coverage deadlines, partial coverage, cancellation/withdrawal, privacy and booking-impact handling. Until required policy is configured, automatic approval remains unavailable.

### Acceptance scenarios

- An acceptance racing with another shift/request cannot double-book a substitute; incomplete, stale or unconfirmed coverage cannot approve leave..
- An acceptance racing with another shift/request cannot double-book a substitute.
- Every required coverage period must be confirmed; partial coverage leaves uncovered periods pending.
- A decline, stale policy or changed availability prevents approval and explains the result.
- Coverage does not silently reassign a Patient or disclose private leave reasons.

## M16 Patient Inquiries

Updated: October 12, 2026. Version: 5.0. Primary owner: Millar, John Yzhekiel.

Owned records: Attributed external inquiry, assignment and outcome history.

Authority: Authorized intake users follow actual capabilities; routing authority remains policy-dependent.

Requirement basis: Original Q23; PI-42 Facebook/Messenger inquiries and PI-43 Owner usually replies. Existing technical Staff-only inquiry scope is a reconciliation issue, not implied Owner API permission.

### Inputs

- External inquiry and channel attribution
- Contact details supplied by the person
- Question/topic and responsible handler
- Verified Patient or booking link when available

### Process

1. Capture external inquiry and its actual source/provenance.
2. Validate contact and topic details without automatic Patient matching.
3. Assign the handler permitted by current capability/branch rules.
4. Expose open inquiries and record follow-up work.
5. Record the attributed external response or contact attempt.
6. Verify Patient identity when explicit linkage is needed.
7. Link to an existing permitted M6 appointment through the authorized conversion command.
8. Close or convert the inquiry and preserve immutable outcome history.

### Outputs

- Open inquiry and permitted handler worklist
- Attributed response/contact history
- Verified Patient and existing appointment linkage with outcome history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Unanswered cases: Count open inquiries and factual time since capture.
- Outcome history: Track recorded replies, closure and verified booking linkage.
- Identity exceptions: Count refused wrong-patient or invalid appointment links.

Boundary: M16 owns manually attributed external inquiry cases and their response/booking-link lifecycle. M17 owns identified private conversations. Recorded contact is not proof this app delivered a Messenger message; Owner external-response practice does not grant private-conversation access.

Dependencies: M1 User Management; M6 Appointment Management; M17 Patient Messaging; M22 Audit Logs.

Implementation evidence: Reported manual external-inquiry backend foundation; no real social-platform transport demonstrated.

Policy and configuration still required: Owner social-response practice does not grant unrestricted messaging access; routing and official platform access remain open.

### Acceptance scenarios

- A contact with a similar name is not silently linked to the wrong Patient..
- Reject unauthorized access and preserve attributed history..

## M17 Patient Messaging

Updated: October 12, 2026. Version: 5.0. Primary owner: Millar, John Yzhekiel.

Owned records: Participant-scoped conversation, immutable messages and read state.

Authority: Explicit authorized Patient/Staff/Dentist participants; current Owner denial remains.

Requirement basis: Agreed project human-messaging scope and reported immutable server conversation foundation. Creation/routing policy is still open.

### Inputs

- Verified Patient/workflow context
- Authorized conversation participants
- Message or reply command
- Displayed-message/read and closure actions

### Process

1. Resolve authorized conversation and participants.
2. Validate open state and workflow context.
3. Validate and submit the message idempotently.
4. Persist immutable content and sender attribution.
5. Deliver the scoped conversation projection.
6. Advance read state only for displayed messages.
7. Close the conversation under approved commands.
8. Expose permitted history and minimal audit evidence.

### Outputs

- Authorized conversation and message history
- Participant-specific unread/read state
- Closure outcome and command evidence

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Unread correctness: Compare unread state with newest actually displayed messages.
- Command integrity: Track duplicate replay and refused wrong-conversation commands.
- Conversation access: Measure permitted history retrieval and unauthorized access refusals.

Boundary: M17 owns authorized human Patient conversations and displayed-message read state. It does not own M16 inquiry cases, M18 system delivery or M15 employee coverage consent. Current Owner denial persists until a reviewed permission change.

Dependencies: M1 User Management; M4 Patient Records; M16 Patient Inquiries; M22 Audit Logs.

Implementation evidence: Reported server messaging foundation. Production creation/routing and external-channel integration are not established.

Policy and configuration still required: New conversation creation/routing, attachments and reopening require a separate approved slice.

### Acceptance scenarios

- Switching conversations never sends the prior conversation draft to another Patient..
- Reject unauthorized access and preserve attributed history..

## M18 Notifications

Updated: October 12, 2026. Version: 5.0. Primary owner: Millar, John Yzhekiel.

Owned records: Notification intent, dispatch job, attempt and delivery evidence.

Authority: Domain-approved recipients; channel and template authority must be explicit.

Requirement basis: PI-02 email employee invitations, PI-29 booking/change updates, PI-31 reminders for every appointment; user Patient/Staff notifications and leave updates. PI-30 Other was interpreted by the user as all listed channels, but API integration/timing is not confirmed.

### Inputs

- Committed domain event and recipient purpose
- Authorized recipient contact/preference
- Approved template and channel
- Transport/provider result or retry request

### Process

1. Resolve event identity and eligible recipients.
2. Render the approved purpose-limited template.
3. Persist notification intent with duplicate protection.
4. Dispatch after source transaction commit through durable jobs.
5. Send through the configured approved transport.
6. Record transport acceptance or provider delivery/failure evidence accurately.
7. Retry safe transient failures under defined limits.
8. Expose scoped notification history and administrative diagnostics.

### Outputs

- Scoped in-app notification
- Email dispatch and attempt history
- Truthful delivery/failure diagnostics

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Transport outcomes: Separate queued, transport-accepted, failed and verified delivery.
- Retry integrity: Track failed attempts and duplicate side effects prevented.
- Delivery evidence: Report receipt evidence as unavailable when it has not been received.

Boundary: M18 owns committed notification intent, dispatch and truthful delivery evidence. Source modules own invitations, leave consent, booking decisions and settlement. Email/SMS/Messenger channels require actual configured transports; log/array acceptance is not inbox delivery.

Dependencies: Committed domain events; Configured transport and durable workers; M1 recipient identity; M22 minimal audit evidence.

Implementation evidence: Browser-local in-app notifications only (a persisted browser collection and foreground reminders, not authoritative). No backend notification intent, dispatch job, attempt or delivery-evidence record exists. Appointment booked/rescheduled/cancelled and payment-receipt emails are durable intents written in the domain transaction and sent by a queue worker with atomic claims, recorded attempts and bounded retries; verification-code, invitation and diagnostic emails are sent once immediately and recorded. Outcomes stay distinct (logged locally, accepted by transport, failed); the default mailer is log and no recipient-delivery evidence exists. Actual recipient email delivery has not been demonstrated.

Policy and configuration still required: TD-24 workers and TD-25 truthful diagnostics remain open. Channels, reminder timing and verified external receipt need setup.

### Acceptance scenarios

- A log-mail driver reports local logging, never recipient delivery; retries do not send duplicate receipts..
- Reject unauthorized access and preserve attributed history..

## M19 Prescriptions

Updated: October 12, 2026. Version: 5.0. Primary owner: Ecal, Richmon.

Owned records: Dentist draft and immutable authorized prescription version.

Authority: Responsible authorized Dentist prescribes; Patient receives a safe read-only copy.

Requirement basis: Original Q16; PI-38 confirms both handwritten and printed prescriptions.

### Inputs

- Patient and valid clinical Visit
- Verified Dentist credential reference
- Dentist-selected medication instructions
- Optional human-reviewed document extraction draft

### Process

1. Resolve the clinical Visit and authorizing Dentist.
2. Review permitted recorded allergies and history.
3. Create the Dentist-authored prescription draft.
4. Validate required medication/instruction fields.
5. Require Dentist review of every item and OCR uncertainty.
6. Authorize the immutable prescription version explicitly.
7. Generate the approved printable and Patient-safe copy.
8. Retain version/authorization history and optional M18 delivery reference.

### Outputs

- Authorized prescription record
- Printable and Patient-safe copy
- Attribution and authorization history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Authorization: Track drafts and explicitly authorized prescription versions.
- Draft review: Count extraction uncertainty awaiting Dentist review.
- Print integrity: Verify printed copies correspond to the authorized immutable version.

Boundary: M19 owns Dentist prescribing and immutable authorized versions. M14/OCR supplies drafts only; M7 never selects medication or signs a prescription. Print fields and amendments require clinic-approved rules.

Dependencies: M4 Patient Records; M5 Treatment Management; M14 Document Management; M18 Notifications; M22 Audit Logs.

Implementation evidence: Browser-local only: prescription drafts and Dentist authorization are kept in a browser-persisted collection. The server stores only the Dentist prescription_required flag on the Treatment; there is no backend prescription record, immutable authorized version, route or printable output. Authorized production behavior and printing are not implemented.

Policy and configuration still required: Clinic-approved print fields, corrections and delivery/legal requirements remain open.

### Acceptance scenarios

- An OCR draft cannot be printed or presented as an authorized prescription before Dentist approval..
- Reject unauthorized access and preserve attributed history..

## M20 Patient Follow-Up

Updated: October 12, 2026. Version: 5.0. Primary owner: Alejo, Hart Jaztin A..

Owned records: Dentist-originated follow-up obligation and outcome history.

Authority: Dentist decides clinical need; scheduling follows existing M6 permissions.

Requirement basis: Original Q15/Q27; agreed outstanding-care workflow. DQ-72 and clinic-selected intervals/outcome rules remain open.

### Inputs

- Relevant Treatment/Visit and Patient
- Dentist follow-up instruction and chosen date/interval
- Linked appointment outcome
- Approved contact preference and outreach evidence

### Process

1. Validate the Dentist decision and source care record.
2. Create the follow-up obligation with attribution.
3. Record the Dentist-selected target date and reason.
4. Expose the authorized scheduling worklist.
5. Link a normal M6 booking through current permissions.
6. Request approved reminders through M18.
7. Track actual booked, missed or completed evidence.
8. Close or return the obligation to scheduling under approved policy.

### Outputs

- Clinical follow-up obligation
- Due/unscheduled worklist and booking link
- Attributed follow-up and completion history

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Outstanding care: Count due obligations without a completed outcome.
- Scheduling links: Track obligations linked to valid appointments and actual outcomes.
- Clinical provenance: Measure originating Dentist and care-source completeness.

Boundary: M20 owns Dentist-originated outstanding care obligations and actual outcomes; M6 booking, M18 transport. No fixed recall interval or automatic clinical decision is inferred.

Dependencies: M5 Treatment Management; M6 Appointment Management; M18 Notifications; M22 Audit Logs.

Implementation evidence: Browser-local obligations: follow-up tasks are created in the browser from the Dentist-documented follow-up fields recorded on the server Treatment and are scheduled through ordinary M6 booking commands. There is no backend follow-up obligation, outcome history or reminder record.

Policy and configuration still required: Recall intervals, missed/cancelled reopening and DQ-72 scheduling authority remain open.

### Acceptance scenarios

- A Staff contact attempt cannot create a clinical follow-up requirement or mark it completed..
- Reject unauthorized access and preserve attributed history..

## M21 Reports and Analytics

Updated: October 12, 2026. Version: 5.0. Primary owner: Delos Santos, Joevan.

Owned records: Authorized report definition and source-traceable result/export.

Authority: Owner consumes operational/financial oversight within existing privacy scope.

Requirement basis: Original Q7-Q11 supply estimates only; reported verbal Owner requirement for one-glance operational/revenue oversight. DQ-113 remains unresolved.

### Inputs

- Authoritative appointments, Visits, queues and work schedules
- Completed care, issued charges and verified payment evidence
- Authorized date, branch and report filters
- Approved metric definitions and source availability

### Process

1. Validate report access and requested filters.
2. Select the complete authorized source window.
3. Separate live operational snapshots from historical trends.
4. Calculate exact approved aggregates.
5. Represent missing or partial data explicitly.
6. Render meaningful comparisons and drill-down references.
7. Export permitted data with safe formatting.
8. Retain report provenance and verify source consistency.

### Outputs

- Owner dashboard and scoped reports
- Source-traceable financial/operational metrics
- Authorized exports with completeness labels

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Source completeness: Identify absent/partial source windows rather than reporting false zero.
- Metric consistency: Compare money/date aggregates with their authoritative sources.
- Report performance: Measure scoped query/export latency and truncation visibility.

Boundary: M21 derives read-only results from authoritative records, keeping live snapshots separate from historical trends. M11/M23 own money; M15 owns leave outcomes; clinical/private message/feedback content is not made visible by reporting access.

Dependencies: M3 Work Schedules; M6 Appointment Management; M8 Patient Visits; M9 Patient Queue; M11 Billing Management; M23 Payment Management; M18 Notifications.

Implementation evidence: Reported M21 technical corrections at 6563e4c; complete executive reporting and production readiness are unverified.

Policy and configuration still required: DQ-113 revenue date basis and busy-branch definitions remain open; do not fabricate wait/capacity metrics.

### Acceptance scenarios

- Current queue counts are not presented as historical daily queue trends; missing data is not a false zero..
- Reject unauthorized access and preserve attributed history..

## M22 Audit Logs

Updated: October 12, 2026. Version: 5.0. Primary owner: Delos Santos, Joevan.

Owned records: Append-only audit event and scoped investigation/export.

Authority: Current authorized Owner audit access; no unrestricted clinical-content access.

Requirement basis: Agreed audit/history usability requirements and reported append-only server audit foundation.

### Inputs

- Audit-worthy committed action
- Actor, target, branch and timestamp
- Minimal allowed outcome/change metadata
- Authorized search or export request

### Process

1. Capture the committed action with stable references.
2. Validate required event metadata and sensitive-content exclusions.
3. Persist append-only evidence consistently with the domain action.
4. Apply approved access and retention controls.
5. Filter and paginate in the server database.
6. Show outcome, actor and source context for investigation.
7. Flag only defined review signals with transparent provenance.
8. Export authorized bounded results and record relevant access evidence.

### Outputs

- Protected audit event history
- Scoped investigation results
- Bounded authorized audit export

### Automation

- Validate access, stable references and allowed state changes.
- Commit domain changes atomically where required and protect retries.
- Request purpose-limited notifications after committed outcomes.

### Performance indicators

- Search performance: Measure authorized filter/pagination and export response time.
- Event attribution: Measure actor, target and outcome completeness for supported actions.
- History protection: Track refused mutation attempts under the application database role.

Boundary: M22 owns append-oriented minimal action evidence and authorized search/export. Domain records retain their own histories and archive/restore commands. No document, message, feedback or clinical text is copied into audit events.

Dependencies: Attributed committed domain actions; M1 identity and access; Configured retention and export policy.

Implementation evidence: Reported server append-only audit foundation with Owner read/CSV and cursor pagination; advanced usability remains incomplete.

Policy and configuration still required: Severity rules, read auditing, retention/export and index performance need review.

### Acceptance scenarios

- A million-row audit search is server-filtered and paginated without exposing clinical notes or message text..
- Reject unauthorized access and preserve attributed history..

## M23 Payment Management

Updated: October 12, 2026. Version: 5.0. Primary owner: Delos Santos, Joevan.

Owned records: CheckoutAttempt, verified Payment, receipt and reconciliation exception.

Authority: Patient checkout and financial processing use existing invoice/actor permissions; verified provider evidence is required for settlement.

Requirement basis: User PayMongo, billing autofill and linked-history requirement; original Q15/Q18/Q27 payment workflow.

### Inputs

- Payable M11 invoice, exact amount and all active financial holds
- Authorized payer details from Patient/invoice records
- Configured PayMongo test/live mode and credentials
- Authenticated callback/provider session or permitted manual-payment evidence

### Process

1. Resolve the payable invoice and authorized payer/actor.
2. Fetch supported billing details and collect missing required fields.
3. Create or reuse the permitted hosted checkout attempt.
4. Record attempt identity without treating redirects as payment.
5. Verify webhook authenticity and retrieve provider session evidence.
6. Match invoice/session, exact amount, currency, mode and paid state idempotently.
7. Commit verified settlement and linked billing impact atomically or retain a reconciliation exception.
8. Issue linked receipt/history and request approved notification delivery.

### Outputs

- Hosted checkout or valid payment refusal
- Verified payment, receipt and invoice-linked history
- Retry-safe checkout and reconciliation evidence

### Automation

- Prefill authorized supported Patient/invoice fields
- Verify provider callbacks and reconcile exact authoritative evidence
- Deduplicate retries and atomically link settlement to the invoice
- Generate receipt references and dispatch approved notifications after commit

### Performance indicators

- Settlement integrity: Count verified settlements and duplicate callbacks handled safely.
- Reconciliation backlog: Count captured/mismatched evidence awaiting resolution.
- Payment history: Measure invoice/session/receipt linkage and exact amount consistency.

Boundary: M23 owns payment collection and reconciliation; M11 owns charges/invoices/balances. This is new planning M23, not the historical automation recorder. Existing PayMongo and HMO safeguards remain; patient autofill is limited to authorized supported fields.

Dependencies: M11 Billing Management; M4 Patient Records; M18 Notifications; M22 Audit Logs.

Implementation evidence: Reported payment/PayMongo foundation currently belongs to historical M11. Separate M23 ownership is planned; sandbox E2E and recipient email receipt have not been verified.

Policy and configuration still required: Configure credentials/methods/mode, callback reachability and missing payer-field handling. Preserve exact amounts, signatures, provider retrieval, locks and duplicate protection. Partial payments/refunds remain policy decisions; real sandbox and actual receipt delivery remain unverified.

### Acceptance scenarios

- Repeated verified callbacks create one settlement; a mismatched amount or forged redirect never marks an invoice Paid..
- Repeated verified callbacks create one settlement.
- Forged, wrong-mode or amount/session-mismatched evidence cannot settle an invoice.
- A captured but mismatched payment remains visible for reconciliation.
- Payer autofill and payment history cannot expose another Patient data.

## M24 Lab Cases

Updated: October 12, 2026. Version: 5.0. Primary owner: Millar, John Yzhekiel.

Owned records: Patient-linked LabCase, dispatch/return events and Dentist review history.

Authority: Proposed: authorized Staff coordinates dispatch/return; responsible Dentist authorizes clinical instructions and acceptance/rework; no laboratory login role is added.

Requirement basis: User confirmation October 12 at 19:14 Asia/Manila: external lab work is performed and tracked manually. Detailed role/state fields above are the proposed specification.

### Inputs

- Exact Patient, clinical context and Dentist-approved laboratory instructions
- Approved external laboratory and required dates
- Dispatch, expected-return and actual-receipt evidence
- Linked appointment, supporting documents and Dentist review outcome

### Process

1. Resolve authorized Patient and care context.
2. Create the case and record Dentist-approved instructions.
3. Link the external laboratory, required dates and permitted appointment references.
4. Record actual dispatch and attributed coordination.
5. Track expected return and factual overdue/unresolved cases.
6. Record receipt with supporting evidence.
7. Require responsible Dentist review and record acceptance or rework.
8. Publish readiness/worklist outcome and preserve the complete case history.

### Outputs

- Traceable laboratory case and coordination history
- Outstanding/overdue and rework worklist
- Dentist review and appointment-readiness status

### Automation

- Calculate factual outstanding/overdue lists from recorded dates
- Surface booking dependencies and request approved notifications
- Record receipt and review outcomes with protected history
- Project readiness only from authorized review evidence

### Performance indicators

- Outstanding lab work: Count open cases and returns overdue against recorded expected dates.
- Review readiness: Separate received, awaiting-review, rework and accepted outcomes.
- Case traceability: Measure Patient, lab, dispatch, receipt and review evidence linkage.

Boundary: M24 owns external lab work from authorized order through accepted return/rework. M14 owns files; M6 booking; M5 clinical care. Receipt alone is not clinical acceptance, treatment completion or payment; no device/sensor or lab API integration is assumed.

Dependencies: M4 Patient Records; M5 Treatment Management; M6 Appointment Management; M14 Document Management; M18 Notifications; M22 Audit Logs.

Implementation evidence: New module; user confirmed October 12 that external laboratory work is tracked manually. Existing rewards M24 records are not LabCase records.

Policy and configuration still required: Confirm actual laboratories, case types, instruction fields, Staff scope, review authority, expected-date/overdue rules, rework/cancellation, lab-fee handling and retention. Manual external events remain attributed evidence.

### Acceptance scenarios

- Receiving a case cannot mark it Ready without the authorized Dentist acceptance; late/rework cases identify affected bookings without cancelling them..
- Receiving a case cannot mark it Ready without Dentist acceptance.
- A case/document link cannot be switched to another Patient.
- Rework preserves earlier dispatch, receipt and review evidence.
- Readiness changes do not silently cancel bookings or complete Treatment.

## M25 Patient Handovers

Updated: October 12, 2026. Version: 5.0. Primary owner: Ecal, Richmon.

Owned records: PatientHandover, purpose-scoped care packet, acknowledgment and outcome history.

Authority: Proposed: sending Dentist authorizes the clinical handover; receiving Dentist records acceptance; authorized Staff coordinates existing booking/assignment commands.

Requirement basis: User confirmation October 12 at 19:14 Asia/Manila: care moves between Dentists/branches with coordination beyond changing an appointment, currently through calls/messages.

### Inputs

- Exact Patient and sending care context
- Sending and receiving Dentist/branch
- Handover reason, approved summary and outstanding-care references
- Recipient acknowledgment and permitted booking/assignment evidence

### Process

1. Resolve the Patient and authorized sending care context.
2. Create a draft handover with reason and intended recipient.
3. Review the minimum permitted summary and supporting references.
4. Notify the scoped receiving team and record actual coordination.
5. Record acknowledgment, acceptance or decline with attribution.
6. Coordinate required booking/assignment through existing authorized services.
7. Record the agreed care-handoff outcome and linked follow-up references.
8. Close or retain unresolved handover work while preserving history.

### Outputs

- Traceable internal care-handover case
- Receiving-team acknowledgment and responsibility outcome
- Pending handover worklist and linked care/booking history

### Automation

- Track outstanding acknowledgments and factual handover status
- Send purpose-limited notifications through M18
- Validate recipient identity and scope before packet access
- Link approved booking, assignment and outcome events without duplicating their commands

### Performance indicators

- Pending handovers: Count requests awaiting receiving-team acknowledgment/outcome.
- Responsibility evidence: Measure attributed acceptance and agreed outcome completeness.
- Handover time: Measure dispatch-to-acknowledgment/outcome elapsed time.

Boundary: M25 owns continuity between Dentists/branches, not a branch-change button or ordinary message. M6 bookings, M8 Visit assignment and M5 care remain authoritative. No generic clinical access, automatic reassignment or rewriting completed care is granted by a handover.

Dependencies: M4 Patient Records; M5 Treatment Management; M6 Appointment Management; M8 Patient Visits; M14 Document Management; M18 Notifications; M20 Patient Follow-Up; M22 Audit Logs.

Implementation evidence: New module; user confirmed October 12 that inter-Dentist/branch handovers are coordinated informally by calls/messages. Existing campaign M25 records are not PatientHandover records.

Policy and configuration still required: Confirm who initiates/receives, purpose-specific packet visibility, when care responsibility changes, decline/nonresponse/cancellation, active-Visit handling and return/outcome closure. External specialist referrals are not implied by the confirmed internal workflow.

### Acceptance scenarios

- A booked receiving appointment does not imply recipient acceptance, clinical access or completed care; an unauthorized recipient cannot read the care packet..
- A receiving booking does not prove acknowledgment or accepted responsibility.
- An unauthorized recipient cannot read the handover packet.
- Prior completed care and author attribution remain unchanged.
- Decline/nonresponse remains visible and does not silently reassign the Visit.

## Shared workflow rules

M2 operating calendars and M3 published availability feed M6 bookings. Actual arrival creates an M8 Visit; an assigned Dentist permits an M9 queue entry. M10 findings and M12 proposed care support M5 Dentist-authored performed care, which supplies billable evidence to M11. M23 verified payments settle invoices through existing atomic financial commands. M24 lab readiness and M25 care handovers supply operational context; neither completes care or silently changes bookings. M19 prescriptions and M20 follow-up remain Dentist-authorized. M18 delivers committed event notifications; M21 derives authorized read-only reporting; M22 preserves minimal action evidence.

M15 approval requires voluntary substitute acceptance of all required coverage and a fresh check of configured eligibility/conflict rules. Decline, expiry or missing policy cannot imply approval. Withdrawal/cancellation after approval and lost coverage must have explicitly defined handling; history is never erased. Employee coverage invitations belong to M15 and do not bypass M17 private-conversation permissions. Substitute access to Patients follows normal clinical/branch authorization.

## Reference workflows

Clinic facts and user scope requests take precedence over vendor comparisons. Original Q1-Q32 remain historical; follow-up PI-08 supersedes a hard minimum Dentist interpretation of Q5. The user clarified that Other means all listed options for PI-30; official channel integrations are still separate configuration decisions.

- Open Dental lab cases: https://opendental.com/site/0_labcases.html
- CareStack internal care referrals: https://carestack.com/dental-software/features/internal-referrals
- Open Dental chart and treatment-plan organization: https://www.opendental.com/site/quickmanual.html

The reference products demonstrate workflows, not local policy, legal compliance, permissions or implementation proof.
