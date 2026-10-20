# Business Rules Catalog: Multi-Branch Dental Clinic System

Authoritative business logic enforced by server-side models, database constraints, form requests, and policies.

---

## 1. Booking & Scheduling Rules (M2, M3, M6)

1. **Operating Hours Enforcement:**
   - Monday to Friday: 8:00 AM – 8:00 PM (Asia/Manila).
   - Saturday: 8:00 AM – 5:00 PM (Asia/Manila).
   - Sunday: **Closed across all branches.** System strictly rejects appointments, visits, or slot generation on Sundays.
2. **Double-Booking Prevention:**
   - PostgreSQL `btree_gist` exclusion constraints ensure that no two active appointments for the same dentist or patient can overlap in time, even during concurrent checkout.
3. **Capacity & Slot Generation:**
   - Open slots are calculated dynamically as:  
     $$\text{Available Slots} = \text{Branch Operating Hours} \cap \text{Dentist Schedule} \setminus (\text{Leave} \cup \text{Existing Appointments})$$
   - "Any Available" dentist selection randomly allocates an open dentist who has active working hours for that branch, service, and time slot.
4. **Consultation-First Services:**
   - High-complexity, high-risk procedures (e.g. Braces, Orthodontics, Surgical Tooth Extraction, Implants) cannot be booked directly online. Selecting them directs the patient to book a prior Consultation visit.
5. **Branch Closures & Holidays:**
   - When the Owner schedules a branch closure, affected appointments are **never automatically cancelled**. The system identifies affected visits and emails patients a 1-click reschedule link.

---

## 2. Attendance, Late Arrival & No-Show Flow (M6, M8, M9)

1. **Appointment Reminders:**
   - Sent **60 minutes before** appointment by default (setting: optional 24h and morning-of reminders).
   - Email contains single-use, cryptographically signed links: "I'll be there" (confirms arrival) and "I can't make it" (releases slot).
2. **Late Arrival Protocol (R2-07, R2-10):**
   - **T+5 minutes:** Automated email check-in: *"Are you on your way?"*
   - **T+10 minutes:** Patient status flagged as **Late**. Upon check-in, late patients are placed at the **end of the queue** behind on-time patients.
   - **T+15 minutes:** Slot is automatically released; appointment marked as missed; patient emailed a polite rebooking invitation. Front desk can undo release same day.
3. **Cancellation Policy:**
   - Patients may cancel online without penalty up to **24 hours before** appointment time.
   - Cancellation under 24 hours is recorded as a **Late Cancellation**.
   - If a patient records **3 late cancellations or no-shows within 6 months**, online instant booking is disabled for their account; subsequent bookings require front-desk phone confirmation.

---

## 3. Clinical Charting & Prescriptions (M5, M10, M19)

1. **Encounter Integrity:**
   - Treatment records can only be initiated by the attending dentist assigned to that visit encounter.
   - Once marked `Completed`, treatment records and line items are locked permanently via database triggers.
2. **Dental Charting (M10):**
   - FDI 2-digit numbering (default) or Universal numbering.
   - Full 32 adult teeth and 20 primary teeth supported.
   - Append-only tooth condition history: each entry records tooth, surface (M, O, D, B, L), condition status, and timestamp.
   - Role boundaries: Attending dentist can view and record; Front Desk has read-only access without private clinical notes; Patient sees simplified condition chart; Owner has zero clinical access.
3. **Prescription Management (M19):**
   - Dentist-only authority.
   - Numbered sequentially using gapless formatting: `RX-YYYY-000001`.
   - Cannot be edited once issued. A mistake must be explicitly **Voided with a recorded reason** and re-issued.
   - PDF output includes clinic header, attending dentist's verified PRC license number, patient demographics, and mandatory notice: *"Valid only with the dentist's physical signature"*.

---

## 4. Billing & PayMongo Payments (M11, M23)

1. **Billing Derivation:**
   - Invoices are generated strictly from completed treatments and performed procedures.
   - Once an invoice is marked `Issued` or `Paid`, line items and amounts are immutable.
2. **Currency & Calculations:**
   - All amounts are computed and stored in **centavos (PHP 0.01 = 1 centavo)** using 64-bit integers to eliminate floating-point rounding errors.
3. **PayMongo Checkout Integration:**
   - Hosted Checkout Sessions supporting GCash and Credit/Debit cards.
   - Webhook endpoint validates cryptographic signatures (`paymongo-signature`) with a 5-minute replay tolerance window.
   - Idempotency keys prevent duplicate payment capture.
   - Branded PDF "Payment Receipt" is generated and emailed upon webhook confirmation.

---

## 5. Security, OTP & Account Claiming (M1)

1. **OTP Verification:**
   - 6-digit numeric code hashed with SHA-256 before storage.
   - Expiration: **10 minutes**.
   - Maximum failed attempts: **5 tries** before lockout.
   - Resend cooldown: **60 seconds**.
   - Anti-Abuse Rate Limits: Maximum 5 OTP requests per hour per email+IP; maximum 10 OTP requests per day per email.
2. **Hardened Account Claiming:**
   - Existing patients registered in-person at the clinic or dependents reaching age 18 can claim an online account.
   - Account password can only be set when submitting the verified 6-digit code sent to the email on file.
   - Records lacking an email require a staff-issued one-time link (24-hour validity, single-use, minors blocked).

---

## 6. Privacy & Data Protection (RA 10173)

1. **Data Minimization:**
   - Patient ID verification records only the card type, inspecting staff user ID, and timestamp. ID photos are never uploaded or retained on the server.
   - Patient ID numbers are never saved in full; optional last 4 digits only if enabled by Owner.
2. **Communication Privacy:**
   - Patient ↔ Front Desk messages are encrypted at rest using Laravel `APP_KEY`.
   - **The Owner cannot read patient conversations** or clinical private notes.
3. **Staff Handovers (M25):**
   - Inter-branch patient transfers grant the receiving branch's front desk access for an Owner-configured period (default: 60 days).
   - Access cannot be forwarded or renewed without a new clinical encounter.
