# Demo Script: A Day at the Clinic (12–15 Minutes)

Aligned with the official 26-module paper `BPA_MODULES_UPDATED_OCT_20_2026.docx`.

**Storyline:** A new patient registers online, books an appointment with PayMongo online payment, asks the Clinic Assistant, and chats with the front desk. Next, Bea (a returning patient) has her completed treatment billed with booking deposit credit and Senior/PWD discount, pays her balance online, downloads her receipt, and submits visit feedback. Finally, the Owner reviews feedback, tests audit logs, changes brand settings, and approves automation wording live.

Every step has a **FALLBACK**. Times are targets; total presentation time is ~15 minutes.

---

## Accounts (Demo Database; password `DemoPass123` unless noted)

| Role | Sign In / Identity | Window |
| :--- | :--- | :--- |
| **New Patient** (Registered live) | New Gmail alias, e.g. `jaztinalcantara17+panel1@gmail.com`, password `NewPatient#2026` | Window A, Mobile viewport (390 px) |
| **Bea Villanueva** (Returning patient) | `jaztinalcantara17+demo@gmail.com` | Window A after step 5 |
| **Front Desk Staff** | `staff.reception@example.test` | Window B, Desktop |
| **Clinic Owner** | `owner@example.test` | Window B after step 6 |

Gmail (`jaztinalcantara17@gmail.com` inbox) is open in Window C to monitor real OTPs, booking confirmations, outbox notifications, and PDF receipts.

---

## Pre-Demo Checklist (30 Minutes Before)

- [ ] Laptop on AC power; Do Not Disturb enabled; browser zoom 100%.
- [ ] Internet verified; mobile hotspot on standby.
- [ ] Docker container `dental-postgres` running on port 5432; API, scheduler, queue worker active.
- [ ] Demo reset completed today (`scripts/demo-reset.sh` or hosted seeder).
- [ ] Window A sized to 390 px on the landing page; Window B signed in on Staff worklist.
- [ ] PayMongo dashboard in **test mode** (supports GCash, card, Maya).
- [ ] Backup tab: `http://localhost:8000/dev/mail` (email outbox previews and PDFs).
- [ ] Backup recording: Desktop walkthrough video (`demo_flow.mp4` / `demo_recording.webp`).

---

## The Demo Script (Official 26-Module Alignment)

