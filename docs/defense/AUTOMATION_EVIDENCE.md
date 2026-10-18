# Automation evidence: what the system automates, module by module

Status words: **Built** = server-authoritative and tested; **Partly built** = the core works and is tested, named parts are
missing; **Mock only** = a browser-local prototype with no server record; **Not started** = planned module, no implementation.
Interview citations (Q, PI) are verbatim in `docs/defense/INTERVIEW_EVIDENCE.md`. Test paths are under `backend/tests/Feature/`
unless they start with `tests/` (frontend). Module names and owners: `MODULE_COVERAGE.md`.

## Summary

| Module | Status | Automates | Show it live |
| --- | --- | --- | --- |
| M1 User Management | Partly built | Email codes (OTP) for sign-up, password reset and email change; security notice to the old address; employee invitations | Register → code email → sign in |
| M2 Branch Management | Partly built | Real branches everywhere, opening days enforced in booking, public branch list | Owner → Branches; website Locations |
| M3 Work Schedules | Not started | — | — |
| M4 Patient Records | Partly built | Audited profile edits; name kept as issued on invoices/receipts | Staff → Patients |
| M5 Treatment Management | Built | Visit-linked treatment; completed treatment locked | Dentist → Treatment |
| M6 Appointment Management | Built | Conflict-free booking, Dentist auto-assignment, nearest-branch suggestion, month calendar, confirmation and change emails | Patient → Book a visit |
| M7 AI Chatbot | Built (knowledge mode) | Answers from the clinic's own answers and live records; hands unknowns to the front desk | Patient → Ask us; Owner → Assistant answers |
| M8 Patient Visits | Partly built | Check-in and walk-in Visit records | Staff → Check-In |
| M9 Patient Queue | Partly built | Queue numbers and transitions | Staff → Queue |
| M10 Dental Charts | Not started | — | — |
| M11 Billing Management | Built | Draft invoice from completed treatment, issue, invoice email with PDF, PDF download | Staff → Billing; Patient → Billing |
| M12 Treatment Plans | Not started | — | — |
| M13 Services and Pricing | Partly built | Versioned prices; price resolved for each invoice line | Owner → Services & Pricing |
| M14 Document Management | Partly built | Private document storage with type checks | Patient → Documents |
| M15 Leave Management | Not started | — | — |
| M16 Patient Inquiries | Partly built | Recorded inquiries with assignment | Staff → Inquiries |
| M17 Patient Messaging | Built | Real-time chat, auto-routed front desk, email alert when the patient is away | Patient ↔ Staff Messages |
| M18 Notifications | Built (email + in-app) | Email outbox with automatic retries; in-app notifications from real events | Patient bell; `scripts/predefense-check.sh` |
| M19 Prescriptions | Mock only | — (browser-local) | — |
| M20 Patient Follow-Up | Mock only | — (browser-local) | — |
| M21 Reports and Analytics | Partly built | Server metrics for the Owner | Owner → Analytics |
| M22 Audit Logs | Built | Append-only audit of sign-ins, changes and money events | Owner → Audit Trail |
| M23 Payment Management | Built (test mode) | PayMongo checkout; payment settled automatically from the verified webhook; Payment Receipt email with PDF | Patient → Billing → Review and pay |
| M24 Lab Cases | Not started | — | — |
| M25 Patient Handovers | Not started | — | — |

## The automation, in detail (strongest evidence first)

### 1. Payment settlement from the PayMongo webhook (M23, M11)
- **Automates:** the patient pays online (GCash, card and other methods enabled on the PayMongo account); PayMongo calls the
  clinic server (`checkout_session.payment.paid`); the server verifies the signature, settles the invoice, creates the receipt
  and emails the Payment Receipt with its PDF. Nobody types the payment in. Coming back from the payment page is **not** proof
  of payment; only the verified webhook is.
- **Replaces:** the receptionist recording payments and handing receipts (Q27 "billing … handled by the receptionist").
- **Proof:** `Payment/PayMongoPaymentTest`, `Billing/BillingHardeningTest`, `Mail/EmailDesignTest`. Test mode only.

### 2. Invoice and receipt generation (M11)
- **Automates:** a draft invoice is built from the performed procedures of a completed treatment; on Issue the patient gets the
  invoice email with a PDF; receipts are numbered and immutable; the patient's name is kept as issued.
- **Proof:** `Billing/BillingTest`, `Billing/DemoUnpaidInvoiceSeederTest` (name snapshot), `Billing/BillingDocumentDownloadTest`.

### 3. Email outbox with retries (M18)
- **Automates:** every email (codes, confirmations, changes, invoices, receipts, message alerts, security notices) is written to
  an outbox and sent by the queue worker; a failure is retried automatically, up to 4 attempts, after 1, 5 and 15 minutes
  (`config/clinic.php`); the scheduler sweeps due emails every minute. Each attempt is recorded.
- **Proof:** `Mail/MailOutboxTest`, `Mail/ClinicMailerTest`. Live: `scripts/predefense-check.sh` reports the queue and emails waiting.

