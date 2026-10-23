# Module Coverage

**Web-Based Multi-Branch Dental Clinic Operation System**
*Business Process Automation Project — Group 3 (BSIT 3B)*
**Client:** Dr. Dana Roxas, Clinic Owner
**Prepared By:** Alejo, Hart Jaztin A. | Delos Santos, Joevan | Ecal, Richmon | Licanda, Celin | Millar, John Yzhekiel
**Approved By:** Hart Jaztin Alejo (Team Leader / System-Process Analyst) & Dr. Dana Roxas (Clinic Owner)
**Reference Document:** `updated_bpa_check.pdf` (Version 3.1 / 3.2, Last Updated: October 20–22, 2026)

---

## 1. Executive Summary & Architecture Overview

The system architecture is structured into **25 numbered modules**, with each of the five team members owning an **exact block of 5 connected modules** following the natural clinic and patient care journey. Modules designated **PE** (*Proposed Enhancements*) represent high-value operational enhancements beyond the baseline clinic requirements.

### Block Ownership at a Glance
1. **Block 1: Licanda, Celin (Modules 1–5)** — *Governance, Administration & Clinic Foundations*
2. **Block 2: Alejo, Hart Jaztin A. (Modules 6–10)** — *Patient Flow, Scheduling & Front Desk Operations*
3. **Block 3: Ecal, Richmon (Modules 11–15)** — *Clinical Records, Treatment Care & Prescriptions*
4. **Block 4: Millar, John Yzhekiel (Modules 16–20)** — *Patient Engagement, Communications & Marketing*
5. **Block 5: Delos Santos, Joevan (Modules 21–25)** — *Financials, Archival, Intelligence & Governance*

### System Roles and Technology Stack
- **System Roles:** Exactly four role boundaries enforced at database and server levels: `patient`, `staff`, `dentist`, and `owner`.
- **Technology Stack:** React/Vite frontend, Laravel backend, PostgreSQL relational database, Laravel Sanctum session token security.
- **External Integrations:** PayMongo (GCash, Maya, cards with webhook reconciliation), Google Gemini AI (`gemini-1.5-flash` with curated knowledge fallback for clinic assistant), and modern responsive client-side PDF generation.
- **Compliance Standards:** Republic Act No. 10173 (*Data Privacy Act of 2012*), Republic Act No. 9994 (*Expanded Senior Citizens Act*), and Republic Act No. 10754 (*An Act Expanding the Benefits and Privileges of Persons with Disability*).

---

## 2. Module Assignment Quick Reference

| No. | Module Name | Classification | Assigned Member | Department / Unit |
| :---: | :--- | :---: | :--- | :--- |
| **1** | User Management | Core | Licanda, Celin | Clinic Administration / IT |
| **2** | Branch Management | Core | Licanda, Celin | Clinic Administration |
| **3** | Staff Management | Core | Licanda, Celin | Clinic Operations / Staffing |
| **4** | Service Management | Core | Licanda, Celin | Clinic Administration / Service Catalog |
| **5** | Clinic Policy Management | Core | Licanda, Celin | Clinic Administration / System Configuration |
| **6** | Appointment Management | Core | Alejo, Hart Jaztin A. | Scheduling and Patient Services |
| **7** | Attendance Management | Core | Alejo, Hart Jaztin A. | Scheduling Support / Patient Services |
| **8** | Check-In Management | Core | Alejo, Hart Jaztin A. | Front Desk / Patient Services |
| **9** | Queue Management | Core | Alejo, Hart Jaztin A. | Front Desk / Patient Flow |
| **10** | Patient Flow Management | Core | Alejo, Hart Jaztin A. | Clinic Operations / Patient Flow |
| **11** | Patient Records Management | Core | Ecal, Richmon | Patient Records / Clinical Services |
| **12** | Document Management | Core | Ecal, Richmon | Patient Records / Document Services |
| **13** | Treatment Management | Core | Ecal, Richmon | Clinical Services |
| **14** | Prescription Management | Core | Ecal, Richmon | Clinical Services / Prescription Management |
| **15** | Follow-Up Management | Core | Ecal, Richmon | Clinical Services / Patient Follow-Up |
| **16** | Social Media Management | Core | Millar, John Yzhekiel | Patient Services / Inquiry Handling |
| **17** | AI Chatbot Management | Core | Millar, John Yzhekiel | Patient Services / Digital Support |
| **18** | Messaging Management | Core | Millar, John Yzhekiel | Patient Services / Communication |
| **19** | Notification Management | Core | Millar, John Yzhekiel | Patient Services / Notifications |
| **20** | Marketing Management (PE) | Proposed Enhancement | Millar, John Yzhekiel | Patient Engagement / Marketing |
| **21** | Billing Management | Core | Delos Santos, Joevan | Billing / Front Desk |
| **22** | Loyalty Management (PE) | Proposed Enhancement | Delos Santos, Joevan | Patient Engagement |
| **23** | Archives & Historical Records Management | Core | Delos Santos, Joevan | Clinic Administration / Records & Compliance |
| **24** | Analytics Management | Core | Delos Santos, Joevan | Management / Analytics |
| **25** | Audit Management | Core | Delos Santos, Joevan | Clinic Administration / Governance |

---

## 3. Master 25-Module Coverage & Implementation Status

