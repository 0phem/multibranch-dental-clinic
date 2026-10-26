# Final Module List for the Defense (Official 25-Module Paper Alignment)

Updated on 2026-10-22 to strictly align with the group's official paper `BPA_MODULES_UPDATED_OCT_20_2026.docx` and `BPA_MODULES_UPDATED_OCT_22_2026.docx` (25 modules total, with each member owning an exact block of 5 connected modules). Checked and verified against the live implementation and tests on branch `feat/auth-messaging-paymongo`. A status is never higher than what the code and tests prove.

**Status words:**
- **Implemented**: Works end to end on the clinic server with database integrity and is covered by tests.
- **Partial**: The core works and is tested; specific extensions or clinic policy decisions are pending.
- **Planned**: Designed in the paper architecture, scheduled on the post-defense roadmap.

Test paths are under `backend/tests/Feature/` unless they start with `tests/` (frontend). Verbatim clinic interview evidence (Q, PI, R2) is documented in [`INTERVIEW_EVIDENCE.md`](INTERVIEW_EVIDENCE.md).

---

## Old-to-New Module Traceability Table (Official 25-Module Architecture)

Traceability between the older internal catalog and the official 25-module paper:

| Paper No. | Official Module Name | Owner | Old Internal Number / Feature Mapping | Implementation Status |
| :---: | :--- | :--- | :--- | :--- |
| **M1** | User Management | Licanda | Old M1 (accounts, OTP, roles, claim) | Partial |
| **M2** | Branch Management | Licanda | Old M2 (branches, hours, closed dates, contacts) | Implemented |
| **M3** | Staff Management | Licanda | Old M3 Work Schedules + Old M15 Leave Management | Implemented |
| **M4** | Service Management | Licanda | Old M13 Services & Pricing, consultation-first | Partial |
| **M5** | Clinic Policy Management | Licanda | Owner settings (late/cancellation, reminders, branding, templates) | Implemented |
| **M6** | Appointment Management | Alejo | Old M6 (one-flow booking, availability, PayMongo pay-at-booking) | Implemented |
| **M7** | Attendance Management | Alejo | Paper M7 (attendance replies, late arrivals, no-show flags) | Implemented |
| **M8** | Check-In Management | Alejo | Old M8 (check-in, walk-ins, counter QR self-registration) | Implemented |
| **M9** | Queue Management | Alejo | Old M9 (queue numbers, state transitions, late resequencing) | Implemented |
| **M10** | Patient Flow Management | Alejo | Calendar daily load, freed-slot move-up offers, waitlist | Implemented |
| **M11** | Patient Records Management | Ecal | Old M4 Patient Records + Old M25 Patient Handovers | Implemented |
| **M12** | Document Management | Ecal | Old M14 (documents, intake consent, ID scan prefill) | Partial |
| **M13** | Treatment Management | Ecal | Old M5 Treatment Management + Old M10 SVG Dental Chart | Implemented |
| **M14** | Prescription Management | Ecal | Old M19 (server prescriptions, issuing, A4 PDF) | Implemented |
| **M15** | Follow-Up Management | Ecal | Old M20 (server follow-up tasks, recall reminders) | Implemented |
| **M16** | Social Media Management | Millar | Old M16 (inquiries, campaign tracking) | Partial |
| **M17** | AI Chatbot Management | Millar | Old M7 (clinic assistant, Google Gemini AI gemini-1.5-flash with knowledge fallback) | Implemented |
| **M18** | Messaging Management | Millar | Old M17 (encrypted patient messaging, branch routing) | Implemented |
| **M19** | Notification Management | Millar | Old M18 (outbox, reminder emails, in-app notifications) | Implemented |
| **M20** | Marketing Management | Millar | Promotion & referral code attribution (?promo= / ?ref=), campaign conversion tracking | Implemented |
| **M21** | Billing Management | Delos Santos | Old M11 Billing + Old M23 PayMongo + 20% Senior/PWD discount | Implemented |
| **M22** | Loyalty Management | Delos Santos | Proposed enhancement (ledger-backed loyalty points & rewards) | Partial |
| **M23** | Archives & Historical Records Management | Delos Santos | Cross-branch historical care and receipt archive, patient portal (#p/archives), restore/export | Implemented |
| **M24** | Analytics Management | Delos Santos | Old M21 (Owner metrics, promotions & campaign tracking, daily summary email counts) | Implemented |
| **M25** | Audit Management | Delos Santos | Old M22 (append-only database audit trail, policy and archive actions, CSV export) | Implemented |

---

## Summary

| State | Count | Modules |
| --- | :---: | --- |
| **Implemented** | **20** | M2, M3, M5, M6, M7, M8, M9, M10, M11, M13, M14, M15, M17, M18, M19, M20, M21, M23, M24, M25 |
| **Partial** | **5** | M1, M4, M12, M16, M22 |
| **Mock only** | **0** | — (All mock prototypes replaced by server implementations) |
| **Planned / Roadmap** | **—** | Treatment plans, lab cases, Facebook Graph API insights, formal BIR accreditation |

---

## Detailed Module Breakdown (Official 25 Modules)

### Block 1: Licanda — Governance & Practice Foundations (M1–M5)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M1 User Management** | Partial | Patient self-registration with 6-digit email OTP; password reset; employee invitations by email; four roles enforced at database and middleware levels (`patient`, `staff`, `dentist`, `owner`). On-device ID scan prefill (name and DOB only, zero image/ID storage). Secure account claiming. *Pending*: multiple Owner accounts, 2FA. | `Auth/*`, `Identity/EmployeeInvitationTest`, `RbacTest`, `Intake/IntakeTest`, `tests/intake.test.js` | PI-01, PI-02, R2-03, R2-12 |
| **M2 Branch Management** | Implemented | Three real clinic branches (Bocaue Main, Bocaue Annex, Guiguinto) with contacts, map positions, operating hours per weekday. Owner branch config. Holiday/closed date calendar with affected appointment reschedule flows (never cancels). Public landing page branch directory. | `Reference/*`, `Appointments/BranchHoursTest`, `Reference/PublicBranchesTest`, `tests/landing.test.js` | Q2, PI-14, PI-15, R2-08, R2-13 |
| **M3 Staff Management** | Implemented | Weekly work schedules per dentist, branch, and weekday with break intervals and exceptions (unifies old M3 & M15). Leave requests (vacation, sick, other) with Owner approval, leave calendar strip, conflict detection with suggested cover, and zero-cancellation reschedule notices. | `Staffing/WorkSchedulesTest`, `Staffing/LeaveTest`, `tests/staffing.test.js` | PI-05, PI-06, PI-08 |
| **M4 Service Management** | Partial | Clinical procedure services with durations, branch availability, versioned pricing. Consultation-first enforcement for complex procedures (e.g. braces). *Pending*: final clinic-approved price list and installment terms. | `Pricing/*`, `Automations/InterviewRoundTwoTest`, `tests/m13-pricing.test.js` | Q1, Q12, R2-13, R2-17 |
| **M5 Clinic Policy Management** | Implemented | Centralized Owner settings for reminder intervals, late arrival tolerances, cancellation limits, overdue invoice notices, recall periods, and brand colours/logo. Template wording approval required before any automation is activated; full audited configuration history. | `Automations/InterviewRoundTwoTest`, `Automations/AutomationsTest`, `tests/branding.test.js` | R2-09, R2-11 |

---

### Block 2: Alejo — Patient Flow & Scheduling (M6–M10)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M6 Appointment Management** | Implemented | Conflict-free online booking (real availability, double-booking database guard, Sunday closure). PayMongo pay-at-booking integration (GCash, Maya, card) with 15-minute slot hold, webhook-only confirmation, automatic refund for cancellation $\ge 24$h, discretionary refund for $< 24$h/no-show, and deposit credited to visit invoice. | `Appointments/*`, `Payment/AppointmentBookingPaymentTest`, `tests/patient-portal.test.js` | Q20, Q27, Q28, Q29, PI-29, R2-02, R2-13, Section 22 |
| **M7 Attendance Management** | Implemented | 60-minute pre-visit reminders with signed single-use "I'll be there" / "I can't make it" actions. 5/10/15-minute late-arrival progression with front-desk undo. No-show tracking requiring staff confirmation after 3 occurrences in 6 months; late cancellation tracking. | `Automations/AutomationsTest`, `Automations/InterviewRoundTwoTest`, `Visits/*` | R2-07, R2-09, R2-10, R2-13 |
| **M8 Check-In Management** | Implemented | Counter check-in of booked patients and walk-ins. Counter QR self-registration with daily code; on-device ID scan prefill (no image stored); cross-branch duplicate record detection with staff confirmation into the dentist queue. | `Visits/*`, `Intake/IntakeTest`, `tests/intake.test.js` | Q15, PI-13, PI-21, R2-03, R2-06 |
| **M9 Queue Management** | Implemented | Authoritative server queue numbering and state machine (`Arrived` $\to$ `In Treatment` $\to$ `Served`). Late-arriving patients resequenced to end of queue with audited staff override. Dedicated dentist and patient-facing queue displays. | `Queue/*`, `Automations/InterviewRoundTwoTest`, `tests/production-shell.test.js` | Q19, Q21, PI-24, PI-25, R2-07 |
| **M10 Patient Flow Management** | Implemented | Staff and Owner day/week/month calendar load analysis showing booked minutes against dentist capacity. Freed-slot move-up offers (offered first to later booked patients, then waitlist, then walk-ins). Dynamic waitlist notifications. | `Automations/InterviewRoundTwoTest`, `tests/m6-staff-day-calendar.test.js` | R2-02, R2-10 |

---

### Block 3: Ecal — Clinical Records & Treatment Care (M11–M15)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M11 Patient Records Management** | Implemented | Shared patient chart across all branches, audited demographic edits, cross-branch duplicate matching. Inter-branch patient handovers (summary, pending procedures, document references) with time-limited read authorization and audit logging. | `Patients/PatientRecordTest`, `ConcurrentPatientRecordTest`, `Staffing/HandoverTest`, `tests/staffing.test.js` | Q17, Q28, R2-03, R2-06, R2-08 |
| **M12 Document Management** | Partial | Secure document upload and download with signed URLs, versioned patient consent at registration, document retraction with reason instead of deletion. On-device ID prefill drafts. *Pending*: production text extraction pipelines. | `Documents/DocumentManagementTest`, `tests/intake.test.js` | Q16 |
| **M13 Treatment Management** | Implemented | Visit-linked treatment entry by treating dentist, append-only trigger locking on completion, automated draft invoice creation. Interactive SVG Dental Chart supporting 32 adult and 20 primary teeth (FDI/Universal), condition marking, tooth history, and patient portal view. *Planned*: multi-phase treatment plans, lab cases. | `Treatments/TreatmentTest`, `Charts/DentalChartTest`, `tests/m10-dental-chart.test.js` | Q15, Q17, Q27, Q29, PI-09 |
| **M14 Prescription Management** | Implemented | Server-authoritative prescription workflow replacing earlier browser mock. Free-text medication lines (drug, dosage, frequency, duration, instructions), allergy warning check, atomic sequential numbering (`RX-YYYY-000001`), voiding with reason, downloadable A4 PDF with clinic header, license number, and signature line. | `Prescriptions/PrescriptionTest`, `Prescriptions/ConcurrentPrescriptionTest`, `tests/m19-prescriptions.test.js` | Q16, PI-38 |
| **M15 Follow-Up Management** | Implemented | Server follow-up tasks generated from completed treatments or created by staff/dentists. Lifecycle tracking (`Open` $\to$ `Contacted` $\to$ `Booked` $\to$ `Closed`), automatic closure on rebooking, front-desk worklist with overdue alerts, and recall reminders with Owner/dentist wording sign-off. | `Followups/FollowupTest`, `tests/m20-followups.test.js` | Q15, Q27, R2-11 |

---

### Block 4: Millar — Patient Engagement & Communications (M16–M20)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M16 Social Media Management** | Partial | Staff-recorded inquiry log with channel attribution, assignee, and resolution outcome. Campaign tracking links (`?ref=...`) measuring bookings and accounts. *Planned*: Facebook Page Graph API insights and live Messenger webhook integration post-defense. | `Inquiries/*`, `tests/production-shell.test.js` | PI-42, PI-43 |
| **M17 AI Chatbot Management** | Implemented | Clinic Assistant powered by Google Gemini AI (`gemini-1.5-flash`) with curated clinic knowledge fallback operating on approved clinic answers and live schedule data. Supports English, Filipino, and Taglish; safely handles unknown questions by routing to front desk; refuses clinical diagnosis and third-party data leakage. | `Assistant/AssistantKnowledgeTest`, `Assistant/AssistantTest`, `tests/public-auth-site.test.js` | Q23, PI-42, PI-43 |
| **M18 Messaging Management** | Implemented | Real-time encrypted communication between patients and branch front desk. Automatic branch routing based on active bookings; offline email notifications with zero message body exposure; Owner access restricted for patient confidentiality. | `Messaging/*`, `tests/production-shell.test.js` | PI-30, PI-42, PI-43 |
| **M19 Notification Management** | Implemented | Reliable outbox dispatch engine with automatic retry progression (up to 4 attempts), dead-letter handling, idempotent message keys, real-time in-app notifications, and strict Owner wording approval gating. | `Mail/*`, `Automations/AutomationsTest`, `tests/production-shell.test.js` | PI-29, PI-31, R2-07, R2-09, R2-11 |
| **M20 Marketing Management** | Implemented | Campaign link and referral code attribution (`?promo=...` / `?ref=...`), patient acquisition conversion tracking into Analytics dashboard, week-over-week performance comparisons, and re-booking reminders. | `Analytics/*`, `Automations/AutomationsTest` | HANDOFF Section 20 |

---

### Block 5: Delos Santos — Financials, Automation & Accountability (M21–M25)

| Module | Status | What Works Today | Evidence | Interview Basis |
| :--- | :---: | :--- | :--- | :--- |
| **M21 Billing Management** | Implemented | Automated invoice generation from completed treatment procedures; Staff review and issue flow; PayMongo hosted checkout (GCash, Maya, card); webhook-driven payment settlement; booking deposit credit deduction; **20% Senior Citizen and PWD statutory discount (RA 9994 / RA 10754)** with ID type and number validation; PDF invoices and receipts; overdue payment notices. | `Billing/BillingTest`, `Payment/PayMongoPaymentTest`, `Payment/AppointmentBookingPaymentTest`, `tests/production-shell.test.js` | Q27, Section 21, Section 22 |
| **M22 Loyalty Management** | Partial | Proposed enhancement: Double-entry referral and loyalty point ledger engine; balance calculation; reward catalog; patient redemption request flow. *Pending*: final clinic-wide points redemption policy confirmation. | `tests/phase4b2-loyalty.test.js`, `src/pages/Loyalty.jsx` | HANDOFF Section 20, 21 |
| **M23 Archives & Historical Records Management** | Implemented | Cross-branch archive and retrieval for completed visit summaries, issued prescriptions, settled receipts, and inactive patient/HMO records. Dedicated self-service patient portal archives view (`#p/archives`) with downloadable PDF receipts and records; Staff/Dentist/Owner dashboard with search, type/branch/date filtering, record restore, and compliance CSV export. | `Archives/*`, `tests/m23-archives.test.js`, `src/pages/ArchivesPage.jsx`, `src/patient/pages/Archives.jsx` | Q17, R2-08, R2-12 |
| **M24 Analytics Management** | Implemented | Executive Owner metrics: daily patient volume, revenue, branch load, late arrival counts, slot refill attribution, promotions & campaign performance tracking, and automated daily summary email (aggregate counts only). *Pending*: advanced date range filtering and forensic exports. | `Analytics/*`, `Automations/AutomationsTest`, `tests/production-shell.test.js` | Q32, R2-11 |
| **M25 Audit Management** | Implemented | Append-only database audit trail enforced by database triggers; tracks logins, financial transactions, configuration changes, policy and archive actions, and patient record access (field names only, no PHI values); Owner inspection modal and forensic CSV export. | `Audit/*`, `tests/m22-audit-trail.test.js` | Section 20 |

---

## Data Retention & Security Architecture (RA 10173 Compliance)

| Module Category | Database Retention Mechanism | Status |
| :--- | :--- | :---: |
| **M1 Accounts & Profiles** | Soft delete (`users.deleted_at`); active sessions revoked immediately; audit trail retains actor and timestamp. | Implemented |
| **M6, M8, M9, M13, M14, M21, M23, M25 Records** | Append-only tables protected by database triggers. The database refuses `DELETE` and unauthorized `UPDATE` statements on completed treatments, issued prescriptions, invoices, payments, historical archive indexes, and audit logs. | Implemented |
| **M12 Patient Documents** | Retraction with mandatory reason instead of deletion; audit log records retraction metadata. | Implemented |
| **Intake ID Scans** | Processed strictly on the client device (PhilID QR, passport MRZ, on-device OCR); zero raw image or ID number upload/storage. | Implemented |
| **Historical Archives (M23)** | Append-only and soft-archive retention across visits, prescriptions, receipts, and profiles; patient self-service retrieval via `#p/archives`. | Implemented |