### 4. Email verification codes (M1)
- **Automates:** a 6-digit code (valid 10 minutes, limited attempts and resends) for sign-up, password reset and email change;
  a security notice to the old address after an email change. After verification the patient signs in themselves.
- **Proof:** `Auth/EmailVerificationTest`, `Auth/AccountRecoveryTest`, `Auth/RegistrationTest`, `Appointments/PatientPortalApiTest`.

### 5. Scheduling rules (M6)
- **Automates:** only real open times are offered; double booking is impossible (also under concurrent requests); closed days
  are refused; a Dentist who does the service is assigned automatically ("Any available"), or the patient's chosen eligible
  Dentist; the nearest branch with the earliest slot is suggested (location used once, never stored); confirmation and change
  emails go out on their own.
- **Replaces:** Q20 "Scheduling conflicts" (most frequent error); Q27 booking handled by the receptionist; Q28.
- **Proof:** `Appointments/AppointmentBookingTest`, `ConcurrentBookingTest`, `AppointmentEmailTest`, `PatientPortalApiTest`;
  `docs/M6_BOOKING_RULES.md`.

### 6. Messages and alerts (M17)
- **Automates:** a patient's message is routed to the right front desk (upcoming appointment, then latest visit, then first
  branch); it appears in real time; if the patient is away when the clinic answers, a short email alert is sent (no message
  text), at most once per 15 minutes.
- **Replaces:** PI-42 (questions come through Facebook/Messenger) and PI-43 (the Owner usually answers them).
- **Proof:** `Messaging/MessagingTest`, `MessagingRealtimeTest`, `ConcurrentMessagingTest`.

### 7. In-app notifications (M18)
- **Automates:** booked, rescheduled, cancelled, invoice issued, payment received and new message notifications, written by the
  server events themselves; each opens its screen. Nothing is invented.
- **Proof:** `Appointments/PatientPortalApiTest::test_notifications_come_only_from_real_events_and_belong_to_one_person`.

### 8. The Clinic Assistant (M7)
- **Automates:** answers in English, Filipino and Taglish about services, branches, hours and closed days, booking, rescheduling,
  payment and receipts, sign-in, and the patient's own next appointment and balance; emergencies get the clinic phone;
  medical advice is refused; unknown facts go to the front desk. The Owner edits the answers and tests questions.
- **Replaces:** Q23 ("HMO contacting and online messaging on the clinic's social media" is what the Owner would automate first);
  PI-43.
- **Proof:** `Assistant/AssistantKnowledgeTest` (55 realistic questions), `Assistant/AssistantTest`.

### Not automated (say so if asked)
- **Appointment reminders.** PI-31: the clinic reminds patients for every appointment today. The system sends confirmation and
  change emails, but **no scheduled reminder email** yet.
- **HMO contacting** (Q22, Q23): removed from this scope; not automated.
- **Prescriptions** (Q16, PI-38) and **follow-ups**: browser-local prototypes only.

## Per module

| Module | Manual work it replaces (citation) | Evidence |
| --- | --- | --- |
| M1 | PI-01 Owner approves accounts; PI-02 first login by invitation | `Auth/*`, `Identity/EmployeeInvitationTest`, `RbacTest` |
| M2 | Q2 three branches; PI-14 same hours (times not given); PI-15 Owner decides closures | `Reference/*`, `PatientPortalApiTest` (closed days) |
| M3 | PI-05, PI-06 (schedules decided by the Owner) | None (not started) |
| M4 | Q17 records in digital software | `Patients/PatientRecordTest`, `ConcurrentPatientRecordTest` |
| M5 | Q15, Q27 treatment by the Dentist | `Treatments/TreatmentTest`, `ConcurrentTreatmentStartTest` |
| M6 | Q20, Q27, Q28, Q29 ("Appointments are fixed") | `Appointments/*` |
| M7 | Q23, PI-42, PI-43 | `Assistant/*` |
| M8 | Q15 arrival and dentist assignment; PI-13 | `Visits/*` |
| M9 | Q19 long queues; Q21 long waiting time | `Queue/*` |
| M10 | — | None (not started) |
| M11 | Q27 billing by the receptionist | `Billing/*` |
| M12 | — | None (not started) |
| M13 | Q12 price ranges | `Pricing/*` |
| M14 | Q16 digitized forms | `Documents/DocumentManagementTest` |
| M15 | — | None (not started) |
| M16 | PI-42 | `Inquiries/*` |
| M17 | PI-42, PI-43, PI-30 | `Messaging/*` |
| M18 | PI-29 booking/change updates; PI-31 reminders (not yet automated) | `Mail/*`, `PatientPortalApiTest` |
| M19 | PI-38 hand-written and printed prescriptions | Browser-local only |
| M20 | Q15 next appointment arranged at payment | Browser-local only |
| M21 | Q32 measurable "better" | `Analytics/*` |
| M22 | — (security and accountability) | `Audit/*` |
| M23 | Q27 billing | `Payment/PayMongoPaymentTest` |
| M24 | Manual external-lab tracking (confirmed 2026-10-12, `MODULE_COVERAGE.md`) | None (not started) |
| M25 | Informal handovers by calls/messages (confirmed 2026-10-12) | None (not started) |