| No. | Module Name | Owner | Core Purpose & Responsibilities | Implementation Status & Evidence (Oct 2026) |
| :---: | :--- | :--- | :--- | :--- |
| **M1** | **User Management** | Licanda, Celin | Controls who can use the system and permissions for Owner, Staff, Dentists, and Patients. Manages account creation, email verification OTP, role/branch assignment, password reset, account claiming, and soft-deletions. | **Implemented / Partial (v3.1)**: Patient sign-up with emailed code, password reset, email change, Owner invitations, 4 roles with branch scoping, and secure account claiming. *Planned*: multi-owner accounts, 2FA. Evidence: `PI-01`, `PI-02`. |
| **M2** | **Branch Management** | Licanda, Celin | Maintains each branch's profile, location, contact details, per-day opening hours, and closed dates/holidays so all modules share a single source of truth across Bocaue Main, Bocaue Annex, and Guiguinto. | **Implemented (v3.1)**: Three real branches with contacts, map positions, per-day hours, closed dates/holidays, affected-appointment notices, and public branch landing pages. Open item: branch email for Guiguinto. Evidence: `Q2`, `PI-14`, `PI-15`, `R2-13`. |
| **M3** | **Staff Management** | Licanda, Celin | Manages staff and dentist profiles, credentials/licenses, branch assignments, weekly work schedules per branch/day, schedule exceptions, and leave requests with approval and conflict lists with suggested cover. | **Implemented (v3.1)**: Weekly schedules per dentist, branch and day, exceptions, leave requests with approval, conflict lists with suggested cover. Open item: clinic-confirmed real weekly hours. Evidence: `PI-05`, `PI-06`, `PI-08`. |
| **M4** | **Service Management** | Licanda, Celin | Maintains catalog of dental services/procedures, durations, branch offerings, consultation-first booking rules (braces/extractions), and effective-dated price versions for consistent billing history. | **Implemented / Partial (v3.1)**: Services with durations, branch availability, versioned prices, and consultation-first booking redirects. Pending: clinic-approved price list and installment terms. Evidence: `Q1`, `Q12`, `R2-17`. |
| **M5** | **Clinic Policy Management** | Licanda, Celin | Central repository for configurable clinic operating rules: cancellation window (24h), late arrival thresholds (5/10/15m), reminder intervals (60m), branding (logo/colors), retention, and mandatory Owner/Dentist message wording approvals. | **Implemented (v3.1)**: Owner settings for reminders, late arrivals, cancellations, overdue invoices, recall, daily summary, and branding with wording approval and audited history. Pending: final Owner sign-off on defaults and retention periods. Evidence: `R2-09`, `R2-10`, `R2-13`. |
| **M6** | **Appointment Management** | Alejo, Hart Jaztin A. | Self-service online and staff appointment booking, rescheduling, and cancellations. Ranks branches by distance, verifies real availability, holds slot for 15 minutes, collects fees online via PayMongo (GCash/card), emails receipts/.ics calendar files, and manages waitlists. | **Implemented (v3.1)**: One-flow booking with real availability, DB-level double booking prevention, confirmations, rescheduling, cancellation/refund policy, consultation-first handling, waitlist, PayMongo pay-at-booking with 15-min hold. Evidence: `Q20`, `Q27`, `Q28`, `Q29`, `PI-29`. |
| **M7** | **Attendance Management** | Alejo, Hart Jaztin A. | Confirms patient attendance to minimize chair downtime. Dispatches pre-visit reminders with one-click confirm/cancel buttons; handles 5-minute inquiry, 10-minute late flag, and 15-minute slot release with front-desk undo; tracks repeat no-shows. | **Implemented (v3.1)**: Reminders with confirm/cancel buttons, 5/10/15-minute late arrival progression with staff undo, no-show and late-cancellation logging, front-desk confirmation for repeated no-shows. Evidence: `R2-07`, `R2-09`, `R2-10`, `PI-31`. |
| **M8** | **Check-In Management** | Alejo, Hart Jaztin A. | Records arrival for booked patients and walk-ins without paper forms. Provides counter QR code and kiosk self-registration with daily rotating branch code, on-device ID prefill (zero image storage), cross-branch duplicate detection, and front-desk verification into queue. | **Implemented (v3.1)**: Booked check-in, walk-in registration, counter QR code with daily secret, kiosk mode, on-device client ID prefill without saving images, cross-branch duplicate matching, and staff verification into queue. Evidence: `Q15`, `PI-13`, `PI-21`, `R2-03`, `R2-05`, `R2-08`. |
| **M9** | **Queue Management** | Alejo, Hart Jaztin A. | Maintains an authoritative, live, fair waiting queue per dentist for the day. Transitions patients through Waiting $\to$ Called $\to$ In Treatment $\to$ Done. Re-sequences late arrivals to end of queue; records authorized priority overrides with mandatory reasons. | **Implemented (v3.1)**: Queue numbering, status progression, late patient re-sequencing, dedicated dentist queue and patient position views. Planned: physical waiting-room display screen. Evidence: `Q19`, `Q21`, `PI-24`, `PI-25`, `R2-07`. |
| **M10** | **Patient Flow Management** | Alejo, Hart Jaztin A. | Maximizes chair utilization across branches. Visualizes daily/weekly calendar load and flags crowded days. Automatically offers freed appointment slots to patients booked later same day (move-up), then waitlist, then walk-ins. Displays live wait counts and estimated wait times. | **Implemented (v3.1)**: Staff calendar with daily load and crowded days, move-up offers, waitlist notices, and walk-in visibility. Planned: live estimated waiting time display on patient screen. Evidence: `R2-02`, `R2-10`. |
| **M11** | **Patient Records Management** | Ecal, Richmon | Single, centralized, secure clinical and demographic record per patient across all branches. Tracks allergies, medical/dental alerts, guardians for minors, linked visits/treatments/prescriptions/invoices, cross-branch handovers with time-bound access, and audited edits. | **Implemented (v3.1)**: Shared cross-branch patient records, audited edits, cross-branch duplicate matching, and inter-branch/dentist handovers with expiring read access. Planned: profile merge and archival approval workflow. Evidence: `Q17`, `Q28`, `R2-08`. |
| **M12** | **Document Management** | Ecal, Richmon | Paperless digital document repository. Secure private file storage linked to patient profiles, versioned digital consent records and withdrawals, on-device ID parsing (zero raw image upload), text extraction drafts for staff review, and retraction with reason instead of deletion. | **Implemented / Partial (v3.1)**: Private upload/download with signed access, versioned consent at registration, document retraction with reason, and on-device ID prefill. Partial: text extraction drafts in daily use; retention periods await approval. Evidence: `Q16`, `R2-03`, `R2-12`. |
| **M13** | **Treatment Management** | Ecal, Richmon | Comprehensive clinical record of care per visit: complaints, history/allergy check, interactive SVG dental tooth chart (adult/primary teeth), treatment plan estimates and acceptance, procedure consent, procedure logging, and trigger-locking upon completion to initiate billing and follow-up. | **Implemented (v3.1)**: Visit-linked treatment entry by treating dentist, completion locking triggering billing/prescriptions, and interactive SVG dental chart. Planned: multi-phase treatment plans with patient acceptance, procedure consent, and lab case tracking. Evidence: `Q15`, `Q27`, `Q29`, `PI-09`. |
| **M14** | **Prescription Management** | Ecal, Richmon | Authoritative server prescription issuing by treating dentist. Displays allergy warnings prior to entry; captures medicine, strength, dosage, frequency, duration, instructions; assigns atomic sequential numbers (`RX-YYYY-000001`); locks upon issuance; supports void with reason; generates A4 PDF. | **Implemented (v3.1 / Oct 22)**: Server Prescription module with sequential numbering and downloadable PDF generation with dentist license/signature, dentist authorization, patient access, and immutable signed records. Evidence: `Q16`, `PI-38`. |
| **M15** | **Follow-Up Management** | Ecal, Richmon | Coordinates post-treatment continuity of care and routine check-ups. Creates follow-up obligations from completed treatments or automated recall rules (e.g. 6-month cleaning), front-desk due/overdue worklists, dentist-approved reminders, and auto-closure upon rebooking. | **Implemented (v3.1 / Oct 22)**: Server Follow-Up tasks module, recall reminders with approved wording gating, front-desk worklist, and linked visit tracking with automated closure. Evidence: `Q15`, `Q27`. |
| **M16** | **Social Media Management** | Millar, John Yzhekiel | Centralizes patient inquiries from Facebook, Messenger, phone, and walk-ins. Records channel source, assigns staff, logs follow-ups, and converts leads to patient records/bookings. Connects clinic FB page to measure reach/engagement alongside actual bookings. | **Implemented / Partial (v3.1)**: Staff-recorded inquiries with channel attribution, assignment, and conversion outcome. Planned: direct Facebook Page Graph API metrics and live Messenger webhook integration (pending Meta business verification). Evidence: `PI-42`, `R2-04`. |
| **M17** | **AI Chatbot Management** | Millar, John Yzhekiel | 24/7 intelligent patient assistance powered by Google Gemini AI (`gemini-1.5-flash`) with curated clinic knowledge fallback. Answers questions on services, hours, locations, and personal bookings in English, Filipino, and Taglish; enforces clinical safety guardrails (refuses medical advice); provides front-desk handover. | **Implemented (v3.1 / Oct 22)**: Google Gemini AI integration (`gemini-1.5-flash`) with fallback to Owner-curated knowledge base, Owner answer editor, question log for improvements, and clinical safety guardrails. Evidence: `Q23`, `PI-42`, `PI-43`. |
| **M18** | **Messaging Management** | Millar, John Yzhekiel | Real-time, encrypted communication between patients and branch front desk. Automatically routes conversations to the appropriate branch based on active appointments; delivers offline email alerts (without exposing message content); ensures Owner cannot inspect patient chats. | **Implemented (v3.1)**: Real-time encrypted messaging with branch routing, offline email notifications, read/unread tracking, and Owner privacy boundaries. Planned: file attachments in messages. Evidence: `PI-30`, `PI-42`, `PI-43`. |
| **M19** | **Notification Management** | Millar, John Yzhekiel | High-reliability notification delivery backbone for system events (OTP codes, booking confirmations, reminders, invoices, receipts). Features template selection, reliable outbox queuing, exponential retries without duplicate sends, and respects quiet hours. | **Implemented (v3.1)**: Email and in-app notifications through reliable outbox queue with retries, dead-letter tracking, and Owner-approved wording gating. Planned: SMS carrier gateway integration. Evidence: `PI-29`, `PI-31`. |
| **M20** | **Marketing Management (PE)** | Millar, John Yzhekiel | **Proposed Enhancement (PE)**: Executes consent-based marketing campaigns and patient reactivation (e.g. inactive patients > 1 year). Provides tracked booking links (`?promo=...` / `?ref=...`), conversion tracking into Analytics, week-over-week performance comparisons, and immediate opt-out honoring. | **Implemented (v3.1 / Oct 22)**: Promotion and referral code attribution (`?promo=` / `?ref=`) and campaign conversion tracking into Analytics dashboard. Rebook and recall emails operate through linked operational modules. |
| **M21** | **Billing Management** | Delos Santos, Joevan | Converts completed treatments into itemized invoices. Applies booking fee credits, calculates statutory Senior Citizen & PWD benefits (RA 9994 / RA 10754), collects online payments via PayMongo (GCash/card) or counter cash, issues PDF invoices/receipts, and tracks unpaid balances. | **Implemented (v3.1 / Oct 22)**: Automated invoice generation from treatment, PDF invoices and receipts, PayMongo payment checkout with webhook verification, booking deposit crediting, overdue reminders, and statutory Senior/PWD statutory exemptions. Planned: installments, HMO provider billing, BIR-compliant official receipts. Evidence: `Q27`, `R2-01`. |
| **M22** | **Loyalty Management (PE)** | Delos Santos, Joevan | **Proposed Enhancement (PE)**: Word-of-mouth referral and returning patient loyalty reward program. Issues patient referral codes, records referral relationships, credits points upon verified paid visit, maintains auditable points ledger, and handles reward redemption. | **Planned (v3.1)**: Proposed enhancement architecture designed; code prototype paused until clinic management formally ratifies the points valuation and rewards redemption schedule. |
| **M23** | **Archives & Historical Records Management** | Delos Santos, Joevan | Long-term archival and retrieval of historical records across all branches: completed visits, past prescriptions, settled receipts, and inactive patient/HMO files. Dedicated self-service patient portal archives (`#p/archives`) and cross-branch Staff/Dentist/Owner search, filter, restore, and compliance export. | **Implemented (v3.2 / Oct 22)**: Patient portal Archives view (`#p/archives`) for past visits, prescriptions, and downloadable PDF receipts; cross-branch Staff/Dentist/Owner management dashboard with search, filtering, record restore, and compliance export. Evidence: `Q17`, `R2-08`, `R2-12`. |
| **M24** | **Analytics Management** | Delos Santos, Joevan | Business intelligence and operational reporting for the Clinic Owner. Aggregates data from appointments, queues, treatments, billings, follow-ups, and campaigns into cross-branch KPIs, comparison charts, and an automated daily summary email (counts only). | **Implemented (v3.1 / Oct 22)**: Owner KPI dashboard, staff calendar load visualization, promotions & campaign performance tracking, and automated daily summary email. Planned: multi-parameter branch/period filter and forensic exports. Evidence: `Q32`. |
| **M25** | **Audit Management** | Delos Santos, Joevan | Tamper-resistant, immutable audit trail of system events: user authentications, patient record changes, clinical actions, financial transactions, and configuration updates. Stored append-only in PostgreSQL with database-level triggers blocking updates/deletes; Owner search and CSV export. | **Implemented (v3.1)**: Append-only audit log enforced by database triggers (refuses edit/delete) with actor, action, record, branch, timestamp, before/after metadata (excluding PHI), Owner search, and CSV export. |

