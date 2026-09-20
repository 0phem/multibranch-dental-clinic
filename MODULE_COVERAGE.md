# 25-Module Frontend Coverage

| Module | Documented process | Main UI location | User experience represented |
|---|---|---|---|
| M1 | User, Role & Access Management | Owner/Admin → Users & Access | ERD-aligned account creation (username, email, role_name, branch_id, account_status), permission profiles, activate/deactivate status, M1→M3 personnel-profile synchronization |
| M2 | Multi-Branch Clinic Management | Owner/Admin → Branches | Branch profile, hours, services, status, capacity threshold, publish/sync concept |
| M3 | Dentist & Staff Management | Owner/Admin → Staff & Dentists | Linked STAFF_PROFILES records synchronized from M1 accounts; staff type, license no., specialization, branch/shift, Active account state and Available operational state |
| M4 | Patient Records Management | Staff/Dentist → Patient Records | Create/find record, demographics, HMO, visit history, documents, role-aware clinical fields |
| M5 | Treatment & Clinical Workflow Management | Dentist → Treatment | Complaint/history context, plan, assistant, status, notes, completion, downstream triggers |
| M6 | Core Appointment Booking & Schedule Management | Patient → Book/My Appointments; Staff → Appointments | Book, confirm, reschedule, cancel, status and slot release/reserve behavior |
| M7 | Smart Scheduling & Conflict Prevention | Booking/Reschedule validation panel | Branch schedule, service availability, dentist assignment/shift, overlap checks, alternatives |
| M8 | Patient Check-In Management | Staff → Check-In | Lightweight scheduled/walk-in admission, arrival timestamp, dentist/branch confirmation, automatic queue handoff |
| M9 | Smart Patient Queue Management | Patient/Staff/Dentist → Queue | Individual ordering, priority, call/skip/ready/no-show/complete, recalculation |
| M10 | Waiting-Time & Patient Flow Capacity Management | Patient Queue; Staff/Owner → Capacity | Estimated wait, aggregate load, threshold, alert context, alternative branch capacity |
| M11 | Billing & Payment Management | Patient → Bills; Staff → Billing | Completed treatment prepares a draft invoice; staff issues/reviews exceptions, posts payment, and generates the linked receipt |
| M12 | HMO Verification & Documentation Management | Staff → HMO | Prefilled case, local requirement completeness, missing-document states, and verification-ready workflow |
| M13 | HMO Request & Approval Management | Staff → HMO; Owner → HMO Overview | Submit, reference/pending concept, provider outcome recording, approved/rejected/returned |
| M14 | HMO Follow-Up & Escalation Automation | Staff → HMO | Threshold worklist, follow-up attempts, escalation, patient status notification |
| M15 | Staff Workload & Cross-Branch Capacity Automation | Staff/Owner → Capacity & Workload | Staff/dentist capacity, workload %, threshold, cross-branch alternative view |
| M16 | Social Media Inquiry Management | Staff → Social Inquiries | Capture, assign, status, response, close, booked-appointment conversion linkage |
| M17 | Unified Patient Messaging Management | Patient/Staff/Dentist → Messages | Identified patient conversation, routing context, reply history, resolved/closed state |
| M18 | Real-Time Patient Notification Management | Global Notification Center (P1/P2 target) | Operational notifications, delivery status, failed-delivery retry; separate from two-way Messages |
| M19 | Digital Prescription Management | Dentist → Prescriptions; Patient → Prescriptions | Medication/dosage/instructions, authorization, stored history, patient view |
| M20 | Treatment Follow-Up Scheduling Management | Dentist/Staff/Patient → Follow-Ups | Clinical follow-up requirement, date/interval, task, notification, Smart Scheduling reuse |
| M21 | Operational Reporting & Analytics Management | Owner/Admin → Analytics & Reports | Cross-process KPIs, branch filter, period control, branch aggregation, CSV export |
| M22 | Owner Executive Dashboard & Business Intelligence | Owner/Admin → Executive Dashboard | KPI summary, thresholds/exceptions, branch comparison, workload/HMO/revenue, drill-down |
| M23 | Integrated Workflow & Automation Control | Owner/Admin → Automation Monitor (P1 target) | Event/rule/action health, result/failure feed and central activity log; protected rule configuration |
| M24 | Referral & Loyalty Management **(PE)** | Patient → Referral & Loyalty; Staff/Owner → Engagement | Referral code, qualified activity, duplicate prevention, points, redemption request/process, history |
| M25 | Marketing, Reactivation & Patient Engagement Management **(PE)** | Staff/Owner → Engagement | Campaign/rule, target group, schedule, channel, response/feedback metrics, close/status view |

## Main role structure

### Patient
Dashboard, booking, appointments, queue/wait, messages/notifications, bills/receipts, prescriptions, follow-ups, referral/loyalty PE.

### Staff
Dashboard, appointments, check-in, patient queue, capacity/workload, patient records, billing, HMO, social inquiries, messages, follow-ups, engagement PE. In production, the exact pages are narrowed further by the staff member's sub-role and permissions.

### Dentist
Clinical dashboard, schedule, own queue, patient records, treatment, prescriptions, follow-ups, clinical/patient messages.

### Owner/Admin — Dr. Dana Roxas
Executive dashboard, branches, team/staffing, capacity/workload, analytics/reports, users/access, HMO oversight, automation control, engagement PE, module coverage.
