# Approved 25-Module Coverage

Current implementation: `dac864e`, through Phase 3.5. **Implemented** means frontend behavior with local persistence, not backend/integration completeness. **Partial** identifies a materially narrower frontend representation than the approved module/ERD scope. M1–M23 are Core; M24/M25 are Proposed Enhancements regardless of illustrative controls. Shared screens do not merge modules.

| Module / purpose | Status | Current capability / main surface | Important boundary |
| --- | --- | --- | --- |
| M1 — User & Role Access Management | Core / Implemented frontend | Owner People & Access creates linked accounts/profiles; current account, permission, role and scope checks; activate/deactivate | Demo identity, not server authentication. Account status differs from operational availability |
| M2 — Branch Management | Core / Partial | Owner branch information, status, hours, service assignments and capacity configuration | Simple open/close hours; ERD per-day/exception calendars are not fully modeled |
| M3 — Dentist & Staff Management | Core / Partial | M1-synchronized profiles, branch assignment, specialization/license, shifts, availability and capability references | Inline shifts/assignments, not a complete dated roster/exception manager |
| M4 — Patient Record Management | Core / Partial | Central PERSON/Patient identity; scoped search, registration, demographics and longitudinal clinical history | Authorized charts retain cross-branch clinical history; visit list is operationally scoped. General document cards are illustrative, not uploaded evidence |
| M5 — Treatment Management | Core / Implemented frontend | Dentist My Queue → exact encounter → draft → actual procedure lines → completion | Dentist judgment only. No template catalog/amendment subsystem; completed records are protected |
| M6 — Appointment Management | Core / Implemented frontend | Patient booking/My Appointments and Staff worklist; book, reschedule, cancel with canonical context | No payment during booking; Patient cannot be reassigned by rescheduling; admitted reschedule blocked |
| M7 — Scheduling / Conflict Prevention | Core / Implemented frontend | Manual and Find Best share branch/service/Dentist/shift/time/overlap validation | Suggestions reserve nothing until validated booking; no invented timing policy |
| M8 — Check-In | Core / Implemented frontend | Staff selects scheduled arrival or admits validated walk-in; timestamp, Check-In and queue handoff | Separate fast admission, not registration or treatment. No Patient self-Check-In command |
| M9 — Queue Management | Core / Implemented frontend | Own Patient position; own Dentist queue; Staff Call/Ready/Away/Return/No-show and priority with reason/audit | Treatment completion controls clinical closure. Operational Owner exceptions are documented separately |
| M10 — Wait Time / Capacity | Core / Implemented frontend estimates | Queue wait estimate, load/threshold and alternative-branch visibility | Aggregate estimates differ from individual queue order; no guaranteed case-specific duration |
| M11 — Billing / Payment | Core / Implemented frontend | Actual completed procedures → Draft invoice → Review → Issue → full Payment → linked Receipt | Staff financial commands; Cash recorded locally, Card/Electronic simulated. No arbitrary bill, partial payment or refund; zero-fee closure unresolved |
| M12 — HMO Verification | Core / Partial | Exact case prefill; Missing/Provided/Validated locally requirement metadata; safe Patient requirement path | Fixed three-rule checklist, not full provider/service policy eligibility. Local completeness is not provider approval |
| M13 — HMO Submission / Provider Response | Core / Implemented frontend tracking | Record external submission and received Approved/Rejected/Returned outcome, with current cycle/history | No provider contacted, approval invented or reimbursement confirmed; full claims integration remains future |
| M14 — HMO Follow-Up / Escalation | Core / Implemented frontend tracking | Timestamp-derived pending hours, 12-hour work threshold, current-cycle contact, deduplicated follow-up/escalation | Foreground evaluation only. Escalated is unresolved/actionable; Returned can be corrected/resubmitted |
| M15 — Workload Management | Core / Implemented frontend estimates | Staff/Owner capacity, workload and cross-branch alternatives | Read operational estimates; no automatic personnel reassignment |
| M16 — Social Inquiry Management | Core / Implemented frontend tracking | Assigned Staff capture/status; link booked appointment and explicit-participant conversation once | No social platform transport; conversion links an existing validated booking |
| M17 — Messages | Core / Implemented frontend | Patient/Staff/Dentist two-way threads, authorized replies, closure and participant-specific unread state | Explicit user participants, not broad roles. Owner oversight grants no participation; no reopen workflow |
| M18 — Notifications | Core / Implemented in-app | Global bell, recent/full history, individual/own Mark All Read, event targeting and validated action context | Separate records/unread count from Messages. Email and real-time server delivery remain future |
| M19 — Prescription | Core / Implemented frontend | Requested task, Dentist-entered medication items, private draft, explicit authorization, own Patient view | Exact treatment/Patient/Dentist; no automatic prescribing or post-authorization draft edits |
| M20 — Follow-Up Management | Core / Implemented frontend | Dentist decision → obligation → Staff or own Patient scheduling → linked appointment → completion | Same M7 validator; cancellation/no-show reopens scheduling; reschedule preserves identity. Staff cannot invent clinical need |
| M21 — Analytics | Core / Partial | Operational KPIs, some branch projections, CSV export/formula protection | Period control is ineffective; communication metric/export scope inconsistent. Read layer, not duplicated operational stores; see conflict C1 |
| M22 — Owner Dashboard | Core / Implemented frontend overview | Cross-branch summaries, workload, exceptions and drill-downs | Read/oversight layer; historical demo Paid totals are not verified financial reconciliation |
| M23 — Workflow Automation | Core / Implemented frontend | Shared predefined handoffs, contextual events/actions, deduplication, failure/warning feed, read-only Automation Monitor | No clinical judgment, unrestricted rule editor, generic engine or background worker |
| M24 — Referral / Loyalty | Proposed Enhancement | Illustrative PE screens for referral/points/redemption concepts | Not completed core implementation or validated production loyalty service |
| M25 — Marketing / Reactivation | Proposed Enhancement | Illustrative PE campaign/engagement screens | No real outreach/consent-delivery infrastructure; must not block core care |