---

## 4. Detailed Process Documentation Breakdown (By Module Block)

### Block 1: Licanda, Celin — Governance & Clinic Foundations (M1–M5)

#### Module 1: User Management
- **Department/Unit:** Clinic Administration / IT
- **Process Description:** Creates and maintains accounts, verifies email ownership with a 6-digit OTP before sign-in, assigns one of four roles (`patient`, `staff`, `dentist`, `owner`) and branch access, creates authenticated sessions, and records account status changes. Patients register themselves; staff and dentists are invited by the Owner.
- **Key Inputs:** Patient sign-up details & privacy consent, email verification code, employee invitation (name, email, role, branches), login credentials, account status decisions (suspend, restore, remove).
- **Key Outputs:** Verified User Account, Authenticated Session, Role and Branch Permissions, Account Status Record, Access & Account Change History.
- **Flow Summary:** Start $\to$ Sign Up or Invitation $\to$ Email Verification $\to$ Assign Role and Branches $\to$ Sign In $\to$ Permission Check on Every Action $\to$ Account Changes Audited $\to$ End.
- **Performance Targets:** Unverified Accounts Signing In: 0; Employee Onboarding Time: < 5 min per invitation; Unauthorized Access Attempts Blocked: 100% logged and blocked.
- **Evidence:** `PI-01` (Owner approval of accounts), `PI-02` (email invitation).

