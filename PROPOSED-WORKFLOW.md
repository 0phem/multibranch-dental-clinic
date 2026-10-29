# PROPOSED WORKFLOW & BUSINESS PROCESS AUTOMATION BLUEPRINT
## Web-Based Multi-Branch Dental Clinic Operation System

**Business Process Automation Project**  
**Client:** Dr. Dana Roxas, Clinic Owner  
**Prepared by:** Group 3 — BSIT 3B  
- Alejo, Hart Jaztin A. (Leader)
- Delos Santos, Joevan
- Ecal, Richmon
- Licanda, Celin
- Millar, John Yzhekiel

**Checked By:** Prof. Sam Espino, MIT  

---

## Academic reconciliation notice (2026-10-30)

Official paper numbering and ownership below are retained. TO-BE is the proposed target; each module now has a D.3 evidence qualification distinguishing integrated development, isolated feature branches and pending policy/production acceptance. Shared integration snapshot: `010a386f147bed285c58821a0a2cc800c393982e`; accepted A8 `179cfb4903f46648666d2dbdeb0b0d70b3829dd6` is not integrated. Manifests declare Laravel ^13.17 and React ^19.1.1, not historical Laravel 11/React 18. Neither historical future-tense workflows nor a UI test establish clinic policy. See [cross-document reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md).

## Executive Summary & System Scope

This document specifies the authoritative business process automation blueprint for the **Web-Based Multi-Branch Dental Clinic Operation System** for Dr. Dana E. Roxas Dental Clinic (spanning Bocaue Main, Bocaue Annex / Cardinal Dental Center, and Guiguinto branches). 

The system encompasses **25 modules** organized into five connected functional blocks aligned with the end-to-end patient and clinic operational journey. Each member of Group 3 is assigned exactly five connected modules. Modules marked **PE** represent Proposed Enhancements designed to provide advanced capabilities (such as automated loyalty ledgers and targeted patient reactivation) beyond standard baseline clinic requirements.

---

## Module Assignment Quick Reference

Each member owns an exact block of 5 connected modules (25 modules total) that follows the clinic and patient journey:

| No. | Module Name | Category / Lifecycle Stage | Assigned Member |
|:---:|:---|:---|:---|
| **1** | User Management | Foundation & RBAC | Licanda, Celin |
| **2** | Branch Management | Multi-Branch Operations | Licanda, Celin |
| **3** | Staff Management | Personnel & Scheduling | Licanda, Celin |
| **4** | Service Management | Pricing & Procedures | Licanda, Celin |
| **5** | Clinic Policy Management | Rules & Governance | Licanda, Celin |
| **6** | Appointment Management | Online Booking & Deposits | Alejo, Hart Jaztin A. |
| **7** | Attendance Management | Confirmations & No-Shows | Alejo, Hart Jaztin A. |
| **8** | Check-In Management | Reception & Identity | Alejo, Hart Jaztin A. |
| **9** | Queue Management | Live Patient Queues | Alejo, Hart Jaztin A. |
| **10** | Patient Flow Management | Chair Utilization & Load | Alejo, Hart Jaztin A. |
| **11** | Patient Records Management | Central EHR & History | Ecal, Richmon |
| **12** | Document Management | Consents & Digital Forms | Ecal, Richmon |
| **13** | Treatment Management | Clinical Charting & Notes | Ecal, Richmon |
| **14** | Prescription Management | Digital Rx & PDFs | Ecal, Richmon |
| **15** | Follow-Up Management | Recalls & Post-Care | Ecal, Richmon |
| **16** | Social Media Management | Inquiries & Channels | Millar, John Yzhekiel |
| **17** | AI Chatbot Management | Knowledge & Triage | Millar, John Yzhekiel |
| **18** | Messaging Management | Direct Patient-Clinic Chat | Millar, John Yzhekiel |
| **19** | Notification Management | Automated Outbox & Alerts | Millar, John Yzhekiel |
| **20** | Marketing Management (PE) | Reactivation Campaigns | Millar, John Yzhekiel |
| **21** | Billing Management | Invoicing & PayMongo | Delos Santos, Joevan |
| **22** | Loyalty Management (PE) | Referral & Points Ledger | Delos Santos, Joevan |
| **23** | Archives & Historical Records | Append-Only Retrieval | Delos Santos, Joevan |
| **24** | Analytics Management | Executive Intelligence & KPIs | Delos Santos, Joevan |
| **25** | Audit Management | Forensic Integrity & RA 10173 | Delos Santos, Joevan |

---

## Complete 25-Module Process Specifications

```
  ┌────────────────────────────────────────────────────────────────────────┐
  │                           SYSTEM WORKFLOW                              │
  └────────────────────────────────────────────────────────────────────────┘
   BLOCK 1: Foundation (M1-M5) ───────► BLOCK 2: Flow & Scheduling (M6-M10)
                                                    │
                                                    ▼
   BLOCK 4: Engagement (M16-M20) ◄───── BLOCK 3: Clinical Care (M11-M15)
               │
               ▼
   BLOCK 5: Financials, Compliance & Analytics (M21-M25)
```

---

### Module 1: User Management
**Module Owner:** Licanda, Celin

#### A. Module Description
The User Management Module controls who can use the system and what each person can see and do for the Owner, Staff, Dentists, and Patients across all three branches. It creates and maintains accounts, verifies each person's email with a one-time code, assigns one of four roles and the branches a user may work in, signs users in securely, and records every access and account change. Patients register themselves with an emailed code; an employee account is approved by the Owner and the invitation is sent by email. Permissions are enforced by the server, never by hiding buttons.

#### B. Input
- **AS-IS Input:**
  - Patient details recorded by the staff at booking or at the counter
  - Patient questions sent through Facebook or Messenger
  - The staff and dentist list of the clinic
- **TO-BE Input:**
  - Patient sign-up details and privacy consent
  - Email verification code
  - Employee invitation (name, email, role, branches)
  - Login credentials
  - Password reset and email change requests
  - Account status decision (suspend, restore, remove)

#### C. Technology Used
- **AS-IS Technologies:**
  - Clinic's existing centralized software
  - Digital forms from booking to payment
  - Facebook and Messenger for patient questions
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Laravel Sanctum authentication with role-based access control
  - Email service for verification, invitation, reset, and change codes
  - Server-side permission checks on every request
  - Rate limiting and an audit trail of access and account changes

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. Patient records and treatment history are kept in the clinic's existing digital software.
  2. The software is centralized, which the clinic values because it has three branches.
  3. The receptionist handles booking, check-in, billing, and follow-up, and the dentist handles treatment with the assistant.
  4. A new patient is registered at the counter by the staff.
  5. Patients send online questions through Facebook or Messenger, and the clinic Owner answers them.
- **Outputs:**
  - Patient record in the existing software
  - Appointment, check-in, billing, and follow-up handled by the receptionist
  - Patient questions answered by the Owner through Facebook or Messenger
- *Pending confirmation:* How employee accounts have been created and shared in the clinic so far.

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. A patient signs up and gives privacy consent; the system emails a one-time verification code.
  2. The patient enters the code; the system checks that the code matches the account and has not expired, and only a verified account can sign in.
  3. The Owner approves the account and invites the employee by email, with one of four roles (Owner, Staff, Dentist, or Patient) and the branches the employee may work in.
  4. The system authenticates the user and creates a secure session.
  5. The system saves the account with its role and branch scope, and checks the role and branch permissions on the server for every request.
  6. A user resets the password or changes the email through an emailed code; a patient first registered at the counter claims the same record instead of creating a duplicate.
  7. The Owner suspends, restores, or soft-deletes an account, and the system records every access and account change.