## Responsibilities and separations

- **M8 / M9 / M10:** arrival admission / individual order and state / aggregate wait and capacity.
- **M12 / M13 / M14:** prepare local requirements / track external submission and provider response / follow up and escalate unresolved cases.
- **M17 / M18:** human conversation with participants / one-way operational events with recipients.
- **M21 / M22 / M23:** analyze what happened / present Owner oversight / coordinate the next predefined administrative action.

## Role surfaces

Patient: own dashboard/care, booking, appointments, Queue & Wait, Prescriptions, Follow-Ups, HMO, Messages, Receipts & Payments; Loyalty is PE.

Staff: operational worklists as allowed by current subrole and assigned branch. Receptionist, Dental Assistant, Cashier, HMO Coordinator and Patient Engagement Staff do not have interchangeable permission sets. See the [role matrix](DOCUMENTATION_RECONCILIATION.md#role-and-permission-clarifications).

Dentist: schedule, own queue, scoped Patient chart, exact Treatment, Prescriptions, Follow-Ups and participant Messages. No Staff payment/HMO processing authority.

Owner/Admin: Dashboard, Analytics, Branches, Team, Capacity, People & Access, HMO oversight and Automation Monitor; Engagement is PE. Shared Phase 1 administrative exceptions do not imply clinical authority. **25-Module Coverage is a defense document, not production navigation.**

See [Frontend Scope](FRONTEND_SCOPE.md), [ERD Alignment](ERD_ALIGNMENT.md), [conflict C1](DOCUMENTATION_RECONCILIATION.md#conflicts-retained-for-review) and the [demo guide](PROFESSOR_DEMO_GUIDE.md). Partial status preserves approved requirements; it does not remove them.