| # | Time | Module(s) | Actions (Exact Clicks) | Narrative ("Say") | FALLBACK |
| :---: | :---: | :--- | :--- | :--- | :--- |
| **1** | 0:00–1:30 | **M2 Branch Management** | Window A (mobile): Scroll landing page: hero, **How it Works**, **Services** (procedure catalog without confusing ad-hoc prices), **Branches** (3 real branches: Bocaue Main, Bocaue Annex, Guiguinto; live "Open now / Closed" status in Manila time), FAQ, and emergency contact. | "Dr. Roxas identified three primary operational bottlenecks: long patient queues (Q19, Q21), scheduling conflicts (Q20), and handling all inquiries personally on Messenger (PI-43). The system anchors all public branch schedules, operating hours, and service availability directly on real clinic database records." | If connection slow, loading skeletons show gracefully; continue to **Create Account**. |
| **2** | 1:30–2:30 | **M1 User Management** | Window A: Tap **Book a Visit** $\to$ registration card: enter Name, DOB, alias email, phone, strong password, agree to Privacy $\to$ **Create Account**. Window C: Open 6-digit OTP email. Window A: Input OTP $\to$ **Verify Email** $\to$ Sign in. | "Patient self-registration is secured via email OTP verification under RA 10173 principles. The patient authenticates themselves, eliminating front-desk data entry errors." | If email slow, read OTP from `/dev/mail` or use pre-verified panel alias. |
| **3** | 2:30–4:30 | **M6 Appointment Management** & **M21 Billing Management** | Tap **Book Your First Visit** $\to$ select **Oral Prophylaxis** $\to$ allow location or pick recommended branch $\to$ choose dentist or "Any available" $\to$ select date/time chip $\to$ **Review & Pay Booking Fee**. Process booking deposit via PayMongo test checkout (GCash/card) $\to$ appointment confirmed with 15-minute slot hold $\to$ **Add to Calendar**. Window C: Confirmation email arrives. | "Online booking shows only verified open slots, backed by database-level concurrency locks that make double-booking mathematically impossible. Patients pay the booking deposit online through PayMongo, which is credited directly towards their post-treatment invoice. Cancellation $\ge 24$h automatically issues a full refund." | If PayMongo test gateway delays, show booking confirmation from seed and view `/dev/mail` confirmation email. |
| **3b** | +45 s | **M7 Attendance Management** & **M19 Notification Management** | Window B (Owner): **Automations** $\to$ trigger demo clock for the new appointment code (APT-…). Window C: **Appointment Reminder** email arrives with Manila appointment time, branch address, calendar link, and single-use **"I'll be there" / "I can't make it"** confirmation buttons. | "Instead of manual phone calls (PI-31), automated reminders dispatch with single-use confirmation links. The patient's response immediately updates the front-desk attendance worklist." | Open `/dev/mail/appointment-reminder` preview. |
| **3c** | +60 s | **M8 Check-In Management** & **M9 Queue Management** | Window A (mobile): Open counter QR link (`#join/b1`) $\to$ **I'm New Here** $\to$ **Scan ID** (on-device QR/MRZ parse; name & DOB prefill without storing photo or ID number) $\to$ submit counter walk-in. Window B (Staff): **Check-In** page displays self-registration $\to$ staff verifies physical ID $\to$ confirms into live Queue $\to$ Queue number assigned. | "Walk-in registration is fully contact-free without paper clipboards (R2-03). The patient's ID is read on-device without retaining images or sensitive identity numbers, satisfying Data Privacy Act requirements." | Show `docs/ui-review/intake/` screenshots. |
| **3d** | +60 s | **M3 Staff Management** | Window B (Owner): **Team $\to$ Work Schedules**: view dentist hours. Open **Leave Requests**: approve dentist leave request $\to$ system checks booked appointments $\to$ offers one-click re-assignment to covering dentist or reschedule email without cancelling. | "Schedules and leave requests enforce real clinic rules. Approving leave immediately removes the doctor from online booking while protecting already-booked patients from arbitrary cancellation." | Screenshot `docs/ui-review/m3-m15-m25/`. |
| **3e** | +60 s | **M13 Treatment Management** | Window B (Dentist): Open completed encounter $\to$ **Dental Chart**: interactive SVG tooth chart (32 adult / 20 primary teeth). Tap tooth 36 $\to$ mark **Caries**, surfaces **O D** $\to$ record. Tap again $\to$ update to **Filled**. Record performed procedure $\to$ Complete Treatment. Window A (Patient): **My Teeth** shows updated condition in patient portal. | "The interactive SVG dental chart maintains an append-only clinical history per tooth. Completing treatment locks the clinical note and automatically creates a draft invoice for front-desk review." | Screenshot `docs/ui-review/m19-m20-m10/`. |
| **3f** | +45 s | **M14 Prescription Management** & **M15 Follow-Up Management** | Window B (Dentist): **Prescriptions** $\to$ prescribe medication (dosage, frequency, duration) $\to$ **Issue Prescription** (sequential number `RX-2026-000001` generated). Window A: Download A4 PDF with clinic header and license number. Window B: Check **Follow-Up Tasks** $\to$ follow-up task auto-created from treatment. | "Prescriptions are authored exclusively by treating dentists, locked with atomic sequence numbers, and downloadable as official A4 PDFs. Follow-up obligations automatically populate the front-desk worklist." | Show prescription PDF in test preview. |
| **4** | 4:30–5:30 | **M17 AI Chatbot Management** | Window A: Open **Ask Us** (Clinic Assistant) $\to$ type "Bukas ba kayo sa Linggo?" $\to$ type "Do you accept HMO?". | "The Clinic Assistant answers in English, Filipino, and Taglish strictly from Owner-approved clinic policies and live branch schedules. It refuses medical diagnosis and gracefully hands off complex inquiries to the front desk." | Show `docs/ui-review/patient/assistant/` screenshots. |
| **5** | 5:30–6:30 | **M18 Messaging Management** | Window A: **Messages** $\to$ send "Good day, can I bring my child?" Window B (Staff): Incoming conversation appears $\to$ Staff replies in real time. | "Messaging routes directly to the front desk of the patient's branch. Real-time WebSockets keep conversations instantaneous, backed by secure polling fallback." | Reload Window A if WebSockets reconnecting. |
| **6** | 6:30–9:30 | **M21 Billing Management** | Sign in as Bea Villanueva in Window A. Window B (Staff): Open Bea's invoice $\to$ **Apply 20% Senior Citizen / PWD Statutory Discount (RA 9994 / RA 10754)** $\to$ enter ID details $\to$ 20% discount line item applied; PayMongo booking deposit credited $\to$ Issue Invoice. Window A: **Review & Pay** $\to$ Pay remaining balance with PayMongo (GCash test) $\to$ Webhook marks invoice **Paid** $\to$ Window C receives Payment Receipt email with PDF. | "Billing is completely paperless. Staff apply statutory 20% Senior Citizen or PWD discounts with verified ID credentials. The booking fee paid during appointment scheduling is automatically deducted as a credit line. PayMongo webhooks settle the transaction and dispatch official PDF receipts." | If webhook delay, click Bea's pre-paid receipt in portal. |
| **7** | 9:30–11:00 | **M26 Feedback Management** | Window A (Bea): Open **Share Feedback** $\to$ select completed visit $\to$ submit **5-Star Rating** and comment: 'Excellent dental service!'. Window B (Owner): Open **Feedback Review** $\to$ filter by branch and dentist $\to$ show real-time rating and feedback entry. Explain: ratings $\le 2$ stars auto-create a high-priority follow-up task. | "Feedback is collected exclusively for verified completed visits. Patients provide an honest 1 to 5 star rating. Low ratings (1 or 2 stars) automatically spawn an actionable follow-up task for management remediation." | Show Feedback table in Owner portal. |
| **8** | 11:00–13:00 | **M5 Clinic Policy**, **M23 Automations**, & **M25 Audit Management** | Window B (Owner): **Clinic Branding** $\to$ customize primary brand colour. **Automations** $\to$ inspect wording approval requirements for SMS/email notices. Open **Audit Trail** $\to$ show forensic log of all logins, discount applications, invoice issuances, and feedback entries $\to$ click **Export CSV**. | "The Owner retains end-to-end governance: brand styling propagates to all customer-facing PDFs and emails, no automation runs without approved wording, and the append-only audit trail guarantees regulatory compliance." | View audit log records directly in UI. |
| **9** | 13:00–14:00 | **Conclusion & Paper Alignment** | Present the official 26-module status matrix from `MODULES_FINAL.md`. | "All 26 modules from the official paper `BPA_MODULES_UPDATED_OCT_20_2026.docx` are tracked with complete architectural honesty: 19 implemented, 7 partial, and 0 mock prototypes." | Open `docs/defense/MODULES_FINAL.md`. |

---

## Post-Demo Clean-Up

- Run `scripts/demo-reset.sh` to purge live demo test artifacts and restore clean baseline seed data.
- Ensure all live API keys and test tokens remain confidential.