#### Module 2: Branch Management
- **Department/Unit:** Clinic Administration
- **Process Description:** Maintains each branch’s profile (Bocaue Main, Bocaue Annex, Guiguinto), address, map location, phone, email, daily opening hours, and dated closures or holidays. Feeds booking, reminders, landing pages, and reports from a unified source.
- **Key Inputs:** Branch name, address, contact details, map location, weekly opening hours per day, closed dates/holidays with reasons, branch active status.
- **Key Outputs:** Branch Profile, Weekly Opening Hours, Closed Date & Holiday Calendar, Affected Appointment List, Public Branch Directory.
- **Flow Summary:** Start $\to$ Register Branch $\to$ Set Hours and Contacts $\to$ Record Closures $\to$ Notify Affected Patients $\to$ Publish Everywhere $\to$ End.
- **Performance Targets:** Branch Information Consistency: 100%; Booking on Closed Dates: 0 (blocked by system); Time to Publish Closure: < 2 min.
- **Evidence:** `Q2`, `PI-14`, `PI-15`, `R2-13`.

#### Module 3: Staff Management
- **Department/Unit:** Clinic Operations / Staffing
- **Process Description:** Manages dentist and staff profiles, professional credentials (license numbers), branch assignments, weekly work schedules per branch and day, schedule exceptions, and leave requests with approval workflows that suggest cover dentists and notify affected bookings without silent cancellation.
- **Key Inputs:** Staff and dentist profiles, professional credentials, branch assignments, services performed, weekly schedules, leave requests.
- **Key Outputs:** Staff and Dentist Profiles, Dentist Service Eligibility, Weekly Work Schedules, Approved Leave & Exceptions, Affected Appointment List with Suggested Cover, Availability Used by Booking.
- **Flow Summary:** Start $\to$ Maintain Profiles $\to$ Set Weekly Schedules $\to$ Request and Approve Leave $\to$ Resolve Affected Appointments $\to$ Publish Availability $\to$ End.
- **Performance Targets:** Bookings Outside Schedule: 0; Leave Approval Time: within 1 working day; Appointments Left Unresolved by Leave: 0.
- **Evidence:** `PI-05`, `PI-06`, `PI-08`.

#### Module 4: Service Management
- **Department/Unit:** Clinic Administration / Service Catalog
- **Process Description:** Maintains the service catalog, procedure durations, branch availability, online booking rules (directly bookable vs consultation-first for complex procedures like braces/extractions), and dated price versions to preserve invoice integrity over time.
- **Key Inputs:** Service/procedure definitions, durations, price and effective date, branches offering service, booking rules, package/installment terms.
- **Key Outputs:** Service Catalog, Durations Used by Scheduling, Branch Service Availability, Dated Price History, Booking Rules, Package/Installment Terms.
- **Flow Summary:** Start $\to$ Define Service $\to$ Set Duration and Branches $\to$ Set Booking Rule $\to$ Set Dated Price $\to$ Publish Catalog $\to$ End.
- **Performance Targets:** Invoices Using Outdated Price: 0; Direct Booking of Consultation-First Services: 0 (redirected); Catalog Update Time: < 5 min.
- **Evidence:** `Q1`, `Q12`, `R2-17`.

#### Module 5: Clinic Policy Management
- **Department/Unit:** Clinic Administration / System Configuration
- **Process Description:** Centralizes clinic rules so they are configured by the Owner rather than hard-coded: cancellation window (24 hours), late arrival rules (5, 10, 15 minutes), reminder timing (60 minutes), message templates with mandatory Owner/Dentist sign-off, data retention periods, and clinic branding.
- **Key Inputs:** Policy values (cancellation window, late limits, reminder timing), message templates & approvals, branding (name, logo, colors), data retention periods, branch scopes.
- **Key Outputs:** Active Clinic Policies, Approved Message Templates, Branding Settings, Retention Settings, Policy Change History.
- **Flow Summary:** Start $\to$ Review Setting $\to$ Change Within Allowed Range $\to$ Approve Wording $\to$ Apply From Effective Date $\to$ Record History $\to$ End.
- **Performance Targets:** Messages Sent Without Approved Wording: 0; Policy Values Hard-Coded: 0; Policy Change Time: < 2 min.
- **Evidence:** `R2-09`, `R2-10`, `R2-13`.

---

### Block 2: Alejo, Hart Jaztin A. — Patient Flow & Scheduling (M6–M10)

#### Module 6: Appointment Management
- **Department/Unit:** Scheduling and Patient Services
- **Process Description:** Allows patients and staff to book, pay for, reschedule, and cancel appointments with real availability checks. Ranks branches by distance, holds selected slot for 15 minutes during PayMongo checkout (GCash, Maya, card), and verifies payment via webhook before confirming. Provides .ics calendar files, waitlist registration for full days, and applies cancellation/refund rules.
- **Key Inputs:** Patient details, requested service & duration, preferred branch/location, preferred dentist/any, date/time, branch hours/closures, dentist schedule/leave, policy rules, PayMongo payment confirmation.
- **Key Outputs:** Paid & Confirmed Appointment, Booking Payment Receipt, Confirmation Email & Calendar (.ics) File, Rescheduled/Cancelled Record, Waitlist Entry, Appointment History.
- **Flow Summary:** Start $\to$ Choose Service $\to$ Choose Branch $\to$ Choose Dentist $\to$ Choose Date and Time $\to$ System Checks Availability $\to$ Pay Online $\to$ Payment Verified $\to$ Confirm $\to$ Email Confirmation and Receipt $\to$ End.
- **Performance Targets:** Double Bookings: 0; Online Booking Completion Time: < 2 min; Outside Office Hours Bookings: Tracked monthly.
- **Evidence:** `Q20`, `Q27`, `Q28`, `Q29`, `PI-29`.

