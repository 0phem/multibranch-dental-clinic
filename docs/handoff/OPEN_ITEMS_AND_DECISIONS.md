# Open Items & Decisions: Multi-Branch Dental Clinic System

Summary of resolved clinic decisions, items requiring Owner/Dentist confirmation, and pending post-defense enhancements.

---

## 1. Resolved Clinic Decisions (Confirmed 2026-10-20)

| Decision | Source | Resolution in System |
| --- | --- | --- |
| **Accepted HMO List** | Clinic Staff (R2-16) & Team Check | The 6 accepted HMOs are **verified**: Avega, InLife iCare, Intellicare, eTiQa, Dental Network partnerships, AXA Health Plans. Displayed in FAQ and Clinic Assistant; LOA references recorded at billing counter. |
| **Branch 3 Address** | Clinic Confirmation | Address *"Unit 20 GD Plaza, Guiguinto, Bulacan"* is **confirmed correct as given**. ZIP warning removed; only branch email remains missing. |
| **Payment at Booking** | Clinic Decision (2026-10-20) | Patients pay the service fee via PayMongo online when booking. The old "no payment at booking" rule is superseded; payment is credited to visit invoice. |
| **Same Phone for Branches 1 & 2** | Clinic Staff (R2-14) | Confirmed: Branches 1 and 2 share `0922 878 7341`. |

---

## 2. Items Awaiting Owner (Dr. Dana) Sign-Off

*These items do not block the defense; reasonable, safe engineering defaults are currently active.*

| # | Item | Status / System Default | Action Needed from Owner |
| --- | --- | --- | --- |
| 1 | **Template Wording Approval** | Automations A1–A6 ship switched OFF until wording is approved in Owner dashboard. | Owner review and 1-click approve email wording templates. |
| 2 | **Dentists' Real Weekly Rosters** | Demo schedules active, labelled *"demo schedule, not confirmed by the clinic"*. | Submit each dentist's real days, hours, and branch rotations. |
| 3 | **Data Privacy Officer & Retention** | Proposal documented in [`DATA_RETENTION_PROPOSAL.md`](../defense/DATA_RETENTION_PROPOSAL.md). | Formally appoint clinic DPO; confirm retention periods for medical records. |
| 4 | **BIR Invoicing vs Receipts** | System issues branded "Payment Receipt" and "Invoice". | Accountant confirmation on whether BIR computerized accounting system (CAS) accreditation is required. |
| 5 | **Branch 3 Email** | Email field hidden on landing page; assistant answers none on file. | Provide branch 3 email if one is created. |
| 6 | **Additional Owner Accounts** | Single Owner account currently active. | Approve permissions for secondary branch managers if desired. |

---

## 3. Clinical Items Awaiting Dentist Sign-Off

| # | Item | Status / System Default | Action Needed from Dentists |
| --- | --- | --- | --- |
| 1 | **Assistant Care Advice (Answers 5–7)** | Currently set to *"No clinical advice given online; please book a consultation visit"*. | Dentists provide approved patient home-care wording for sensitivity and cleaning. |
| 2 | **Preventive Recall Intervals (A4)** | Set to default 6 months for general cleanings (automation OFF). | Dentists confirm standard recall intervals per service. |
| 3 | **Allergy Tracking Field** | Prescription screen displays mandatory banner: *"Verify patient allergies before prescribing"*. | Decide whether structured allergies belong in patient record schema. |

---

## 4. Post-Defense Engineering Roadmap

1. **Timezone Storage Alignment**: Standardize UTC database timestamps against Philippine Standard Time (PST/Manila, UTC+8) per [`docs/TIMEZONE_PLAN.md`](../TIMEZONE_PLAN.md).
2. **Retire Legacy `src/data.js`**: Transition remaining mock references into pure database-backed REST calls.
3. **SMS Notification Gateway**: Integrate Philippine SMS provider (Semaphore / Infobip) for SMS appointment reminders.
4. **Messenger Platform Integration**: Link Facebook Page inquiries directly into the Staff Inquiries worklist (M16).
5. **Phase 2 Modules**: M12 Treatment Plans, M24 Lab Cases tracking, and Inventory stock level alerts.
