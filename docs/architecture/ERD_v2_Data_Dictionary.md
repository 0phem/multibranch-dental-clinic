# DentalOps ERD v2 — Data Dictionary & Integrity Rules

**Purpose:** backend-ready logical data model aligned with Module Documentation v1.1.  
This is a logical ERD. Exact SQL types, indexes, security policies, file-storage implementation, and payment/HMO provider adapters will be finalized during backend implementation.

## Foundation / Access / Staff

| Table | Purpose | Key integrity rule |
|---|---|---|
| PERSONS | Single source of human identity/contact data | Do not duplicate first/middle/last/email/phone across Patient and Staff screens |
| USERS | Authentication/account state | One user maps to one PERSON; password storage is backend-only hashed data |
| ROLES | Role/subrole catalog | Role examples: PATIENT, DENTIST, OWNER_ADMIN, RECEPTIONIST, ASSISTANT, BILLING, HMO_COORDINATOR, ENGAGEMENT |
| USER_ROLE_ASSIGNMENTS | RBAC + optional branch scope | Permissions come from role and scope, not UI hiding alone |
| BRANCHES | Branch master | One canonical branch status/reference for all modules |
| BRANCH_OPERATING_HOURS | Per-day hours | Smart Scheduling rejects closed periods |
| SERVICES | Service catalog | Duration and fee must not remain hardcoded only in frontend |
| BRANCH_SERVICES | Which services a branch offers + optional overrides | Booking only offers valid branch-service combinations |
| STAFF_PROFILES | Operational dentist/staff profile | Created/synchronized from the account/person identity, not separately retyped |
| STAFF_SCHEDULES | Branch/date shift and availability state | Availability is based on assignment/shift/exception state |
| DENTIST_SERVICE_ASSIGNMENTS | Services a dentist may perform | M7 filters valid dentists by service capability |
| AUDIT_LOGS | Security/administrative audit | Emergency queue priority, access changes and sensitive manual overrides should be auditable |

## Patient / Appointment / Queue

| Table | Purpose | Key integrity rule |
|---|---|---|
| PATIENTS | Patient-specific profile linked to PERSONS | A patient may exist without a login; a registered login shares the same PERSON identity |
| APPOINTMENTS | Confirmed/planned visit | Past start times cannot be newly booked; status changes release/reserve slots |
| CHECK_IN_RECORDS | Arrival/admission event | Scheduled appointment or walk-in is admitted once before queue creation |
| DENTIST_QUEUES | Per-dentist, per-branch/day queue container | Dentist UI reads the logged-in dentist's queue directly |
| QUEUE_ENTRIES | Individual patient queue state | Priority override requires reason/audit; skip/no-show is Staff-controlled |
| CAPACITY_EVENTS | Aggregate waiting/workload snapshots/events | Does not replace QUEUE_ENTRIES; it supports M10/M15/M21 |

## Clinical / Billing

| Table | Purpose | Key integrity rule |
|---|---|---|
| PATIENT_DOCUMENTS | Generic patient-uploaded/visit/HMO document reference | File bytes belong in controlled storage; DB stores metadata/URI |
| CLINICAL_TEMPLATES | Structured documentation aid | Suggestions/templates never authorize diagnosis/treatment automatically |
| TREATMENT_PLANS | Clinical encounter/treatment record | Dentist identity and visit context are loaded from queue/schedule; dentist retains judgment |
| TREATMENT_PROCEDURES | Actual performed procedure line(s) | Completed procedure is the normal source of billing line items |
| PRESCRIPTIONS | Dentist-authorized prescription header/version | No prescription becomes valid without dentist authorization |
| PRESCRIPTION_ITEMS | Medication/dose/instructions | Linked to one prescription version |
| TREATMENT_FOLLOW_UPS | Clinical return-visit obligation | Created from dentist decision; scheduling creates/links the next appointment |
| INVOICES | Draft/open/paid/cancelled patient bill | Normal invoice is created from completed treatment, not recreated manually |
| INVOICE_ITEMS | Itemized charges | Prefer linkage to completed procedure/service |
| PAYMENTS | Cash/electronic payment + receipt metadata | Electronic provider status must be verified server-side before marking paid |