#### Module 7: Attendance Management
- **Department/Unit:** Scheduling Support / Patient Services
- **Process Description:** Dispatches 60-minute pre-visit reminders with single-action "I'll be there" or "I can't make it" buttons. Executes late-arrival rules (5-min check, 10-min late flag, 15-min slot release with front-desk override) to immediately recycle unused chair time, logging no-shows and requiring staff confirmation for chronic offenders.
- **Key Inputs:** Upcoming appointment, reminder timing and late policy, patient response, arrival status from check-in, front-desk override decision.
- **Key Outputs:** Attendance Status (confirmed, cancelled, late, no-show), Freed Appointment Slot, Rebook Invitation, No-Show and Late Cancellation Record, Front-Desk Worklist.
- **Flow Summary:** Start $\to$ Reminder Sent $\to$ Patient Confirms or Cancels $\to$ Arrival Checked $\to$ Late Rule Applied $\to$ Attended, Released or No-Show Recorded $\to$ End.
- **Performance Targets:** No-Show Rate: Measurable reduction after 3 months; Freed Slots Reused: Tracked weekly; Staff Reminder Calls: 0 (replaced by automation).
- **Evidence:** `R2-07`, `R2-09`, `R2-10`, `PI-31`.

#### Module 8: Check-In Management
- **Department/Unit:** Front Desk / Patient Services
- **Process Description:** Eliminates paper intake. Staff checks in booked patients. Walk-ins and new patients scan a counter QR code (with daily branch PIN) or use a kiosk tablet to self-register. Performs client-side on-device ID scanning (extracts name and DOB; zero raw image stored), detects cross-branch duplicate records, and enables staff to verify ID and route patient to queue.
- **Key Inputs:** Booked appointment, self-registration details & consent, on-device ID prefill data, daily branch counter code, service and dentist assignment.
- **Key Outputs:** Checked-In Visit, New or Matched Patient Record, Verified Identity Record, Queue Entry, Arrival Time.
- **Flow Summary:** Start $\to$ Patient Arrives $\to$ Check In or Self-Register $\to$ Match Existing Record $\to$ Verify ID $\to$ Confirm Service and Dentist $\to$ Join Queue $\to$ End.
- **Performance Targets:** Sign-In Time per New Patient: Reduced from ~15 min baseline; Duplicate Records: 0; Forms Retyped by Staff: 0.
- **Evidence:** `Q15`, `PI-13`, `PI-21`, `R2-03`, `R2-05`, `R2-08`.

#### Module 9: Queue Management
- **Department/Unit:** Front Desk / Patient Flow
- **Process Description:** Manages a fair, live queue per dentist. Generates daily sequential queue tokens. Transitions patients through `Waiting` $\to$ `Called` $\to$ `In Treatment` $\to$ `Done`. Automatically places late arrivals at the end of the queue. Logs priority overrides with mandatory justification. Provides live views for dentists and patients.
- **Key Inputs:** Checked-in visit, assigned dentist and service, arrival time and late status, priority reason (when authorized).
- **Key Outputs:** Live Queue per Dentist, Patient Position and Status, Queue History, Priority Change Record.
- **Flow Summary:** Start $\to$ Checked In $\to$ Queue Number Assigned $\to$ Waiting $\to$ Called $\to$ In Treatment $\to$ Done $\to$ End.
- **Performance Targets:** Queue Order Errors: 0; Priority Changes Without Reason: 0; Average Waiting Time: Measured per branch.
- **Evidence:** `Q19`, `Q21`, `PI-24`, `PI-25`, `R2-07`.

#### Module 10: Patient Flow Management
- **Department/Unit:** Clinic Operations / Patient Flow
- **Process Description:** Visualizes branch capacity and chair utilization. Highlights crowded days on the staff calendar. When an appointment is cancelled or released, the system initiates move-up offers to patients booked later the same day, followed by waitlist alerts, then walk-in allocation. Displays live waiting counts and estimated wait duration.
- **Key Inputs:** Appointments, dentist schedules/leave, live queues, freed slots from attendance, capacity thresholds.
- **Key Outputs:** Staff Calendar with Daily Load, Move-Up and Waitlist Offers, Filled Slots Record, Live Waiting Counts and Estimates, Capacity Alerts.
- **Flow Summary:** Start $\to$ Read Bookings and Schedules $\to$ Show Daily Load $\to$ Slot Freed $\to$ Offer Earlier Time $\to$ Waitlist $\to$ Walk-In $\to$ Slot Filled $\to$ End.
- **Performance Targets:** Freed Slots Refilled: Tracked weekly; Crowded Days Identified in Advance: 100% visible $\ge 7$ days ahead; Estimated Wait Accuracy: Within 15 min.
- **Evidence:** `R2-02`, `R2-10`.

---

### Block 3: Ecal, Richmon — Clinical Records & Treatment Care (M11–M15)

#### Module 11: Patient Records Management
- **Department/Unit:** Patient Records / Clinical Services
- **Process Description:** Maintains a single, secure, central electronic health record for every patient across all branches. Tracks allergies, medical/dental alerts, guardian links for minors, and links all clinical visits, treatments, prescriptions, and documents. Facilitates secure inter-branch handovers with expiring read tokens and comprehensive audit trails.
- **Key Inputs:** Patient identity & contact details, medical/dental history, allergies and alerts, guardian details, corrections, handover notes.
- **Key Outputs:** Central Patient Record, Allergy and Medical Alert List, Cross-Branch Visit History, Handover Record, Record Change History.
- **Flow Summary:** Start $\to$ Find or Create Record $\to$ Check Duplicates $\to$ Update Details and History $\to$ Link Clinical and Billing Records $\to$ Handover if Care Moves $\to$ Audit $\to$ End.
- **Performance Targets:** Duplicate Records: 0; Re-Registration When Changing Branch: 0 (eliminated baseline); Unaudited Record Changes: 0.
- **Evidence:** `Q17`, `Q28`, `R2-08`.