- **Outputs:**
  - Verified user account
  - Authenticated session
  - Role and branch permissions
  - Account status record
  - Access and account change history

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A1/Wave 1):** Patient-only Gemini authorization revalidates the authenticated account and linked Patient profile for JSON/SSE requests.
- **Current implementation / acceptance boundary:** Integrated development; persisted synthetic authorization checks passed. Live provider governance remains pending.
- **Evidence:** [A1/Wave 1 / QA traceability](docs/INTEGRATION_WAVE_20261029.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 2: Branch Management
**Module Owner:** Licanda, Celin

#### A. Module Description
The Branch Management Module maintains each branch's profile, location, contact details, opening hours, and closed dates so that every module uses the same branch information. The Owner registers and updates the clinic's three branches (two in Bocaue and one in Guiguinto), their addresses, map positions, phone numbers, emails, weekly opening hours, and dated closures or holidays. Booking, reminders, the public website, and reports all read this information, so a change is made once and appears everywhere. When a date is closed, the system shows the appointments affected and sends those patients a reschedule link.

#### B. Input
- **AS-IS Input:**
  - The three branches: two in Bocaue and one in Guiguinto
  - The same opening hours for all three branches
  - Opening hours that differ by day
  - Closed dates and holidays decided by the Owner
- **TO-BE Input:**
  - Branch name, address, and contact details
  - Map location
  - Weekly opening hours for each day
  - Closed dates, holidays, and reasons
  - Branch active status
  - Decision on the affected appointments

#### C. Technology Used
- **AS-IS Technologies:**
  - Clinic's existing centralized software
  - Branch information kept by each branch
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database shared by all three branches
  - Reschedule link for appointments affected by a closure
  - Public branch pages on the clinic website
  - Map position for distance and branch display

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The clinic runs three branches: two in Bocaue and one in Guiguinto.
  2. Each branch keeps its own information.
  3. All three branches keep the same opening hours, and the hours differ by day: Monday to Friday 8:00 AM to 8:00 PM, Saturday 8:00 AM to 5:00 PM, and Sunday closed.
  4. The Owner decides when a branch closes for a holiday or another reason.
  5. Patients learn about a closure late.
- **Outputs:**
  - Branch information kept per branch
  - Weekly hours per day, the same in all branches
  - Closure decided by the Owner, announced to patients late

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The Owner registers a branch with its name, address, phone, email, and map position.
  2. The Owner sets the opening hours for each day of the week.
  3. The Owner records a closed date or holiday with a reason.
  4. The system applies the closed date to booking, so a closed day cannot be booked.
  5. The system shows the appointments affected by the closure and sends those patients a reschedule link.
  6. The system publishes the branch information to booking, the public website, and reports, so it is entered once and used everywhere.
  7. The Owner activates or deactivates a branch.
- **Outputs:**
  - Branch profile
  - Weekly opening hours
  - Closed date and holiday calendar
  - Affected appointment list
  - Public branch information
- *Pending confirmation:* The email address of the Guiguinto branch.

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A3):** Owner selects a nonduplicate branch code, edits existing contact details, moves the map pin and explicitly publishes coordinates/hours. Weekday Open/Closed remains separate from operational branch status; service tiles adapt to desktop/phone.
- **Current implementation / acceptance boundary:** Integrated development; synthetic PostgreSQL and rendered acceptance. Update-only scope, not a new branch-registration API; live map tiles and missing Guiguinto email remain outside acceptance.
- **Evidence:** [A3 / QA traceability](docs/OWNER_BRANCH_A3_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 3: Staff Management
**Module Owner:** Licanda, Celin

#### A. Module Description
The Staff Management Module manages the clinic's dentists and staff: their profiles, credentials, branch assignments, weekly work schedules, and leave, so booking only offers times when someone is actually working. The Owner maintains the profiles of the 12 dentists and 7 staff, the services each dentist performs, weekly schedules per branch and day inside branch opening hours, one-off schedule exceptions, and leave requests with approval. The Owner decides each dentist's work schedule, and the branch setup for dentists and staff changes rather than staying fixed. Approved schedules and leave feed booking and the staff calendar, and a schedule change or approved leave shows the booked appointments affected, with suggested cover.

#### B. Input
- **AS-IS Input:**
  - The clinic's 12 dentists and 7 staff
  - The work schedule of each dentist, decided by the clinic Owner
  - Branch assignments that change, with no fixed setup
  - Leave taken by dentists and staff
- **TO-BE Input:**
  - Staff and dentist profile
  - Professional credential details such as the license number
  - Branch assignment
  - Services each dentist performs
  - Weekly schedule and exceptions
  - Leave request

#### C. Technology Used
- **AS-IS Technologies:**
  - Informal tracking of schedules and leave
  - Clinic's existing centralized software
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Role-based access control (Laravel Sanctum)
  - Reschedule link for appointments affected by leave
  - Booking calendar that reads approved schedules and leave

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The clinic has 12 dentists and 7 staff.
  2. The clinic Owner decides each dentist's work schedule.
  3. There is no fixed branch setup for dentists and staff; it changes.
  4. The clinic aims for at least two dentists per day per branch, but there is no fixed number.
  5. Schedules and leave are tracked informally, so a patient can be booked when a dentist is away.
  6. When a patient arrives, an available dentist sees the patient.
- **Outputs:**
  - Work schedule decided by the Owner
  - Schedules and leave tracked informally
  - Booking that may fall on a day the dentist is away
- *Pending confirmation:* How leave is reported and recorded in the clinic today.

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The Owner creates or updates a staff or dentist profile.
  2. The Owner records the credentials and specializations of each dentist.
  3. The Owner assigns dentists and staff to branches and records the services each dentist performs.
  4. The Owner sets the weekly schedule inside the branch opening hours.
  5. The Owner records a schedule exception, such as a day off.
  6. A dentist or staff member requests leave, and the Owner approves or declines it.
  7. The system blocks a booking outside the dentist's weekly schedule or approved leave.
  8. The system shows the booked appointments affected by a schedule change or leave, with suggested cover.
  9. The system publishes the availability to booking and the staff calendar.
- **Outputs:**
  - Staff and dentist profiles
  - Dentist service eligibility
  - Weekly work schedules
  - Approved leave and exceptions
  - Affected appointment list with suggested cover
  - Availability used by booking
- *Pending confirmation:* Each dentist's real weekly hours; the demo schedules are labelled as not confirmed.

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (B3/B5):** Partial-day leave uses a single date and explicit hours; Owner approval/decline remains authorized. Staff Operations receives branch-scoped server duty facts distinguishing on-duty-today from working-now, including breaks, closures, exceptions and approved leave.
- **Current implementation / acceptance boundary:** Implemented on feature branches, not integrated. B3 also removes the denied requester self-approval attempt. B5 fallback profile hours are estimated; real rosters and leave entitlement policy remain pending.
- **Evidence:** [B3/B5 / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 4: Service Management
**Module Owner:** Licanda, Celin

#### A. Module Description
The Service Management Module maintains the catalog of services and procedures, their durations, and their prices, which booking and billing use. The Owner defines each service, how long it takes, which branches offer it, whether patients can book it directly or must start with a consultation, and its price with an effective date. A price change creates a new version, so a past invoice keeps the price that was valid on the treatment date.

#### B. Input
- **AS-IS Input:**
  - The services offered: general dentistry, orthodontics, oral surgery, and radiographic imaging
  - The price of each common procedure
  - Treatments that must start with a consultation, such as braces
- **TO-BE Input:**
  - Service or procedure definition
  - Duration
  - Price and effective date
  - Branches offering the service
  - Booking rule (bookable, consultation first, not shown online)

#### C. Technology Used
- **AS-IS Technologies:**
  - Clinic's existing centralized software
  - Digital forms from booking to payment
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Dated price versions read by booking and billing
  - Approved catalog published to booking and billing

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The clinic offers general dentistry, orthodontics, oral surgery, and radiographic imaging.
  2. Common procedures are priced; cleaning is ₱1,000 to ₱1,500, filling is ₱800 to ₱2,000, and extraction is ₱10,000 to ₱15,000.
  3. Prices change over time.
  4. Some treatments, such as braces, must start with a consultation.
- **Outputs:**
  - Price for each procedure
  - Consultation-first requirement for braces

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The Owner creates a service or procedure.
  2. The Owner sets its duration for scheduling.
  3. The Owner assigns the service to the branches that offer it.
  4. The Owner sets the online booking rule, including consultation-first services such as braces and extractions.
  5. The Owner creates a dated price version, so a past invoice keeps the price that was valid on the treatment date.
  6. The system uses the price valid on the treatment date, so an invoice never uses an outdated price.
  7. The Owner activates or deactivates the service.
  8. The system publishes the approved catalog to booking and billing.
- **Outputs:**
  - Service catalog
  - Durations used by scheduling
  - Branch service availability
  - Dated price history
  - Booking rules

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (Baseline retained):** No A1-A8 or B3-B5 change to service pricing or eligibility policy is established.
- **Current implementation / acceptance boundary:** Existing Partial classification retained; final clinic prices remain pending.
- **Evidence:** [Baseline retained / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 5: Clinic Policy Management
**Module Owner:** Licanda, Celin

#### A. Module Description
The Clinic Policy Management Module holds the clinic's operating rules in one place so they are set by the Owner, not hard-coded: the cancellation and late-arrival policy, reminder timing, message wording, data retention, and branding. Each setting has a safe default, an allowed range, an effective date, and a change history. Automated messages are sent only after the Owner approves their wording, and health-related messages also need a dentist's approval. Every module reads the active values, and every change is recorded in the audit trail.

#### B. Input
- **AS-IS Input:**
  - The cancellation window
  - The late-arrival handling used for each patient
  - The reminder sent before each appointment
- **TO-BE Input:**
  - Policy values: cancellation window, late-arrival limits, reminder timing
  - Message templates and their approval
  - Branding: clinic name, logo, colors
  - Optional branch scope and effective date

#### C. Technology Used
- **AS-IS Technologies:**
  - Rules applied by the staff from memory
  - Clinic's existing centralized software
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Owner approval of message wording, with dentist approval for health-related wording
  - Audit trail of every policy change

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The clinic has applied its rules from memory.
  2. A cancellation window of 24 hours and a reminder about 60 minutes before the appointment are the rules the clinic has used.
  3. The clinic reminds patients about every appointment.
  4. Whether a late patient can still be seen depends on the situation, not on a fixed late-arrival limit.
- **Outputs:**
  - Rules applied by the staff from memory
  - Reminder for every appointment
  - Late-arrival decision made case by case
- *Pending confirmation:* Which of these rules are written down and kept by the clinic today.

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The Settings page shows each setting with its safe default and allowed range.
  2. The Owner changes a value, and the system validates and saves it.
  3. The system rejects a value outside the allowed range.
  4. The Owner applies the change to one branch or to all branches from an effective date.
  5. The Owner approves the wording of each automated message before it can be switched on.
  6. Health-related wording also requires a dentist's approval.
  7. The system keeps the full history of changes and records each one in the audit trail.
  8. The system makes the active values available to every module, so reminders, late-arrival handling, cancellation, and branding follow the current policy.
- **Outputs:**
  - Active clinic policies
  - Approved message templates
  - Branding settings
  - Policy change history
- *Pending confirmation:* The Owner's approval of the recommended defaults and the retention periods.
- *Basis:* BPA Module 5 Activities and Outputs; implementation status as of October 20, 2026.

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A6):** Dentist reviews read-only health-related wording and formatted preview, then explicitly approves the current revision; error/retry and approval status remain visible.
- **Current implementation / acceptance boundary:** Integrated development UI acceptance; no automated clinical approval or newly approved clinic policy.
- **Evidence:** [A6 / QA traceability](docs/DENTIST_UI_A6_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 6: Appointment Management
**Module Owner:** Alejo, Hart Jaztin A.

#### A. Module Description
The Appointment Management Module lets patients and staff book, pay for, reschedule, and cancel appointments only into times that are truly available. The system checks branch hours and closures, the dentist's schedule and leave, the service duration, and existing bookings. It holds the selected slot while the patient pays the appointment fee online through PayMongo (test mode), then confirms the appointment and sends a confirmation email, a receipt, and a calendar file. It also offers a waitlist when a day is full.

#### B. Input
- **AS-IS Input:**
  - Patient information (from walk-in, phone, SMS, or Messenger)
  - Chief complaint
  - Patient photo (walk-in only; not available through SMS or Messenger)
  - Available time
  - Dentist schedule
- **TO-BE Input:**
  - Patient account and record
  - Requested service and its duration
  - Preferred branch or patient location (location is not stored)
  - Preferred dentist or any available dentist
  - Date and time
  - Branch hours and closed dates
  - Dentist schedules and leave
  - Cancellation, refund, and booking policy
  - Online payment confirmation from PayMongo

#### C. Technology Used
- **AS-IS Technologies:**
  - Walk-in counter, phone, SMS, and Messenger
  - Clinic's existing centralized software with an appointment calendar
  - Patient photo taken by staff for walk-ins (capture device not specified)
  - Manual checking of available time and dentist schedule
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database with database-level double-booking prevention
  - Laravel Sanctum authentication
  - PayMongo Checkout Sessions (GCash or card, test mode) and verified payment webhook
  - Email notification service (Laravel Mail)
  - PDF receipt and calendar file generation

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The patient requests an appointment by walking in, or by phone, SMS, or Messenger.
  2. The receptionist collects the patient's information and chief complaint.
  3. For a walk-in patient, the receptionist takes the patient's photo. Photos cannot be attached through SMS or Messenger.
  4. The receptionist manually checks the available time and the dentist's schedule. Scheduling conflicts are the most common mistake reported by the clinic.
  5. The receptionist enters the patient information (and photo, for walk-ins) into the clinic's existing system and creates the appointment.
  6. The staff view the appointment on the calendar of the existing system.
- **Outputs:**
  - Appointment created in the existing system
  - Patient information and photo (walk-in only) recorded
  - Appointment shown on the staff calendar

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The patient (or the staff on the patient's behalf) selects a service. Only services the patient may book directly are shown; consultation-first services such as braces and extractions are directed to a consultation booking.
  2. The system lists the branches that offer the service, ranked by distance when the patient allows location, and the user chooses a branch.
  3. The user chooses a preferred dentist or any available dentist.
  4. The system shows a calendar in which closed days and full days are disabled, based on branch hours, closed dates, dentist schedules, and leave. If a day is full, the patient may join the waitlist.
  5. The system offers only the free times that fit the service duration, and the user selects a date and time.
  6. The system validates the selection and prevents double booking at the database level.
  7. The system holds the slot for 15 minutes and sends the user to PayMongo Checkout to pay the appointment fee (the consultation fee for consultation-first services) using GCash or card.
  8. PayMongo sends a payment notice to the system's webhook. The system verifies the notice and only then confirms the appointment and records the payment.
  9. The system sends a confirmation email with the receipt and a calendar file to the patient.
  10. If payment is not completed within 15 minutes, the system releases the slot.
  11. The patient or staff may reschedule or cancel the appointment. The system applies the cancellation and refund policy and updates availability.
  12. The system records the appointment history.
- **Outputs:**
  - Paid and confirmed appointment
  - Booking payment receipt
  - Confirmation email and calendar file
  - Rescheduled or cancelled appointment
  - Waitlist entry
  - Appointment history

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A7/A8/B4):** Dentist schedule shows the full Manila date with grouped Previous/Today/Next/calendar/Refresh and responsive time hierarchy. Staff appointment rows can open the exact accessible Patient record; Patient records can open the existing booking form with only authoritative Patient identity prefilled.
- **Current implementation / acceptance boundary:** A7 integrated; A8 accepted on feature branch, not integrated. B4 calendar polish is isolated; Patient profile-photo contract remains missing. No service/Dentist auto-selection, availability bypass or automatic booking; explicit confirmation remains.
- **Evidence:** [A7/A8/B4 / QA traceability](docs/GEN09_A8_STAFF_WORKFLOW_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 7: Attendance Management
**Module Owner:** Alejo, Hart Jaztin A.

#### A. Module Description
The Attendance Management Module reduces no-shows and empty chairs by confirming attendance before each visit and handling late arrivals consistently. Patients receive a reminder with buttons to confirm or cancel. A cancellation frees the slot immediately. If the patient has not arrived, the system follows the clinic's late-arrival rule (a check at 5 minutes, a late flag at 10 minutes, and release of the slot at 15 minutes), and the front desk can undo the release. Late cancellations and no-shows are recorded.

#### B. Input
- **AS-IS Input:**
  - Scheduled appointment
  - Staff reminder calls to patients
  - Patient's arrival or non-arrival
  - Staff judgment on late patients
- **TO-BE Input:**
  - Upcoming appointment
  - Reminder timing and late-arrival rules
  - Patient response (confirm or cancel)
  - Arrival status from check-in
  - Front-desk decision to keep or release a late patient

#### C. Technology Used
- **AS-IS Technologies:**
  - Telephone (manual reminder calls by staff)
  - Staff judgment and manual handling of late patients
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Email notification service with approved wording and retries
  - Automated timed checks for late arrivals
  - Clinic Policy settings for reminder timing and late-arrival rules

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The staff remind patients of their appointments manually, because there is no automatic reminder.
  2. The patient may cancel, arrive late, or not come at all.
  3. When a patient cancels, the hour often stays empty.
  4. When a patient arrives late, the staff move the patient to the end of the queue or reschedule the patient, based on judgment.
  5. No-shows and late cancellations are not consistently recorded.
- **Outputs:**
  - Manual reminder calls
  - Staff decision on a late patient (move to end of queue or reschedule)

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. Before each appointment, the system sends a reminder email with buttons to confirm or cancel (default 60 minutes before, set in Clinic Policy).
  2. The patient clicks a button, and the system records the response.
  3. If the patient cancels, the system frees the slot immediately.
  4. If the patient has not arrived 5 minutes after the appointment time, the system asks the patient whether they are on the way.
  5. At 10 minutes, the system flags the patient as late.
  6. At 15 minutes, the system releases the slot and sends the patient a rebook link, unless the front desk keeps the patient.
  7. The front desk can undo a release and keep the patient.
  8. The system records the final attendance status, including no-shows and late cancellations.
  9. For patients with repeated no-shows, the system requires front-desk confirmation.
  10. The system updates the front-desk worklist.
- **Outputs:**
  - Attendance status (confirmed, cancelled, late, no-show)
  - Freed appointment slot
  - Rebook invitation
  - No-show and late-cancellation record
  - Front-desk worklist

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (Baseline retained):** No A1-A8 or B3-B5 change to attendance thresholds or cancellation policy is accepted.
- **Current implementation / acceptance boundary:** Historical timing defaults remain subject to the existing clinic-policy approvals; no new AS-IS claim.
- **Evidence:** [Baseline retained / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 8: Check-In Management
**Module Owner:** Alejo, Hart Jaztin A.

#### A. Module Description
The Check-In Management Module records each patient's arrival, whether booked or walk-in, and starts the visit without retyping paper forms. Booked patients are checked in by the front desk. New and walk-in patients register on their own phone by scanning the branch's counter QR code and entering the daily branch code, and may scan an ID on their device to fill in their details. The front desk verifies the ID in person, confirms the service and dentist, and the patient joins the dentist's queue.

#### B. Input
- **AS-IS Input:**
  - Patient information collected by the staff
  - Patient photo (walk-in)
  - Dentist assignment by the staff
- **TO-BE Input:**
  - Appointment, if booked
  - Self-registration details and privacy consent
  - ID details read on the patient's phone (the image is not stored)
  - Daily branch code shown at the counter
  - Service and dentist selection by the receptionist

#### C. Technology Used
- **AS-IS Technologies:**
  - Clinic's existing centralized software
  - Patient photo taken by staff (capture device not specified)
  - Patient lounge
- **TO-BE Technologies:**
  - Web application (React, Vite) on the patient's phone and front-desk screen
  - Counter QR code with a daily branch code
  - On-device ID scanning (the image is not stored)
  - Backend application (Laravel, PHP)
  - Shared PostgreSQL database for all branches
  - Cross-branch duplicate detection

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The patient enters the branch.
  2. For a walk-in patient, the receptionist collects the patient's information and takes the patient's photo.
  3. The receptionist enters the information and photo into the existing system and creates an appointment.
  4. The patient is assigned to a dentist at the patient lounge.
- **Outputs:**
  - Patient record with photo in the existing system
  - Appointment created for the walk-in patient
  - Dentist assignment

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. A booked patient is checked in by the front desk from the appointment. A new or walk-in patient scans the branch's counter QR code on their phone.
  2. The patient enters the daily branch code shown at the counter.
  3. The patient enters registration details and gives privacy consent. The patient may scan an ID on their own device to prefill the details; the ID image is not stored.
  4. The system validates the details and checks for an existing patient record across all branches before creating a new one.
  5. The registration appears on the front desk screen.
  6. The front desk verifies the patient's ID in person.
  7. The front desk confirms the service and the dentist.
  8. The system records the arrival time and starts the visit.
  9. The system adds the patient to the dentist's queue.
- **Outputs:**
  - Checked-in visit
  - New or matched patient record
  - Verified identity record
  - Queue entry
  - Arrival time

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (B1/B2/B6):** Supported Other ID values persist after validation. Walk-in search uses one keyboard-accessible combobox, exact directory identity, clear/empty handling and a single visible Refresh.
- **Current implementation / acceptance boundary:** B1/B2 integrated, supported intake/combobox scope only. B2 admission returned off-shift 422; B6 now reports isolated guarded API success and separate rendered fixture acceptance, not live browser-to-server or integrated acceptance. STF-11 auto-confirm/ID/cancel reasons and STF-13 unified find/create require reviewed policy. Historical kiosk descriptions are not reaccepted by A9.
- **Evidence:** [B1/B2/B6 / QA traceability](docs/INTEGRATION_WAVE_20261029.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 9: Queue Management
**Module Owner:** Alejo, Hart Jaztin A.

#### A. Module Description
The Queue Management Module keeps a fair and visible order of waiting patients for each dentist. Each checked-in patient receives a queue number for the dentist and the day. Staff move patients through the queue, a late patient goes to the end of the queue following the clinic's rule, dentists see their own queue, and patients see their own position. Priority changes require an authorized user and a reason, and the queue history is kept.

#### B. Input
- **AS-IS Input:**
  - Order in which patients arrive
  - Late-arrival status, decided by staff judgment
- **TO-BE Input:**
  - Checked-in visit
  - Assigned dentist and service
  - Arrival time and late status
  - Priority reason, when allowed

#### C. Technology Used
- **AS-IS Technologies:**
  - Manual waiting list kept by the staff
  - Staff judgment for late patients
- **TO-BE Technologies:**
  - Web application (React, Vite) with staff, dentist, and patient views
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Role-based access control (Laravel Sanctum)

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. After the patient is assigned to a dentist at the patient lounge, the staff keep the waiting order manually.
  2. Patients wait for their turn in the recorded order. Long queues are the clinic's most reported cause of delay and complaint.
  3. When a patient arrives late, the order is disrupted, and the staff move the patient to the end of the queue or reschedule the patient by judgment.
- **Outputs:**
  - Manual waiting order

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. After check-in, the system creates a queue entry with a daily queue number for the patient's dentist.
  2. The system shows the current order to the staff and the dentist.
  3. The staff call the next patient, and the status changes from Waiting to Called. The staff may also mark a patient as ready or away.
  4. When the dentist starts the procedure, the status changes to In Treatment, and when finished, to Done.
  5. If a patient is late, the system places the patient at the end of the queue.
  6. An authorized user may change a patient's priority and must enter a reason, which the system records.
  7. The patient can view their own position and status.
  8. The system keeps the queue history.
- **Outputs:**
  - Live queue per dentist
  - Patient position and status
  - Queue history
  - Priority change record

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (B4):** Queue row click/Enter/Space opens exact encounter context. Call uses the existing server command with stale-revision feedback; Message resolves an existing authorized thread by public Patient and branch IDs.
- **Current implementation / acceptance boundary:** Implemented on feature branch, not integrated. Five historical full QueueTest failures remain reported; scoped passing tests do not clear them. No new conversation-start or clinical authority.
- **Evidence:** [B4 / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 10: Patient Flow Management
**Module Owner:** Alejo, Hart Jaztin A.

#### A. Module Description
The Patient Flow Management Module helps the clinic use chair time fully. Staff and the Owner see a calendar that shows how full each day is per branch and dentist, with crowded days highlighted. When a slot is freed, the system offers it first to patients booked later the same day and then notifies waitlisted patients whose requested time matches. The front desk can see free time for walk-in patients. Nobody is moved without accepting the offer.

#### B. Input
- **AS-IS Input:**
  - Appointment bookings in the clinic's current system
  - Cancellations
  - Staff experience of busy days (weekends are usually busier)
- **TO-BE Input:**
  - Appointments
  - Dentist schedules and leave
  - Freed slots from cancellations and released appointments
  - Waitlist entries
  - Live queues

#### C. Technology Used
- **AS-IS Technologies:**
  - Calendar in the clinic's current system showing how full each day is
  - Staff experience and judgment
- **TO-BE Technologies:**
  - Web application (React, Vite) with the staff calendar
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Email notification service for move-up and waitlist offers

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The staff view the calendar in the clinic's current system to see the appointments for each day.
  2. Busy days, such as weekends (especially October to February), are known mainly by experience.
  3. When a patient cancels, the slot often stays empty, sometimes for an hour, because there is no automatic way to offer it to others.
- **Outputs:**
  - Calendar view of daily load
  - Cancelled slot left empty

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The system reads the appointments, dentist schedules, and leave.
  2. The system calculates how full each day is per branch and dentist.
  3. The staff calendar shows the daily load and highlights crowded days.
  4. When a slot is freed, the system offers an earlier time first to patients booked later the same day.
  5. If the offer is not taken, the system notifies waitlisted patients whose requested time matches.
  6. A patient is moved only after accepting the offer.
  7. The front desk views the free time available for walk-in patients.
- **Outputs:**
  - Staff calendar with daily load and crowded days
  - Move-up offers and waitlist notices
  - Free time visible for walk-in patients

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (B4):** Calendar spacing, focus and selection use existing design tokens; previews show at most three badges and a +N control.
- **Current implementation / acceptance boundary:** Implemented on feature branch, not integrated. Initials do not satisfy the requested Patient profile-photo requirement; no new capacity or wait-estimate policy.
- **Evidence:** [B4 / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 11: Patient Records Management
**Module Owner:** Ecal, Richmon

#### A. Module Description
The Patient Records Management Module keeps one complete, secure record for each patient that every branch can use. The system finds or creates the patient's record, detects possible duplicates across branches, and maintains contact details, allergies, medical alerts, and medical and dental history. It links guardians for minors and connects visits, treatments, prescriptions, invoices, and documents to the record. When care moves to another branch or dentist, a handover passes the needed information with limited, expiring access. Every change is recorded in the audit trail.

#### B. Input
- **AS-IS Input:**
  - Patient identity and contact details, kept in each branch's own database
  - Patient data retyped by staff when a patient moves to another branch
  - *Pending confirmation:* The full list of patient information recorded today
- **TO-BE Input:**
  - Patient identity and contact details (from the patient or staff)
  - Medical and dental history, allergies, and alerts (from the patient or dentist)
  - Guardian details for minors
  - Field corrections by staff or dentist
  - Handover note when care moves to another branch or dentist

#### C. Technology Used
- **AS-IS Technologies:**
  - Each branch's separate database (software name pending confirmation)
  - Manual retyping of patient data when a patient changes branch
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Shared patient record used by all branches
  - Cross-branch duplicate detection
  - Handover with limited, expiring access
  - Audit trail (Audit Management)

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. Each branch keeps its own separate database of patient records.
  2. When a patient goes to another branch, the patient registers again or the staff retype the patient's data.
- **Outputs:**
  - Separate patient record in each branch's database
  - Re-registered or retyped patient data at the new branch
- *Pending confirmation:* Who updates records today, how records are searched, and how information is passed between dentists (clinic interview).

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. Staff create or find the patient's record in the shared system.
  2. The system detects possible duplicates across branches before a new record is created.
  3. Staff and dentists maintain contact details, allergies, alerts, and medical and dental history.
  4. The system links guardians and dependents for minors.
  5. The system links visits, treatments, prescriptions, invoices, and documents to the patient record.
  6. The system restricts which fields each role may view or change.
  7. When care moves to another branch or dentist, the sender creates a handover with a note, and the receiver acknowledges it and gets limited, expiring access.
  8. The system records every change in the audit trail.
- **Outputs:**
  - Central patient record
  - Allergy and medical alert list
  - Cross-branch visit history
  - Handover record
  - Record change history

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A8):** Staff opens the exact accessible server Patient record from an authorized appointment and can open a Patient-prefilled AppointmentForm from that record. Identity resolution uses verified public IDs, never names or guessed browser IDs.
- **Current implementation / acceptance boundary:** Accepted on feature branch, not integrated. Destination/API scope remains enforced; unsupported legacy booking is disabled with guidance. No universal full clinical-record access or archive/merge authority.
- **Evidence:** [A8 / QA traceability](docs/GEN09_A8_STAFF_WORKFLOW_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 12: Document Management
**Module Owner:** Ecal, Richmon

#### A. Module Description
The Document Management Module stores patient forms, documents, and consents securely and collects them digitally instead of on paper. Patients and staff upload documents to private storage linked to the patient. Consent is recorded with its version, date, and person. A document is retracted with a reason instead of being deleted. ID scanning at registration is processed on the patient's own device, and the ID image is not stored.

#### B. Input
- **AS-IS Input:**
  - Paper form filled in by every new patient
  - Patient ID, handled on paper and kept physically
  - *Pending confirmation:* How consent is recorded today
- **TO-BE Input:**
  - Patient documents and forms (from the patient, staff, or dentist)
  - Consent decision and consent version (from the patient or guardian)
  - Document type and purpose (from the uploading user)
  - ID details for verification (from the patient and front desk)

#### C. Technology Used
- **AS-IS Technologies:**
  - Paper forms
  - Physical storage of forms and IDs
  - Staff retyping of paper forms into the system
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Private document storage (storage service pending confirmation)
  - Versioned consent records
  - On-device ID scanning (tool pending confirmation)
  - Audit trail (Audit Management)

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. A new patient fills in a paper form.
  2. The staff retype the form into the system.
  3. Forms and IDs are handled on paper and kept physically.
- **Outputs:**
  - Paper form for every new patient
  - Physically stored forms and IDs
- *Pending confirmation:* Who keeps the paper files, where they are stored, and how long they are kept (clinic interview).

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The patient or staff uploads a document or fills in a form digitally and selects the document type and purpose.
  2. The system checks the file type and size.
  3. The system stores the document in private storage and links it to the patient.
  4. The system records consent with its version, date, and person. The patient or guardian may withdraw consent.
  5. At registration, the patient's ID is scanned on the patient's own device to prefill details; the ID image is not stored, and the front desk verifies the ID in person.
  6. Staff retract a document with a reason instead of deleting it.
  7. The system records every access and change.
- **Outputs:**
  - Secure document record
  - Consent record and history
  - Retraction record

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (B1 supporting intake):** Existing on-device draft ID prefill and supported Other details do not add a production extraction or new document storage contract.
- **Current implementation / acceptance boundary:** Partial classification retained; no A9 expansion of consent, image retention or document access policy.
- **Evidence:** [B1 supporting intake / QA traceability](docs/INTEGRATION_WAVE_20261029.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 13: Treatment Management
**Module Owner:** Ecal, Richmon

#### A. Module Description
The Treatment Management Module records the dental care given at each visit. The responsible dentist opens the treatment linked to the visit, records findings per tooth on an interactive dental chart, and records the procedures performed. Completing the treatment locks it so it cannot be edited, and triggers billing.

#### B. Input
- **AS-IS Input:**
  - Treatment notes of the visit
  - Procedures performed
  - *Pending confirmation:* What the dentist records and from which source today
- **TO-BE Input:**
  - Patient and visit (from Patient Records and Check-In)
  - Complaint, history, allergies, and alerts (from Patient Records)
  - Assessment and dental chart findings (from the dentist)
  - Procedures performed and notes (from the dentist)

#### C. Technology Used
- **AS-IS Technologies:**
  - Clinic's current software or paper for treatment notes
  - Billing handled separately on paper
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Interactive SVG dental chart
  - Treatment locking after completion
  - Link to Billing Management

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The dentist records treatment notes in the clinic's current software or on paper.
  2. Charts and plans are not linked to billing.
  3. Billing is prepared separately on paper.
- **Outputs:**
  - Treatment notes in the clinic's current software or on paper
- *Pending confirmation:* Whether tooth charts are drawn on paper or in the existing software, and how assistants record their part (clinic interview).

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The dentist opens the clinical visit linked to the checked-in patient.
  2. The dentist reviews the complaint, history, and allergy alerts from the patient record.
  3. The dentist records findings per tooth on the interactive dental chart.
  4. The dentist records the procedures performed, with the dentist and assistant.
  5. The dentist completes the treatment, and the system locks it so it cannot be edited.
  6. The completed treatment triggers billing (Billing Management prepares the draft invoice).
- **Outputs:**
  - Clinical visit record
  - Dental chart
  - Completed and locked procedure record
  - Billing trigger

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A7 supporting schedule):** Exact encounter context remains required for treatment; schedule presentation changes do not automate diagnosis, chart decisions, procedures or completion.
- **Current implementation / acceptance boundary:** No new treatment-domain API/policy. Broad clinical workflow production acceptance is not claimed.
- **Evidence:** [A7 supporting schedule / QA traceability](docs/DENTIST_WORKFLOW_A7_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 14: Prescription Management
**Module Owner:** Ecal, Richmon

#### A. Module Description
The Prescription Management Module lets dentists issue clear, printable prescriptions that patients can also view online. Only a dentist writes a prescription, which is linked to the visit and shows the patient's allergies first. Each line records the medicine, strength, dosage, frequency, duration, and instructions. Issuing locks the prescription with a sequential number, and a mistake is corrected by voiding it with a reason and issuing a new one. The patient receives a notice and can download the PDF. The system does not check drug interactions; the dentist remains responsible.

#### B. Input
- **AS-IS Input:**
  - Prescription written by the dentist by hand
  - *Pending confirmation:* Patient allergy information used when prescribing
- **TO-BE Input:**
  - Patient and visit (from Patient Records and Treatment Management)
  - Allergies and alerts (from Patient Records)
  - Dentist and license number (from Staff Management)
  - Prescription lines (from the dentist)

#### C. Technology Used
- **AS-IS Technologies:**
  - Handwritten prescriptions on paper
  - Special prescription forms for controlled medicines
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Dentist authorization enforced by the server
  - Sequential prescription numbering
  - PDF generation
  - Patient notice (Notification Management)
  - Audit trail (Audit Management)

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The dentist writes the prescription by hand.
  2. Handwritten prescriptions can be unclear or lost.
  3. Controlled medicines still require the dentist's S2 license and special prescription forms.
- **Outputs:**
  - Handwritten prescription given to the patient
- *Pending confirmation:* Whether the clinic keeps a copy of each prescription today (clinic interview).

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The dentist opens a prescription from a valid visit.
  2. The system shows the patient's allergies before the dentist writes.
  3. The dentist records each medicine line: medicine, strength, dosage, frequency, duration, and instructions.
  4. The dentist issues the prescription, and the system locks it with a sequential number.
  5. If there is a mistake, the dentist voids the prescription with a reason and issues a new one.
  6. The system produces a printable PDF with the dentist's name and signature line.
  7. The patient receives a notice and a read-only copy that can be downloaded.
  8. The system records every issue, void, and view.
- **Outputs:**
  - Issued prescription
  - Printable prescription PDF
  - Patient copy and notice
  - Void and reissue history
  - Audit record

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (B1/A6/A7):** Dentist saves/reloads/edits custom medicine, dosage, frequency and duration drafts. Medicine-name selection does not supply dosage. From an open editable draft review, Edit draft opens the existing editor directly; license Save, remove action and issue confirmation retain explicit behavior.
- **Current implementation / acceptance boundary:** Integrated development; B1 synthetic persistence and A6/A7 rendered acceptance. Review-to-edit 2 to 1 clicks; issuing locks and voiding remains authorized. No medication automation or interaction certification. Allergy review is a prompt, not a claim that a complete clinical allergy source is always available.
- **Evidence:** [B1/A6/A7 / QA traceability](docs/DENTIST_WORKFLOW_A7_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 15: Follow-Up Management
**Module Owner:** Ecal, Richmon

#### A. Module Description
The Follow-Up Management Module makes sure patients come back for follow-up and routine check-ups. A follow-up task is created from a completed treatment or by a recall rule, with a reason and a target date. The front desk sees follow-ups that are due or overdue, contacts the patient or lets the system send an approved reminder, and books the visit. Booking closes the task automatically.

#### B. Input
- **AS-IS Input:**
  - Next visit arranged during payment
  - Staff memory of who should return
  - *Pending confirmation:* Whether any list or reminder is kept today
- **TO-BE Input:**
  - Completed treatment (from Treatment Management)
  - Follow-up need and target date (from the dentist)
  - Recall rules (from the Clinic Owner or dentist)
  - Patient (from Patient Records)
  - Booking result (from Appointment Management)

#### C. Technology Used
- **AS-IS Technologies:**
  - Conversation with the patient at payment
  - Staff memory
- **TO-BE Technologies:**
  - Web application (React, Vite)
  - Backend application (Laravel, PHP)
  - PostgreSQL database
  - Recall rules with dentist-approved reminder wording
  - Email and in-app notifications (Notification Management)
  - Booking from the task (Appointment Management)

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The next visit is arranged during payment.
  2. Whether the patient returns depends on staff memory.
- **Outputs:**
  - Next visit arranged at the counter
- *Pending confirmation:* Who arranges the next visit and how overdue patients are contacted (clinic interview).

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The system creates a follow-up task from the completed treatment, or from a recall rule, with a reason and target date.
  2. The system assigns the task to the branch's front desk.
  3. The front desk views the due and overdue follow-ups.
  4. The front desk contacts the patient or lets the system send a reminder with approved wording.
  5. The front desk books the visit from the task.
  6. The system closes the task automatically when the visit is booked.
  7. The system records the contact attempts and the outcome.
- **Outputs:**
  - Follow-up task
  - Recall reminder
  - Booked follow-up appointment
  - Follow-up status history

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A6):** Follow-up worklist shows distinct labelled Open/Contacted/Booked/Closed/Overdue states; supported booking flow remains unchanged.
- **Current implementation / acceptance boundary:** Integrated UI acceptance only; recall rules and health wording require existing approvals and actual delivery is not inferred.
- **Evidence:** [A6 / QA traceability](docs/DENTIST_UI_A6_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 16: Social Media Management
**Module Owner:** Millar, John Yzhekiel

#### A. Module Description
The Social Media Management module records patient inquiries that arrive through Facebook, Messenger, phone, or walk-in, assigns each inquiry to a staff member, tracks replies and follow-ups, and records the outcome, including conversion to a booking. It gives the clinic one inquiry list instead of scattered conversations.

#### B. Input
- **AS-IS Input:**
  - Inquiry content and channel
  - Prospect or patient contact details
- **TO-BE Input:**
  - Inquiry content and channel (prospect, patient, or staff)
  - Prospect or patient contact details
  - Assigned staff member (receptionist or Owner)

#### C. Technology Used
- **AS-IS Technologies:**
  - Facebook Page and Messenger
  - Telephone and walk-in inquiries
  - Staff memory and personal notes
- **TO-BE Technologies:**
  - Web application
  - Database management system
  - Inquiry recording and staff-assignment interface

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The clinic posts services and promotions on its Facebook Page.
  2. A prospect sends a Messenger message, comments, calls, or walks in with an inquiry.
  3. Staff answer the inquiry directly on Facebook, Messenger, or by phone.
  4. No record of the inquiry, reply, or result is kept.
  5. If the prospect decides to book, staff handle the booking separately.
- **Outputs:**
  - Replies sent directly to prospects
  - Bookings made through the existing process
  - No consolidated inquiry record or result history

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. Staff record each inquiry in the system, with its channel and contact details.
  2. The system saves the inquiry record in the database.
  3. Staff classify the inquiry and assign it to a staff member.
  4. The assigned staff member replies and records each reply and follow-up.
  5. The system lists unresolved inquiries so staff can see which still need action.
  6. Staff record the outcome of the inquiry, including conversion to a booking when the prospect books.
- **Outputs:**
  - Saved inquiry record with channel and status
  - Assigned staff task
  - Recorded replies and follow-ups
  - List of unresolved inquiries
  - Recorded outcome, including conversion to a booking

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (Baseline retained):** No new social-provider integration or campaign delivery is introduced.
- **Current implementation / acceptance boundary:** Existing Partial classification retained; external channel integrations remain separate work.
- **Evidence:** [Baseline retained / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 17: AI Chatbot Management
**Module Owner:** Millar, John Yzhekiel

#### A. Module Description
The AI Chatbot Management module answers common patient questions about services, branches, hours, booking, payments, and the patient's own appointments, using answers approved by the clinic. It works in knowledge mode, answers in English, Filipino, or Taglish, refuses medical advice and unrelated topics, directs emergencies to the clinic or nearest hospital, and hands over to the front desk when it cannot help. The Owner maintains the answers through an answer editor.

#### B. Input
- **AS-IS Input:**
  - Patient question
  - Clinic information known to staff (services, hours, branches, booking and payment procedures)
- **TO-BE Input:**
  - Patient question
  - Clinic-approved answers (Owner)
  - Branch hours and contacts
  - The patient's own appointments and invoices

#### C. Technology Used
- **AS-IS Technologies:**
  - Facebook Messenger
  - Telephone and walk-in questions
  - Staff knowledge and manual replies
- **TO-BE Technologies:**
  - Web application with chat interface
  - Chatbot in knowledge mode
  - Owner answer editor and approved answer storage
  - Safety, privacy, and scope checks
  - Database management system

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. A patient asks a question through Messenger, phone, or in person.
  2. Staff prepare an answer from what they know about the clinic.
  3. If the question needs a dentist or more information, staff hand it over manually.
  4. Staff repeat the same answers to similar questions, and reply time depends on who is available.
- **Outputs:**
  - Manual answers to patient questions
  - Manual referrals to staff or dentists
  - Delayed replies when staff are busy

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The patient submits a question through the chatbot.
  2. The system identifies the patient.
  3. The system checks the question for safety, privacy, and scope.
  4. The system finds the matching approved answer or the patient's own appointment or invoice information.
  5. If the question asks for medical advice or is unrelated to the clinic, the system refuses safely. If it describes an emergency, the system directs the patient to the clinic or the nearest hospital.
  6. The system offers a link to the right page, or hands the patient over to the front desk when it cannot help.
  7. The system records the question so the Owner can review unanswered questions.
  8. The Owner updates the approved answers using the answer editor.
- **Outputs:**
  - Approved answer or safe refusal
  - Link to the right page
  - Front-desk handover
  - Emergency direction when needed
  - Unanswered question list for the Owner
  - Updated approved answers

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A1):** Gemini JSON/SSE routes require Patient authentication, active account revalidation and a linked Patient profile before provider processing; denied roles cannot trigger upstream work.
- **Current implementation / acceptance boundary:** Integrated synthetic persisted authorization acceptance, not live AI activation approval. Configured provider transmission/governance remains pending independently of the main assistant mode.
- **Evidence:** [A1 / QA traceability](QA-JOEVAN.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 18: Messaging Management
**Module Owner:** Millar, John Yzhekiel

#### A. Module Description
The Messaging Management module gives patients a secure, real-time conversation with the front desk of their branch. A patient's message is routed to the right branch, staff reply in real time, and a patient who is offline receives an email alert that does not include the message content. Messages are encrypted, and the Owner cannot read patient conversations.

#### B. Input
- **AS-IS Input:**
  - Patient message
  - Staff reply
- **TO-BE Input:**
  - Patient message
  - Staff reply (receptionist or dentist)
  - Branch routing information (from appointment and patient records)

#### C. Technology Used
- **AS-IS Technologies:**
  - Facebook Messenger and personal channels
  - Telephone
  - Manual staff replies
- **TO-BE Technologies:**
  - Web application with real-time messaging
  - Message encryption
  - Branch-routing logic
  - Email service for offline alerts
  - Database management system

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. A patient sends a message through Messenger or a personal channel.
  2. Staff check the inbox and reply manually.
  3. Conversations stay in personal channels, so other staff cannot see the full history.
  4. The clinic has no clinic-owned record of the conversation or reply time.
- **Outputs:**
  - Manual replies
  - Conversations spread across personal channels
  - No central conversation history

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The patient sends a message through the clinic system.
  2. The system encrypts and saves the message in the conversation.
  3. The system routes the conversation to the front desk of the correct branch.
  4. The receptionist or dentist opens the conversation and replies.
  5. The system delivers the reply in real time.
  6. If the patient is offline, the system sends an email alert that does not include the message content.
  7. The system keeps the full message history. The Owner cannot read patient conversations.
- **Outputs:**
  - Encrypted conversation and message history
  - Branch-routed conversation
  - Real-time delivery of staff replies
  - Offline email alert without message content

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A2/B4):** Authorized conversation history has role-distinct bubbles, scoped search, older-history loading and preserved scrolling. Queue Message can resolve an existing matching authorized Patient/branch thread.
- **Current implementation / acceptance boundary:** A2 integrated; B4 queue shortcut isolated. STF-21 active-Dentist/history switching remains partial; attachments/reopening/Staff initiation are not newly approved. Live transport and production-scale encrypted search remain separate acceptance.
- **Evidence:** [A2/B4 / QA traceability](docs/RIC2_MESSAGING_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 19: Notification Management
**Module Owner:** Millar, John Yzhekiel

#### A. Module Description
The Notification Management module sends system messages such as codes, confirmations, reminders, invoices, and receipts. Events from other modules create notifications. The system selects the approved template, resolves the recipient and channel, queues the message, delivers it, retries failures without duplicates, and keeps a delivery history. Email and in-app notifications are used.

#### B. Input
- **AS-IS Input:**
  - Reminder or confirmation needed (from staff)
  - Patient or staff contact details
  - Message content written by staff
- **TO-BE Input:**
  - Event from another module (appointment, attendance, billing, follow-up, and others)
  - Recipient and contact details
  - Approved template and timing (Clinic Policy)

#### C. Technology Used
- **AS-IS Technologies:**
  - Manual calls, texts, emails, or Messenger messages
  - Staff checking appointments to send reminders
  - Staff-written message content
- **TO-BE Technologies:**
  - Web application backend with notification outbox
  - Email service
  - In-app notifications
  - Approved message templates
  - Retry handling
  - Database management system

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. Staff notice that a reminder, confirmation, or other message must be sent.
  2. Staff write the message by hand.
  3. Staff send it through email, phone, or Messenger.
  4. Staff keep no complete record of what was sent or whether it arrived.
  5. Failed or forgotten messages are found only when a patient complains or misses an appointment.
- **Outputs:**
  - Manually sent messages
  - Inconsistent wording
  - No delivery record

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. Another module creates an event that needs a notification.
  2. The system selects the approved template.
  3. The system resolves the recipient and the delivery channel (email or in-app).
  4. The system places the message in the outbox queue.
  5. The system delivers the message.
  6. If delivery fails, the system retries safely without creating duplicate messages.
  7. The system saves the delivery status and history.
- **Outputs:**
  - Delivered email or in-app notification
  - Delivery status and retry record
  - Failure alert when delivery fails
  - Notification history

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A1-A8 supporting feedback):** Workflow notices and errors reflect actual command results and remain account-specific; Messages and Notifications stay separate.
- **Current implementation / acceptance boundary:** No acceptance of the entire GEN-10 redesign, archive actions or live delivery from these UI checks.
- **Evidence:** [A1-A8 supporting feedback / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 20: Marketing Management (PE)
**Module Owner:** Millar, John Yzhekiel

#### A. Module Description
The Marketing Management module runs marketing and patient reactivation campaigns and measures their results. The Owner creates a campaign, such as a Facebook promotion or a message to patients who have not visited for a year, selects patients who consented to marketing, approves the content, and sends it or publishes it with a tracked link. Campaign clicks, bookings, and new patients can be compared with the previous week.

#### B. Input
- **AS-IS Input:**
  - Facebook promotion or campaign content
  - Intended audience or patient reactivation segment
  - Patient inquiries and bookings following a promotion
- **TO-BE Input:**
  - Campaign goal and content (Clinic Owner)
  - Patient segment, marketing consent, and unsubscribe status (Patient Records / Patient)
  - Link clicks, bookings, new patients, and post performance (System / Social Media Management)

#### C. Technology Used
- **AS-IS Technologies:**
  - Facebook Page for clinic promotions
  - Manual publication and patient reactivation activities
  - Campaign-to-booking tracking is not reliably available
- **TO-BE Technologies:**
  - Web application with campaign records and approval
  - Patient segment selection using Patient Records / Analytics
  - Marketing consent and unsubscribe status
  - Notification Management for messages sent to patients
  - Tracked campaign and referral/promotion links (`?promo=` / `?ref=`)
  - Analytics Management for conversion results and weekly comparisons

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The Owner or staff post promotions on the clinic Facebook Page.
  2. Patients may respond or book through the clinic's separate booking process.
  3. The campaign post is not reliably linked to the resulting booking.
  4. The clinic cannot readily tell whether a Facebook post brought in patients.
  5. Campaign results are not consistently compared with the previous week.
- **Outputs:**
  - Published social media promotion
  - Patient bookings handled through the existing process
  - No reliable campaign conversion results

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The Owner creates a campaign and defines its goal and content.
  2. The system selects eligible patients who consented to marketing.
  3. The Owner reviews and approves the campaign content and schedule.
  4. The system sends the campaign through Notification Management or publishes content with a tracked link.
  5. The system records link clicks, bookings, and new patients; relevant post performance can be included.
  6. The system compares campaign results with the previous week.
  7. The system honors unsubscribe requests immediately.
- **Outputs:**
  - Campaign record and consent-filtered target list
  - Tracked campaign link
  - Campaign results and week-to-week comparison
  - Unsubscribe record

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (Baseline retained):** Campaign tracking and proposed consent/targeting/delivery are distinct. No A1-A8 or B3-B5 batch establishes the full campaign lifecycle.
- **Current implementation / acceptance boundary:** Proposed enhancement boundaries preserved; no promotion of prototype rules or marketing automation to confirmed clinic policy.
- **Evidence:** [Baseline retained / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 21: Billing Management
**Module Owner:** Delos Santos, Joevan

#### A. Module Description
The Billing Management Module converts completed dental treatment procedures into itemized invoices, automatically credits online appointment booking deposits, allows front-desk staff to apply legally mandated 20% Senior Citizen (RA 9994) and Persons with Disability (RA 10754) statutory discounts with ID verification, facilitates secure online checkout through PayMongo (GCash, Maya, card) or in-clinic payments (Cash, Card/POS, Bank Transfer, E-Wallet), and automatically generates official PDF invoices and payment receipts with email delivery.

#### B. Input
- **AS-IS Input:**
  - Handwritten treatment slips and physical dental charts
  - Manual price lists and handheld calculator computations
  - Physical Senior Citizen or PWD IDs presented at the counter
  - Cash and manual paper receipts
  - Notebook tracking of unpaid balances
- **TO-BE Input:**
  - Completed treatment records with procedures and quantities from Treatment Management
  - Authoritative procedure catalog prices valid on treatment date
  - Online booking fee deposit credited to visit from Appointment Management
  - Statutory discount selection (Senior Citizen RA 9994 or PWD RA 10754) and ID number
  - Counter payment details (Method: Cash, Card/POS, Bank Transfer, E-Wallet; external reference)
  - PayMongo webhook payment settlement notice (GCash, Maya, card)

#### C. Technology Used
- **AS-IS Technologies:**
  - Paper billing slips and receipt booklets
  - Handheld calculator
  - Cash drawer
  - Paper ledgers and notebooks
- **TO-BE Technologies:**
  - Web application (React, Vite) with Staff billing workspace and Patient Review & Pay checkout portal
  - Backend application (Laravel, PHP) with database-level transactional locks
  - PostgreSQL database with sequential invoice (`INV-YYYY-XXXXXX`) and receipt (`RCT-YYYY-XXXXXX`) sequence generators
  - PayMongo Checkout API with secure HMAC signature webhook verification
  - Statutory discount calculator engine (20% reduction under RA 9994 and RA 10754)
  - Automated mail dispatch service (Laravel Mail) with downloadable PDF invoice and Payment Receipt generation

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. The treating dentist finishes the dental procedure and writes the performed services on a paper slip.
  2. The receptionist manually looks up each procedure on a printed price sheet and totals the charges using a calculator.
  3. If the patient presents a Senior Citizen or PWD card, the receptionist manually calculates a 20% discount on paper.
  4. The receptionist writes an invoice by hand; charges are not linked to a centralized database.
  5. The patient pays in cash at the counter because electronic and online payments are not supported.
  6. The receptionist handwrites a paper receipt from a receipt booklet and hands it to the patient.
  7. Any remaining balance is noted in a physical ledger, often resulting in uncollected fees.
- **Outputs:**
  - Handwritten paper invoice
  - Handwritten paper receipt
  - Paper ledger entry

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The staff member navigates to the Billing & Payments screen and views completed treatments in the "Completed Treatments awaiting billing" card.
  2. Staff clicks "Create Draft" next to the completed treatment, generating an authoritative draft invoice (`INV-YYYY-XXXXXX`) with itemized procedure lines.
  3. If the patient is an eligible Senior Citizen or PWD, staff clicks "Senior/PWD Discount", selects the discount type (Senior Citizen RA 9994 or PWD RA 10754), enters their ID number, and clicks "Save Discount" to automatically deduct 20%.
  4. Staff clicks "Review Invoice" to verify charges, then clicks "Issue Invoice" to advance the invoice to Issued status.
  5. The system automatically credits any appointment booking deposit paid during scheduling against the patient responsibility; if fully covered, the invoice settles immediately and generates a receipt.
  6. The patient views the itemized invoice in the patient portal or opens the "Review and pay" screen, which displays the amount due and itemized procedures.
  7. The patient clicks "Pay securely with PayMongo", chooses GCash, Maya, or card on the PayMongo checkout page, and completes payment.
  8. Upon receiving PayMongo's verified payment webhook, the system marks the invoice as Paid, generates Payment Receipt `RCT-YYYY-XXXXXX`, and emails the patient an Payment Receipt with a PDF attachment.
  9. For in-clinic settlement, staff clicks "Record full payment", selects the payment method (Cash, Card/POS, Bank Transfer, or E-Wallet), enters the external reference, and records payment.
  10. The system updates the branch payment worklist and stores immutable financial records in the database.
- **Outputs:**
  - Itemized electronic invoice (`INV-YYYY-XXXXXX`) and PDF
  - Verified PayMongo online payment settlement record
  - Official payment receipt (`RCT-YYYY-XXXXXX`) with downloadable PDF
  - Statutory discount audit record with ID number
  - Updated branch financial worklist and zero-balance status

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A4/A5 supporting analytics):** Reports consume authoritative payment/refund evidence without changing charge, issue, settlement or refund rules. Use Payment Receipt terminology.
- **Current implementation / acceptance boundary:** No production payment/refund or accounting-close acceptance from synthetic reporting tests. Existing financial policy and authority remain unchanged.
- **Evidence:** [A4/A5 supporting analytics / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 22: Loyalty Management (PE)
**Module Owner:** Delos Santos, Joevan

#### A. Module Description
The Loyalty Management Module provides a prototype patient loyalty and referral tracking system built on an immutable double-entry points ledger. Each registered patient is assigned a formatted clinic referral code (`DANA-<FIRSTNAME>-NN`) accessible through the patient portal (`#p/loyalty`). Authorized staff record points for qualified visits and referrals, patients monitor their points balance and progress toward a 50-point reward threshold, and patients submit reward redemption requests that clinic staff review and process.

#### B. Input
- **AS-IS Input:**
  - Word-of-mouth recommendations between patients
  - Unrecorded verbal mentions of friends or family at reception
  - Discretionary, unmeasured discounts given without clinic policy
- **TO-BE Input:**
  - Patient account and session from Patient Records
  - Assigned patient referral code (`DANA-<FIRSTNAME>-NN`)
  - Qualified visit or referral event confirmed by clinic staff
  - Authorized staff manual point entry (positive integer points)
  - Patient 50-point reward redemption request command

#### C. Technology Used
- **AS-IS Technologies:**
  - Verbal recommendations
  - No referral tracking tools or point balance software
- **TO-BE Technologies:**
  - Web application (React, Vite) with dedicated Patient Referral & Loyalty portal (`#p/loyalty`)
  - Frontend double-entry ledger calculation engine (`src/loyalty.js`)
  - Session-scoped patient authorization and role gating
  - Clipboard API integration for 1-click referral code copying
  - Audit event dispatching for loyalty activity recording and redemption processing

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. An existing patient verbally recommends Dr. Dana Roxas Dental Clinic to a colleague, friend, or relative.
  2. The new patient visits a clinic branch and may verbally mention who referred them during intake.
  3. Reception staff have no system to log the referral or attribute it to the referring patient's account.
  4. No formal points or rewards are earned, tracked, or awarded.
  5. The clinic cannot evaluate patient retention or referral-driven practice growth.
- **Outputs:**
  - Unrecorded verbal referral
  - Unrewarded returning patient visit

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. The patient signs into the patient portal, navigates to the "Referral & Loyalty" page (`#p/loyalty`), and views their assigned referral code (`DANA-<FIRSTNAME>-NN`).
  2. The patient clicks "Copy code" to copy their referral code and shares it with prospective patients.
  3. When a patient completes a qualifying treatment visit or verified referral, authorized staff records the qualified activity in the loyalty ledger with positive whole points.
  4. The system updates the ledger, recalculates the balance, and verifies that the transaction sum strictly equals the account points.
  5. The patient refreshes the "Referral & Loyalty" page to inspect their updated points balance, progress bar toward the 50-point threshold, and activity history.
  6. Once the points balance reaches at least 50 points, the "Request 50-point reward" button becomes enabled.
  7. The patient clicks "Request 50-point reward", creating an audited redemption request and updating the button status to "Awaiting clinic processing."
  8. Authorized staff reviews the pending request and processes the redemption, which deducts 50 points from the ledger and marks the transaction as Processed.
  9. The system logs the redemption in the audit history and displays the updated balance and transaction card in the patient portal.
- **Outputs:**
  - Assigned referral code (`DANA-<FIRSTNAME>-NN`)
  - Verified loyalty points earning entry (`+points`)
  - Real-time ledger points balance and progress meter
  - Pending reward redemption request
  - Processed redemption entry (`-50 points`) and updated activity history

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (Baseline retained):** Existing whole-point ledger/redemption demonstration does not establish a clinic loyalty program.
- **Current implementation / acceptance boundary:** Partial/proposed enhancement classification retained; 50-point and reward rules remain team-designed prototype rules, not confirmed clinic policy.
- **Evidence:** [Baseline retained / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 23: Archives & Historical Records Management
**Module Owner:** Delos Santos, Joevan

#### A. Module Description
The Archives & Historical Records Management Module provides centralized cross-branch retention, fast searching, and on-demand retrieval for historical clinic records—including completed dental visits, past digital prescriptions, settled invoices, and PayMongo payment receipts. Patients access their full care history and download official PDF records directly through the self-service patient portal (`#p/archives`), while staff and the Clinic Owner utilize a multi-tab search and filter workspace with instant CSV compliance export, protected by database-level append-only safeguards.

#### B. Input
- **AS-IS Input:**
  - Physical medical folders stored in branch filing cabinets
  - Carbon copy paper receipts stored in cardboard archive boxes
  - Returning patient verbal inquiries for previous visit dates or treatments
  - Disconnected local branch computer records
- **TO-BE Input:**
  - Completed visit and treatment records from Treatment Management (M13)
  - Issued digital prescriptions from Prescription Management (M14)
  - Settled invoices and PayMongo booking receipts from Billing Management (M21)
  - Search query strings (patient name, reference code, Rx number, dentist)
  - Branch filter selection (All Branches, Dr. Dana Roxas Dental Clinic, Roxas - Cardinal Dental Center, Roxas Dental Clinic Guiguinto)

#### C. Technology Used
- **AS-IS Technologies:**
  - Physical filing cabinets and paper folders
  - Branch-specific isolated computer databases
  - Handwritten carbon-copy paper receipts
  - Telephone calls between branches to track past patient history
- **TO-BE Technologies:**
  - Web application (React, Vite) with Staff Archives dashboard and Patient Archives portal (`#p/archives`)
  - Backend application (Laravel, PHP) with centralized cross-branch relational queries
  - PostgreSQL database with trigger-enforced append-only retention (blocks DELETE and unauthorized UPDATE)
  - Client-side CSV generation utility (`makeCsv`) for instant regulatory compliance export
  - Secure PDF generation and streaming endpoints for prescriptions, invoices, and booking receipts

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. After a dental visit concludes, staff file the patient's paper chart and paper receipt copy into physical filing cabinets at that branch.
  2. Because each clinic branch maintains an independent, disconnected database, medical and financial records created at one branch cannot be viewed from another branch.
  3. When a patient returns to a different branch after several months, the receptionist cannot find their past treatment records or prescription history.
  4. Staff must call or message the other branch to request details, or create a redundant duplicate chart.
  5. Patients who misplace their printed prescriptions or receipts must travel to the clinic in person to request manual photocopies.
  6. Older paper records degrade over time, clutter physical storage, and cannot be searched or audited quickly.
- **Outputs:**
  - Paper files stored in physical cabinets
  - Inaccessible cross-branch records
  - Lost or damaged paper prescriptions and receipts

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. As treatments are completed, prescriptions issued, and payments settled across all branches, records are indexed into the centralized database with append-only protection.
  2. The patient logs into the patient portal and clicks "Archives" (`#p/archives`) to access their personal historical health and billing record.
  3. The patient switches between the "Visits", "Prescriptions", and "Receipts" tabs to review their chronological history across all three clinic branches.
  4. The patient clicks "Download PDF" on any past prescription or receipt card to instantly download authenticated PDF documents on their own device.
  5. Staff or the Clinic Owner navigates to the staff Archives page, viewing tabs for "Completed Visits", "Prescriptions", and "Settled Invoices & Receipts".
  6. Staff types a patient name, reference code, or doctor name into the "Search archive" field to instantly filter matching records across branches.
  7. Staff uses the "Branch filter" dropdown to isolate records for a specific clinic branch (Dr. Dana Roxas Dental Clinic, Roxas - Cardinal Dental Center, or Roxas Dental Clinic Guiguinto) or view All Branches.
  8. Staff or the Owner clicks "Export Archive CSV" to download an organized compliance spreadsheet for the active tab and branch scope.
- **Outputs:**
  - Centralized historical record archive view
  - Downloadable authenticated prescription PDF (`RX-YYYY-XXXXXX`)
  - Downloadable authenticated billing invoice and payment receipt PDF
  - Exported regulatory archive spreadsheet (`archives-[tab]-[branch].csv`)
  - Instant cross-branch search and filter results

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (GEN-11 boundary):** Existing history retrieval/export remains distinct from universal creator-based archive/restore permissions.
- **Current implementation / acceptance boundary:** No new archive/restore approval. Append-only, soft-archive and private clinical/message restrictions remain; STF-25/DEN-16 acceptance still unresolved.
- **Evidence:** [GEN-11 boundary / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 24: Analytics Management
**Module Owner:** Delos Santos, Joevan

#### A. Module Description
The Analytics Management Module provides real-time executive intelligence and multi-branch operational analytics for the Clinic Owner. It aggregates live transactional data across appointments, queues, treatments, billings, and HMO claims across the clinic's three real branches (Dr. Dana Roxas Dental Clinic, Roxas - Cardinal Dental Center, and Roxas Dental Clinic Guiguinto). The Owner filters performance metrics across business periods (Today, This Week, This Month, This Year, All Time), monitors comparative branch queue load and collected revenue, exports executive CSV summaries, and receives an automated daily summary email containing aggregate operational counts.

#### B. Input
- **AS-IS Input:**
  - Daily paper sign-in logs kept at each branch
  - Physical appointment calendar binders
  - Paper cash receipts and end-of-day cash drawer counts
  - Informal staff phone calls to report patient turnout
- **TO-BE Input:**
  - Appointment bookings, cancellations, and completion records from Appointment Management
  - Live queue entries, wait times, and served patient visits from Queue Management
  - Settled invoice totals and collected payments from Billing Management
  - Approved and pending HMO claims from HMO Management
  - Branch selection (All Branches, Dr. Dana Roxas Dental Clinic, Roxas - Cardinal Dental Center, Roxas Dental Clinic Guiguinto)
  - Period filter selection (Today, This Week, This Month, This Year, All Time)

#### C. Technology Used
- **AS-IS Technologies:**
  - Handwritten paper notebooks and tally sheets
  - Handheld calculator
  - Telephone calls between branches
  - Manual spreadsheet entry (when done)
- **TO-BE Technologies:**
  - Web application (React, Vite) with Owner Operational Reporting & Analytics dashboard (`AnalyticsPage`)
  - Backend application (Laravel, PHP) with dedicated analytical aggregator services (`AnalyticsService.php`)
  - PostgreSQL database with indexed operational queries scoped to the Asia/Manila timezone
  - Automated CSV export streaming endpoint (`/api/analytics/export`)
  - Automated cron scheduler (Laravel Scheduler) executing the nightly daily summary email

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. Reception staff at each branch tally patient arrivals and appointments on physical paper sheets throughout the day.
  2. At clinic closing, staff count the physical cash drawer and compute totals using a handheld calculator.
  3. The Clinic Owner has no real-time cross-branch visibility into current patient queue lengths or daily collections.
  4. To evaluate clinic performance, the Owner must call each branch individually or wait for periodic branch visits to review physical receipts.
  5. Generating monthly comparisons or identifying doctor utilization bottlenecks requires laborious manual data entry into spreadsheets.
- **Outputs:**
  - End-of-day handwritten cash count sheet
  - Disconnected branch paper tallies
  - Delayed and incomplete practice overview

##### D.2 TO-BE Process (Proposed Automated Process)

**Preserved proposed blueprint, not a current acceptance claim:** The original KPI/export/digest target steps below are retained. The verified A4/A5 reporting process is specified after the original outputs; daily chart period filters and fixed overview comparisons must not be conflated.
- **Process Flow:**
  1. The Clinic Owner signs into the system and navigates to the "Operational Reporting & Analytics" screen (`AnalyticsPage`).
  2. The system queries PostgreSQL database tables and computes real-time operational metrics for the selected branch and Manila business date.
  3. The Owner selects a reporting period from the period dropdown ("Today", "This Week", "This Month", "This Year", or "All Time").
  4. The Owner selects a specific branch (Dr. Dana Roxas Dental Clinic in Bocaue Main, Roxas - Cardinal Dental Center in Bocaue Annex, or Roxas Dental Clinic Guiguinto) or chooses "All Branches".
  5. The dashboard presents five executive KPI metric cards: Recorded Revenue (gross and collected PHP), Scheduling (appointments and completion rate %), Queue / Patient Flow (served visits and waiting queue), HMO Processing (approved coverage amount), and Automation Health.
  6. The Owner inspects the "Branch workload report" card to compare real-time active waiting queues, booked appointments, wait time estimates, and collected revenue across all three branches.
  7. The Owner clicks "Export Report CSV" or "Export Executive Analytics CSV" to download the authoritative operational summary spreadsheet (`operational-analytics-YYYY-MM-DD.csv`).
  8. Every evening at clinic close, the automated server scheduler generates an executive daily digest and emails aggregate operational counts to the Owner.
- **Outputs:**
  - Live executive KPI metric cards on the Analytics dashboard
  - Comparative multi-branch workload and revenue panel
  - Downloadable executive analytics spreadsheet (`operational-analytics-YYYY-MM-DD.csv`)
  - Automated nightly executive daily summary email

**Current demonstrated reporting path (A4/A5, 2026-10-30):** Owner selects the authorized branch and detailed reporting period; daily payment-date gross collections, refunds and net cash flow appear with exact accessible tooltips/tables. A separately selected Mon-Sat week displays gross bars and signed net line with in-progress/finalized calendar status. Fixed current/prior 30-day collections/visit comparisons remain independent of that detailed period, including All Time; outstanding is a current-window balance without a historical snapshot comparison. Loading, malformed-data and stale-response guards prevent invented figures. Collections are not profit. No scheduled immutable Saturday artifact, custom-range/forensic export or live digest delivery is accepted by these chart tests.

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (A4/A5):** Owner inspects branch/period daily gross collections, refunds and net cash flow with exact tooltips and accessible tables. Weekly Mon-Sat gross bars and signed net line share an axis. Fixed current/prior 30-day gross and visit comparisons are independent of the detailed period selector; outstanding balances have no prior snapshot comparison.
- **Current implementation / acceptance boundary:** Integrated development with synthetic PostgreSQL reconciliation and rendered acceptance. Collections are not profit; Saturday is an on-demand calendar report, not an immutable scheduled artifact. No production financial reconciliation/live delivery claim; historical export/digest descriptions are not reaccepted.
- **Evidence:** [A4/A5 / QA traceability](docs/OWN01_A5_ACCEPTANCE.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

---

### Module 25: Audit Management
**Module Owner:** Delos Santos, Joevan

#### A. Module Description
The Audit Management Module provides an immutable, forensic audit trail that captures all security, clinical, financial, administrative, and automation events across the clinic system. Enforced by PostgreSQL database triggers that strictly reject UPDATE and DELETE statements, the audit log cannot be altered or purged by any user. The Clinic Owner searches and filters the log by action, actor, category, severity, branch, and date range through the Audit Trail interface, inspects sanitized event metadata, and exports compliance CSV records under Republic Act 10173 (Data Privacy Act of 2012).

#### B. Input
- **AS-IS Input:**
  - Unrecorded administrative actions and computer sign-ins
  - Untracked verbal instructions and handwritten chart modifications
  - Manual financial ledger adjustments made without an audit record
  - Shared computer logins without individual user attribution
- **TO-BE Input:**
  - Automated system events from User Management, Patient Records, Treatments, Prescriptions, and Billing
  - Event metadata: Actor identity, role, timestamp, branch ID, IP address, severity, and category
  - Audit filter criteria: Search text (action, actor, target ID, IP), category, severity, branch, from-date, and to-date
  - Owner request for detailed event inspection modal or CSV forensic export

#### C. Technology Used
- **AS-IS Technologies:**
  - Paper visitor and staff sign-in sheets
  - Unmonitored branch computer software without event logs
  - Word-of-mouth verification
- **TO-BE Technologies:**
  - Web application (React, Vite) with Owner Audit Trail & Activity Monitoring workspace (`AuditTrailPage`)
  - Backend application (Laravel, PHP) with centralized audit event service (`AuditService.php`)
  - PostgreSQL database with database trigger `enforce_audit_log_append_only` blocking all updates and deletes
  - Server-side cursor-based pagination API (`/api/audit/logs`)
  - Forensic CSV export endpoint (`downloadAuditLogsCsv`) generating dated audit spreadsheets

#### D. Process Documentation
##### D.1 AS-IS Process (Existing Process)
- **Process Flow:**
  1. Staff members log into clinic computers or write in paper charts without automated activity tracking.
  2. If an appointment is cancelled, a fee modified, or a patient record edited, no record is made of who performed the action or when.
  3. When discrepancies or missing receipts arise, the Clinic Owner cannot determine which account made the modification.
  4. Access to confidential patient medical records cannot be audited or proven to regulatory bodies.
  5. The clinic lacks timestamped forensic evidence to investigate security incidents or prove Data Privacy Act compliance.
- **Outputs:**
  - Unmonitored paper and computer changes
  - Untraceable record edits
  - Vulnerability to disputed transactions and compliance penalties

##### D.2 TO-BE Process (Proposed Automated Process)
- **Process Flow:**
  1. Whenever a critical action occurs (user authentication, treatment completion, prescription issuance, invoice modification, statutory discount entry, or payment recording), the server triggers an audit event.
  2. The system records the event into the append-only `audit_logs` table with timestamp, actor name and role, branch, IP address, category (Security, Clinical, Financial, Administrative, Automation, General), severity (Info, Warning, Critical), action code, and sanitized target metadata.
  3. PostgreSQL database triggers enforce append-only integrity, blocking any UPDATE or DELETE query and raising a database exception if attempted.
  4. The Clinic Owner signs into the system and navigates to the "Audit Trail & Activity Monitoring" page.
  5. The Owner reviews the summary cards showing total events loaded, security warnings, financial events, and clinical events.
  6. The Owner filters logs using the Audit Event Filters card: typing into Search (action, actor, target ID, or IP), picking a Category, choosing a Severity level, selecting a specific clinic branch or All Branches, and setting From and To dates.
  7. The system dynamically updates the Activity Log table displaying Timestamp, Severity badge, Category, Action code, Actor, Branch, and Target entity.
  8. The Owner clicks "Inspect" on any log row to open the modal and examine detailed event metadata, client context, and changed field names with credentials and sensitive patient health text redacted.
  9. The Owner clicks "Export Audit Trail (CSV)" to download an authenticated forensic audit spreadsheet (`audit-trail-export-YYYY-MM-DD.csv`).
- **Outputs:**
  - Immutable database audit trail record
  - Owner Activity Log table with cursor pagination
  - Detailed audit event inspection modal
  - Forensic audit trail spreadsheet (`audit-trail-export-YYYY-MM-DD.csv`)
  - Provable regulatory compliance report under RA 10173

---

## Signatures & Approvals

| Role | Name | Signature / Status |
|:---|:---|:---:|
| **Prepared By (Member)** | Celin Licanda | *Signed* |
| **Prepared By (Member)** | Hart Jaztin A. Alejo | *Signed* |
| **Prepared By (Member)** | Richmon Ecal | *Signed* |
| **Prepared By (Member)** | John Yzhekiel Millar | *Signed* |
| **Prepared By (Member)** | Joevan Delos Santos | *Signed* |
| **Approved By (Team Leader)** | Hart Jaztin Alejo | *Signed* |
| **Checked By (Adviser / Faculty)** | Prof. Sam Espino, MIT | *Approved* |

---

## Operational Alignment with Revisions Tracking

This proposed workflow directly anchors the execution of:
1. `FINALS-QA-REVISIONS.md` (68 QA findings split across UI/UX and Backend/Logic tracks across Celin, Jaztin, Richmon, Yzhekiel, and Joevan).
2. `REVISIONS.md` (Global UI/UX, Priority handling, Patient UI, Staff UI, Dentist UI, Owner UI, and Production readiness checklists).

All development must maintain:
- Zero regressions on existing test suites (`npm test`, `npm run test:smoke`, `npm run build`).
- Safe append-only PostgreSQL handling.
- Strict role and branch scoping under Asia/Manila operational context.

##### D.3 Development implementation qualification (2026-10-30, Asia/Manila)

- **TO-BE process clarification (Baseline retained):** Existing sanitized audit evidence remains append-only; UI shortcuts do not authorize disclosure of private clinical text or change audit policy.
- **Current implementation / acceptance boundary:** No new universal audit-completeness or production compliance certification from A9.
- **Evidence:** [Baseline retained / QA traceability](docs/defense/FEATURE_ACCEPTANCE_MATRIX.md); [academic reconciliation](docs/defense/ACADEMIC_DOCUMENT_RECONCILIATION.md). Earlier proposed steps describe the target process, not acceptance of every function. AS-IS findings are unchanged.

Paper finalization (2026-10-30): [revised A9 Word candidate](docs/defense/BPA_MODULES_UPDATED_OCT_22_2026_A9_REVIEW.docx) is REVIEW REQUIRED; the original is unchanged. [B6 report](https://github.com/ccadaverr/multibranch-dental-clinic/blob/4c993244416ec9b0530e1d16acfb6c9e471fac9c/docs/STF12_B6_WALKIN_ACCEPTANCE.md) adds isolated synthetic API/rendered evidence only.
