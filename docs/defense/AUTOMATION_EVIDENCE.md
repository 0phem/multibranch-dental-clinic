# Automation Evidence: What the System Automates, Module by Module

Aligned with the official 26-module paper `BPA_MODULES_UPDATED_OCT_20_2026.docx`.

**Status words:**
- **Built**: Server-authoritative with database integrity, tested, and verifiable in the live UI.
- **Partly built**: The core works and is tested; specific extensions or clinic policy confirmations are pending.
- **Planned**: Designed in the paper architecture, scheduled on the post-defense roadmap.

Interview citations (Q, PI, R2) are verbatim in [`INTERVIEW_EVIDENCE.md`](INTERVIEW_EVIDENCE.md). Test paths are under `backend/tests/Feature/` unless they start with `tests/` (frontend).

---

## Summary (Official 26 Modules)

| Module | Status | What the System Automates | Show It Live |
| :--- | :---: | :--- | :--- |
| **M1 User Management** | Partly built | Email codes (OTP) for self-registration, password reset, and email change; security alerts; employee invitations; on-device ID scan prefill (no image stored). | Register $\to$ code email $\to$ sign in |
| **M2 Branch Management** | Built | Three real branches, operating hours per weekday, closed dates and holiday notices with reschedule invitations. | Owner $\to$ Branches; Public website |
| **M3 Staff Management** | Built | Weekly work schedules per dentist and branch, dated exceptions, leave requests with Owner approval, and zero-cancellation reschedule notices. | Owner $\to$ Team $\to$ Work Schedules / Leave |
| **M4 Service Management** | Partly built | Clinical procedure catalog with durations, branch availability, versioned prices, and consultation-first booking rules. | Owner $\to$ Pricing |
| **M5 Clinic Policy Management** | Built | Centralized Owner settings for reminder timings, late-arrival limits, cancellation policies, branding, and template wording approval. | Owner $\to$ Clinic Branding / Automations |
| **M6 Appointment Management** | Built | Conflict-free online booking, database double-booking guard, nearest branch suggestion, and PayMongo pay-at-booking with 15-min slot hold and auto-refunds. | Patient $\to$ Book a visit; PayMongo test checkout |
| **M7 Attendance Management** | Built | 60-min pre-visit reminders with single-use "I'll be there" / "I can't make it" buttons; 5/10/15-min late-arrival flow; no-show tracking. | Owner $\to$ Automations $\to$ Demo clock |
| **M8 Check-In Management** | Built | Counter check-in of booked patients and walk-ins; counter QR poster self-registration with daily code; kiosk mode; cross-branch duplicate detection. | Staff $\to$ Check-In; Mobile `#join/b1` |
| **M9 Queue Management** | Built | Server queue numbers, status progression (`Arrived` $\to$ `In Treatment` $\to$ `Served`), and late-arrival resequencing to end of queue. | Staff $\to$ Queue; Patient live queue |
| **M10 Patient Flow Management** | Built | Staff/Owner calendar load analysis (% booked minutes vs dentist capacity), freed-slot move-up offers, and waitlist notifications. | Staff $\to$ Calendar (Week/Month) |
| **M11 Patient Records Management** | Built | Shared patient charts across branches, audited edits, and secure inter-branch patient handovers with expiring read access. | Staff $\to$ Patients; Staff $\to$ Handovers |
| **M12 Document Management** | Partly built | Private document upload/download with signed URLs, versioned patient consent at intake, and retraction with reason instead of deletion. | Patient $\to$ Documents |
| **M13 Treatment Management** | Built | Visit-linked treatment completion lock, automated invoice drafting, and interactive SVG Dental Chart (32 adult / 20 primary teeth) with tooth history. | Dentist $\to$ Dental Chart / Treatment |
| **M14 Prescription Management** | Built | Dentist prescription issuance, sequential numbering (`RX-YYYY-000001`), voiding with reason, patient portal access, and downloadable A4 PDF. | Dentist $\to$ Prescriptions $\to$ Issue RX |
| **M15 Follow-Up Management** | Built | Server follow-up tasks generated from completed treatments, front-desk worklist, automatic rebooking closure, and recall reminders. | Staff $\to$ Follow-Up Tasks |
| **M16 Social Media Management** | Partly built | Staff-recorded patient inquiries with attribution, assignment, and resolution outcome; tracked campaign links (`?ref=...`). | Staff $\to$ Inquiries |
| **M17 AI Chatbot Management** | Built | Clinic Assistant answering in English, Filipino, and Taglish strictly from approved clinic facts; refuses medical advice; hands off to front desk. | Patient $\to$ Ask us; Owner $\to$ Assistant |
| **M18 Messaging Management** | Built | Real-time encrypted communication between patient and branch front desk, auto-branch routing, and offline email alerts. | Patient $\leftrightarrow$ Staff Messages |
| **M19 Notification Management** | Built | Reliable outbox dispatch engine with automatic retry progression (up to 4 attempts), real-time in-app alerts, and Owner wording approval gating. | Patient bell; Owner $\to$ Automations |
| **M20 Marketing Management** | Partly built | Campaign link attribution, new patient acquisition tracking, and week-over-week performance comparisons. | Owner $\to$ Analytics |
| **M21 Billing Management** | Built | Invoices from treatment, PayMongo online payment (GCash/card), booking payment credit, 20% Senior Citizen & PWD statutory discount (RA 9994 / RA 10754), and PDF receipts. | Staff $\to$ Billing; Patient $\to$ Review and pay |
| **M22 Loyalty Management** | Partly built | Double-entry loyalty points ledger, balance calculation, reward catalog, and patient redemption requests. | Patient $\to$ Loyalty |
| **M23 Automation Management** | Built | Six core clinic automations (A1–A6) with Owner wording approval gating and idempotent delivery keys. | Owner $\to$ Automations |
| **M24 Analytics Management** | Partly built | Executive Owner metrics: daily patient counts, revenue, branch load, and automated daily summary email. | Owner $\to$ Analytics |
| **M25 Audit Management** | Built | Append-only database audit trail enforced by database triggers; Owner search and forensic CSV export. | Owner $\to$ Audit Trail $\to$ Export CSV |
| **M26 Feedback Management** | Built | Post-visit 1–5 star rating and feedback collection, Owner review screen with branch/dentist filters, and auto follow-up tasks for 1–2 star ratings. | Patient $\to$ Feedback; Owner $\to$ Feedback |