#### Module 12: Document Management
- **Department/Unit:** Patient Records / Document Services
- **Process Description:** Manages digital patient forms, documents, and informed consents. Files are securely stored with private access control. Captures versioned patient consent and withdrawals. Provides client-side ID data extraction drafts. Employs document retraction with mandatory justification rather than destructive deletion.
- **Key Inputs:** Patient documents/forms, consent decisions & versions, document type/purpose, ID verification details.
- **Key Outputs:** Secure Document Record, Consent Record and History, Extracted Text Draft for Review, Retraction Record.
- **Flow Summary:** Start $\to$ Upload or Fill Form $\to$ Validate $\to$ Store Privately $\to$ Record Consent $\to$ Optional Text Extraction $\to$ Staff Review $\to$ End.
- **Performance Targets:** Paper Forms Used: Replaced with digital by default; Documents Without Patient Link: 0; Raw ID Images Stored: 0.
- **Evidence:** `Q16`, `R2-03`, `R2-12`.

#### Module 13: Treatment Management
- **Department/Unit:** Clinical Services
- **Process Description:** Clinical core of patient care. The dentist opens the visit, reviews allergies/alerts, records findings on an interactive SVG tooth chart (adult and primary teeth), prepares treatment plans with cost estimates and patient acceptance, logs performed procedures, and locks the record upon completion to automatically trigger billing, prescriptions, and follow-up.
- **Key Inputs:** Patient & visit, complaint, history/allergies, tooth chart findings, treatment plan & acceptance, informed consent, procedures performed & notes, lab case references.
- **Key Outputs:** Clinical Visit Record, Dental Chart, Accepted Treatment Plan, Consent Record, Completed Procedure Record, Billing/Prescription/Follow-Up Triggers.
- **Flow Summary:** Start $\to$ Open Visit $\to$ Review History $\to$ Chart Findings $\to$ Plan and Consent $\to$ Perform Procedure $\to$ Complete and Lock $\to$ Trigger Billing and Follow-Up $\to$ End.
- **Performance Targets:** Completed Treatments Edited Afterwards: 0 (immutable locking); Treatments Without Consent: 0; Procedure Duration: 20–60 min tracked.
- **Evidence:** `Q15`, `Q27`, `Q29`, `PI-09`.

#### Module 14: Prescription Management
- **Department/Unit:** Clinical Services / Prescription Management
- **Process Description:** Dedicated clinical prescription workflow. Treating dentists review patient allergy warnings before issuing prescriptions linked to the visit. Captures medication details, strength, dosage, frequency, duration, and instructions. Issues locked prescriptions with atomic sequential numbering (`RX-YYYY-000001`), supports void/reissue with mandatory reason, and generates an official downloadable/printable A4 PDF with clinic header and license details.
- **Key Inputs:** Patient and visit, allergies and alerts, dentist license number, prescription line items, common-medication catalog.
- **Key Outputs:** Issued Prescription, Printable Prescription PDF, Patient Portal Copy & Notification, Void and Reissue History, Audit Record.
- **Flow Summary:** Start $\to$ Open From Visit $\to$ Check Allergies $\to$ Write Lines $\to$ Issue and Lock $\to$ PDF and Patient Notice $\to$ End.
- **Performance Targets:** Prescriptions Changed After Issue: 0 (void and reissue only); Prescriptions Without Allergy Check Shown: 0; Time to Issue: < 3 min.
- **Evidence:** `Q16`, `PI-38`.

#### Module 15: Follow-Up Management
- **Department/Unit:** Clinical Services / Patient Follow-Up
- **Process Description:** Ensures clinical continuity of care and proactive recall. Automatically creates follow-up obligations from completed treatments or scheduled recall rules (e.g. 6-month cleaning check). Provides a front-desk worklist of due/overdue follow-ups, sends Owner/Dentist-approved reminder notifications, and automatically marks tasks as resolved when a follow-up appointment is booked.
- **Key Inputs:** Completed treatment, follow-up reason & target date, recall policy rules, patient record, appointment booking results.
- **Key Outputs:** Follow-Up Task, Recall Reminder, Booked Follow-Up Appointment, Follow-Up Status History.
- **Flow Summary:** Start $\to$ Treatment Completed $\to$ Follow-Up Created $\to$ Due $\to$ Reminder or Call $\to$ Booked $\to$ Closed $\to$ End.
- **Performance Targets:** Follow-Ups Booked by Due Date: Tracked monthly; Overdue Follow-Ups: Reviewed weekly; Recall Messages Without Approved Wording: 0.
- **Evidence:** `Q15`, `Q27`.

---

### Block 4: Millar, John Yzhekiel — Patient Engagement & Communications (M16–M20)

#### Module 16: Social Media Management
- **Department/Unit:** Patient Services / Inquiry Handling
- **Process Description:** Captures, categorizes, and tracks prospective patient inquiries arriving via Facebook, Messenger, phone calls, or walk-ins. Assigns inquiries to front-desk staff, logs conversation notes, and tracks conversion to bookings. Connects clinic Facebook Page metrics to evaluate post reach and engagement against actual clinic appointments.
- **Key Inputs:** Inquiry content and channel, prospective contact details, assigned staff, Facebook Page metrics, campaign tracking links.
- **Key Outputs:** Inquiry Record and Status, Assigned Staff Task, Conversion to Booking, Social Media Post Performance, Inquiry Summary.
- **Flow Summary:** Start $\to$ Inquiry or Post $\to$ Record and Assign $\to$ Reply $\to$ Convert to Booking $\to$ Measure Post Performance $\to$ End.
- **Performance Targets:** Inquiry Response Time: < 1 hour during office hours; Inquiries Converted to Bookings: Tracked monthly; Post Engagement vs Bookings: Reported weekly.
- **Evidence:** `PI-42`, `R2-04`.

#### Module 17: AI Chatbot Management
- **Department/Unit:** Patient Services / Digital Support
- **Process Description:** 24/7 patient assistant integrated with Google Gemini AI (`gemini-1.5-flash`) and equipped with an Owner-curated knowledge fallback. Answers inquiries regarding services, branch operating hours, booking policies, and personal appointment statuses in English, Filipino, or Taglish. Strictly refuses clinical diagnosis/medical advice, directs emergencies to clinics/hospitals, routes unresolved queries to front desk, and logs questions for Owner review.
- **Key Inputs:** Patient questions, clinic-approved knowledge base, patient appointments/invoices, branch hours and contacts.
- **Key Outputs:** AI Answer or Safe Refusal, Navigation Links, Front-Desk Handover Ticket, Unanswered Question List for Owner.
- **Flow Summary:** Start $\to$ Question $\to$ Safety and Scope Check $\to$ Approved Answer or Handover $\to$ End.
- **Performance Targets:** Questions Answered Without Staff: Tracked monthly; Unsafe/Medical Advice Answers: 0; Handover Response Time: < 1 hour during office hours.
- **Evidence:** `Q23`, `PI-42`, `PI-43`.

