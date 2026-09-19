# ERD ↔ DentalOps Frontend Alignment

This note maps the current frontend prototype to the supplied master ERD. The frontend remains a mock/localStorage prototype, so its state is intentionally denormalized for demo speed; the backend implementation should persist these records using the ERD relationships.

## Changes applied in this revision

### USERS → STAFF_PROFILES
- **Owner/Admin creates accounts in `Users & Access` (Module 1).**
- The account form now includes the ERD `USERS` fields:
  - `branch_id`
  - `username` (unique)
  - `email` (unique)
  - `role_name`
  - `account_status`
- The prototype also keeps a **display/full name** for presentation. The current ERD has no field for this value, so the backend ERD should add a user/person name field or store it in a separate profile table.
- When the role is **Dentist** or a clinic **Staff** role, the frontend automatically creates/synchronizes the linked Module 3 personnel profile through `user_id`.
- `Active` is derived from the linked `USERS.account_status`.
- `Available` remains a separate operational scheduling status in Module 3.

### STAFF_PROFILES
The Module 3 screen now visibly uses:
- `user_id`
- `staff_type`
- `license_no`
- `specialization`

Operational fields still required by the documented modules are also shown:
- branch assignment
- shift start/end
- availability

Those operational fields are **not currently present in `STAFF_PROFILES` in the ERD** and should be added or normalized into staff assignment/schedule tables before backend implementation.

### BRANCHES
The Branch screen now visibly includes:
- `branch_name`
- `branch_code`
- `city`
- `branch_status`

The frontend also needs branch operating hours, services, contact information and capacity threshold. Those values are required by the documented scheduling/capacity modules but are not represented in the current ERD.

### PATIENTS
The frontend now includes an auto-generated `patient_code` and maps:
- `patient_code`
- `full_name`
- `contact_no`
- `birth_date`

The current UI also stores additional patient/clinical demographics used by the project; these are not all represented in the shown `PATIENTS` table.

### APPOINTMENTS / CHECK-IN / QUEUE
The frontend now carries ERD-style identifiers:
- appointment number (`appointment_no`)
- branch link (`branch_id`)
- combined scheduled start (`scheduled_start`)
- check-in identifier (`check_in_id` equivalent in the mock queue state)
- dentist queue identifier (`queue_id` equivalent)
- queue number
- current queue state

The frontend remains denormalized; the production backend should split these into `APPOINTMENTS`, `CHECK_IN_RECORDS`, `DENTIST_QUEUES`, and `QUEUE_ENTRIES` as shown in the ERD.

### WORKFLOW_RULES / SYSTEM_EVENTS / AUTOMATED_ACTIONS
Module 23 now visually distinguishes:
- the **Automation Rules** table as the input/reference logic (`WORKFLOW_RULES`)
- the **Central Automation Activity Feed** as the execution/history view corresponding to `SYSTEM_EVENTS` + `AUTOMATED_ACTIONS`

A new M1 → M3 automation rule was added:
> User account created / role updated → create or synchronize linked STAFF_PROFILES record.

## Existing ERD tables represented by the frontend

| ERD table | Main frontend area |
|---|---|
| `BRANCHES` | Owner/Admin → Branches |
| `USERS` | Owner/Admin → Users & Access |
| `STAFF_PROFILES` | Owner/Admin → Staff & Dentists |
| `AUDIT_LOGS` | Internal audit/log actions in prototype |
| `PATIENTS` | Staff/Dentist → Patient Records |
| `APPOINTMENTS` | Patient/Staff → Appointment Management |
| `CHECK_IN_RECORDS` | Staff → Check-In |
| `DENTIST_QUEUES` | Staff/Dentist → Patient Queue |
| `QUEUE_ENTRIES` | Patient/Staff/Dentist → Patient Queue |
| `TREATMENT_PLANS` | Dentist → Treatment |
| `TREATMENT_PROCEDURES` | Dentist → Treatment |
| `PRESCRIPTIONS` | Dentist/Patient → Prescriptions |
| `TREATMENT_FOLLOW_UPS` | Dentist/Staff/Patient → Follow-Ups |
| `INVOICES` | Staff/Patient → Billing |
| `INVOICE_ITEMS` | Billing line items |
| `PAYMENTS` | Staff → Payment posting |
| `HMO_PROVIDERS` | Staff/Owner → HMO |
| `PATIENT_HMO_POLICIES` | Patient HMO details |
| `HMO_CASES` | HMO Verification |
| `HMO_CLAIMS` | HMO Request/Approval |
| `HMO_FOLLOW_UP_TASKS` | HMO Follow-Up/Escalation |
| `WORKFLOW_RULES` | Owner/Admin → Automation Control (top table) |
| `SYSTEM_EVENTS` | Automation Control activity feed |
| `AUTOMATED_ACTIONS` | Automation Control execution results |
| `SOCIAL_INQUIRIES` | Staff → Social Inquiries |
| `CONVERSATIONS` | Patient/Staff/Dentist → Messages |
| `CONVERSATION_MESSAGES` | Message thread records |
| `PATIENT_NOTIFICATIONS` | Patient/Staff → Notifications |
| `LOYALTY_ACCOUNTS` | PE → Referral & Loyalty |

## ERD gaps to fix before backend implementation

Do **not** delete working UI features merely to force-fit the ERD. Several documented system requirements need fields/tables that the current ERD does not show. Recommended backend ERD additions include:

1. **User/person display name** for staff/dentist accounts.
2. **Staff schedule/assignment/availability** fields or separate tables for shifts, branch assignments and availability states.
3. **Branch operating hours, offered services and capacity threshold** used by Modules 2, 7, 10 and 15.
4. Additional **patient demographics/clinical fields** used by the Patient Records UI.
5. Appointment **service, duration and notes** if these are to persist.
6. Prescription **medication, dosage and instructions**; the current `PRESCRIPTIONS` table shown in the ERD only identifies the patient/procedure/dentist and issue time.
7. Notification **message content/channel/retry metadata** used by Module 18.
8. Social inquiry **topic, contact, assignment and timestamps** used by Module 16.
9. Referral/loyalty details such as **referral code and reward/redemption history** if Module 24 PE is retained.
10. A campaign/reactivation structure if Module 25 PE will be implemented; no campaign table is visible in the supplied ERD.

## Presentation-safe explanation

> “Our frontend is now aligned to the entities and relationships in the ERD. For example, the Owner/Admin creates the account in USERS, and if that account is a dentist or staff member, the system automatically creates or synchronizes the linked STAFF_PROFILES record. The frontend mock data is denormalized, but the backend will persist the same workflow using the normalized ERD tables.”