---

## Core Automations in Detail

### 1. PayMongo Pay-at-Booking & Settlement (M6, M21)
- **Automates:** Online booking fee collection via PayMongo Checkout (GCash, Maya, cards); 15-minute slot reservation hold; webhook-driven confirmation; automated full refunds on cancellations $\ge 24$h; booking deposit credited directly against the post-treatment invoice.
- **Proof:** `Payment/AppointmentBookingPaymentTest`, `Payment/PayMongoPaymentTest`, `Billing/BillingTest`.

### 2. 20% Senior Citizen & PWD Statutory Discount (M21)
- **Automates:** Front-desk application of 20% statutory discount under Republic Acts 9994 & 10754 on draft invoices. Validates ID type and non-empty ID number, recalculates invoice balance, and displays the discount line item on official PDF invoices and payment receipts.
- **Proof:** `Billing/BillingTest::test_staff_can_apply_senior_or_pwd_statutory_discount`.

### 3. Interactive SVG Dental Chart & Treatment Flow (M13)
- **Automates:** Dental tooth condition mapping across 32 adult and 20 primary teeth. History is append-only per tooth (trigger-protected). Treatment completion locks clinical records and generates draft invoices for front-desk review.
- **Proof:** `Charts/DentalChartTest`, `Treatments/TreatmentTest`, `tests/m10-dental-chart.test.js`.

### 4. Sequential Server Prescriptions & Follow-Ups (M14, M15)
- **Automates:** Authoritative prescription creation by treating dentists with atomic gapless numbering (`RX-YYYY-000001`), signed A4 PDF generation, and automatic follow-up task generation from completed treatments. Rebooking the patient automatically transitions follow-up tasks to `Booked`.
- **Proof:** `Prescriptions/PrescriptionTest`, `Followups/FollowupTest`, `tests/m19-prescriptions.test.js`, `tests/m20-followups.test.js`.

### 5. Patient Feedback & Automatic Quality Recovery (M26)
- **Automates:** 1 to 5 star rating submission tied strictly to completed visits. Ratings of 1 or 2 stars automatically trigger a high-priority follow-up task (`status='Open'`, `source='feedback'`) assigned to the branch front desk for corrective action.
- **Proof:** `Feedback/FeedbackTest`, `tests/m26-feedback.test.js`.

### 6. Email Outbox with Retries & Duplicate Protection (M19, M23)
- **Automates:** Outbox dispatch engine with exponential backoff (up to 4 attempts); unique idempotency keys per record and action ensure no reminder, notice, or invoice is ever delivered twice.
- **Proof:** `Mail/MailOutboxTest`, `Automations/AutomationsTest`.
