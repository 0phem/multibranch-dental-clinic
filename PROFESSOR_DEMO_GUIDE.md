# Professor Demo Walkthrough — Approved Target Flow

This sequence is designed to demonstrate the system as one connected BPA solution rather than 25 disconnected pages.

## 1. Start as Patient

1. Open **Dashboard** — show next visit, private queue status, follow-ups and notifications.
2. Open **Book Appointment** — deliberately choose a conflicting or invalid slot and show Smart Scheduling checks and alternative slots.
3. Open **My Appointments** — demonstrate reschedule and cancellation using the same validator.
4. Open **Queue & Wait** — emphasize privacy: the patient only sees their own position/status, not the staff queue.
5. Show **Receipts/Billing**, **Prescriptions**, **Follow-Ups**, **Messages**, and the global **Notifications** concept.
6. Show **Referral & Loyalty**, but point out the PE banner.

## 2. Switch to Staff

1. **Dashboard** — operational work requiring attention.
2. **Appointments** — create a new booking using Smart Scheduling.
3. **Check-In** — demonstrate the lightweight scheduled and walk-in admission paths; routine patients are not re-verified as if registering again.
4. **Patient Queue** — show priority, call, skip, treatment-ready, no-show and complete controls.
5. **Capacity & Workload** — show queue load, active dentists, thresholds and cross-branch capacity.
6. **Patient Records** — create/find a centralized patient record and show that staff clinical fields are restricted.
7. **Billing** — show the treatment-generated draft invoice, review/issue it, post payment and create the linked receipt.
8. **HMO** — start the prefilled case → resolve local missing requirements → submit to provider → follow up/escalate if overdue → record/synchronize provider response. Explain that provider approval is external.
9. **Social Inquiries** — capture inquiry, record response and link a booked appointment conversion.
10. **Messages** — show conversation history and failed-notification retry.
11. **Follow-Ups** — schedule a follow-up through the same Smart Scheduling component.

## 3. Switch to Dentist

1. **Clinical Dashboard / My Schedule / My Queue**.
2. **Patient Records** — show clinical fields available to the dentist.
3. **Treatment** — open the current queue patient; patient/dentist/branch/service context is already loaded, then document complaint, plan/procedure and notes.
4. The Dentist explicitly indicates whether prescription/follow-up is clinically required; completion then triggers the downstream tasks automatically.
5. Open **Prescriptions** — authorize the generated prescription task.
6. Open **Follow-Ups** — show the created scheduling obligation.

## 4. Switch to Owner/Admin — Dr. Dana Roxas

1. **Executive Dashboard** — exceptions first, cross-branch comparison, HMO and revenue summary.
2. **Branches** — operating hours/services/status reference.
3. **Staff & Dentists** — profiles are synchronized from Users & Access through `user_id`; edit license/specialization/branch/shift and show separate Active vs Available states.
4. **Capacity & Workload** — management-level branch pressure.
5. **Analytics & Reports** — cross-process KPI view and CSV export.
6. **Users & Access** — create the actual clinic account using ERD-aligned username/email/role/branch/status fields; Dentist/Staff roles automatically create the linked Module 3 profile.
7. **HMO Overview** — read-only management oversight; no fake owner approval button.
8. **Automation Monitor** — show orchestration health, protected rule visibility, and central success/failure feed.
9. **Engagement PE** — show M24/M25 only after the core modules and call them proposed enhancements.
10. Use the **25-Module Coverage document** for professor traceability; it is not a production clinic navigation item.

## Key defense statement

> The prototype intentionally has no backend/database yet. The purpose of this submission is to prove the complete final interface, roles, workflow boundaries, module connections, automation touchpoints, and user experience before persistence and integrations are implemented.
