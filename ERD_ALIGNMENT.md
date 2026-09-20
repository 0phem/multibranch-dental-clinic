# ERD v2 ↔ Frontend P0 Alignment

The frontend P0 architecture is aligned to the approved **Multi-Branch Dental Clinic Operation System** ERD v2 and Module Documentation v1.1. Browser/localStorage state is still a prototype; the backend must persist the same relationships with server-side validation, transactions, security, and auditability.

## Identity and access

### PERSONS
`PERSONS` is the canonical identity/contact source. The frontend now keeps structured:
- first name;
- optional middle name;
- last name;
- email;
- phone;
- birth date;
- sex; and
- address.

`USERS`, `PATIENTS`, and `STAFF_PROFILES` link to the same person rather than independently storing another name/contact copy.

### USERS → STAFF_PROFILES / PATIENTS
- Owner/Admin creates the account in Module 1.
- A Dentist/Staff role automatically creates the linked operational profile used by Module 3.
- A Patient portal account can link/create the patient record.
- Account state (`Active/Inactive`) and operational availability (`Available/Unavailable`) are intentionally distinct.

## Clinic reference data

### BRANCHES / BRANCH_OPERATING_HOURS
Branch identity/status and operating hours feed scheduling and capacity rules.

### SERVICES / BRANCH_SERVICES
Service name, duration, fee, category, and status come from the service catalog. Branch-service assignments determine where a service may be booked.

### STAFF_SCHEDULES / DENTIST_SERVICE_ASSIGNMENTS
Dentist shift/availability and service capability feed Smart Scheduling. The UI should not hardcode provider eligibility independently from these records.

## Patient flow

### APPOINTMENTS
Appointments reference patient, branch, dentist, service, date/time, duration, and lifecycle state.

### CHECK_IN_RECORDS → QUEUE_ENTRIES
Check-In is the admission event. After the scheduled appointment/walk-in is validated and arrival is recorded, the queue entry is created automatically.

### DENTIST_QUEUES / QUEUE_ENTRIES / CAPACITY_EVENTS
Queue ordering and individual status are distinct from aggregate waiting-time/capacity monitoring. Emergency priority requires authorized action, a reason, and an audit trail in the backend.

## Clinical and billing

### TREATMENT_PLANS / TREATMENT_PROCEDURES
The Dentist remains the clinical decision-maker. Templates may reduce typing but must not make diagnosis, treatment, prescription, or follow-up decisions.

### PRESCRIPTIONS / PRESCRIPTION_ITEMS
Prescription content and authorization remain dentist-controlled.

### TREATMENT_FOLLOW_UPS
The Dentist creates the clinical follow-up requirement; scheduling remains a scheduling workflow.

### INVOICES / INVOICE_ITEMS / PAYMENTS
Normal billing begins from completed treatment/procedures. The system prepares the draft invoice from configured services/fees; Staff handles review/exceptions and payment posting. Electronic payment must be verified by the future backend/payment provider before the invoice is treated as paid.

## HMO

`PATIENT_HMO_POLICIES`, `HMO_REQUIREMENT_RULES`, `HMO_CASES`, `HMO_CASE_REQUIREMENTS`, `HMO_CLAIMS`, and `HMO_FOLLOW_UP_TASKS` separate:
- known patient/policy data;
- local completeness checks;
- provider submission/response; and
- overdue follow-up/escalation.

A locally complete case does **not** equal provider approval.

## Communication

### CONVERSATIONS / CONVERSATION_MESSAGES
Two-way patient/staff/dentist communication.

### PATIENT_NOTIFICATIONS
System-generated operational notifications. Module 18 is a cross-cutting event-driven service even when the final UI presents it through a global bell/Notification Center rather than a large standalone operations page.

## Workflow automation

`SYSTEM_EVENTS`, `WORKFLOW_RULES`, and `AUTOMATED_ACTIONS` support Module 23 orchestration. P0 logs/coordinates cross-module actions. The approved P1 UI direction is an **Automation Monitor**, not casual Owner toggling of safety-critical rules.

## Analytics

Modules 21 and 22 are read/reporting layers over operational records/events; they do not need duplicate transaction tables solely to store dashboard values.

## Frontend P0 mapping

| ERD concept | P0 frontend source/use |
|---|---|
| `PERSONS` | `state.persons`; identity hydration for patient/user/staff/dentist UI |
| `USERS` | account creation/status/RBAC prototype |
| `STAFF_PROFILES` | staff/dentist operational profile state |
| `SERVICES` | `state.services` canonical catalog |
| `BRANCH_SERVICES` | branch service configuration + booking validation |
| `DENTIST_SERVICE_ASSIGNMENTS` | provider capability validation |
| `APPOINTMENTS` | booking/reschedule/cancel state |
| `CHECK_IN_RECORDS` / `QUEUE_ENTRIES` | arrival + queue handoff concept |
| Treatment tables | Dentist treatment workflow and completion orchestration |
| Invoice/payment tables | treatment-driven draft invoice → issue → payment → receipt |
| HMO tables | state-driven verification/submission/follow-up/response concept |
| Notification tables | event-generated patient notifications |
| Workflow tables | rule/event/action activity state |

## Backend rule
The backend should implement these normalized relationships as authoritative server-side rules. Do not reintroduce duplicated identity fields or screen-specific copies of service fees, availability, payment state, HMO approval state, or clinical decisions.