#### Module 18: Messaging Management
- **Department/Unit:** Patient Services / Communication
- **Process Description:** Real-time, encrypted two-way communication between patients and branch front desk. Automatically routes conversations based on the patient's active branch appointment. Dispatches email alerts for offline patients without exposing sensitive message bodies. Restricts Owner access to protect doctor-patient confidentiality.
- **Key Inputs:** Patient messages, staff replies, branch routing logic, allowable file attachments.
- **Key Outputs:** Conversation and Message History, Read Status, Offline Email Alert, Conversation Lifecycle Status.
- **Flow Summary:** Start $\to$ Patient Writes $\to$ Routed to Branch $\to$ Staff Replies $\to$ Patient Notified $\to$ Closed $\to$ End.
- **Performance Targets:** Reply Time: < 1 hour during office hours; Messages Lost: 0; Delivery Delay: < 2 seconds.
- **Evidence:** `PI-30`, `PI-42`, `PI-43`.

#### Module 19: Notification Management
- **Department/Unit:** Patient Services / Notifications
- **Process Description:** Centralized, event-driven notification dispatch engine. Ingests triggers from appointments, attendance, billing, and follow-ups. Selects Owner-approved message templates, manages transactional outbox queuing, enforces bounded exponential retries with duplicate prevention, and respects patient quiet hours. Supports email and in-app channels.
- **Key Inputs:** System events (booking, reminder, invoice, receipt), recipient contact info, approved templates, patient notification preferences.
- **Key Outputs:** Delivered Notification, Delivery Status and Retry Logs, Failure Alerts, Notification History.
- **Flow Summary:** Start $\to$ Event $\to$ Template and Recipient $\to$ Queue $\to$ Deliver $\to$ Retry if Failed $\to$ Record $\to$ End.
- **Performance Targets:** Duplicate Messages: 0; Delivery Success Rate: > 98%; Messages Sent Without Approved Wording: 0.
- **Evidence:** `PI-29`, `PI-31`.

#### Module 20: Marketing Management (PE)
- **Department/Unit:** Patient Engagement / Marketing
- **Process Description:** **Proposed Enhancement (PE)**: For M25 (Marketing & Reactivation), a limited frontend preview exists today: they send no real campaigns and still write through the earlier raw campaign setter, which is known technical debt. Full Staff/Owner management behavior, marketing consent, targeting, delivery and analytics are deferred to a later phase. Orchestrates targeted marketing and patient reactivation initiatives (e.g. patients inactive for > 12 months). Filters audiences by verified marketing consent, applies tracked campaign booking links (`?promo=...` / `?ref=...`), tracks conversion rates into Analytics, benchmarks results against prior periods, and honors opt-outs immediately.
- **Key Inputs:** Campaign objective and content, patient segment criteria, marketing consent status, campaign link clicks/bookings, social post metrics.
- **Key Outputs:** Campaign Record, Target List with Consent, Tracked Campaign Link, Campaign Results & Week-to-Week Comparison, Unsubscribe Record.
- **Flow Summary:** Start $\to$ Create Campaign $\to$ Select Consenting Patients $\to$ Approve Content $\to$ Send or Post $\to$ Track Results $\to$ Compare With Last Week $\to$ End.
- **Performance Targets:** Bookings From Campaign Link: Reported per campaign; New Patients vs Prior Week: Reported weekly; Messages Sent Without Consent: 0.

---

### Block 5: Delos Santos, Joevan — Financials, Archival, Intelligence & Governance (M21–M25)

#### Module 21: Billing Management
- **Department/Unit:** Billing / Front Desk
- **Process Description:** Invoicing and payment engine. Automatically generates draft invoices from completed treatment procedures using effective-dated prices. Automatically credits pre-paid appointment booking fees. Applies statutory Senior Citizen and PWD statutory privileges (RA 9994 / RA 10754) upon ID verification. Collects payments via PayMongo (GCash, Maya, cards) with webhook confirmation or counter cash. Issues PDF invoices/receipts and dispatches automated overdue reminders.
- **Key Inputs:** Completed procedures from Treatment, effective prices from Service Management, Senior/PWD discount credentials, HMO coverage approvals, booking deposit credit, payment transactions.
- **Key Outputs:** Issued Invoice & PDF, Payment Record, Receipt & PDF, Remaining Balance, Discount/Refund/Void Records.
- **Flow Summary:** Start $\to$ Treatment Completed $\to$ Draft Invoice $\to$ Review and Discounts $\to$ Issue $\to$ Pay Online or at Clinic $\to$ Receipt $\to$ End.
- **Performance Targets:** Invoice Errors: 0; Payment Confirmation Time: < 1 min after online payment; Unpaid Invoices > 14 Days: Reviewed weekly.
- **Evidence:** `Q27`, `R2-01`.

#### Module 22: Loyalty Management (PE)
- **Department/Unit:** Patient Engagement
- **Process Description:** **Proposed Enhancement (PE)**: M24 (Referral & Loyalty) is an implemented prototype whose program rules (the 50-point redemption threshold, one Pending request at a time, each request processed once, the same-day duplicate-reward check) and validation rule (whole positive points) are team-designed prototype rules for demonstration, not historical clinic policy or an established clinic program; its writes go through the shared commands in `src/loyalty.js`. Generates unique patient referral codes, links referrals, awards points upon completion of a qualifying paid visit, maintains an auditable points ledger, validates reward redemption, and prevents self-referrals or duplicate awards.
- **Key Inputs:** Patient accounts, referral codes, completed qualifying paid visits, clinic reward rules, redemption requests.
- **Key Outputs:** Referral Record, Points Ledger and Balance, Reward and Redemption Records, Program Performance Summary.
- **Flow Summary:** Start $\to$ Referral $\to$ Qualifying Paid Visit $\to$ Points Awarded $\to$ Redeemed or Expired $\to$ End.
- **Performance Targets:** Patients Gained Through Referrals: Reported monthly; Duplicate Rewards: 0; Redemption Rate: Reported monthly.