## HMO

| Table | Purpose | Key integrity rule |
|---|---|---|
| HMO_PROVIDERS | Provider master/integration metadata | Integration type may be NONE/API/WEBHOOK/etc.; do not assume all providers expose APIs |
| PATIENT_HMO_POLICIES | Patient membership/policy | Expired/inactive policies should not be treated as verified eligibility |
| HMO_REQUIREMENT_RULES | Provider/service requirement checklist | Drives automatic local completeness checks |
| HMO_CASES | Verification/request/provider response state | Provider remains approval authority |
| HMO_CASE_REQUIREMENTS | Per-case requirement status/document linkage | Missing requirement triggers notification/upload loop |
| HMO_CLAIMS | Claim/invoice linkage where applicable | Claim state is distinct from local case completeness |
| HMO_FOLLOW_UP_TASKS | Pending follow-up/escalation work | Escalation means unresolved/high-attention, not approved/rejected |

## Communication / Engagement

| Table | Purpose | Key integrity rule |
|---|---|---|
| SOCIAL_INQUIRIES | Pre-booking inquiry from social/web/chatbot channels | Can convert into a patient/appointment without losing source history |
| CONVERSATIONS | Identified human conversation thread | Separate from system notifications |
| CONVERSATION_MESSAGES | Individual human/staff message | Sender and delivery state are retained |
| PATIENT_NOTIFICATIONS | System-generated in-app/email event | Queue/payment/Rx/HMO/follow-up notifications are event-driven and retryable |
| LOYALTY_ACCOUNTS | PE points/tier balance | M24 remains optional and must not block core operations |
| REFERRALS | PE referral lifecycle | Qualified visit/reward must be applied only once |
| LOYALTY_TRANSACTIONS | PE points ledger | Balance should be derivable/auditable from ledger |
| CAMPAIGNS | PE outreach rule/campaign | Requires approved content/target rule; consent policy enforced in backend |
| CAMPAIGN_RECIPIENTS | Per-patient PE delivery/response | Prevent accidental duplicate outreach |
| PATIENT_FEEDBACK | PE feedback record | Optional; not a core clinical requirement |

## Automation / Analytics

| Table | Purpose | Key integrity rule |
|---|---|---|
| WORKFLOW_RULES | Protected approved orchestration rules | Core rules are system-admin configuration, not casual Owner toggles |
| SYSTEM_EVENTS | Immutable-style operational event stream/reference | Used by M18, M21 and M23 for notifications, analytics and orchestration |
| AUTOMATED_ACTIONS | Rule execution result | Must record success/failure; duplicate-trigger protection required |

**M21 Operational Analytics** and **M22 Owner Dashboard** are intentionally not separate transaction tables. They are reporting/read layers that calculate or materialize approved KPIs from operational tables/events. A backend may later add materialized KPI snapshots for performance without changing the business model.

## Cross-table constraints to enforce during backend work

1. USER_ROLE_ASSIGNMENTS must not grant branch access outside authorized scope.
2. A Staff/Dentist profile must reference the same PERSON used by its USER account.
3. Appointment must reference an active branch-service combination and a dentist authorized/available for that service/time.
4. Check-In must not create duplicate active queue entries for the same arrival.
5. Emergency priority changes require authorized user, reason and audit entry.
6. Treatment completion is required before normal invoice generation.
7. Prescription authorization is dentist-only.
8. Follow-up creation records a clinical requirement; actual appointment still passes M6/M7 scheduling validation.
9. HMO local completeness must never be represented as provider approval.
10. Electronic payment status must be confirmed by the payment provider/backend before invoice is marked paid.
11. System-generated notifications must link to an event and respect channel/privacy rules.
12. Workflow automation must be idempotent: the same event/rule pair must not create duplicate downstream records.