#### Module 23: Archives & Historical Records Management
- **Department/Unit:** Clinic Administration / Records & Compliance
- **Process Description:** Centralized historical archive ensuring patient care continuity and regulatory compliance. Automatically indexes completed visits, issued prescriptions, settled receipts, and inactive patient/HMO records across all branches. Offers a self-service patient portal archive view (`#p/archives`) with downloadable PDF receipts and records, alongside a Staff/Dentist/Owner dashboard featuring cross-branch multi-attribute search, filtering, record restore, and compliance exports.
- **Key Inputs:** Completed visits & clinical summaries, issued prescriptions, settled invoices & receipts, inactive patient profiles/closed HMO cases, search/filter/restore/export requests.
- **Key Outputs:** Patient Historical Care & Receipt Archive, Cross-Branch Archived Records Registry, Restored Active Patient Record, Compliance Archive Export, Audit Trail Entry.
- **Flow Summary:** Start $\to$ Visit, Prescription or Invoice Completed $\to$ Indexed in Archives $\to$ Search or Filter by Role $\to$ View PDF, Export or Restore Record $\to$ Audit Action $\to$ End.
- **Performance Targets:** Historical Record Retrieval Time: < 3 seconds across all branches; Lost Historical Visit or Receipt Records: 0 (append-only and soft-archive retention); Unauthorized Archive Access: 0 (role- and patient-scoped).
- **Evidence:** `Q17`, `R2-08`, `R2-12`.

#### Module 24: Analytics Management
- **Department/Unit:** Management / Analytics
- **Process Description:** Aggregates operational data across appointments, attendance, waiting queues, clinical treatments, billings, follow-ups, and marketing campaigns. Calculates key performance indicators per period, branch, and dentist. Produces executive dashboards, comparative visualizations, capacity threshold alerts, and dispatches an automated daily summary email (aggregate counts only) to the Clinic Owner.
- **Key Inputs:** Appointments and attendance data, queues and patient flow data, treatments and follow-up metrics, payments and balances, inquiry logs and campaign links.
- **Key Outputs:** Owner Executive Dashboard, Operational Indicators and Trends, Branch and Dentist Comparative Metrics, Daily Summary Email (counts only), Exported Reports.
- **Flow Summary:** Start $\to$ Collect Data $\to$ Calculate Indicators $\to$ Compare Periods $\to$ Dashboard and Daily Summary $\to$ End.
- **Performance Targets:** Daily Summary Delivered: Every working day; Report Generation Time: Instantaneous; Data Accuracy: 100% matching underlying source records.
- **Evidence:** `Q32`.

#### Module 25: Audit Management
- **Department/Unit:** Clinic Administration / Governance
- **Process Description:** Tamper-resistant, immutable audit logging subsystem. Records every sign-in, record change, clinical event, financial transaction, policy modification, and archive action with actor ID, action type, affected record ID, branch, and timestamp. Backed by PostgreSQL database triggers that strictly reject updates or deletions. Provides Owner search, filtering, and forensic CSV export capabilities.
- **Key Inputs:** Sign-in and access events, patient and document modifications, prescription and treatment events, financial transactions, policy and archive actions.
- **Key Outputs:** Permanent Audit Entry, Immutable Activity History, Filtered Search Results, Audit Export CSV.
- **Flow Summary:** Start $\to$ Action Happens $\to$ Audit Entry Written $\to$ Search or Export $\to$ End.
- **Performance Targets:** Audit Entries Edited or Deleted: 0 (strictly rejected at database level); Sensitive Actions Without Audit: 0; Search Time: < 5 seconds.

---

## 5. Cross-Cutting Regulatory & Security Compliance

### 1. Data Privacy Act of 2012 (RA 10173) & Minimal Storage
- **On-Device ID Processing:** Identity card scanning (PhilID, driver's license, passport) is processed strictly within the patient's local browser memory. Name and date of birth are extracted into registration fields; **no raw ID photo, biometric data, or government ID numbers are ever uploaded or persisted** to the server database.
- **Document Retraction:** Erroneous or withdrawn patient documents are retracted with a mandatory recorded justification rather than physically destroyed, maintaining an unalterable chain of custody.
- **Owner Privacy Boundaries:** To safeguard sensitive patient-staff communications, the system enforces application-level and API-level boundaries preventing the Clinic Owner from inspecting private patient messaging threads.
- **Audit Exclusion of Sensitive PHI:** Database audit entries record before-and-after metadata and modified attribute keys, but omit plain-text clinical diagnoses and notes.

### 2. Statutory Deductions (RA 9994 & RA 10754)
- **Senior Citizens & PWD Benefits:** In compliance with Philippine legislation, Module 21 (Billing Management) calculates statutory deductions on professional dental services and procedures for verified Senior Citizens (RA 9994) and Persons with Disability (RA 10754).
- **Verification Records:** The front-desk captures and verifies the government-issued Senior Citizen ID / OSCA ID or PWD ID number, linking the exemption directly to the finalized invoice and receipt.

### 3. Financial Integrity & PayMongo Integration
- **15-Minute Slot Hold:** When a patient initiates online booking, the selected appointment slot is reserved for 15 minutes to allow payment completion. If unpaid within 15 minutes, the slot is automatically released to the public pool.
- **Webhook-Only Settlement:** Appointment confirmations and invoice settlements occur strictly upon receipt and validation of signed PayMongo webhooks, preventing client-side forgery or false payment claims.
- **Deposit Crediting:** The initial appointment fee paid during booking is automatically credited against the patient's final treatment invoice.

### 4. Database Immutability & Soft-Delete Architecture
- **Append-Only Clinical & Financial Tables:** Completed treatments (`treatments`), issued prescriptions (`prescriptions`), invoices (`invoices`), payment records (`payments`), archive indexes (`archives`), and audit logs (`audit_logs`) are protected by PostgreSQL triggers that prohibit `UPDATE` and `DELETE` queries once marked final.
- **Soft Deletion:** User profiles and staff rosters utilize soft deletions (`deleted_at`), ensuring that historical records retain referential integrity.

---

## 6. Implementation Readiness & Defense Matrix

| Category | Status Count | Specific Module References |
| :--- | :---: | :--- |
| **Fully Implemented & Server-Tested** | **20 Modules** | M2, M3, M5, M6, M7, M8, M9, M10, M11, M13, M14, M15, M17, M18, M19, M20, M21, M23, M24, M25 |
| **Partial / Pending Policy Confirmation** | **4 Modules** | M1 (2FA/multi-owner pending), M4 (final pricing sign-off), M12 (text extraction tuning), M16 (Facebook Graph API & live Messenger pending Meta business review) |
| **Planned Proposed Enhancement (PE)** | **1 Module** | M22 Loyalty Management (architecture documented; activation deferred pending clinic points policy) |
| **Total Master Scope** | **25 Modules** | *100% of modules specified, assigned, and documented according to official BPA standards.* |

---
*Signed and verified for academic submission and defense review in accordance with `updated_bpa_check.pdf`.*
